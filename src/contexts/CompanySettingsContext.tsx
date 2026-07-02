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
  logo_url: string | null;
  currency: string;
  visit_prefix: string;
  invoice_prefix: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  id: '',
  company_name: 'GICO SARL',
  slogan: 'Gestion & Intégration de Services Collaboratifs',
  rccm: 'BF-OUA-2026-B-1234',
  ifu: '00123456X',
  phone: '+226 25 30 00 00',
  email: 'contact@gico.bf',
  website: 'www.gico.bf',
  logo_url: null,
  currency: 'XOF',
  visit_prefix: 'VT',
  invoice_prefix: 'FAC'
};

interface CompanySettingsContextType {
  settings: CompanySettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<CompanySettings>) => Promise<{ error: any }>;
  refreshSettings: () => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsContextType | undefined>(undefined);

export const CompanySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1);

      if (error) {
        // Table might not exist yet, fallback silently
        console.warn('Company settings table query failed, using defaults:', error.message);
        setSettings(DEFAULT_SETTINGS);
      } else if (data && data.length > 0) {
        setSettings(data[0]);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (e) {
      console.error('Error fetching company settings:', e);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<CompanySettings>) => {
    try {
      // If we don't have an ID (i.e. default settings loaded), we might insert or update the first record
      let id = settings.id;
      
      if (!id) {
        // Query to check if there is a row we can target
        const { data } = await supabase.from('company_settings').select('id').limit(1);
        if (data && data.length > 0) {
          id = data[0].id;
        }
      }

      let error;
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
          setSettings(data[0]);
        }
      }

      if (!error) {
        await fetchSettings();
      }
      return { error };
    } catch (err: any) {
      console.error('Failed to update company settings:', err);
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
