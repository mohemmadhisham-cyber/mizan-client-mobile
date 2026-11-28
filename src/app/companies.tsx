import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Badge, Card, Skeleton, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { companiesService } from '@/services/companies';
import type { CompanyInfo, TeamMemberInfo } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

function explainAddCompany() {
  Alert.alert(
    'Add a company',
    'Companies are linked to your account by your accountant. Ask them to send an invite to your email — it appears here automatically once you accept.',
  );
}

export default function CompaniesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'companies' | 'team'>(params.tab === 'team' ? 'team' : 'companies');
  const { user, clientId } = useAuth();

  const companies = useQuery({ queryKey: ['companies', clientId], queryFn: () => companiesService.getCompanies(clientId) });
  const team = useQuery({ queryKey: ['team', clientId], queryFn: companiesService.getTeam });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title="Management" />
      <View style={{ flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.gutter, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <TabButton label="Companies" active={tab === 'companies'} onPress={() => setTab('companies')} />
        <TabButton label="Team" active={tab === 'team'} onPress={() => setTab('team')} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        {tab === 'companies' ? (
          !companies.data ? (
            <>
              <Skeleton height={100} radius={radius.lg} />
              <Skeleton height={100} radius={radius.lg} />
            </>
          ) : (
            <>
              {companies.data.map((c) => (
                <CompanyCard key={c.id} company={c} />
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={explainAddCompany}
                style={{
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: theme.colors.input,
                  borderRadius: radius.lg,
                  paddingVertical: spacing['2xl'],
                  alignItems: 'center',
                  gap: spacing.sm,
                }}>
                <Ionicons name="add-circle-outline" size={28} color={theme.colors.mutedForeground} />
                <Text variant="title" color="mutedForeground">
                  Add Company
                </Text>
              </Pressable>
            </>
          )
        ) : !team.data ? (
          <Skeleton height={200} radius={radius.lg} />
        ) : team.data.length === 0 ? (
          <Card>
            <Text variant="callout" color="mutedForeground">
              No teammates yet.
            </Text>
          </Card>
        ) : (
          <Card padded={false} elevated style={{ overflow: 'hidden' }}>
            {team.data.map((m, i) => (
              <TeamRow key={m.userId} member={m} isSelf={m.userId === user?.id} isLast={i === team.data.length - 1} />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: active ? theme.colors.primary : 'transparent' }}>
      <Text variant="title" color={active ? 'primary' : 'mutedForeground'}>
        {label}
      </Text>
    </Pressable>
  );
}

function CompanyCard({ company }: { company: CompanyInfo }) {
  const theme = useTheme();
  return (
    <Card elevated style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title">{company.name}</Text>
          <Badge
            label={company.status === 'active' ? 'Active' : 'Inactive'}
            bg={theme.colors.secondary}
            fg={theme.colors.mutedForeground}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Company options"
          onPress={() =>
            Alert.alert(
              company.name,
              `Status: ${company.status === 'active' ? 'Active' : 'Inactive'}\n${company.lastSyncedLabel}\n\nThis company is managed by your accountant.`,
            )
          }
          hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.mutedForeground} />
        </Pressable>
      </View>
      <Text variant="footnote" color="mutedForeground">
        {company.lastSyncedLabel}
      </Text>
    </Card>
  );
}

function TeamRow({ member, isSelf, isLast }: { member: TeamMemberInfo; isSelf: boolean; isLast: boolean }) {
  const theme = useTheme();
  const joined = new Date(member.joinedAt);
  const joinedLabel = Number.isNaN(joined.getTime())
    ? ''
    : `Joined ${joined.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.base,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text variant="callout" weight="bold" color="primary">
          {member.email[0]?.toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="semibold">
          {isSelf ? 'You' : member.email}
        </Text>
        <Text variant="footnote" color="mutedForeground">
          {isSelf ? member.email : joinedLabel}
        </Text>
      </View>
    </View>
  );
}
