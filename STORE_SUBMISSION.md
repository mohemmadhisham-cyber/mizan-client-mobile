# Store submission readiness — MIZAN Client App

Last updated: 2026-07-16. Tracks what's ready to ship to the Apple App Store
and Google Play, and what still needs a human/account action.

## Ready (in the repo)

| Item | Status |
|---|---|
| App icon (`assets/images/mizan-mark.png`) + adaptive icon | ✅ present |
| Splash screen (expo-splash-screen plugin) | ✅ present |
| Bundle id / package (`com.mizan.client`, both platforms) | ✅ set |
| Version / build numbers (`1.0.0`, iOS `buildNumber` 1, Android `versionCode` 1) | ✅ set |
| **`eas.json`** (development / preview / production build profiles + submit) | ✅ added |
| Permission usage strings (camera, photos, microphone) with real rationale | ✅ set |
| Secret guard (`npm run check:secrets`) — only `EXPO_PUBLIC_*` inlined | ✅ passing |
| CI (typecheck, lint, i18n parity, secret scan on source + web bundle) | ✅ green |
| Public privacy-policy URL (stores require a reachable one) | ✅ https://mizan.team/privacy |
| Public terms URL | ✅ https://mizan.team/terms |

## Needs a human / account action (can't be done from the repo)

1. **Link the EAS project** — run `eas init` (needs an Expo account login). This
   writes `extra.eas.projectId` into `app.json`. Until then `eas build` can't run.
2. **First store build** — `eas build --profile production --platform all`
   (needs the Expo login + Apple/Google credentials EAS will prompt for).
3. **Apple + Google developer accounts** — Apple Developer Program ($99/yr) and
   Google Play Console ($25 one-time). Owner accounts; not something I can create.
4. **Store listings** — app name, subtitle, description, keywords, category
   (Finance), support URL. Draft copy can be prepared; the actual listing lives in
   App Store Connect / Play Console.
5. **Screenshots** — per device class (6.7"/6.5" iPhone, iPad, Android phone/tablet).
   Capture from a production build on real devices/simulators.
6. **Data-safety / privacy-nutrition declarations** — filled out in App Store
   Connect (privacy nutrition labels) and Play Console (Data safety form). Content:
   we collect account data (email), financial/receipt data the user submits, and
   camera/photo/mic access for capture — none sold, processed only to run the
   service. Mirror our Privacy Policy.
7. **Counsel-reviewed legal copy** — the in-app Privacy/Terms screens and the
   hosted mizan.team pages are honest drafts but not lawyer-reviewed. Get them
   signed off before public launch (tracked in the web repo's
   `docs/compliance/`).

## Pre-submission checklist (run on the release commit)

- [ ] `npm run typecheck` — clean
- [ ] `npm run lint` — clean
- [ ] `npm run check:secrets` — no forbidden secret in source or export
- [ ] `eas build --profile production --platform all` succeeds
- [ ] Smoke-test the production build on a real device (login → dashboard →
      capture a receipt → tasks → reports)
- [ ] Screenshots captured
- [ ] Data-safety / privacy forms completed in both consoles
- [ ] Privacy + support URLs reachable

## Note on `reactCompiler`

`app.json` enables the React Compiler (`experiments.reactCompiler: true`, still
beta on React 19). It's been stable in development, but do a full production-build
smoke test before relying on it for a store release; if anything misbehaves,
disabling it is a one-line change.
