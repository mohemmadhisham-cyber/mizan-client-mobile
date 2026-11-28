import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

import type { CompanyInfo, TeamMemberInfo } from './types';

/** Companies & Team management, both real.
 * `getCompanies` reads the caller's own company from `clients` (RLS: "clients
 * client read", id = user_client(auth.uid())) -- always exactly one row,
 * since one client_user maps to one company today. Adding another company to
 * the *same* login needs a cross-repo RLS change (tracked separately, not
 * built here).
 * `getTeam` calls the `get_client_team_members` RPC, which resolves the
 * caller's own client_id server-side and returns real teammate emails from
 * auth.users. */

function relativeSyncLabel(updatedAt: string | null): string {
  if (!updatedAt) return i18n.t('companies.notSynced');
  const ms = Date.now() - new Date(updatedAt).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return i18n.t('companies.syncedJustNow');
  if (hours < 24) return i18n.t('companies.syncedHours', { count: hours });
  const days = Math.floor(hours / 24);
  return i18n.t('companies.syncedDays', { count: days });
}

export const companiesService = {
  async getCompanies(clientId: string | null): Promise<CompanyInfo[]> {
    if (!clientId) return [];
    const { data, error } = await supabase.from('clients').select('id, name, status, updated_at').eq('id', clientId).maybeSingle();
    if (error || !data) return [];
    return [
      {
        id: data.id,
        name: data.name,
        status: data.status === 'active' ? 'active' : 'inactive',
        lastSyncedLabel: relativeSyncLabel(data.updated_at),
      },
    ];
  },
  async getTeam(): Promise<TeamMemberInfo[]> {
    const { data, error } = await supabase.rpc('get_client_team_members');
    if (error || !data) return [];
    return (data as { user_id: string; email: string; joined_at: string }[]).map((r) => ({
      userId: r.user_id,
      email: r.email,
      joinedAt: r.joined_at,
    }));
  },
};
