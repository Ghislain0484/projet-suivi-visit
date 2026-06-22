import React, { useEffect, useState } from 'react';
import { supabase, Profile, Service, UserRole } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  UserPlus,
  Search,
  Edit,
  X,
  Save,
  UserCog,
  Building2,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  MapPin,
} from 'lucide-react';

export default function UsersListPage() {
  const { profile } = useAuth();

  const [users, setUsers] = useState<Profile[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'reception' as UserRole,
    service_id: '',
    phone: '',
    is_active: true,
    branch: 'Siège (Bonoua)',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchServices();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*');
    if (data) setServices(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingUser) {
        // Update existing user profile
        await supabase
          .from('profiles')
          .update({
            full_name: form.full_name,
            role: form.role,
            service_id: form.service_id || null,
            phone: form.phone || null,
            is_active: form.is_active,
            branch: form.branch,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingUser.id);
      } else {
        // Create new user with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: authData.user.id,
            email: form.email,
            full_name: form.full_name,
            role: form.role,
            service_id: form.service_id || null,
            phone: form.phone || null,
            is_active: form.is_active,
            branch: form.branch,
          });
          if (profileError) throw profileError;
        }
      }

      setShowForm(false);
      setEditingUser(null);
      setForm({
        email: '',
        full_name: '',
        role: 'reception',
        service_id: '',
        phone: '',
        is_active: true,
        branch: 'Siège (Bonoua)',
        password: '',
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const openEditForm = (user: Profile) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      service_id: user.service_id || '',
      phone: user.phone || '',
      is_active: user.is_active,
      branch: (user as any).branch || 'Siège (Bonoua)',
      password: '',
    });
    setShowForm(true);
  };

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      admin: 'Administrateur',
      director: 'Directeur General',
      reception: 'Reception',
      service_manager: 'Responsable Service',
      accounting: 'Comptabilite',
      cashier: 'Caissier / Caisse',
      collaborator: 'Collaborateur',
      nurse: 'Infirmier / Santé',
      lawyer: 'Juriste Externe',
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      admin: 'bg-red-100 text-red-700',
      director: 'bg-primary-100 text-primary-700',
      service_manager: 'bg-purple-100 text-purple-700',
      accounting: 'bg-gold-100 text-gold-700',
      reception: 'bg-gray-100 text-gray-700',
      cashier: 'bg-emerald-100 text-emerald-700',
      collaborator: 'bg-indigo-100 text-indigo-700',
      nurse: 'bg-teal-100 text-teal-700',
      lawyer: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400 border border-cyan-200/20',
    };
    return colors[role] || colors.reception;
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-gray-500">Administrer les comptes utilisateurs</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setForm({
              email: '',
              full_name: '',
              role: 'reception',
              service_id: '',
              phone: '',
              is_active: true,
              branch: 'Siège (Bonoua)',
              password: '',
            });
            setShowForm(true);
          }}
          className="btn-primary"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Nouvel utilisateur
        </button>
      </div>

      {/* Search and Filter */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input sm:w-48"
          >
            <option value="">Tous les roles</option>
            <option value="admin">Administrateur</option>
            <option value="director">Directeur</option>
            <option value="service_manager">Responsable</option>
            <option value="accounting">Comptabilite</option>
            <option value="cashier">Caissier / Caisse</option>
            <option value="reception">Reception</option>
            <option value="collaborator">Collaborateur</option>
            <option value="nurse">Infirmier</option>
            <option value="lawyer">Juriste Externe</option>
          </select>
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <div key={user.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <UserCog className="w-6 h-6 text-primary-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{user.full_name}</h3>
                    <span className={`badge ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span>
                  </div>
                </div>
                {!(profile?.role === 'director' && user.role === 'admin') && (
                  <button
                    onClick={() => openEditForm(user)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user.service_id && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span>{services.find((s) => s.id === user.service_id)?.name || 'N/A'}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>Site: {(user as any).branch || 'Siège (Bonoua)'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span
                  className={`badge ${user.is_active ? 'badge-success' : 'badge-gray'}`}
                >
                  {user.is_active ? 'Actif' : 'Inactif'}
                </span>
                <span className="text-xs text-gray-500">
                  Cree le {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: fr })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingUser ? 'Modifier utilisateur' : 'Nouvel utilisateur'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingUser && (
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
              )}

              <div>
                <label className="label">Nom complet *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  className="input"
                  required
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="label">Mot de passe *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="input"
                    required
                    minLength={6}
                  />
                </div>
              )}

              <div>
                <label className="label">Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                  className="input"
                  required
                >
                  {profile?.role === 'admin' && <option value="admin">Administrateur</option>}
                  <option value="director">Directeur General</option>
                  <option value="service_manager">Responsable Service</option>
                  <option value="accounting">Comptabilite</option>
                  <option value="cashier">Caissier / Caisse</option>
                  <option value="reception">Reception</option>
                  <option value="collaborator">Collaborateur</option>
                  <option value="nurse">Infirmier / Santé</option>
                  <option value="lawyer">Juriste Externe</option>
                </select>
              </div>

              <div>
                <label className="label">Service</label>
                <select
                  value={form.service_id}
                  onChange={(e) => setForm((p) => ({ ...p, service_id: e.target.value }))}
                  className="input"
                >
                  <option value="">Aucun service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Succursale / Site *</label>
                <select
                  value={form.branch}
                  onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="Siège (Bonoua)">Siège (Bonoua)</option>
                  <option value="GICO 8 Kilos">GICO 8 Kilos</option>
                  <option value="GICO MOROKRO">GICO MOROKRO</option>
                  <option value="GICO ABOISSO COMOE">GICO ABOISSO COMOE</option>
                </select>
              </div>

              <div>
                <label className="label">Telephone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Statut</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.is_active}
                      onChange={() => setForm((p) => ({ ...p, is_active: true }))}
                      disabled={profile?.role === 'director'}
                      className="w-4 h-4"
                    />
                    <span className="text-sm flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Actif
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!form.is_active}
                      onChange={() => setForm((p) => ({ ...p, is_active: false }))}
                      disabled={profile?.role === 'director'}
                      className="w-4 h-4"
                    />
                    <span className="text-sm flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-gray-400" />
                      Inactif
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
