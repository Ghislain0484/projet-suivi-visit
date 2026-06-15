import React, { useEffect, useState } from 'react';
import { supabase, MedicalRequest } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import {
  HeartPulse,
  Plus,
  X,
  Save,
  CheckCircle,
  Loader2,
  Stethoscope,
  Activity,
  UserCheck,
} from 'lucide-react';

export default function InfirmeriePage() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  // Form state for creating request
  const [form, setForm] = useState({
    request_type: 'consultation' as 'consultation' | 'sickness' | 'rest',
    symptoms: '',
  });

  // Nurse edit state
  const [selectedRequest, setSelectedRequest] = useState<MedicalRequest | null>(null);
  const [nurseForm, setNurseForm] = useState({
    nurse_opinion: '',
    prescription: '',
    rest_days_granted: 0,
    status: 'processed' as 'processed' | 'rejected',
  });

  useEffect(() => {
    fetchMedicalRequests();
  }, [user, profile]);

  const fetchMedicalRequests = async () => {
    setLoading(true);
    let query = supabase.from('medical_requests').select(`
      *,
      profile:profiles(*)
    `).order('created_at', { ascending: false });

    // Standard employees only see their own requests (enforced by RLS as well)
    if (profile && !['admin', 'nurse', 'director'].includes(profile.role)) {
      query = query.eq('user_id', profile.id);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRequests(data as any);
    }
    setLoading(false);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('medical_requests').insert({
        user_id: user.id,
        request_type: form.request_type,
        symptoms: form.symptoms,
        status: 'pending',
      });

      if (error) throw error;

      setShowModal(false);
      setForm({
        request_type: 'consultation',
        symptoms: '',
      });
      fetchMedicalRequests();
    } catch (err: any) {
      alert(err.message || "Erreur de création de demande");
    } finally {
      setSaving(false);
    }
  };

  const handleNurseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !profile) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('medical_requests')
        .update({
          nurse_opinion: nurseForm.nurse_opinion,
          prescription: nurseForm.prescription || null,
          rest_days_granted: Number(nurseForm.rest_days_granted),
          status: nurseForm.status,
          processed_by: profile.id,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      setSelectedRequest(null);
      fetchMedicalRequests();
    } catch (err: any) {
      alert(err.message || "Erreur de traitement");
    } finally {
      setSaving(false);
    }
  };

  const openNurseModal = (req: MedicalRequest) => {
    setSelectedRequest(req);
    setNurseForm({
      nurse_opinion: req.nurse_opinion || '',
      prescription: req.prescription || '',
      rest_days_granted: req.rest_days_granted || 0,
      status: (req.status === 'pending' ? 'processed' : req.status) as any,
    });
  };

  const isNurseOrAdmin = profile && ['admin', 'nurse', 'director'].includes(profile.role);

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', class: 'badge-warning' },
      processed: { label: 'Traité', class: 'badge-success' },
      rejected: { label: 'Avis Négatif', class: 'badge-danger' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={`badge ${current.class}`}>{current.label}</span>;
  };

  const getRequestTypeLabel = (type: string) => {
    const labels = {
      consultation: 'Demande Consultation',
      sickness: 'Déclaration Maladie',
      rest: 'Demande Repos / repos médical',
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-xs uppercase tracking-wider">
            <HeartPulse className="w-4 h-4" /> Infirmerie Interne GICO
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Espace Santé & Soins</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {isNurseOrAdmin ? 'Workspace Infirmier : Suivi médical et consultations' : 'Déclarer un problème de santé ou demander un repos médical'}
          </p>
        </div>

        {!isNurseOrAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary shrink-0">
            <Plus className="w-4.5 h-4.5 mr-2" />
            Déclarer un soin
          </button>
        )}
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner h-8 w-8"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main workspace table / list */}
          <div className="xl:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header bg-rose-50/10 border-b border-slate-100 dark:border-slate-800/80">
                <h2 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-5 h-5 text-rose-500" />
                  {isNurseOrAdmin ? 'Registre des consultations médicales' : 'Vos demandes médicales'}
                </h2>
              </div>
              <div className="card-body p-0">
                {requests.length === 0 ? (
                  <div className="text-center py-16">
                    <Stethoscope className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Aucune fiche médicale</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Tout est en ordre, aucun signalement de santé actif.</p>
                  </div>
                ) : (
                  <div className="table-container border-0 rounded-none shadow-none">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          {isNurseOrAdmin && <th>Employé</th>}
                          <th>Type</th>
                          <th>Symptômes</th>
                          <th>Statut</th>
                          {isNurseOrAdmin && <th className="text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((r) => (
                          <tr
                            key={r.id}
                            className={isNurseOrAdmin ? "cursor-pointer hover:bg-slate-50/50" : ""}
                            onClick={() => isNurseOrAdmin && openNurseModal(r)}
                          >
                            <td>{format(new Date(r.created_at), 'dd/MM/yyyy')}</td>
                            {isNurseOrAdmin && (
                              <td className="font-bold text-slate-800 dark:text-white">
                                {(r as any).profile?.full_name || 'N/A'}
                              </td>
                            )}
                            <td>
                              <span className="badge-primary text-[10px] font-black uppercase">
                                {getRequestTypeLabel(r.request_type)}
                              </span>
                            </td>
                            <td className="max-w-[200px] truncate">{r.symptoms}</td>
                            <td>{getStatusBadge(r.status)}</td>
                            {isNurseOrAdmin && (
                              <td className="text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openNurseModal(r);
                                  }}
                                  className="btn-secondary text-[10px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 ml-auto"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Traiter
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Information & Guidelines */}
          <div className="space-y-6">
            {/* Infirmerie guidelines card */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-2 text-rose-500">
                <HeartPulse className="w-6 h-6" />
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Charte de Confidentialité</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Conformément aux réglementations médicales en entreprise, les données de santé saisies ici sont strictement restreintes. Seuls l'infirmier agréé de GICO SARL et le pôle RH disposent d'un accès de consultation.
              </p>
              <div className="p-3.5 bg-rose-50/20 dark:bg-rose-950/10 rounded-2xl border border-rose-500/10 text-[11px] text-rose-700 dark:text-rose-300 font-semibold leading-relaxed">
                ℹ️ Tout arrêt maladie accordé via cette interface donne lieu à une mise à jour automatique du statut de l'employé dans le registre de présence RH.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee request form modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Déclarer un Soin / Consultation</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
              <div>
                <label className="label">Type de demande de soin *</label>
                <select
                  value={form.request_type}
                  onChange={(e) => setForm((p) => ({ ...p, request_type: e.target.value as any }))}
                  className="input"
                  required
                >
                  <option value="consultation">Demande Consultation Infirmerie</option>
                  <option value="sickness">Déclaration de Maladie (Symptômes)</option>
                  <option value="rest">Demande de repos médical</option>
                </select>
              </div>

              <div>
                <label className="label">Symptômes / Détail du problème *</label>
                <textarea
                  value={form.symptoms}
                  onChange={(e) => setForm((p) => ({ ...p, symptoms: e.target.value }))}
                  className="input min-h-[120px]"
                  placeholder="Décrivez brièvement vos symptômes ou le motif de consultation..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-6 border-t border-slate-100 dark:border-slate-800/80">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs px-5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Soumettre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nurse Evaluation Modal */}
      {selectedRequest && (
        <div className="modal-backdrop" onClick={() => setSelectedRequest(null)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Évaluation Médicale</h3>
              <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNurseSubmit} className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-slate-400 block uppercase">Détails patient & symptômes</p>
                <p className="text-xs font-extrabold text-slate-800 dark:text-white">Patient : {(selectedRequest as any).profile?.full_name}</p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">"{selectedRequest.symptoms}"</p>
              </div>

              <div>
                <label className="label">Avis / Diagnostic de l'infirmier *</label>
                <textarea
                  value={nurseForm.nurse_opinion}
                  onChange={(e) => setNurseForm((p) => ({ ...p, nurse_opinion: e.target.value }))}
                  className="input min-h-[90px]"
                  placeholder="Notes cliniques, avis médical..."
                  required
                />
              </div>

              <div>
                <label className="label">Prescription (Médicaments, Recommandations)</label>
                <textarea
                  value={nurseForm.prescription}
                  onChange={(e) => setNurseForm((p) => ({ ...p, prescription: e.target.value }))}
                  className="input min-h-[60px]"
                  placeholder="Ex: Paracétamol 500mg, repos immédiat..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Jours d'arrêt prescrits</label>
                  <input
                    type="number"
                    value={nurseForm.rest_days_granted}
                    onChange={(e) => setNurseForm((p) => ({ ...p, rest_days_granted: Number(e.target.value) }))}
                    className="input"
                    min="0"
                    max="30"
                  />
                </div>

                <div>
                  <label className="label">Décision médicale *</label>
                  <select
                    value={nurseForm.status}
                    onChange={(e) => setNurseForm((p) => ({ ...p, status: e.target.value as any }))}
                    className="input"
                    required
                  >
                    <option value="processed">Accorder repos / Valider consultation</option>
                    <option value="rejected">Rejeter (Avis Négatif)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-6 border-t border-slate-100 dark:border-slate-800/80">
                <button type="button" onClick={() => setSelectedRequest(null)} className="btn-secondary text-xs">
                  Fermer
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs px-5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
