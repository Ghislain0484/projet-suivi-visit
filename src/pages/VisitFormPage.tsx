import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, Service, Visitor, Visit, VisitorType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Save,
  X,
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
} from 'lucide-react';

export default function VisitFormPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [existingVisitors, setExistingVisitors] = useState<Visitor[]>([]);
  const [showVisitorSearch, setShowVisitorSearch] = useState(false);
  const [visitorSearch, setVisitorSearch] = useState('');

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
    service_id: '',
    comments: '',
  });

  useEffect(() => {
    fetchServices();
    fetchExistingVisitors();
    if (isEditing) {
      fetchVisit();
    }
  }, [id]);

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('is_active', true).order('name');
    if (data) setServices(data);
  };

  const fetchExistingVisitors = async () => {
    const { data } = await supabase.from('visitors').select('*').order('last_name').limit(100);
    if (data) setExistingVisitors(data);
  };

  const fetchVisit = async () => {
    setLoading(true);
    const { data, error } = await supabase
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
        service_id: data.service_id || '',
        comments: data.comments || '',
      });
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let visitorId = formData.visitor_id;

      // Check if creating new visitor or using existing
      if (!visitorId) {
        // Create new visitor
        const { data: newVisitor, error: visitorError } = await supabase
          .from('visitors')
          .insert({
            first_name: formData.first_name,
            last_name: formData.last_name,
            visitor_type: formData.visitor_type,
            phone: formData.phone || null,
            email: formData.email || null,
            company: formData.company || null,
            notes: formData.visitor_notes || null,
          })
          .select()
          .single();

        if (visitorError) throw new Error(visitorError.message);
        visitorId = newVisitor.id;
      } else {
        // Update existing visitor
        await supabase
          .from('visitors')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            visitor_type: formData.visitor_type,
            phone: formData.phone || null,
            email: formData.email || null,
            company: formData.company || null,
            notes: formData.visitor_notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', visitorId);
      }

      // Create or update visit
      const visitData = {
        visitor_id: visitorId,
        arrival_time: new Date(formData.arrival_time).toISOString(),
        purpose: formData.purpose,
        has_appointment: formData.has_appointment,
        person_to_meet: formData.person_to_meet || null,
        service_id: formData.service_id || null,
        comments: formData.comments || null,
        created_by: user?.id,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('visits')
          .update(visitData)
          .eq('id', id);
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase.from('visits').insert(visitData);
        if (insertError) throw new Error(insertError.message);
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

  const filteredVisitors = visitorSearch
    ? existingVisitors.filter(
        (v) =>
          v.first_name.toLowerCase().includes(visitorSearch.toLowerCase()) ||
          v.last_name.toLowerCase().includes(visitorSearch.toLowerCase()) ||
          v.company?.toLowerCase().includes(visitorSearch.toLowerCase())
      )
    : existingVisitors;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Modifier la visite' : 'Enregistrer une visite'}
          </h1>
          <p className="text-gray-500">
            {isEditing ? 'Modifiez les informations de la visite' : 'Enregistrez un nouveau visiteur'}
          </p>
        </div>
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <X className="w-5 h-5 mr-2" />
          Annuler
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Visitor Selection */}
        {!isEditing && (
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Visiteur existant</h2>
            </div>
            <div className="card-body">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowVisitorSearch(!showVisitorSearch)}
                  className="btn-secondary"
                >
                  <Search className="w-5 h-5 mr-2" />
                  Rechercher un visiteur existant
                </button>
                {formData.visitor_id && (
                  <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Effacer la selection
                  </button>
                )}
              </div>

              {showVisitorSearch && (
                <div className="mt-4 space-y-4">
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou entreprise..."
                    value={visitorSearch}
                    onChange={(e) => setVisitorSearch(e.target.value)}
                    className="input"
                  />
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {filteredVisitors.slice(0, 10).map((visitor) => (
                      <button
                        key={visitor.id}
                        type="button"
                        onClick={() => selectExistingVisitor(visitor)}
                        className={`w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0 ${
                          formData.visitor_id === visitor.id ? 'bg-primary-50' : ''
                        }`}
                      >
                        <p className="font-medium">
                          {visitor.first_name} {visitor.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {visitor.company} - {visitor.visitor_type}
                        </p>
                      </button>
                    ))}
                    {filteredVisitors.length === 0 && (
                      <p className="p-3 text-gray-500">Aucun visiteur trouve</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visitor Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Informations du visiteur</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="label">
                  Prenom *
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="input"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="label">
                  Telephone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input pl-10"
                    placeholder="+225 XX XX XX XX"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input pl-10"
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
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="input pl-10"
                  placeholder="Nom de l'entreprise"
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
                placeholder="Informations supplementaires..."
              />
            </div>
          </div>
        </div>

        {/* Visit Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Informations de la visite</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="arrival_time" className="label">
                  Date et heure d'arrivee *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="arrival_time"
                    name="arrival_time"
                    type="datetime-local"
                    value={formData.arrival_time}
                    onChange={handleInputChange}
                    className="input pl-10"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="service_id" className="label">
                  Service concerne
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    id="service_id"
                    name="service_id"
                    value={formData.service_id}
                    onChange={handleInputChange}
                    className="input pl-10"
                  >
                    <option value="">Selectionnez un service</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                placeholder="Decrivez le motif de la visite..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="has_appointment" className="label">
                  Rendez-vous prevu
                </label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="has_appointment"
                      checked={formData.has_appointment}
                      onChange={() => setFormData((p) => ({ ...p, has_appointment: true }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">Oui</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="has_appointment"
                      checked={!formData.has_appointment}
                      onChange={() => setFormData((p) => ({ ...p, has_appointment: false }))}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">Non</span>
                  </label>
                </div>
              </div>
              <div>
                <label htmlFor="person_to_meet" className="label">
                  Personne a rencontrer
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="person_to_meet"
                    name="person_to_meet"
                    type="text"
                    value={formData.person_to_meet}
                    onChange={handleInputChange}
                    className="input pl-10"
                    placeholder="Nom de la personne"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="comments" className="label">
                Commentaires / Observations
              </label>
              <textarea
                id="comments"
                name="comments"
                value={formData.comments}
                onChange={handleInputChange}
                className="input"
                rows={3}
                placeholder="Remarques supplementaires..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {isEditing ? 'Enregistrer les modifications' : 'Enregistrer la visite'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
