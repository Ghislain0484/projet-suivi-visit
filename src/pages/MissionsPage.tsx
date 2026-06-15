import React, { useEffect, useState } from 'react';
import { supabase, Mission, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import {
  Briefcase,
  MapPin,
  Plus,
  X,
  Save,
  CheckCircle2,
  Trash2,
  Sparkles,
  Loader2,
  User,
} from 'lucide-react';

export default function MissionsPage() {
  const { user, profile } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form state for creating a mission
  const [form, setForm] = useState({
    user_id: '',
    destination: '',
    purpose: '',
    departure_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    expected_return: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  useEffect(() => {
    fetchMissionsData();
  }, [user, profile]);

  const fetchMissionsData = async () => {
    setLoading(true);
    await Promise.all([
      fetchMissions(),
      fetchCollaborators(),
    ]);
    setLoading(false);
  };

  const fetchMissions = async () => {
    let query = supabase.from('missions').select(`
      *,
      profile:profiles(*)
    `).order('departure_time', { ascending: false });

    // Collaborators only see their own missions
    if (profile && profile.role === 'collaborator') {
      query = query.eq('user_id', profile.id);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMissions(data as any);
    }
  };

  const fetchCollaborators = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true });
    if (data) setCollaborators(data);
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from('missions').insert({
        user_id: form.user_id || user?.id,
        destination: form.destination,
        purpose: form.purpose,
        departure_time: new Date(form.departure_time).toISOString(),
        expected_return: new Date(form.expected_return).toISOString(),
        status: 'planned',
      });

      if (error) throw error;

      setShowModal(false);
      setForm({
        user_id: '',
        destination: '',
        purpose: '',
        departure_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        expected_return: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
      fetchMissions();
    } catch (err: any) {
      alert(err.message || "Erreur de création de mission");
    } finally {
      setSaving(false);
    }
  };

  const handleStartMission = async (missionId: string) => {
    // Simulate GPS coordinates
    let gpsCoords = "5.3562, -4.0083"; // Abidjan Cocody mockup
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        gpsCoords = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      });
    }

    const { error } = await supabase
      .from('missions')
      .update({
        status: 'in_progress',
        gps_coordinates: gpsCoords,
        updated_at: new Date().toISOString(),
      })
      .eq('id', missionId);

    if (!error) fetchMissions();
  };

  const handleCompleteMission = async (missionId: string) => {
    let gpsCoords = "5.3562, -4.0083"; // Abidjan Cocody mockup
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        gpsCoords = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      });
    }

    const { error } = await supabase
      .from('missions')
      .update({
        status: 'completed',
        actual_return: new Date().toISOString(),
        gps_coordinates: gpsCoords,
        updated_at: new Date().toISOString(),
      })
      .eq('id', missionId);

    if (!error) fetchMissions();
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette mission ?")) return;
    const { error } = await supabase.from('missions').delete().eq('id', missionId);
    if (!error) fetchMissions();
  };

  const canCreate = profile && ['admin', 'reception', 'director', 'service_manager'].includes(profile.role);

  const getStatusBadge = (status: string) => {
    const config = {
      planned: { label: 'Prévue', class: 'badge-gray' },
      in_progress: { label: 'En cours', class: 'badge-warning' },
      completed: { label: 'Terminée', class: 'badge-success' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={`badge ${current.class}`}>{current.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Activités & Déplacements
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Gestion des Missions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Planifier et suivre les déplacements professionnels hors site des collaborateurs
          </p>
        </div>

        {canCreate && (
          <button onClick={() => setShowModal(true)} className="btn-primary shrink-0">
            <Plus className="w-4.5 h-4.5 mr-2" />
            Créer une mission
          </button>
        )}
      </div>

      {/* Missions Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner h-8 w-8"></div>
        </div>
      ) : missions.length === 0 ? (
        <div className="card p-16 text-center">
          <Briefcase className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Aucune mission enregistrée</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Toutes les missions professionnelles s'afficheront ici.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {missions.map((m) => {
            const isOwner = user && m.user_id === user.id;
            return (
              <div key={m.id} className="card p-6 flex flex-col justify-between relative overflow-hidden group">
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between">
                    <span className="badge-gray flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {m.destination}
                    </span>
                    {getStatusBadge(m.status)}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-base leading-snug">{m.purpose}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-2">
                      <User className="w-4 h-4 text-slate-400" />
                      Collaborateur : <span className="font-bold text-slate-600 dark:text-slate-300">{(m as any).profile?.full_name || 'N/A'}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Départ</span>
                      <span className="font-extrabold">{format(new Date(m.departure_time), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Retour Prévu</span>
                      <span className="font-extrabold">{format(new Date(m.expected_return), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                  </div>

                  {m.gps_coordinates && (
                    <div className="text-[10px] bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      Position GPS : <span className="font-mono text-slate-500">{m.gps_coordinates}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 justify-end">
                  {/* Start Mission Button */}
                  {isOwner && m.status === 'planned' && (
                    <button
                      onClick={() => handleStartMission(m.id)}
                      className="btn-primary py-2 px-4 text-xs rounded-xl flex items-center gap-1.5"
                    >
                      <MapPin className="w-4 h-4" />
                      Démarrer (GPS)
                    </button>
                  )}

                  {/* Complete Mission Button */}
                  {isOwner && m.status === 'in_progress' && (
                    <button
                      onClick={() => handleCompleteMission(m.id)}
                      className="btn-success py-2 px-4 text-xs rounded-xl flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Terminer (GPS)
                    </button>
                  )}

                  {/* Delete Mission Button */}
                  {canCreate && (
                    <button
                      onClick={() => handleDeleteMission(m.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors"
                      title="Supprimer la mission"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Mission Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Nouvelle Mission Terrain</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMission} className="p-6 space-y-4">
              <div>
                <label className="label">Collaborateur concerné *</label>
                <select
                  value={form.user_id}
                  onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">-- Choisir un agent --</option>
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Destination / Lieu *</label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))}
                  className="input"
                  placeholder="Ex: Chantier Cocody, Cadastre de Bingerville"
                  required
                />
              </div>

              <div>
                <label className="label">Objet / But de la mission *</label>
                <textarea
                  value={form.purpose}
                  onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                  className="input min-h-[90px]"
                  placeholder="Détaillez les tâches ou objectifs hors site..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Départ Prévu *</label>
                  <input
                    type="datetime-local"
                    value={form.departure_time}
                    onChange={(e) => setForm((p) => ({ ...p, departure_time: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Retour Estimé *</label>
                  <input
                    type="datetime-local"
                    value={form.expected_return}
                    onChange={(e) => setForm((p) => ({ ...p, expected_return: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-6 border-t border-slate-100 dark:border-slate-800/80">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs px-5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Créer la mission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
