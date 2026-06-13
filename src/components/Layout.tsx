import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  User,
  BarChart3,
  Briefcase,
  UserCog,
  AlertTriangle,
} from 'lucide-react';
import { supabase, Service, Notification as NotificationType } from '../lib/supabase';

const navItems = [
  { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin', 'director', 'reception', 'service_manager', 'accounting'] },
  { path: '/visits', label: 'Visites', icon: Calendar, roles: ['admin', 'director', 'reception', 'service_manager', 'accounting'] },
  { path: '/visitors', label: 'Visiteurs', icon: Users, roles: ['admin', 'director', 'reception'] },
  { path: '/services', label: 'Services', icon: Briefcase, roles: ['admin', 'director', 'service_manager'] },
  { path: '/invoices', label: 'Facturation', icon: CreditCard, roles: ['admin', 'director', 'accounting'] },
  { path: '/reports', label: 'Rapports', icon: BarChart3, roles: ['admin', 'director'] },
  { path: '/users', label: 'Utilisateurs', icon: UserCog, roles: ['admin'] },
  { path: '/settings', label: 'Parametres', icon: Settings, roles: ['admin'] },
];

export default function Layout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [urgentCases, setUrgentCases] = useState(0);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    fetchNotifications();
    fetchServices();
    fetchUrgentCases();
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setNotifications(data);
  };

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    if (data) setServices(data);
  };

  const fetchUrgentCases = async () => {
    const { count } = await supabase
      .from('visit_followups')
      .select('*', { count: 'exact', head: true })
      .in('status', ['blocked', 'late'])
      .eq('priority', 'urgent');
    if (count) setUrgentCases(count);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(
    (item) => profile && item.roles.includes(profile.role)
  );

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      admin: 'Administrateur',
      director: 'Directeur General',
      reception: 'Reception',
      service_manager: 'Responsable Service',
      accounting: 'Comptabilite',
    };
    return labels[role] || role;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-gray-200 bg-white">
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img
                src="/logo-gico.png"
                alt="GICO SARL"
                className="w-10 h-10 object-contain rounded-lg bg-white border border-gray-200 p-0.5"
              />
              <div>
                <h1 className="font-bold text-gray-900">GICO SARL</h1>
                <p className="text-xs text-gray-500">Visit Tracker</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {urgentCases > 0 && (
            <div className="p-4 mx-4 mb-4 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium text-sm">{urgentCases} dossier(s) urgent(s)</span>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="w-4 h-4 text-primary-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile?.full_name}
                </p>
                <p className="text-xs text-gray-500">{getRoleLabel(profile?.role || '')}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Deconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <img
              src="/logo-gico.png"
              alt="GICO SARL"
              className="w-8 h-8 object-contain rounded-lg bg-white border border-gray-200 p-0.5"
            />
            <span className="font-bold text-gray-900">GICO SARL</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="btn-danger w-full"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Se deconnecter
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden lg:block">
              <div className="flex items-center gap-3">
                <img src="/logo-gico.png" alt="GICO" className="h-8 w-8 object-contain" />
                <h2 className="text-lg font-semibold text-gray-900">Systeme de Gestion des Visites</h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="hidden sm:flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-700" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {profile?.full_name}
                    </p>
                    <p className="text-xs text-gray-500">{getRoleLabel(profile?.role || '')}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="dropdown">
                      <NavLink
                        to="/profile"
                        className="dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Mon profil
                      </NavLink>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left dropdown-item text-red-600"
                      >
                        Se deconnecter
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
          <p>GICO SARL - Visit Tracker v1.0 | Tous droits reserves</p>
        </footer>
      </div>
    </div>
  );
}
