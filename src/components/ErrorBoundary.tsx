import { Component, Fragment, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  moduleName: string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  retryKey: number
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.moduleName}]`, error, info.componentStack)
  }

  handleReload = () => {
    this.setState((s) => ({ hasError: false, error: null, retryKey: s.retryKey + 1 }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-canvas">
          <div className="panel flex flex-col items-center gap-4 px-8 py-6">
            <div className="font-mono text-sm text-ink-2">
              {this.props.moduleName} failed to load
            </div>
            {this.state.error?.message && (
              <div className="font-mono text-xs text-ink-mute max-w-[30rem] text-center break-words">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="px-3 py-1.5 text-sm font-mono border border-edge rounded-sm text-accent hover:border-edge-strong"
            >
              Reload module
            </button>
          </div>
        </div>
      )
    }
    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>
  }
}
