import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Lock, Mail, User, Phone, CheckCircle, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export default function SetupPage() {
  const navigate = useNavigate();
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
      setError('Le mot de passe doit contenir au moins 8 caracteres');
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
      if (!data.user) throw new Error('Echec de la creation du compte');

      const { error: profileError } = await supabase.from('profiles').insert({
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#1565a8]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1565a8] via-[#1a75bf] to-[#2196d3] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-lg relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1565a8] to-[#1a75bf] px-8 py-6 text-center">
            <div className="flex items-center justify-center mb-3">
              <img
                src="/logo-gico.png"
                alt="GICO SARL"
                className="h-16 w-16 object-contain rounded-xl bg-white p-1 shadow-lg"
              />
            </div>
            <h1 className="text-xl font-bold text-white">GICO VISIT TRACKER</h1>
            <p className="text-blue-100 text-sm mt-1">Configuration initiale</p>
          </div>

          <div className="px-8 py-8">
            {alreadySetup ? (
              /* Already configured */
              <div className="text-center py-4">
                <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Application deja configuree</h2>
                <p className="text-gray-500 mb-6">
                  Un compte administrateur existe deja. Veuillez vous connecter normalement.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 px-4 bg-[#1565a8] hover:bg-[#1253a0] text-white font-semibold rounded-lg transition-colors"
                >
                  Aller a la connexion
                </button>
              </div>
            ) : done ? (
              /* Success */
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Compte cree avec succes !</h2>
                <p className="text-gray-600 mb-2">
                  Votre compte administrateur a ete cree pour <strong>{form.email}</strong>.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Vous pouvez maintenant vous connecter et piloter toute l'application.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 px-4 bg-[#1565a8] hover:bg-[#1253a0] text-white font-semibold rounded-lg transition-colors"
                >
                  Se connecter
                </button>
              </div>
            ) : (
              /* Setup form */
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Creation du compte administrateur</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Ce compte aura acces a toutes les fonctionnalites de l'application.
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label">Nom complet *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        name="full_name"
                        type="text"
                        value={form.full_name}
                        onChange={handleChange}
                        className="input pl-10"
                        placeholder="Votre nom et prenom"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        className="input pl-10"
                        placeholder="admin@gicosarl.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Telephone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        className="input pl-10"
                        placeholder="+225 XX XX XX XX XX"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Mot de passe *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={handleChange}
                        className="input pl-10 pr-10"
                        placeholder="Minimum 8 caracteres"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Confirmer le mot de passe *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        name="confirm_password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.confirm_password}
                        onChange={handleChange}
                        className="input pl-10"
                        placeholder="Repetez le mot de passe"
                        required
                      />
                    </div>
                  </div>

                  {/* Password strength */}
                  {form.password.length > 0 && (
                    <div className="space-y-1">
                      {[
                        { check: form.password.length >= 8, label: 'Au moins 8 caracteres' },
                        { check: /[A-Z]/.test(form.password), label: 'Une majuscule' },
                        { check: /[0-9]/.test(form.password), label: 'Un chiffre' },
                      ].map(({ check, label }) => (
                        <div key={label} className="flex items-center gap-2 text-xs">
                          <CheckCircle className={`w-3.5 h-3.5 ${check ? 'text-emerald-500' : 'text-gray-300'}`} />
                          <span className={check ? 'text-emerald-600' : 'text-gray-400'}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3 px-4 bg-[#1565a8] hover:bg-[#1253a0] text-white font-semibold rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1565a8] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creation du compte...
                      </span>
                    ) : (
                      'Creer le compte administrateur'
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400">
                    Vous avez deja un compte ?{' '}
                    <button onClick={() => navigate('/login')} className="text-[#1565a8] hover:underline font-medium">
                      Se connecter
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
