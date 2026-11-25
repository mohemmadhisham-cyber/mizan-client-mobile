import { type Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Cta } from '@/components/horizon/cta';
import { FieldMark, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { useAuth } from '@/lib/auth-context';

const MORE_FIELD = 200;
const SIGN_OUT_SPACE_ABOVE = 28;
const SIGN_OUT_SPACE_BELOW = 24;

interface MoreItem {
  /** Translation key of the row label. */
  labelKey: string;
  href: Href;
}

interface MoreGroup {
  /** Translation key of the group's label. */
  titleKey: string;
  items: MoreItem[];
}

// Grouped by what the person is looking for, not listed as one long menu.
const GROUPS: MoreGroup[] = [
  {
    titleKey: 'more.groupBooks',
    items: [
      { labelKey: 'nav.reports', href: '/reports' },
      { labelKey: 'nav.documents', href: '/documents' },
      { labelKey: 'nav.activity', href: '/activity' },
      { labelKey: 'more.askAi', href: '/ai-advisor' },
    ],
  },
  {
    titleKey: 'more.groupCompany',
    items: [
      { labelKey: 'more.billing', href: '/billing' },
      { labelKey: 'more.team', href: { pathname: '/companies', params: { tab: 'team' } } },
      { labelKey: 'more.companies', href: '/companies' },
    ],
  },
  {
    titleKey: 'more.groupApp',
    items: [
      { labelKey: 'more.notifications', href: '/notifications' },
      { labelKey: 'more.settings', href: '/settings' },
      { labelKey: 'support.helpTitle', href: '/help' },
    ],
  },
];

/** Everything that is not one of the four main tabs, in three plain groups. */
export default function MoreScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <HorizonScreen
      field={MORE_FIELD}
      small
      lines={[{ text: t('more.titleA') }, { text: t('more.titleB'), soft: true }]}
      sub={user?.email ?? undefined}
      top={<FieldMark />}
      // Nothing on this screen is waiting for the person.
      bridge={null}
      safeBottom={false}>
      {GROUPS.map((group) => (
        <View key={group.titleKey}>
          <SectionLabel>{t(group.titleKey)}</SectionLabel>
          {group.items.map((item) => (
            <RuledRow key={item.labelKey} title={t(item.labelKey)} onPress={() => router.push(item.href)} />
          ))}
        </View>
      ))}

      <View
        style={{
          paddingHorizontal: HORIZON_GUTTER,
          paddingTop: SIGN_OUT_SPACE_ABOVE,
          paddingBottom: SIGN_OUT_SPACE_BELOW,
        }}>
        <Cta kind="outline" title={t('auth.signOut')} onPress={() => void signOut()} />
      </View>
    </HorizonScreen>
  );
}
