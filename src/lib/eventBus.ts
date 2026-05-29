import { Subject, Observable } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { AppEvent, AppTopic } from './events'

// Extract the event type for a given topic (across MES + ERP).
type EventOfTopic<T extends AppTopic> = Extract<AppEvent, { topic: T }>

export interface EventBus {
  publish(event: AppEvent): void
  publishBatch(events: AppEvent[]): void
  all$(): Observable<AppEvent>
  ofTopic<T extends AppTopic>(topic: T): Observable<EventOfTopic<T>>
  ringBuffer$(): Observable<AppEvent[]>
  getBuffer(): AppEvent[]
  destroy(): void
}

export function createEventBus(bufferSize = 1000): EventBus {
  const subject = new Subject<AppEvent>()

  // Ring buffer: fixed-size array + write pointer
  const ring: (AppEvent | null)[] = new Array(bufferSize).fill(null)
  let writePtr = 0
  let count = 0

  // Ring buffer observable — emits current buffer snapshot on each event
  const ringSubject = new Subject<AppEvent[]>()

  function getBuffer(): AppEvent[] {
    if (count === 0) return []
    const size = Math.min(count, bufferSize)
    const result: AppEvent[] = new Array(size)
    const startIdx = count <= bufferSize ? 0 : writePtr
    for (let i = 0; i < size; i++) {
      result[i] = ring[(startIdx + i) % bufferSize] as AppEvent
    }
    return result
  }

  function addToRing(event: AppEvent) {
    ring[writePtr] = event
    writePtr = (writePtr + 1) % bufferSize
    count++
  }

  function publish(event: AppEvent) {
    addToRing(event)
    subject.next(event)
    ringSubject.next(getBuffer())
  }

  function publishBatch(events: AppEvent[]) {
    for (const event of events) {
      addToRing(event)
      subject.next(event)
    }
    ringSubject.next(getBuffer())
  }

  function all$(): Observable<AppEvent> {
    return subject.asObservable()
  }

  function ofTopic<T extends AppTopic>(topic: T): Observable<EventOfTopic<T>> {
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
