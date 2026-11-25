import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/navigation/app-header';
import { TypingIndicator } from '@/components/ai-advisor/typing-indicator';
import { AccountantChatView } from '@/components/accountant-chat/accountant-chat-view';
import { Text } from '@/components/ui';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useAuth } from '@/lib/auth-context';
import { askAi } from '@/services/ai-advisor';
import { uploadReceipt } from '@/services/receipts';
import { transcribeRecording } from '@/services/transcription';
import { radius, spacing, useTheme } from '@/theme';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
}

const PROMPT_PILL_KEYS = ['aiAdvisorScreen.pillBurnRate', 'aiAdvisorScreen.pillSummarize', 'aiAdvisorScreen.pillForecast'];

let msgCounter = 0;
function nextId(): string {
  msgCounter += 1;
  return `m${msgCounter}`;
}

export default function AiAdvisorScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { clientId, firmId, user } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'advisor' | 'queries'>(params.tab === 'queries' ? 'queries' : 'advisor');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const voice = useVoiceRecorder();

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, busy]);

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setInput('');
    setMessages((m) => [...m, { id: nextId(), role: 'user', text: prompt }]);
    setBusy(true);

    const res = await askAi(prompt, clientId);
    setBusy(false);

    if (!res.ok) {
      const notice = res.insufficientTokens
        ? t('aiAdvisorScreen.outOfCredits')
        : res.accountLocked
          ? t('aiAdvisorScreen.locked')
          : (res.error ?? t('aiAdvisorScreen.noResponse'));
      setMessages((m) => [...m, { id: nextId(), role: 'system', text: notice }]);
      return;
    }

    setMessages((m) => [...m, { id: nextId(), role: 'assistant', text: res.content ?? '' }]);
  }

  // "Ask AI" is text-only server-side, so an attached document is genuinely
  // useful as something the ACCOUNTANT reviews — this uploads it through the
  // real receipts pipeline (same as Capture) and confirms in the thread.
  async function attachDocument() {
    if (!firmId || !clientId || !user) {
      Alert.alert(t('common.notLinkedTitle'), t('common.notLinkedBody'));
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.photoAccessTitle'), t('aiAdvisorScreen.photoAccessBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setMessages((m) => [...m, { id: nextId(), role: 'system', text: t('aiAdvisorScreen.uploading') }]);
    const res = await uploadReceipt({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' }, firmId, clientId, user.id);
    setMessages((m) => [
      ...m,
      {
        id: nextId(),
        role: 'system',
        text: res.ok
          ? t('aiAdvisorScreen.documentSent')
          : t('aiAdvisorScreen.attachFailed', { reason: res.error ?? t('aiAdvisorScreen.attachFailedReason') }),
      },
    ]);
  }

  async function handleMicPress() {
    if (voice.isRecording) {
      const recording = await voice.stop();
      if (!recording) return;
      setTranscribing(true);
      const res = await transcribeRecording(recording.uri);
      setTranscribing(false);
      if (!res.ok) {
        Alert.alert(t('aiAdvisorScreen.transcribeFailedTitle'), res.error ?? t('aiAdvisorScreen.transcribeFailedBody'));
        return;
      }
      if (res.text) setInput((prev) => (prev ? `${prev} ${res.text}` : (res.text ?? '')));
      return;
    }
    await voice.start();
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader />
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <TabButton label={t('aiAdvisorScreen.tabAdvisor')} active={tab === 'advisor'} onPress={() => setTab('advisor')} />
        <TabButton label={t('aiAdvisorScreen.tabQueries')} active={tab === 'queries'} onPress={() => setTab('queries')} />
      </View>

      {tab === 'queries' ? (
        <AccountantChatView clientId={clientId} firmId={firmId} userId={user?.id} safeBottom={false} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.top}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: spacing.gutter, gap: spacing.md, flexGrow: 1 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.sm }}>
                <Ionicons name="sparkles" size={32} color={theme.colors.primary} />
                <Text variant="footnote" color="mutedForeground" center style={{ maxWidth: 240 }}>
                  {t('aiAdvisorScreen.greeting')}
                </Text>
              </View>
            ) : null}

            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}

            {busy ? <TypingIndicator /> : null}
          </ScrollView>

          <View style={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.sm, gap: spacing.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {PROMPT_PILL_KEYS.map((key) => t(key)).map((p) => (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  onPress={() => send(p)}
                  style={{
                    backgroundColor: theme.colors.secondary,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.sm,
                  }}>
                  <Text variant="caption" weight="semibold">
                    {p}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {voice.isRecording ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger }} />
                <Text variant="footnote" color="mutedForeground">
                  {t('aiAdvisorScreen.recording', { seconds: Math.round(voice.durationMillis / 1000) })}
                </Text>
              </View>
            ) : transcribing ? (
              <Text variant="footnote" color="mutedForeground">
                {t('aiAdvisorScreen.transcribing')}
              </Text>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: radius.full,
                paddingLeft: spacing.base,
                paddingRight: spacing.xs,
                minHeight: 56,
              }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('aiAdvisorScreen.placeholder')}
                placeholderTextColor={theme.colors.mutedForeground}
                style={{ flex: 1, color: theme.colors.foreground, fontSize: 16, paddingVertical: spacing.sm }}
                multiline
                editable={!voice.isRecording}
                onSubmitEditing={() => send(input)}
                returnKeyType="send"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.attach')}
                onPress={attachDocument}
                style={{ padding: spacing.sm }}
                disabled={voice.isRecording}>
                <Ionicons name="attach-outline" size={20} color={theme.colors.mutedForeground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={voice.isRecording ? t('aiAdvisorScreen.stopAndTranscribe') : t('aiAdvisorScreen.recordQuestion')}
                onPress={handleMicPress}
                disabled={transcribing}
                style={{ padding: spacing.sm }}>
                <Ionicons
                  name={voice.isRecording ? 'stop-circle' : 'mic-outline'}
                  size={20}
                  color={voice.isRecording ? theme.colors.danger : theme.colors.mutedForeground}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.send')}
                disabled={!input.trim() || busy}
                onPress={() => send(input)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !input.trim() || busy ? 0.5 : 1,
                }}>
                <Ionicons name="arrow-up" size={18} color={theme.colors.primaryForeground} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
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
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 2,
        borderBottomColor: active ? theme.colors.primary : 'transparent',
      }}>
      <Text variant="caption" weight={active ? 'bold' : 'semibold'} color={active ? 'primary' : 'mutedForeground'} style={{ letterSpacing: 0.6 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const theme = useTheme();

  if (message.role === 'system') {
    return (
      <View
        style={{
          alignSelf: 'center',
          backgroundColor: theme.colors.accent,
          borderRadius: radius.md,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.sm,
          maxWidth: '90%',
        }}>
        <Text variant="footnote" center>
          {message.text}
        </Text>
      </View>
    );
  }

  if (message.role === 'user') {
    return (
      <View style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
        <View
          style={{
            backgroundColor: theme.colors.infoSoft,
            borderRadius: radius.xl,
            borderBottomRightRadius: 4,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
          }}>
          <Text variant="body" style={{ color: theme.colors.infoSoftForeground }}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignSelf: 'flex-start', maxWidth: '85%' }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name="sparkles" size={14} color={theme.colors.primaryForeground} />
      </View>
      <View
        style={[
          {
            backgroundColor: theme.colors.card,
            borderRadius: radius.xl,
            borderTopLeftRadius: 4,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
            flexShrink: 1,
          },
          theme.elevation.xs,
        ]}>
        <Text variant="body">{message.text}</Text>
      </View>
    </View>
  );
}
