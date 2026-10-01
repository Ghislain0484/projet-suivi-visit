import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, Service, Visitor, VisitorType, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  searchVisitorsServer,
  matchVisitorLocally,
  findMatchingVisitor,
  normalizePhone,
} from '../lib/visitorUtils';
import {
  Save,
  X,
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  Loader2,
  Search,
  Sparkles,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

export default function VisitFormPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [existingVisitors, setExistingVisitors] = useState<Visitor[]>([]);
  const [showVisitorSearch, setShowVisitorSearch] = useState(false);
  const [visitorSearch, setVisitorSearch] = useState('');
  const [searchingServer, setSearchingServer] = useState(false);
  const [suggestedVisitors, setSuggestedVisitors] = useState<Visitor[]>([]);
  const [collaborators, setCollaborators] = useState<Profile[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    // Visitor info
    visitor_id: '',
    first_name: '',
    last_name: '',
    visitor_type: 'client' as VisitorType,
    phone: '',
    email: '',
    company: '',
    visitor_notes: '',
    // Visit info
    arrival_time: new Date().toISOString().slice(0, 16),
    purpose: '',
    has_appointment: false,
    person_to_meet: '',
    assigned_collaborator_id: '',
    service_id: '',
    comments: '',
    branch: 'Siège (Bonoua)',
  });

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrateur',
      director: 'Directeur Général',
      reception: 'Réception / Secrétariat',
      service_manager: 'Responsable Service',
      accounting: 'Comptabilité',
      cashier: 'Caissier / Caisse',
      collaborator: 'Collaborateur',
      nurse: 'Infirmier / Santé',
      lawyer: 'Juriste Externe',
    };
    return labels[role] || role;
  };

  useEffect(() => {
    fetchServices();
    fetchExistingVisitors();
    fetchCollaborators();
    if (isEditing) {
      fetchVisit();
    }
  }, [id]);

  // Real-time server-side debounced search for the visitor search modal
  useEffect(() => {
    if (!visitorSearch.trim()) return;

    const timer = setTimeout(async () => {
      setSearchingServer(true);
      try {
        const results = await searchVisitorsServer(visitorSearch, 50);
        if (results && results.length > 0) {
          setExistingVisitors((prev) => {
            const map = new Map<string, Visitor>();
            results.forEach((v) => map.set(v.id, v));
            prev.forEach((v) => {
              if (!map.has(v.id)) map.set(v.id, v);
            });
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error('Erreur recherche serveur visiteurs:', err);
      } finally {
        setSearchingServer(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [visitorSearch]);

  // Inline smart duplicate detection as the user fills out name/phone/email
  useEffect(() => {
    if (formData.visitor_id || isEditing) {
      setSuggestedVisitors([]);
      return;
    }

    const phoneDigits = normalizePhone(formData.phone);
    const firstName = formData.first_name.trim();
    const lastName = formData.last_name.trim();
    const email = formData.email.trim();

    // Trigger if we have enough info: phone (>=4 digits), names (>=2 chars), or email
    const hasEnoughInfo =
      phoneDigits.length >= 4 ||
      firstName.length >= 2 ||
      lastName.length >= 2 ||
      (email.length >= 4 && email.includes('@'));

    if (!hasEnoughInfo) {
      setSuggestedVisitors([]);
      return;
    }

    const timer = setTimeout(async () => {
      const searchTerms = [firstName, lastName, phoneDigits, email]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (!searchTerms) {
        setSuggestedVisitors([]);
        return;
      }

      try {
        const matches = await searchVisitorsServer(searchTerms, 4);
        // Filtrer les correspondances pertinentes
        const relevant = matches.filter((m) => {
          const mPhone = normalizePhone(m.phone);
          const phoneMatch = phoneDigits.length >= 4 && (mPhone.includes(phoneDigits) || phoneDigits.includes(mPhone.slice(-8)));
          const nameMatch = matchVisitorLocally(m, `${firstName} ${lastName}`.trim());
          const emailMatch = email && m.email && m.email.toLowerCase() === email.toLowerCase();
          return phoneMatch || nameMatch || emailMatch;
        });

        setSuggestedVisitors(relevant);
      } catch (err) {
        console.error('Erreur détection intelligente:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.phone, formData.first_name, formData.last_name, formData.email, formData.visitor_id, isEditing]);

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true).order('name');
    if (data) setServices(data);
  };

  const fetchExistingVisitors = async () => {
    const { data } = await supabase.from('visitors').select('*').order('created_at', { ascending: false }).limit(300);
    if (data) setExistingVisitors(data);
  };

  const fetchCollaborators = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    if (data) setCollaborators(data);
  };

  const fetchVisit = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*)`)
      .eq('id', id)
      .single();

    if (data) {
      setFormData({
        visitor_id: data.visitor_id,
        first_name: data.visitor?.first_name || '',
        last_name: data.visitor?.last_name || '',
        visitor_type: data.visitor?.visitor_type || 'client',
        phone: data.visitor?.phone || '',
        email: data.visitor?.email || '',
        company: data.visitor?.company || '',
        visitor_notes: data.visitor?.notes || '',
        arrival_time: new Date(data.arrival_time).toISOString().slice(0, 16),
        purpose: data.purpose,
        has_appointment: data.has_appointment,
        person_to_meet: data.person_to_meet || '',
        assigned_collaborator_id: data.assigned_collaborator_id || '',
        service_id: data.service_id || '',
        comments: data.comments || '',
        branch: data.branch || 'Siège (Bonoua)',
      });
      if (data.attachments) {
        setAttachments(data.attachments);
      }
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const selectExistingVisitor = (visitor: Visitor) => {
    setFormData((prev) => ({
      ...prev,
      visitor_id: visitor.id,
      first_name: visitor.first_name,
      last_name: visitor.last_name,
      visitor_type: visitor.visitor_type,
      phone: visitor.phone || '',
      email: visitor.email || '',
      company: visitor.company || '',
      visitor_notes: visitor.notes || '',
    }));
    setShowVisitorSearch(false);
    setVisitorSearch('');
    setSuggestedVisitors([]);
  };

  const clearSelectedVisitor = () => {
    setFormData((prev) => ({
      ...prev,
      visitor_id: '',
      first_name: '',
      last_name: '',
      visitor_type: 'client',
      phone: '',
      email: '',
      company: '',
      visitor_notes: '',
    }));
    setSuggestedVisitors([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    const newAttachments = [...attachments];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `visit-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) {
        alert(`Erreur d'upload: ${uploadError.message}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      if (publicUrl) {
        newAttachments.push(publicUrl);
      }
    }

    setAttachments(newAttachments);
    setUploading(false);
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const triggerVisitNotification = async (visit: any) => {
    try {
      const { data: settings } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('provider', 'n8n_whatsapp')
        .eq('is_active', true)
        .maybeSingle();

      if (!settings || !settings.webhook_url) {
        return;
      }

      const payload = {
        event_type: 'visit_created',
        visit: {
          id: visit.id,
          visit_code: visit.visit_code,
          purpose: visit.purpose,
          person_to_meet: visit.person_to_meet || '',
          branch: visit.branch,
          status: visit.status || 'in_progress',
          arrival_time: visit.arrival_time
        }
      };

      let status = 'success';
      let error_message = null;

      try {
        const res = await fetch(settings.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Automation-Secret': settings.secret_key || ''
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          throw new Error(`Erreur HTTP: ${res.status}`);
        }
      } catch (err: any) {
        status = 'failed';
        error_message = err.message || 'Erreur réseau';
      }

      // Log the notification attempt
      await supabase.from('notification_logs').insert({
        event_type: 'visit_created',
        recipient_name: 'n8n Webhook',
        recipient_phone: 'N/A',
        payload,
        status,
        error_message
      });
    } catch (err) {
      console.error('Erreur webhook notification:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let visitorId = formData.visitor_id;

      // Check if creating new visitor or using existing
      if (!visitorId) {
        // Automatic intelligent matching before inserting a potential duplicate
        const matchedVisitor = await findMatchingVisitor({
          phone: formData.phone,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
        });

        if (matchedVisitor) {
          // Reuse existing visitor profile automatically and update with any new details
          visitorId = matchedVisitor.id;
          await supabase
            .from('visitors')
            .update({
              first_name: formData.first_name || matchedVisitor.first_name,
              last_name: formData.last_name || matchedVisitor.last_name,
              visitor_type: formData.visitor_type || matchedVisitor.visitor_type,
              phone: formData.phone || matchedVisitor.phone,
              email: formData.email || matchedVisitor.email,
              company: formData.company || matchedVisitor.company,
              notes: formData.visitor_notes || matchedVisitor.notes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', visitorId);
        } else {
          // Create new visitor
          const { data: newVisitor, error: visitorError } = await supabase
            .from('visitors')
            .insert({
              first_name: formData.first_name.trim(),
              last_name: formData.last_name.trim(),
              visitor_type: formData.visitor_type,
              phone: formData.phone?.trim() || null,
              email: formData.email?.trim() || null,
              company: formData.company?.trim() || null,
              notes: formData.visitor_notes?.trim() || null,
            })
            .select()
            .single();

          if (visitorError) throw new Error(visitorError.message);
          visitorId = newVisitor.id;
        }
      } else {
        // Update existing visitor
        const { error: updateVisitorError } = await supabase
          .from('visitors')
          .update({
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            visitor_type: formData.visitor_type,
            phone: formData.phone?.trim() || null,
            email: formData.email?.trim() || null,
            company: formData.company?.trim() || null,
            notes: formData.visitor_notes?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', visitorId);
        
        if (updateVisitorError) throw new Error(updateVisitorError.message);
      }

      // Create or update visit
      const visitData = {
        visitor_id: visitorId,
        arrival_time: new Date(formData.arrival_time).toISOString(),
        purpose: formData.purpose,
        has_appointment: formData.has_appointment,
        person_to_meet: formData.person_to_meet || null,
        assigned_collaborator_id: formData.assigned_collaborator_id || null,
        service_id: formData.service_id || null,
        comments: formData.comments || null,
        branch: formData.branch,
        created_by: user?.id,
        attachments: attachments,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('visits')
          .update(visitData)
          .eq('id', id);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { data: newVisit, error: insertError } = await supabase
          .from('visits')
          .insert(visitData)
          .select()
          .single();
        if (insertError) throw new Error(insertError.message);

        // Send notification to the collaborator
        if (visitData.assigned_collaborator_id) {
          await supabase.from('notifications').insert({
            user_id: visitData.assigned_collaborator_id,
            title: 'Nouveau visiteur attribué',
            message: `Le visiteur ${formData.first_name} ${formData.last_name} (${formData.company || 'Sans entreprise'}) souhaite vous voir pour : ${formData.purpose}.`,
            type: 'info',
            link: `/visits/${newVisit.id}`,
            is_read: false
          });
        }

        // Trigger n8n webhook notifications
        triggerVisitNotification(newVisit);
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: isEditing ? 'UPDATE_VISIT' : 'CREATE_VISIT',
        entity_type: 'visit',
        details: { purpose: formData.purpose },
      });

      navigate('/visits');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  // Filtrage des visiteurs existants
  const filteredVisitors = visitorSearch
    ? existingVisitors.filter((v) => matchVisitorLocally(v, visitorSearch))
    : existingVisitors;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="loading-spinner h-10 w-10"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Formulaire de saisie
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isEditing ? 'Modifier la visite' : 'Enregistrer une visite'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {isEditing ? 'Modifiez les informations de la visite sélectionnée' : "Enregistrez l'arrivée d'un nouveau visiteur ou retrouvez un profil existant"}
          </p>
        </div>
        <button onClick={() => navigate(-1)} className="btn-secondary self-start sm:self-auto px-5 py-2.5">
          <X className="w-4.5 h-4.5 mr-2" />
          Annuler
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3 animate-slide-in-top">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Visitor Selection (Only when creating a new visit) */}
        {!isEditing && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                Recherche Visiteur Existant
              </h2>
              {formData.visitor_id && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200/40">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Profil existant rattaché
                </span>
              )}
            </div>
            <div className="card-body space-y-4">
              
              {formData.visitor_id ? (
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-extrabold text-sm shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {formData.first_name} {formData.last_name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        🏢 {formData.company || 'Aucune entreprise'} {formData.phone ? `• 📞 ${formData.phone}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowVisitorSearch(true)}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Changer de visiteur
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedVisitor}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3 py-1.5 rounded-xl transition-colors"
                    >
                      Créer un nouveau
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Rechercher par nom complet (ex: KOUASSI Jean), téléphone (ex: 0701020304), entreprise..."
                      value={visitorSearch}
                      onFocus={() => setShowVisitorSearch(true)}
                      onChange={(e) => {
                        setVisitorSearch(e.target.value);
                        if (!showVisitorSearch) setShowVisitorSearch(true);
                      }}
                      className="input pl-11 pr-10 bg-slate-50/50 dark:bg-slate-950/40 focus:bg-white dark:focus:bg-slate-900"
                    />
                    {searchingServer && (
                      <Loader2 className="w-4 h-4 text-primary-500 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {showVisitorSearch && (
                    <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 animate-slide-in-top">
                      <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-200/40 dark:border-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
                        <span>{filteredVisitors.length} visiteur(s) correspondant(s)</span>
                        <button
                          type="button"
                          onClick={() => setShowVisitorSearch(false)}
                          className="hover:text-slate-800 dark:hover:text-white font-bold"
                        >
                          Fermer
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900 scrollbar-thin">
                        {filteredVisitors.slice(0, 25).map((visitor) => (
                          <button
                            key={visitor.id}
                            type="button"
                            onClick={() => selectExistingVisitor(visitor)}
                            className="w-full text-left p-3 hover:bg-primary-50/40 dark:hover:bg-primary-950/30 flex items-center justify-between transition-colors group"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-extrabold text-sm text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                {visitor.first_name} {visitor.last_name}
                              </p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {visitor.company && <span>🏢 {visitor.company}</span>}
                                {visitor.phone && <span>📞 {visitor.phone}</span>}
                                {visitor.email && <span>✉️ {visitor.email}</span>}
                              </div>
                            </div>
                            <span className="badge-gray text-[10px] uppercase font-bold shrink-0">{visitor.visitor_type}</span>
                          </button>
                        ))}
                        {filteredVisitors.length === 0 && !searchingServer && (
                          <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                            Aucun visiteur trouvé pour "{visitorSearch}". Vous pouvez saisir les informations ci-dessous pour créer un nouveau profil.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Visitor Information Card */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Identité du visiteur</h2>
            {formData.visitor_id && (
              <span className="text-[11px] font-bold text-primary-600 dark:text-primary-400">
                (Profil enregistré)
              </span>
            )}
          </div>
          <div className="card-body space-y-4">
            
            {/* Smart Suggested Visitors Card */}
            {suggestedVisitors.length > 0 && !formData.visitor_id && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl space-y-2 animate-slide-in-top">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Visiteur(s) existant(s) détecté(s) correspondant à votre saisie :
                  </span>
                </div>
                <div className="divide-y divide-amber-200/50 dark:divide-amber-800/40">
                  {suggestedVisitors.map((candidate) => (
                    <div key={candidate.id} className="pt-2 pb-1.5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <strong className="text-slate-900 dark:text-white">{candidate.first_name} {candidate.last_name}</strong>{' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          {candidate.company ? `(${candidate.company})` : ''} {candidate.phone ? `• Tél: ${candidate.phone}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectExistingVisitor(candidate)}
                        className="btn-primary text-xs py-1 px-2.5 shrink-0 shadow-none font-bold"
                      >
                        Utiliser ce profil
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="label">
                  Prénom *
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Ex: Jean"
                  required
                />
              </div>
              <div>
                <label htmlFor="last_name" className="label">
                  Nom *
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Ex: KOUASSI"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="visitor_type" className="label">
                Type de visiteur *
              </label>
              <select
                id="visitor_type"
                name="visitor_type"
                value={formData.visitor_type}
                onChange={handleInputChange}
                className="input"
                required
              >
                <option value="client">Client</option>
                <option value="prospect">Prospect</option>
                <option value="supplier">Fournisseur</option>
                <option value="partner">Partenaire</option>
                <option value="other">Autre</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="label">
                  Téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input pl-11"
                    placeholder="07 00 00 00 00 ou +225 ..."
                  />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input pl-11"
                    placeholder="email@exemple.com"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="company" className="label">
                Entreprise / Organisation
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="input pl-11"
                  placeholder="Nom de l'entreprise ou particulier"
                />
              </div>
            </div>

            <div>
              <label htmlFor="visitor_notes" className="label">
                Notes sur le visiteur
              </label>
              <textarea
                id="visitor_notes"
                name="visitor_notes"
                value={formData.visitor_notes}
                onChange={handleInputChange}
                className="input"
                rows={2}
                placeholder="Renseignez des notes complémentaires si nécessaire..."
              />
            </div>
          </div>
        </div>

        {/* Visit details card */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Détails de la visite</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="arrival_time" className="label">
                  Date et heure d'arrivée *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                  <input
                    id="arrival_time"
                    name="arrival_time"
                    type="datetime-local"
                    value={formData.arrival_time}
                    onChange={handleInputChange}
                    className="input pl-11"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="service_id" className="label">
                  Service concerné
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                  <select
                    id="service_id"
                    name="service_id"
                    value={formData.service_id}
                    onChange={handleInputChange}
                    className="input pl-11"
                  >
                    <option value="">Sélectionnez un service...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="branch" className="label">
                  Succursale / Site *
                </label>
                <select
                  id="branch"
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  className="input"
                  required
                >
                  <option value="Siège (Bonoua)">Siège (Bonoua)</option>
                  <option value="GICO 8 Kilos">GICO 8 Kilos</option>
                  <option value="GICO MOROKRO">GICO MOROKRO</option>
                  <option value="GICO ABOISSO COMOE">GICO ABOISSO COMOE</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="purpose" className="label">
                Motif de la visite *
              </label>
              <textarea
                id="purpose"
                name="purpose"
                value={formData.purpose}
                onChange={handleInputChange}
                className="input"
                rows={2}
                placeholder="Renseignez le motif exact de la visite (ex: Dépôt de dossier, Réunion technique...)"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Rendez-vous prévu</label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="has_appointment"
                      checked={formData.has_appointment}
                      onChange={() => setFormData((p) => ({ ...p, has_appointment: true }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    Oui
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="has_appointment"
                      checked={!formData.has_appointment}
                      onChange={() => setFormData((p) => ({ ...p, has_appointment: false }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    Non
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="assigned_collaborator_id" className="label">
                  Collaborateur à rencontrer
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                  <select
                    id="assigned_collaborator_id"
                    name="assigned_collaborator_id"
                    value={formData.assigned_collaborator_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedCollab = collaborators.find(c => c.id === selectedId);
                      setFormData((prev) => ({
                        ...prev,
                        assigned_collaborator_id: selectedId,
                        person_to_meet: selectedCollab ? selectedCollab.full_name : '',
                      }));
                    }}
                    className="input pl-11"
                  >
                    <option value="">Sélectionnez un collaborateur...</option>
                    {collaborators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({getRoleLabel(c.role)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="comments" className="label">
                Commentaires / Observations d'accueil
              </label>
              <textarea
                id="comments"
                name="comments"
                value={formData.comments}
                onChange={handleInputChange}
                className="input"
                rows={3}
                placeholder="Ajoutez des observations (ex: Bagages, Dossier physique manquant...)"
              />
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Documents & Pièces Jointes</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">Scanners, photos, contrats...</span>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Ajouter des fichiers</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/50 dark:hover:bg-slate-900/60 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploading ? (
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                      {uploading ? "Téléversement en cours..." : "Cliquez ou glissez-déposez pour uploader un fichier"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      PNG, JPG, PDF (Max. 10 Mo par fichier)
                    </p>
                  </div>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {attachments.map((url, index) => {
                  const fileName = url.split('/').pop()?.split('_').slice(1).join('_') || `Document_${index + 1}`;
                  const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)/i);

                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        {isImage ? (
                          <img src={url} alt="Aperçu" className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-800" />
                        ) : (
                          <div className="w-10 h-10 bg-primary-50 dark:bg-primary-950/40 rounded-lg flex items-center justify-center border border-primary-100/10">
                            <span className="text-xs font-bold text-primary-700 dark:text-primary-400">PDF</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{fileName}</p>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline">
                            Visualiser
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-5 py-2.5">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5">
            {saving ? (
              <>
                <Loader2 className="w-4.5 h-4.5 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4.5 h-4.5 mr-2" />
                {isEditing ? 'Enregistrer les modifications' : 'Enregistrer la visite'}
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
