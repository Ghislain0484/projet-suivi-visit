import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CompanySettingsProvider } from './contexts/CompanySettingsContext';
import { AuthGuard } from './components/AuthGuard';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';

// Lazy load pages for code-splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const VisitsListPage = lazy(() => import('./pages/VisitsListPage'));
const VisitFormPage = lazy(() => import('./pages/VisitFormPage'));
const VisitDetailPage = lazy(() => import('./pages/VisitDetailPage'));
const VisitorsListPage = lazy(() => import('./pages/VisitorsListPage'));
const ServicesListPage = lazy(() => import('./pages/ServicesListPage'));
const InvoicesListPage = lazy(() => import('./pages/InvoicesListPage'));
const UsersListPage = lazy(() => import('./pages/UsersListPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AgendaPage = lazy(() => import('./pages/AgendaPage'));
const RHPage = lazy(() => import('./pages/RHPage'));
const MissionsPage = lazy(() => import('./pages/MissionsPage'));
const PermissionsPage = lazy(() => import('./pages/PermissionsPage'));
const InfirmeriePage = lazy(() => import('./pages/InfirmeriePage'));

function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acces refuse</h1>
        <p className="text-gray-500 mb-4">Vous n'avez pas les autorisations necessaires pour acceder a cette page.</p>
        <a href="/dashboard" className="btn-primary">
          Retour au tableau de bord
        </a>
      </div>
    </div>
  );
}


function App() {
  return (
    <CompanySettingsProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Visits */}
            <Route path="visits" element={<VisitsListPage />} />
            <Route
              path="visits/new"
              element={
                <AuthGuard requiredRoles={['admin', 'reception', 'director']}>
                  <VisitFormPage />
                </AuthGuard>
              }
            />
            <Route path="visits/:id" element={<VisitDetailPage />} />
            <Route
              path="visits/:id/edit"
              element={
                <AuthGuard requiredRoles={['admin', 'reception', 'director']}>
                  <VisitFormPage />
                </AuthGuard>
              }
            />

            {/* Visitors */}
            <Route path="visitors" element={<VisitorsListPage />} />

            {/* Services */}
            <Route
              path="services"
              element={
                <AuthGuard requiredRoles={['admin', 'director', 'service_manager', 'reception']}>
                  <ServicesListPage />
                </AuthGuard>
              }
            />

            {/* Invoices */}
            <Route
              path="invoices"
              element={
                <AuthGuard requiredRoles={['admin', 'director', 'accounting', 'cashier', 'service_manager', 'reception']}>
                  <InvoicesListPage />
                </AuthGuard>
              }
            />

            {/* Reports */}
            <Route
              path="reports"
              element={
                <AuthGuard requiredRoles={['admin', 'director', 'service_manager', 'reception']}>
                  <ReportsPage />
                </AuthGuard>
              }
            />

            {/* Users */}
            <Route
              path="users"
              element={
                <AuthGuard requiredRoles={['admin', 'director']}>
                  <UsersListPage />
                </AuthGuard>
              }
            />

            {/* Settings */}
            <Route
              path="settings"
              element={
                <AuthGuard requiredRoles={['admin', 'director', 'reception']}>
                  <SettingsPage />
                </AuthGuard>
              }
            />

            {/* Agenda */}
            <Route path="agenda" element={<AgendaPage />} />

            {/* RH & Presence */}
            <Route path="rh" element={<RHPage />} />

            {/* Missions */}
            <Route path="missions" element={<MissionsPage />} />

            {/* Permissions Approval */}
            <Route
              path="permissions"
              element={
                <AuthGuard requiredRoles={['admin', 'director', 'service_manager', 'reception']}>
                  <PermissionsPage />
                </AuthGuard>
              }
            />

            {/* Infirmerie */}
            <Route path="infirmerie" element={<InfirmeriePage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </CompanySettingsProvider>
  );
}

export default App;
