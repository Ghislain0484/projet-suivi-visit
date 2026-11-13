import React, { useEffect, useState } from 'react';
import { supabase, ServiceTask, TaskProgressLog, Service, Profile, Visitor, Priority, TaskStatus } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInDays, isPast, parseISO } from 'date-fns';
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
  Edit,
  Trash2,
  Layers,
  Flag,
} from 'lucide-react';

export default function TasksPage() {
  const { user, profile } = useAuth();

  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedTaskForProgress, setSelectedTaskForProgress] = useState<ServiceTask | null>(null);
  const [expandedTaskHistory, setExpandedTaskHistory] = useState<Record<string, boolean>>({});
  const [taskLogs, setTaskLogs] = useState<Record<string, TaskProgressLog[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Create Form State
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    service_id: '',
    visitor_id: '',
    assigned_to: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    current_stage: 'Couche 1 : Démarrage',
    priority: 'normal' as Priority,
  });

  // Progress Log Form State
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
  }, [selectedServiceId, selectedStatus, onlyMyTasks]);

  const fetchMetadata = async () => {
    const [srvRes, colRes, visRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('visitors').select('*').order('last_name').limit(200),
    ]);

    if (srvRes.data) setServices(srvRes.data);
    if (colRes.data) setCollaborators(colRes.data);
    if (visRes.data) setVisitors(visRes.data);

    // Default service for service_manager
    if (profile?.role === 'service_manager' && profile.service_id) {
      setSelectedServiceId(profile.service_id);
      setCreateForm(prev => ({ ...prev, service_id: profile.service_id || '' }));
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('service_tasks')
        .select(`
          *,
          service:services(*),
          visitor:visitors(*),
          assigned_collaborator:profiles!service_tasks_assigned_to_fkey(*),
          creator:profiles!service_tasks_created_by_fkey(*)
        `)
        .order('due_date', { ascending: true });

      // Service isolation: if service_manager, lock to their service
      if (isServiceManager && profile.service_id) {
        query = query.eq('service_id', profile.service_id);
      } else if (selectedServiceId !== 'all') {
        query = query.eq('service_id', selectedServiceId);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      if (onlyMyTasks && user) {
        query = query.eq('assigned_to', user.id);
      }

      const { data, error: err } = await query;
      if (!err && data) {
        setTasks(data as ServiceTask[]);
      } else if (err) {
        console.error('Error fetching tasks:', err);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogsForTask = async (taskId: string) => {
    const { data } = await supabase
      .from('task_progress_logs')
      .select('*, author:profiles(*)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (data) {
      setTaskLogs(prev => ({ ...prev, [taskId]: data as TaskProgressLog[] }));
    }
  };

  const toggleHistory = async (taskId: string) => {
    const isExpanded = Boolean(expandedTaskHistory[taskId]);
    if (!isExpanded && !taskLogs[taskId]) {
      await fetchLogsForTask(taskId);
    }
    setExpandedTaskHistory(prev => ({ ...prev, [taskId]: !isExpanded }));
  };

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

      const { data, error: insertError } = await supabase.from('service_tasks').insert({
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
        service_id: createForm.service_id,
        visitor_id: createForm.visitor_id || null,
        assigned_to: createForm.assigned_to || null,
        created_by: user?.id,
        start_date: createForm.start_date,
        due_date: createForm.due_date,
        estimated_days: estimatedDays,
        progress_percentage: 0,
        current_stage: createForm.current_stage || 'Démarrage',
        priority: createForm.priority,
        status: 'in_progress',
      }).select().single();

      if (insertError) throw insertError;

      // Add initial log
      if (data) {
        await supabase.from('task_progress_logs').insert({
          task_id: data.id,
          logged_by: user?.id,
          log_date: format(new Date(), 'yyyy-MM-dd'),
          progress_percentage: 0,
          stage_label: createForm.current_stage || 'Création du projet',
          summary: 'Tâche initialisée et planifiée pour le service.',
          status: 'in_progress',
        });
      }

      setShowCreateModal(false);
      setCreateForm({
        title: '',
        description: '',
        service_id: isServiceManager && profile?.service_id ? profile.service_id : '',
        visitor_id: '',
        assigned_to: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        current_stage: 'Couche 1 : Démarrage',
        priority: 'normal',
      });
      fetchTasks();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création de la tâche.");
    } finally {
      setSaving(false);
    }
  };

  const openProgressModal = (task: ServiceTask) => {
    setSelectedTaskForProgress(task);
    setProgressForm({
      progress_percentage: task.progress_percentage || 0,
      stage_label: task.current_stage || '',
      summary: '',
      status: task.status,
      blockers: '',
    });
    setShowProgressModal(true);
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForProgress) return;
    if (!progressForm.summary.trim()) {
      setError('Veuillez décrire le travail réalisé aujourd’hui / ce jour.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // 1. Insert progress log
      const { error: logErr } = await supabase.from('task_progress_logs').insert({
        task_id: selectedTaskForProgress.id,
        logged_by: user?.id,
        log_date: format(new Date(), 'yyyy-MM-dd'),
        progress_percentage: Number(progressForm.progress_percentage),
        stage_label: progressForm.stage_label.trim() || null,
        summary: progressForm.summary.trim(),
        status: progressForm.status,
        blockers: progressForm.blockers.trim() || null,
      });

      if (logErr) throw logErr;

      // 2. Also directly update parent task for instant UI consistency
      const newStatus = Number(progressForm.progress_percentage) >= 100 ? 'completed' : progressForm.status;
      await supabase.from('service_tasks').update({
        progress_percentage: Number(progressForm.progress_percentage),
        current_stage: progressForm.stage_label.trim() || selectedTaskForProgress.current_stage,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedTaskForProgress.id);

      setShowProgressModal(false);
      setSelectedTaskForProgress(null);
      await fetchTasks();
      // Refresh task logs cache
      await fetchLogsForTask(selectedTaskForProgress.id);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement du pointage.");
    } finally {
      setSaving(false);
    }
  };

  // KPIs
  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
  const lateTasks = tasks.filter(t => t.status !== 'completed' && isPast(parseISO(t.due_date))).length;
  const avgProgress = totalTasks > 0 ? Math.round(tasks.reduce((sum, t) => sum + (t.progress_percentage || 0), 0) / totalTasks) : 0;

  // Filter tasks by search term
  const filteredTasks = tasks.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchTitle = t.title.toLowerCase().includes(q);
    const matchDesc = t.description?.toLowerCase().includes(q);
    const matchService = t.service?.name.toLowerCase().includes(q);
    const matchClient = t.visitor ? `${t.visitor.first_name} ${t.visitor.last_name} ${t.visitor.company || ''}`.toLowerCase().includes(q) : false;
    const matchAssignee = t.assigned_collaborator?.full_name.toLowerCase().includes(q);
    return matchTitle || matchDesc || matchService || matchClient || matchAssignee;
  });

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <span className="badge bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">Terminé</span>;
      case 'in_progress':
        return <span className="badge bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">En cours</span>;
      case 'review':
        return <span className="badge bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400">En révision</span>;
      case 'blocked':
        return <span className="badge bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400">Bloqué</span>;
      default:
        return <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">En attente</span>;
    }
  };

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'urgent':
        return <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1"><Flag className="w-3 h-3 fill-current" /> Urgent</span>;
      case 'high':
        return <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1"><Flag className="w-3 h-3 fill-current" /> Haute</span>;
      default:
        return <span className="text-[10px] font-bold uppercase text-slate-400">Normale</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider">
            <Layers className="w-4 h-4" /> Pilotage & Réalisations Métiers
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            Tâches & Projets par Service
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Suivi quotidien de l'avancement des réalisations clients, pointages d'étapes et respect des délais.
          </p>
        </div>

        {canCreateTask && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 shadow-lg shadow-primary-500/20"
          >
            <Plus className="w-4.5 h-4.5" />
            Nouvelle Tâche / Projet
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="card p-4 border-l-4 border-primary-500">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Tâches</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalTasks}</p>
        </div>
        <div className="card p-4 border-l-4 border-blue-500">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">En Cours</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{inProgressTasks}</p>
        </div>
        <div className="card p-4 border-l-4 border-emerald-500">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Terminées</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{completedTasks}</p>
        </div>
        <div className="card p-4 border-l-4 border-rose-500">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">En Retard / Bloquées</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{lateTasks + blockedTasks}</p>
        </div>
        <div className="card p-4 border-l-4 border-purple-500 col-span-2 lg:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avancement Moyen</span>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{avgProgress}%</p>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre, client, service, responsable..."
              className="input pl-10 text-xs py-2 w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Service Filter (Disabled or hidden if service_manager) */}
            {!isServiceManager && (
              <select
                value={selectedServiceId}
                onChange={e => setSelectedServiceId(e.target.value)}
                className="input text-xs py-2 w-full sm:w-auto"
              >
                <option value="all">Tous les services</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="input text-xs py-2 w-full sm:w-auto"
            >
              <option value="all">Tous les statuts</option>
              <option value="in_progress">En cours</option>
              <option value="review">En révision</option>
              <option value="blocked">Bloqué</option>
              <option value="completed">Terminé</option>
            </select>

            {/* My Tasks Toggle */}
            <button
              onClick={() => setOnlyMyTasks(!onlyMyTasks)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                onlyMyTasks
                  ? 'bg-primary-50 text-primary-700 border-primary-300 dark:bg-primary-950/40 dark:border-primary-800'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              Mes tâches uniquement
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <CheckSquare className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Aucune tâche trouvée</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Aucun projet ou tâche ne correspond à vos filtres actuels. Cliquez sur « Nouvelle Tâche » pour planifier un travail.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map(task => {
            const isLate = task.status !== 'completed' && isPast(parseISO(task.due_date));
            const daysLeft = differenceInDays(parseISO(task.due_date), new Date());
            const isAssigneeOrManager = user && (
              task.assigned_to === user.id ||
              isGlobalSupervisor ||
              (isServiceManager && profile?.service_id === task.service_id)
            );

            return (
              <div
                key={task.id}
                className={`card p-5 transition-all hover:shadow-md border-l-4 ${
                  task.status === 'completed'
                    ? 'border-l-emerald-500'
                    : task.status === 'blocked' || isLate
                    ? 'border-l-rose-500'
                    : 'border-l-primary-500'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Title & Metadata */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-primary-500" />
                        {task.service?.name || 'Service'}
                      </span>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                      {isLate && (
                        <span className="badge bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> En retard de {Math.abs(daysLeft)} jour(s)
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      {task.visitor && (
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <User className="w-3.5 h-3.5 text-primary-500" />
                          Client : {task.visitor.first_name} {task.visitor.last_name} {task.visitor.company ? `(${task.visitor.company})` : ''}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        Responsable : <strong className="text-slate-800 dark:text-slate-200">{task.assigned_collaborator?.full_name || 'Non assigné'}</strong>
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Du {format(parseISO(task.start_date), 'dd/MM/yyyy')} au {format(parseISO(task.due_date), 'dd/MM/yyyy')}
                        {!isLate && task.status !== 'completed' && (
                          <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">
                            ({daysLeft}j restant(s) / {task.estimated_days}j prévus)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Progress Bar & Current Stage */}
                  <div className="w-full lg:w-72 space-y-2 p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-primary-500" />
                        {task.current_stage || 'En progression'}
                      </span>
                      <span className="font-mono font-black text-primary-600 dark:text-primary-400 text-sm">
                        {task.progress_percentage}%
                      </span>
                    </div>

                    {/* Progress bar track */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          task.progress_percentage >= 100
                            ? 'bg-emerald-500'
                            : task.status === 'blocked'
                            ? 'bg-rose-500'
                            : 'bg-primary-600'
                        }`}
                        style={{ width: `${task.progress_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex lg:flex-col items-center justify-end gap-2 shrink-0">
                    {isAssigneeOrManager && task.status !== 'completed' && (
                      <button
                        onClick={() => openProgressModal(task)}
                        className="btn-primary text-xs py-2 px-3.5 w-full flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Pointage du jour
                      </button>
                    )}

                    <button
                      onClick={() => toggleHistory(task.id)}
                      className="btn-secondary text-xs py-2 px-3 w-full flex items-center justify-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Journal
                      {expandedTaskHistory[task.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Timeline History Accordion */}
                {expandedTaskHistory[task.id] && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-slide-in-top">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary-500" />
                      Historique chronologique des avancements quotidiens
                    </h4>

                    {taskLogs[task.id] && taskLogs[task.id].length > 0 ? (
                      <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                        {taskLogs[task.id].map(log => (
                          <div key={log.id} className="relative space-y-1">
                            {/* Dot on line */}
                            <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary-500 ring-4 ring-white dark:ring-slate-900" />
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-bold text-slate-800 dark:text-white">
                                {format(parseISO(log.log_date), 'dd/MM/yyyy')}
                              </span>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                                {log.progress_percentage}%
                              </span>
                              {log.stage_label && (
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                  — {log.stage_label}
                                </span>
                              )}
                              <span className="text-slate-400 text-[10px]">
                                par {log.author?.full_name || 'Utilisateur'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                              {log.summary}
                            </p>
                            {log.blockers && (
                              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1 pl-1">
                                <AlertTriangle className="w-3 h-3" /> <strong>Blocage :</strong> {log.blockers}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic py-2">Aucun pointage détaillé enregistré pour l'instant.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Pointage & Avancement Journalier */}
      {showProgressModal && selectedTaskForProgress && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6 space-y-5 animate-scale-up shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-primary-600 dark:text-primary-400">Pointage quotidien / fin de journée</span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Marquer l'avancement</h3>
                <p className="text-xs text-slate-500 font-medium truncate max-w-sm">{selectedTaskForProgress.title}</p>
              </div>
              <button onClick={() => setShowProgressModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveProgress} className="space-y-4">
              {/* Progress Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-extrabold uppercase text-slate-600 dark:text-slate-300">Niveau d'avancement (%)</label>
                  <span className="font-mono text-base font-black text-primary-600">{progressForm.progress_percentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressForm.progress_percentage}
                  onChange={e => setProgressForm({ ...progressForm, progress_percentage: Number(e.target.value) })}
                  className="w-full accent-primary-600 cursor-pointer"
                />
              </div>

              {/* Current stage / Couche */}
              <div>
                <label className="label">Étape / Couche actuelle</label>
                <input
                  type="text"
                  value={progressForm.stage_label}
                  onChange={e => setProgressForm({ ...progressForm, stage_label: e.target.value })}
                  placeholder="Ex : Couche 2 : Plan 2D finalisé, Début 3D..."
                  className="input"
                  required
                />
              </div>

              {/* Status */}
              <div>
                <label className="label">Statut</label>
                <select
                  value={progressForm.status}
                  onChange={e => setProgressForm({ ...progressForm, status: e.target.value as TaskStatus })}
                  className="input"
                >
                  <option value="in_progress">En cours</option>
                  <option value="review">En révision / Attente validation client</option>
                  <option value="blocked">Bloqué</option>
                  <option value="completed">Terminé (100%)</option>
                </select>
              </div>

              {/* Daily Summary */}
              <div>
                <label className="label">Compte-rendu du jour / Réalisations *</label>
                <textarea
                  rows={3}
                  value={progressForm.summary}
                  onChange={e => setProgressForm({ ...progressForm, summary: e.target.value })}
                  placeholder="Décrivez ce qui a été fait aujourd'hui, les avancées concrètes sur la tâche..."
                  className="input"
                  required
                />
              </div>

              {/* Blockers */}
              <div>
                <label className="label">Blocages ou difficultés éventuels (Optionnel)</label>
                <input
                  type="text"
                  value={progressForm.blockers}
                  onChange={e => setProgressForm({ ...progressForm, blockers: e.target.value })}
                  placeholder="Ex : Attente documents du géomètre, validation du client..."
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowProgressModal(false)} className="btn-secondary text-xs">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs px-5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Enregistrer le pointage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Créer une Nouvelle Tâche / Projet */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl p-6 space-y-5 animate-scale-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-primary-600 dark:text-primary-400">Attribution de travail</span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Créer une Tâche / Projet Métier</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Service */}
                <div>
                  <label className="label">Service Responsable *</label>
                  <select
                    value={createForm.service_id}
                    onChange={e => setCreateForm({ ...createForm, service_id: e.target.value })}
                    required
                    disabled={Boolean(isServiceManager && profile?.service_id)}
                    className="input"
                  >
                    <option value="">Sélectionner un service</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Client / Visiteur */}
                <div>
                  <label className="label">Client / Visiteur associé</label>
                  <select
                    value={createForm.visitor_id}
                    onChange={e => setCreateForm({ ...createForm, visitor_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Aucun client rattaché</option>
                    {visitors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.first_name} {v.last_name} {v.company ? `(${v.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="label">Titre de la tâche / Réalisation *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="Ex : Réalisation des plans 2D / 3D Villa Duplex"
                  className="input"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description / Cahier des charges</label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Détails du travail attendu, spécifications techniques, consignes du client..."
                  className="input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Collaborateur assigné */}
                <div>
                  <label className="label">Responsable de la tâche</label>
                  <select
                    value={createForm.assigned_to}
                    onChange={e => setCreateForm({ ...createForm, assigned_to: e.target.value })}
                    className="input"
                  >
                    <option value="">Non assigné</option>
                    {collaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name} ({c.role})</option>
                    ))}
                  </select>
                </div>

                {/* Date début */}
                <div>
                  <label className="label">Date de début *</label>
                  <input
                    type="date"
                    value={createForm.start_date}
                    onChange={e => setCreateForm({ ...createForm, start_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                {/* Date fin / échéance */}
                <div>
                  <label className="label">Date d'échéance (Deadline) *</label>
                  <input
                    type="date"
                    value={createForm.due_date}
                    onChange={e => setCreateForm({ ...createForm, due_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Étape initiale */}
                <div>
                  <label className="label">Étape / Couche de départ</label>
                  <input
                    type="text"
                    value={createForm.current_stage}
                    onChange={e => setCreateForm({ ...createForm, current_stage: e.target.value })}
                    placeholder="Ex : Couche 1 : Esquisse / Relevé"
                    className="input"
                  />
                </div>

                {/* Priorité */}
                <div>
                  <label className="label">Niveau de Priorité</label>
                  <select
                    value={createForm.priority}
                    onChange={e => setCreateForm({ ...createForm, priority: e.target.value as Priority })}
                    className="input"
                  >
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                    <option value="low">Faible</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary text-xs">
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs px-6">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Créer la tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
