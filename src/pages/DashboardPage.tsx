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
  ArrowUp,
  ArrowDown,
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
      client: '#1e40af',
      prospect: '#059669',
      supplier: '#d97706',
      partner: '#7c3aed',
      other: '#6b7280',
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
      const name = v.services?.name || 'Non assigne';
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
    const styles: Record<string, string> = {
      in_progress: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-danger',
    };
    const labels: Record<string, string> = {
      in_progress: 'En cours',
      completed: 'Termine',
      cancelled: 'Annule',
    };
    return <span className={styles[status] || 'badge-gray'}>{labels[status] || status}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord</h1>
          <p className="text-gray-500">Vue d'ensemble de l'activite - {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Visites du jour</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayVisits}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Calendar className="w-6 h-6 text-primary-700" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Cette semaine:</span>
            <span className="font-semibold text-gray-900">{stats.weekVisits}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Visites du mois</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.monthVisits}</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Avec RDV:</span>
            <span className="font-semibold text-emerald-600">{stats.withAppointment}</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">Sans RDV:</span>
            <span className="font-semibold text-amber-600">{stats.withoutAppointment}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Facture</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(stats.totalInvoiced)}
              </p>
            </div>
            <div className="p-3 bg-gold-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-gold-700" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Encaisse:</span>
            <span className="font-semibold text-emerald-600">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(stats.totalPaid)}
            </span>
          </div>
        </div>

        <div className="stat-card bg-red-50 border-red-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-red-600">Cas Urgents</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{stats.urgentCases + stats.blockedCases + stats.lateCases}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
            <span>Bloques: {stats.blockedCases}</span>
            <span className="text-red-400">|</span>
            <span>En retard: {stats.lateCases}</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visit Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Evolution des visites (7 jours)</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={visitTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke="#1e40af"
                  strokeWidth={2}
                  dot={{ fill: '#1e40af', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visits by Type */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Repartition par type de visiteur</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={visitsByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {visitsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Visits by Service */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Visites par service (ce mois)</h3>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={visitsByService} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#6b7280" width={150} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="visits" fill="#1e40af" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Visits */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Visites recentes</h3>
          <a href="/visits" className="text-sm text-primary-700 hover:text-primary-800 font-medium">
            Voir tout
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
                <th>Arrivee</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentVisits.map((visit) => (
                <tr key={visit.id}>
                  <td className="font-mono text-sm">{visit.visit_code}</td>
                  <td>
                    <div>
                      <p className="font-medium">
                        {visit.visitor?.first_name} {visit.visitor?.last_name}
                      </p>
                      {visit.visitor?.company && (
                        <p className="text-xs text-gray-500">{visit.visitor.company}</p>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="badge-gray">{getVisitorTypeLabel(visit.visitor?.visitor_type || 'other')}</span>
                  </td>
                  <td>{visit.service?.name || '-'}</td>
                  <td className="text-sm">
                    <div>
                      <p>{format(new Date(visit.arrival_time), 'dd/MM/yyyy')}</p>
                      <p className="text-gray-500">{format(new Date(visit.arrival_time), 'HH:mm')}</p>
                    </div>
                  </td>
                  <td>{getStatusBadge(visit.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Services Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.slice(0, 4).map((service) => (
          <div key={service.id} className="card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Building2 className="w-5 h-5 text-primary-700" />
              </div>
              <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">{service.name}</h4>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{service.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
