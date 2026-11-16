import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { AppLayout, RequireRole } from './components/layout/AppLayout.jsx';
import { LoadingSpinner } from './components/ui/States.jsx';
import LoginPage from './pages/LoginPage.jsx';

// Heavier pages are code-split so the first load stays small.
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const TicketListPage = lazy(() => import('./pages/TicketListPage.jsx'));
const CreateTicketPage = lazy(() => import('./pages/CreateTicketPage.jsx'));
const TicketDetailsPage = lazy(() => import('./pages/TicketDetailsPage.jsx'));
const AssistantPage = lazy(() => import('./pages/AssistantPage.jsx'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage.jsx'));
const ArticlePage = lazy(() => import('./pages/ArticlePage.jsx'));
const ArticleEditorPage = lazy(() => import('./pages/ArticleEditorPage.jsx'));
const AssetsPage = lazy(() => import('./pages/AssetsPage.jsx'));
const AssetDetailsPage = lazy(() => import('./pages/AssetDetailsPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const UsersPage = lazy(() => import('./pages/UsersPage.jsx'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

const STAFF = ['admin', 'it_support'];
const staff = (el) => <RequireRole roles={STAFF}>{el}</RequireRole>;
const admin = (el) => <RequireRole roles={['admin']}>{el}</RequireRole>;

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner className="min-h-[50vh]" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="my-tickets" element={<TicketListPage scope="mine" />} />
          <Route path="tickets" element={staff(<TicketListPage scope="all" />)} />
          <Route path="tickets/new" element={<CreateTicketPage />} />
          <Route path="tickets/:id" element={<TicketDetailsPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="knowledge-base/new" element={staff(<ArticleEditorPage />)} />
          <Route path="knowledge-base/:id/edit" element={staff(<ArticleEditorPage />)} />
          <Route path="knowledge-base/:slug" element={<ArticlePage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/:id" element={<AssetDetailsPage />} />
          <Route path="reports" element={admin(<ReportsPage />)} />
          <Route path="admin/users" element={admin(<UsersPage />)} />
          <Route path="admin/audit-logs" element={admin(<AuditLogsPage />)} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
