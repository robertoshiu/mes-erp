import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  moduleName: string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.moduleName}]`, error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-canvas">
          <div className="panel flex flex-col items-center gap-4 px-8 py-6">
            <div className="font-mono text-sm text-ink-2">
              {this.props.moduleName}: Event subscription error
            </div>
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
    return this.props.children
  }
}
