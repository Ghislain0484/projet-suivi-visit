import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
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
import { supabase } from '../lib/supabase';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subWeeks, 
  differenceInMinutes 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Download,
  RefreshCw,
  Clock,
  CreditCard,
  Briefcase,
  UserCheck,
  UserX,
  Layers,
  AlertTriangle,
  Printer,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { useCompanySettings } from '../contexts/CompanySettingsContext';

const COLORS = ['#1e40af', '#059669', '#d97706', '#7c3aed', '#6b7280', '#dc2626', '#0891b2', '#db2777'];

export default function ReportsPage() {
  const { settings } = useCompanySettings();
  const [reportTab, setReportTab] = useState<'visual' | 'executive'>('visual');
  const [periodType, setPeriodType] = useState<'day' | 'week' | 'week-last' | 'month' | 'custom'>('week-last');
  const [dateFrom, setDateFrom] = useState(format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [latenessThreshold, setLatenessThreshold] = useState('08:00');
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

  const [executiveData, setExecutiveData] = useState({
    totalActions: 0,
    actionsWithGains: 0,
    actionsWithoutGains: 0,
    actionsCompletedOnTime: 0,
    actionsCompletedLate: 0,
    onTimePresences: 0,
    latePresences: 0,
    lateList: [] as { date: string; employee_name: string; service: string; arrival: string; delay: number }[],
    actionsByService: [] as { serviceName: string; total: number; completed: number; uncompleted: number; inProgress: number }[],
  });

  useEffect(() => {
    // Sync dates when period shortcuts are clicked
    const getDates = () => {
      const now = new Date();
      switch (periodType) {
        case 'day':
          return {
            from: format(startOfDay(now), 'yyyy-MM-dd'),
            to: format(endOfDay(now), 'yyyy-MM-dd'),
          };
        case 'week':
          return {
            from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          };
        case 'week-last':
          return {
            from: format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            to: format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          };
        case 'month':
          return {
            from: format(startOfMonth(now), 'yyyy-MM-dd'),
            to: format(endOfMonth(now), 'yyyy-MM-dd'),
          };
        default:
          return { from: dateFrom, to: dateTo };
      }
    };

    const dates = getDates();
    if (periodType !== 'custom') {
      setDateFrom(dates.from);
      setDateTo(dates.to);
    }
  }, [periodType]);

  useEffect(() => {
    fetchReportData();
  }, [dateFrom, dateTo, latenessThreshold]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const fromDate = startOfDay(new Date(dateFrom));
      const toDate = endOfDay(new Date(dateTo));

      // Fetch visits, invoices, follow-ups, presences, and services in parallel
      const [visitsRes, invoicesRes, followUpsRes, presencesRes, servicesRes] = await Promise.all([
        supabase
          .from('visits')
          .select('*, visitor:visitors(*), service:services(*), invoices(*)')
          .gte('arrival_time', fromDate.toISOString())
          .lte('arrival_time', toDate.toISOString())
          .order('arrival_time', { ascending: true }),
        supabase
          .from('invoices')
          .select('*, visit:visits(*, service:services(*))')
          .gte('created_at', fromDate.toISOString())
          .lte('created_at', toDate.toISOString()),
        supabase
          .from('visit_followups')
          .select('*, visit:visits(*, service:services(*), invoices(*))')
          .or(`created_at.gte.${fromDate.toISOString()},completed_at.gte.${fromDate.toISOString()}`),
        supabase
          .from('hr_presences')
          .select('*, profile:profiles(*, service:services(*))')
          .gte('date', format(fromDate, 'yyyy-MM-dd'))
          .lte('date', format(toDate, 'yyyy-MM-dd')),
        supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
      ]);

      const visits = visitsRes.data || [];
      const invoices = invoicesRes.data || [];
      const followUps = followUpsRes.data || [];
      const presences = presencesRes.data || [];
      const services = servicesRes.data || [];

      // ==========================================
      // 1. GRAPHICAL VIEW CALCULATIONS
      // ==========================================

      // Visits by day
      const dayCounts: Record<string, number> = {};
      visits.forEach((v) => {
        const day = format(new Date(v.arrival_time), 'dd/MM');
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      });
      const visitsByDay = Object.entries(dayCounts).map(([date, visits]) => ({ date, visits }));

      // Visits by type
      const typeCounts: Record<string, number> = { client: 0, prospect: 0, supplier: 0, partner: 0, other: 0 };
      visits.forEach((v: any) => {
        const type = v.visitor?.visitor_type || 'other';
        if (type in typeCounts) typeCounts[type]++;
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
          color: COLORS[idx % COLORS.length],
        }));

      // Visits by service
      const serviceCounts: Record<string, number> = {};
      visits.forEach((v: any) => {
        const name = v.service?.name || 'Non assigné';
        serviceCounts[name] = (serviceCounts[name] || 0) + 1;
      });
      const visitsByService = Object.entries(serviceCounts)
        .map(([name, visits]) => ({ name, visits }))
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

      // Invoice status distribution
      const invStatus: Record<string, number> = { not_invoiced: 0, invoiced: 0, paid: 0, partially_paid: 0, cancelled: 0 };
      invoices.forEach((inv) => {
        if (inv.payment_status in invStatus) invStatus[inv.payment_status]++;
      });
      const statusLabels: Record<string, string> = {
        not_invoiced: 'Non facturé',
        invoiced: 'Facturé',
        paid: 'Payé',
        partially_paid: 'Part. payé',
        cancelled: 'Annulé',
      };
      const invoiceStatus = Object.entries(invStatus)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: statusLabels[key] || key,
          value,
        }));

      // Service status distribution
      const srvStatus: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, blocked: 0, late: 0 };
      invoices.forEach((inv) => {
        if (inv.service_status in srvStatus) srvStatus[inv.service_status]++;
      });
      const serviceStatusLabels: Record<string, string> = {
        pending: 'En attente',
        in_progress: 'En cours',
        completed: 'Terminé',
        blocked: 'Bloqué',
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
        .filter((inv) => inv.is_billable)
        .reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);

      setReportData({
        visitsByDay,
        visitsByType,
        visitsByService,
        invoiceStatus,
        serviceStatus,
        topVisitors,
        totalVisits: visits.length,
        totalInvoiced,
        totalPaid,
        avgVisitDuration: Math.round(avgDuration),
      });

      // ==========================================
      // 2. EXECUTIVE REPORT CALCULATIONS
      // ==========================================

      // Filter follow-ups created in this period
      const periodFollowUps = followUps.filter((f) => {
        const created = new Date(f.created_at);
        return created >= fromDate && created <= toDate;
      });

      // Filter follow-ups completed in this period
      const completedFollowUps = followUps.filter((f) => {
        if (!f.completed_at) return false;
        const completed = new Date(f.completed_at);
        return completed >= fromDate && completed <= toDate;
      });

      const totalActions = periodFollowUps.length;

      // Gains calculation: Does the associated visit have a billable invoice > 0?
      const actionsWithGains = periodFollowUps.filter((f) => {
        const rawInvoice = f.visit?.invoices;
        if (!rawInvoice) return false;
        if (Array.isArray(rawInvoice)) {
          return rawInvoice.some((inv: any) => inv.is_billable && Number(inv.amount) > 0);
        }
        return rawInvoice.is_billable && Number(rawInvoice.amount) > 0;
      }).length;
      const actionsWithoutGains = totalActions - actionsWithGains;

      // Executed within deadline vs late
      const actionsCompletedOnTime = completedFollowUps.filter((f) => {
        if (!f.due_date) return true;
        const completedDateStr = format(new Date(f.completed_at!), 'yyyy-MM-dd');
        return completedDateStr <= f.due_date;
      }).length;
      const actionsCompletedLate = completedFollowUps.length - actionsCompletedOnTime;

      // HR Lateness & Ponctualité
      const startStr = format(fromDate, 'yyyy-MM-dd');
      const endStr = format(toDate, 'yyyy-MM-dd');
      const periodPresences = presences.filter(p => p.date >= startStr && p.date <= endStr);

      let onTimePresences = 0;
      let latePresences = 0;
      const lateList: any[] = [];

      periodPresences.forEach((p) => {
        if (!p.arrival_time) return;
        const arrTimeStr = format(new Date(p.arrival_time), 'HH:mm');
        if (arrTimeStr <= latenessThreshold) {
          onTimePresences++;
        } else {
          latePresences++;
          const arrivalDate = new Date(p.arrival_time);
          const thresholdDateStr = format(arrivalDate, 'yyyy-MM-dd') + 'T' + latenessThreshold + ':00';
          const diffMins = differenceInMinutes(arrivalDate, new Date(thresholdDateStr));
          lateList.push({
            date: p.date,
            employee_name: p.employee_name || p.profile?.full_name || 'Employé',
            service: p.profile?.service?.name || 'Non assigné',
            arrival: format(new Date(p.arrival_time), 'HH:mm:ss'),
            delay: diffMins > 0 ? diffMins : 0
          });
        }
      });

      // Actions by Service Breakdown
      const actionsByService = services.map((srv) => {
        const srvFollowups = periodFollowUps.filter((f) => f.visit?.service?.id === srv.id);
        const total = srvFollowups.length;
        const completed = srvFollowups.filter((f) => f.status === 'completed').length;
        const inProgress = srvFollowups.filter((f) => f.status === 'in_progress').length;
        return {
          serviceName: srv.name,
          total,
          completed,
          uncompleted: total - completed,
          inProgress,
        };
      });

      setExecutiveData({
        totalActions,
        actionsWithGains,
        actionsWithoutGains,
        actionsCompletedOnTime,
        actionsCompletedLate,
        onTimePresences,
        latePresences,
        lateList: lateList.sort((a, b) => b.delay - a.delay),
        actionsByService: actionsByService.sort((a, b) => b.total - a.total),
      });

    } catch (err) {
      console.error("Error in fetchReportData:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      
      {/* Printable Report Header */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-4 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-wider">
              {settings?.company_name || 'GICO SARL'}
            </h1>
            <p className="text-xs text-slate-500 font-semibold">{settings?.slogan}</p>
            <p className="text-[10px] text-slate-400 mt-1">
              RCCM: {settings?.rccm || '-'} | IFU: {settings?.ifu || '-'}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-bold text-slate-700 uppercase">
              Rapport Exécutif d'Activité
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Période du {format(new Date(dateFrom), 'dd/MM/yyyy')} au {format(new Date(dateTo), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports & Revue d'Activité</h1>
          <p className="text-gray-500">Statistiques et rapports de ponctualité, finances et actions terrain</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReportData} className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </button>
          <button onClick={handleExportPDF} className="btn-primary">
            <Printer className="w-4 h-4 mr-2" />
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 print:hidden">
        <button
          onClick={() => setReportTab('visual')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            reportTab === 'visual'
              ? 'border-primary-600 text-primary-600 bg-primary-50/30'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Tableau de Bord Graphique
        </button>
        <button
          onClick={() => setReportTab('executive')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            reportTab === 'executive'
              ? 'border-primary-600 text-primary-600 bg-primary-50/30'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          Rapport Exécutif & Revue
        </button>
      </div>

      {/* Controls & Date Range Selector */}
      <div className="card p-5 print:hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* Shortcuts */}
          <div className="lg:col-span-6 space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sélection Rapide</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'day', label: "Aujourd'hui" },
                { key: 'week', label: 'Cette Semaine' },
                { key: 'week-last', label: 'Semaine Dernière' },
                { key: 'month', label: 'Mois en cours' },
                { key: 'custom', label: 'Date personnalisée' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodType(p.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    periodType === p.key
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/20'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range inputs */}
          <div className="lg:col-span-4 space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dates de Période</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={periodType !== 'custom'}
                className="input text-xs py-2 disabled:opacity-75"
              />
              <span className="text-xs text-slate-400 font-bold">au</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={periodType !== 'custom'}
                className="input text-xs py-2 disabled:opacity-75"
              />
            </div>
          </div>

          {/* Lateness Threshold */}
          <div className="lg:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seuil Retard RH</label>
            <input
              type="time"
              value={latenessThreshold}
              onChange={(e) => setLatenessThreshold(e.target.value)}
              className="input text-xs py-2"
            />
          </div>

        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary-600"></div>
        </div>
      ) : (
        <>
          {/* ==========================================
              TAB 1: VISUAL GRAPHICAL DASHBOARD
              ========================================== */}
          {reportTab === 'visual' && (
            <div className="space-y-6">
              
              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Visites</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{reportData.totalVisits}</h3>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-2xl">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>

                <div className="card p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Facturé</span>
                    <h3 className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
                      {reportData.totalInvoiced.toLocaleString('fr-FR')} XOF
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-2xl">
                    <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>

                <div className="card p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Encaissé</span>
                    <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {reportData.totalPaid.toLocaleString('fr-FR')} XOF
                    </h3>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>

                <div className="card p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Durée Moyenne</span>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                      {reportData.avgVisitDuration} min
                    </h3>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                    <Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Trend Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Visits Trend */}
                <div className="card p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Évolution des Visites</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={reportData.visitsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                      <Tooltip contentStyle={{ borderRadius: 12 }} />
                      <Area type="monotone" dataKey="visits" stroke="#1e40af" strokeWidth={2} fill="#dbeafe" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Visits by Type */}
                <div className="card p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Répartition par Type</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={reportData.visitsByType}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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

              {/* Visits by Service */}
              <div className="card p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Visites par Service</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.visitsByService} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis type="number" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" width={140} />
                    <Tooltip contentStyle={{ borderRadius: 12 }} />
                    <Bar dataKey="visits" fill="#1e40af" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Status Breakdown Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Payments */}
                <div className="card p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Statut des Paiements</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={reportData.invoiceStatus}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {reportData.invoiceStatus.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Services */}
                <div className="card p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Statut des Prestations</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={reportData.serviceStatus}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
          )}

          {/* ==========================================
              TAB 2: EXECUTIVE PERIODIC RECAP REPORT
              ========================================== */}
          {reportTab === 'executive' && (
            <div className="space-y-6 print:space-y-5">
              
              {/* Executive Summary Pitch */}
              <div className="hidden print:block text-slate-600 text-xs mb-4">
                Ce rapport récapitule de manière consolidée l'activité de l'entreprise sur la période du{' '}
                <span className="font-bold text-slate-900">{format(new Date(dateFrom), 'dd MMMM yyyy', { locale: fr })}</span> au{' '}
                <span className="font-bold text-slate-900">{format(new Date(dateTo), 'dd MMMM yyyy', { locale: fr })}</span>. Il
                met en évidence les volumes opérationnels, la situation financière, l'analyse des actions de suivi par service,
                et le taux de ponctualité des équipes par rapport à l'heure d'embauche de{' '}
                <span className="font-bold text-slate-900">{latenessThreshold}</span>.
              </div>

              {/* Top KPIs Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
                
                <div className="card p-4 flex flex-col justify-between border-l-4 border-l-blue-600 print:shadow-none">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Volume Visites</span>
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{reportData.totalVisits}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Visites enregistrées</p>
                  </div>
                </div>

                <div className="card p-4 flex flex-col justify-between border-l-4 border-l-amber-500 print:shadow-none">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Total Facturé</span>
                    <CreditCard className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white">
                      {reportData.totalInvoiced.toLocaleString('fr-FR')} XOF
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Activité facturable</p>
                  </div>
                </div>

                <div className="card p-4 flex flex-col justify-between border-l-4 border-l-emerald-500 print:shadow-none">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Caisse / Encaissements</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {reportData.totalPaid.toLocaleString('fr-FR')} XOF
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Total encaissé en caisse</p>
                  </div>
                </div>

                <div className="card p-4 flex flex-col justify-between border-l-4 border-l-indigo-500 print:shadow-none">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider">Actions terrain</span>
                    <Layers className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{executiveData.totalActions}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Actions de suivi initiées</p>
                  </div>
                </div>

              </div>

              {/* Point Financier & Analyse des Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 print:break-inside-avoid">
                
                {/* Point Financier Details */}
                <div className="card p-5 print:shadow-none">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Le Point Financier</h3>
                  </div>
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-500 font-semibold">Total Prestations Facturées</span>
                      <span className="font-bold text-slate-800 dark:text-white">{reportData.totalInvoiced.toLocaleString('fr-FR')} XOF</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-500 font-semibold">Total Encaissements Réglés (Caisse)</span>
                      <span className="font-bold text-emerald-600">{reportData.totalPaid.toLocaleString('fr-FR')} XOF</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold pt-1">
                      <span className="text-slate-500">Reste à Recouvrer (Créances)</span>
                      <span className="text-rose-600">{(reportData.totalInvoiced - reportData.totalPaid).toLocaleString('fr-FR')} XOF</span>
                    </div>
                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">Taux de Recouvrement</span>
                      <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-extrabold rounded-lg">
                        {reportData.totalInvoiced > 0 ? Math.round((reportData.totalPaid / reportData.totalInvoiced) * 100) : 100}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Analyse des Actions */}
                <div className="card p-5 print:shadow-none">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Analyse des Actions</h3>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                      <span className="text-slate-500 font-semibold">Actions Menées (Générales)</span>
                      <span className="font-bold text-slate-800 dark:text-white">{executiveData.totalActions}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80 text-emerald-600 font-medium">
                      <span>Actions ayant généré des gains</span>
                      <span className="font-bold">{executiveData.actionsWithGains}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80 text-slate-500 font-medium">
                      <span>Actions sans gains (Hors catalogue / Non facturables)</span>
                      <span className="font-bold">{executiveData.actionsWithoutGains}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80 text-blue-600 font-medium">
                      <span>Actions exécutées dans les délais</span>
                      <span className="font-bold">{executiveData.actionsCompletedOnTime}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-600 font-semibold">
                      <span>Actions exécutées hors délais (en retard)</span>
                      <span className="font-bold">{executiveData.actionsCompletedLate}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Point de Ponctualité RH */}
              <div className="card p-5 print:shadow-none print:break-inside-avoid">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Suivi RH & Ponctualité (Seuil: {latenessThreshold})
                    </h3>
                  </div>
                  <div className="flex gap-4 text-xs font-bold print:gap-6">
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <UserCheck className="w-4 h-4" />
                      <span>{executiveData.onTimePresences} à l'heure</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-600">
                      <UserX className="w-4 h-4" />
                      <span>{executiveData.latePresences} en retard</span>
                    </div>
                  </div>
                </div>

                {/* Late List Detail */}
                {executiveData.lateList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                          <th className="py-2.5">Date</th>
                          <th className="py-2.5">Collaborateur</th>
                          <th className="py-2.5">Service</th>
                          <th className="py-2.5">Heure d'Arrivée</th>
                          <th className="py-2.5 text-right">Retard cumulé</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {executiveData.lateList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="py-2.5 font-semibold text-slate-600 dark:text-slate-400">
                              {format(new Date(item.date), 'dd/MM/yyyy')}
                            </td>
                            <td className="py-2.5 font-bold text-slate-800 dark:text-white">{item.employee_name}</td>
                            <td className="py-2.5 text-slate-500 font-semibold">{item.service}</td>
                            <td className="py-2.5 font-mono font-medium text-slate-700 dark:text-slate-300">{item.arrival}</td>
                            <td className="py-2.5 text-right font-black text-rose-600">
                              +{item.delay} min
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <UserCheck className="w-8 h-8 text-emerald-500 mb-2" />
                    <p className="text-xs font-bold text-slate-500">Aucun retard enregistré sur cette période !</p>
                  </div>
                )}
              </div>

              {/* Performance / Suivi par Service */}
              <div className="card p-5 print:shadow-none print:break-inside-avoid">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
                  <Briefcase className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Suivi d'Actions et Performance par Service
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                        <th className="py-2.5">Nom du Service</th>
                        <th className="py-2.5 text-center">Actions Menées</th>
                        <th className="py-2.5 text-center text-emerald-600">Achevées</th>
                        <th className="py-2.5 text-center text-slate-500">Non Achevées</th>
                        <th className="py-2.5 text-center text-blue-600">En cours</th>
                        <th className="py-2.5 text-right">Taux de réalisation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {executiveData.actionsByService.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="py-3 font-bold text-slate-800 dark:text-white">{item.serviceName}</td>
                          <td className="py-3 text-center font-extrabold text-slate-700 dark:text-slate-300">{item.total}</td>
                          <td className="py-3 text-center font-bold text-emerald-600">{item.completed}</td>
                          <td className="py-3 text-center font-semibold text-slate-500">{item.uncompleted}</td>
                          <td className="py-3 text-center font-bold text-blue-600">{item.inProgress}</td>
                          <td className="py-3 text-right">
                            <span className={`px-2 py-0.5 rounded-lg font-bold ${
                              item.total > 0 && (item.completed / item.total) >= 0.8
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.total > 0 && (item.completed / item.total) >= 0.4
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.total > 0 ? Math.round((item.completed / item.total) * 100) : 100}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
}
