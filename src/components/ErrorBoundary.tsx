import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-foreground">משהו השתבש</h1>
              <p className="mt-2 text-muted-foreground">
                נתקלנו בשגיאה לא צפויה. נסה לרענן את הדף או חזור לדף הבית.
              </p>
              {this.state.error?.message && (
                <pre className="mt-4 text-xs text-left bg-muted p-3 rounded-lg overflow-auto max-h-32 text-muted-foreground">
                  {this.state.error.message}
                </pre>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.reset}>
                <RefreshCw className="ml-2" size={16} />
                רענן את הדף
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/")}>
                <Home className="ml-2" size={16} />
                לדף הבית
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
