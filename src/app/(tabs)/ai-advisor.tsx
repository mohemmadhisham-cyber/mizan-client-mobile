import { Ionicons } from '@expo/vector-icons';
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
import { transcribeRecording } from '@/services/transcription';
import { radius, spacing, useTheme } from '@/theme';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
}

const PROMPT_PILLS = ['Check burn rate', 'Summarize reports', 'Forecast Q4'];

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
        ? "You've used all your AI credits for this period. Ask your accountant to top up."
        : res.accountLocked
          ? 'Your AI access is currently locked. Contact your accountant for help.'
          : (res.error ?? 'Mizan could not respond right now.');
      setMessages((m) => [...m, { id: nextId(), role: 'system', text: notice }]);
      return;
    }

    setMessages((m) => [...m, { id: nextId(), role: 'assistant', text: res.content ?? '' }]);
  }

  async function handleMicPress() {
    if (voice.isRecording) {
      const recording = await voice.stop();
      if (!recording) return;
      setTranscribing(true);
      const res = await transcribeRecording(recording.uri);
      setTranscribing(false);
      if (!res.ok) {
        Alert.alert('Could not transcribe', res.error ?? 'Try again, or type your question instead.');
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
        <TabButton label="AI Advisor" active={tab === 'advisor'} onPress={() => setTab('advisor')} />
        <TabButton label="Accountant Queries" active={tab === 'queries'} onPress={() => setTab('queries')} />
      </View>

      {tab === 'queries' ? (
        <AccountantChatView clientId={clientId} firmId={firmId} userId={user?.id} />
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
                  Good morning. How can Mizan assist with your financial intelligence today?
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
              {PROMPT_PILLS.map((p) => (
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
                  Recording… {Math.round(voice.durationMillis / 1000)}s — tap the mic to transcribe
                </Text>
              </View>
            ) : transcribing ? (
              <Text variant="footnote" color="mutedForeground">
                Transcribing…
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
                accessibilityLabel="Attach"
                onPress={() => Alert.alert('Coming soon', 'Attachments are not yet available in Ask AI.')}
                style={{ padding: spacing.sm }}
                disabled={voice.isRecording}>
                <Ionicons name="attach-outline" size={20} color={theme.colors.mutedForeground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={voice.isRecording ? 'Stop and transcribe' : 'Record a voice question'}
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
                accessibilityLabel="Send"
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
            backgroundColor: '#D5E3FF',
            borderRadius: radius.xl,
            borderBottomRightRadius: 4,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
          }}>
          <Text variant="body" style={{ color: '#001B3C' }}>
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
