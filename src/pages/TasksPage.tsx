import React, { useEffect, useState, useMemo } from 'react';
import {
  supabase,
  ServiceTask,
  TaskProgressLog,
  Service,
  Profile,
  Visitor,
  Priority,
  TaskStatus,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  getOfflineCache,
  setOfflineCache,
  enqueueOfflineMutation,
  useNetworkStatus,
} from '../lib/offlineSync';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CheckSquare,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  Building2,
  Calendar,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Activity,
  Sparkles,
  X,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Loader2,
  Layers,
  Flag,
  Share2,
  ShieldCheck,
  Wrench,
  Check,
  Send,
  WifiOff,
} from 'lucide-react';

export default function TasksPage() {
  const { user, profile } = useAuth();
  const { isOnline } = useNetworkStatus();

  // Données initialisées avec le cache hors-connexion instantané (0 ms de latence)
  const [tasks, setTasks] = useState<ServiceTask[]>(() => getOfflineCache<ServiceTask[]>('tasks_list') || []);
  const [services, setServices] = useState<Service[]>(() => getOfflineCache<Service[]>('services_list') || []);
  const [collaborators, setCollaborators] = useState<Profile[]>(() => getOfflineCache<Profile[]>('collaborators_list') || []);
  const [visitors, setVisitors] = useState<Visitor[]>(() => getOfflineCache<Visitor[]>('visitors_list') || []);
  const [loading, setLoading] = useState(() => !getOfflineCache('tasks_list'));

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('all'); // all, need_today, in_progress, blocked, late, completed, shared
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('all');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Modals & Actions
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedTaskForProgress, setSelectedTaskForProgress] = useState<ServiceTask | null>(null);
  const [expandedTaskHistory, setExpandedTaskHistory] = useState<Record<string, boolean>>({});
  const [taskLogs, setTaskLogs] = useState<Record<string, TaskProgressLog[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // Formulaire de Création de Tâche
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    service_id: '',
    service_manager_id: '',
    secondary_service_ids: [] as string[],
    visitor_id: '',
    assigned_to: '', // technicien ou délégataire
    start_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    current_stage: 'Couche 1 : Démarrage & Cadrage',
    priority: 'normal' as Priority,
  });

  // Formulaire de Pointage / Rapport d'avancement
  const [progressForm, setProgressForm] = useState({
    progress_percentage: 0,
    stage_label: '',
    summary: '',
    status: 'in_progress' as TaskStatus,
    blockers: '',
  });

  const isGlobalSupervisor = profile && ['admin', 'director', 'grh', 'reception', 'accounting'].includes(profile.role);
  const isServiceManager = profile?.role === 'service_manager';
  const canCreateTask = isGlobalSupervisor || isServiceManager;

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [selectedServiceId, selectedStatusTab, onlyMyTasks]);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const fetchMetadata = async () => {
    try {
      const [srvRes, colRes, visRes] = await Promise.all([
        supabase.from('services').select('*').eq('is_active', true).order('name'),
        supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
        supabase.from('visitors').select('*').order('last_name').limit(300),
      ]);

      if (srvRes.data) {
        setServices(srvRes.data);
        setOfflineCache('services_list', srvRes.data);
      }
      if (colRes.data) {
        setCollaborators(colRes.data);
        setOfflineCache('collaborators_list', colRes.data);
      }
      if (visRes.data) {
        setVisitors(visRes.data);
        setOfflineCache('visitors_list', visRes.data);
      }

      // Par défaut pour un chef de service : son service
      if (profile?.role === 'service_manager' && profile.service_id) {
        setSelectedServiceId(profile.service_id);
        setCreateForm((prev) => ({
          ...prev,
          service_id: profile.service_id || '',
          service_manager_id: profile.id,
        }));
      }
    } catch (err) {
      console.warn('Chargement métadonnées depuis le cache local (mode hors-ligne):', err);
    }
  };

  const fetchTasks = async () => {
    // Si pas de cache, afficher le chargement
    if (!tasks || tasks.length === 0) setLoading(true);

    try {
      let query = supabase
        .from('service_tasks')
        .select(`
          *,
          service:services(*),
          visitor:visitors(*),
          service_manager:profiles!service_tasks_service_manager_id_fkey(*),
          assigned_collaborator:profiles!service_tasks_assigned_to_fkey(*),
          creator:profiles!service_tasks_created_by_fkey(*)
        `)
        .order('due_date', { ascending: true });

      // Cloisonnement : un responsable voit son service ou les tâches partagées avec son service
      if (isServiceManager && profile?.service_id) {
        query = query.or(`service_id.eq.${profile.service_id},secondary_service_ids.cs.{${profile.service_id}}`);
      } else if (selectedServiceId !== 'all') {
        query = query.or(`service_id.eq.${selectedServiceId},secondary_service_ids.cs.{${selectedServiceId}}`);
      }

      const { data, error: err } = await query;
      if (!err && data) {
        setTasks(data as ServiceTask[]);
        setOfflineCache('tasks_list', data);
      } else if (err) {
        console.warn('Erreur réseau lors de la récupération des tâches, utilisation du cache local:', err);
      }
    } catch (e) {
      console.warn('Mode hors connexion : utilisation des tâches enregistrées localement.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogsForTask = async (taskId: string) => {
    try {
      const { data } = await supabase
        .from('task_progress_logs')
        .select('*, author:profiles(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (data) {
        setTaskLogs((prev) => ({ ...prev, [taskId]: data as TaskProgressLog[] }));
        setOfflineCache(`task_logs_${taskId}`, data);
      }
    } catch {
      const cached = getOfflineCache<TaskProgressLog[]>(`task_logs_${taskId}`);
      if (cached) {
        setTaskLogs((prev) => ({ ...prev, [taskId]: cached }));
      }
    }
  };

  const toggleHistory = async (taskId: string) => {
    const isExpanded = Boolean(expandedTaskHistory[taskId]);
    if (!isExpanded && !taskLogs[taskId]) {
      await fetchLogsForTask(taskId);
    }
    setExpandedTaskHistory((prev) => ({ ...prev, [taskId]: !isExpanded }));
  };

  // Création d'une nouvelle tâche avec support hors connexion
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.service_id) {
      setError('Veuillez renseigner au moins le titre et le service responsable.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const estimatedDays = Math.max(
        1,
        differenceInDays(parseISO(createForm.due_date), parseISO(createForm.start_date)) + 1
      );

      // Résolution du chef de service
      let managerId = createForm.service_manager_id;
      if (!managerId) {
        const foundService = services.find((s) => s.id === createForm.service_id);
        managerId = foundService?.manager_id || user?.id || '';
      }

      const newTaskPayload = {
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        service_id: createForm.service_id,
        service_manager_id: managerId || null,
        secondary_service_ids: createForm.secondary_service_ids,
        visitor_id: createForm.visitor_id || null,
        assigned_to: createForm.assigned_to || null,
        created_by: user?.id,
        start_date: createForm.start_date,
        due_date: createForm.due_date,
        estimated_days: estimatedDays,
        progress_percentage: 0,
        current_stage: createForm.current_stage || 'Couche 1 : Démarrage',
        priority: createForm.priority,
        status: 'in_progress',
        last_log_date: null,
      };

      if (!isOnline) {
        // Enregistrement hors-ligne immédiat
        const localId = `local_task_${Date.now()}`;
        const localTask: ServiceTask = {
          ...newTaskPayload,
          id: localId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          service: services.find((s) => s.id === createForm.service_id),
          visitor: visitors.find((v) => v.id === createForm.visitor_id),
          service_manager: collaborators.find((c) => c.id === managerId),
          assigned_collaborator: collaborators.find((c) => c.id === createForm.assigned_to),
        } as any;

        enqueueOfflineMutation({
          table: 'service_tasks',
          action: 'insert',
          payload: newTaskPayload,
          description: `Création tâche : ${localTask.title}`,
        });

        const updated = [localTask, ...tasks];
        setTasks(updated);
        setOfflineCache('tasks_list', updated);
        showNotification('Tâche enregistrée hors connexion. Elle sera synchronisée dès le retour du réseau.');
        setShowCreateModal(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from('service_tasks')
        .insert(newTaskPayload)
        .select(`
          *,
          service:services(*),
          visitor:visitors(*),
          service_manager:profiles!service_tasks_service_manager_id_fkey(*),
          assigned_collaborator:profiles!service_tasks_assigned_to_fkey(*),
          creator:profiles!service_tasks_created_by_fkey(*)
        `)
        .single();

      if (insertError) throw insertError;

      if (data) {
        const updated = [data as ServiceTask, ...tasks];
        setTasks(updated);
        setOfflineCache('tasks_list', updated);
        showNotification('Tâche créée et attribuée avec succès !');
      }

      setShowCreateModal(false);
      setCreateForm({
        title: '',
        description: '',
        service_id: profile?.service_id || '',
        service_manager_id: profile?.id || '',
        secondary_service_ids: [],
        visitor_id: '',
        assigned_to: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        current_stage: 'Couche 1 : Démarrage & Cadrage',
        priority: 'normal',
      });
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création de la tâche.");
    } finally {
      setSaving(false);
    }
  };

  // Ouverture du modal de pointage rapide (Daily Check-in)
  const openProgressModal = (task: ServiceTask) => {
    setSelectedTaskForProgress(task);
    setProgressForm({
      progress_percentage: task.progress_percentage || 0,
      stage_label: task.current_stage || '',
      summary: '',
      status: task.status || 'in_progress',
      blockers: task.last_blockers || '',
    });
    setShowProgressModal(true);
  };

  // Enregistrement d'un pointage d'avancement
  const handleLogProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForProgress) return;
    if (!progressForm.summary.trim()) {
      setError('Veuillez saisir un résumé du travail effectué aujourd’hui.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const logPayload = {
        task_id: selectedTaskForProgress.id,
        logged_by: user?.id,
        log_date: todayStr,
        progress_percentage: Number(progressForm.progress_percentage),
        stage_label: progressForm.stage_label.trim() || null,
        summary: progressForm.summary.trim(),
        status: progressForm.progress_percentage >= 100 ? 'completed' : progressForm.status,
        blockers: progressForm.blockers.trim() || null,
      };

      const updatedStatus = progressForm.progress_percentage >= 100 ? 'completed' : progressForm.status;

      // Mise à jour optimiste immédiate dans l'état local
      const updatedTasks = tasks.map((t) => {
        if (t.id === selectedTaskForProgress.id) {
          return {
            ...t,
            progress_percentage: Number(progressForm.progress_percentage),
            current_stage: progressForm.stage_label.trim() || t.current_stage,
            status: updatedStatus as TaskStatus,
            last_log_date: todayStr,
            last_log_summary: progressForm.summary.trim(),
            last_blockers: progressForm.blockers.trim() || null,
            updated_at: new Date().toISOString(),
          };
        }
        return t;
      });

      setTasks(updatedTasks);
      setOfflineCache('tasks_list', updatedTasks);

      if (!isOnline) {
        // Mode hors ligne : enfiler l'action
        enqueueOfflineMutation({
          table: 'task_progress_logs',
          action: 'insert',
          payload: logPayload,
          description: `Pointage sur : ${selectedTaskForProgress.title} (${progressForm.progress_percentage}%)`,
        });

        showNotification('Pointage enregistré hors connexion. Il sera synchronisé dès la reconnexion.');
        setShowProgressModal(false);
        return;
      }

      // Mode en ligne : insertion directe dans Supabase
      const { error: logErr } = await supabase.from('task_progress_logs').insert(logPayload);
      if (logErr) throw logErr;

      // Synchronisation explicite sur service_tasks
      await supabase
        .from('service_tasks')
        .update({
          progress_percentage: Number(progressForm.progress_percentage),
          current_stage: progressForm.stage_label.trim() || selectedTaskForProgress.current_stage,
          status: updatedStatus,
          last_log_date: todayStr,
          last_log_summary: progressForm.summary.trim(),
          last_blockers: progressForm.blockers.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTaskForProgress.id);

      showNotification('Compte-rendu journalier enregistré avec succès !');
      setShowProgressModal(false);
      fetchLogsForTask(selectedTaskForProgress.id);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement du pointage.");
    } finally {
      setSaving(false);
    }
  };

  // Détection des tâches actives qui attendent un pointage aujourd'hui
  const tasksNeedingLogToday = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.status === 'in_progress' &&
        t.last_log_date !== todayStr &&
        (isGlobalSupervisor ||
          (profile?.service_id && (t.service_id === profile.service_id || t.secondary_service_ids?.includes(profile.service_id))))
    );
  }, [tasks, todayStr, isGlobalSupervisor, profile]);

  // Filtrage combiné : Recherche client/titre + Onglets + Service + Collaborateur
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Recherche par titre, nom de client ou entreprise
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientFullName = task.visitor
          ? `${task.visitor.first_name} ${task.visitor.last_name}`.toLowerCase()
          : '';
        const clientCompany = task.visitor?.company?.toLowerCase() || '';
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) || false;
        const matchesClient = clientFullName.includes(q) || clientCompany.includes(q);

        if (!matchesTitle && !matchesDesc && !matchesClient) return false;
      }

      // 2. Filtre par Onglet de Statut
      if (selectedStatusTab === 'need_today') {
        if (task.status !== 'in_progress' || task.last_log_date === todayStr) return false;
      } else if (selectedStatusTab === 'in_progress') {
        if (task.status !== 'in_progress') return false;
      } else if (selectedStatusTab === 'blocked') {
        if (task.status !== 'blocked' && !task.last_blockers) return false;
      } else if (selectedStatusTab === 'completed') {
        if (task.status !== 'completed') return false;
      } else if (selectedStatusTab === 'late') {
        const isLate = task.status !== 'completed' && parseISO(task.due_date) < new Date();
        if (!isLate) return false;
      } else if (selectedStatusTab === 'shared') {
        if (!task.secondary_service_ids || task.secondary_service_ids.length === 0) return false;
      }

      // 3. Filtre Collaborateur / Technicien
      if (selectedCollaboratorId !== 'all') {
        if (task.assigned_to !== selectedCollaboratorId && task.service_manager_id !== selectedCollaboratorId) {
          return false;
        }
      }

      // 4. "Mes tâches"
      if (onlyMyTasks && user) {
        const isMine = task.assigned_to === user.id || task.service_manager_id === user.id;
        if (!isMine) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedStatusTab, selectedCollaboratorId, onlyMyTasks, user, todayStr]);

  // KPIs globaux
  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const blocked = tasks.filter((t) => t.status === 'blocked' || Boolean(t.last_blockers)).length;
    const late = tasks.filter((t) => t.status !== 'completed' && parseISO(t.due_date) < new Date()).length;
    const needToday = tasksNeedingLogToday.length;

    const avgProgress =
      total > 0 ? Math.round(tasks.reduce((sum, t) => sum + (t.progress_percentage || 0), 0) / total) : 0;

    return { total, inProgress, completed, blocked, late, needToday, avgProgress };
  }, [tasks, tasksNeedingLogToday]);

  const toggleSecondaryService = (serviceId: string) => {
    setCreateForm((prev) => {
      const exists = prev.secondary_service_ids.includes(serviceId);
      return {
        ...prev,
        secondary_service_ids: exists
          ? prev.secondary_service_ids.filter((id) => id !== serviceId)
          : [...prev.secondary_service_ids, serviceId],
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast de confirmation */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-in-bottom">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-semibold">{successToast}</span>
        </div>
      )}

      {/* En-tête et actions principales */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Suivi des Tâches & Projets par Service
            </h1>
            {!isOnline && (
              <span className="flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300/40">
                <WifiOff className="w-3 h-3" /> Hors-ligne
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Coordination inter-services, responsabilité des chefs de service et pointages quotidiens.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreateTask && (
            <button
              onClick={() => {
                setError('');
                setShowCreateModal(true);
              }}
              className="btn-primary flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Tâche Client</span>
            </button>
          )}
        </div>
      </div>

      {/* BANNIÈRE D'ADOPTION & D'ASSIDUITÉ (Répond à l'enjeu majeur soulevé en réunion) */}
      {stats.needToday > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4.5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-xl flex-shrink-0 shadow-inner">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  {stats.needToday} pointage(s) quotidien(s) attendu(s) pour aujourd’hui !
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                  Pour garantir le suivi d'avancement, chaque responsable ou technicien doit renseigner l'état de ses travaux avant la fin de journée.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedStatusTab('need_today')}
              className="self-start sm:self-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 flex-shrink-0"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Afficher les tâches à pointer</span>
            </button>
          </div>
        </div>
      )}

      {/* Cartes d'indicateurs KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="card p-3.5">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Tâches</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>

        <div className="card p-3.5 border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10">
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">À pointer ce jour</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1">{stats.needToday}</p>
        </div>

        <div className="card p-3.5 border-l-4 border-l-blue-500">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">En cours</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{stats.inProgress}</p>
        </div>

        <div className="card p-3.5 border-l-4 border-l-rose-500">
          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Bloquées</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">{stats.blocked}</p>
        </div>

        <div className="card p-3.5 border-l-4 border-l-red-500">
          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">En retard</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{stats.late}</p>
        </div>

        <div className="card p-3.5 border-l-4 border-l-emerald-500">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Terminées</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{stats.completed}</p>
        </div>
      </div>

      {/* Barre d'outils et Filtres organisés (Action item de la réunion) */}
      <div className="card p-4 space-y-4">
        {/* Ligne 1 : Recherche client/tâche et sélection rapide de service */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par client (nom, contact, entreprise) ou titre de tâche..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 text-xs sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre Service */}
            <div className="flex items-center gap-1.5 min-w-[190px]">
              <Building2 className="w-4 h-4 text-slate-400" />
              {isServiceManager ? (
                <input
                  type="text"
                  disabled
                  value={services.find((s) => s.id === profile?.service_id)?.name || 'Mon service'}
                  className="input text-xs py-1.5 bg-slate-100 dark:bg-slate-800 cursor-not-allowed font-semibold text-slate-700 dark:text-slate-300"
                />
              ) : (
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="input text-xs py-1.5"
                >
                  <option value="all">Tous les services</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Filtre Technicien / Délégataire */}
            <div className="flex items-center gap-1.5 min-w-[170px]">
              <User className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCollaboratorId}
                onChange={(e) => setSelectedCollaboratorId(e.target.value)}
                className="input text-xs py-1.5"
              >
                <option value="all">Tous les intervenants</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} ({c.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Bascule Mes Tâches */}
            <button
              onClick={() => setOnlyMyTasks(!onlyMyTasks)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                onlyMyTasks
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              Mes tâches uniquement
            </button>
          </div>
        </div>

        {/* Ligne 2 : Onglets de statut organisés */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 dark:border-slate-800/80 pt-3">
          {[
            { id: 'all', label: 'Toutes les tâches', count: stats.total },
            { id: 'need_today', label: '⚠️ À pointer ce jour', count: stats.needToday, highlight: stats.needToday > 0 },
            { id: 'in_progress', label: 'En cours', count: stats.inProgress },
            { id: 'shared', label: '🤝 Tâches partagées', count: tasks.filter((t) => t.secondary_service_ids?.length).length },
            { id: 'blocked', label: '🚨 Bloquées', count: stats.blocked },
            { id: 'late', label: 'En retard', count: stats.late },
            { id: 'completed', label: '✅ Terminées', count: stats.completed },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                selectedStatusTab === tab.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : tab.highlight
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-200'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedStatusTab === tab.id
                  ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-800'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Liste des cartes de tâches */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-400 animate-pulse">Chargement des tâches par service...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Aucune tâche trouvée</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Aucune tâche ne correspond à vos filtres actuels. Modifiez les critères ou créez une nouvelle tâche client.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isLate = !isCompleted && parseISO(task.due_date) < new Date();
            const needsLogToday = !isCompleted && task.last_log_date !== todayStr;
            const daysLeft = differenceInDays(parseISO(task.due_date), new Date());
            const hasBlockers = Boolean(task.last_blockers) || task.status === 'blocked';

            // Services partenaires impliqués
            const secondaryServices = services.filter((s) => task.secondary_service_ids?.includes(s.id));

            return (
              <div
                key={task.id}
                className={`card p-5 transition-all duration-200 border hover:shadow-md flex flex-col justify-between ${
                  needsLogToday
                    ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50/10'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  {/* Ligne 1 : Client & Service Responsable */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {task.visitor ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400">
                          <User className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>
                            Client : {task.visitor.first_name} {task.visitor.last_name}
                            {task.visitor.company ? ` (${task.visitor.company})` : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-slate-400">Tâche interne de service</div>
                      )}
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                        {task.title}
                      </h3>
                    </div>

                    {/* Statut du pointage du jour */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {isCompleted ? (
                        <span className="badge badge-success text-[11px] font-bold">Terminée</span>
                      ) : needsLogToday ? (
                        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40 text-[10px] font-bold animate-pulse">
                          Pointage requis ce jour
                        </span>
                      ) : (
                        <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/40 text-[10px] font-semibold">
                          Pointé aujourd'hui
                        </span>
                      )}

                      {isLate && (
                        <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-bold">
                          Retard ({Math.abs(daysLeft)} j)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description si présente */}
                  {task.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Signalement de blocage éventuel */}
                  {hasBlockers && (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Blocage signalé : </span>
                        <span>{task.last_blockers || 'Obstacle signalé sur cette tâche'}</span>
                      </div>
                    </div>
                  )}

                  {/* Barre de Progression et Étape / Couche */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="truncate max-w-[220px]">
                          Étape : {task.current_stage || 'En démarrage'}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {task.progress_percentage || 0}%
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          task.progress_percentage >= 100
                            ? 'bg-emerald-500'
                            : task.progress_percentage > 60
                            ? 'bg-indigo-600'
                            : task.progress_percentage > 25
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, task.progress_percentage || 0))}%` }}
                      />
                    </div>
                  </div>

                  {/* Attribution & Délégation (Double Responsabilité) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    {/* Responsable de service garant */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Chef Responsable</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {task.service_manager?.full_name || task.service?.name || 'Chef de service'}
                        </span>
                      </div>
                    </div>

                    {/* Technicien délégataire */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60">
                      <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Délégué à</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {task.assigned_collaborator?.full_name || 'Chef de service (Direct)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Services secondaires / partenaires associés */}
                  {secondaryServices.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                      <Share2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="font-semibold text-[11px]">Coordination :</span>
                      {secondaryServices.map((sec) => (
                        <span
                          key={sec.id}
                          className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold"
                        >
                          {sec.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Dates & Délais */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Échéance : {format(parseISO(task.due_date), 'dd MMMM yyyy', { locale: fr })}
                      </span>
                    </div>
                    {!isCompleted && (
                      <span className={`font-semibold ${daysLeft < 0 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                        {daysLeft < 0
                          ? `En retard de ${Math.abs(daysLeft)} jour(s)`
                          : daysLeft === 0
                          ? "Prend fin aujourd'hui !"
                          : `Reste ${daysLeft} jour(s)`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pied de carte : Actions et dépliage de l'historique */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleHistory(task.id)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Journal des rapports</span>
                    {expandedTaskHistory[task.id] ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {!isCompleted && (
                    <button
                      onClick={() => openProgressModal(task)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm ${
                        needsLogToday
                          ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                          : 'bg-primary-600 hover:bg-primary-700 text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{needsLogToday ? 'Pointer ce jour' : 'Mettre à jour'}</span>
                    </button>
                  )}
                </div>

                {/* Historique dépliable des pointages journaliers */}
                {expandedTaskHistory[task.id] && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-fade-in">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Historique des pointages journaliers :
                    </h5>

                    {taskLogs[task.id]?.length === 0 || !taskLogs[task.id] ? (
                      <p className="text-xs text-slate-400 italic">Aucun compte-rendu quotidien n'a encore été consigné.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-56 overflow-y-auto scrollbar-thin pr-1">
                        {taskLogs[task.id].map((log) => (
                          <div
                            key={log.id}
                            className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-xs space-y-1 border border-slate-100 dark:border-slate-800"
                          >
                            <div className="flex items-center justify-between text-slate-500 font-semibold">
                              <span className="text-primary-600 dark:text-primary-400">
                                {format(parseISO(log.log_date), 'dd MMMM yyyy', { locale: fr })}
                              </span>
                              <span className="font-bold text-slate-800 dark:text-white">
                                {log.progress_percentage}% {log.stage_label ? `(${log.stage_label})` : ''}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-normal">{log.summary}</p>
                            {log.blockers && (
                              <p className="text-rose-600 dark:text-rose-400 text-[11px] font-semibold mt-1">
                                🚨 Blocage : {log.blockers}
                              </p>
                            )}
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                              <span>Pointé par {log.author?.full_name || 'Utilisateur'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1 : POINTAGE JOURNALIER / DAILY CHECK-IN */}
      {showProgressModal && selectedTaskForProgress && (
        <div className="modal-backdrop" onClick={() => setShowProgressModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pointage Journalier d'Avancement
                </h3>
                <p className="text-xs text-slate-500 truncate max-w-sm mt-0.5">
                  Tâche : {selectedTaskForProgress.title}
                </p>
              </div>
              <button
                onClick={() => setShowProgressModal(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogProgress} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Curseur et Boutons de Pourcentage Rapide */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label">Niveau d'avancement global</label>
                  <span className="text-base font-bold text-primary-600 dark:text-primary-400">
                    {progressForm.progress_percentage}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressForm.progress_percentage}
                  onChange={(e) =>
                    setProgressForm((p) => ({ ...p, progress_percentage: Number(e.target.value) }))
                  }
                  className="w-full accent-primary-600 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between gap-1 mt-2">
                  {[25, 50, 75, 100].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setProgressForm((p) => ({ ...p, progress_percentage: val }))}
                      className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-colors ${
                        progressForm.progress_percentage === val
                          ? 'bg-primary-50 text-primary-700 border-primary-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {val}% {val === 100 ? '(Terminer)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Étape / Couche actuelle */}
              <div>
                <label className="label">Étape / Couche atteinte</label>
                <input
                  type="text"
                  placeholder="Ex : Couche 2 : Plan 2D validé, démarrage modélisation 3D..."
                  value={progressForm.stage_label}
                  onChange={(e) => setProgressForm((p) => ({ ...p, stage_label: e.target.value }))}
                  className="input text-xs sm:text-sm"
                />
              </div>

              {/* Compte-rendu du travail du jour */}
              <div>
                <label className="label">Compte-rendu du travail effectué aujourd’hui *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Détaillez les actions réalisées ce jour, les résultats obtenus..."
                  value={progressForm.summary}
                  onChange={(e) => setProgressForm((p) => ({ ...p, summary: e.target.value }))}
                  className="input text-xs sm:text-sm"
                />
              </div>

              {/* Blocages ou difficultés rencontrées */}
              <div>
                <label className="label text-rose-700 dark:text-rose-400">
                  Points de blocage ou retards constatés (Optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Indiquez ici tout problème nécessitant l'intervention du chef de service ou de la direction..."
                  value={progressForm.blockers}
                  onChange={(e) => setProgressForm((p) => ({ ...p, blockers: e.target.value }))}
                  className="input text-xs sm:text-sm border-rose-200 dark:border-rose-900/40 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="btn-secondary text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Enregistrer le pointage</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2 : CRÉATION D'UNE NOUVELLE TÂCHE CLIENT */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nouvelle Tâche / Projet Client
                </h3>
                <p className="text-xs text-slate-500">
                  Définition des responsabilités, des étapes et des services impliqués.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Titre */}
              <div>
                <label className="label">Intitulé de la tâche / Projet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Réalisation des plans 2D/3D et métré gros œuvre"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                  className="input text-xs sm:text-sm font-semibold"
                />
              </div>

              {/* Client associé */}
              <div>
                <label className="label">Client concerné (Optionnel)</label>
                <select
                  value={createForm.visitor_id}
                  onChange={(e) => setCreateForm((p) => ({ ...p, visitor_id: e.target.value }))}
                  className="input text-xs sm:text-sm"
                >
                  <option value="">Sélectionner un client...</option>
                  {visitors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.first_name} {v.last_name} {v.company ? `(${v.company})` : ''} - {v.phone || 'Sans contact'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Pilote & Chef Responsable */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Service Pilote *</label>
                  {isServiceManager ? (
                    <input
                      type="text"
                      disabled
                      value={services.find((s) => s.id === profile?.service_id)?.name || 'Mon service'}
                      className="input bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-xs font-semibold"
                    />
                  ) : (
                    <select
                      required
                      value={createForm.service_id}
                      onChange={(e) => setCreateForm((p) => ({ ...p, service_id: e.target.value }))}
                      className="input text-xs sm:text-sm"
                    >
                      <option value="">Sélectionner le service pilote...</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="label">Chef de Service Garant *</label>
                  <select
                    value={createForm.service_manager_id}
                    onChange={(e) => setCreateForm((p) => ({ ...p, service_manager_id: e.target.value }))}
                    className="input text-xs sm:text-sm"
                  >
                    <option value="">Automatique (Responsable du service)</option>
                    {collaborators
                      .filter((c) => ['service_manager', 'director', 'admin'].includes(c.role))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Délégation au technicien (Possibilité de délégation) */}
              <div>
                <label className="label">Déléguer à un technicien / collaborateur</label>
                <select
                  value={createForm.assigned_to}
                  onChange={(e) => setCreateForm((p) => ({ ...p, assigned_to: e.target.value }))}
                  className="input text-xs sm:text-sm"
                >
                  <option value="">Aucune délégation (Géré directement par le chef de service)</option>
                  {collaborators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} - {c.role} {c.service_id ? `(${services.find((s) => s.id === c.service_id)?.name})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 Même en cas de délégation, le responsable de service reste garant de la livraison finale.
                </p>
              </div>

              {/* Coordination : Services Partenaires concernés */}
              <div>
                <label className="label">Services partenaires impliqués (Coordination)</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  {services
                    .filter((s) => s.id !== createForm.service_id)
                    .map((s) => {
                      const isChecked = createForm.secondary_service_ids.includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => toggleSecondaryService(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1 ${
                            isChecked
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                          <span>{s.name}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Dates et délais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Date de démarrage *</label>
                  <input
                    type="date"
                    required
                    value={createForm.start_date}
                    onChange={(e) => setCreateForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="input text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="label">Date de fin prévue (Échéance) *</label>
                  <input
                    type="date"
                    required
                    value={createForm.due_date}
                    onChange={(e) => setCreateForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="input text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Étape initiale */}
              <div>
                <label className="label">Étape initiale / Couche 1</label>
                <input
                  type="text"
                  placeholder="Ex : Couche 1 : Étude préalable et cahier des charges"
                  value={createForm.current_stage}
                  onChange={(e) => setCreateForm((p) => ({ ...p, current_stage: e.target.value }))}
                  className="input text-xs sm:text-sm"
                />
              </div>

              {/* Description détaillée */}
              <div>
                <label className="label">Détails et instructions</label>
                <textarea
                  rows={2}
                  placeholder="Instructions spécifiques pour la bonne réalisation du travail..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                  className="input text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Créer la tâche</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
