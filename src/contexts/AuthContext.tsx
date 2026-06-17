import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, Profile, UserRole } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to prevent database queries from hanging infinitely (e.g. due to RLS recursion)
const withTimeout = async <T,>(promise: Promise<T> | PromiseLike<T>, ms = 4000): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Database query timed out')), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const { data: profile, error: selectError } = await withTimeout(
            supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
          );

          if (profile) {
            setProfile(profile);
          } else {
            console.log("Profile not found or error, attempting auto-create:", selectError);
            const fallbackFullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Collaborateur';
            const fallbackRole = (session.user.user_metadata?.role || 'collaborator') as UserRole;
            const validRoles = ['admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'collaborator', 'nurse'];
            const checkedRole = validRoles.includes(fallbackRole) ? fallbackRole : 'collaborator';

            const { data: newProfile, error: insertError } = await withTimeout(
              supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email || '',
                  full_name: fallbackFullName,
                  role: checkedRole,
                  is_active: true
                })
                .select()
                .single()
            );

            if (!insertError && newProfile) {
              setProfile(newProfile);
            } else {
              console.error("Auto profile creation failed:", insertError);
              setProfile(null);
            }
          }
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const { data: profile, error: selectError } = await withTimeout(
            supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
          );

          if (profile) {
            setProfile(profile);
          } else {
            console.log("Profile not found or error, attempting auto-create on auth change:", selectError);
            const fallbackFullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Collaborateur';
            const fallbackRole = (session.user.user_metadata?.role || 'collaborator') as UserRole;
            const validRoles = ['admin', 'director', 'reception', 'service_manager', 'accounting', 'cashier', 'collaborator', 'nurse'];
            const checkedRole = validRoles.includes(fallbackRole) ? fallbackRole : 'collaborator';

            const { data: newProfile, error: insertError } = await withTimeout(
              supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email || '',
                  full_name: fallbackFullName,
                  role: checkedRole,
                  is_active: true
                })
                .select()
                .single()
            );

            if (!insertError && newProfile) {
              setProfile(newProfile);
            } else {
              console.error("Auto profile creation failed on auth change:", insertError);
              setProfile(null);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth state change processing failed:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserRole = 'reception') => {
    const { error: authError, data } = await supabase.auth.signUp({ email, password });
    if (authError) return { error: authError };

    if (data.user) {
      const roleHierarchy: UserRole[] = ['admin', 'director', 'service_manager', 'accounting', 'reception'];
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role: roleHierarchy.includes(role) ? role : 'reception'
      });
      if (profileError) return { error: profileError };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!profile) return false;
    return requiredRoles.includes(profile.role);
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, signOut, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
