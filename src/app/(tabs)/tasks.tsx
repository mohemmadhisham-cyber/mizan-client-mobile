import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AppHeader } from '@/components/navigation/app-header';
import { StepUpModal } from '@/components/tasks/step-up-modal';
import { Badge, Card, Screen, Skeleton, Text } from '@/components/ui';
import { tasksService } from '@/services/tasks';
import type { ActionCenterTask } from '@/services/types';
import { radius, spacing, useTheme } from '@/theme';

export default function TasksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [stepUpTask, setStepUpTask] = useState<ActionCenterTask | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const urgent = useQuery({ queryKey: ['tasks-urgent'], queryFn: tasksService.getUrgent });
  const pending = useQuery({ queryKey: ['tasks-pending'], queryFn: tasksService.getPending });
  const completed = useQuery({ queryKey: ['tasks-completed-summary'], queryFn: tasksService.getCompletedSummary });

  const urgentTasks = (urgent.data ?? []).filter((t) => !approvedIds.has(t.id));

  function handleAction(task: ActionCenterTask) {
    if (task.actionKind === 'upload-receipt') {
      router.push('/capture');
    } else if (task.actionKind === 'approve') {
      setStepUpTask(task);
    } else {
      Alert.alert('Coming soon', `"${task.actionLabel}" isn't available yet.`);
    }
  }

  function handleVerified() {
    if (stepUpTask) setApprovedIds((prev) => new Set(prev).add(stepUpTask.id));
    setStepUpTask(null);
    void qc.invalidateQueries({ queryKey: ['tasks-completed-summary'] });
  }

  return (
    <Screen scroll header={<AppHeader />}>
      <View style={{ gap: 4, marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <Text variant="h2" weight="semibold">
          Action Center
        </Text>
        <Text variant="body" color="mutedForeground">
          Review and approve pending items from your accountant.
        </Text>
      </View>

      <Card padded={false} elevated style={{ marginBottom: spacing.lg, overflow: 'hidden' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: '#BA1A1A' }} />
            <Text variant="title">Requires Attention</Text>
          </View>
          <Badge label={`${urgentTasks.length} Urgent`} bg="#FFDAD6" fg="#BA1A1A" />
        </View>

        {!urgent.data ? (
          <View style={{ padding: spacing.base, gap: spacing.md }}>
            <Skeleton height={100} radius={radius.md} />
          </View>
        ) : urgentTasks.length === 0 ? (
          <View style={{ padding: spacing.base }}>
            <Text variant="callout" color="mutedForeground">
              {"You're all caught up."}
            </Text>
          </View>
        ) : (
          urgentTasks.map((task, i) => (
            <UrgentTaskRow key={task.id} task={task} isLast={i === urgentTasks.length - 1} onAction={() => handleAction(task)} />
          ))
        )}
      </Card>

      <Card padded={false} elevated style={{ marginBottom: spacing.lg, overflow: 'hidden' }}>
        <View
          style={{
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}>
          <Text variant="title">Pending Review</Text>
        </View>
        {!pending.data ? (
          <View style={{ padding: spacing.base }}>
            <Skeleton height={80} radius={radius.md} />
          </View>
        ) : (
          <View style={{ padding: spacing.xs }}>
            {pending.data.map((task) => (
              <PendingTaskRow key={task.id} task={task} onAction={() => handleAction(task)} />
            ))}
          </View>
        )}
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.full,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="checkmark-done" size={20} color={theme.colors.mutedForeground} />
          </View>
          <View>
            <Text variant="title">Recently Completed</Text>
            <Text variant="footnote" color="mutedForeground">
              {completed.data?.label ?? '—'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedForeground} />
      </Card>

      <StepUpModal
        visible={Boolean(stepUpTask)}
        scope={stepUpTask ? `approval:${stepUpTask.id}` : ''}
        title={stepUpTask?.actionLabel ?? ''}
        onCancel={() => setStepUpTask(null)}
        onVerified={handleVerified}
      />
    </Screen>
  );
}

function UrgentTaskRow({ task, isLast, onAction }: { task: ActionCenterTask; isLast: boolean; onAction: () => void }) {
  const theme = useTheme();
  const isPrimary = task.actionKind === 'approve';
  return (
    <View
      style={{
        padding: spacing.base,
        gap: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 4, paddingRight: spacing.md }}>
          <Text variant="title">{task.title}</Text>
          <Text variant="footnote" color="mutedForeground">
            {task.description}
          </Text>
        </View>
        <Badge label={task.badgeLabel} bg="#FFDAD6" fg="#BA1A1A" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {task.metaLabel ? (
          <Text variant="caption" color="mutedForeground">
            {task.metaLabel}
          </Text>
        ) : (
          <View />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={{
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.sm,
            borderRadius: radius.sm,
            backgroundColor: isPrimary ? theme.colors.primary : 'transparent',
            borderWidth: isPrimary ? 0 : 1,
            borderColor: theme.colors.primary,
          }}>
          <Text
            variant="caption"
            weight="semibold"
            style={{ color: isPrimary ? theme.colors.primaryForeground : theme.colors.primary, letterSpacing: 0.6 }}>
            {task.actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PendingTaskRow({ task, onAction }: { task: ActionCenterTask; onAction: () => void }) {
  return (
    <View style={{ padding: spacing.sm, gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="callout" weight="semibold">
          {task.title}
        </Text>
        <Badge label={task.badgeLabel} bg="rgba(107,254,156,0.2)" fg="#006D37" />
      </View>
      <Text variant="footnote" color="mutedForeground">
        {task.description}
      </Text>
      <Pressable accessibilityRole="button" onPress={onAction} style={{ alignSelf: 'flex-end', paddingTop: spacing.xs }}>
        <Text variant="caption" weight="semibold" color="primary" style={{ letterSpacing: 0.6 }}>
          {task.actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
