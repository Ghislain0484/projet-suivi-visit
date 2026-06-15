import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, Visit, Service } from '../lib/supabase';
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
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
        visitor:visitors!inner(*),
        service:services(*)
      `,
        { count: 'exact' }
      )
      .order('arrival_time', { ascending: false });

    // Apply filters
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.service) query = query.eq('service_id', filters.service);
    if (filters.visitorType) query = query.eq('visitor.visitor_type', filters.visitorType);
    if (filters.hasAppointment) query = query.eq('has_appointment', filters.hasAppointment === 'yes');
    if (filters.dateFrom) query = query.gte('arrival_time', filters.dateFrom);
    if (filters.dateTo) query = query.lte('arrival_time', filters.dateTo);

    // Apply search
    if (searchQuery) {
      query = query.or(`visit_code.ilike.%${searchQuery}%,purpose.ilike.%${searchQuery}%,visitor.first_name.ilike.%${searchQuery}%,visitor.last_name.ilike.%${searchQuery}%,visitor.company.ilike.%${searchQuery}%`);
    }

    query = query.range(
      (pagination.page - 1) * pagination.perPage,
      pagination.page * pagination.perPage - 1
    );

    const { data, error, count } = await query;
    if (!error && data) {
      setVisits(data);
      setPagination((p) => ({ ...p, total: count || 0 }));
    } else if (error) {
      console.error("Error fetching visits:", error);
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
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Registre de suivi
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Gestion des Visites</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Liste complète et historique des visites enregistrées</p>
        </div>
        
        {/* New Visit Button */}
        {profile && ['admin', 'reception', 'director'].includes(profile.role) && (
          <Link 
            to="/visits/new" 
            className="btn-primary shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4.5 h-4.5 mr-2" />
            Nouvelle visite
          </Link>
        )}
      </div>

      {/* Search and Filters Section */}
      <div className="card">
        <div className="p-5 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher par code, motif de visite, nom de visiteur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-11"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`btn-secondary ${showFilters ? 'bg-primary-50 dark:bg-primary-950/20 border-primary-500/30 text-primary-600 dark:text-primary-400' : ''}`}
              >
                <Filter className="w-4.5 h-4.5 mr-2" />
                Filtres
              </button>
              <button type="submit" className="btn-primary px-6">
                Rechercher
              </button>
            </div>
          </form>

          {/* Collapsible filter pane */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5 bg-slate-50/70 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 animate-in fade-in slide-in-from-top-3 duration-200">
              <div>
                <label className="label">Statut</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="input"
                >
                  <option value="">Tous</option>
                  <option value="in_progress">En cours</option>
                  <option value="completed">Terminé</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
              
              <div>
                <label className="label">Service ciblé</label>
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
                <label className="label">Type de visiteur</label>
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
                <label className="label">Date de début</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Date de fin</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="input"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 flex justify-end gap-2 pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
                <button type="button" onClick={clearFilters} className="btn-secondary px-5 text-xs py-2">
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions & Count Info */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {pagination.total} {pagination.total > 1 ? 'visites trouvées' : 'visite trouvée'}
        </p>
        <button className="btn-secondary text-xs px-4 py-2 border border-slate-200 dark:border-slate-800">
          <Download className="w-4 h-4 mr-1.5" />
          Exporter CSV
        </button>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner h-8 w-8"></div>
        </div>
      ) : visits.length === 0 ? (
        <div className="card p-16 text-center">
          <Calendar className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Aucune visite trouvée</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Commencez par enregistrer le premier visiteur dans le registre.</p>
          {profile && ['admin', 'reception', 'director'].includes(profile.role) && (
            <Link to="/visits/new" className="btn-primary">
              <Plus className="w-4.5 h-4.5 mr-2" />
              Nouvelle visite
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container border-0 rounded-b-none">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Visiteur</th>
                  <th>Type</th>
                  <th>Motif</th>
                  <th>Service ciblé</th>
                  <th>Arrivée</th>
                  <th>Départ</th>
                  <th>Statut</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr 
                    key={visit.id} 
                    className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/30" 
                    onClick={() => navigate(`/visits/${visit.id}`)}
                  >
                    <td className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400">
                      {visit.visit_code}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900 flex items-center justify-center flex-shrink-0 border border-primary-100/10">
                          <User className="w-4 h-4 text-primary-700 dark:text-primary-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white">
                            {visit.visitor?.first_name} {visit.visitor?.last_name}
                          </p>
                          {visit.visitor?.company && (
                            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">{visit.visitor.company}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-gray">{getVisitorTypeLabel(visit.visitor?.visitor_type || 'other')}</span>
                    </td>
                    <td className="max-w-[200px] truncate font-medium">{visit.purpose}</td>
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
                    <td>
                      {visit.departure_time ? (
                        <div className="text-xs">
                          <p className="font-semibold text-slate-800 dark:text-white">
                            {format(new Date(visit.departure_time), 'dd/MM/yyyy')}
                          </p>
                          <p className="text-slate-400 dark:text-slate-500 font-medium mt-0.5">{format(new Date(visit.departure_time), 'HH:mm')}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 italic font-medium">En cours</span>
                      )}
                    </td>
                    <td>{getStatusBadge(visit.status)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link
                          to={`/visits/${visit.id}`}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                          title="Voir détails"
                        >
                          <Eye className="w-4.5 h-4.5" />
                        </Link>
                        {visit.status === 'in_progress' && profile && ['admin', 'reception', 'director'].includes(profile.role) && (
                          <button
                            onClick={async () => {
                              await supabase
                                .from('visits')
                                .update({ departure_time: new Date().toISOString(), status: 'completed' })
                                .eq('id', visit.id);
                              fetchVisits();
                            }}
                            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="Enregistrer le départ"
                          >
                            <CheckCircle className="w-4.5 h-4.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/10">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Page {pagination.page} sur {totalPages || 1}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page === 1}
                className="btn-secondary p-2.5 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(totalPages, p.page + 1) }))}
                disabled={pagination.page >= totalPages}
                className="btn-secondary p-2.5 rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
