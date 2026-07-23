import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Appointment, Visitor, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  X,
  Save,
  Trash2,
  Sparkles,
  Loader2,
  Search,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';

interface UnifiedEvent {
  id: string;
  type: 'appointment' | 'visit' | 'mission' | 'absence';
  title: string;
  description: string;
  start_time: Date;
  end_time: Date;
  user_name: string;
  user_role: string;
  user_id: string;
  status: string;
  extra_label?: string;
  rawObject: any;
}

export default function AgendaPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [showModal, setShowModal] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);

  // Unified events states
  const [unifiedEvents, setUnifiedEvents] = useState<UnifiedEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);

  // Filters state
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCollaborator, setFilterCollaborator] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form state for appointments creation/modification
  const [form, setForm] = useState({
    title: '',
    description: '',
    visitor_id: '',
    assigned_to: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:00',
  });

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchEvents();
    // Subscribe to realtime changes
    const channel = supabase
      .channel('agenda-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { fetchEvents(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { fetchEvents(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => { fetchEvents(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permissions' }, () => { fetchEvents(); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDate, view, profile]);

  const fetchMetadata = async () => {
    await Promise.all([
      fetchVisitors(),
      fetchCollaborators(),
    ]);
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // 1. Fetch appointments
      let apptQuery = supabase.from('appointments').select(`
        *,
        visitor:visitors(*),
        collaborator:profiles!appointments_assigned_to_fkey(*)
      `);
      if (profile && profile.role === 'collaborator') {
        apptQuery = apptQuery.or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`);
      }
      const { data: appts } = await apptQuery;

      // 2. Fetch visits
      let visitQuery = supabase.from('visits').select(`
        *,
        visitor:visitors(*),
        assigned_collaborator:profiles(*)
      `);
      if (profile && profile.role === 'collaborator') {
        visitQuery = visitQuery.eq('assigned_collaborator_id', profile.id);
      }
      const { data: visitsData } = await visitQuery;

      // 3. Fetch missions
      let missionQuery = supabase.from('missions').select(`
        *,
        profile:profiles(*)
      `);
      if (profile && profile.role === 'collaborator') {
        missionQuery = missionQuery.eq('user_id', profile.id);
      }
      const { data: missionsData } = await missionQuery;

      // 4. Fetch permissions (absences and leaves)
      let permQuery = supabase.from('permissions').select(`
        *,
        profile:profiles!user_id(*)
      `).eq('status', 'approved');
      if (profile && profile.role === 'collaborator') {
        permQuery = permQuery.eq('user_id', profile.id);
      }
      const { data: permsData } = await permQuery;

      // Map to UnifiedEvents
      const mappedAppts: UnifiedEvent[] = (appts || []).map(appt => ({
        id: appt.id,
        type: 'appointment',
        title: appt.title,
        description: appt.description || '',
        start_time: new Date(appt.start_time),
        end_time: new Date(appt.end_time),
        user_name: appt.collaborator?.full_name || 'Non assigné',
        user_role: appt.collaborator?.role || '',
        user_id: appt.assigned_to,
        status: 'scheduled',
        extra_label: appt.visitor ? `${appt.visitor.first_name} ${appt.visitor.last_name}` : '',
        rawObject: appt
      }));

      const mappedVisits: UnifiedEvent[] = (visitsData || []).map(v => ({
        id: v.id,
        type: 'visit',
        title: v.visitor ? `Visite : ${v.visitor.first_name} ${v.visitor.last_name}` : `Visite : ${v.purpose}`,
        description: v.observations || v.purpose || '',
        start_time: new Date(v.arrival_time),
        end_time: v.departure_time 
          ? new Date(v.departure_time) 
          : new Date(new Date(v.arrival_time).getTime() + 60 * 60 * 1000),
        user_name: v.assigned_collaborator?.full_name || 'Non assigné',
        user_role: v.assigned_collaborator?.role || '',
        user_id: v.assigned_collaborator_id || '',
        status: v.status,
        extra_label: v.visitor?.company ? `Société : ${v.visitor.company}` : '',
        rawObject: v
      }));

      const mappedMissions: UnifiedEvent[] = (missionsData || []).map(m => ({
        id: m.id,
        type: 'mission',
        title: `Mission : ${m.purpose}`,
        description: `Mission terrain à ${m.destination}.`,
        start_time: new Date(m.departure_time),
        end_time: new Date(m.expected_return),
        user_name: m.profile?.full_name || 'Non assigné',
        user_role: m.profile?.role || '',
        user_id: m.user_id,
        status: m.status,
        extra_label: `Lieu : ${m.destination}`,
        rawObject: m
      }));

      const mappedPerms: UnifiedEvent[] = (permsData || []).map(p => ({
        id: p.id,
        type: 'absence',
        title: `Absence : ${p.profile?.full_name || 'Employé'}`,
        description: p.reason,
        start_time: new Date(p.start_date + 'T00:00:00'),
        end_time: new Date(p.end_date + 'T23:59:59'),
        user_name: p.profile?.full_name || 'Non assigné',
        user_role: p.profile?.role || '',
        user_id: p.user_id,
        status: p.status,
        extra_label: p.type === 'leave' ? 'Congés Annuels' : p.type === 'absence' ? 'Absence Justifiée' : 'Permission Exceptionnelle',
        rawObject: p
      }));

      setUnifiedEvents([
        ...mappedAppts,
        ...mappedVisits,
        ...mappedMissions,
        ...mappedPerms
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitors = async () => {
    const { data } = await supabase.from('visitors').select('*').order('last_name', { ascending: true });
    if (data) setVisitors(data);
  };

  const fetchCollaborators = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name', { ascending: true });
    if (data) setCollaborators(data);
  };

  // Compute filtered events
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter(evt => {
      // 1. Category
      if (filterType !== 'all' && evt.type !== filterType) return false;

      // 2. Collaborator
      if (filterCollaborator !== 'all' && evt.user_id !== filterCollaborator) return false;

      // 3. Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = evt.title.toLowerCase().includes(query);
        const matchesDesc = evt.description.toLowerCase().includes(query);
        const matchesUser = evt.user_name.toLowerCase().includes(query);
        const matchesExtra = evt.extra_label?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesUser && !matchesExtra) return false;
      }
      return true;
    });
  }, [unifiedEvents, filterType, filterCollaborator, searchQuery]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const startISO = new Date(`${form.date}T${form.start_time}`).toISOString();
    const endISO = new Date(`${form.date}T${form.end_time}`).toISOString();

    const apptData = {
      title: form.title,
      description: form.description || null,
      visitor_id: form.visitor_id || null,
      assigned_to: form.assigned_to,
      start_time: startISO,
      end_time: endISO,
      updated_at: new Date().toISOString(),
    };

    try {
      if (selectedAppt) {
        const { error } = await supabase
          .from('appointments')
          .update(apptData)
          .eq('id', selectedAppt.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appointments')
          .insert({
            ...apptData,
            created_by: profile.id,
          });
        if (error) throw error;
      }
      setShowModal(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch (err: any) {
      alert(err.message || "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Voulez-vous vraiment annuler ce rendez-vous ?")) return;
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (!error) {
      setShowModal(false);
      setSelectedEvent(null);
      fetchEvents();
    }
  };

  const openAddModal = (date = new Date()) => {
    setSelectedAppt(null);
    setSelectedEvent({
      id: '',
      type: 'appointment',
      title: '',
      description: '',
      start_time: date,
      end_time: date,
      user_name: '',
      user_role: '',
      user_id: '',
      status: 'scheduled',
      rawObject: null
    });
    setForm({
      title: '',
      description: '',
      visitor_id: '',
      assigned_to: profile?.id || '',
      date: format(date, 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '10:00',
    });
    setShowModal(true);
  };

  const openEditModal = (appt: Appointment) => {
    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);
    setSelectedAppt(appt);
    setForm({
      title: appt.title,
      description: appt.description || '',
      visitor_id: appt.visitor_id || '',
      assigned_to: appt.assigned_to,
      date: format(start, 'yyyy-MM-dd'),
      start_time: format(start, 'HH:mm'),
      end_time: format(end, 'HH:mm'),
    });
    setShowModal(true);
  };

  const handleEventClick = (evt: UnifiedEvent) => {
    setSelectedEvent(evt);
    if (evt.type === 'appointment') {
      openEditModal(evt.rawObject);
    } else {
      setShowModal(true);
    }
  };

  const getDays = () => {
    if (view === 'day') {
      return [currentDate];
    } else if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    }
  };

  const days = getDays();

  const handlePrev = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, -1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNext = () => {
    if (view === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isNew = !selectedAppt;
  const hasEditPermission = () => {
    if (!profile) return false;
    if (['admin', 'reception', 'director'].includes(profile.role)) return true;
    if (selectedAppt) {
      return selectedAppt.created_by === profile.id || selectedAppt.assigned_to === profile.id;
    }
    return true;
  };
  const canEdit = isNew || hasEditPermission();

  const eventStyles = {
    appointment: {
      bg: 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200/50 dark:border-blue-800/40',
      indicator: 'bg-blue-600 dark:bg-blue-500',
      label: 'Rendez-vous'
    },
    visit: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200/50 dark:border-emerald-800/40',
      indicator: 'bg-emerald-600 dark:bg-emerald-500',
      label: 'Visite site'
    },
    mission: {
      bg: 'bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100/50 dark:hover:bg-purple-950/30',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200/50 dark:border-purple-800/40',
      indicator: 'bg-purple-600 dark:bg-purple-500',
      label: 'Mission'
    },
    absence: {
      bg: 'bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200/50 dark:border-amber-800/40',
      indicator: 'bg-amber-600 dark:bg-amber-500',
      label: 'Absence/Congé'
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Tour de contrôle opérationnelle
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Agenda Global</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Visualiser et piloter toutes les activités : rendez-vous clients, visites sur site, missions terrain et absences.
          </p>
        </div>

        {profile && (
          <button onClick={() => openAddModal()} className="btn-primary shrink-0">
            <Plus className="w-4.5 h-4.5 mr-2" />
            Planifier un RDV
          </button>
        )}
      </div>

      {/* Control Tower Filters Panel */}
      <div className="card p-4 space-y-4">
        {/* Navigation & View switcher */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={handlePrev} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-white capitalize">
              {view === 'month' ? format(currentDate, 'MMMM yyyy', { locale: fr }) : `Semaine du ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd MMMM yyyy', { locale: fr })}`}
            </h2>
            <button onClick={handleNext} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  view === v
                    ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {v === 'day' ? 'Jour' : v === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
        </div>

        {/* Categories, Collaborator, Search Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Category Chips */}
          <div className="lg:col-span-6 flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              Tous
            </button>
            {(Object.keys(eventStyles) as Array<keyof typeof eventStyles>).map((key) => {
              const style = eventStyles[key];
              const isSelected = filterType === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    isSelected
                      ? `${style.bg} ${style.text} ${style.border} scale-[1.02] shadow-sm`
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:scale-[1.01]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${style.indicator}`} />
                  {style.label}
                </button>
              );
            })}
          </div>

          {/* Collaborator select */}
          <div className="lg:col-span-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={filterCollaborator}
                onChange={(e) => setFilterCollaborator(e.target.value)}
                className="input pl-9 py-1.5 text-xs bg-slate-50 dark:bg-slate-900"
              >
                <option value="all">Tous les collaborateurs</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Keyword Search */}
          <div className="lg:col-span-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher objet, agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 py-1.5 text-xs bg-slate-50 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] card p-8 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          <p className="text-xs text-slate-400 font-bold animate-pulse">Chargement de la tour de contrôle...</p>
        </div>
      ) : (
        <div className="card p-6 overflow-x-auto scrollbar-thin">
          <div className={`min-w-[700px] grid gap-4 ${view === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`}>
            {view === 'month' ? (
              // Month days list
              days.map((day) => {
                const dayEvts = filteredEvents.filter((evt) => isSameDay(evt.start_time, day));
                return (
                  <div
                    key={day.toString()}
                    onClick={() => openAddModal(day)}
                    className={`min-h-[120px] border border-slate-100 dark:border-slate-800/60 p-2 rounded-2xl flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/20 cursor-pointer transition-colors duration-200 ${
                      isSameDay(new Date(), day) ? 'bg-primary-50/20 dark:bg-primary-950/10 border-primary-500/30 shadow-inner' : ''
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">{format(day, 'dd')}</span>
                    <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[100px] scrollbar-none">
                      {dayEvts.map((evt) => {
                        const style = eventStyles[evt.type];
                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(evt);
                            }}
                            className={`text-[9px] p-1.5 ${style.bg} ${style.text} rounded-lg truncate font-extrabold hover:scale-[1.02] transition-transform border ${style.border} flex items-center gap-1.5`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${style.indicator} shrink-0`} />
                            <span className="truncate">{evt.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              // Week / Day columns layout
              days.map((day) => {
                const dayEvts = filteredEvents.filter((evt) => isSameDay(evt.start_time, day));
                return (
                  <div key={day.toString()} className="space-y-3">
                    <div className="text-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider">{format(day, 'eee', { locale: fr })}</p>
                      <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{format(day, 'd')}</p>
                    </div>

                    <div className="space-y-3 min-h-[300px]">
                      {dayEvts.length === 0 ? (
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center py-12 italic font-medium">Aucun événement</p>
                      ) : (
                        dayEvts.map((evt) => {
                          const style = eventStyles[evt.type];
                          return (
                            <div
                              key={evt.id}
                              onClick={() => handleEventClick(evt)}
                              className={`p-3.5 ${style.bg} border ${style.border} rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer space-y-2.5 relative overflow-hidden group`}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.indicator}`}></div>
                              <div className="flex items-start justify-between gap-1">
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${style.indicator} text-white`}>
                                  {style.label}
                                </span>
                                {evt.status && (
                                  <span className="text-[8px] font-extrabold text-slate-400 bg-white/80 dark:bg-slate-950/60 px-1.5 py-0.5 rounded border">
                                    {evt.status === 'in_progress' ? 'En cours' : evt.status === 'completed' ? 'Terminé' : evt.status === 'approved' ? 'Approuvé' : evt.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-slate-800 dark:text-white leading-snug line-clamp-2">{evt.title}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {format(evt.start_time, 'HH:mm')} - {format(evt.end_time, 'HH:mm')}
                              </div>
                              {evt.extra_label && (
                                <div className="text-[9px] text-slate-500 dark:text-slate-400 font-extrabold bg-white/70 dark:bg-slate-950/40 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800/40 truncate">
                                  {evt.extra_label}
                                </div>
                              )}
                              <div className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>Agent : <strong className="text-slate-500">{evt.user_name}</strong></span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Unified Event / Form Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => { setShowModal(false); setSelectedEvent(null); }}>
          <div className="modal max-w-lg animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedEvent?.type === 'appointment'
                  ? (selectedAppt ? 'Modifier le RDV' : 'Nouveau Rendez-vous')
                  : selectedEvent
                  ? 'Détails de l\'activité'
                  : 'Nouveau Rendez-vous'
                }
              </h3>
              <button onClick={() => { setShowModal(false); setSelectedEvent(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedEvent && selectedEvent.type !== 'appointment' ? (
              // RENDER SYSTEM EVENT DETAIL VIEW
              <div className="p-6 space-y-5 text-xs">
                <div className={`p-4 rounded-2xl border ${eventStyles[selectedEvent.type].bg} ${eventStyles[selectedEvent.type].border} space-y-2`}>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white dark:bg-slate-950 ${eventStyles[selectedEvent.type].text}`}>
                    {eventStyles[selectedEvent.type].label}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mt-2">{selectedEvent.title}</h4>
                  <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">"{selectedEvent.description}"</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Date & Heure
                    </span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">
                      Le {format(selectedEvent.start_time, 'dd MMMM yyyy', { locale: fr })}<br />
                      de {format(selectedEvent.start_time, 'HH:mm')} à {format(selectedEvent.end_time, 'HH:mm')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Collaborateur
                    </span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">
                      {selectedEvent.user_name}
                      <span className="text-slate-400 font-bold block text-[10px]">{selectedEvent.user_role || 'N/A'}</span>
                    </span>
                  </div>
                </div>

                {selectedEvent.extra_label && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Information :</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{selectedEvent.extra_label}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      if (selectedEvent.type === 'visit') {
                        navigate(`/visits/${selectedEvent.rawObject.id}`);
                      } else if (selectedEvent.type === 'mission') {
                        navigate('/missions');
                      } else if (selectedEvent.type === 'absence') {
                        navigate('/permissions');
                      }
                      setSelectedEvent(null);
                    }}
                    className="btn-primary flex items-center gap-1.5 shadow-sm rounded-xl py-2 px-4"
                  >
                    <span>Accéder au module</span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setSelectedEvent(null); }}
                    className="btn-secondary rounded-xl py-2 px-4"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              // RENDER EXISTING EDIT APPOINTMENT FORM
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="label">Objet du rdv *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    className="input"
                    placeholder="Ex: Réunion projet construction"
                    required
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <label className="label">Description / Détails</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="input min-h-[80px]"
                    placeholder="Notes complémentaires..."
                    disabled={!canEdit}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Visiteur concerné</label>
                    <select
                      value={form.visitor_id}
                      onChange={(e) => setForm((p) => ({ ...p, visitor_id: e.target.value }))}
                      className="input"
                      disabled={!canEdit}
                    >
                      <option value="">-- Aucun --</option>
                      {visitors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.last_name} {v.first_name} {v.company ? `(${v.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Collaborateur assigné *</label>
                    <select
                      value={form.assigned_to}
                      onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                      className="input"
                      required
                      disabled={!canEdit}
                    >
                      <option value="">-- Choisir --</option>
                      {collaborators.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Date *</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                      className="input"
                      required
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="label">Heure Début *</label>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                      className="input"
                      required
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="label">Heure Fin *</label>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                      className="input"
                      required
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800/80">
                  {selectedAppt && hasEditPermission() ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedAppt.id)}
                      className="btn-danger py-2 px-4 text-xs"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Annuler le RDV
                    </button>
                  ) : (
                    <div></div>
                  )}

                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowModal(false); setSelectedEvent(null); }} className="btn-secondary text-xs">
                      Fermer
                    </button>
                    {canEdit && (
                      <button type="submit" disabled={saving} className="btn-primary text-xs px-5">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1.5" />}
                        Enregistrer
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
