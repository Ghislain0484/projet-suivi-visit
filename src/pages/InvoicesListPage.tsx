import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Invoice, Service, Visit } from '../lib/supabase';
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
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';

export default function InvoicesListPage() {
  const { profile } = useAuth();
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
  const [stats, setStats] = useState({
    totalInvoiced: 0,
    totalPaid: 0,
    pendingCount: 0,
    lateCount: 0,
  });

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
    if (filters.payment_status) query = query.eq('payment_status', filters.payment_status);
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
        .filter((inv) => inv.payment_status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.amount), 0);
      const pendingCount = data.filter((inv) => inv.service_status === 'pending').length;
      const lateCount = data.filter((inv) => ['late', 'blocked'].includes(inv.service_status)).length;

      setStats({ totalInvoiced, totalPaid, pendingCount, lateCount });
    }
    setLoading(false);
  };

  const handleUpdateInvoice = async (invoiceId: string, updates: Partial<Invoice>) => {
    await supabase.from('invoices').update(updates).eq('id', invoiceId);
    setEditingInvoice(null);
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

  const canEdit = profile?.role === 'admin' || profile?.role === 'accounting' || profile?.role === 'director';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Module de Facturation</h1>
          <p className="text-gray-500">Suivi des facturations et paiements</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total facture</p>
              <p className="text-2xl font-bold text-gold-600">
                {stats.totalInvoiced.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' })}
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
              <p className="text-sm text-gray-500">Total encaisse</p>
              <p className="text-2xl font-bold text-emerald-600">
                {stats.totalPaid.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' })}
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
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pendingCount}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-6 h-6 text-amber-700" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">En retard</p>
              <p className="text-2xl font-bold text-red-700">{stats.lateCount}</p>
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
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary ${showFilters ? 'bg-primary-50 border-primary-300' : ''}`}
            >
              <Filter className="w-5 h-5 mr-2" />
              Filtres
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="label">Statut paiement</label>
                <select
                  value={filters.payment_status}
                  onChange={(e) => setFilters((p) => ({ ...p, payment_status: e.target.value }))}
                  className="input"
                >
                  <option value="">Tous</option>
                  <option value="not_invoiced">Non facture</option>
                  <option value="invoiced">Facture</option>
                  <option value="paid">Paye</option>
                  <option value="partially_paid">Part. paye</option>
                  <option value="cancelled">Annule</option>
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
                  <option value="completed">Termine</option>
                  <option value="blocked">Bloque</option>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune facturation trouvee</h3>
          <p className="text-gray-500">Les facturations sont creees depuis les details des visites</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Visite</th>
                  <th>Visiteur</th>
                  <th>Montant</th>
                  <th>Statut paiement</th>
                  <th>Statut service</th>
                  <th>Service</th>
                  <th>Delai</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
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
                        <p className="font-medium">
                          {(invoice as any).visit?.visitor?.first_name} {(invoice as any).visit?.visitor?.last_name}
                        </p>
                        {(invoice as any).visit?.visitor?.company && (
                          <p className="text-xs text-gray-500">{(invoice as any).visit?.visitor?.company}</p>
                        )}
                      </div>
                    </td>
                    <td className="font-medium">
                      {invoice.is_billable
                        ? Number(invoice.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' })
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
                        {canEdit && (
                          <button
                            onClick={() => setEditingInvoice(invoice)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingInvoice && (
        <div className="modal-backdrop" onClick={() => setEditingInvoice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Modifier la facturation</h3>
              <button onClick={() => setEditingInvoice(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
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
                  <option value="not_invoiced">Non facture</option>
                  <option value="invoiced">Facture</option>
                  <option value="paid">Paye</option>
                  <option value="partially_paid">Partiellement paye</option>
                  <option value="cancelled">Annule</option>
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
                  <option value="completed">Termine</option>
                  <option value="blocked">Bloque</option>
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
    </div>
  );
}
