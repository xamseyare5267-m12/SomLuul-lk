import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  // @ts-ignore
  props: Props;
  
  state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-4 text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">SomLuul App - Refreshed</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            Nidaamka wuxuu dib u hagaajinayaa shabakada. Fadlan guji batoonka hoose si aad dib u soo cusboonaysiiso app-ka.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Dib u culey (Reload App)
            </button>
            <button
              onClick={this.handleResetState}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer border border-slate-700"
            >
              <Home className="w-4 h-4" />
              Safay State / Reset
            </button>
          </div>
          {this.state.error && (
            <details className="mt-8 text-left bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs text-red-300/80 max-w-lg overflow-auto">
              <summary className="cursor-pointer font-mono font-bold text-slate-400 mb-2">Faahfaahinta Cilada (Technical Details)</summary>
              <pre className="font-mono whitespace-pre-wrap">{this.state.error.toString()}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
