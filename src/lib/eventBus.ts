import { Subject, Observable } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { MesEvent, EventTopic } from './events'

// Extract the event type for a given topic
type EventOfTopic<T extends EventTopic> = Extract<MesEvent, { topic: T }>

export interface EventBus {
  publish(event: MesEvent): void
  publishBatch(events: MesEvent[]): void
  all$(): Observable<MesEvent>
  ofTopic<T extends EventTopic>(topic: T): Observable<EventOfTopic<T>>
  ringBuffer$(): Observable<MesEvent[]>
  getBuffer(): MesEvent[]
  destroy(): void
}

export function createEventBus(bufferSize = 1000): EventBus {
  const subject = new Subject<MesEvent>()

  // Ring buffer: fixed-size array + write pointer
  const ring: (MesEvent | null)[] = new Array(bufferSize).fill(null)
  let writePtr = 0
  let count = 0

  // Ring buffer observable — emits current buffer snapshot on each event
  const ringSubject = new Subject<MesEvent[]>()

  function getBuffer(): MesEvent[] {
    if (count === 0) return []
    const size = Math.min(count, bufferSize)
    const result: MesEvent[] = new Array(size)
    const startIdx = count <= bufferSize ? 0 : writePtr
    for (let i = 0; i < size; i++) {
      result[i] = ring[(startIdx + i) % bufferSize] as MesEvent
    }
    return result
  }

  function addToRing(event: MesEvent) {
    ring[writePtr] = event
    writePtr = (writePtr + 1) % bufferSize
    count++
  }

  function publish(event: MesEvent) {
    addToRing(event)
    subject.next(event)
    ringSubject.next(getBuffer())
  }

  function publishBatch(events: MesEvent[]) {
    for (const event of events) {
      addToRing(event)
      subject.next(event)
    }
    ringSubject.next(getBuffer())
  }

  function all$(): Observable<MesEvent> {
    return subject.asObservable()
  }

  function ofTopic<T extends EventTopic>(topic: T): Observable<EventOfTopic<T>> {
    return subject.pipe(
      filter((e): e is EventOfTopic<T> => e.topic === topic)
    )
  }

  function destroy() {
    subject.complete()
    ringSubject.complete()
  }

  return {
    publish,
    publishBatch,
    all$,
    ofTopic,
    ringBuffer$: () => ringSubject.asObservable(),
    getBuffer,
    destroy,
  }
}
