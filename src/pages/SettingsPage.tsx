import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompanySettings } from '../contexts/CompanySettingsContext';
import {
  Mail,
  Phone,
  Globe,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Settings,
  Database,
  RefreshCw,
  Building2,
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  User,
  Users,
  Terminal,
  Activity,
  Check,
  X,
  Send,
  Lock
} from 'lucide-react';

export default function SettingsPage() {
  const { settings: dbSettings, updateSettings } = useCompanySettings();
  const [activeTab, setActiveTab] = useState<'general' | 'automations' | 'recipients' | 'logs'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dbStats, setDbStats] = useState<any>(null);

  // General Settings State
  const [companySettings, setCompanySettings] = useState({
    company_name: 'GICO SARL',
    slogan: 'Gestion & Intégration de Services Collaboratifs',
    rccm: 'BF-OUA-2026-B-1234',
    ifu: '00123456X',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    logo_url: '',
    visit_prefix: 'VST',
    invoice_prefix: 'INV',
    default_duration_days: '7',
  });

  useEffect(() => {
    if (dbSettings) {
      setCompanySettings({
        company_name: dbSettings.company_name || 'GICO SARL',
        slogan: dbSettings.slogan || '',
        rccm: dbSettings.rccm || '',
        ifu: dbSettings.ifu || '',
        company_address: dbSettings.company_address || '',
        company_phone: dbSettings.phone || '',
        company_email: dbSettings.email || '',
        company_website: dbSettings.website || '',
        logo_url: dbSettings.logo_url || '',
        visit_prefix: dbSettings.visit_prefix || 'VT',
        invoice_prefix: dbSettings.invoice_prefix || 'FAC',
        default_duration_days: '7',
      });
    }
  }, [dbSettings]);

  // Automations States
  const [automations, setAutomations] = useState<any[]>([]);
  const [editingAutomation, setEditingAutomation] = useState<any | null>(null);
  const [showAutoForm, setShowAutoForm] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [autoForm, setAutoForm] = useState({
    name: '',
    provider: 'n8n_whatsapp',
    webhook_url: '',
    secret_key: '',
    is_active: true
  });

  // Recipients States
  const [recipients, setRecipients] = useState<any[]>([]);
  const [editingRecipient, setEditingRecipient] = useState<any | null>(null);
  const [showRecipForm, setShowRecipForm] = useState(false);
  const [recipForm, setRecipForm] = useState({
    full_name: '',
    phone: '',
    role: '',
    service: '',
    groups: '',
    is_active: true,
    receive_visit_notifications: true,
    receive_system_notifications: true
  });

  // Logs States
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDbStats(),
      fetchAutomations(),
      fetchRecipients(),
      fetchLogs()
    ]);
    setLoading(false);
  };

  const fetchDbStats = async () => {
    const [visits, visitors, invoices, users, services] = await Promise.all([
      supabase.from('visits').select('*', { count: 'exact', head: true }),
      supabase.from('visitors').select('*', { count: 'exact', head: true }),
      supabase.from('invoices').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('services').select('*', { count: 'exact', head: true }),
    ]);

    setDbStats({
      visits: visits.count || 0,
      visitors: visitors.count || 0,
      invoices: invoices.count || 0,
      users: users.count || 0,
      services: services.count || 0,
    });
  };

  const fetchAutomations = async () => {
    const { data } = await supabase.from('automation_settings').select('*').order('created_at', { ascending: true });
    if (data) setAutomations(data);
  };

  const fetchRecipients = async () => {
    const { data } = await supabase.from('notification_recipients').select('*').order('full_name', { ascending: true });
    if (data) setRecipients(data);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from('notification_logs').select('*').order('sent_at', { ascending: false }).limit(100);
    if (data) setLogs(data);
  };

  // GENERAL SETTINGS SAVING
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    
    const { error: err } = await updateSettings({
      company_name: companySettings.company_name,
      slogan: companySettings.slogan,
      rccm: companySettings.rccm,
      ifu: companySettings.ifu,
      company_address: companySettings.company_address,
      phone: companySettings.company_phone,
      email: companySettings.company_email,
      website: companySettings.company_website,
      logo_url: companySettings.logo_url || null,
      visit_prefix: companySettings.visit_prefix,
      invoice_prefix: companySettings.invoice_prefix,
    });

    if (err) {
      setError(err.message || "Impossible d'enregistrer les paramètres");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  // AUTOMATIONS CRUD
  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSave = {
        name: autoForm.name,
        provider: autoForm.provider,
        webhook_url: autoForm.webhook_url,
        secret_key: autoForm.secret_key || null,
        is_active: autoForm.is_active,
        updated_at: new Date().toISOString()
      };

      if (editingAutomation) {
        const { error } = await supabase
          .from('automation_settings')
          .update(dataToSave)
          .eq('id', editingAutomation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('automation_settings')
          .insert(dataToSave);
        if (error) throw error;
      }
      setShowAutoForm(false);
      setEditingAutomation(null);
      fetchAutomations();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditAutomation = (item: any) => {
    setEditingAutomation(item);
    setAutoForm({
      name: item.name,
      provider: item.provider,
      webhook_url: item.webhook_url,
      secret_key: item.secret_key || '',
      is_active: item.is_active
    });
    setShowAutoForm(true);
  };

  const openAddAutomation = () => {
    setEditingAutomation(null);
    setAutoForm({
      name: '',
      provider: 'n8n_whatsapp',
      webhook_url: '',
      secret_key: '',
      is_active: true
    });
    setShowAutoForm(true);
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!window.confirm("Voulez-vous supprimer ce webhook ?")) return;
    const { error } = await supabase.from('automation_settings').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchAutomations();
  };

  const handleTestWebhook = async (settingId: string) => {
    const setting = automations.find(a => a.id === settingId);
    if (!setting || !setting.webhook_url) return;

    setTestingWebhook(settingId);
    try {
      const payload = {
        event_type: 'test_connection',
        message: 'Message test de connexion de la part du VISIT tracker.',
        timestamp: new Date().toISOString()
      };

      const res = await fetch(setting.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Automation-Secret': setting.secret_key || ''
        },
        body: JSON.stringify(payload)
      });

      const status = res.ok ? 'success' : 'failed';
      const error_message = res.ok ? null : `Code statut HTTP: ${res.status}`;

      await supabase.from('notification_logs').insert({
        event_type: 'test_connection',
        recipient_name: `Test Webhook - ${setting.name}`,
        recipient_phone: 'N/A',
        payload,
        status,
        error_message
      });

      if (res.ok) {
        alert("Succès ! Webhook appelé et log enregistré.");
      } else {
        alert(`Échec : Webhook a retourné le code HTTP ${res.status}.`);
      }
      fetchLogs();
    } catch (err: any) {
      await supabase.from('notification_logs').insert({
        event_type: 'test_connection',
        recipient_name: `Test Webhook - ${setting.name}`,
        recipient_phone: 'N/A',
        payload: { error: err.message },
        status: 'failed',
        error_message: err.message || 'Erreur réseau'
      });
      alert(`Erreur réseau : Impossible d'appeler le webhook (${err.message}).`);
      fetchLogs();
    } finally {
      setTestingWebhook(null);
    }
  };

  // RECIPIENTS CRUD
  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const groupArray = recipForm.groups
        ? recipForm.groups.split(',').map(g => g.trim()).filter(Boolean)
        : [];

      const dataToSave = {
        full_name: recipForm.full_name,
        phone: recipForm.phone,
        role: recipForm.role || null,
        service: recipForm.service || null,
        groups: groupArray,
        is_active: recipForm.is_active,
        receive_visit_notifications: recipForm.receive_visit_notifications,
        receive_system_notifications: recipForm.receive_system_notifications,
        updated_at: new Date().toISOString()
      };

      if (editingRecipient) {
        const { error } = await supabase
          .from('notification_recipients')
          .update(dataToSave)
          .eq('id', editingRecipient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_recipients')
          .insert(dataToSave);
        if (error) throw error;
      }
      setShowRecipForm(false);
      setEditingRecipient(null);
      fetchRecipients();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEditRecipient = (item: any) => {
    setEditingRecipient(item);
    setRecipForm({
      full_name: item.full_name,
      phone: item.phone,
      role: item.role || '',
      service: item.service || '',
      groups: item.groups ? item.groups.join(', ') : '',
      is_active: item.is_active,
      receive_visit_notifications: item.receive_visit_notifications,
      receive_system_notifications: item.receive_system_notifications
    });
    setShowRecipForm(true);
  };

  const openAddRecipient = () => {
    setEditingRecipient(null);
    setRecipForm({
      full_name: '',
      phone: '',
      role: '',
      service: '',
      groups: '',
      is_active: true,
      receive_visit_notifications: true,
      receive_system_notifications: true
    });
    setShowRecipForm(true);
  };

  const handleDeleteRecipient = async (id: string) => {
    if (!window.confirm("Voulez-vous supprimer ce destinataire ?")) return;
    const { error } = await supabase.from('notification_recipients').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchRecipients();
  };

  const toggleRecipientActive = async (item: any) => {
    const { error } = await supabase
      .from('notification_recipients')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (!error) fetchRecipients();
  };

  const toggleAutomationActive = async (item: any) => {
    const { error } = await supabase
      .from('automation_settings')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (!error) fetchAutomations();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Paramètres généraux & Automatisations</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configuration de l'entreprise, intégration n8n et gestion des notifications WhatsApp.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/40 w-full overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'general'
              ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" /> Général & Entreprise
        </button>
        <button
          onClick={() => setActiveTab('automations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'automations'
              ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" /> Webhooks n8n
        </button>
        <button
          onClick={() => setActiveTab('recipients')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'recipients'
              ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> Destinataires WhatsApp
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'logs'
              ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" /> Logs & Événements
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 card space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-xs text-slate-400 font-bold">Chargement des paramètres...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: GENERAL SETTINGS */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Database Stats */}
              <div className="card">
                <div className="card-header">
                  <h2 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-4.5 h-4.5 text-primary-600" /> État de la base de données
                  </h2>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-2xl font-black text-primary-700 dark:text-primary-400">{dbStats?.visits || 0}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">Visites</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{dbStats?.visitors || 0}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">Visiteurs</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{dbStats?.invoices || 0}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">Factures</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-2xl font-black text-purple-700 dark:text-purple-400">{dbStats?.users || 0}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">Utilisateurs</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-2xl font-black text-slate-700 dark:text-slate-400">{dbStats?.services || 0}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">Services</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={fetchDbStats} className="btn-secondary py-2 text-xs">
                      <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
                    </button>
                  </div>
                </div>
              </div>

              {/* Company configuration */}
              <div className="card">
                <div className="card-header">
                  <h2 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4.5 h-4.5 text-primary-600" /> Informations de l'entreprise
                  </h2>
                </div>
                <form onSubmit={handleSaveGeneral} className="card-body space-y-4 text-xs">
                  {error && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 rounded-2xl flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                      <p className="text-xs text-rose-700 dark:text-rose-400 font-bold">{error}</p>
                    </div>
                  )}

                  {saved && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 rounded-2xl flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">Paramètres de l'entreprise enregistrés avec succès !</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Nom de l'entreprise</label>
                      <input
                        type="text"
                        value={companySettings.company_name}
                        onChange={(e) => setCompanySettings(p => ({ ...p, company_name: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Email de contact</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={companySettings.company_email}
                          onChange={(e) => setCompanySettings(p => ({ ...p, company_email: e.target.value }))}
                          className="input pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Téléphone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={companySettings.company_phone}
                          onChange={(e) => setCompanySettings(p => ({ ...p, company_phone: e.target.value }))}
                          className="input pl-9"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Site Web</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="url"
                          value={companySettings.company_website}
                          onChange={(e) => setCompanySettings(p => ({ ...p, company_website: e.target.value }))}
                          className="input pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label">Adresse physique du siège</label>
                    <input
                      type="text"
                      value={companySettings.company_address}
                      onChange={(e) => setCompanySettings(p => ({ ...p, company_address: e.target.value }))}
                      className="input"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Slogan / Description</label>
                      <input
                        type="text"
                        value={companySettings.slogan}
                        onChange={(e) => setCompanySettings(p => ({ ...p, slogan: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">URL du Logo</label>
                      <input
                        type="text"
                        value={companySettings.logo_url}
                        onChange={(e) => setCompanySettings(p => ({ ...p, logo_url: e.target.value }))}
                        className="input"
                        placeholder="Ex: https://votresite.com/logo.png"
                      />
                    </div>
                    <div>
                      <label className="label">Numéro RCCM</label>
                      <input
                        type="text"
                        value={companySettings.rccm}
                        onChange={(e) => setCompanySettings(p => ({ ...p, rccm: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Identifiant Unique IFU</label>
                      <input
                        type="text"
                        value={companySettings.ifu}
                        onChange={(e) => setCompanySettings(p => ({ ...p, ifu: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>

                  {/* System settings */}
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-6">
                    <h3 className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wider text-xs mb-4">Paramètres système</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="label">Préfixe code visite</label>
                        <input
                          type="text"
                          value={companySettings.visit_prefix}
                          onChange={(e) => setCompanySettings(p => ({ ...p, visit_prefix: e.target.value }))}
                          className="input"
                          maxLength={5}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Ex: {companySettings.visit_prefix}-20260101-001</p>
                      </div>
                      <div>
                        <label className="label">Préfixe factures</label>
                        <input
                          type="text"
                          value={companySettings.invoice_prefix}
                          onChange={(e) => setCompanySettings(p => ({ ...p, invoice_prefix: e.target.value }))}
                          className="input"
                          maxLength={5}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Ex: {companySettings.invoice_prefix}-2026-001</p>
                      </div>
                      <div>
                        <label className="label">Délai relances (Jours)</label>
                        <input
                          type="number"
                          value={companySettings.default_duration_days}
                          onChange={(e) => setCompanySettings(p => ({ ...p, default_duration_days: e.target.value }))}
                          className="input"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button type="submit" disabled={saving} className="btn-primary py-2 px-6">
                      {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: AUTOMATION WEBHOOKS */}
          {activeTab === 'automations' && (
            <div className="space-y-6">
              {/* Form trigger / List card */}
              <div className="card">
                <div className="card-header flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-wider">
                    Fils d'automatisations & Webhooks
                  </h2>
                  <button onClick={openAddAutomation} className="btn-primary py-1.5 px-3 text-xs">
                    <Plus className="w-4 h-4 mr-1" /> Ajouter webhook
                  </button>
                </div>
                <div className="card-body">
                  {showAutoForm && (
                    <div className="p-5 bg-slate-50 dark:bg-slate-900 border rounded-2xl mb-6 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <h3 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase">
                          {editingAutomation ? "Modifier le canal" : "Nouveau canal de notification"}
                        </h3>
                        <button onClick={() => { setShowAutoForm(false); setEditingAutomation(null); }} className="text-slate-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <form onSubmit={handleSaveAutomation} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Nom descriptif *</label>
                            <input
                              type="text"
                              required
                              value={autoForm.name}
                              onChange={(e) => setAutoForm(p => ({ ...p, name: e.target.value }))}
                              className="input bg-white dark:bg-slate-950"
                              placeholder="Ex: n8n Production WhatsApp"
                            />
                          </div>
                          <div>
                            <label className="label">Canal / Provider *</label>
                            <select
                              value={autoForm.provider}
                              onChange={(e) => setAutoForm(p => ({ ...p, provider: e.target.value }))}
                              className="input bg-white dark:bg-slate-950"
                            >
                              <option value="n8n_whatsapp">WhatsApp (via n8n Webhook)</option>
                              <option value="email">Email Service</option>
                              <option value="sms">SMS Gateway</option>
                              <option value="telegram">Telegram Bot</option>
                              <option value="slack">Slack Channel</option>
                              <option value="push">Push Notifications</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="label">URL Webhook *</label>
                          <input
                            type="url"
                            required
                            value={autoForm.webhook_url}
                            onChange={(e) => setAutoForm(p => ({ ...p, webhook_url: e.target.value }))}
                            className="input font-mono bg-white dark:bg-slate-950"
                            placeholder="https://n8n.example.com/webhook/..."
                          />
                        </div>

                        <div>
                          <label className="label">Clé Secrète de Sécurité (En-tête X-Automation-Secret)</label>
                          <input
                            type="text"
                            value={autoForm.secret_key}
                            onChange={(e) => setAutoForm(p => ({ ...p, secret_key: e.target.value }))}
                            className="input font-mono bg-white dark:bg-slate-950"
                            placeholder="Ex: cle_validation_partagee"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="is_active_auto"
                            checked={autoForm.is_active}
                            onChange={(e) => setAutoForm(p => ({ ...p, is_active: e.target.checked }))}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <label htmlFor="is_active_auto" className="font-bold text-slate-700 dark:text-slate-300">
                            Activer immédiatement ce webhook
                          </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => { setShowAutoForm(false); setEditingAutomation(null); }}
                            className="btn-secondary py-2"
                          >
                            Annuler
                          </button>
                          <button type="submit" disabled={saving} className="btn-primary py-2 px-5">
                            Enregistrer
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {automations.length === 0 ? (
                    <div className="text-center py-12">
                      <Terminal className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs text-slate-400 font-bold">Aucune automatisation configurée.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Créez votre première connexion de webhook pour communiquer avec n8n.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {automations.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl gap-4 hover:shadow-sm transition-all"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-sm text-slate-800 dark:text-white truncate">{item.name}</h3>
                              <span className={`badge text-[8px] font-black uppercase ${
                                item.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {item.is_active ? 'Actif' : 'Inactif'}
                              </span>
                              <span className="badge-gray text-[9px] font-bold uppercase">{item.provider}</span>
                            </div>
                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate bg-white dark:bg-slate-950 p-2 rounded-xl border border-slate-200/40">
                              {item.webhook_url}
                            </p>
                            {item.secret_key && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Secret :</span>
                                <span className="font-mono bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border">
                                  {showSecret[item.id] ? item.secret_key : '••••••••••••'}
                                </span>
                                <button
                                  onClick={() => setShowSecret(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                  className="text-primary-600 font-bold hover:underline ml-1"
                                >
                                  {showSecret[item.id] ? 'Masquer' : 'Afficher'}
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                              onClick={() => handleTestWebhook(item.id)}
                              disabled={testingWebhook === item.id}
                              className="btn-secondary py-1.5 px-3 text-[10px] flex items-center gap-1 border-primary-500/20 text-primary-600 dark:text-primary-400"
                            >
                              {testingWebhook === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>Tester webhook</span>
                            </button>
                            <button
                              onClick={() => openEditAutomation(item)}
                              className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl text-slate-500"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleAutomationActive(item)}
                              className={`p-2 rounded-xl transition-colors ${
                                item.is_active ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20' : 'text-slate-400 hover:bg-slate-200'
                              }`}
                              title={item.is_active ? "Désactiver" : "Activer"}
                            >
                              {item.is_active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteAutomation(item.id)}
                              className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP RECIPIENTS */}
          {activeTab === 'recipients' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-primary-600" /> Gestion des destinataires WhatsApp
                  </h2>
                  <button onClick={openAddRecipient} className="btn-primary py-1.5 px-3 text-xs">
                    <Plus className="w-4 h-4 mr-1" /> Nouveau destinataire
                  </button>
                </div>
                <div className="card-body">
                  {showRecipForm && (
                    <div className="p-5 bg-slate-50 dark:bg-slate-900 border rounded-2xl mb-6 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b">
                        <h3 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase">
                          {editingRecipient ? "Modifier le destinataire" : "Ajouter un destinataire"}
                        </h3>
                        <button onClick={() => { setShowRecipForm(false); setEditingRecipient(null); }} className="text-slate-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <form onSubmit={handleSaveRecipient} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Nom complet *</label>
                            <input
                              type="text"
                              required
                              value={recipForm.full_name}
                              onChange={(e) => setRecipForm(p => ({ ...p, full_name: e.target.value }))}
                              className="input bg-white dark:bg-slate-950"
                              placeholder="Ex: M. Jean Koffi"
                            />
                          </div>
                          <div>
                            <label className="label">Téléphone WhatsApp (Format International) *</label>
                            <input
                              type="tel"
                              required
                              value={recipForm.phone}
                              onChange={(e) => setRecipForm(p => ({ ...p, phone: e.target.value }))}
                              className="input bg-white dark:bg-slate-950"
                              placeholder="Ex: +2250700000000"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Rôle au sein de GICO</label>
                            <input
                              type="text"
                              value={recipForm.role}
                              onChange={(e) => setRecipForm(p => ({ ...p, role: e.target.value }))}
                              className="input bg-white dark:bg-slate-950"
                              placeholder="Ex: Directeur Technique, Réceptionniste"
                            />
                          </div>
                          <div>
                            <label className="label">Service / Département</label>
                            <input
                              type="text"
                              value={recipForm.service}
                              onChange={(e) => setRecipForm(p => ({ ...p, service: e.target.value }))}
                              className="input bg-white dark:bg-slate-950"
                              placeholder="Ex: Informatique, Direction"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="label">Groupes (Séparés par des virgules)</label>
                          <input
                            type="text"
                            value={recipForm.groups}
                            onChange={(e) => setRecipForm(p => ({ ...p, groups: e.target.value }))}
                            className="input bg-white dark:bg-slate-950"
                            placeholder="Ex: Direction, Alertes_Visite, Securite_Bonoua"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="recip_is_active_check"
                              checked={recipForm.is_active}
                              onChange={(e) => setRecipForm(p => ({ ...p, is_active: e.target.checked }))}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <label htmlFor="recip_is_active_check" className="font-bold text-slate-700 dark:text-slate-300">
                              Destinataire actif
                            </label>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="recip_receive_visit_check"
                              checked={recipForm.receive_visit_notifications}
                              onChange={(e) => setRecipForm(p => ({ ...p, receive_visit_notifications: e.target.checked }))}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <label htmlFor="recip_receive_visit_check" className="font-bold text-slate-700 dark:text-slate-300">
                              Recevoir alertes visites
                            </label>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="recip_receive_system_check"
                              checked={recipForm.receive_system_notifications}
                              onChange={(e) => setRecipForm(p => ({ ...p, receive_system_notifications: e.target.checked }))}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <label htmlFor="recip_receive_system_check" className="font-bold text-slate-700 dark:text-slate-300">
                              Recevoir alertes système
                            </label>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => { setShowRecipForm(false); setEditingRecipient(null); }}
                            className="btn-secondary py-2"
                          >
                            Annuler
                          </button>
                          <button type="submit" disabled={saving} className="btn-primary py-2 px-5">
                            Enregistrer
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {recipients.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs text-slate-400 font-bold">Aucun destinataire WhatsApp configuré.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-black uppercase tracking-wider">
                            <th className="pb-3 pr-4">Destinataire</th>
                            <th className="pb-3 px-4">Contact</th>
                            <th className="pb-3 px-4">Rôle / Service</th>
                            <th className="pb-3 px-4">Groupes</th>
                            <th className="pb-3 px-4">Notifications</th>
                            <th className="pb-3 px-4 text-center">Statut</th>
                            <th className="pb-3 pl-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                          {recipients.map((recip) => (
                            <tr key={recip.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                              <td className="py-3.5 pr-4 font-bold text-slate-900 dark:text-white">{recip.full_name}</td>
                              <td className="py-3.5 px-4 font-semibold">{recip.phone}</td>
                              <td className="py-3.5 px-4">
                                {recip.role || 'N/A'}
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold mt-0.5">{recip.service || 'N/A'}</span>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {recip.groups && recip.groups.length > 0 ? (
                                    recip.groups.map((g: string, idx: number) => (
                                      <span key={idx} className="badge-gray text-[9px] px-1.5 py-0.5 font-bold uppercase">{g}</span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-medium">Aucun</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="space-y-1 text-[10px] font-bold">
                                  <div className="flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${recip.receive_visit_notifications ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    <span>Visites</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${recip.receive_system_notifications ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    <span>Système</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => toggleRecipientActive(recip)}
                                  className={`badge text-[8px] font-black uppercase ${
                                    recip.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'bg-slate-100 text-slate-500'
                                  }`}
                                >
                                  {recip.is_active ? 'Actif' : 'Inactif'}
                                </button>
                              </td>
                              <td className="py-3.5 pl-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEditRecipient(recip)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                                    title="Modifier"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRecipient(recip.id)}
                                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
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

          {/* TAB 4: NOTIFICATION LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-primary-600" /> Historique des événements de notification
                  </h2>
                  <button onClick={fetchLogs} className="btn-secondary py-1.5 px-3 text-xs">
                    <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
                  </button>
                </div>
                <div className="card-body">
                  {logs.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs text-slate-400 font-bold">Aucun log de notification enregistré.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-black uppercase tracking-wider">
                              <th className="pb-3 pr-4">Horodatage</th>
                              <th className="pb-3 px-4">Événement</th>
                              <th className="pb-3 px-4">Destinataire</th>
                              <th className="pb-3 px-4 text-center">Statut</th>
                              <th className="pb-3 px-4">Détail erreur</th>
                              <th className="pb-3 pl-4 text-right">Données (JSON)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                            {logs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                <td className="py-3 pr-4 font-semibold text-slate-500">
                                  {new Date(log.sent_at).toLocaleString('fr-FR')}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="badge-gray text-[9px] font-bold uppercase">{log.event_type}</span>
                                </td>
                                <td className="py-3 px-4 font-bold">
                                  {log.recipient_name}
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-semibold mt-0.5">{log.recipient_phone}</span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`badge text-[8px] font-black uppercase ${
                                    log.status === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20'
                                  }`}>
                                    {log.status === 'success' ? 'Réussi' : 'Échoué'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-medium text-rose-600 dark:text-rose-400 max-w-xs truncate" title={log.error_message}>
                                  {log.error_message || '-'}
                                </td>
                                <td className="py-3 pl-4 text-right">
                                  <button
                                    onClick={() => setSelectedPayload(log.payload)}
                                    className="btn-secondary py-1 px-2.5 text-[10px] rounded-lg"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1 inline-block" /> Aperçu
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* JSON Payload Modal Preview */}
      {selectedPayload && (
        <div className="modal-backdrop" onClick={() => setSelectedPayload(null)}>
          <div className="modal max-w-lg animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4.5 h-4.5 text-primary-600" /> Contenu JSON du Payload
              </h3>
              <button onClick={() => setSelectedPayload(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="p-6">
              <pre className="text-[10px] font-mono bg-slate-950 text-slate-300 p-4 rounded-2xl border border-slate-800 overflow-x-auto max-h-96 scrollbar-thin">
                {JSON.stringify(selectedPayload, null, 2)}
              </pre>
              <div className="flex justify-end mt-6">
                <button onClick={() => setSelectedPayload(null)} className="btn-secondary text-xs rounded-xl px-5 py-2">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
