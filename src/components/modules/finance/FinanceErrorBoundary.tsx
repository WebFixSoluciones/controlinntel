"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class FinanceErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Finance submodule error caught:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white border border-rose-200 rounded-xl shadow-xs text-center max-w-lg mx-auto my-8 space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {this.props.fallbackTitle || "Error al cargar la vista financiera"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Se detectó un error al procesar los datos de este submódulo. Puedes reintentar o navegar a otra pestaña.
            </p>
            {this.state.error?.message && (
              <p className="mt-2 text-[11px] font-mono text-rose-600 bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
            <button
              onClick={() => {
                window.location.href = "/finanzas?sub=cobranzas_opex";
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Ir a Cobranzas y Gastos
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
