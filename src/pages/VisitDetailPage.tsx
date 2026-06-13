import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, Visit, Invoice, Comment, VisitFollowUp, Service } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle,
  Edit,
  FileText,
  CreditCard,
  MessageSquare,
  Send,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

export default function VisitDetailPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [followUps, setFollowUps] = useState<VisitFollowUp[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);

  const [invoiceForm, setInvoiceForm] = useState({
    is_billable: false,
    amount: 0,
    expected_duration_days: 7,
    responsible_service_id: '',
  });

  const [followUpForm, setFollowUpForm] = useState({
    status: 'pending',
    priority: 'normal',
    due_date: '',
    note: '',
  });

  useEffect(() => {
    fetchVisit();
    fetchServices();
  }, [id]);

  const fetchVisit = async () => {
    setLoading(true);
    const { data: visitData } = await supabase
      .from('visits')
      .select(
        `
        *,
        visitor:visitors(*),
        service:services(*)
      `
      )
      .eq('id', id)
      .single();

    if (visitData) {
      setVisit(visitData);

      // Fetch invoice
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('*')
        .eq('visit_id', id)
        .single();
      if (invoiceData) setInvoice(invoiceData);

      // Fetch follow-ups
      const { data: followUpsData } = await supabase
        .from('visit_followups')
        .select('*')
        .eq('visit_id', id);
      if (followUpsData) setFollowUps(followUpsData);

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('comments')
        .select(`*, profile:profiles(*)`)
        .eq('visit_id', id)
        .order('created_at', { ascending: true });
      if (commentsData) setComments(commentsData);
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    if (data) setServices(data);
  };

  const handleMarkDeparture = async () => {
    if (!visit) return;
    await supabase
      .from('visits')
      .update({ departure_time: new Date().toISOString(), status: 'completed' })
      .eq('id', visit.id);
    fetchVisit();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    await supabase.from('comments').insert({
      visit_id: id,
      user_id: user.id,
      content: newComment.trim(),
    });

    setNewComment('');
    fetchVisit();
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit) return;

    await supabase.from('invoices').insert({
      visit_id: visit.id,
      is_billable: invoiceForm.is_billable,
      amount: invoiceForm.amount,
      expected_duration_days: invoiceForm.expected_duration_days,
      responsible_service_id: invoiceForm.responsible_service_id || null,
      deadline: invoiceForm.responsible_service_id
        ? new Date(Date.now() + invoiceForm.expected_duration_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null,
    });

    setShowInvoiceForm(false);
    fetchVisit();
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('visit_followups').insert({
      visit_id: id,
      status: followUpForm.status,
      priority: followUpForm.priority,
      due_date: followUpForm.due_date || null,
    });

    setShowFollowUpForm(false);
    fetchVisit();
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

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      not_invoiced: { label: 'Non facturé', class: 'badge-gray' },
      invoiced: { label: 'Facturé', class: 'badge-info' },
      paid: { label: 'Payé', class: 'badge-success' },
      partially_paid: { label: 'Partiellement payé', class: 'badge-warning' },
      cancelled: { label: 'Annulé', class: 'badge-danger' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={current.class}>{current.label}</span>;
  };

  const getServiceStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', class: 'badge-gray' },
      in_progress: { label: 'En cours', class: 'badge-info' },
      completed: { label: 'Terminé', class: 'badge-success' },
      blocked: { label: 'Bloqué', class: 'badge-danger' },
      late: { label: 'En retard', class: 'badge-warning' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={current.class}>{current.label}</span>;
  };

  const getPriorityBadge = (priority: string) => {
    const config = {
      low: { label: 'Basse', class: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
      normal: { label: 'Normale', class: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' },
      high: { label: 'Haute', class: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
      urgent: { label: 'Urgente', class: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold' },
    };
    const current = config[priority as keyof typeof config] || { label: priority, class: 'badge-gray' };
    return <span className={`badge ${current.class}`}>{current.label}</span>;
  };

  const canEdit = profile?.role === 'admin' || profile?.role === 'reception' || profile?.role === 'director';
  const canManageInvoice = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'director';
  const canManageFollowUp = profile?.role === 'admin' || profile?.role === 'service_manager' || profile?.role === 'director';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner h-10 w-10"></div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="card p-12 text-center space-y-4 max-w-md mx-auto mt-12">
        <FileText className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Visite non trouvée</h2>
        <button onClick={() => navigate('/visits')} className="btn-primary w-full">
          Retour au registre
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">{visit.visit_code}</h1>
              {getStatusBadge(visit.status)}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Fiche détaillée</p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex gap-2 shrink-0">
          {visit.status === 'in_progress' && canEdit && (
            <button onClick={handleMarkDeparture} className="btn-success px-5">
              <CheckCircle className="w-4.5 h-4.5 mr-2" />
              Enregistrer le départ
            </button>
          )}
          {canEdit && (
            <Link to={`/visits/${id}/edit`} className="btn-secondary px-5">
              <Edit className="w-4.5 h-4.5 mr-2" />
              Modifier
            </Link>
          )}
        </div>
      </div>

      {/* Grid Split Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details Columns (Left) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Visit Information */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Informations générales</h2>
            </div>
            <div className="card-body grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              <div>
                <p className="label">Motif de visite</p>
                <p className="font-bold text-slate-800 dark:text-white text-base leading-snug">{visit.purpose}</p>
              </div>

              <div>
                <p className="label">Rendez-vous planifié</p>
                <p className="font-semibold text-slate-800 dark:text-white text-sm">
                  {visit.has_appointment ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-lg border border-emerald-100/10">Oui</span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg">Non</span>
                  )}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 sm:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="label">Heure d'arrivée</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {format(new Date(visit.arrival_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="label">Heure de départ</p>
                  {visit.departure_time ? (
                    <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {format(new Date(visit.departure_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-600 italic text-sm">Visite toujours en cours</span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 sm:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="label">Service concerné</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {visit.service?.name || 'Non spécifié'}
                  </p>
                </div>
                <div>
                  <p className="label">Collaborateur à rencontrer</p>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    {visit.person_to_meet || 'Non renseigné'}
                  </p>
                </div>
              </div>

              {visit.comments && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 sm:col-span-2">
                  <p className="label">Observations d'accueil</p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed bg-slate-50/50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 font-medium">{visit.comments}</p>
                </div>
              )}
            </div>
          </div>

          {/* Billing / Invoice Panel */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Facturation & Prestation</h2>
              {!invoice && canManageInvoice && (
                <button onClick={() => setShowInvoiceForm(true)} className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
                  <Plus className="w-4 h-4" /> Configurer facturation
                </button>
              )}
            </div>
            <div className="card-body">
              {invoice ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  <div>
                    <p className="label">Assujetti à facturation</p>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">
                      {invoice.is_billable ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-lg border border-amber-100/10">Oui</span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg">Non (Gratuit)</span>
                      )}
                    </p>
                  </div>

                  {invoice.is_billable && (
                    <div>
                      <p className="label">Montant global</p>
                      <p className="text-lg font-black text-primary-600 dark:text-primary-400">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(invoice.amount)}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 sm:col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <p className="label">Statut du paiement</p>
                      {getPaymentStatusBadge(invoice.payment_status)}
                    </div>
                    <div>
                      <p className="label">Statut de réalisation</p>
                      {getServiceStatusBadge(invoice.service_status)}
                    </div>
                  </div>

                  {invoice.deadline && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 sm:col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <p className="label">Date d'échéance</p>
                        <p className="font-semibold text-slate-800 dark:text-white text-sm">
                          {format(new Date(invoice.deadline), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      </div>
                      <div>
                        <p className="label">Analyse du délai</p>
                        <p className="font-semibold text-sm">
                          {new Date(invoice.deadline) < new Date() && invoice.service_status !== 'completed' ? (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                              <ShieldAlert className="w-4 h-4" />
                              Échéance dépassée
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Dans les temps</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-slate-600 space-y-2">
                  <CreditCard className="w-10 h-10 mx-auto opacity-50" />
                  <p className="text-xs font-semibold">Aucune facturation configurée pour cette visite</p>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up Section */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Demandes de suivi de prestation</h2>
              {canManageFollowUp && (
                <button onClick={() => setShowFollowUpForm(true)} className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
                  <Plus className="w-4 h-4" /> Nouveau suivi
                </button>
              )}
            </div>
            <div className="card-body">
              {followUps.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {followUps.map((fu) => (
                    <div key={fu.id} className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        {getServiceStatusBadge(fu.status)}
                        {getPriorityBadge(fu.priority)}
                      </div>
                      {fu.due_date && (
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-2">
                          Date d'échéance : {format(new Date(fu.due_date), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-slate-600 space-y-2">
                  <CheckCircle className="w-10 h-10 mx-auto opacity-50" />
                  <p className="text-xs font-semibold">Aucun suivi requis pour cette prestation</p>
                </div>
              )}
            </div>
          </div>

          {/* Comments Panel */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4.5 h-4.5 text-slate-400" />
                Fil de discussion ({comments.length})
              </h2>
            </div>
            <div className="card-body space-y-6">
              
              {comments.length > 0 && (
                <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-thin pr-2">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3.5 items-start">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900 flex items-center justify-center flex-shrink-0 border border-primary-100/10">
                        <User className="w-4.5 h-4.5 text-primary-700 dark:text-primary-400" />
                      </div>
                      
                      <div className="flex-1 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 dark:text-white">{(c as any).profile?.full_name || 'Collaborateur'}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-normal font-medium">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Écrire une observation ou un message..."
                  className="input flex-1"
                />
                <button type="submit" disabled={!newComment.trim()} className="btn-primary px-4 shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </form>

            </div>
          </div>

        </div>

        {/* Visitor Info Panel (Right) */}
        <div className="space-y-6">
          
          {/* Visitor Card */}
          <div className="card">
            <div className="card-body space-y-6">
              <div className="text-center space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center mx-auto shadow-md">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
                    {visit.visitor?.first_name} {visit.visitor?.last_name}
                  </h3>
                  {visit.visitor?.company && (
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">{visit.visitor.company}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                
                <div>
                  <p className="label">Profil Visiteur</p>
                  <span className="badge-gray px-3 py-1 font-bold text-xs uppercase tracking-wider">{getVisitorTypeLabel(visit.visitor?.visitor_type || 'other')}</span>
                </div>

                {visit.visitor?.phone && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                    <Phone className="w-4.5 h-4.5 text-slate-400" />
                    <a href={`tel:${visit.visitor.phone}`} className="text-sm font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline">
                      {visit.visitor.phone}
                    </a>
                  </div>
                )}

                {visit.visitor?.email && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                    <Mail className="w-4.5 h-4.5 text-slate-400" />
                    <a href={`mailto:${visit.visitor.email}`} className="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline truncate">
                      {visit.visitor.email}
                    </a>
                  </div>
                )}
                
              </div>
            </div>
          </div>

          {/* Quick Actions inside visitor sidebar */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider">Prestation & Preuve</h3>
            <div className="space-y-2">
              {canManageInvoice && invoice && (
                <button 
                  onClick={() => setShowInvoiceForm(true)} 
                  className="btn-secondary w-full justify-start text-xs rounded-xl"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Mettre à jour facturation
                </button>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* MODAL: Invoice creation Form */}
      {showInvoiceForm && (
        <div className="modal-backdrop" onClick={() => setShowInvoiceForm(false)}>
          <div className="modal animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Paramétrer la facturation</h3>
              <button onClick={() => setShowInvoiceForm(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddInvoice} className="p-6 space-y-5">
              
              <div>
                <label className="label">Assujetti aux frais</label>
                <div className="flex gap-6 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      checked={invoiceForm.is_billable}
                      onChange={() => setInvoiceForm((p) => ({ ...p, is_billable: true }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    Oui, facturable
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      checked={!invoiceForm.is_billable}
                      onChange={() => setInvoiceForm((p) => ({ ...p, is_billable: false }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    Non, gratuit
                  </label>
                </div>
              </div>

              {invoiceForm.is_billable && (
                <>
                  <div>
                    <label className="label">Montant global (XOF)</label>
                    <input
                      type="number"
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                      className="input"
                      min="0"
                      step="100"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Échéance de réalisation (Jours)</label>
                    <input
                      type="number"
                      value={invoiceForm.expected_duration_days}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, expected_duration_days: Number(e.target.value) }))}
                      className="input"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Service de traitement responsable</label>
                    <select
                      value={invoiceForm.responsible_service_id}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, responsible_service_id: e.target.value }))}
                      className="input"
                      required
                    >
                      <option value="">Sélectionner un service...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <button type="button" onClick={() => setShowInvoiceForm(false)} className="btn-secondary px-5 py-2.5">
                  Annuler
                </button>
                <button type="submit" className="btn-primary px-6 py-2.5">
                  Enregistrer
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: Follow-up Creation Form */}
      {showFollowUpForm && (
        <div className="modal-backdrop" onClick={() => setShowFollowUpForm(false)}>
          <div className="modal animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Créer une demande de suivi</h3>
              <button onClick={() => setShowFollowUpForm(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddFollowUp} className="p-6 space-y-5">
              <div>
                <label className="label">Statut initial</label>
                <select
                  value={followUpForm.status}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, status: e.target.value }))}
                  className="input"
                >
                  <option value="pending">En attente</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminé</option>
                  <option value="blocked">Bloqué</option>
                  <option value="late">En retard</option>
                </select>
              </div>
              
              <div>
                <label className="label">Priorité</label>
                <select
                  value={followUpForm.priority}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, priority: e.target.value }))}
                  className="input"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              
              <div>
                <label className="label">Date d'échéance du traitement</label>
                <input
                  type="date"
                  value={followUpForm.due_date}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, due_date: e.target.value }))}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <button type="button" onClick={() => setShowFollowUpForm(false)} className="btn-secondary px-5 py-2.5">
                  Annuler
                </button>
                <button type="submit" className="btn-primary px-6 py-2.5">
                  Créer le suivi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
