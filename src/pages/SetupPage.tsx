import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCompanySettings } from '../contexts/CompanySettingsContext';
import { Eye, EyeOff, Lock, Mail, User, Phone, CheckCircle, AlertCircle, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function SetupPage() {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();
  const [checking, setChecking] = useState(true);
  const [alreadySetup, setAlreadySetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
  });

  useEffect(() => {
    checkSetupNeeded();
  }, []);

  const checkSetupNeeded = async () => {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');

    if ((count ?? 0) > 0) {
      setAlreadySetup(true);
    }
    setChecking(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm_password) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setSaving(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Échec de la création du compte');

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: form.email,
        full_name: form.full_name,
        role: 'admin',
        phone: form.phone || null,
        is_active: true,
      });

      if (profileError) throw profileError;

      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 dark:text-primary-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors duration-300 overflow-hidden">
      
      {/* Left Panel - Branding (Visible on Desktop) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] bg-gradient-to-br from-[#0B0F19] via-[#0F172A] to-[#1E293B] relative items-center justify-center p-12 overflow-hidden border-r border-slate-800/60">
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-primary-600/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-25"></div>

        <div className="relative max-w-md space-y-6">
          <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
            <img
              src={settings.logo_url || "/logo-gico.png"}
              alt={settings.company_name}
              className="h-12 w-12 object-contain rounded-xl bg-white p-1"
            />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Configuration Initiale</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Créez le compte administrateur racine de votre système de gestion de visites. Ce compte aura tous les privilèges d'administration système, de création des services et d'attribution des rôles de facturation.
          </p>
          <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-900/30 backdrop-blur-md">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Note de sécurité</p>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Assurez-vous d'utiliser une adresse email professionnelle et un mot de passe hautement sécurisé pour ce compte.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Setup Forms */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          
          {/* Logo on mobile only */}
          <div className="lg:hidden text-center space-y-3">
            <img
              src={settings.logo_url || "/logo-gico.png"}
              alt={settings.company_name}
              className="h-14 w-14 object-contain rounded-xl bg-white p-1 shadow-md mx-auto"
            />
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{settings.company_name} VISIT TRACKER</h1>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-lg rounded-3xl border border-slate-100 dark:border-slate-800/80 p-8 shadow-2xl">
            {alreadySetup ? (
              <div className="text-center py-6 space-y-6">
                <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Système déjà configuré</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Un compte administrateur racine existe déjà pour cette base de données.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-md"
                >
                  Aller à la page de connexion
                </button>
              </div>
            ) : done ? (
              <div className="text-center py-6 space-y-6">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white font-extrabold">Compte créé !</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Votre compte administrateur a été configuré avec succès pour <strong>{form.email}</strong>.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-md"
                >
                  Se connecter maintenant
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Créer le compte racine</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Veuillez renseigner les détails du super-administrateur</p>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label">Nom complet *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                      <input
                        name="full_name"
                        type="text"
                        value={form.full_name}
                        onChange={handleChange}
                        className="input pl-11"
                        placeholder="Jean Dupont"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Adresse email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        className="input pl-11"
                        placeholder="admin@gicosarl.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Numéro de téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                      <input
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        className="input pl-11"
                        placeholder="+225 07 00 00 00 00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Mot de passe *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={handleChange}
                        className="input pl-11 pr-11"
                        placeholder="Minimum 8 caractères"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Confirmer le mot de passe *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                      <input
                        name="confirm_password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.confirm_password}
                        onChange={handleChange}
                        className="input pl-11"
                        placeholder="Confirmer votre mot de passe"
                        required
                      />
                    </div>
                  </div>

                  {/* Password strength indicators */}
                  {form.password.length > 0 && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl space-y-1.5 border border-slate-100 dark:border-slate-800">
                      {[
                        { check: form.password.length >= 8, label: '8 caractères minimum' },
                        { check: /[A-Z]/.test(form.password), label: 'Une lettre majuscule' },
                        { check: /[0-9]/.test(form.password), label: 'Un chiffre ou caractère spécial' },
                      ].map(({ check, label }) => (
                        <div key={label} className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                          <CheckCircle2 className={`w-4 h-4 ${check ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-700'}`} />
                          <span className={check ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary-500/15 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99] mt-2"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                        Configuration du compte...
                      </span>
                    ) : (
                      'Créer le compte racine'
                    )}
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Déjà configuré ?{' '}
                    <button onClick={() => navigate('/login')} className="text-primary-600 dark:text-primary-400 hover:underline font-bold">
                      Se connecter
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
