import { Suspense, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { BreadcrumbProvider } from '../../context/BreadcrumbContext.jsx';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { LoadingSpinner, ErrorState } from '../ui/States.jsx';

/** Protected application shell. Redirects anonymous visitors to the login page. */
export function AppLayout() {
  const { status, anonymousReason } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // New page → start at the top (filters on the same page keep their position).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (status === 'loading') return <LoadingSpinner label="Loading OpsDesk…" className="min-h-screen" />;
  if (status === 'anonymous') {
    const from = anonymousReason === 'signed_out' ? undefined : location.pathname + location.search;
    return <Navigate to="/login" replace state={from ? { from } : undefined} />;
  }

  return (
    <BreadcrumbProvider>
      <a href="#main" className="sr-only z-50 rounded-md bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Suspense here keeps the shell visible while a lazy page loads. */}
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<LoadingSpinner className="min-h-[40vh]" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </BreadcrumbProvider>
  );
}

/** Client-side route guard. The API enforces the same rule; this only avoids showing dead pages. */
export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) {
    return <ErrorState title="Access restricted" error={{ status: 403, message: 'Your role does not have access to this page.' }} />;
  }
  return children;
}
