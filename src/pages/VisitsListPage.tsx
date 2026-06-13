import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, Visit, Service, VisitorType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Search,
  Plus,
  Filter,
  Download,
  Eye,
  Calendar,
  Clock,
  User,
  Building2,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';

export default function VisitsListPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    service: '',
    visitorType: '',
    dateFrom: '',
    dateTo: '',
    hasAppointment: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, perPage: 20, total: 0 });

  useEffect(() => {
    fetchServices();
    fetchVisits();
  }, [pagination.page, filters]);

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true);
    if (data) setServices(data);
  };

  const fetchVisits = async () => {
    setLoading(true);
    let query = supabase
      .from('visits')
      .select(
        `
        *,
        visitor:visitors(*),
        service:services(*)
      `,
        { count: 'exact' }
      )
      .order('arrival_time', { ascending: false });

    // Apply filters
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.service) query = query.eq('service_id', filters.service);
    if (filters.visitorType) query = query.eq('visitors.visitor_type', filters.visitorType);
    if (filters.hasAppointment) query = query.eq('has_appointment', filters.hasAppointment === 'yes');
    if (filters.dateFrom) query = query.gte('arrival_time', filters.dateFrom);
    if (filters.dateTo) query = query.lte('arrival_time', filters.dateTo);

    // Apply search
    if (searchQuery) {
      query = query.or(`visit_code.ilike.%${searchQuery}%,purpose.ilike.%${searchQuery}%`);
    }

    query = query.range(
      (pagination.page - 1) * pagination.perPage,
      pagination.page * pagination.perPage - 1
    );

    const { data, error, count } = await query;
    if (!error && data) {
      // Filter by visitor type client-side due to join
      const filtered = filters.visitorType
        ? data.filter((v: any) => v.visitor?.visitor_type === filters.visitorType)
        : data;
      setVisits(filtered);
      setPagination((p) => ({ ...p, total: count || 0 }));
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchVisits();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      service: '',
      visitorType: '',
      dateFrom: '',
      dateTo: '',
      hasAppointment: '',
    });
    setSearchQuery('');
  };

  const getStatusBadge = (status: string) => {
    const config = {
      in_progress: { label: 'En cours', class: 'badge-info', icon: Clock },
      completed: { label: 'Termine', class: 'badge-success', icon: CheckCircle },
      cancelled: { label: 'Annule', class: 'badge-danger', icon: XCircle },
    };
    const { label, class: cls, icon: Icon } = config[status as keyof typeof config] || {
      label: status,
      class: 'badge-gray',
      icon: Clock,
    };
    return (
      <span className={`${cls} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
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

  const totalPages = Math.ceil(pagination.total / pagination.perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Visites</h1>
          <p className="text-gray-500">Liste et suivi de toutes les visites</p>
        </div>
        <Link to="/visits/new" className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Nouvelle visite
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="p-4 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par code, motif, visiteur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary ${showFilters ? 'bg-primary-50 border-primary-300' : ''}`}
            >
              <Filter className="w-5 h-5 mr-2" />
              Filtres
            </button>
            <button type="submit" className="btn-primary">
              Rechercher
            </button>
          </form>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="label">Statut</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="input"
                >
                  <option value="">Tous</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Termine</option>
                  <option value="cancelled">Annule</option>
                </select>
              </div>
              <div>
                <label className="label">Service</label>
                <select
                  value={filters.service}
                  onChange={(e) => handleFilterChange('service', e.target.value)}
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
                <label className="label">Type visiteur</label>
                <select
                  value={filters.visitorType}
                  onChange={(e) => handleFilterChange('visitorType', e.target.value)}
                  className="input"
                >
                  <option value="">Tous</option>
                  <option value="client">Client</option>
                  <option value="prospect">Prospect</option>
                  <option value="supplier">Fournisseur</option>
                  <option value="partner">Partenaire</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div>
                <label className="label">Rendez-vous</label>
                <select
                  value={filters.hasAppointment}
                  onChange={(e) => handleFilterChange('hasAppointment', e.target.value)}
                  className="input"
                >
                  <option value="">Tous</option>
                  <option value="yes">Avec RDV</option>
                  <option value="no">Sans RDV</option>
                </select>
              </div>
              <div>
                <label className="label">Du</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Au</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="input"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button type="button" onClick={clearFilters} className="btn-secondary">
                  Reinitialiser
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {pagination.total} visite(s) trouvee(s)
        </p>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </button>
        </div>
      </div>

      {/* Visits Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : visits.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune visite trouvee</h3>
          <p className="text-gray-500 mb-4">Commencez par enregistrer une nouvelle visite</p>
          <Link to="/visits/new" className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Nouvelle visite
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Visiteur</th>
                  <th>Type</th>
                  <th>Motif</th>
                  <th>Service</th>
                  <th>Arrivee</th>
                  <th>Depart</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/visits/${visit.id}`)}>
                    <td className="font-mono text-sm font-medium text-primary-700">
                      {visit.visit_code}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-primary-700" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {visit.visitor?.first_name} {visit.visitor?.last_name}
                          </p>
                          {visit.visitor?.company && (
                            <p className="text-xs text-gray-500">{visit.visitor.company}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-gray">{getVisitorTypeLabel(visit.visitor?.visitor_type || 'other')}</span>
                    </td>
                    <td className="max-w-xs truncate">{visit.purpose}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{visit.service?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="text-sm">
                      <p>{format(new Date(visit.arrival_time), 'dd/MM/yyyy')}</p>
                      <p className="text-gray-500">{format(new Date(visit.arrival_time), 'HH:mm')}</p>
                    </td>
                    <td className="text-sm">
                      {visit.departure_time ? (
                        <>
                          <p>{format(new Date(visit.departure_time), 'dd/MM/yyyy')}</p>
                          <p className="text-gray-500">{format(new Date(visit.departure_time), 'HH:mm')}</p>
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>{getStatusBadge(visit.status)}</td>
                    <td>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Link
                          to={`/visits/${visit.id}`}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Voir details"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </Link>
                        {visit.status === 'in_progress' && (
                          <button
                            onClick={async () => {
                              await supabase
                                .from('visits')
                                .update({ departure_time: new Date().toISOString(), status: 'completed' })
                                .eq('id', visit.id);
                              fetchVisits();
                            }}
                            className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
                            title="Marquer le depart"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Page {pagination.page} sur {totalPages || 1}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page === 1}
                className="btn-secondary"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(totalPages, p.page + 1) }))}
                disabled={pagination.page >= totalPages}
                className="btn-secondary"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
