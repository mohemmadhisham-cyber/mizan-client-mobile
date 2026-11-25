import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { forgetPushOnSignOut } from '@/lib/push';
import { supabase } from '@/lib/supabase';

export type AppRole = 'hq_ops_admin' | 'hq_finance' | 'agent_owner' | 'agent_staff' | 'client_user';

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  firmId: string | null;
  /** Set only for the client_user role (via user_roles.client_id). */
  clientId: string | null;
  /** The linked client company's access status ('active' | 'suspended'), or
   * null if there's no linked client yet. Read directly (not via RLS-gated
   * user_client()) so a suspended client can still see WHY they're gated. */
  clientStatus: string | null;
  loading: boolean;
  /** True while roles/clientId are being (re)fetched for an established session. */
  rolesLoading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

interface LoadedRoles {
  roles: AppRole[];
  firmId: string | null;
  clientId: string | null;
  clientStatus: string | null;
}

async function loadRoles(userId: string): Promise<LoadedRoles> {
  const { data } = await supabase.from('user_roles').select('role, firm_id, client_id').eq('user_id', userId);
  const rows = data ?? [];
  const roles = rows.map((r) => r.role as AppRole);
  const firmRow = rows.find((r) => r.firm_id);
  const clientRow = rows.find((r) => r.role === 'client_user' && r.client_id);
  const clientId = (clientRow?.client_id as string | undefined) ?? null;

  let clientStatus: string | null = null;
  if (clientId) {
    // Deliberately NOT gated by user_client() (which only resolves active
    // clients) — a suspended client still needs to read their own status to
    // see the suspended screen. RLS still restricts this to the caller's own
    // client row via a dedicated policy, not user_client().
    const { data: client } = await supabase.from('clients').select('status').eq('id', clientId).maybeSingle();
    clientStatus = client?.status ?? null;
  }

  return {
    roles,
    firmId: (firmRow?.firm_id as string | undefined) ?? null,
    clientId,
    clientStatus,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientStatus, setClientStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        setRolesLoading(true);
        const r = await loadRoles(data.session.user.id);
        if (!mounted) return;
        setRoles(r.roles);
        setFirmId(r.firmId);
        setClientId(r.clientId);
        setClientStatus(r.clientStatus);
        setRolesLoading(false);
      }
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setRolesLoading(true);
        // Defer the Supabase call to avoid re-entrancy deadlocks (Supabase guidance).
        setTimeout(() => {
          loadRoles(sess.user.id).then((r) => {
            setRoles(r.roles);
            setFirmId(r.firmId);
            setClientId(r.clientId);
            setClientStatus(r.clientStatus);
            setRolesLoading(false);
          });
        }, 0);
      } else {
        setRoles([]);
        setFirmId(null);
        setClientId(null);
        setClientStatus(null);
        setRolesLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    user,
    roles,
    firmId,
    clientId,
    clientStatus,
    loading,
    rolesLoading,
    signOut: async () => {
      // First, while there is still a session to say it with: this phone stops being sent
      // this person's notifications. It waits a few seconds at most.
      if (user) await forgetPushOnSignOut(user.id);
      await supabase.auth.signOut();
    },
    refresh: async () => {
      if (!user) return;
      setRolesLoading(true);
      const r = await loadRoles(user.id);
      setRoles(r.roles);
      setFirmId(r.firmId);
      setClientId(r.clientId);
      setClientStatus(r.clientStatus);
      setRolesLoading(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
