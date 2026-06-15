import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import VisitsListPage from './pages/VisitsListPage';
import VisitFormPage from './pages/VisitFormPage';
import VisitDetailPage from './pages/VisitDetailPage';
import VisitorsListPage from './pages/VisitorsListPage';
import ServicesListPage from './pages/ServicesListPage';
import InvoicesListPage from './pages/InvoicesListPage';
import UsersListPage from './pages/UsersListPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import AgendaPage from './pages/AgendaPage';
import RHPage from './pages/RHPage';
import MissionsPage from './pages/MissionsPage';
import PermissionsPage from './pages/PermissionsPage';
import InfirmeriePage from './pages/InfirmeriePage';

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
                <AuthGuard requiredRoles={['admin', 'director', 'service_manager']}>
                  <ServicesListPage />
                </AuthGuard>
              }
            />

            {/* Invoices */}
            <Route
              path="invoices"
              element={
                <AuthGuard requiredRoles={['admin', 'director', 'accounting']}>
                  <InvoicesListPage />
                </AuthGuard>
              }
            />

            {/* Reports */}
            <Route
              path="reports"
              element={
                <AuthGuard requiredRoles={['admin', 'director']}>
                  <ReportsPage />
                </AuthGuard>
              }
            />

            {/* Users */}
            <Route
              path="users"
              element={
                <AuthGuard requiredRoles={['admin']}>
                  <UsersListPage />
                </AuthGuard>
              }
            />

            {/* Settings */}
            <Route
              path="settings"
              element={
                <AuthGuard requiredRoles={['admin']}>
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
                <AuthGuard requiredRoles={['admin', 'director']}>
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
  );
}

export default App;
