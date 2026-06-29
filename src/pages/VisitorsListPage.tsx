import { useEffect, useState } from 'react';
import { supabase, Visitor } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Phone,
  Mail,
  Calendar,
  Users,
  Trash2,
  X,
  Eye,
  Clock,
  ExternalLink,
  Loader2,
  CheckCircle,
  Building2,
} from 'lucide-react';

export default function VisitorsListPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // History Drawer states
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [visitorVisits, setVisitorVisits] = useState<any[]>([]);
  const [visitorAppointments, setVisitorAppointments] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'visits' | 'appointments'>('visits');

  useEffect(() => {
    fetchVisitors();
  }, [searchQuery, typeFilter]);

  const fetchVisitors = async () => {
    setLoading(true);
    let query = supabase.from('visitors').select('*').order('last_name', { ascending: true });

    if (typeFilter) {
      query = query.eq('visitor_type', typeFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      // Client-side search
      const filtered = searchQuery
        ? data.filter(
            (v) =>
              v.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              v.email?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : data;
      setVisitors(filtered);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      in_progress: { label: 'En attente', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/20' },
      en_cours: { label: 'En entretien', class: 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/20' },
      traite: { label: 'Traité', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/20' },
      a_relancer: { label: 'À relancer', class: 'bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/20' },
      transforme: { label: 'Opportunité', class: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200/20' },
      completed: { label: 'Terminé', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/20' },
      cancelled: { label: 'Annulé', class: 'bg-slate-100 text-slate-700 dark:bg-slate-950/20 dark:text-slate-400 border border-slate-200/20' },
      annule: { label: 'Annulé', class: 'bg-slate-100 text-slate-700 dark:bg-slate-950/20 dark:text-slate-400 border border-slate-200/20' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'bg-slate-100 text-slate-700' };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${current.class}`}>
        {current.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      not_invoiced: { label: 'Non facturé', class: 'bg-slate-100 text-slate-700 dark:bg-slate-950/20 dark:text-slate-400 border border-slate-200/20' },
      invoiced: { label: 'Facturé', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/20' },
      paid: { label: 'Payé', class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/20' },
      partially_paid: { label: 'Payé part.', class: 'bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/20' },
      cancelled: { label: 'Annulé', class: 'bg-slate-100 text-slate-700' }
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'bg-slate-100 text-slate-700' };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${current.class}`}>
        💰 {current.label}
      </span>
    );
  };

  const getFollowUpStatusLabel = (status: string) => {
    const config: Record<string, string> = {
      pending: 'En attente',
      in_progress: 'En cours',
      completed: 'Terminé',
      blocked: 'Bloqué',
      late: 'En retard',
    };
    return config[status] || status;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(price);
  };

  const fetchVisitorHistory = async (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setLoadingHistory(true);
    setDrawerTab('visits');
    setVisitorVisits([]);
    setVisitorAppointments([]);

    try {
      // 1. Fetch all visits
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          service:services(*),
          assigned_collaborator:profiles!visits_assigned_collaborator_id_fkey(id, full_name, role)
        `)
        .eq('visitor_id', visitor.id)
        .order('arrival_time', { ascending: false });

      if (visitsError) throw visitsError;

      let enrichedVisits = [];

      if (visits && visits.length > 0) {
        const visitIds = visits.map((v) => v.id);

        // 2. Fetch all invoices for these visits
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            *,
            items:invoice_items(
              *,
              service_item:service_items(*)
            )
          `)
          .in('visit_id', visitIds);

        // 3. Fetch all followups for these visits
        const { data: followups, error: followupsError } = await supabase
          .from('visit_followups')
          .select('*')
          .in('visit_id', visitIds);

        // Map invoices and followups to their respective visits
        enrichedVisits = visits.map((v) => {
          const invoice = invoices?.find((inv) => inv.visit_id === v.id) || null;
          const visitFollowups = followups?.filter((f) => f.visit_id === v.id) || [];
          return {
            ...v,
            invoice,
            followups: visitFollowups
          };
        });
      }

      setVisitorVisits(enrichedVisits);

      // 4. Fetch all appointments
      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select(`
          *,
          collaborator:profiles(*)
        `)
        .eq('visitor_id', visitor.id)
        .order('start_time', { ascending: false });

      if (apptError) throw apptError;
      setVisitorAppointments(appointments || []);

    } catch (err: any) {
      console.error("Error fetching visitor history:", err);
      alert("Impossible de récupérer l'historique du visiteur : " + err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteVisitor = async (visitor: Visitor) => {
    if (window.confirm(`Voulez-vous vraiment supprimer définitivement le visiteur "${visitor.first_name} ${visitor.last_name}" ?`)) {
      const { error } = await supabase
        .from('visitors')
        .delete()
        .eq('id', visitor.id);

      if (error) {
        alert(`Erreur lors de la suppression : ${error.message}`);
      } else {
        fetchVisitors();
      }
    }
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

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      client: 'bg-emerald-100 text-emerald-800',
      prospect: 'bg-blue-100 text-blue-800',
      supplier: 'bg-amber-100 text-amber-800',
      partner: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repertoire des visiteurs</h1>
          <p className="text-gray-500">Liste de tous les visiteurs enregistres</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, entreprise, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input sm:w-48"
          >
            <option value="">Tous les types</option>
            <option value="client">Clients</option>
            <option value="prospect">Prospects</option>
            <option value="supplier">Fournisseurs</option>
            <option value="partner">Partenaires</option>
            <option value="other">Autres</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-gray-600">{visitors.length} visiteur(s) trouve(s)</p>

      {/* Visitors Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : visitors.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun visiteur trouve</h3>
          <p className="text-gray-500">Les visiteurs seront ajoutes automatiquement lors de l'enregistrement de visites</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visitors.map((visitor) => (
            <div key={visitor.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-primary-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {visitor.first_name} {visitor.last_name}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">{visitor.company || 'Particulier'}</p>
                  <span className={`badge mt-2 ${getTypeColor(visitor.visitor_type)}`}>
                    {getVisitorTypeLabel(visitor.visitor_type)}
                  </span>
                </div>
                {profile && ['admin', 'director'].includes(profile.role) && (
                  <button
                    onClick={() => handleDeleteVisitor(visitor)}
                    className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                    title="Supprimer le visiteur"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {visitor.phone && (
                  <a href={`tel:${visitor.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-700">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {visitor.phone}
                  </a>
                )}
                {visitor.email && (
                  <a href={`mailto:${visitor.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-700 truncate">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{visitor.email}</span>
                  </a>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800/80 text-xs text-gray-500 dark:text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Premier enregistrement: {format(new Date(visitor.created_at), 'dd/MM/yyyy', { locale: fr })}
                </div>
                <button
                  onClick={() => fetchVisitorHistory(visitor)}
                  className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Historique
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side Drawer for Visitor History */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop overlay */}
            <div 
              className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setSelectedVisitor(null)}
            ></div>

            {/* Slide-over panel container */}
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <div className="pointer-events-auto w-screen max-w-2xl transform transition-transform duration-300 ease-in-out bg-white dark:bg-[#0B0F19] shadow-2xl flex flex-col border-l border-slate-200/50 dark:border-slate-800/60">
                
                {/* Header */}
                <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        Dossier & Historique Client
                      </h2>
                      <div className="flex flex-col gap-1.5 pt-2">
                        <p className="text-base font-extrabold text-slate-900 dark:text-white">
                          {selectedVisitor.first_name} {selectedVisitor.last_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                          🏢 {selectedVisitor.company || 'Particulier'}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          {selectedVisitor.phone && (
                            <a href={`tel:${selectedVisitor.phone}`} className="hover:text-primary-600">
                              📞 {selectedVisitor.phone}
                            </a>
                          )}
                          {selectedVisitor.email && (
                            <a href={`mailto:${selectedVisitor.email}`} className="hover:text-primary-600">
                              ✉️ {selectedVisitor.email}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="ml-3 flex h-7 items-center">
                      <button
                        type="button"
                        className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all"
                        onClick={() => setSelectedVisitor(null)}
                      >
                        <span className="sr-only">Fermer le panneau</span>
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Tabs Nav */}
                  <div className="flex gap-2 mt-6 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
                    <button
                      onClick={() => setDrawerTab('visits')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        drawerTab === 'visits'
                          ? 'bg-white dark:bg-slate-950 text-primary-600 dark:text-primary-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      Visites ({visitorVisits.length})
                    </button>
                    <button
                      onClick={() => setDrawerTab('appointments')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        drawerTab === 'appointments'
                          ? 'bg-white dark:bg-slate-950 text-primary-600 dark:text-primary-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      Rendez-vous ({visitorAppointments.length})
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                  {loadingHistory ? (
                    // Skeleton Loaders
                    <div className="space-y-4">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="card p-5 animate-pulse space-y-3">
                          <div className="h-4 bg-slate-200 dark:bg-slate-850 rounded w-1/3"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded w-2/3"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded w-1/2"></div>
                        </div>
                      ))}
                    </div>
                  ) : drawerTab === 'visits' ? (
                    visitorVisits.length === 0 ? (
                      // Empty state
                      <div className="text-center py-16">
                        <Clock className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Aucune visite enregistrée</p>
                      </div>
                    ) : (
                      // Visits list timeline
                      <div className="relative border-l border-slate-100 dark:border-slate-800/80 pl-6 ml-3 space-y-6">
                        {visitorVisits.map((visit) => {
                          const arrival = new Date(visit.arrival_time);
                          return (
                            <div key={visit.id} className="relative group">
                              {/* Circle indicator on timeline */}
                              <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white dark:border-[#0B0F19] bg-primary-600 text-white shadow-sm ring-4 ring-white dark:ring-[#0B0F19]">
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              </span>

                              <div className="card p-5 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                                {/* Header of card */}
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 font-mono bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-md border border-primary-100/10">
                                      {visit.visit_code}
                                    </span>
                                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-white mt-1.5">{visit.purpose}</h4>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1">
                                      📅 {format(arrival, 'dd MMMM yyyy à HH:mm', { locale: fr })}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5">
                                    {/* Statut visite */}
                                    {getStatusBadge(visit.status)}
                                    {/* Statut paiement */}
                                    {visit.invoice && getPaymentStatusBadge(visit.invoice.payment_status)}
                                  </div>
                                </div>

                                {/* Service and Collaborator */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50/70 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs">
                                  <div className="space-y-1">
                                    <p className="text-slate-400 dark:text-slate-500 font-semibold">Service ciblé</p>
                                    <p className="font-bold text-slate-800 dark:text-white">{visit.service?.name || '-'}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-slate-400 dark:text-slate-500 font-semibold">Membre du service</p>
                                    <p className="font-bold text-slate-800 dark:text-white">
                                      {visit.assigned_collaborator?.full_name || 'Non assigné'}
                                    </p>
                                  </div>
                                </div>

                                {/* Decision / Report & Observations */}
                                {(visit.report || visit.observations) && (
                                  <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800/60 pt-3">
                                    <p className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[10px] text-slate-400">Décision & Compte-rendu</p>
                                    {visit.observations && (
                                      <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 rounded-xl leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                                        <span className="font-bold text-slate-400 block mb-0.5">Notes d'entretien :</span>
                                        {visit.observations}
                                      </div>
                                    )}
                                    {visit.report && (
                                      <div className="p-2.5 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/10 dark:border-emerald-950/30 rounded-xl leading-relaxed text-slate-700 dark:text-emerald-400 font-bold">
                                        <span className="font-black text-emerald-600 dark:text-emerald-500 block mb-0.5">Résultat / Décision finale :</span>
                                        {visit.report}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Work to be done / Prestations */}
                                {visit.invoice && visit.invoice.items && visit.invoice.items.length > 0 && (
                                  <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800/60 pt-3">
                                    <p className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[10px] text-slate-400">Prestations & Travail à réaliser</p>
                                    <div className="space-y-1.5">
                                      {visit.invoice.items.map((item: any) => (
                                        <div key={item.id} className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60">
                                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            {item.custom_name || item.service_item?.name || 'Prestation'} <span className="text-slate-400">x{item.quantity}</span>
                                          </span>
                                          <span className="font-bold text-slate-900 dark:text-white">
                                            {formatPrice(item.total_price)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Followups */}
                                {visit.followups && visit.followups.length > 0 && (
                                  <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800/60 pt-3">
                                    <p className="font-bold text-slate-800 dark:text-white uppercase tracking-wider text-[10px] text-slate-400">Suivis & Tâches associées</p>
                                    <div className="space-y-1.5">
                                      {visit.followups.map((f: any) => (
                                        <div key={f.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60">
                                          <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${f.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                              Tâche : {getFollowUpStatusLabel(f.status)}
                                            </span>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                            f.priority === 'urgent' ? 'bg-rose-100 text-rose-800' :
                                            f.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                                          }`}>
                                            {f.priority}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Link to full page */}
                                <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3 flex justify-end">
                                  <Link
                                    to={`/visits/${visit.id}`}
                                    className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 group"
                                  >
                                    Consulter la fiche complète 
                                    <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    visitorAppointments.length === 0 ? (
                      // Empty state
                      <div className="text-center py-16">
                        <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Aucun rendez-vous planifié</p>
                      </div>
                    ) : (
                      // Appointments list
                      <div className="space-y-4">
                        {visitorAppointments.map((appt) => {
                          const start = new Date(appt.start_time);
                          const isFuture = start.getTime() > Date.now();
                          return (
                            <div key={appt.id} className="card p-5 border-l-4 border-primary-500 dark:border-primary-600 space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{appt.title}</h4>
                                <span className={`badge shrink-0 ${isFuture ? 'badge-success bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'badge-gray'}`}>
                                  {isFuture ? 'À venir' : 'Passé'}
                                </span>
                              </div>
                              {appt.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                  {appt.description}
                                </p>
                              )}
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-2 gap-4 text-xs font-semibold">
                                <div className="space-y-1">
                                  <p className="text-slate-400 dark:text-slate-500">Date & Heure</p>
                                  <p className="text-slate-800 dark:text-white">
                                    🕒 {format(start, 'dd/MM/yyyy HH:mm', { locale: fr })}
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-slate-400 dark:text-slate-500">Collaborateur à rencontrer</p>
                                  <p className="text-slate-800 dark:text-white">
                                    👤 {appt.collaborator?.full_name || 'Non spécifié'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setSelectedVisitor(null);
                      navigate('/agenda');
                    }}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-4 shadow-sm"
                  >
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Aller à l'Agenda
                  </button>
                  <button
                    onClick={() => setSelectedVisitor(null)}
                    className="btn-primary text-xs py-2 px-5"
                  >
                    Fermer
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
