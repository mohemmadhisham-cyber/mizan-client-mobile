import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, Text } from '@/components/ui';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { accountantChatService, isAudioMime, type ChatAttachment, type ChatMessage } from '@/services/accountant-chat';
import { radius, spacing, useTheme } from '@/theme';

interface AccountantChatViewProps {
  clientId: string | null;
  firmId: string | null;
  userId: string | undefined;
}

export function AccountantChatView({ clientId, firmId, userId }: AccountantChatViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<ChatAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const voice = useVoiceRecorder();

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    accountantChatService.getMessages(clientId).then((msgs) => {
      if (!cancelled) setMessages(msgs);
    });
    const unsubscribe = accountantChatService.subscribeToMessages(clientId, (message) => {
      setMessages((prev) => (prev ? [...prev, message] : [message]));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [clientId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  async function pickAttachment() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access in Settings to attach a file.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPending({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', fileName: asset.fileName ?? undefined });
  }

  async function sendWith(attachment: ChatAttachment | null, body: string) {
    if (!clientId || !firmId || !userId) {
      Alert.alert('Not linked yet', 'Your account is not linked to a company yet.');
      return;
    }
    setBusy(true);
    const res = await accountantChatService.sendMessage(clientId, firmId, userId, body, attachment ?? undefined);
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Could not send', res.error ?? 'Try again.');
      return;
    }
    setInput('');
    setPending(null);
  }

  async function send() {
    const body = input.trim();
    if ((!body && !pending) || busy) return;
    await sendWith(pending, body || '(attachment)');
  }

  async function handleMicPress() {
    if (voice.isRecording) {
      const recording = await voice.stop();
      if (recording) await sendWith({ uri: recording.uri, mimeType: 'audio/m4a' }, 'Voice message');
      return;
    }
    await voice.start();
  }

  if (!clientId) {
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title="Accountant Queries"
        message="Your account isn't linked to a company yet, so there's no one to message."
      />
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing.gutter, gap: spacing.md, flexGrow: 1 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages === null ? null : messages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.sm }}>
            <Ionicons name="chatbubbles-outline" size={32} color={theme.colors.primary} />
            <Text variant="footnote" color="mutedForeground" center style={{ maxWidth: 240 }}>
              {"Message your accountant here. They'll see it and can reply directly."}
            </Text>
          </View>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} isSelf={m.senderUserId === userId} />)
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm }}>
        {pending ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Image source={{ uri: pending.uri }} style={{ width: 40, height: 40, borderRadius: radius.sm }} />
            <Text variant="footnote" color="mutedForeground" style={{ flex: 1 }}>
              Attachment ready to send
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setPending(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={theme.colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        {voice.isRecording ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger }} />
            <Text variant="footnote" color="mutedForeground">
              Recording… {Math.round(voice.durationMillis / 1000)}s — tap the mic to send
            </Text>
          </View>
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
            placeholder="Message your accountant..."
            placeholderTextColor={theme.colors.mutedForeground}
            style={{ flex: 1, color: theme.colors.foreground, fontSize: 16, paddingVertical: spacing.sm }}
            multiline
            editable={!voice.isRecording}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Attach" onPress={pickAttachment} style={{ padding: spacing.sm }} disabled={voice.isRecording}>
            <Ionicons name="attach-outline" size={20} color={theme.colors.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voice.isRecording ? 'Stop and send recording' : 'Record voice message'}
            onPress={handleMicPress}
            style={{ padding: spacing.sm }}>
            <Ionicons name={voice.isRecording ? 'stop-circle' : 'mic-outline'} size={20} color={voice.isRecording ? theme.colors.danger : theme.colors.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={(!input.trim() && !pending) || busy}
            onPress={send}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: (!input.trim() && !pending) || busy ? 0.5 : 1,
            }}>
            <Ionicons name="arrow-up" size={18} color={theme.colors.primaryForeground} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, isSelf }: { message: ChatMessage; isSelf: boolean }) {
  const theme = useTheme();
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const isAudio = isAudioMime(message.attachmentMime);

  useEffect(() => {
    if (!message.attachmentPath) return;
    let cancelled = false;
    accountantChatService.getAttachmentUrl(message.attachmentPath).then((url) => {
      if (!cancelled) setAttachmentUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [message.attachmentPath]);

  return (
    <View style={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '80%', gap: 4 }}>
      <View
        style={{
          backgroundColor: isSelf ? '#D5E3FF' : theme.colors.card,
          borderRadius: radius.xl,
          borderBottomRightRadius: isSelf ? 4 : radius.xl,
          borderTopLeftRadius: isSelf ? radius.xl : 4,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
        }}>
        {isAudio && attachmentUrl ? (
          <VoiceMessagePlayer uri={attachmentUrl} tint={isSelf ? '#001B3C' : theme.colors.foreground} />
        ) : attachmentUrl ? (
          <Image source={{ uri: attachmentUrl }} style={{ width: 160, height: 160, borderRadius: radius.sm, marginBottom: spacing.xs }} />
        ) : null}
        {!isAudio ? (
          <Text variant="body" style={{ color: isSelf ? '#001B3C' : theme.colors.foreground }}>
            {message.body}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" color="mutedForeground" style={{ alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>
        {new Date(message.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </Text>
    </View>
  );
}

function VoiceMessagePlayer({ uri, tint }: { uri: string; tint: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
      onPress={() => (status.playing ? player.pause() : player.play())}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 140 }}>
      <Ionicons name={status.playing ? 'pause-circle' : 'play-circle'} size={32} color={tint} />
      <Text variant="footnote" style={{ color: tint }}>
        {status.duration ? `${Math.round((status.playing ? status.duration - status.currentTime : status.duration))}s` : 'Voice message'}
      </Text>
    </Pressable>
  );
}
