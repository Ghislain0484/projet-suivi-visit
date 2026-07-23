import { useEffect, useState } from 'react';
import { supabase, Permission } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import {
  FileCheck,
  CheckCircle,
  Clock,
  Sparkles,
  Loader2,
  Calendar,
  User,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

export default function PermissionsPage() {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  const fetchPermissions = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from('permissions')
      .select(`
        *,
        profile:profiles(*)
      `)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error("Error fetching permissions:", fetchErr);
      setError(fetchErr.message);
    } else if (data) {
      setPermissions(data as any);
    }
    setLoading(false);
  };

  const handleValidate = async (id: string, action: 'approved' | 'rejected') => {
    if (!profile) return;
    setProcessingId(id);

    try {
      const { error } = await supabase
        .from('permissions')
        .update({
          status: action,
          validated_by: profile.id,
          validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      fetchPermissions();
    } catch (err: any) {
      alert(err.message || "Erreur de validation");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = permissions.filter((p) => p.status === 'pending');
  const validatedRequests = permissions.filter((p) => p.status !== 'pending');

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', class: 'badge-warning' },
      approved: { label: 'Approuvé', class: 'badge-success' },
      rejected: { label: 'Rejeté', class: 'badge-danger' },
    };
    const current = config[status as keyof typeof config] || { label: status, class: 'badge-gray' };
    return <span className={`badge ${current.class}`}>{current.label}</span>;
  };

  const getPermissionTypeLabel = (type: string) => {
    const labels = {
      permission: 'Permission Exceptionnelle',
      absence: 'Absence Justifiée',
      leave: 'Congés Annuels',
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" /> Espace Administratif RH
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Approbation des Permissions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Valider ou refuser les demandes d'absences exceptionnelles et congés des employés
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-500/10 rounded-2xl flex items-start gap-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Erreur de chargement des permissions :</p>
            <p className="mt-1 font-medium">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner h-8 w-8"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left/Middle: Pending Requests Grid */}
          <div className="xl:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header bg-amber-50/10 border-b border-slate-100 dark:border-slate-800/80">
                <h2 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Demandes en attente d'approbation ({pendingRequests.length})
                </h2>
              </div>
              <div className="card-body p-6">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Aucune demande en attente</p>
                    <p className="text-xs text-slate-400 mt-1">Toutes les demandes ont été traitées !</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map((p) => (
                      <div
                        key={p.id}
                        className="p-5 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-2.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge-primary text-[10px] font-black uppercase">
                              {getPermissionTypeLabel(p.type)}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Du {format(new Date(p.start_date), 'dd/MM/yyyy')} au {format(new Date(p.end_date), 'dd/MM/yyyy')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                              {(p as any).profile?.full_name || 'N/A'} ({(p as any).profile?.role})
                            </p>
                          </div>

                          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 pl-9 leading-relaxed">
                            "{p.reason}"
                          </p>
                        </div>

                        {/* Validation Action Buttons */}
                        <div className="flex items-center gap-2 pl-9 md:pl-0">
                          <button
                            onClick={() => handleValidate(p.id, 'approved')}
                            disabled={processingId !== null}
                            className="btn-success p-2.5 rounded-xl text-xs font-bold"
                            title="Approuver la demande"
                          >
                            {processingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4.5 h-4.5" />}
                          </button>
                          <button
                            onClick={() => handleValidate(p.id, 'rejected')}
                            disabled={processingId !== null}
                            className="btn-danger p-2.5 rounded-xl text-xs font-bold"
                            title="Rejeter la demande"
                          >
                            {processingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4.5 h-4.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Historical processed logs */}
          <div className="card">
            <div className="card-header border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/20">
              <h2 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary-600" />
                Historique des demandes ({validatedRequests.length})
              </h2>
            </div>
            <div className="card-body p-4 space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin">
              {validatedRequests.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-600 italic text-center py-8">Aucun historique de demande.</p>
              ) : (
                validatedRequests.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-primary-600 dark:text-primary-400">
                        {getPermissionTypeLabel(p.type)}
                      </span>
                      {getStatusBadge(p.status)}
                    </div>
                    <div className="text-xs">
                      <p className="font-extrabold text-slate-700 dark:text-slate-300">{(p as any).profile?.full_name || 'N/A'}</p>
                      <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">"{p.reason}"</p>
                    </div>

                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold border-t border-slate-100 dark:border-slate-800/60 pt-2.5 flex flex-col gap-1">
                      <span>Période : du {format(new Date(p.start_date), 'dd/MM')} au {format(new Date(p.end_date), 'dd/MM/yyyy')}</span>
                      {p.validated_at && (
                        <span className="italic">
                          Traité le {format(new Date(p.validated_at), 'dd/MM/yyyy à HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
