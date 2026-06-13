import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import {
  Users,
  Calendar,
  TrendingUp,
  Clock,
  CreditCard,
  AlertTriangle,
  Building2,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { supabase, Visit, Service } from '../lib/supabase';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

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
}

interface VisitByType {
  name: string;
  value: number;
  color: string;
}

interface VisitByService {
  name: string;
  visits: number;
}

interface VisitTrend {
  date: string;
  visits: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todayVisits: 0,
    weekVisits: 0,
    monthVisits: 0,
    withAppointment: 0,
    withoutAppointment: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    invoicedCount: 0,
    notInvoicedCount: 0,
    urgentCases: 0,
    blockedCases: 0,
    lateCases: 0,
  });
  const [visitsByType, setVisitsByType] = useState<VisitByType[]>([]);
  const [visitsByService, setVisitsByService] = useState<VisitByService[]>([]);
  const [visitTrend, setVisitTrend] = useState<VisitTrend[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    // Fetch services
    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true);
    if (servicesData) setServices(servicesData);

    // Today's visits
    const { count: todayVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('arrival_time', todayStart)
      .lte('arrival_time', todayEnd);

    // Week visits
    const { count: weekVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('arrival_time', weekStart)
      .lte('arrival_time', weekEnd);

    // Month visits
    const { count: monthVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('arrival_time', monthStart)
      .lte('arrival_time', monthEnd);

    // Appointments stats
    const { count: withAppointment } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('arrival_time', monthStart)
      .lte('arrival_time', monthEnd)
      .eq('has_appointment', true);

    const { count: withoutAppointment } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .gte('arrival_time', monthStart)
      .lte('arrival_time', monthEnd)
      .eq('has_appointment', false);

    // Invoice stats
    const { data: invoices } = await supabase
      .from('invoices')
      .select('amount, payment_status')
      .eq('is_billable', true);

    const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const totalPaid = invoices?.filter(inv => inv.payment_status === 'paid').reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
    const invoicedCount = invoices?.filter(inv => inv.payment_status !== 'not_invoiced').length || 0;
    const notInvoicedCount = invoices?.filter(inv => inv.payment_status === 'not_invoiced').length || 0;

    // Urgent and blocked cases
    const { count: urgentCases } = await supabase
      .from('visit_followups')
      .select('*', { count: 'exact', head: true })
      .eq('priority', 'urgent')
      .neq('status', 'completed');

    const { count: blockedCases } = await supabase
      .from('visit_followups')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'blocked');

    const { count: lateCases } = await supabase
      .from('visit_followups')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'late');

    setStats({
      todayVisits: todayVisits || 0,
      weekVisits: weekVisits || 0,
      monthVisits: monthVisits || 0,
      withAppointment: withAppointment || 0,
      withoutAppointment: withoutAppointment || 0,
      totalInvoiced,
      totalPaid,
      invoicedCount,
      notInvoicedCount,
      urgentCases: urgentCases || 0,
      blockedCases: blockedCases || 0,
      lateCases: lateCases || 0,
    });

    // Visits by visitor type
    const { data: visitors } = await supabase
      .from('visits')
      .select(`
        arrival_time,
        visitor:visitors(visitor_type)
      `)
      .gte('arrival_time', monthStart)
      .lte('arrival_time', monthEnd);

    const typeCounts: Record<string, number> = {
      client: 0,
      prospect: 0,
      supplier: 0,
      partner: 0,
      other: 0,
    };

    visitors?.forEach((v: any) => {
      const type = v.visitor?.visitor_type || 'other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const typeLabels: Record<string, string> = {
      client: 'Clients',
      prospect: 'Prospects',
      supplier: 'Fournisseurs',
      partner: 'Partenaires',
      other: 'Autres',
    };

    const typeColors: Record<string, string> = {
      client: '#3b82f6',     // Modern primary blue
      prospect: '#10b981',   // Emerald
      supplier: '#f59e0b',   // Amber
      partner: '#8b5cf6',    // Violet
      other: '#64748b',      // Slate
    };

    setVisitsByType(
      Object.entries(typeCounts).map(([key, value]) => ({
        name: typeLabels[key],
        value,
        color: typeColors[key],
      }))
    );

    // Visits by service
    const { data: serviceVisits } = await supabase
      .from('visits')
      .select('service_id, services(name)')
      .gte('arrival_time', monthStart)
      .lte('arrival_time', monthEnd)
      .not('service_id', 'is', null);

    const serviceCounts: Record<string, number> = {};
    serviceVisits?.forEach((v: any) => {
      const name = v.services?.name || 'Non assigné';
      serviceCounts[name] = (serviceCounts[name] || 0) + 1;
    });

    setVisitsByService(
      Object.entries(serviceCounts)
        .map(([name, visits]) => ({ name, visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 8)
    );

    // Visit trend (last 7 days)
    const trendData: VisitTrend[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const dayStart = startOfDay(date).toISOString();
      const dayEnd = endOfDay(date).toISOString();

      const { count } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .gte('arrival_time', dayStart)
        .lte('arrival_time', dayEnd);

      trendData.push({
        date: format(date, 'EEE dd', { locale: fr }),
        visits: count || 0,
      });
    }
    setVisitTrend(trendData);

    // Recent visits
    const { data: recent } = await supabase
      .from('visits')
      .select(`
        *,
        visitor:visitors(*),
        service:services(*)
      `)
      .order('arrival_time', { ascending: false })
      .limit(10);
    if (recent) setRecentVisits(recent);

    setLoading(false);
  };

  const getVisitorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      client: 'Client',
      prospect: 'Prospect',
      supplier: 'Fournisseur',
      partner: 'Partenaire',
      other: 'Autre',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const config = {
      in_progress: { label: 'En cours', class: 'badge-info', dot: 'dot-pulse-primary' },
      completed: { label: 'Terminé', class: 'badge-success', dot: 'dot-pulse-success' },
      cancelled: { label: 'Annulé', class: 'badge-danger', dot: 'dot-pulse-danger' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray', dot: 'bg-slate-400' };
    
    return (
      <span className={`${current.class} flex items-center gap-1.5`}>
        <span className={current.dot} />
        {current.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner h-10 w-10"></div>
      </div>
    );
  }

  // Custom tooltips for graphs
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-1">
            {payload[0].value} {payload[0].value > 1 ? 'visites' : 'visite'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-gradient-to-br from-primary-900/10 via-indigo-900/5 to-transparent dark:from-primary-950/20 dark:via-[#0F1422] rounded-3xl border border-primary-500/10 dark:border-primary-500/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Vue d'ensemble de l'activité
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Tableau de Bord</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Statistiques globales compilées le {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Today Visits */}
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Visites du jour</p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.todayVisits}</p>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-2xl shadow-inner border border-primary-100/10">
              <Calendar className="w-5 h-5 animate-pulse-slow" />
            </div>
          </div>
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>Cette semaine</span>
            <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{stats.weekVisits}</span>
          </div>
        </div>

        {/* KPI 2: Month Visits */}
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Visites du mois</p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.monthVisits}</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-inner border border-emerald-100/10">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-md">RDV: {stats.withAppointment}</span>
            <span>/</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-md">Sans RDV: {stats.withoutAppointment}</span>
          </div>
        </div>

        {/* KPI 3: Invoiced amount */}
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Facturation</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white truncate max-w-[180px]">
                {formatCurrency(stats.totalInvoiced)}
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl shadow-inner border border-amber-100/10">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>Encaissé</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.totalPaid)}</span>
          </div>
        </div>

        {/* KPI 4: Urgent dossiers */}
        <div className={`stat-card border-rose-500/20 dark:border-rose-500/10 ${stats.urgentCases + stats.blockedCases + stats.lateCases > 0 ? 'bg-rose-50/10 dark:bg-rose-950/5' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Cas Urgents</p>
              <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                {stats.urgentCases + stats.blockedCases + stats.lateCases}
              </p>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl shadow-inner border border-rose-100/10">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
            <span className="bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-md">Bloqués: {stats.blockedCases}</span>
            <span>/</span>
            <span className="bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded-md">En retard: {stats.lateCases}</span>
          </div>
        </div>
      </div>

      {/* Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Visit Evolution Trend Area Graph */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Évolution des visites (7 jours)</h3>
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
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorVisits)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visitor Type Pie Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Répartition des Visiteurs</h3>
          </div>
          <div className="card-body flex flex-col sm:flex-row items-center justify-around gap-6">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visitsByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {visitsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} className="outline-none focus:outline-none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: 'none',
                      borderRadius: '16px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.monthVisits}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Ce mois</span>
              </div>
            </div>
            
            {/* Legend list */}
            <div className="space-y-2.5 max-w-[200px] w-full">
              {visitsByType.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-md" style={{ backgroundColor: item.color }} />
                    <span className="font-medium truncate">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Visits by Service rounded bar charts */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Visites par Service (Ce mois)</h3>
        </div>
        <div className="card-body">
          {visitsByService.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={visitsByService} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800/40" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={130} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: 'none',
                    borderRadius: '16px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="visits" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={16}>
                  {visitsByService.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={`url(#barGradient-${index % 2})`} />
                  ))}
                </Bar>
                <defs>
                  <linearGradient id="barGradient-0" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                  <linearGradient id="barGradient-1" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-slate-400">Aucune visite enregistrée ce mois-ci.</div>
          )}
        </div>
      </div>

      {/* Recent Visits Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Visites Récentes</h3>
          <a href="/visits" className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1 hover:underline">
            Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
        <div className="table-container border-0 rounded-t-none">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Visiteur</th>
                <th>Type</th>
                <th>Service</th>
                <th>Arrivée</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentVisits.map((visit) => (
                <tr key={visit.id}>
                  <td className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">{visit.visit_code}</td>
                  <td>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-white">
                        {visit.visitor?.first_name} {visit.visitor?.last_name}
                      </p>
                      {visit.visitor?.company && (
                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">{visit.visitor.company}</p>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="badge-gray">{getVisitorTypeLabel(visit.visitor?.visitor_type || 'other')}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{visit.service?.name || '-'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 dark:text-white">
                        {format(new Date(visit.arrival_time), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-slate-400 dark:text-slate-500 font-medium mt-0.5">{format(new Date(visit.arrival_time), 'HH:mm')}</p>
                    </div>
                  </td>
                  <td>{getStatusBadge(visit.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Services Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.slice(0, 4).map((service) => (
          <div key={service.id} className="card p-5 hover:border-primary-500/20 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-3.5 mb-3.5">
              <div className="p-2.5 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{service.name}</h4>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2">{service.description || 'Aucune description fournie.'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
