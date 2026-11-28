import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatMinorUnits } from '@/lib/format';
import {
  type ClientService,
  type Engagement,
  getClientServices,
  type ServiceCadence,
} from '@/services/client-pages';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const SERVICES_FIELD = 190;
const NOTE_SPACE = 16;
/** A date-only value is formatted in UTC, so it never shows as the day before in another time zone. */
const DAY = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } as const;

const CADENCE_KEY: Record<ServiceCadence, string> = {
  one_time: 'servicesScreen.oneTime',
  monthly: 'servicesScreen.perMonth',
  quarterly: 'servicesScreen.perQuarter',
  yearly: 'servicesScreen.perYear',
};

const day = (value: string) => formatDate(`${value}T00:00:00Z`, DAY);

/**
 * What the accountant's firm does for this business: each engagement that is
 * running or finished, and the services on it with their price and how often
 * it is charged. A record to read; a change is asked of the accountant, and
 * the screen offers to book a meeting for that.
 */
export default function ServicesScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const { clientId } = useAuth();

  const services = useQuery({ queryKey: ['client-services', clientId ?? 'none'], queryFn: getClientServices });
  const { refreshing, onRefresh } = usePullToRefresh(() => services.refetch());

  const value = services.data?.status === 'ok' ? services.data.value : null;
  const arabic = i18n.language.startsWith('ar');
  const active = value?.engagements.filter((e) => e.status === 'active') ?? [];
  const closed = value?.engagements.filter((e) => e.status === 'closed') ?? [];
  const count = value?.services.length ?? 0;

  return (
    <HorizonScreen
      field={SERVICES_FIELD}
      small
      lines={
        value && count > 0
          ? [{ text: t('servicesScreen.count', { count }) }, { text: t('servicesScreen.countSoft'), soft: true }]
          : [{ text: t('servicesScreen.title') }]
      }
      sub={value?.firm ? t('servicesScreen.byFirm', { firm: value.firm }) : t('servicesScreen.sub')}
      subLines={1}
      top={<FieldBack colors={colors} />}
      // A record to read: nothing here waits for the person.
      bridge={null}
      refreshing={refreshing}
      onRefresh={onRefresh}>
      {services.isError && !services.data ? (
        <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
      ) : services.isPending ? (
        <RuledRow title={t('common.loading')} />
      ) : services.data?.status === 'not_offered' ? (
        <RuledRow title={t('servicesScreen.notOffered')} plain />
      ) : !value || value.engagements.length === 0 ? (
        <RuledRow title={t('servicesScreen.empty')} plain />
      ) : (
        <>
          {[...active, ...closed].map((engagement) => (
            <EngagementGroup
              key={engagement.id}
              engagement={engagement}
              services={value.services.filter((s) => s.engagementId === engagement.id)}
              arabic={arabic}
            />
          ))}
        </>
      )}
      <SectionLabel>{t('servicesScreen.changeLabel')}</SectionLabel>
      <RuledRow title={t('servicesScreen.askChange')} action={t('servicesScreen.book')} onPress={() => router.push('/book-meeting')} />
      <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingTop: NOTE_SPACE }}>
        <Text variant="footnote" color="mutedForeground">
          {t('servicesScreen.priceNote')}
        </Text>
      </View>
    </HorizonScreen>
  );
}

function EngagementGroup({ engagement, services, arabic }: { engagement: Engagement; services: ClientService[]; arabic: boolean }) {
  const { t } = useTranslation();
  const period = [engagement.periodStart ? day(engagement.periodStart) : null, engagement.periodEnd ? day(engagement.periodEnd) : null];
  const when =
    period[0] && period[1]
      ? t('servicesScreen.period', { from: period[0], to: period[1] })
      : period[0]
        ? t('servicesScreen.since', { date: period[0] })
        : null;
  return (
    <View>
      <SectionLabel>{engagement.status === 'closed' ? t('servicesScreen.closedName', { name: engagement.name }) : engagement.name}</SectionLabel>
      {when ? <RuledRow title={when} plain /> : null}
      {services.length === 0 ? (
        <RuledRow title={t('servicesScreen.noItems')} plain />
      ) : (
        services.map((service) => (
          <RuledRow
            key={service.id}
            title={arabic ? service.nameAr : service.nameEn}
            meta={t(CADENCE_KEY[service.cadence])}
            end={<Figure>{formatMinorUnits(service.priceMinor, service.currency, 2, true)}</Figure>}
          />
        ))
      )}
    </View>
  );
}
