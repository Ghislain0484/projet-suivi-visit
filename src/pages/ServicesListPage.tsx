import React, { useEffect, useState } from 'react';
import { supabase, Service, Profile, Visit } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Building2,
  Plus,
  Edit,
  Users,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Settings,
  Search,
  X,
  Save,
  Loader2,
  UserCog,
} from 'lucide-react';

export default function ServicesListPage() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceStats, setServiceStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    manager_id: '',
    is_active: true,
  });

  useEffect(() => {
    fetchServices();
    fetchUsers();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setServices(data);
      // Fetch stats for each service
      const stats: Record<string, any> = {};
      for (const service of data) {
        const { count: visitCount } = await supabase
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .eq('service_id', service.id);

        const { count: pendingCount } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('responsible_service_id', service.id)
          .eq('service_status', 'pending');

        const { count: lateCount } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('responsible_service_id', service.id)
          .in('service_status', ['late', 'blocked']);

        stats[service.id] = {
          visitCount: visitCount || 0,
          pendingCount: pendingCount || 0,
          lateCount: lateCount || 0,
        };
      }
      setServiceStats(stats);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true);
    if (data) setUsers(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingService) {
      await supabase
        .from('services')
        .update({
          name: form.name,
          description: form.description || null,
          manager_id: form.manager_id || null,
          is_active: form.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingService.id);
    } else {
      await supabase.from('services').insert({
        name: form.name,
        description: form.description || null,
        manager_id: form.manager_id || null,
        is_active: form.is_active,
      });
    }

    setShowForm(false);
    setEditingService(null);
    setForm({ name: '', description: '', manager_id: '', is_active: true });
    fetchServices();
  };

  const openEditForm = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description || '',
      manager_id: service.manager_id || '',
      is_active: service.is_active,
    });
    setShowForm(true);
  };

  const filteredServices = searchQuery
    ? services.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : services;

  const canManage = profile?.role === 'admin' || profile?.role === 'director';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des services</h1>
          <p className="text-gray-500">Configuration et suivi des services de GICO SARL</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditingService(null);
              setForm({ name: '', description: '', manager_id: '', is_active: true });
              setShowForm(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nouveau service
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => {
            const stats = serviceStats[service.id] || {};
            const manager = users.find((u) => u.id === service.manager_id);

            return (
              <div key={service.id} className="card hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary-100 rounded-lg">
                        <Building2 className="w-6 h-6 text-primary-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <span
                          className={`badge ${
                            service.is_active ? 'badge-success' : 'badge-gray'
                          }`}
                        >
                          {service.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => openEditForm(service)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                  </div>

                  {service.description && (
                    <p className="text-sm text-gray-500 mb-4">{service.description}</p>
                  )}

                  {manager && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                      <UserCog className="w-4 h-4 text-gray-400" />
                      <span>Responsable: {manager.full_name}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary-700">{stats.visitCount || 0}</p>
                      <p className="text-xs text-gray-500">Visites</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-600">{stats.pendingCount || 0}</p>
                      <p className="text-xs text-gray-500">En attente</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{stats.lateCount || 0}</p>
                      <p className="text-xs text-gray-500">En retard</p>
                    </div>
                  </div>

                  {(stats.lateCount > 0 || stats.pendingCount > 3) && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">
                        {stats.lateCount > 0
                          ? `${stats.lateCount} dossier(s) en retard`
                          : 'Plusieurs dossiers en attente'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingService ? 'Modifier le service' : 'Nouveau service'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nom du service *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="input"
                  required
                  placeholder="Ex: Service informatique"
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="input"
                  rows={3}
                  placeholder="Description du service..."
                />
              </div>

              <div>
                <label className="label">Responsable</label>
                <select
                  value={form.manager_id}
                  onChange={(e) => setForm((p) => ({ ...p, manager_id: e.target.value }))}
                  className="input"
                >
                  <option value="">Selectionnez un responsable</option>
                  {users
                    .filter((u) => u.role === 'service_manager' || u.role === 'admin')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="label">Statut</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.is_active}
                      onChange={() => setForm((p) => ({ ...p, is_active: true }))}
                      className="w-4 h-4"
                    />
                    Actif
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!form.is_active}
                      onChange={() => setForm((p) => ({ ...p, is_active: false }))}
                      className="w-4 h-4"
                    />
                    Inactif
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
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
