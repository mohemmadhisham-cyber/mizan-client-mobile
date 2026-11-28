import { Redirect, useLocalSearchParams } from 'expo-router';

import { inviteTokenFrom } from '@/lib/invite-link';

/**
 * Where an invitation email's link lands when the app is installed:
 * https://mizan.team/accept-invite?token=… opens here (Android App Links), and
 * goes straight to the sign-in screen with the invitation filled in. A link
 * whose token is not in the form the server gives out goes to the welcome
 * screen instead, carrying nothing.
 */
export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const valid = inviteTokenFrom(token);
  return <Redirect href={valid ? { pathname: '/email', params: { token: valid } } : '/welcome'} />;
}
