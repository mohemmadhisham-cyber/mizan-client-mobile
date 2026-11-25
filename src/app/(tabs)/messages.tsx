import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountantChatView } from '@/components/accountant-chat/accountant-chat-view';
import { FieldMark, horizonFieldHeight, HorizonScreen } from '@/components/horizon/horizon-screen';
import { useAuth } from '@/lib/auth-context';

/** Height of the field: a one-line title and one quiet line. Kept short so the conversation has the room. */
const MESSAGES_FIELD = 148;
/** While typing, the field gives up its quiet line: on a small phone the keyboard leaves little room. */
const MESSAGES_FIELD_TYPING = 112;

/** True while the on-screen keyboard is up. */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/**
 * Messages with the accountant, as its own tab: text, photos and voice
 * messages. The conversation is the shared chat view; this screen gives it the
 * frame. No bridge here: nothing on this screen is waiting for a decision.
 */
export default function MessagesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, clientId, firmId } = useAuth();
  const typing = useKeyboardShown();
  const field = typing ? MESSAGES_FIELD_TYPING : MESSAGES_FIELD;

  return (
    <HorizonScreen
      field={field}
      small
      scroll={false}
      safeBottom={false}
      lines={[{ text: t('horizonMessages.title') }]}
      sub={typing ? undefined : t('horizonMessages.sub')}
      top={<FieldMark />}
      bridge={null}>
      <AccountantChatView
        clientId={clientId}
        firmId={firmId}
        userId={user?.id}
        safeBottom={false}
        // The conversation starts below the field, so the keyboard must clear that much.
        keyboardOffset={horizonFieldHeight(insets.top, field)}
      />
    </HorizonScreen>
  );
}
