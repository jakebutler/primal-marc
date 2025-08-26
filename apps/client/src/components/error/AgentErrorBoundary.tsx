import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, RefreshCw, MessageCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  agentType?: string;
  onRetry?: () => void;
  onFallbackMode?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class AgentErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Agent error (${this.props.agentType}):`, error, errorInfo);
    
    // Report agent-specific errors
    this.reportAgentError(error, errorInfo);
  }

  private reportAgentError = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport = {
      type: 'agent_error',
      agentType: this.props.agentType,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
    };

    // Store for analytics
    localStorage.setItem(
      `agent_error_${Date.now()}`,
      JSON.stringify(errorReport)
    );
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        retryCount: prevState.retryCount + 1,
      }));
      this.props.onRetry?.();
    }
  };

  private handleFallbackMode = () => {
    this.props.onFallbackMode?.();
  };

  render() {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < this.maxRetries;
      
      return (
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 text-muted-foreground">
              <Bot className="h-full w-full" />
            </div>
            <CardTitle className="text-lg">AI Agent Unavailable</CardTitle>
            <CardDescription>
              The {this.props.agentType || 'AI'} agent encountered an error and needs to restart.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground text-center">
              {canRetry ? (
                <p>Retry attempt {this.state.retryCount + 1} of {this.maxRetries}</p>
              ) : (
                <p>Maximum retries reached. You can continue working without AI assistance.</p>
              )}
            </div>
            <div className="flex gap-2">
              {canRetry ? (
                <Button onClick={this.handleRetry} className="flex-1">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Agent
                </Button>
              ) : (
                <Button onClick={this.handleFallbackMode} variant="outline" className="flex-1">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Continue Without AI
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}