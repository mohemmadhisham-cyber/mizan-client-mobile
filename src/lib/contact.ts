/**
 * Who provides the app and how to reach them. Shown in Help, About and the
 * account-deletion screen.
 *
 * The company details are from the trade licence. The mailbox is the one the
 * app's privacy text already publishes; the owner still has to confirm it is
 * read, and may replace it with a dedicated support address.
 */
export const COMPANY_NAME = 'MIZAN AI TECHNOLOGIES (FZE)';
export const COMPANY_ADDRESS = 'Block C-C01-206, Sharjah Research, Technology and Innovation Park, Sharjah, United Arab Emirates';
export const SUPPORT_EMAIL = 'privacy@mizan.team';

/** A `mailto:` link with the subject filled in. The subject is encoded; nothing else is added. */
export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
