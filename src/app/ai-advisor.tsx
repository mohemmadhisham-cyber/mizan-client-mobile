import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
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

import { FieldBack, HORIZON_GUTTER, horizonFieldHeight, HorizonScreen } from '@/components/horizon/horizon-screen';
import { RuledRow, SectionLabel } from '@/components/horizon/ruled';
import { WORD_TABS_HEIGHT, WordTabs } from '@/components/horizon/word-tabs';
import { TypingIndicator } from '@/components/ai-advisor/typing-indicator';
import { AccountantChatView } from '@/components/accountant-chat/accountant-chat-view';
import { AiConsent } from '@/components/ai-advisor/ai-consent';
import { Text } from '@/components/ui';
import { useKeyboardShown } from '@/hooks/use-keyboard-shown';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { hasAiConsent } from '@/lib/ai-consent';
import { useAuth } from '@/lib/auth-context';
import { askAi } from '@/services/ai-advisor';
import { uploadReceipt } from '@/services/receipts';
import { transcribeRecording } from '@/services/transcription';
import { radius, spacing, useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

/** Height of the field: a one-line title and one quiet line. Kept short so the conversation has the room. */
const ADVISOR_FIELD = 148;
/** While typing, the field gives up its quiet line: on a small phone the keyboard leaves little room. */
const ADVISOR_FIELD_TYPING = 112;
const BUBBLE_RADIUS = 14;
const BUBBLE_TAIL = 3;
const SEND_SIZE = 40;
const COMPOSER_MIN_HEIGHT = 52;

type AdvisorTab = 'advisor' | 'queries';

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
  const [tab, setTab] = useState<AdvisorTab>(params.tab === 'queries' ? 'queries' : 'advisor');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const voice = useVoiceRecorder();
  const router = useRouter();
  const colors = horizonColors(theme.colors);
  const typing = useKeyboardShown();
  const field = typing ? ADVISOR_FIELD_TYPING : ADVISOR_FIELD;
  // Both conversations start below the field and the tab line, so the keyboard must clear that much.
  const chatOffset = horizonFieldHeight(insets.top, field) + WORD_TABS_HEIGHT;
  const userId = user?.id;
  const [consented, setConsented] = useState(() => hasAiConsent(userId));

  // Read again each time this screen comes back into view: the agreement can
  // be withdrawn in Settings while this screen stays open underneath.
  useFocusEffect(
    useCallback(() => {
      setConsented(hasAiConsent(userId));
    }, [userId]),
  );

  /** Checked at the moment of sending, not only when the screen opened. */
  function stillConsented(): boolean {
    if (hasAiConsent(userId)) return true;
    setConsented(false);
    return false;
  }

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, busy]);

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    if (!stillConsented()) return;
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
    if (!voice.isRecording && !stillConsented()) return;
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

  // Asked once, before first use. Until then no question, file or recording leaves the app for an AI provider.
  if (tab === 'advisor' && !consented) {
    // The agreement is recorded per person. With no one signed in there is no one to ask.
    if (!userId) return null;
    return (
      <AiConsent
        userId={userId}
        onAgreed={() => setConsented(true)}
        // Opened from a link there may be nothing to go back to.
        onDeclined={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    );
  }

  return (
    <HorizonScreen
      field={field}
      small
      scroll={false}
      safeBottom={false}
      lines={[{ text: t('nav.aiAdvisor') }]}
      // What the answers are worth, said where it is always in view.
      sub={typing ? undefined : t('horizonAdvisor.sub')}
      top={<FieldBack colors={colors} />}
      // A conversation: nothing here is waiting for a decision.
      bridge={null}>
      <WordTabs
        options={[
          { key: 'advisor', label: t('aiAdvisorScreen.tabAdvisor') },
          { key: 'queries', label: t('aiAdvisorScreen.tabQueries') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'queries' ? (
        <AccountantChatView clientId={clientId} firmId={firmId} userId={user?.id} keyboardOffset={chatOffset} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={chatOffset}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: spacing.base, flexGrow: 1 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 ? (
              // Before the first question: a greeting, and three questions to start from.
              <>
                <View style={{ paddingHorizontal: HORIZON_GUTTER }}>
                  <Text variant="callout" color="mutedForeground">
                    {t('aiAdvisorScreen.greeting')}
                  </Text>
                </View>
                <SectionLabel>{t('horizonAdvisor.tryAsking')}</SectionLabel>
                {PROMPT_PILL_KEYS.map((key) => (
                  <RuledRow key={key} title={t(key)} onPress={() => void send(t(key))} />
                ))}
              </>
            ) : (
              <View style={{ paddingHorizontal: HORIZON_GUTTER, gap: spacing.md }}>
                {messages.map((m) => (
                  <ChatBubble key={m.id} message={m} />
                ))}
                {busy ? <TypingIndicator label={t('horizonAdvisor.writing')} /> : null}
              </View>
            )}
          </ScrollView>

          <View style={{ paddingHorizontal: HORIZON_GUTTER, paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm }}>
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
                borderRadius: radius.md,
                paddingStart: spacing.base,
                paddingEnd: spacing.xs,
                minHeight: COMPOSER_MIN_HEIGHT,
              }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t('aiAdvisorScreen.placeholder')}
                accessibilityLabel={t('aiAdvisorScreen.placeholder')}
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
                hitSlop={4}
                style={{ padding: spacing.sm }}
                disabled={voice.isRecording}>
                <Ionicons name="attach-outline" size={20} color={theme.colors.mutedForeground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={voice.isRecording ? t('aiAdvisorScreen.stopAndTranscribe') : t('aiAdvisorScreen.recordQuestion')}
                onPress={handleMicPress}
                disabled={transcribing}
                hitSlop={4}
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
                  width: SEND_SIZE,
                  height: SEND_SIZE,
                  borderRadius: radius.sm,
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
    </HorizonScreen>
  );
}

/** One turn of the conversation, in the same shapes as the chat with the accountant. */
function ChatBubble({ message }: { message: ChatMessage }) {
  const theme = useTheme();

  // A notice from the app (a document was sent, credits ran out): a quiet line, not a speaker.
  if (message.role === 'system') {
    return (
      <Text variant="footnote" color="mutedForeground" center accessibilityLiveRegion="polite">
        {message.text}
      </Text>
    );
  }

  const isSelf = message.role === 'user';
  // My questions: the field's colour in light. In dark that colour is almost the
  // ground's, so a raised surface is used instead, to keep the shape visible.
  const mine = theme.dark
    ? { bg: theme.colors.surface, fg: theme.colors.surfaceForeground }
    : { bg: theme.colors.brand, fg: theme.colors.brandForeground };

  return (
    <View
      style={{
        alignSelf: isSelf ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        backgroundColor: isSelf ? mine.bg : 'transparent',
        borderWidth: 1,
        borderColor: isSelf ? mine.bg : theme.colors.border,
        borderRadius: BUBBLE_RADIUS,
        // The tight corner points at the speaker; logical, so it mirrors in Arabic.
        borderBottomEndRadius: isSelf ? BUBBLE_TAIL : BUBBLE_RADIUS,
        borderBottomStartRadius: isSelf ? BUBBLE_RADIUS : BUBBLE_TAIL,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
      }}>
      <Text variant="body" style={{ color: isSelf ? mine.fg : theme.colors.foreground }}>
        {message.text}
      </Text>
    </View>
  );
}
