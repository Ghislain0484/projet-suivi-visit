import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

export default function AgendaPage() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [showModal, setShowModal] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
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
    fetchData();
    // Subscribe to realtime changes
    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDate, view, profile]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAppointments(),
      fetchVisitors(),
      fetchCollaborators(),
    ]);
    setLoading(false);
  };

  const fetchAppointments = async () => {
    let query = supabase.from('appointments').select(`
      *,
      visitor:visitors(*),
      collaborator:profiles(*)
    `);

    // Restrict standard collaborators to see only their appointments
    if (profile && profile.role === 'collaborator') {
      query = query.eq('assigned_to', profile.id);
    }

    const { data, error } = await query;
    if (!error && data) {
      setAppointments(data as any);
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
        // Update
        const { error } = await supabase
          .from('appointments')
          .update(apptData)
          .eq('id', selectedAppt.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('appointments')
          .insert({
            ...apptData,
            created_by: profile.id,
          });
        if (error) throw error;
      }
      setShowModal(false);
      fetchAppointments();
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
      fetchAppointments();
    }
  };

  const openAddModal = (date = new Date()) => {
    setSelectedAppt(null);
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

  // Rendering Helper: Get days list depending on view
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

  // Navigation handlers
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

  // Check roles permissions
  const canModify = profile && ['admin', 'reception', 'director'].includes(profile.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Agenda professionnel
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Agenda Centralisé</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {profile?.role === 'collaborator' ? 'Vos rendez-vous et planning personnels' : 'Vue d\'ensemble de tous les rendez-vous et plannings'}
          </p>
        </div>

        {canModify && (
          <button onClick={() => openAddModal()} className="btn-primary shrink-0">
            <Plus className="w-4.5 h-4.5 mr-2" />
            Planifier un RDV
          </button>
        )}
      </div>

      {/* View Switchers and Navigation */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={handlePrev} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-slate-800 dark:text-white capitalize">
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

      {/* Calendar Grid rendering */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner h-8 w-8"></div>
        </div>
      ) : (
        <div className="card p-6 overflow-x-auto scrollbar-thin">
          <div className="min-w-[700px] grid grid-cols-7 gap-4">
            {/* Header labels */}
            {view === 'month' ? (
              // Month days list
              days.map((day) => {
                const dayAppts = appointments.filter((appt) => isSameDay(new Date(appt.start_time), day));
                return (
                  <div
                    key={day.toString()}
                    onClick={() => canModify && openAddModal(day)}
                    className={`min-h-[100px] border border-slate-100 dark:border-slate-800/60 p-2 rounded-2xl flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/20 cursor-pointer ${
                      isSameDay(new Date(), day) ? 'bg-primary-50/20 dark:bg-primary-950/10 border-primary-500/30' : ''
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{format(day, 'dd')}</span>
                    <div className="space-y-1 mt-2 flex-1 overflow-y-auto">
                      {dayAppts.map((appt) => (
                        <div
                          key={appt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(appt);
                          }}
                          className="text-[10px] p-1.5 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 rounded-lg truncate font-bold hover:scale-[1.02] transition-transform border border-primary-100/10"
                        >
                          {appt.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              // Week / Day columns layout
              days.map((day) => {
                const dayAppts = appointments.filter((appt) => isSameDay(new Date(appt.start_time), day));
                return (
                  <div key={day.toString()} className="space-y-3">
                    <div className="text-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">{format(day, 'eee', { locale: fr })}</p>
                      <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{format(day, 'd')}</p>
                    </div>

                    <div className="space-y-3">
                      {dayAppts.length === 0 ? (
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center py-6 italic font-medium">Aucun rdv</p>
                      ) : (
                        dayAppts.map((appt) => {
                          const start = new Date(appt.start_time);
                          return (
                            <div
                              key={appt.id}
                              onClick={() => openEditModal(appt)}
                              className="p-3 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/60 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer space-y-2 relative overflow-hidden group"
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600 dark:bg-primary-500"></div>
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{appt.title}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {format(start, 'HH:mm')}
                              </div>
                              {appt.visitor && (
                                <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-950 p-1 rounded-md border border-slate-100 dark:border-slate-800/40">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span className="truncate">{appt.visitor.first_name} {appt.visitor.last_name}</span>
                                </div>
                              )}
                              {!profile || profile.role !== 'collaborator' ? (
                                <div className="text-[9px] text-slate-400 font-medium">
                                  Pour : <span className="font-bold text-slate-500">{(appt as any).collaborator?.full_name || 'N/A'}</span>
                                </div>
                              ) : null}
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

      {/* Appointment Detail / Form Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedAppt ? 'Modifier le RDV' : 'Nouveau Rendez-vous'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  disabled={!canModify}
                />
              </div>

              <div>
                <label className="label">Description / Détails</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="input min-h-[80px]"
                  placeholder="Notes complémentaires..."
                  disabled={!canModify}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Visiteur concerné</label>
                  <select
                    value={form.visitor_id}
                    onChange={(e) => setForm((p) => ({ ...p, visitor_id: e.target.value }))}
                    className="input"
                    disabled={!canModify}
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
                    disabled={!canModify}
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
                    disabled={!canModify}
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
                    disabled={!canModify}
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
                    disabled={!canModify}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-800/80">
                {selectedAppt && canModify ? (
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
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">
                    Fermer
                  </button>
                  {canModify && (
                    <button type="submit" disabled={saving} className="btn-primary text-xs px-5">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1.5" />}
                      Enregistrer
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
