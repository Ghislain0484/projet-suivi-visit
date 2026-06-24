import { useEffect, useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  DollarSign,
  Activity,
  MapPin,
} from 'lucide-react';
import { supabase, Visit, HRPresence, Mission, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMinutes } from 'date-fns';


interface DashboardStats {
  todayVisits: number;
  weekVisits: number;
  monthVisits: number;
  withAppointment: number;
  withoutAppointment: number;
  totalInvoiced: number;
  totalPaid: number;
  invoicedCount: number;
  notInvoicedCount: number;
  urgentCases: number;
  blockedCases: number;
  lateCases: number;
  presentCount: number;
  absentCount: number;
  missionCount: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats & { totalRemaining: number; recoveryRate: number }>({
    todayVisits: 0,
    weekVisits: 0,
    monthVisits: 0,
    withAppointment: 0,
    withoutAppointment: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalRemaining: 0,
    recoveryRate: 100,
    invoicedCount: 0,
    notInvoicedCount: 0,
    urgentCases: 0,
    blockedCases: 0,
    lateCases: 0,
    presentCount: 0,
    absentCount: 0,
    missionCount: 0,
  });

  const [visitsQueue, setVisitsQueue] = useState<Visit[]>([]);
  const [visitsByService, setVisitsByService] = useState<any[]>([]);
  const [visitTrend, setVisitTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab control & financial data
  const [activeTab, setActiveTab] = useState<'activity' | 'finance'>('activity');
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [financeTrend, setFinanceTrend] = useState<any[]>([]);
  
  // Realtime Collaborator presence & missions tracker
  const [presencesToday, setPresencesToday] = useState<HRPresence[]>([]);
  const [activeMissions, setActiveMissions] = useState<Mission[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to realtime visits queue
    const visitsChannel = supabase
      .channel('dashboard-visits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(visitsChannel);
    };
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();
    const todayStr = format(now, 'yyyy-MM-dd');
    const sevenDaysAgoStart = startOfDay(subDays(now, 6)).toISOString();

    try {
      // Parallelized Promise.all fetches (Optimized to prevent query storm)
      const [
        servicesRes,
        todayVisitsRes,
        weekVisitsRes,
        monthVisitsRes,
        invoicesRes,
        urgentRes,
        blockedRes,
        lateRes,
        visitsQueueRes,
        presencesRes,
        missionsRes,
        usersRes,
        recentPaymentsRes,
        trendVisitsRes,
      ] = await Promise.all([
        supabase.from('services').select('*').eq('is_active', true),
        supabase.from('visits').select('*', { count: 'exact', head: true }).gte('arrival_time', todayStart).lte('arrival_time', todayEnd),
        supabase.from('visits').select('*', { count: 'exact', head: true }).gte('arrival_time', weekStart).lte('arrival_time', weekEnd),
        supabase.from('visits').select('id, arrival_time, has_appointment, service_id').gte('arrival_time', monthStart).lte('arrival_time', monthEnd),
        supabase.from('invoices').select('amount, amount_paid, payment_status, updated_at').eq('is_billable', true),
        supabase.from('visit_followups').select('*', { count: 'exact', head: true }).eq('priority', 'urgent').neq('status', 'completed'),
        supabase.from('visit_followups').select('*', { count: 'exact', head: true }).eq('status', 'blocked'),
        supabase.from('visit_followups').select('*', { count: 'exact', head: true }).eq('status', 'late'),
        supabase.from('visits').select('*, visitor:visitors(*), service:services(*)').eq('status', 'in_progress').order('arrival_time', { ascending: true }),
        supabase.from('hr_presences').select('*, profile:profiles(*)').eq('date', todayStr),
        supabase.from('missions').select('*, profile:profiles(*)').eq('status', 'in_progress'),
        supabase.from('profiles').select('*').eq('is_active', true),
        supabase.from('invoices').select('*, visit:visits(*, visitor:visitors(*))').gt('amount_paid', 0).order('updated_at', { ascending: false }).limit(5),
        supabase.from('visits').select('id, arrival_time').gte('arrival_time', sevenDaysAgoStart).lte('arrival_time', todayEnd),
      ]);

      if (visitsQueueRes.data) setVisitsQueue(visitsQueueRes.data as any);
      if (presencesRes.data) setPresencesToday(presencesRes.data as any);
      if (missionsRes.data) setActiveMissions(missionsRes.data as any);
      if (usersRes.data) setAllUsers(usersRes.data);
      if (recentPaymentsRes.data) setRecentPayments(recentPaymentsRes.data as any);

      // Calculations
      const invoices = invoicesRes.data || [];
      const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
      const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
      const totalRemaining = totalInvoiced - totalPaid;
      const recoveryRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 100;
      const invoicedCount = invoices.filter(inv => inv.payment_status !== 'not_invoiced').length;
      const notInvoicedCount = invoices.filter(inv => inv.payment_status === 'not_invoiced').length;

      const totalActiveStaff = usersRes.data?.length || 0;
      const presentStaff = (presencesRes.data || []).filter(p => p.status === 'present').length;
      const missionStaff = missionsRes.data?.length || 0;
      const absentStaff = Math.max(0, totalActiveStaff - (presentStaff + missionStaff));

      const monthVisits = monthVisitsRes.data || [];
      const monthVisitsCount = monthVisits.length;
      const withApptCount = monthVisits.filter(v => v.has_appointment).length;
      const withoutApptCount = monthVisits.filter(v => !v.has_appointment).length;

      setStats({
        todayVisits: todayVisitsRes.count || 0,
        weekVisits: weekVisitsRes.count || 0,
        monthVisits: monthVisitsCount,
        withAppointment: withApptCount,
        withoutAppointment: withoutApptCount,
        totalInvoiced,
        totalPaid,
        totalRemaining,
        recoveryRate,
        invoicedCount,
        notInvoicedCount,
        urgentCases: urgentRes.count || 0,
        blockedCases: blockedRes.count || 0,
        lateCases: lateRes.count || 0,
        presentCount: presentStaff,
        absentCount: absentStaff,
        missionCount: missionStaff,
      });

      // Calculate daily caisse trend client-side from invoicesRes.data
      const financeTrendData = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(now, i);
        const dayStart = startOfDay(d);
        const dayEnd = endOfDay(d);
        
        const dayPaid = invoices
          .filter(inv => {
            if (!inv.updated_at) return false;
            const date = new Date(inv.updated_at);
            return date >= dayStart && date <= dayEnd;
          })
          .reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
          
        financeTrendData.push({
          date: format(d, 'dd/MM'),
          revenue: dayPaid,
        });
      }
      setFinanceTrend(financeTrendData);

      // Service chart mappings (Done entirely client-side, zero queries)
      if (servicesRes.data) {
        const counts = servicesRes.data.map((s) => {
          const count = monthVisits.filter(v => v.service_id === s.id).length;
          return { name: s.name, visits: count };
        });
        setVisitsByService(counts.filter(c => c.visits > 0));
      }

      // Visit trend (Done entirely client-side, zero queries)
      const trendVisits = trendVisitsRes.data || [];
      const trendData = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(now, i);
        const dayStart = startOfDay(d);
        const dayEnd = endOfDay(d);
        const count = trendVisits.filter(v => {
          if (!v.arrival_time) return false;
          const date = new Date(v.arrival_time);
          return date >= dayStart && date <= dayEnd;
        }).length;
        trendData.push({
          date: format(d, 'dd/MM'),
          visits: count,
        });
      }
      setVisitTrend(trendData);

    } catch (error) {
      console.error("Error loading dashboard statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  const subDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  };

  // Wait time calculation helper
  const getWaitTime = (arrivalTimeStr: string) => {
    const diff = differenceInMinutes(new Date(), new Date(arrivalTimeStr));
    if (diff < 0) return '0 min';
    return `${diff} min`;
  };

  const getQueueBadge = (visit: Visit) => {
    if (visit.has_appointment) {
      return { label: 'Rendez-vous', class: 'badge-primary' };
    }
    // simple heuristic for urgency
    if (visit.purpose.toLowerCase().includes('urgent') || visit.purpose.toLowerCase().includes('acd')) {
      return { label: 'Urgent', class: 'badge-danger' };
    }
    return { label: 'En attente', class: 'badge-success' };
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, string> = {
      admin: 'badge-danger',
      director: 'badge-primary',
      reception: 'badge-success',
      collaborator: 'badge-info',
    };
    return config[role] || 'badge-gray';
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Role Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Pilotage opérationnel GICO
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Bonjour, {profile?.full_name || 'Collaborateur'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Voici un aperçu de l'activité de l'entreprise aujourd'hui
          </p>
        </div>
        <span className={`badge ${getRoleBadge(profile?.role || '')} self-start sm:self-auto uppercase tracking-wider text-[10px] py-1.5 px-3`}>
          Espace {profile?.role === 'reception' ? 'Assistante' : profile?.role || 'Collaborateur'}
        </span>
      </div>

      {/* Tabs Selector for Financial & Cashier roles */}
      {profile && ['admin', 'director', 'accounting', 'cashier'].includes(profile.role) && (
        <div className="flex border-b border-slate-100 dark:border-slate-800/80 gap-6">
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-3 font-bold text-sm transition-all relative ${
              activeTab === 'activity'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Activité & Présences
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`pb-3 font-bold text-sm transition-all relative ${
              activeTab === 'finance'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Suivi Financier & Caisse
          </button>
        </div>
      )}

      {/* Dashboard Content */}
      {loading ? (
        <div className="space-y-6">
          {/* KPIs Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-6 border border-slate-100 dark:border-slate-800/80 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 w-full">
                    <div className="h-3 w-2/3 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg"></div>
                    <div className="h-8 w-1/2 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg"></div>
                  </div>
                  <div className="h-10 w-10 bg-slate-200/60 dark:bg-slate-800/40 rounded-2xl flex-shrink-0"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="lg:col-span-2 card p-6 space-y-4">
              <div className="h-5 w-48 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg"></div>
              <div className="space-y-4 pt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 last:border-b-0">
                    <div className="space-y-2 w-full">
                      <div className="h-4 w-1/3 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg"></div>
                      <div className="h-3 w-1/4 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg"></div>
                    </div>
                    <div className="h-4 w-12 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg flex-shrink-0"></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6 space-y-4">
              <div className="h-5 w-48 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg"></div>
              <div className="space-y-3 pt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3 last:border-b-0">
                    <div className="space-y-2 w-full">
                      <div className="h-4 w-1/2 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg"></div>
                      <div className="h-3 w-1/3 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg"></div>
                    </div>
                    <div className="h-4 w-12 bg-slate-200/60 dark:bg-slate-800/40 rounded-lg flex-shrink-0"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'activity' ? (
            <>
              {/* Dashboard KPIs row (Activity) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1: Today Visits */}
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Visites du jour</span>
                      <span className="text-3xl font-black text-slate-800 dark:text-white block mt-1">{stats.todayVisits}</span>
                    </div>
                    <div className="p-3 bg-primary-50 dark:bg-primary-950/40 rounded-2xl">
                      <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                  </div>
                </div>

                {/* KPI 2: Staff Presence */}
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Présents au bureau</span>
                      <span className="text-3xl font-black text-slate-800 dark:text-white block mt-1">{stats.presentCount} / {allUsers.length}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* KPI 3: Missions Tracker */}
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Agents en Mission</span>
                      <span className="text-3xl font-black text-slate-800 dark:text-white block mt-1">{stats.missionCount}</span>
                    </div>
                    <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-2xl">
                      <MapPin className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                  </div>
                </div>

                {/* KPI 4: Financial or Urgencies */}
                {profile && ['admin', 'director', 'accounting', 'cashier'].includes(profile.role) ? (
                  <div className="stat-card">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Encaissements réels</span>
                        <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-1.5">{stats.totalPaid.toLocaleString()} XOF</span>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl">
                        <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="stat-card">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Cas urgents actifs</span>
                        <span className="text-3xl font-black text-rose-600 block mt-1">{stats.urgentCases}</span>
                      </div>
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl">
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Activity Section Table & Presence */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="card">
                    <div className="card-header bg-slate-50/20">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary-600 animate-pulse" />
                        File d'Attente Intelligente ({visitsQueue.length} actifs)
                      </h3>
                    </div>
                    <div className="card-body p-0">
                      {visitsQueue.length === 0 ? (
                        <div className="text-center py-16">
                          <Users className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                          <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">Aucun visiteur en attente</h4>
                          <p className="text-xs text-slate-500">Tous les visiteurs ont été reçus par les collaborateurs.</p>
                        </div>
                      ) : (
                        <div className="table-container border-0 rounded-none shadow-none">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Visiteur</th>
                                <th>Motif</th>
                                <th>Service concerné</th>
                                <th>Arrivée</th>
                                <th>Attente</th>
                                <th>Statut</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visitsQueue.map((v) => {
                                const badge = getQueueBadge(v);
                                return (
                                  <tr key={v.id}>
                                    <td>
                                      <div className="font-bold text-slate-800 dark:text-white">
                                        {v.visitor?.first_name} {v.visitor?.last_name}
                                      </div>
                                      {v.visitor?.company && (
                                        <span className="text-[9px] text-slate-400 font-bold block">{v.visitor.company}</span>
                                      )}
                                    </td>
                                    <td className="max-w-[150px] truncate text-xs">{v.purpose}</td>
                                    <td className="text-xs font-semibold">{v.service?.name || '-'}</td>
                                    <td className="font-mono text-xs">{format(new Date(v.arrival_time), 'HH:mm')}</td>
                                    <td className="font-mono text-xs text-amber-600 dark:text-amber-500 font-bold">
                                      {getWaitTime(v.arrival_time)}
                                    </td>
                                    <td>
                                      <span className={`badge ${badge.class}`}>{badge.label}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side panel: Collaborators presence log */}
                <div className="space-y-6">
                  <div className="card">
                    <div className="card-header bg-slate-50/20">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        Présence Collaborateurs ({presencesToday.length} pointés)
                      </h3>
                    </div>
                    <div className="card-body p-4 space-y-3.5 max-h-[350px] overflow-y-auto scrollbar-thin">
                      {allUsers.map((u) => {
                        const presence = presencesToday.find(p => p.user_id === u.id);
                        const mission = activeMissions.find(m => m.user_id === u.id);
                        let statusLabel = 'Absent';
                        let statusClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400';

                        if (presence) {
                          if (presence.status === 'present') {
                            statusLabel = 'Présent';
                            statusClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400';
                          } else if (presence.status === 'pause') {
                            statusLabel = 'En Pause';
                            statusClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400';
                          }
                        } else if (mission) {
                          statusLabel = 'En Mission';
                          statusClass = 'bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-400';
                        }

                        return (
                          <div key={u.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2.5 last:border-b-0 last:pb-0">
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-white">{u.full_name}</p>
                              <p className="text-[10px] text-slate-400">{u.role}</p>
                            </div>
                            <span className={`badge ${statusClass} text-[9px]`}>{statusLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Global Analytics and charts for managers */}
              {profile && ['admin', 'director', 'service_manager', 'accounting'].includes(profile.role) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Visit trends Area chart */}
                  <div className="lg:col-span-2 card">
                    <div className="card-header">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Évolution des visites (7 jours)</h3>
                    </div>
                    <div className="card-body">
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={visitTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800/40" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              border: 'none',
                              borderRadius: '16px',
                              color: '#fff',
                              fontSize: '11px',
                            }}
                          />
                          <Area type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVisits)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Service distribution pie chart */}
                  <div className="card">
                    <div className="card-header">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Répartition par service</h3>
                    </div>
                    <div className="card-body flex items-center justify-center">
                      {visitsByService.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-16">Pas de données ce mois-ci</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={visitsByService}
                              dataKey="visits"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={70}
                              innerRadius={45}
                              paddingAngle={3}
                              label={({ name }) => (name ? name.substring(0, 10) : '')}
                            >
                              {visitsByService.map((_, idx) => (
                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Financial View Tab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1: CA Global */}
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Chiffre d'Affaires (Facturé)</span>
                      <span className="text-2xl font-black text-slate-800 dark:text-white block mt-1">{stats.totalInvoiced.toLocaleString('fr-FR')} XOF</span>
                    </div>
                    <div className="p-3 bg-primary-50 dark:bg-primary-950/40 rounded-2xl">
                      <Activity className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                  </div>
                </div>

                {/* KPI 2: Recettes Encaissées */}
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Recettes (Encaissées)</span>
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block mt-1">{stats.totalPaid.toLocaleString('fr-FR')} XOF</span>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl">
                      <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* KPI 3: Créances à Recouvrer */}
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Reste à Recouvrer (Créances)</span>
                      <span className="text-2xl font-black text-rose-600 block mt-1">{stats.totalRemaining.toLocaleString('fr-FR')} XOF</span>
                    </div>
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    </div>
                  </div>
                </div>

                {/* KPI 4: Taux de Recouvrement */}
                <div className="stat-card">
                  <div className="flex justify-between items-start">
                    <div className="w-full space-y-2">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Taux de Recouvrement</span>
                      <span className="text-2xl font-black text-slate-800 dark:text-white block mt-1">{stats.recoveryRate}%</span>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full" style={{ width: `${stats.recoveryRate}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Charts & Caisse Journal */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily receipts chart */}
                <div className="lg:col-span-2 card">
                  <div className="card-header">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Évolution journalière des encaissements (7 jours)</h3>
                  </div>
                  <div className="card-body">
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={financeTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800/40" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            border: 'none',
                            borderRadius: '16px',
                            color: '#fff',
                            fontSize: '11px',
                          }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Journal de Caisse (Recent payments) */}
                <div className="card">
                  <div className="card-header bg-slate-50/20">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      Journal de Caisse Récent
                    </h3>
                  </div>
                  <div className="card-body p-4 space-y-4 max-h-[300px] overflow-y-auto scrollbar-thin">
                    {recentPayments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-8">Aucun encaissement récent enregistré</p>
                    ) : (
                      recentPayments.map((p) => {
                        const statusConfig = {
                          not_invoiced: { label: 'Non facturé', class: 'bg-slate-100 text-slate-700' },
                          invoiced: { label: 'Facturé', class: 'bg-blue-100 text-blue-700' },
                          paid: { label: 'Payé', class: 'bg-emerald-100 text-emerald-700' },
                          partially_paid: { label: 'Part. payé', class: 'bg-amber-100 text-amber-700' },
                          cancelled: { label: 'Annulé', class: 'bg-red-100 text-red-700' },
                        };
                        const badge = statusConfig[p.payment_status as keyof typeof statusConfig] || { label: p.payment_status, class: 'bg-slate-100 text-slate-700' };

                        return (
                          <div key={p.id} className="p-3 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800 dark:text-white">
                                  {p.visit?.visitor?.first_name} {p.visit?.visitor?.last_name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">{p.visit?.visit_code || 'N/A'}</p>
                              </div>
                              <span className={`badge ${badge.class} text-[9px]`}>{badge.label}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-semibold border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5">
                              <span className="text-slate-400">Montant payé:</span>
                              <span className="text-emerald-600">{(p.amount_paid || 0).toLocaleString('fr-FR')} XOF</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
