import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Calendar,
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
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  MapPin,
  HeartPulse,
  FolderLock,
} from 'lucide-react';
import { supabase, Notification as NotificationType } from '../lib/supabase';

const navItems = [
  { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'collaborator', 'nurse', 'lawyer'] },
  { path: '/visits', label: 'Visites', icon: Clock, roles: ['admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'collaborator', 'nurse', 'lawyer'] },
  { path: '/visitors', label: 'Visiteurs', icon: Users, roles: ['admin', 'director', 'reception', 'lawyer'] },
  { path: '/agenda', label: 'Agenda', icon: Calendar, roles: ['admin', 'director', 'reception', 'service_manager', 'collaborator', 'accounting', 'cashier', 'nurse'] },
  { path: '/rh', label: 'Espace RH', icon: User, roles: ['admin', 'director', 'reception', 'service_manager', 'collaborator', 'accounting', 'cashier', 'nurse'] },
  { path: '/missions', label: 'Missions', icon: MapPin, roles: ['admin', 'director', 'reception', 'service_manager', 'collaborator'] },
  { path: '/permissions', label: 'Permissions', icon: FolderLock, roles: ['admin', 'director'] },
  { path: '/infirmerie', label: 'Infirmerie', icon: HeartPulse, roles: ['admin', 'director', 'reception', 'service_manager', 'collaborator', 'accounting', 'cashier', 'nurse'] },
  { path: '/services', label: 'Services', icon: Briefcase, roles: ['admin', 'director', 'service_manager'] },
  { path: '/invoices', label: 'Facturation', icon: CreditCard, roles: ['admin', 'director', 'accounting', 'cashier'] },
  { path: '/reports', label: 'Rapports', icon: BarChart3, roles: ['admin', 'director'] },
  { path: '/users', label: 'Utilisateurs', icon: UserCog, roles: ['admin', 'director'] },
  { path: '/settings', label: 'Parametres', icon: Settings, roles: ['admin', 'director'] },
];

export default function Layout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [urgentCases, setUrgentCases] = useState(0);

  
  // Theme and Collapse state
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchNotifications();
    fetchUrgentCases();
  }, [user]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleSidebarCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

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

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);
    if (!error) {
      setNotifications([]);
    }
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
      reception: 'Assistante de Direction',
      service_manager: 'Responsable Service',
      accounting: 'Comptabilite',
      cashier: 'Caissier(ère)',
      collaborator: 'Collaborateur',
      nurse: 'Infirmier',
      lawyer: 'Juriste Externe',
    };
    return labels[role] || role;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] flex transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside 
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-[#0B0F19] transition-all duration-300 z-40 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
          {/* Logo Section */}
          <div className={`p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-3">
              <img
                src="/logo-gico.png"
                alt="GICO SARL"
                className="w-10 h-10 object-contain rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-0.5 shadow-sm"
              />
              {!collapsed && (
                <div>
                  <h1 className="font-bold text-slate-800 dark:text-white leading-tight">GICO SARL</h1>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-primary-600 dark:text-primary-400">Visit Tracker</p>
                </div>
              )}
            </div>
            
            {!collapsed && (
              <button 
                onClick={toggleSidebarCollapse}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Reduire le menu"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1.5">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-link flex items-center ${isActive ? 'sidebar-link-active' : ''} ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* Urgent Dossiers Indicator */}
          {urgentCases > 0 && !collapsed && (
            <div className="p-4 mx-4 mb-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
              <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="font-semibold text-xs tracking-wide">{urgentCases} dossier(s) urgent(s)</span>
              </div>
            </div>
          )}

          {/* Sidebar Collapse Expand for Collapsed state */}
          {collapsed && (
            <div className="flex justify-center p-3">
              <button 
                onClick={toggleSidebarCollapse}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* User Profile Info Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-100 to-primary-200 dark:from-primary-950 dark:to-primary-900 flex items-center justify-center flex-shrink-0 shadow-inner">
                <User className="w-4 h-4 text-primary-700 dark:text-primary-400" />
              </div>
              
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                    {profile?.full_name}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wide truncate">
                    {getRoleLabel(profile?.role || '')}
                  </p>
                </div>
              )}
              
              {!collapsed && (
                <button
                  onClick={handleSignOut}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all duration-200"
                  title="Deconnexion"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-[#0B0F19] border-r border-slate-200 dark:border-slate-800 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-gico.png"
              alt="GICO SARL"
              className="w-8 h-8 object-contain rounded-lg bg-white p-0.5 border border-slate-200 dark:border-slate-800 shadow-sm"
            />
            <span className="font-bold text-slate-800 dark:text-white">GICO SARL</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `sidebar-link flex items-center gap-3 px-4 py-3 ${isActive ? 'sidebar-link-active' : ''}`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleSignOut}
            className="btn-danger w-full justify-center"
          >
            <LogOut className="w-4.5 h-4.5 mr-2" />
            Se deconnecter
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        {/* Top Bar / Header */}
        <header className="sticky top-0 z-30 bg-white/70 dark:bg-[#090D16]/70 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 transition-colors duration-300">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Left Mobile Menu Toggle / Desktop Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="hidden lg:flex items-center gap-3">
                <img src="/logo-gico.png" alt="GICO" className="h-7 w-7 object-contain" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide uppercase">Système de Suivi des Visites</h2>
              </div>
            </div>

            {/* Right Tools Area (Search, Theme, Notifications, User Profile) */}
            <div className="flex items-center gap-3">
              {/* Search Bar - Aesthetic */}
              <div className="hidden md:flex items-center relative mr-1">
                <input
                  type="text"
                  placeholder="Recherche globale... (Ctrl+K)"
                  className="w-56 px-3.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:w-64 transition-all duration-300 outline-none"
                  readOnly
                  onClick={() => navigate('/visits')}
                />
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-all duration-300 relative group"
                title={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5 transform group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <Sun className="w-5 h-5 transform group-hover:rotate-45 transition-transform duration-300" />
                )}
              </button>

              {/* Notifications Popover */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors relative ${notifOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                >
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 dark:bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#090D16] animate-pulse"></span>
                  )}
                </button>

                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 mt-3.5 w-80 rounded-2xl shadow-xl bg-white dark:bg-[#0F1422] border border-slate-100 dark:border-slate-800/80 p-2.5 z-50 animate-slide-in-top">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800/80">
                        <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider">Notifications</h4>
                        {notifications.length > 0 && (
                          <button 
                            onClick={markAllAsRead} 
                            className="text-[10px] font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" /> Tout marquer
                          </button>
                        )}
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto scrollbar-thin p-1 space-y-1 mt-1.5">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <div 
                              key={notif.id} 
                              className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/60 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                              onClick={() => {
                                setNotifOpen(false);
                                if (notif.link) navigate(notif.link);
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                                  notif.type === 'error' ? 'bg-rose-500' :
                                  notif.type === 'warning' ? 'bg-amber-500' :
                                  notif.type === 'success' ? 'bg-emerald-500' : 'bg-primary-500'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <h5 className="text-xs font-bold text-slate-800 dark:text-white truncate">{notif.title}</h5>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-0.5 leading-normal">{notif.message}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6">
                            <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-xs text-slate-400 dark:text-slate-500">Aucune notification en attente</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Dropdown Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-300 border border-transparent ${userMenuOpen ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700/50' : ''}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-250 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="dropdown right-0 mt-3 w-56 animate-slide-in-top">
                      <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{profile?.full_name}</p>
                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">{profile?.email}</p>
                      </div>
                      
                      <NavLink
                        to="/settings"
                        className="dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span>Paramètres</span>
                      </NavLink>
                      
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left dropdown-item text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Se déconnecter</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto animate-slide-in-bottom">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-100 dark:border-slate-800/60 bg-white/50 dark:bg-[#0B0F19]/40 py-4 px-8 text-center text-xs text-slate-400 dark:text-slate-500 transition-colors duration-300">
          <p>© {new Date().getFullYear()} GICO SARL - Visit Tracker v1.2 | Tous droits réservés.</p>
        </footer>
      </div>
    </div>
  );
}
