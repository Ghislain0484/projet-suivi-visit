import React, { useEffect, useState } from 'react';
import { supabase, HRPresence, Permission } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Clock,
  QrCode,
  MapPin,
  FileText,

  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Loader2,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function RHPage() {
  const { user } = useAuth();
  const [presence, setPresence] = useState<HRPresence | null>(null);
  const [history, setHistory] = useState<HRPresence[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  // QR Scanner & Token states
  const [urlToken, setUrlToken] = useState<string | null>(null);
  const [qrVersion, setQrVersion] = useState<'v1' | 'v2' | 'v3'>('v1');
  const [dynamicToken, setDynamicToken] = useState('');
  const [gpsSimulated, setGpsSimulated] = useState<{ lat: number; lng: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [autoPointSuccess, setAutoPointSuccess] = useState<string | null>(null);
  const [autoPointError, setAutoPointError] = useState<string | null>(null);

  // Parse token from URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setUrlToken(tokenParam);
      // Clean up URL query parameters
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // Permission Request Form state
  const [permForm, setPermForm] = useState({
    type: 'permission' as 'permission' | 'absence' | 'leave',
    reason: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [submittingPerm, setSubmittingPerm] = useState(false);

  useEffect(() => {
    fetchRHData();
    // Dynamic QR rotation interval (V3)
    let interval: any;
    if (qrVersion === 'v3') {
      rotateToken();
      interval = setInterval(rotateToken, 5000); // rotate every 5s
    } else {
      setDynamicToken('GICO-PRESENCE-STATIC-TOKEN-12345');
    }
    return () => clearInterval(interval);
  }, [user, qrVersion]);

  // Auto-point when urlToken is set and loading of presence data is complete
  useEffect(() => {
    const triggerAutoPoint = async () => {
      // presence is loaded when loading is false. presence can be null if not checked in yet.
      if (urlToken && !loading && user && presence !== undefined) {
        const sessionKey = `autopoint_processed_${urlToken}`;
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, 'true');

        let action: 'arrival' | 'break_start' | 'break_end' | 'departure' | null = null;
        if (!presence) {
          action = 'arrival';
        } else if (presence.break_start && !presence.break_end && !presence.departure_time) {
          action = 'break_end';
        } else if (!presence.departure_time) {
          action = 'departure';
        }

        if (action) {
          setScanning(true);
          // Wait briefly for smooth animation feedback
          await new Promise((resolve) => setTimeout(resolve, 800));

          let gpsVal: string | null = null;
          const isV2orV3 = urlToken.includes('DYNAMIC') || urlToken.includes('GPS') || qrVersion === 'v2' || qrVersion === 'v3';

          if (isV2orV3) {
            let coords = gpsSimulated;
            if (!coords) {
              coords = await getGPSCoords();
              setGpsSimulated(coords);
            }
            gpsVal = `LAT:${coords.lat.toFixed(5)}, LNG:${coords.lng.toFixed(5)}`;
          }

          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const nowISO = new Date().toISOString();

          try {
            if (action === 'arrival') {
              const { error } = await supabase.from('hr_presences').insert({
                user_id: user.id,
                date: todayStr,
                arrival_time: nowISO,
                qr_code_token: urlToken,
                gps_location: gpsVal,
                status: 'present',
              });
              if (error) throw error;
              setAutoPointSuccess("Pointage d'ARRIVÉE enregistré avec succès !");
            } else {
              const updateData: any = {};
              if (action === 'break_start') {
                updateData.break_start = nowISO;
                updateData.status = 'pause';
                setAutoPointSuccess("Pointage de DÉBUT DE PAUSE enregistré !");
              } else if (action === 'break_end') {
                updateData.break_end = nowISO;
                updateData.status = 'present';
                setAutoPointSuccess("Pointage de RETOUR DE PAUSE enregistré !");
              } else if (action === 'departure') {
                updateData.departure_time = nowISO;
                updateData.status = 'absent';
                setAutoPointSuccess("Pointage de DÉPART enregistré avec succès. Bonne fin de journée !");
              }
              updateData.updated_at = nowISO;

              const { error } = await supabase
                .from('hr_presences')
                .update(updateData)
                .eq('user_id', user.id)
                .eq('date', todayStr);
              if (error) throw error;
            }

            await fetchRHData();
          } catch (err: any) {
            console.error("Auto pointage error:", err);
            setAutoPointError(err.message || "Erreur lors du pointage automatique.");
          } finally {
            setScanning(false);
          }
        }
      }
    };

    triggerAutoPoint();
  }, [urlToken, loading, presence, user]);

  const rotateToken = () => {
    const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
    setDynamicToken(`GICO-DYNAMIC-QR-${randomHex}-${Date.now()}`);
  };

  const fetchRHData = async () => {
    if (!user) return;
    setLoading(true);

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Fetch today's presence record
    const { data: todayPresence } = await supabase
      .from('hr_presences')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', todayStr)
      .maybeSingle();

    if (todayPresence) setPresence(todayPresence as any);
    else setPresence(null);

    // Fetch history
    const { data: hist } = await supabase
      .from('hr_presences')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(10);
    if (hist) setHistory(hist as any);

    // Fetch permissions
    const { data: perms } = await supabase
      .from('permissions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (perms) setPermissions(perms as any);

    setLoading(false);
  };

  const getGPSCoords = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: 5.324, lng: -4.021 })
        );
      } else {
        resolve({ lat: 5.324, lng: -4.021 });
      }
    });
  };

  const triggerGPS = async () => {
    const coords = await getGPSCoords();
    setGpsSimulated(coords);
  };

  const handlePointageSimulated = async (action: 'arrival' | 'break_start' | 'break_end' | 'departure', tokenToUse?: string) => {
    if (!user) return;
    setScanning(true);

    // Add brief artificial latency for premium scanner effect
    await new Promise((resolve) => setTimeout(resolve, 800));

    let gpsVal: string | null = null;
    const token = tokenToUse || dynamicToken;
    const isV2orV3 = token.includes('DYNAMIC') || token.includes('GPS') || qrVersion === 'v2' || qrVersion === 'v3';

    if (isV2orV3) {
      let coords = gpsSimulated;
      if (!coords) {
        coords = await getGPSCoords();
        setGpsSimulated(coords);
      }
      gpsVal = `LAT:${coords.lat.toFixed(5)}, LNG:${coords.lng.toFixed(5)}`;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowISO = new Date().toISOString();

    try {
      if (action === 'arrival') {
        const { error } = await supabase.from('hr_presences').insert({
          user_id: user.id,
          date: todayStr,
          arrival_time: nowISO,
          qr_code_token: token,
          gps_location: gpsVal,
          status: 'present',
        });
        if (error) throw error;
      } else {
        const updateData: any = {};
        if (action === 'break_start') {
          updateData.break_start = nowISO;
          updateData.status = 'pause';
        } else if (action === 'break_end') {
          updateData.break_end = nowISO;
          updateData.status = 'present';
        } else if (action === 'departure') {
          updateData.departure_time = nowISO;
          updateData.status = 'absent';
        }
        updateData.updated_at = nowISO;

        const { error } = await supabase
          .from('hr_presences')
          .update(updateData)
          .eq('user_id', user.id)
          .eq('date', todayStr);
        if (error) throw error;
      }

      await fetchRHData();
      setUrlToken(null);
    } catch (err: any) {
      alert(err.message || "Erreur lors du pointage");
    } finally {
      setScanning(false);
    }
  };

  const handlePermissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingPerm(true);

    try {
      const { error } = await supabase.from('permissions').insert({
        user_id: user.id,
        type: permForm.type,
        reason: permForm.reason,
        start_date: permForm.start_date,
        end_date: permForm.end_date,
        status: 'pending',
      });

      if (error) throw error;

      alert("Demande de permission soumise avec succès");
      setPermForm({
        type: 'permission',
        reason: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(), 'yyyy-MM-dd'),
      });
      fetchRHData();
    } catch (err: any) {
      alert(err.message || "Erreur de soumission");
    } finally {
      setSubmittingPerm(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; class: string }> = {
      present: { label: 'Présent', class: 'badge-success' },
      pause: { label: 'En pause', class: 'badge-warning' },
      mission: { label: 'En mission', class: 'badge-primary' },
      displacement: { label: 'Déplacement', class: 'badge-info' },
      absent: { label: 'Parti / Absent', class: 'badge-gray' },
      leave: { label: 'En Congé', class: 'badge-gold' },
      permission: { label: 'Permission', class: 'badge-gray' },
    };
    const current = config[status] || { label: status, class: 'badge-gray' };
    return <span className={`badge ${current.class}`}>{current.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4" /> Ressources Humaines
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Espace RH & Pointage</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Gérer votre temps de présence journalier et vos demandes administratives
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Check-In QR and GPS Simulator Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="card-header bg-gradient-to-r from-primary-600/5 to-primary-700/5">
              <h2 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary-600" />
                Simulateur de Pointage Intelligent (V1 - V3)
              </h2>
              {/* Pointage version switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                {(['v1', 'v2', 'v3'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setQrVersion(v)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold capitalize transition-all ${
                      qrVersion === v
                        ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left: Interactive pointage scanner simulator */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/60 rounded-3xl space-y-4">
                <div className="relative w-44 h-44 bg-white p-3 rounded-2xl shadow-md border border-slate-100 flex items-center justify-center group overflow-hidden">
                  {dynamicToken ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/rh?token=${dynamicToken}`)}`}
                      alt="Pointage QR Code"
                      className="w-36 h-36 object-contain"
                    />
                  ) : (
                    <div className="text-center space-y-1 text-slate-700 dark:text-slate-900 animate-pulse">
                      <QrCode className="w-24 h-24 mx-auto text-slate-800" />
                    </div>
                  )}
                  {/* Dynamic laser bar scanning effect */}
                  <div className="absolute left-0 right-0 h-0.5 bg-primary-500 shadow-glow-primary animate-bounce top-1"></div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-white capitalize">
                    {qrVersion === 'v1' ? 'QR Code Statique' : qrVersion === 'v2' ? 'QR Code + GPS' : 'QR Code Dynamique Sécurisé (V3)'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    {qrVersion === 'v3' ? 'Le jeton de sécurité tourne toutes les 5 secondes.' : 'Jeton sécurisé fixe.'}
                  </p>
                </div>

                {/* GPS trigger status */}
                {(qrVersion === 'v2' || qrVersion === 'v3') && (
                  <button
                    onClick={triggerGPS}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold ${
                      gpsSimulated
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-500/20'
                        : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {gpsSimulated ? `Simulé: ${gpsSimulated.lat.toFixed(3)}, ${gpsSimulated.lng.toFixed(3)}` : 'Activer localisation GPS'}
                  </button>
                )}
              </div>

              {/* Right: Pointage control dashboard */}
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">État actuel</span>
                    {presence ? getStatusBadge(presence.status) : <span className="badge badge-gray">Non pointé</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/50">
                      <span className="text-[10px] text-slate-400 font-medium block">Arrivée</span>
                      <span className="font-extrabold text-slate-800 dark:text-white">{presence?.arrival_time ? format(new Date(presence.arrival_time), 'HH:mm') : '--:--'}</span>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/50">
                      <span className="text-[10px] text-slate-400 font-medium block">Départ</span>
                      <span className="font-extrabold text-slate-800 dark:text-white">{presence?.departure_time ? format(new Date(presence.departure_time), 'HH:mm') : '--:--'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {!presence ? (
                    <button
                      onClick={() => handlePointageSimulated('arrival')}
                      disabled={scanning}
                      className="btn-primary col-span-2 py-3 rounded-2xl text-xs"
                    >
                      {scanning ? <Loader2 className="w-4.5 h-4.5 animate-spin mr-2" /> : <Clock className="w-4.5 h-4.5 mr-2" />}
                      Pointer l'Arrivée
                    </button>
                  ) : (
                    <>
                      {/* Break Start Button */}
                      {!presence.break_start && !presence.departure_time && (
                        <button
                          onClick={() => handlePointageSimulated('break_start')}
                          disabled={scanning}
                          className="btn-warning py-3 rounded-2xl text-xs"
                        >
                          <Pause className="w-4 h-4 mr-1.5" />
                          Début Pause
                        </button>
                      )}

                      {/* Break End Button */}
                      {presence.break_start && !presence.break_end && !presence.departure_time && (
                        <button
                          onClick={() => handlePointageSimulated('break_end')}
                          disabled={scanning}
                          className="btn-success py-3 rounded-2xl text-xs"
                        >
                          <Play className="w-4 h-4 mr-1.5" />
                          Retour Pause
                        </button>
                      )}

                      {/* Check-Out Button */}
                      {!presence.departure_time && (
                        <button
                          onClick={() => handlePointageSimulated('departure')}
                          disabled={scanning}
                          className="btn-danger col-span-2 py-3 rounded-2xl text-xs"
                        >
                          <RotateCcw className="w-4.5 h-4.5 mr-2" />
                          Pointer le Départ
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* History log timeline */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Historique de pointage (10 derniers jours)</h3>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-600 italic text-center py-8">Aucun enregistrement de pointage.</p>
              ) : (
                <div className="table-container border-0 rounded-none shadow-none">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Arrivée</th>
                        <th>Début Pause</th>
                        <th>Fin Pause</th>
                        <th>Départ</th>
                        <th>Statut</th>
                        <th>Localisation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td className="font-bold text-slate-800 dark:text-white">
                            {format(new Date(h.date), 'dd MMMM yyyy', { locale: fr })}
                          </td>
                          <td className="font-mono text-xs">{h.arrival_time ? format(new Date(h.arrival_time), 'HH:mm:ss') : '-'}</td>
                          <td className="font-mono text-xs">{h.break_start ? format(new Date(h.break_start), 'HH:mm:ss') : '-'}</td>
                          <td className="font-mono text-xs">{h.break_end ? format(new Date(h.break_end), 'HH:mm:ss') : '-'}</td>
                          <td className="font-mono text-xs">{h.departure_time ? format(new Date(h.departure_time), 'HH:mm:ss') : '-'}</td>
                          <td>{getStatusBadge(h.status)}</td>
                          <td className="text-xs text-slate-400 truncate max-w-[150px]" title={h.gps_location || ''}>
                            {h.gps_location || 'Néant (V1)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Permissions Requests and Form Column */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Demander une absence
              </h3>
            </div>
            <form onSubmit={handlePermissionSubmit} className="card-body space-y-4">
              <div>
                <label className="label">Type de demande *</label>
                <select
                  value={permForm.type}
                  onChange={(e) => setPermForm((p) => ({ ...p, type: e.target.value as any }))}
                  className="input"
                  required
                >
                  <option value="permission">Permission Exceptionnelle</option>
                  <option value="absence">Absence Justifiée</option>
                  <option value="leave">Congés Annuels</option>
                </select>
              </div>

              <div>
                <label className="label">Motif / Justification *</label>
                <textarea
                  value={permForm.reason}
                  onChange={(e) => setPermForm((p) => ({ ...p, reason: e.target.value }))}
                  className="input min-h-[90px]"
                  placeholder="Veuillez décrire le motif de votre absence..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date de début *</label>
                  <input
                    type="date"
                    value={permForm.start_date}
                    onChange={(e) => setPermForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Date de fin *</label>
                  <input
                    type="date"
                    value={permForm.end_date}
                    onChange={(e) => setPermForm((p) => ({ ...p, end_date: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingPerm}
                className="btn-primary w-full py-2.5 rounded-xl text-xs mt-2"
              >
                {submittingPerm ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Soumettre ma demande
              </button>
            </form>
          </div>

          {/* Personal permissions history log */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary-600" />
                Vos demandes ({permissions.length})
              </h3>
            </div>
            <div className="card-body p-4 space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
              {permissions.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-600 italic text-center py-4">Aucune demande en cours.</p>
              ) : (
                permissions.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-primary-600 dark:text-primary-400">{p.type}</span>
                      <span
                        className={`badge ${
                          p.status === 'pending'
                            ? 'badge-warning'
                            : p.status === 'approved'
                              ? 'badge-success'
                              : 'badge-danger'
                        }`}
                      >
                        {p.status === 'pending' ? 'En attente' : p.status === 'approved' ? 'Approuvé' : 'Rejeté'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2">{p.reason}</p>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-semibold border-t border-slate-100 dark:border-slate-800/60 pt-2">
                      <span>Du {format(new Date(p.start_date), 'dd/MM')} au {format(new Date(p.end_date), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pointage QR Code Modal */}
      {urlToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 shadow-2xl p-6 max-w-md w-full rounded-3xl animate-scale-in space-y-6">
            
            {/* 1. Status: Scanning/Processing */}
            {scanning && (
              <div className="text-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-spin mx-auto" />
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Pointage en cours...</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
                    Enregistrement de votre heure et de votre position GPS en cours de validation...
                  </p>
                </div>
              </div>
            )}

            {/* 2. Status: Auto Point Success */}
            {!scanning && autoPointSuccess && (
              <div className="text-center py-6 space-y-5">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-800/30">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Pointage Réussi !</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mt-2">
                    {autoPointSuccess}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setUrlToken(null);
                    setAutoPointSuccess(null);
                    setAutoPointError(null);
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                >
                  Fermer
                </button>
              </div>
            )}

            {/* 3. Status: Auto Point Error */}
            {!scanning && autoPointError && (
              <div className="text-center py-6 space-y-5">
                <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-800/30">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Échec du Pointage</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mt-2">
                    {autoPointError}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setUrlToken(null);
                    setAutoPointSuccess(null);
                    setAutoPointError(null);
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                >
                  Fermer
                </button>
              </div>
            )}

            {/* 4. Status: Normal flow (no auto action found or already completed for today) */}
            {!scanning && !autoPointSuccess && !autoPointError && (
              <>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400">
                    <QrCode className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      Pointage QR Code Détecté
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      Jeton : <span className="font-mono text-primary-500">{urlToken}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 dark:text-slate-500 uppercase font-semibold">Statut aujourd'hui</span>
                    {presence ? getStatusBadge(presence.status) : <span className="badge badge-gray">Non pointé</span>}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
                    {presence?.departure_time 
                      ? "Vous avez déjà clôturé votre journée de travail aujourd'hui. Aucun autre pointage n'est requis."
                      : "Vous pouvez également choisir manuellement une action ci-dessous :"
                    }
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {!presence ? (
                    <button
                      onClick={() => handlePointageSimulated('arrival', urlToken)}
                      disabled={scanning}
                      className="btn-primary w-full py-3 rounded-2xl text-xs font-bold"
                    >
                      <Clock className="w-4.5 h-4.5 mr-2" />
                      Pointer l'Arrivée
                    </button>
                  ) : (
                    <>
                      {/* Break Start Button */}
                      {!presence.break_start && !presence.departure_time && (
                        <button
                          onClick={() => handlePointageSimulated('break_start', urlToken)}
                          disabled={scanning}
                          className="btn-warning w-full py-3 rounded-2xl text-xs font-bold"
                        >
                          <Pause className="w-4.5 h-4.5 mr-2" />
                          Début Pause
                        </button>
                      )}

                      {/* Break End Button */}
                      {presence.break_start && !presence.break_end && !presence.departure_time && (
                        <button
                          onClick={() => handlePointageSimulated('break_end', urlToken)}
                          disabled={scanning}
                          className="btn-success w-full py-3 rounded-2xl text-xs font-bold"
                        >
                          <Play className="w-4.5 h-4.5 mr-2" />
                          Retour de Pause
                        </button>
                      )}

                      {/* Check-Out Button */}
                      {!presence.departure_time && (
                        <button
                          onClick={() => handlePointageSimulated('departure', urlToken)}
                          disabled={scanning}
                          className="btn-danger w-full py-3 rounded-2xl text-xs font-bold"
                        >
                          <RotateCcw className="w-4.5 h-4.5 mr-2" />
                          Clôturer le Départ
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => {
                      setUrlToken(null);
                      setAutoPointSuccess(null);
                      setAutoPointError(null);
                    }}
                    disabled={scanning}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all mt-1"
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
