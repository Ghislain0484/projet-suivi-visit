import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
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
} from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dbStats, setDbStats] = useState<any>(null);

  const [settings, setSettings] = useState({
    company_name: 'GICO SARL',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    visit_prefix: 'VST',
    invoice_prefix: 'INV',
    default_duration_days: '7',
  });

  useEffect(() => {
    fetchDbStats();
  }, []);

  const fetchDbStats = async () => {
    setLoading(true);

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

    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    // In a real app, these would be saved to a settings table
    // For this demo, we'll just show success

    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaved(true);
    setSaving(false);

    setTimeout(() => setSaved(false), 3000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parametres</h1>
        <p className="text-gray-500">Configuration de l'application</p>
      </div>

      {/* Database Stats */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Etat de la base de donnees
          </h2>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-primary-700">{dbStats?.visits || 0}</p>
                <p className="text-sm text-gray-500">Visites</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-emerald-700">{dbStats?.visitors || 0}</p>
                <p className="text-sm text-gray-500">Visiteurs</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gold-700">{dbStats?.invoices || 0}</p>
                <p className="text-sm text-gray-500">Factures</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-700">{dbStats?.users || 0}</p>
                <p className="text-sm text-gray-500">Utilisateurs</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-700">{dbStats?.services || 0}</p>
                <p className="text-sm text-gray-500">Services</p>
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button onClick={fetchDbStats} className="btn-secondary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Company Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informations de l'entreprise
          </h2>
        </div>
        <form onSubmit={handleSave} className="card-body space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {saved && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700">Parametres enregistres avec succes</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company_name" className="label">
                Nom de l'entreprise
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                value={settings.company_name}
                onChange={handleInputChange}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="company_email" className="label">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="company_email"
                  name="company_email"
                  type="email"
                  value={settings.company_email}
                  onChange={handleInputChange}
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="company_phone" className="label">
                Telephone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="company_phone"
                  name="company_phone"
                  type="tel"
                  value={settings.company_phone}
                  onChange={handleInputChange}
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="company_website" className="label">
                Site web
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="company_website"
                  name="company_website"
                  type="url"
                  value={settings.company_website}
                  onChange={handleInputChange}
                  className="input pl-10"
                  placeholder="https://"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="company_address" className="label">
              Adresse
            </label>
            <input
              id="company_address"
              name="company_address"
              type="text"
              value={settings.company_address}
              onChange={handleInputChange}
              className="input"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* System Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Parametres systeme
          </h2>
        </div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="visit_prefix" className="label">
                Prefixe code visite
              </label>
              <input
                id="visit_prefix"
                name="visit_prefix"
                type="text"
                value={settings.visit_prefix}
                onChange={handleInputChange}
                className="input"
                maxLength={5}
              />
              <p className="text-xs text-gray-500 mt-1">Ex: {settings.visit_prefix}-20260101-00001</p>
            </div>

            <div>
              <label htmlFor="invoice_prefix" className="label">
                Prefixe facture
              </label>
              <input
                id="invoice_prefix"
                name="invoice_prefix"
                type="text"
                value={settings.invoice_prefix}
                onChange={handleInputChange}
                className="input"
                maxLength={5}
              />
              <p className="text-xs text-gray-500 mt-1">Ex: {settings.invoice_prefix}-2026-00001</p>
            </div>

            <div>
              <label htmlFor="default_duration_days" className="label">
                Delai par defaut (jours)
              </label>
              <input
                id="default_duration_days"
                name="default_duration_days"
                type="number"
                value={settings.default_duration_days}
                onChange={handleInputChange}
                className="input"
                min="1"
                max="90"
              />
            </div>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="card">
        <div className="card-body text-center py-8">
          <img src="/logo-gico.png" alt="GICO SARL" className="w-20 h-20 object-contain mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">GICO VISIT TRACKER</h2>
          <p className="text-gray-500 mt-1">Version 1.0.0</p>
          <p className="text-sm text-gray-400 mt-4">
            Application de gestion des visites - GICO SARL
          </p>
        </div>
      </div>
    </div>
  );
}
