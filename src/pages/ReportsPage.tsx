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
import { supabase, Service, Visit } from '../lib/supabase';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  Download,
  FileText,
  TrendingUp,
  Users,
  Building2,
  CreditCard,
  Clock,
  Filter,
  RefreshCw,
} from 'lucide-react';

const COLORS = ['#1e40af', '#059669', '#d97706', '#7c3aed', '#6b7280', '#dc2626', '#0891b2', '#db2777'];

export default function ReportsPage() {
  const [periodType, setPeriodType] = useState<'day' | 'week' | 'month' | 'custom'>('month');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    visitsByDay: [] as { date: string; visits: number }[],
    visitsByType: [] as { name: string; value: number; color: string }[],
    visitsByService: [] as { name: string; visits: number }[],
    invoiceStatus: [] as { name: string; value: number }[],
    serviceStatus: [] as { name: string; value: number }[],
    topVisitors: [] as { name: string; visits: number }[],
    totalVisits: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    avgVisitDuration: 0,
  });

  useEffect(() => {
    fetchServices();
    fetchReportData();
  }, [periodType, dateFrom, dateTo]);

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    if (data) setServices(data);
  };

  const fetchReportData = async () => {
    setLoading(true);
    const fromDate = periodType === 'day'
      ? startOfDay(new Date())
      : periodType === 'week'
        ? startOfWeek(new Date(), { weekStartsOn: 1 })
        : periodType === 'month'
          ? startOfMonth(new Date())
          : new Date(dateFrom);

    const toDate = periodType === 'day'
      ? endOfDay(new Date())
      : periodType === 'week'
        ? endOfWeek(new Date(), { weekStartsOn: 1 })
        : periodType === 'month'
          ? endOfMonth(new Date())
          : endOfDay(new Date(dateTo));

    // Fetch visits with related data
    const { data: visits } = await supabase
      .from('visits')
      .select(
        `
        *,
        visitor:visitors(*),
        service:services(*)
      `
      )
      .gte('arrival_time', fromDate.toISOString())
      .lte('arrival_time', toDate.toISOString())
      .order('arrival_time', { ascending: true });

    // Fetch invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString());

    if (visits) {
      // Visits by day
      const dayCounts: Record<string, number> = {};
      visits.forEach((v) => {
        const day = format(new Date(v.arrival_time), 'dd/MM');
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      const visitsByDay = Object.entries(dayCounts).map(([date, visits]) => ({ date, visits }));

      // Visits by type
      const typeCounts: Record<string, number> = {
        client: 0,
        prospect: 0,
        supplier: 0,
        partner: 0,
        other: 0,
      };
      visits.forEach((v: any) => {
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
      const visitsByType = Object.entries(typeCounts)
        .filter(([, v]) => v > 0)
        .map(([key, value], idx) => ({
          name: typeLabels[key],
          value,
          color: COLORS[idx],
        }));

      // Visits by service
      const serviceCounts: Record<string, number> = {};
      visits.forEach((v: any) => {
        const name = v.service?.name || 'Non assigne';
        serviceCounts[name] = (serviceCounts[name] || 0) + 1;
      });
      const visitsByService = Object.entries(serviceCounts)
        .map(([name, visits]) => ({ name, visits: visits || 0 }))
        .sort((a, b) => b.visits - a.visits);

      // Top visitors
      const visitorCounts: Record<string, number> = {};
      visits.forEach((v: any) => {
        const name = v.visitor ? `${v.visitor.first_name} ${v.visitor.last_name}` : 'Inconnu';
        visitorCounts[name] = (visitorCounts[name] || 0) + 1;
      });
      const topVisitors = Object.entries(visitorCounts)
        .map(([name, visits]) => ({ name, visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 5);

      // Average visit duration
      const completedVisits = visits.filter((v) => v.departure_time);
      const totalDuration = completedVisits.reduce((sum, v) => {
        const duration = new Date(v.departure_time!).getTime() - new Date(v.arrival_time).getTime();
        return sum + duration;
      }, 0);
      const avgDuration = completedVisits.length > 0 ? totalDuration / completedVisits.length / 1000 / 60 : 0;

      setReportData((prev) => ({
        ...prev,
        visitsByDay,
        visitsByType,
        visitsByService,
        topVisitors,
        totalVisits: visits.length,
        avgVisitDuration: Math.round(avgDuration),
      }));
    }

    if (invoices) {
      // Invoice status distribution
      const invStatus: Record<string, number> = {
        not_invoiced: 0,
        invoiced: 0,
        paid: 0,
        partially_paid: 0,
        cancelled: 0,
      };
      invoices.forEach((inv) => {
        invStatus[inv.payment_status] = (invStatus[inv.payment_status] || 0) + 1;
      });
      const statusLabels: Record<string, string> = {
        not_invoiced: 'Non facture',
        invoiced: 'Facture',
        paid: 'Paye',
        partially_paid: 'Part. paye',
        cancelled: 'Annule',
      };
      const invoiceStatus = Object.entries(invStatus)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: statusLabels[key] || key,
          value,
        }));

      // Service status distribution
      const srvStatus: Record<string, number> = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        blocked: 0,
        late: 0,
      };
      invoices.forEach((inv) => {
        srvStatus[inv.service_status] = (srvStatus[inv.service_status] || 0) + 1;
      });
      const serviceStatusLabels: Record<string, string> = {
        pending: 'En attente',
        in_progress: 'En cours',
        completed: 'Termine',
        blocked: 'Bloque',
        late: 'En retard',
      };
      const serviceStatus = Object.entries(srvStatus)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: serviceStatusLabels[key] || key,
          value,
        }));

      const totalInvoiced = invoices
        .filter((inv) => inv.is_billable)
        .reduce((sum, inv) => sum + Number(inv.amount), 0);
      const totalPaid = invoices
        .filter((inv) => inv.payment_status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      setReportData((prev) => ({
        ...prev,
        invoiceStatus,
        serviceStatus,
        totalInvoiced,
        totalPaid,
      }));
    }

    setLoading(false);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports et Statistiques</h1>
          <p className="text-gray-500">Analyse de l'activite et performances</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReportData} className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </button>
          <button onClick={handleExportPDF} className="btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Periode:</span>
          <div className="flex gap-2">
            {[
              { key: 'day', label: 'Jour' },
              { key: 'week', label: 'Semaine' },
              { key: 'month', label: 'Mois' },
              { key: 'custom', label: 'Personnalise' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodType(p.key as any)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  periodType === p.key
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodType === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input w-auto"
              />
              <span className="text-gray-400">au</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input w-auto"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="stat-card text-center">
          <p className="text-sm text-gray-500 print:text-xs">Total visites</p>
          <p className="text-3xl font-bold text-primary-700 print:text-xl">{reportData.totalVisits}</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-sm text-gray-500 print:text-xs">Total facture</p>
          <p className="text-2xl font-bold text-gold-600 print:text-lg">
            {reportData.totalInvoiced.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' })}
          </p>
        </div>
        <div className="stat-card text-center">
          <p className="text-sm text-gray-500 print:text-xs">Total encaisse</p>
          <p className="text-2xl font-bold text-emerald-600 print:text-lg">
            {reportData.totalPaid.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' })}
          </p>
        </div>
        <div className="stat-card text-center">
          <p className="text-sm text-gray-500 print:text-xs">Duree moyenne</p>
          <p className="text-3xl font-bold text-gray-900 print:text-xl">
            {reportData.avgVisitDuration}
            <span className="text-lg font-normal text-gray-500"> min</span>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visits Trend */}
            <div className="card print:break-inside-avoid">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900">Evolution des visites</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={reportData.visitsByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Area type="monotone" dataKey="visits" stroke="#1e40af" fill="#bfdbfe" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visits by Type */}
            <div className="card print:break-inside-avoid">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900">Repartition par type</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={reportData.visitsByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    >
                      {reportData.visitsByType.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Visits by Service */}
          <div className="card print:break-inside-avoid">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900">Visites par service</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.visitsByService} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6b7280" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#6b7280" width={150} />
                  <Tooltip contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="visits" fill="#1e40af" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoice Status */}
            <div className="card print:break-inside-avoid">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900">Statut des paiements</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={reportData.invoiceStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    >
                      {reportData.invoiceStatus.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Service Status */}
            <div className="card print:break-inside-avoid">
              <div className="card-header">
                <h3 className="font-semibold text-gray-900">Statut des services</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={reportData.serviceStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    >
                      {reportData.serviceStatus.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Visitors */}
          <div className="card print:break-inside-avoid">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900">Visiteurs les plus frequents</h3>
            </div>
            <div className="card-body">
              {reportData.topVisitors.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={reportData.topVisitors}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Bar dataKey="visits" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">Aucune donnee disponible</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
