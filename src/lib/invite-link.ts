/**
 * The invitation token from a link, or null. The server makes it from two
 * random UUIDs with the dashes taken out: 40 lower-case hex characters. A
 * link can carry anything, so only that form is passed on to the sign-in
 * screen, which asks the server about it.
 */
const INVITE_TOKEN = /^[0-9a-f]{32,64}$/;

export function inviteTokenFrom(value: unknown): string | null {
  const one = Array.isArray(value) ? value[0] : value;
  return typeof one === 'string' && INVITE_TOKEN.test(one) ? one : null;
}
