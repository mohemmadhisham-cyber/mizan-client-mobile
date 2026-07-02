# CLAUDE.md — MIZAN Client App (native)

This repo is the **native mobile client** (Expo + React Native) for MIZAN's SME
clients (the `client_user` persona). It **inherits the platform operating
manual** (`mizan-platform/CLAUDE.md`) and the client-app roadmap
(`ROADMAP_CLIENT_APP.md`). This app **supersedes** the earlier "PWA-first,
native deferred" decision: we are building native and shipping to the Apple App
Store and Google Play Store.

## Non-negotiables (inherited from the platform manual)

- **Plan before building. Ask before** installs, migrations, secrets, deploys,
  new third-party services, or store submissions.
- **No secret ships in the bundle.** Only `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` are inlined. Service-role / Claude / Stripe
  keys stay in Supabase edge functions. Enforced by `npm run check:secrets`.
- **Same backend.** Talks to Supabase project `nnqylkxtwmqjnyyqufix` and its
  edge functions. Do not redefine domain types — mirror them from
  balance-beams-ai (the two-repo contract).
- **Money is integer minor units**, never float. Format via the shared util.
- **AI output is untrusted/advisory** — human-approved before anything posts.
- **Tenant isolation via RLS** — a `client_user` sees only their own company.
  Test cross-tenant denial.
- **Auth is passwordless email OTP**; sensitive actions require step-up OTP.
- **Accessibility (WCAG 2.2 AA), EN/AR + RTL, and light/dark** are requirements,
  not nice-to-haves.

## Stack

Expo SDK 57 · React Native 0.86 · React 19 · expo-router (file-based) ·
TypeScript strict · Reanimated 4 + gesture-handler (motion) · @supabase/supabase-js ·
expo-secure-store (chunked adapter for the auth session) · i18next (EN/AR).

## Commands

- `npm start` — Expo dev server
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `expo lint`
- `npm run check:secrets` — fail if a forbidden secret pattern is present
- `npm run android` / `npm run ios` — dev clients

## Design

Ports firm-guide-app's "calm financial confidence" token system (deep-teal
brand, warm off-white surfaces, warm-gold accent, tabular numerals, intentional
dark mode) into `src/theme`. North-star: modern, native motion (per the Dribbble
references). White-label: four brand variables swap at runtime, sourced from the
`firm-theme` edge function, falling back to MIZAN brand.
