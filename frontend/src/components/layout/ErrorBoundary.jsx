import { Component } from 'react';
import { ErrorState } from '../ui/States.jsx';

/** Catches render errors in a page so the rest of the shell keeps working. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] page crashed:', error, info.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Navigating to another page clears the error.
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card">
          <ErrorState title="This page failed to load" error={{ message: 'An unexpected error occurred while displaying this page. Reload to try again.' }} onRetry={() => window.location.reload()} />
        </div>
      );
    }
    return this.props.children;
  }
}
