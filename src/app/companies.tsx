import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Card, Skeleton, Text } from '@/components/ui';
import { companiesService } from '@/services/companies';
import type { CompanyInfo, TeamMemberInfo, TeamRole } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

function comingSoon(feature: string) {
  Alert.alert('Coming soon', `${feature} isn't available yet.`);
}

const ROLE_LABEL: Record<TeamRole, string> = { owner: 'Owner', admin: 'Admin', viewer: 'Viewer' };

export default function CompaniesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'companies' | 'team'>(params.tab === 'team' ? 'team' : 'companies');

  const companies = useQuery({ queryKey: ['companies'], queryFn: companiesService.getCompanies });
  const team = useQuery({ queryKey: ['team'], queryFn: companiesService.getTeam });

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
                onPress={() => comingSoon('Adding a company')}
                style={{
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(0,30,64,0.2)',
                  borderRadius: radius.lg,
                  paddingVertical: spacing['2xl'],
                  alignItems: 'center',
                  gap: spacing.sm,
                }}>
                <Ionicons name="add-circle-outline" size={28} color="rgba(0,30,64,0.7)" />
                <Text variant="title" style={{ color: 'rgba(0,30,64,0.7)' }}>
                  Add Company
                </Text>
              </Pressable>
            </>
          )
        ) : !team.data ? (
          <Skeleton height={200} radius={radius.lg} />
        ) : (
          <Card padded={false} elevated style={{ overflow: 'hidden' }}>
            {team.data.map((m, i) => (
              <TeamRow key={m.id} member={m} isLast={i === team.data.length - 1} />
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
          <View style={{ backgroundColor: theme.colors.secondary, borderRadius: radius.full, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
            <Text variant="caption" weight="semibold" color="mutedForeground" style={{ letterSpacing: 0.6 }}>
              {company.status === 'active' ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => comingSoon('Company options')} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.mutedForeground} />
        </Pressable>
      </View>
      <Text variant="footnote" color="mutedForeground">
        {company.lastSyncedLabel}
      </Text>
    </Card>
  );
}

function TeamRow({ member, isLast }: { member: TeamMemberInfo; isLast: boolean }) {
  const theme = useTheme();
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
          {member.name[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="semibold">
          {member.name}
        </Text>
        <Text variant="footnote" color="mutedForeground">
          {member.email}
        </Text>
      </View>
      <Text variant="caption" weight="semibold" color="mutedForeground">
        {ROLE_LABEL[member.role]}
      </Text>
    </View>
  );
}
