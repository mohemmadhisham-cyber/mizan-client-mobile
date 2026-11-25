import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FieldBack, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow } from '@/components/horizon/ruled';
import { WordTabs } from '@/components/horizon/word-tabs';
import i18n from '@/i18n';
import { useAuth } from '@/lib/auth-context';
import { localeTag } from '@/lib/format';
import { companiesService } from '@/services/companies';
import type { CompanyInfo, TeamMemberInfo } from '@/services/types';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const COMPANIES_FIELD = 150;

type Tab = 'companies' | 'team';

function explainAddCompany() {
  Alert.alert(
    i18n.t('companies.addTitle'),
    i18n.t('companies.addBody'),
  );
}

export default function CompaniesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'team' ? 'team' : 'companies');
  const { user, clientId } = useAuth();

  const companies = useQuery({ queryKey: ['companies', clientId], queryFn: () => companiesService.getCompanies(clientId) });
  const team = useQuery({ queryKey: ['team', clientId], queryFn: companiesService.getTeam });

  return (
    <HorizonScreen
      field={COMPANIES_FIELD}
      small
      lines={[{ text: t('companies.title') }]}
      top={<FieldBack colors={colors} />}
      // Who and what is on the account: nothing here is waiting for the person.
      bridge={null}>
      <WordTabs
        options={[
          { key: 'companies', label: t('more.companies') },
          { key: 'team', label: t('more.team') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'companies' ? (
        companies.isError && !companies.data ? (
          <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void companies.refetch()} />
        ) : !companies.data ? (
          <RuledRow title={t('common.loading')} />
        ) : (
          <>
            {companies.data.map((c) => (
              <CompanyRow key={c.id} company={c} />
            ))}
            <RuledRow title={t('companies.addCompany')} onPress={explainAddCompany} />
          </>
        )
      ) : team.isError && !team.data ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={() => void team.refetch()} />
      ) : !team.data ? (
        <RuledRow title={t('common.loading')} />
      ) : team.data.length === 0 ? (
        <RuledRow title={t('companies.noTeammates')} plain />
      ) : (
        team.data.map((m) => <TeamRow key={m.userId} member={m} isSelf={m.userId === user?.id} />)
      )}
    </HorizonScreen>
  );
}

/** A company: its name, whether it is active, and when it was last brought up to date. */
function CompanyRow({ company }: { company: CompanyInfo }) {
  const { t } = useTranslation();
  const status = company.status === 'active' ? t('companies.active') : t('companies.inactive');
  return <RuledRow title={company.name} meta={`${status} · ${company.lastSyncedLabel}`} />;
}

function TeamRow({ member, isSelf }: { member: TeamMemberInfo; isSelf: boolean }) {
  const { t } = useTranslation();
  const joined = new Date(member.joinedAt);
  const joinedLabel = Number.isNaN(joined.getTime())
    ? ''
    : t('companies.joined', { date: joined.toLocaleDateString(localeTag(), { month: 'short', year: 'numeric' }) });
  return (
    <RuledRow
      title={isSelf ? t('common.you') : member.email}
      meta={(isSelf ? member.email : joinedLabel) || undefined}
    />
  );
}
