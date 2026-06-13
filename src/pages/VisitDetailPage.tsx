import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, Visit, Invoice, Comment, VisitFollowUp, Service, Profile } from '../lib/supabase';
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
  XCircle,
  Edit,
  FileText,
  CreditCard,
  MessageSquare,
  Send,
  AlertTriangle,
  Plus,
  Settings,
  Ban,
  CheckSquare,
  Loader2,
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
      in_progress: { label: 'En cours', class: 'badge-info' },
      completed: { label: 'Termine', class: 'badge-success' },
      cancelled: { label: 'Annule', class: 'badge-danger' },
    };
    const { label, class: cls } = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={cls}>{label}</span>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      not_invoiced: { label: 'Non facture', class: 'badge-gray' },
      invoiced: { label: 'Facture', class: 'badge-info' },
      paid: { label: 'Paye', class: 'badge-success' },
      partially_paid: { label: 'Part. paye', class: 'badge-warning' },
      cancelled: { label: 'Annule', class: 'badge-danger' },
    };
    const { label, class: cls } = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={cls}>{label}</span>;
  };

  const getServiceStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', class: 'badge-gray' },
      in_progress: { label: 'En cours', class: 'badge-info' },
      completed: { label: 'Termine', class: 'badge-success' },
      blocked: { label: 'Bloque', class: 'badge-danger' },
      late: { label: 'En retard', class: 'badge-warning' },
    };
    const { label, class: cls } = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={cls}>{label}</span>;
  };

  const getPriorityBadge = (priority: string) => {
    const config = {
      low: { label: 'Basse', class: 'bg-gray-100 text-gray-700' },
      normal: { label: 'Normale', class: 'bg-blue-100 text-blue-700' },
      high: { label: 'Haute', class: 'bg-orange-100 text-orange-700' },
      urgent: { label: 'Urgente', class: 'bg-red-100 text-red-700' },
    };
    const { label, class: cls } = config[priority as keyof typeof config] || { label: priority, class: 'badge-gray' };
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  const canEdit = profile?.role === 'admin' || profile?.role === 'reception' || profile?.role === 'director';
  const canManageInvoice = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'director';
  const canManageFollowUp = profile?.role === 'admin' || profile?.role === 'service_manager' || profile?.role === 'director';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Visite non trouvee</h2>
        <Link to="/visits" className="btn-primary">
          Retour aux visites
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{visit.visit_code}</h1>
            <p className="text-gray-500">Details de la visite</p>
          </div>
        </div>
        <div className="flex gap-2">
          {visit.status === 'in_progress' && canEdit && (
            <button onClick={handleMarkDeparture} className="btn-success">
              <CheckCircle className="w-5 h-5 mr-2" />
              Marquer le depart
            </button>
          )}
          {canEdit && (
            <Link to={`/visits/${id}/edit`} className="btn-secondary">
              <Edit className="w-5 h-5 mr-2" />
              Modifier
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visit Info */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Informations de la visite</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Statut</p>
                  {getStatusBadge(visit.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rendez-vous prevu</p>
                  <p className="font-medium">{visit.has_appointment ? 'Oui' : 'Non'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Arrivee</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {format(new Date(visit.arrival_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Depart</p>
                  {visit.departure_time ? (
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {format(new Date(visit.departure_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Motif</p>
                <p className="font-medium">{visit.purpose}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Service concerne</p>
                  <p className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {visit.service?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Personne rencontree</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {visit.person_to_meet || '-'}
                  </p>
                </div>
              </div>

              {visit.comments && (
                <div>
                  <p className="text-sm text-gray-500">Commentaires</p>
                  <p className="text-gray-700">{visit.comments}</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Facturation</h2>
              {!invoice && canManageInvoice && (
                <button onClick={() => setShowInvoiceForm(true)} className="btn-secondary text-sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter facturation
                </button>
              )}
            </div>
            <div className="card-body">
              {invoice ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Facturable</p>
                      <p className="font-medium">{invoice.is_billable ? 'Oui' : 'Non'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Montant</p>
                      <p className="font-medium text-gold-600">
                        {invoice.amount?.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' }) || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Statut paiement</p>
                      {getPaymentStatusBadge(invoice.payment_status)}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Statut service</p>
                      {getServiceStatusBadge(invoice.service_status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Date limite</p>
                      <p className="font-medium">
                        {invoice.deadline
                          ? format(new Date(invoice.deadline), 'dd/MM/yyyy', { locale: fr })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Delai</p>
                      <p className="font-medium">
                        {invoice.deadline && new Date(invoice.deadline) < new Date() ? (
                          <span className="text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            En retard
                          </span>
                        ) : (
                          <span className="text-emerald-600">Dans les delais</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucune facturation enregistree</p>
              )}
            </div>
          </div>

          {/* Follow-ups */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Suivi des demandes</h2>
              {canManageFollowUp && (
                <button onClick={() => setShowFollowUpForm(true)} className="btn-secondary text-sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Nouveau suivi
                </button>
              )}
            </div>
            <div className="card-body">
              {followUps.length > 0 ? (
                <div className="space-y-3">
                  {followUps.map((fu) => (
                    <div key={fu.id} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        {getServiceStatusBadge(fu.status)}
                        {getPriorityBadge(fu.priority)}
                      </div>
                      {fu.due_date && (
                        <p className="text-sm text-gray-500">
                          Echeance: {format(new Date(fu.due_date), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Aucun suivi enregistre</p>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Commentaires ({comments.length})
              </h2>
            </div>
            <div className="card-body space-y-4">
              {comments.length > 0 && (
                <div className="space-y-4">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary-700" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{(c as any).profile?.full_name || 'Utilisateur'}</p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                        <p className="text-gray-700">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddComment} className="flex gap-3">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="input flex-1"
                />
                <button type="submit" disabled={!newComment.trim()} className="btn-primary">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Visitor Info */}
          <div className="card">
            <div className="card-body">
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
                  <User className="w-8 h-8 text-primary-700" />
                </div>
                <h3 className="font-semibold text-lg">
                  {visit.visitor?.first_name} {visit.visitor?.last_name}
                </h3>
                <p className="text-sm text-gray-500">{visit.visitor?.company}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Type</span>
                  <span className="badge-gray">{getVisitorTypeLabel(visit.visitor?.visitor_type || 'other')}</span>
                </div>

                {visit.visitor?.phone && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${visit.visitor.phone}`} className="text-primary-700 hover:underline">
                      {visit.visitor.phone}
                    </a>
                  </div>
                )}

                {visit.visitor?.email && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${visit.visitor.email}`} className="text-primary-700 hover:underline text-sm">
                      {visit.visitor.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Actions rapides</h3>
            <div className="space-y-2">
              {canManageInvoice && invoice && (
                <Link to={`/invoices/${invoice.id}/edit`} className="btn-secondary w-full justify-start">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Modifier facturation
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Form Modal */}
      {showInvoiceForm && (
        <div className="modal-backdrop" onClick={() => setShowInvoiceForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Ajouter une facturation</h3>
            </div>
            <form onSubmit={handleAddInvoice} className="p-6 space-y-4">
              <div>
                <label className="label">Facturable</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={invoiceForm.is_billable}
                      onChange={() => setInvoiceForm((p) => ({ ...p, is_billable: true }))}
                      className="w-4 h-4"
                    />
                    Oui
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!invoiceForm.is_billable}
                      onChange={() => setInvoiceForm((p) => ({ ...p, is_billable: false }))}
                      className="w-4 h-4"
                    />
                    Non
                  </label>
                </div>
              </div>

              {invoiceForm.is_billable && (
                <>
                  <div>
                    <label className="label">Montant (XOF)</label>
                    <input
                      type="number"
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                      className="input"
                      min="0"
                      step="100"
                    />
                  </div>
                  <div>
                    <label className="label">Delai prevu (jours)</label>
                    <input
                      type="number"
                      value={invoiceForm.expected_duration_days}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, expected_duration_days: Number(e.target.value) }))}
                      className="input"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="label">Service responsable</label>
                    <select
                      value={invoiceForm.responsible_service_id}
                      onChange={(e) => setInvoiceForm((p) => ({ ...p, responsible_service_id: e.target.value }))}
                      className="input"
                    >
                      <option value="">Selectionnez...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowInvoiceForm(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follow-up Form Modal */}
      {showFollowUpForm && (
        <div className="modal-backdrop" onClick={() => setShowFollowUpForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Ajouter un suivi</h3>
            </div>
            <form onSubmit={handleAddFollowUp} className="p-6 space-y-4">
              <div>
                <label className="label">Statut</label>
                <select
                  value={followUpForm.status}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, status: e.target.value }))}
                  className="input"
                >
                  <option value="pending">En attente</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Termine</option>
                  <option value="blocked">Bloque</option>
                  <option value="late">En retard</option>
                </select>
              </div>
              <div>
                <label className="label">Priorite</label>
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
                <label className="label">Date echeance</label>
                <input
                  type="date"
                  value={followUpForm.due_date}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, due_date: e.target.value }))}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowFollowUpForm(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
