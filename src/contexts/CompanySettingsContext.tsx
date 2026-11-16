import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface CompanySettings {
  id: string;
  company_name: string;
  slogan: string | null;
  rccm: string | null;
  ifu: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  company_address: string | null;
  logo_url: string | null;
  currency: string;
  visit_prefix: string;
  invoice_prefix: string;
  default_duration_days?: number | string | null;
}

const LOCAL_STORAGE_SETTINGS_KEY = 'gico_company_settings_cache';

const DEFAULT_SETTINGS: CompanySettings = {
  id: '',
  company_name: 'GICO SARL',
  slogan: 'CONSTRUIRE AVEC VOUS UN IDEAL',
  rccm: '',
  ifu: '',
  phone: '+225 2721211149',
  email: 'contact@gicosarl.net',
  website: 'https://gicosarl.net/',
  company_address: 'Bonoua Yaou face Pharmacie de Bonoua',
  logo_url: '/logo-gico.png',
  currency: 'XOF',
  visit_prefix: 'VT',
  invoice_prefix: 'FAC',
  default_duration_days: '7'
};

interface CompanySettingsContextType {
  settings: CompanySettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<CompanySettings>) => Promise<{ error: any }>;
  refreshSettings: () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsContextType | undefined>(undefined);

export const CompanySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CompanySettings>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (cached) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn('Error reading local company settings cache:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1);

      if (error) {
        console.warn('Company settings table query note:', error.message);
        // Utiliser le cache local ou les paramètres par défaut
        try {
          const cached = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
          if (cached) {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(cached) });
          } else {
            setSettings(DEFAULT_SETTINGS);
          }
        } catch {
          setSettings(DEFAULT_SETTINGS);
        }
      } else if (data && data.length > 0) {
        const remoteSettings = { ...DEFAULT_SETTINGS, ...data[0] };
        setSettings(remoteSettings);
        try {
          localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(remoteSettings));
        } catch {}
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (e) {
      console.error('Error fetching company settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<CompanySettings>) => {
    try {
      // Sauvegarder d'abord localement pour une réactivité instantanée
      const merged = { ...settings, ...newSettings };
      setSettings(merged);
      try {
        localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(merged));
      } catch {}

      // Tenter la mise à jour sur Supabase
      let id = settings.id;
      if (!id) {
        const { data } = await supabase.from('company_settings').select('id').limit(1);
        if (data && data.length > 0) {
          id = data[0].id;
        }
      }

      let error = null;
      if (id) {
        const { error: err } = await supabase
          .from('company_settings')
          .update({
            ...newSettings,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        error = err;
      } else {
        const { data, error: err } = await supabase
          .from('company_settings')
          .insert({
            ...newSettings,
            company_name: newSettings.company_name || DEFAULT_SETTINGS.company_name
          })
          .select();
        error = err;
        if (data && data.length > 0) {
          setSettings((prev) => ({ ...prev, id: data[0].id }));
        }
      }

      if (!error) {
        await fetchSettings();
      }
      return { error };
    } catch (err: any) {
      console.error('Failed to update company settings on server:', err);
      return { error: err };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <CompanySettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        refreshSettings: fetchSettings
      }}
    >
      {children}
    </CompanySettingsContext.Provider>
  );
};

export const useCompanySettings = () => {
  const context = useContext(CompanySettingsContext);
  if (!context) {
    throw new Error('useCompanySettings must be used within a CompanySettingsProvider');
  }
  return context;
};
