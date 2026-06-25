import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, Calendar, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromLocation = (location.state as any)?.from;
  const from = fromLocation
    ? `${fromLocation.pathname}${fromLocation.search || ''}${fromLocation.hash || ''}`
    : '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      if (error.message === 'Invalid login credentials') {
        setError('Email ou mot de passe incorrect');
      } else if (error.message === 'Email not confirmed') {
        setError('Votre e-mail n\'est pas confirmé. Veuillez vérifier votre boîte de réception pour valider votre compte.');
      } else {
        setError(error.message || 'Une erreur est survenue. Veuillez réessayer.');
      }
      setIsLoading(false);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors duration-300 overflow-hidden">
      
      {/* Left Panel - Illustration & Branding (Visible on Desktop) */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] bg-gradient-to-br from-[#0B0F19] via-[#0F172A] to-[#1E293B] relative items-center justify-center p-12 overflow-hidden border-r border-slate-800/60">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary-600/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow"></div>
        
        {/* Abstract Grid Overlap */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>
        
        <div className="relative max-w-lg text-center lg:text-left space-y-8 animate-float">
          <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
            <img
              src="/logo-gico.png"
              alt="GICO SARL"
              className="h-16 w-16 object-contain rounded-xl bg-white p-1"
            />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
              Suivi Intelligent des <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-400">Visites GICO</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Une plateforme moderne de gestion, facturation et archivage des visites au sein de GICO SARL. Optimisez l'accueil et accélérez le traitement des dossiers de vos visiteurs.
            </p>
          </div>

          {/* Micro Stats Widget */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-left">
              <Calendar className="w-5 h-5 text-primary-400 mb-2" />
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Temps réel</p>
              <p className="text-sm font-bold text-white mt-1">Tableau de bord dynamique</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-left">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Sécurité</p>
              <p className="text-sm font-bold text-white mt-1">Accès sécurisé par profil</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative z-10">
        
        {/* Decorative elements for mobile background */}
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 bg-primary-500/10 rounded-full blur-[80px] lg:hidden"></div>
        <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] lg:hidden"></div>

        <div className="w-full max-w-md space-y-8">
          
          {/* Logo visible on mobile only */}
          <div className="lg:hidden text-center space-y-4">
            <div className="inline-flex p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
              <img
                src="/logo-gico.png"
                alt="GICO SARL"
                className="h-14 w-14 object-contain rounded-lg"
              />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">GICO VISIT TRACKER</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Système de suivi des visites</p>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-lg rounded-3xl border border-slate-100 dark:border-slate-800/80 p-8 sm:p-10 shadow-2xl">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Se connecter</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Renseignez vos identifiants pour accéder à l'application</p>
              </div>

              {error && (
                <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3 animate-slide-in-top">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="label">Adresse email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-11"
                      placeholder="votre.email@gicosarl.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="label">Mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pl-11 pr-11"
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/15 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99] mt-2"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      Connexion en cours...
                    </span>
                  ) : (
                    'Se connecter'
                  )}
                </button>
              </form>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center space-y-3">
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Accès réservé au personnel autorisé de GICO SARL</p>
                <Link
                  to="/setup"
                  className="inline-block text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors hover:underline"
                >
                  Premier accès ? Créer le compte administrateur
                </Link>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Besoin d'aide ? Contactez l'administrateur système
          </p>
        </div>
      </div>
    </div>
  );
}
