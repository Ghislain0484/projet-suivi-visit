import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Invoice, Service } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CreditCard,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  X,
  Save,
  Printer,
  Trash2,
} from 'lucide-react';

export default function InvoicesListPage() {
  const { user, profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    payment_status: '',
    service_status: '',
    service_id: '',
    is_billable: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  
  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);

  // Print states
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

  const [stats, setStats] = useState({
    totalInvoiced: 0,
    totalPaid: 0,
    totalRemaining: 0,
    pendingCount: 0,
    lateCount: 0,
  });

  const handlePrintInvoice = async (invoice: Invoice) => {
    try {
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select(`*, service_item:service_items(*)`)
        .eq('invoice_id', invoice.id);
      
      if (!error && items) {
        setInvoiceItems(items);
      } else {
        setInvoiceItems([]);
      }
      setSelectedInvoiceForPrint(invoice);
      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err) {
      console.error("Error preparing print:", err);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchInvoices();
  }, [filters, searchQuery]);

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    if (data) setServices(data);
  };

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase
      .from('invoices')
      .select(
        `
        *,
        visit:visits(
          *,
          visitor:visitors(*)
        ),
        responsible_service:services!invoices_responsible_service_id_fkey(name)
      `
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.payment_status === 'unresolved') {
      query = query.in('payment_status', ['invoiced', 'partially_paid']);
    } else if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }
    if (filters.service_status) query = query.eq('service_status', filters.service_status);
    if (filters.service_id) query = query.eq('responsible_service_id', filters.service_id);
    if (filters.is_billable) query = query.eq('is_billable', filters.is_billable === 'yes');

    const { data, error } = await query;
    if (!error && data) {
      // Filter by search query
      const filtered = searchQuery
        ? data.filter((inv: any) =>
            inv.visit?.visit_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.visit?.visitor?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.visit?.visitor?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : data;
      setInvoices(filtered);

      // Calculate stats
      const totalInvoiced = data
        .filter((inv) => inv.is_billable)
        .reduce((sum, inv) => sum + Number(inv.amount), 0);
      const totalPaid = data
        .filter((inv) => inv.is_billable)
        .reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0);
      const totalRemaining = totalInvoiced - totalPaid;
      const pendingCount = data.filter((inv) => inv.service_status === 'pending').length;
      const lateCount = data.filter((inv) => ['late', 'blocked'].includes(inv.service_status)).length;

      setStats({ totalInvoiced, totalPaid, totalRemaining, pendingCount, lateCount });
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    if (invoices.length === 0) return;
    const headers = ['Code Visite', 'Visiteur Prenom', 'Visiteur Nom', 'Service Responsable', 'Montant Total', 'Montant Paye', 'Reste a Solder', 'Statut Paiement', 'Statut Prestation', 'Date Facture'];
    const rows = invoices.map((inv) => [
      inv.visit?.visit_code || '',
      inv.visit?.visitor?.first_name || '',
      inv.visit?.visitor?.last_name || '',
      (inv as any).responsible_service?.name || '',
      inv.amount || 0,
      inv.amount_paid || 0,
      (inv.amount || 0) - (inv.amount_paid || 0),
      inv.payment_status,
      inv.service_status,
      inv.invoice_date || ''
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GICO_Factures_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateInvoice = async (invoiceId: string, updates: Partial<Invoice>) => {
    await supabase.from('invoices').update(updates).eq('id', invoiceId);
    setEditingInvoice(null);
    fetchInvoices();
  };

  const handleDeleteInvoice = async (invoiceId: string, visitCode: string) => {
    if (window.confirm(`Voulez-vous vraiment supprimer définitivement la facturation pour la visite "${visitCode}" ?`)) {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) {
        alert(`Erreur lors de la suppression : ${error.message}`);
      } else {
        fetchInvoices();
      }
    }
  };

  const handleRecordQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || !user) return;

    const invoice = selectedInvoiceForPayment;
    const newPaid = Number(invoice.amount_paid || 0) + paymentAmount;
    const isPaid = newPaid >= Number(invoice.amount);
    const paymentStatus = isPaid ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'invoiced');

    const { error } = await supabase
      .from('invoices')
      .update({
        amount_paid: newPaid,
        payment_status: paymentStatus,
        invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (!error) {
      // Log payment activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'RECORD_PAYMENT',
        entity_type: 'invoice',
        entity_id: invoice.id,
        details: { amountPaid: paymentAmount, totalPaid: newPaid },
      });
      
      // Auto-create a comment indicating the payment
      await supabase.from('comments').insert({
        visit_id: invoice.visit_id,
        user_id: user.id,
        content: `💳 Encaissement rapide enregistré : ${paymentAmount.toLocaleString('fr-FR')} XOF versés. Nouveau solde payé : ${newPaid.toLocaleString('fr-FR')} XOF / ${Number(invoice.amount).toLocaleString('fr-FR')} XOF.`,
      });
    }

    setShowPaymentModal(false);
    setSelectedInvoiceForPayment(null);
    setPaymentAmount(0);
    fetchInvoices();
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      not_invoiced: { label: 'Non facture', class: 'bg-gray-100 text-gray-700' },
      invoiced: { label: 'Facture', class: 'bg-blue-100 text-blue-700' },
      paid: { label: 'Paye', class: 'bg-emerald-100 text-emerald-700' },
      partially_paid: { label: 'Part. paye', class: 'bg-amber-100 text-amber-700' },
      cancelled: { label: 'Annule', class: 'bg-red-100 text-red-700' },
    };
    const { label, class: cls } = config[status as keyof typeof config] || {
      label: status,
      class: 'bg-gray-100 text-gray-700',
    };
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  const getServiceStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', class: 'bg-gray-100 text-gray-700' },
      in_progress: { label: 'En cours', class: 'bg-blue-100 text-blue-700' },
      completed: { label: 'Termine', class: 'bg-emerald-100 text-emerald-700' },
      blocked: { label: 'Bloque', class: 'bg-red-100 text-red-700' },
      late: { label: 'En retard', class: 'bg-amber-100 text-amber-700' },
    };
    const { label, class: cls } = config[status as keyof typeof config] || {
      label: status,
      class: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`badge ${cls} flex items-center gap-1`}>
        {status === 'late' || status === 'blocked' ? <AlertTriangle className="w-3 h-3" /> : null}
        {label}
      </span>
    );
  };

  const canEdit = profile && ['admin', 'director', 'accounting', 'service_manager'].includes(profile.role);
  const canRecordPayment = profile && ['admin', 'director', 'accounting', 'cashier', 'service_manager'].includes(profile.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Module de Facturation</h1>
          <p className="text-gray-500">Suivi des facturations, encaissements et caisse</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total facturé</p>
              <p className="text-2xl font-bold text-gold-600">
                {stats.totalInvoiced.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 bg-gold-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-gold-700" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total encaissé</p>
              <p className="text-2xl font-bold text-emerald-600">
                {stats.totalPaid.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Reste à solder</p>
              <p className="text-2xl font-bold text-amber-600">
                {stats.totalRemaining.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-amber-700" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Prestations en retard / attente</p>
              <p className="text-xl font-bold text-red-700">
                {stats.lateCount} retards / {stats.pendingCount} attentes
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par code, visiteur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn-secondary ${showFilters ? 'bg-primary-50 border-primary-300' : ''}`}
              >
                <Filter className="w-5 h-5 mr-2" />
                Filtres
              </button>
              <button
                onClick={exportToCSV}
                className="btn-secondary"
              >
                <Download className="w-5 h-5 mr-2" />
                Exporter CSV
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg dark:bg-slate-900">
              <div>
                <label className="label">Statut paiement</label>
                <select
                  value={filters.payment_status}
                  onChange={(e) => setFilters((p) => ({ ...p, payment_status: e.target.value }))}
                  className="input"
                >
                  <option value="">Tous</option>
                  <option value="unresolved">À solder (Facturé / Part. payé)</option>
                  <option value="not_invoiced">Non facturé</option>
                  <option value="invoiced">Facturé</option>
                  <option value="paid">Payé</option>
                  <option value="partially_paid">Part. payé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
              <div>
                <label className="label">Statut service</label>
                <select
                  value={filters.service_status}
                  onChange={(e) => setFilters((p) => ({ ...p, service_status: e.target.value }))}
                  className="input"
                >
                  <option value="">Tous</option>
                  <option value="pending">En attente</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminé</option>
                  <option value="blocked">Bloqué</option>
                  <option value="late">En retard</option>
                </select>
              </div>
              <div>
                <label className="label">Service</label>
                <select
                  value={filters.service_id}
                  onChange={(e) => setFilters((p) => ({ ...p, service_id: e.target.value }))}
                  className="input"
                >
                  <option value="">Tous les services</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Facturable</label>
                <select
                  value={filters.is_billable}
                  onChange={(e) => setFilters((p) => ({ ...p, is_billable: e.target.value }))}
                  className="input"
                >
                  <option value="">Tous</option>
                  <option value="yes">Oui</option>
                  <option value="no">Non</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune facturation trouvée</h3>
          <p className="text-gray-500 font-medium text-sm">Les facturations sont créées depuis les détails des visites</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Visite</th>
                  <th>Visiteur</th>
                  <th>Total Facturé</th>
                  <th>Encaissé</th>
                  <th>Reste</th>
                  <th>Statut paiement</th>
                  <th>Statut service</th>
                  <th>Service</th>
                  <th>Délai</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const remaining = Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid || 0));
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <Link
                          to={`/visits/${invoice.visit_id}`}
                          className="text-primary-700 hover:underline font-mono text-sm"
                        >
                          {(invoice as any).visit?.visit_code || 'N/A'}
                        </Link>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">
                            {(invoice as any).visit?.visitor?.first_name} {(invoice as any).visit?.visitor?.last_name}
                          </p>
                          {(invoice as any).visit?.visitor?.company && (
                            <p className="text-xs text-gray-500">{(invoice as any).visit?.visitor?.company}</p>
                          )}
                        </div>
                      </td>
                      <td className="font-medium">
                        {invoice.is_billable
                          ? Number(invoice.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })
                          : '-'}
                      </td>
                      <td className="font-medium text-emerald-600">
                        {invoice.is_billable
                          ? Number(invoice.amount_paid || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })
                          : '-'}
                      </td>
                      <td className={`font-medium ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {invoice.is_billable
                          ? remaining.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 })
                          : '-'}
                      </td>
                      <td>{getPaymentStatusBadge(invoice.payment_status)}</td>
                      <td>{getServiceStatusBadge(invoice.service_status)}</td>
                      <td>{(invoice as any).responsible_service?.name || '-'}</td>
                      <td>
                        {invoice.deadline ? (
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-sm ${
                                new Date(invoice.deadline) < new Date() ? 'text-red-600' : 'text-gray-600'
                              }`}
                            >
                              {format(new Date(invoice.deadline), 'dd/MM/yyyy')}
                            </span>
                            {new Date(invoice.deadline) < new Date() && (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/visits/${invoice.visit_id}`}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Voir visite"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </Link>
                          {invoice.is_billable && (
                            <button
                              onClick={() => handlePrintInvoice(invoice)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                              title="Imprimer Facture / Reçu"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {invoice.is_billable && invoice.payment_status !== 'paid' && canRecordPayment && (
                            <button
                              onClick={() => {
                                setSelectedInvoiceForPayment(invoice);
                                setPaymentAmount(remaining);
                                setShowPaymentModal(true);
                              }}
                              className="p-2 hover:bg-emerald-50 rounded-lg transition-colors text-emerald-600"
                              title="Encaisser règlement"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => setEditingInvoice(invoice)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4 text-gray-600" />
                            </button>
                          )}
                          {profile && ['admin', 'director', 'service_manager'].includes(profile.role) && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id, (invoice as any).visit?.visit_code || '')}
                              className="p-2 hover:bg-rose-50 rounded-lg transition-colors text-slate-400 hover:text-rose-600"
                              title="Supprimer la facture"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingInvoice && (
        <div className="modal-backdrop" onClick={() => setEditingInvoice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Modifier la facturation</h3>
              <button onClick={() => setEditingInvoice(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                handleUpdateInvoice(editingInvoice.id, {
                  amount: Number(formData.get('amount')),
                  payment_status: formData.get('payment_status') as any,
                  service_status: formData.get('service_status') as any,
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="label">Montant (XOF)</label>
                <input
                  type="number"
                  name="amount"
                  defaultValue={editingInvoice.amount}
                  className="input"
                  min="0"
                  step="100"
                />
              </div>

              <div>
                <label className="label">Statut paiement</label>
                <select
                  name="payment_status"
                  defaultValue={editingInvoice.payment_status}
                  className="input"
                >
                  <option value="not_invoiced">Non facturé</option>
                  <option value="invoiced">Facturé</option>
                  <option value="paid">Payé</option>
                  <option value="partially_paid">Partiellement payé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>

              <div>
                <label className="label">Statut service</label>
                <select
                  name="service_status"
                  defaultValue={editingInvoice.service_status}
                  className="input"
                >
                  <option value="pending">En attente</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminé</option>
                  <option value="blocked">Bloqué</option>
                  <option value="late">En retard</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setEditingInvoice(null)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Payment Modal */}
      {showPaymentModal && selectedInvoiceForPayment && (
        <div className="modal-backdrop" onClick={() => { setShowPaymentModal(false); setSelectedInvoiceForPayment(null); }}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Enregistrer un règlement
              </h3>
              <button 
                onClick={() => { setShowPaymentModal(false); setSelectedInvoiceForPayment(null); }} 
                className="p-1.5 bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-500 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleRecordQuickPayment} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Facture Code</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{(selectedInvoiceForPayment as any).visit?.visit_code || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Visiteur</span>
                  <span className="text-slate-800 dark:text-white font-bold">
                    {(selectedInvoiceForPayment as any).visit?.visitor?.first_name} {(selectedInvoiceForPayment as any).visit?.visitor?.last_name}
                  </span>
                </div>
                <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Montant Total</span>
                  <span className="text-slate-800 dark:text-white font-extrabold">{Number(selectedInvoiceForPayment.amount).toLocaleString('fr-FR')} XOF</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Déjà réglé</span>
                  <span className="text-emerald-600 font-extrabold">{Number(selectedInvoiceForPayment.amount_paid || 0).toLocaleString('fr-FR')} XOF</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Solde restant</span>
                  <span className="text-rose-600 font-extrabold">
                    {Math.max(0, Number(selectedInvoiceForPayment.amount) - Number(selectedInvoiceForPayment.amount_paid || 0)).toLocaleString('fr-FR')} XOF
                  </span>
                </div>
              </div>

              <div>
                <label className="label">Montant du versement (XOF)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Math.max(0, Number(selectedInvoiceForPayment.amount) - Number(selectedInvoiceForPayment.amount_paid || 0))}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder="Entrez le montant versé..."
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => { setShowPaymentModal(false); setSelectedInvoiceForPayment(null); }} 
                  className="btn-secondary text-xs"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-success text-xs">
                  Valider le règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print only template */}
      {selectedInvoiceForPrint && (
        <div className="print-only p-8 max-w-4xl mx-auto bg-white text-black font-sans">
          <div className="flex justify-between items-start border-b-2 border-slate-300 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-800">GICO SARL</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Gestion & Intégration de Services Collaboratifs</p>
              <p className="text-xs text-slate-400 mt-2">RCCM: BF-OUA-2026-B-1234 | IFU: 00123456X</p>
              <p className="text-xs text-slate-400">Siège Social: Ouagadougou, Burkina Faso</p>
              <p className="text-xs text-slate-400">Tél: +226 25 30 00 00 | Email: contact@gico.bf</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                {selectedInvoiceForPrint.payment_status === 'paid' ? 'Reçu de Paiement' : 'Facture de Prestation'}
              </span>
              <p className="text-sm font-mono font-bold mt-4 text-slate-700">Code: {(selectedInvoiceForPrint as any).visit?.visit_code || 'N/A'}</p>
              <p className="text-xs text-slate-400 mt-1">
                Date: {format(new Date(selectedInvoiceForPrint.invoice_date || selectedInvoiceForPrint.created_at || Date.now()), 'dd/MM/yyyy', { locale: fr })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-400 uppercase tracking-wider mb-2">Facturé à</p>
              <p className="text-sm font-bold text-slate-800">
                {(selectedInvoiceForPrint as any).visit?.visitor?.first_name || ''} {(selectedInvoiceForPrint as any).visit?.visitor?.last_name || ''}
              </p>
              {(selectedInvoiceForPrint as any).visit?.visitor?.company && (
                <p className="font-semibold text-slate-500 mt-0.5">{(selectedInvoiceForPrint as any).visit?.visitor?.company}</p>
              )}
              {(selectedInvoiceForPrint as any).visit?.visitor?.phone && (
                <p className="text-slate-400 mt-2">Tél: {(selectedInvoiceForPrint as any).visit?.visitor?.phone}</p>
              )}
              {(selectedInvoiceForPrint as any).visit?.visitor?.email && (
                <p className="text-slate-400">Email: {(selectedInvoiceForPrint as any).visit?.visitor?.email}</p>
              )}
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <div>
                <p className="font-bold text-slate-400 uppercase tracking-wider mb-2">Détails de visite</p>
                <p className="font-semibold text-slate-700">Motif: {(selectedInvoiceForPrint as any).visit?.purpose || 'N/A'}</p>
                <p className="font-semibold text-slate-700">Service de traitement: {(selectedInvoiceForPrint as any).responsible_service?.name || '-'}</p>
              </div>
              <div>
                {((selectedInvoiceForPrint as any).visit?.arrival_time) && (
                  <p className="text-[10px] text-slate-400 mt-4">
                    Arrivée: {format(new Date((selectedInvoiceForPrint as any).visit.arrival_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                )}
                {((selectedInvoiceForPrint as any).visit?.departure_time) && (
                  <p className="text-[10px] text-slate-400">
                    Départ: {format(new Date((selectedInvoiceForPrint as any).visit.departure_time), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs mb-8">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 pr-4">Description Prestation</th>
                <th className="py-3 px-4 text-right">Prix Unitaire</th>
                <th className="py-3 px-4 text-center">Quantité</th>
                <th className="py-3 pl-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.length > 0 ? (
                invoiceItems.map((si, idx) => (
                  <tr key={idx} className="border-b border-slate-100 text-slate-700 font-medium">
                    <td className="py-3 pr-4 font-bold">{si.custom_name || si.service_item?.name || 'Prestation'}</td>
                    <td className="py-3 px-4 text-right">{(si.unit_price || 0).toLocaleString('fr-FR')} XOF</td>
                    <td className="py-3 px-4 text-center">{si.quantity}</td>
                    <td className="py-3 pl-4 text-right font-bold">{(si.total_price || 0).toLocaleString('fr-FR')} XOF</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-slate-100 text-slate-700 font-medium">
                  <td className="py-3 pr-4 font-bold">Frais de Prestation Générale</td>
                  <td className="py-3 px-4 text-right">{Number(selectedInvoiceForPrint.amount).toLocaleString('fr-FR')} XOF</td>
                  <td className="py-3 px-4 text-center">1</td>
                  <td className="py-3 pl-4 text-right font-bold">{Number(selectedInvoiceForPrint.amount).toLocaleString('fr-FR')} XOF</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-64 space-y-2.5 text-xs">
              <div className="flex justify-between font-semibold text-slate-500">
                <span>Montant Global:</span>
                <span className="text-slate-800">{Number(selectedInvoiceForPrint.amount).toLocaleString('fr-FR')} XOF</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-600">
                <span>Montant Versé:</span>
                <span>{Number(selectedInvoiceForPrint.amount_paid).toLocaleString('fr-FR')} XOF</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex justify-between font-black text-sm text-slate-800">
                <span>Reste à payer:</span>
                <span className={Number(selectedInvoiceForPrint.amount) - Number(selectedInvoiceForPrint.amount_paid) > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {Math.max(0, Number(selectedInvoiceForPrint.amount) - Number(selectedInvoiceForPrint.amount_paid)).toLocaleString('fr-FR')} XOF
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 text-center text-xs mt-16">
            <div className="border-t border-slate-300 pt-6">
              <p className="font-bold text-slate-400 uppercase tracking-wider mb-12">Le Client</p>
              <p className="italic text-slate-300">Bon pour accord & signature</p>
            </div>
            <div className="border-t border-slate-300 pt-6">
              <p className="font-bold text-slate-400 uppercase tracking-wider mb-12">La Caisse GICO</p>
              <p className="italic text-slate-300">Cachet & Signature</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
