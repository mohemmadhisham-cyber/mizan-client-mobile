import type { CompanyInfo, TeamMemberInfo } from './types';

/** Companies & Team management. Fixture-backed (real interface) -- swap to a
 * live query once multi-company switching (per-client_id) and team invites
 * are wired to the backend. */

const COMPANIES: CompanyInfo[] = [
  { id: 'c1', name: 'Acme Corp', status: 'active', lastSyncedLabel: 'Last synced: 2 hrs ago' },
  { id: 'c2', name: 'Beta Tech', status: 'active', lastSyncedLabel: 'Last synced: 1 day ago' },
];

const TEAM: TeamMemberInfo[] = [
  { id: 't1', name: 'You', role: 'owner', email: 'you@company.com' },
  { id: 't2', name: 'Jamie Lee', role: 'admin', email: 'jamie@company.com' },
  { id: 't3', name: 'Priya Nair', role: 'viewer', email: 'priya@company.com' },
];

export const companiesService = {
  async getCompanies(): Promise<CompanyInfo[]> {
    return COMPANIES;
  },
  async getTeam(): Promise<TeamMemberInfo[]> {
    return TEAM;
  },
};
