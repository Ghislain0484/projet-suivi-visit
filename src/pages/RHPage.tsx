import React, { useEffect, useState } from 'react';
import { supabase, HRPresence, Permission, Profile, Intern } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInMinutes } from 'date-fns';
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
  Users,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

// GICO Branches coordinates
const GICO_BRANCHES = [
  { name: "Siège (Bonoua)", lat: 5.27138, lng: -3.59472 },
  { name: "GICO 8 Kilos", lat: 5.2891, lng: -3.6625 },
  { name: "GICO MOROKRO", lat: 5.8672, lng: -4.6853 },
  { name: "GICO ABOISSO COMOE", lat: 5.4678, lng: -3.2081 }
];

// Haversine formula to calculate distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get the nearest GICO branch and the distance to it
function getNearestBranch(lat: number, lng: number) {
  let nearest = GICO_BRANCHES[0];
  let minDistance = calculateDistance(lat, lng, nearest.lat, nearest.lng);
  
  for (let i = 1; i < GICO_BRANCHES.length; i++) {
    const dist = calculateDistance(lat, lng, GICO_BRANCHES[i].lat, GICO_BRANCHES[i].lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = GICO_BRANCHES[i];
    }
  }
  
  return { branch: nearest, distance: minDistance };
}

export default function RHPage() {
  const { user, profile } = useAuth();
  const [presence, setPresence] = useState<HRPresence | null>(null);
  const [history, setHistory] = useState<HRPresence[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  // QR Scanner & Token states
  const [urlToken, setUrlToken] = useState<string | null>(null);
  const [qrVersion, setQrVersion] = useState<'v1' | 'v2' | 'v3'>('v1');
  const [dynamicToken, setDynamicToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [autoPointSuccess, setAutoPointSuccess] = useState<string | null>(null);
  const [autoPointError, setAutoPointError] = useState<string | null>(null);

  // GPS states
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Permission Request Form state
  const [permForm, setPermForm] = useState({
    type: 'permission' as 'permission' | 'absence' | 'leave',
    reason: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [submittingPerm, setSubmittingPerm] = useState(false);

  // Admin/RH states
  const [teamHistory, setTeamHistory] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterCollaborator, setFilterCollaborator] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState<'personal' | 'interns' | 'team'>('personal');

  const isAdminOrRH = profile && ['admin', 'director', 'reception'].includes(profile.role);

  // Interns Kiosk state
  const [interns, setInterns] = useState<Intern[]>([]);
  const [internPresences, setInternPresences] = useState<HRPresence[]>([]);
  const [loadingInterns, setLoadingInterns] = useState(false);
  const [newIntern, setNewIntern] = useState({
    full_name: '',
    service_id: '',
    phone: '',
    start_date: '',
    end_date: '',
    school_or_institution: '',
    notes: ''
  });
  const [addingIntern, setAddingIntern] = useState(false);

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

  useEffect(() => {
    fetchRHData();
    requestGPS(); // Warm up GPS chip on mount / load
    if (isAdminOrRH) {
      fetchTeamData();
      fetchMetadata();
      fetchInternsData();
    }
    // Dynamic QR rotation interval (V3)
    let interval: any;
    if (qrVersion === 'v3') {
      rotateToken();
      interval = setInterval(rotateToken, 5000); // rotate every 5s
    } else {
      setDynamicToken('GICO-PRESENCE-STATIC-TOKEN-12345');
    }
    return () => clearInterval(interval);
  }, [user, qrVersion, profile]);

  // Auto-point when urlToken is set and loading of presence data is complete
  useEffect(() => {
    const triggerAutoPoint = async () => {
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
          await new Promise((resolve) => setTimeout(resolve, 800));

          try {
            // Geolocation is mandatory for V3 or QR checks
            const isV3 = urlToken.includes('DYNAMIC') || qrVersion === 'v3';
            let lat: number | null = null;
            let lng: number | null = null;
            let accuracy: number | null = null;

            if (isV3) {
              try {
                const pos = await getGPSCoordsPromise();
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                accuracy = pos.coords.accuracy;
              } catch (e: any) {
                throw new Error("Géolocalisation obligatoire : " + e.message);
              }
            }

            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const nowISO = new Date().toISOString();
            const gpsVal = lat ? `LAT:${lat.toFixed(5)}, LNG:${lng.toFixed(5)} (±${accuracy?.toFixed(0)}m)` : null;

            if (action === 'arrival') {
              // Double check-in prevention
              const { data: alreadyExists } = await supabase
                .from('hr_presences')
                .select('id')
                .eq('user_id', user.id)
                .eq('date', todayStr)
                .maybeSingle();

              if (alreadyExists) {
                throw new Error("Vous avez déjà pointé votre arrivée pour aujourd'hui.");
              }

              const { error } = await supabase.from('hr_presences').insert({
                user_id: user.id,
                employee_name: profile?.full_name || user.email,
                date: todayStr,
                arrival_time: nowISO,
                qr_code_token: urlToken,
                gps_location: gpsVal,
                check_in_latitude: lat,
                check_in_longitude: lng,
                location_accuracy: accuracy,
                qr_code_version: qrVersion,
                status: 'present',
              });
              if (error) throw new Error("La table de présence est introuvable ou mal configurée.");
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
                updateData.status = 'departed';
                updateData.check_out_latitude = lat;
                updateData.check_out_longitude = lng;
                setAutoPointSuccess("Pointage de DÉPART enregistré. Bonne soirée !");
              }
              updateData.updated_at = nowISO;

              const { error } = await supabase
                .from('hr_presences')
                .update(updateData)
                .eq('user_id', user.id)
                .eq('date', todayStr);
              if (error) throw new Error("Erreur de mise à jour du pointage.");
            }

            await fetchRHData();
            if (isAdminOrRH) fetchTeamData();
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

  const getGPSCoordsPromise = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Le navigateur ne supporte pas la géolocalisation."));
        return;
      }

      let watchId: number | null = null;
      let bestPosition: GeolocationPosition | null = null;
      const timeoutMs = 8000; // Laisser jusqu'à 8 secondes à la puce GPS pour s'ajuster et affiner la précision

      const clearWatch = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
      };

      // Limiteur de temps (fallback) : résout avec la meilleure position capturée jusqu'alors
      const timer = setTimeout(() => {
        clearWatch();
        if (bestPosition) {
          resolve(bestPosition);
        } else {
          reject(new Error("Délai d'attente GPS dépassé. Veuillez réessayer."));
        }
      }, timeoutMs);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Enregistrer la première position ou celle qui a une meilleure précision
          if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
          }

          // Si la précision est excellente (<= 15 mètres), on résout immédiatement !
          if (position.coords.accuracy <= 15) {
            clearTimeout(timer);
            clearWatch();
            resolve(position);
          }
        },
        (error) => {
          // Si nous avons déjà obtenu une coordonnée précédente, on ignore les erreurs temporaires de suivi
          if (!bestPosition) {
            clearTimeout(timer);
            clearWatch();
            reject(error);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0, // Ignorer le cache navigateur pour forcer une nouvelle mesure réelle
        }
      );
    });
  };

  const requestGPS = async () => {
    setFetchingGps(true);
    setGpsError(null);
    try {
      const pos = await getGPSCoordsPromise();
      setGpsCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    } catch (e: any) {
      let msg = "Erreur de géolocalisation.";
      if (e.code === 1) {
        msg = "Veuillez autoriser l'accès GPS dans les paramètres de votre navigateur.";
      } else if (e.code === 2) {
        msg = "Position GPS indisponible.";
      } else if (e.code === 3) {
        msg = "Délai d'attente GPS dépassé.";
      }
      setGpsError(msg);
      setGpsCoords(null);
    } finally {
      setFetchingGps(false);
    }
  };

  const fetchRHData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Fetch today's presence record
      const { data: todayPresence } = await supabase
        .from('hr_presences')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle();

      setPresence(todayPresence as HRPresence);

      // Fetch history
      const { data: hist } = await supabase
        .from('hr_presences')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(15);
      if (hist) setHistory(hist as HRPresence[]);

      // Fetch permissions
      const { data: perms } = await supabase
        .from('permissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (perms) setPermissions(perms as Permission[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamData = async () => {
    setLoadingTeam(true);
    try {
      let query = supabase
        .from('hr_presences')
        .select('*, profile:profiles(*, service:services(*)), intern:interns(*)')
        .order('date', { ascending: false });

      if (filterDate) query = query.eq('date', filterDate);
      if (filterCollaborator) query = query.eq('user_id', filterCollaborator);
      if (filterStatus) query = query.eq('status', filterStatus);

      const { data } = await query;
      if (data) {
        // Local filtering by service since it's nested
        let filtered = data;
        if (filterService) {
          filtered = data.filter((item: any) => item.profile?.service_id === filterService);
        }
        setTeamHistory(filtered);
      }
    } catch (err) {
      console.error("Fetch team history error:", err);
    } finally {
      setLoadingTeam(false);
    }
  };

  const fetchMetadata = async () => {
    const { data: svcs } = await supabase.from('services').select('*').eq('is_active', true);
    if (svcs) setServices(svcs);

    const { data: collabs } = await supabase.from('profiles').select('*').eq('is_active', true);
    if (collabs) setCollaborators(collabs);
  };

  const fetchInternsData = async () => {
    if (!isAdminOrRH) return;
    setLoadingInterns(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
      const { data: internsList } = await supabase
        .from('interns')
        .select('*, service:services(*)')
        .order('full_name', { ascending: true });
        
      if (internsList) setInterns(internsList as any);

      const { data: presList } = await supabase
        .from('hr_presences')
        .select('*')
        .eq('date', todayStr)
        .not('intern_id', 'is', null);

      if (presList) setInternPresences(presList);
    } catch (err) {
      console.error("Error fetching interns data:", err);
    } finally {
      setLoadingInterns(false);
    }
  };

  const handleAddIntern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIntern.full_name.trim()) return;
    setAddingIntern(true);
    try {
      const { error } = await supabase
        .from('interns')
        .insert({
          full_name: newIntern.full_name.trim(),
          service_id: newIntern.service_id || null,
          phone: newIntern.phone.trim() || null,
          start_date: newIntern.start_date || null,
          end_date: newIntern.end_date || null,
          school_or_institution: newIntern.school_or_institution.trim() || null,
          notes: newIntern.notes.trim() || null,
          is_active: true
        });
      if (error) throw error;
      setNewIntern({
        full_name: '',
        service_id: '',
        phone: '',
        start_date: '',
        end_date: '',
        school_or_institution: '',
        notes: ''
      });
      await fetchInternsData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'ajout du stagiaire.");
    } finally {
      setAddingIntern(false);
    }
  };

  const handleToggleInternActive = async (internId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('interns')
        .update({ is_active: !currentStatus })
        .eq('id', internId);
      if (error) throw error;
      await fetchInternsData();
    } catch (err: any) {
      alert(err.message || "Erreur de modification du statut.");
    }
  };

  const handleDeleteIntern = async (internId: string, name: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer définitivement le stagiaire "${name}" ? Ses historiques de pointage seront également supprimés.`)) return;
    try {
      const { error } = await supabase
        .from('interns')
        .delete()
        .eq('id', internId);
      if (error) throw error;
      await fetchInternsData();
    } catch (err: any) {
      alert(err.message || "Erreur de suppression.");
    }
  };

  const handleKioskPointage = async (internId: string, action: 'arrival' | 'break_start' | 'break_end' | 'departure') => {
    setScanning(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;

      try {
        const pos = await getGPSCoordsPromise();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
        setGpsCoords({ lat, lng, accuracy });
      } catch (gpsErr: any) {
        console.warn("Tablet GPS failed, continuing without GPS coordinates:", gpsErr);
      }

      const gpsVal = lat ? `LAT:${lat.toFixed(5)}, LNG:${lng.toFixed(5)} (±${accuracy?.toFixed(0)}m)` : null;

      const { error } = await supabase.rpc('kiosk_check_in', {
        target_intern_id: internId,
        action_type: action,
        gps_val: gpsVal,
        lat: lat,
        lng: lng,
        accuracy: accuracy
      });

      if (error) throw error;
      await fetchInternsData();
    } catch (err: any) {
      alert(err.message || "Erreur lors du pointage borne.");
    } finally {
      setScanning(false);
    }
  };

  const handleManualPointage = async (action: 'arrival' | 'break_start' | 'break_end' | 'departure') => {
    if (!user) return;
    setScanning(true);
    setGpsError(null);

    try {
      // 1. Get GPS coordinates (mandatory for V3, highly recommended for others)
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;

      try {
        const pos = await getGPSCoordsPromise();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
        setGpsCoords({ lat, lng, accuracy });
      } catch (gpsErr: any) {
        // Geolocation is mandatory for V3
        if (qrVersion === 'v3') {
          throw new Error("Géolocalisation obligatoire pour le pointage V3 : Veuillez autoriser le GPS.");
        }
        console.warn("GPS failed, continuing without GPS coordinates:", gpsErr);
      }

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const nowISO = new Date().toISOString();
      const gpsVal = lat ? `LAT:${lat.toFixed(5)}, LNG:${lng.toFixed(5)} (±${accuracy?.toFixed(0)}m)` : null;

      if (action === 'arrival') {
        // Double check-in check
        const { data: alreadyExists } = await supabase
          .from('hr_presences')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', todayStr)
          .maybeSingle();

        if (alreadyExists) {
          throw new Error("Vous avez déjà pointé votre arrivée pour aujourd'hui.");
        }

        const { error } = await supabase.from('hr_presences').insert({
          user_id: user.id,
          employee_name: profile?.full_name || user.email,
          date: todayStr,
          arrival_time: nowISO,
          qr_code_token: dynamicToken,
          gps_location: gpsVal,
          check_in_latitude: lat,
          check_in_longitude: lng,
          location_accuracy: accuracy,
          qr_code_version: qrVersion,
          status: 'present',
        });
        if (error) throw new Error("La table de présence est introuvable ou mal configurée.");
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
          updateData.status = 'departed';
          updateData.check_out_latitude = lat;
          updateData.check_out_longitude = lng;
        }
        updateData.updated_at = nowISO;

        const { error } = await supabase
          .from('hr_presences')
          .update(updateData)
          .eq('user_id', user.id)
          .eq('date', todayStr);
        if (error) throw new Error("Erreur de mise à jour du pointage.");
      }

      await fetchRHData();
      if (isAdminOrRH) fetchTeamData();
    } catch (err: any) {
      alert(err.message || "Erreur lors du pointage.");
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

  const exportToCSV = () => {
    if (teamHistory.length === 0) return;
    const headers = ["Date", "Collaborateur", "Service", "Arrivee", "Debut Pause", "Fin Pause", "Depart", "Duree (min)", "Statut", "GPS"];
    const rows = teamHistory.map((item) => {
      const duration = item.arrival_time && item.departure_time 
        ? differenceInMinutes(new Date(item.departure_time), new Date(item.arrival_time)) 
        : "";
      return [
        item.date,
        item.profile?.full_name || item.employee_name || "",
        item.profile?.service?.name || "",
        item.arrival_time ? format(new Date(item.arrival_time), 'HH:mm:ss') : "",
        item.break_start ? format(new Date(item.break_start), 'HH:mm:ss') : "",
        item.break_end ? format(new Date(item.break_end), 'HH:mm:ss') : "",
        item.departure_time ? format(new Date(item.departure_time), 'HH:mm:ss') : "",
        duration,
        item.status,
        item.gps_location || "",
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `presence_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; class: string }> = {
      present: { label: 'Présent', class: 'badge-success' },
      pause: { label: 'En pause', class: 'badge-warning' },
      mission: { label: 'En mission', class: 'badge-primary' },
      displacement: { label: 'Déplacement', class: 'badge-info' },
      absent: { label: 'Absent', class: 'badge-danger' },
      departed: { label: 'Parti', class: 'badge-gray' },
      leave: { label: 'En Congé', class: 'badge-gold' },
      permission: { label: 'Permission', class: 'badge-gray' },
    };
    const current = config[status] || { label: status, class: 'badge-gray' };
    return <span className={`badge ${current.class}`}>{current.label}</span>;
  };

  const getDurationString = (h: HRPresence) => {
    if (!h.arrival_time || !h.departure_time) return '-';
    const mins = differenceInMinutes(new Date(h.departure_time), new Date(h.arrival_time));
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Ressources Humaines & Présences
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Espace RH & Pointage</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Gérer votre temps de présence journalier, votre géolocalisation et vos demandes administratives.
          </p>
        </div>

        {/* Supervision tab switcher for admin */}
        {isAdminOrRH && (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shrink-0 self-start sm:self-center">
            <button
              onClick={() => setActiveTab('personal')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'personal'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" /> Mon Pointage
            </button>
            <button
              onClick={() => {
                setActiveTab('interns');
                fetchInternsData();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'interns'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" /> Pointage Stagiaires
            </button>
            <button
              onClick={() => {
                setActiveTab('team');
                fetchTeamData();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'team'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" /> Supervision RH
            </button>
          </div>
        )}
      </div>

      {activeTab === 'personal' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Pointage Simulator and control board */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card overflow-hidden">
              <div className="card-header bg-gradient-to-r from-primary-600/5 to-primary-700/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-primary-600" />
                  Terminal de Pointage (V1 - V3)
                </h2>
                <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/40 dark:border-slate-800/40 shrink-0">
                  {(['v1', 'v2', 'v3'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setQrVersion(v)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black capitalize transition-all ${
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
                {/* QR Code and GPS Authorization */}
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/60 rounded-3xl space-y-4">
                  <div className="relative w-44 h-44 bg-white p-3 rounded-2xl shadow-md border border-slate-100 flex items-center justify-center group overflow-hidden">
                    {dynamicToken ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/rh?token=${dynamicToken}`)}`}
                        alt="Pointage QR Code"
                        className="w-36 h-36 object-contain"
                      />
                    ) : (
                      <QrCode className="w-24 h-24 text-slate-300 animate-pulse" />
                    )}
                    <div className="absolute left-0 right-0 h-0.5 bg-primary-500 shadow-glow-primary animate-bounce top-1"></div>
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-white capitalize">
                      {qrVersion === 'v1' ? 'QR Code Statique standard' : qrVersion === 'v2' ? 'QR Code + Validation Connecté' : 'QR Code + GPS Obligatoire (V3)'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      {qrVersion === 'v3' ? 'Le jeton dynamique expire toutes les 5s.' : 'Jeton sécurisé fixe.'}
                    </p>
                  </div>

                  {/* Real GPS status indicator */}
                  <div className="w-full space-y-3">
                    <button
                      onClick={requestGPS}
                      disabled={fetchingGps}
                      className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        gpsCoords
                          ? 'bg-white dark:bg-slate-900 text-slate-700 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                          : gpsError
                            ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border-rose-500/20'
                            : 'bg-white dark:bg-slate-900 text-slate-700 hover:bg-slate-50 border-slate-200 dark:border-slate-800 shadow-sm'
                      }`}
                    >
                      {fetchingGps ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-primary-500" />
                      )}
                      {fetchingGps ? 'Calcul de la position...' : 'Mettre à jour la géolocalisation'}
                    </button>

                    {gpsCoords && (() => {
                      const { branch, distance } = getNearestBranch(gpsCoords.lat, gpsCoords.lng);
                      let badgeClass = 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30';
                      let badgeText = 'Précision faible';
                      let signalColor = 'bg-rose-500';

                      if (gpsCoords.accuracy <= 15) {
                        badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
                        badgeText = 'Précision excellente';
                        signalColor = 'bg-emerald-500';
                      } else if (gpsCoords.accuracy <= 80) {
                        badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
                        badgeText = 'Précision moyenne';
                        signalColor = 'bg-amber-500';
                      }

                      return (
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Signal GPS</span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${signalColor} animate-pulse`}></span>
                              {badgeText} (±{gpsCoords.accuracy.toFixed(0)}m)
                            </span>
                          </div>

                          <div className="space-y-1.5 border-t border-slate-200/40 dark:border-slate-800/40 pt-2 text-[11px]">
                            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                              <span>Agence la plus proche:</span>
                              <span className="font-bold text-slate-800 dark:text-white">{branch.name}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                              <span>Distance:</span>
                              <span className="font-mono font-bold text-primary-600 dark:text-primary-400">
                                {distance < 1 ? `${(distance * 1000).toFixed(0)} m` : `${distance.toFixed(2)} km`}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-200/40 dark:border-slate-800/40 pt-2 text-[10px]">
                            <span className="font-mono text-slate-400 dark:text-slate-500">
                              {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                            </span>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${gpsCoords.lat},${gpsCoords.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-bold hover:underline"
                            >
                              Voir sur Google Maps
                            </a>
                          </div>

                          {/* GPS Tips for poor signal */}
                          {gpsCoords.accuracy > 15 && (
                            <div className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1 mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                              <p className="font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Conseils pour affiner la précision :
                              </p>
                              <ul className="list-disc list-inside space-y-0.5 text-[9px] pl-1 font-medium">
                                <li>Activez le Wi-Fi (aide à la géolocalisation urbaine).</li>
                                <li>Placez-vous près d'une fenêtre ou à l'extérieur.</li>
                                <li>Assurez-vous que le GPS de l'appareil est activé en mode "Haute Précision".</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {gpsError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-500/10 rounded-2xl flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Erreur de localisation</p>
                          <p className="text-[10px] mt-0.5 font-medium">{gpsError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pointage Controls */}
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Statut aujourd'hui</span>
                      {presence ? getStatusBadge(presence.status) : <span className="badge badge-gray">Non pointé</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/50">
                        <span className="text-[10px] text-slate-400 font-medium block">Arrivée</span>
                        <span className="font-extrabold text-slate-800 dark:text-white">
                          {presence?.arrival_time ? format(new Date(presence.arrival_time), 'HH:mm:ss') : '--:--:--'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/50">
                        <span className="text-[10px] text-slate-400 font-medium block">Départ</span>
                        <span className="font-extrabold text-slate-800 dark:text-white">
                          {presence?.departure_time ? format(new Date(presence.departure_time), 'HH:mm:ss') : '--:--:--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {!presence ? (
                      <button
                        onClick={() => handleManualPointage('arrival')}
                        disabled={scanning}
                        className="btn-primary w-full py-3.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2"
                      >
                        {scanning ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Clock className="w-4.5 h-4.5" />}
                        Pointer l'Arrivée
                      </button>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Pause button */}
                          {presence.status === 'present' && !presence.departure_time && (
                            <button
                              onClick={() => handleManualPointage('break_start')}
                              disabled={scanning}
                              className="btn-warning py-3 rounded-xl text-xs font-bold"
                            >
                              <Pause className="w-4 h-4 mr-1.5" /> Pause
                            </button>
                          )}
                          {/* Resume button */}
                          {presence.status === 'pause' && !presence.departure_time && (
                            <button
                              onClick={() => handleManualPointage('break_end')}
                              disabled={scanning}
                              className="btn-success py-3 rounded-xl text-xs font-bold"
                            >
                              <Play className="w-4 h-4 mr-1.5" /> Reprise
                            </button>
                          )}

                          {/* Checkout button */}
                          {!presence.departure_time && (
                            <button
                              onClick={() => handleManualPointage('departure')}
                              disabled={scanning}
                              className={`btn-danger py-3 rounded-xl text-xs font-bold ${presence.status === 'pause' ? 'col-span-2' : ''}`}
                            >
                              <RotateCcw className="w-4 h-4 mr-1.5" /> Départ
                            </button>
                          )}
                        </div>
                        {presence.departure_time && (
                          <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-600 text-center rounded-xl text-xs font-bold border border-emerald-500/10">
                            Journée de travail clôturée avec succès.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* History Table (Personal) */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Mon Historique de Présence</h3>
              </div>
              <div className="card-body p-0">
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-600 italic text-center py-8">Aucun enregistrement de pointage.</p>
                ) : (
                  <div className="table-container border-0 rounded-none shadow-none">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Arrivée</th>
                          <th>Pause</th>
                          <th>Retour</th>
                          <th>Départ</th>
                          <th>Durée</th>
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
                            <td className="font-semibold text-slate-700 dark:text-slate-300">{getDurationString(h)}</td>
                            <td>{getStatusBadge(h.status)}</td>
                            <td className="text-xs text-slate-400 max-w-[150px] truncate" title={h.gps_location || ''}>
                              {h.gps_location ? (
                                h.check_in_latitude ? (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${h.check_in_latitude},${h.check_in_longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline font-bold"
                                  >
                                    <MapPin className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                    {h.gps_location}
                                  </a>
                                ) : (
                                  <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                                    {h.gps_location}
                                  </span>
                                )
                              ) : (
                                'Néant (V1)'
                              )}
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

          {/* Right Column: Absences requests */}
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

            {/* Demandes history */}
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
      ) : activeTab === 'interns' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pointage Borne List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <div className="card-header bg-gradient-to-r from-primary-600/5 to-primary-700/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  Pointage Express (Borne Stagiaires)
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {gpsCoords && (
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border flex items-center gap-1 ${
                      gpsCoords.accuracy <= 15
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                        : gpsCoords.accuracy <= 80
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30'
                    }`}>
                      <MapPin className="w-3 h-3 text-primary-500" />
                      GPS Tablette: ±{gpsCoords.accuracy.toFixed(0)}m
                    </span>
                  )}
                  <span className="text-[10px] bg-primary-100 text-primary-800 dark:bg-primary-950/40 dark:text-primary-400 px-2.5 py-1 rounded-full font-bold">
                    {interns.filter(i => i.is_active).length} Stagiaire(s) Actif(s)
                  </span>
                </div>
              </div>
              <div className="card-body p-6 space-y-4">
                {scanning && (
                  <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80 animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600 mr-2" />
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">Traitement du pointage, veuillez patienter...</span>
                  </div>
                )}
                
                {interns.filter(i => i.is_active).length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-semibold">Aucun stagiaire actif dans la liste.</p>
                    <p className="text-xs text-slate-500 mt-1">Ajoutez des stagiaires à l'aide du panneau de droite pour commencer.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {interns.filter(i => i.is_active).map((intern) => {
                      const todayPresence = internPresences.find(p => p.intern_id === intern.id);
                      return (
                        <div 
                          key={intern.id}
                          className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 hover:shadow-sm transition-all space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-bold text-slate-800 dark:text-white text-sm">{intern.full_name}</h3>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                Stagiaire {intern.service?.name ? `• ${intern.service.name}` : ''}
                              </p>
                              {intern.phone && (
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                  Tél: {intern.phone}
                                </p>
                              )}
                            </div>
                            {todayPresence ? getStatusBadge(todayPresence.status) : <span className="badge badge-gray">Non pointé</span>}
                          </div>

                          <div className="bg-white dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 text-[10px] flex justify-between gap-2">
                            <div>
                              <span className="text-slate-400 font-medium block">Arrivée</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {todayPresence?.arrival_time ? format(new Date(todayPresence.arrival_time), 'HH:mm:ss') : '--:--'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium block">Pause</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {todayPresence?.break_start ? format(new Date(todayPresence.break_start), 'HH:mm') : '--:--'}
                                {todayPresence?.break_end ? ` / ${format(new Date(todayPresence.break_end), 'HH:mm')}` : ''}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium block">Départ</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {todayPresence?.departure_time ? format(new Date(todayPresence.departure_time), 'HH:mm:ss') : '--:--'}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-1.5 pt-1">
                            {!todayPresence ? (
                              <button
                                onClick={() => handleKioskPointage(intern.id, 'arrival')}
                                disabled={scanning}
                                className="btn-primary flex-1 py-2 text-[10px] font-extrabold flex items-center justify-center gap-1 rounded-xl"
                              >
                                <Clock className="w-3.5 h-3.5" /> Arrivée
                              </button>
                            ) : (
                              <>
                                {todayPresence.status === 'present' && !todayPresence.departure_time && (
                                  <button
                                    onClick={() => handleKioskPointage(intern.id, 'break_start')}
                                    disabled={scanning}
                                    className="btn-warning flex-1 py-2 text-[10px] font-extrabold flex items-center justify-center gap-1 rounded-xl"
                                  >
                                    <Pause className="w-3.5 h-3.5" /> Pause
                                  </button>
                                )}
                                {todayPresence.status === 'pause' && !todayPresence.departure_time && (
                                  <button
                                    onClick={() => handleKioskPointage(intern.id, 'break_end')}
                                    disabled={scanning}
                                    className="btn-success flex-1 py-2 text-[10px] font-extrabold flex items-center justify-center gap-1 rounded-xl"
                                  >
                                    <Play className="w-3.5 h-3.5" /> Reprise
                                  </button>
                                )}
                                {!todayPresence.departure_time && (
                                  <button
                                    onClick={() => handleKioskPointage(intern.id, 'departure')}
                                    disabled={scanning}
                                    className="btn-danger flex-1 py-2 text-[10px] font-extrabold flex items-center justify-center gap-1 rounded-xl"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" /> Départ
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Manage Interns List Panel */}
          <div className="space-y-6">
            <div className="card">
              <div className="card-header bg-gradient-to-r from-primary-600/5 to-primary-700/5">
                <h3 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  Gestion de la Liste & Infos Administratives
                </h3>
              </div>
              <div className="card-body p-4 space-y-4">
                {/* Detailed Form to add an intern */}
                <form onSubmit={handleAddIntern} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-[10px] uppercase font-bold">Nom Complet *</label>
                      <input
                        type="text"
                        value={newIntern.full_name}
                        onChange={(e) => setNewIntern((p) => ({ ...p, full_name: e.target.value }))}
                        className="input text-xs"
                        placeholder="Ex: Marius Kouamé"
                        required
                        disabled={addingIntern}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] uppercase font-bold">Téléphone</label>
                      <input
                        type="tel"
                        value={newIntern.phone}
                        onChange={(e) => setNewIntern((p) => ({ ...p, phone: e.target.value }))}
                        className="input text-xs"
                        placeholder="Ex: 07080910"
                        disabled={addingIntern}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-[10px] uppercase font-bold">Département / Service</label>
                      <select
                        value={newIntern.service_id}
                        onChange={(e) => setNewIntern((p) => ({ ...p, service_id: e.target.value }))}
                        className="input text-xs"
                        disabled={addingIntern}
                      >
                        <option value="">Sélectionner un service</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label text-[10px] uppercase font-bold">Établissement / École</label>
                      <input
                        type="text"
                        value={newIntern.school_or_institution}
                        onChange={(e) => setNewIntern((p) => ({ ...p, school_or_institution: e.target.value }))}
                        className="input text-xs"
                        placeholder="Ex: INPHB, Ecole Supérieure..."
                        disabled={addingIntern}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-[10px] uppercase font-bold">Date de début</label>
                      <input
                        type="date"
                        value={newIntern.start_date}
                        onChange={(e) => setNewIntern((p) => ({ ...p, start_date: e.target.value }))}
                        className="input text-xs"
                        disabled={addingIntern}
                      />
                    </div>
                    <div>
                      <label className="label text-[10px] uppercase font-bold">Date de fin prévue</label>
                      <input
                        type="date"
                        value={newIntern.end_date}
                        onChange={(e) => setNewIntern((p) => ({ ...p, end_date: e.target.value }))}
                        className="input text-xs"
                        disabled={addingIntern}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label text-[10px] uppercase font-bold">Remarques / Notes</label>
                    <textarea
                      value={newIntern.notes}
                      onChange={(e) => setNewIntern((p) => ({ ...p, notes: e.target.value }))}
                      className="input text-xs min-h-[60px]"
                      placeholder="Informations ou projets assignés..."
                      disabled={addingIntern}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={addingIntern || !newIntern.full_name.trim()}
                    className="btn-primary w-full py-2.5 text-xs font-bold rounded-xl"
                  >
                    {addingIntern ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : "Enregistrer le Stagiaire"}
                  </button>
                </form>

                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">Tous les stagiaires ({interns.length})</span>
                  <div className="max-h-[400px] overflow-y-auto scrollbar-thin space-y-2.5">
                    {interns.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-600 italic text-center py-4">Aucun stagiaire enregistré.</p>
                    ) : (
                      interns.map((intern) => (
                        <div 
                          key={intern.id}
                          className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800/40 rounded-xl space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className={`text-xs font-bold ${intern.is_active ? 'text-slate-850 dark:text-slate-200' : 'text-slate-400 dark:text-slate-650 line-through'}`}>
                                {intern.full_name}
                              </span>
                              {intern.service?.name && (
                                <span className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-850 dark:text-slate-400 px-1.5 py-0.5 rounded font-semibold ml-2">
                                  {intern.service.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleToggleInternActive(intern.id, intern.is_active)}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${
                                  intern.is_active 
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-500/20 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                }`}
                                title={intern.is_active ? "Désactiver" : "Activer"}
                              >
                                {intern.is_active ? "Actif" : "Inactif"}
                              </button>
                              <button
                                onClick={() => handleDeleteIntern(intern.id, intern.full_name)}
                                className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                                title="Supprimer définitivement"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {intern.phone && (
                              <div>
                                <span className="text-slate-400">Tél :</span> {intern.phone}
                              </div>
                            )}
                            {intern.school_or_institution && (
                              <div>
                                <span className="text-slate-400">Établissement :</span> {intern.school_or_institution}
                              </div>
                            )}
                            {(intern.start_date || intern.end_date) && (
                              <div className="col-span-2">
                                <span className="text-slate-400">Période :</span> {intern.start_date ? format(new Date(intern.start_date), 'dd/MM/yyyy') : '?'} au {intern.end_date ? format(new Date(intern.end_date), 'dd/MM/yyyy') : '?'}
                              </div>
                            )}
                            {intern.notes && (
                              <div className="col-span-2 italic text-slate-400 mt-1 p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800/40">
                                « {intern.notes} »
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Team Supervision View */
        <div className="space-y-6">
          {/* Filters Card */}
          <div className="card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="label text-[10px] uppercase font-bold">Date de pointage</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label text-[10px] uppercase font-bold">Service / Département</label>
                <select
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value)}
                  className="input"
                >
                  <option value="">Tous les services</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-[10px] uppercase font-bold">Collaborateur</label>
                <select
                  value={filterCollaborator}
                  onChange={(e) => setFilterCollaborator(e.target.value)}
                  className="input"
                >
                  <option value="">Tous les collaborateurs</option>
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-[10px] uppercase font-bold">Statut</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="input"
                >
                  <option value="">Tous les statuts</option>
                  <option value="present">Présents</option>
                  <option value="pause">En pause</option>
                  <option value="departed">Partis</option>
                  <option value="absent">Absents</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={fetchTeamData}
                  disabled={loadingTeam}
                  className="btn-primary flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {loadingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
                  Filtrer
                </button>

                <button
                  onClick={exportToCSV}
                  disabled={teamHistory.length === 0}
                  className="btn-secondary py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                  title="Exporter au format CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Supervision Registre Table */}
          <div className="card">
            <div className="card-header bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h2 className="font-extrabold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-500" />
                Supervision du Personnel ({teamHistory.length})
              </h2>
            </div>
            <div className="card-body p-0">
              {loadingTeam ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
              ) : teamHistory.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-semibold">Aucun pointage trouvé avec les filtres actuels.</p>
                </div>
              ) : (
                <div className="table-container border-0 rounded-none shadow-none">
                  <table className="table text-xs">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Collaborateur</th>
                        <th>Service</th>
                        <th>Arrivée</th>
                        <th>Pause</th>
                        <th>Retour</th>
                        <th>Départ</th>
                        <th>Durée</th>
                        <th>Statut</th>
                        <th>Localisation & Précision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{format(new Date(item.date), 'dd/MM/yyyy')}</td>
                          <td className="font-bold text-slate-800 dark:text-white">
                            {item.profile?.full_name || item.employee_name || 'Inconnu'}
                            {item.intern_id && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-black uppercase ml-1.5">
                                Stagiaire
                              </span>
                            )}
                          </td>
                          <td>{item.profile?.service?.name || (item.intern_id ? 'Stagiaire' : '-')}</td>
                          <td className="font-mono">{item.arrival_time ? format(new Date(item.arrival_time), 'HH:mm:ss') : '-'}</td>
                          <td className="font-mono">{item.break_start ? format(new Date(item.break_start), 'HH:mm:ss') : '-'}</td>
                          <td className="font-mono">{item.break_end ? format(new Date(item.break_end), 'HH:mm:ss') : '-'}</td>
                          <td className="font-mono">{item.departure_time ? format(new Date(item.departure_time), 'HH:mm:ss') : '-'}</td>
                          <td className="font-semibold text-slate-700 dark:text-slate-300">{getDurationString(item)}</td>
                          <td>{getStatusBadge(item.status)}</td>
                          <td className="max-w-[200px] truncate" title={item.gps_location || ''}>
                            {item.gps_location ? (
                              item.check_in_latitude ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${item.check_in_latitude},${item.check_in_longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:underline font-bold"
                                >
                                  <MapPin className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                  {item.gps_location}
                                </a>
                              ) : (
                                <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                                  {item.gps_location}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 font-medium">Statique (V1)</span>
                            )}
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
      )}

      {/* Pointage QR Code Modal for Scanning auto point */}
      {urlToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 shadow-2xl p-6 max-w-md w-full rounded-3xl animate-scale-in space-y-6">
            
            {scanning && (
              <div className="text-center py-8 space-y-4">
                <Loader2 className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-spin mx-auto" />
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Pointage en cours...</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
                    Validation de vos coordonnées et de votre heure sur Supabase...
                  </p>
                </div>
              </div>
            )}

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
          </div>
        </div>
      )}
    </div>
  );
}
