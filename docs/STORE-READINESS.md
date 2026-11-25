# Mizan Connect: store readiness

Audit of 2026-11-25, on branch `feat/connect-expo-58` (Expo SDK 58). Requested by the owner: find free tools, say what the app is missing for the App Store and Google Play, what tests and security tests are needed, and which pages are not built.

**Verdict: not ready to submit.** Twelve blockers below. None is hard; four need the owner's decision or account, three need the backend.

Store rules change. Before a submission, each rule quoted here must be read again at its source.

## 1. Free tools found

Searched GitHub on 2026-11-25. All are free to use. Stars and licences are as GitHub reported them that day.

| Tool | What it does for us | Licence | Needs |
|---|---|---|---|
| [expo/skills](https://github.com/expo/skills) (4.2k stars) | Expo's own guides for an AI agent. `eas-app-stores` covers building, signing and submitting to both stores; `expo-upgrade` covers SDK upgrades | MIT | Nothing to install: read as reference |
| [EAS CLI](https://github.com/expo/eas-cli) | Builds the iPhone and Android apps in the cloud and uploads them to the stores | MIT | An Expo account (have one). Builds have a free monthly allowance, then cost money |
| [Maestro](https://github.com/mobile-dev-inc/Maestro) (16.5k) | End-to-end tests on a real app: sign in, open Home, approve a request, send a message | Apache-2.0 | Installing its command-line tool; an emulator or a phone |
| [React Native Testing Library](https://github.com/callstack/react-native-testing-library) (3.4k) with Jest | Unit and screen tests in the repo, run on every pull request | MIT | Two dev packages: owner's approval |
| [MobSF](https://github.com/MobSF/Mobile-Security-Framework-MobSF) (22k) | Scans the built `.apk` and `.ipa` for security faults | GPL-3.0 (used as a tool, not shipped) | Docker, and a built app |
| [OWASP MASVS](https://github.com/OWASP/masvs) and [MASTG](https://github.com/OWASP/mastg) | The standard checklist for mobile app security, and how to test each point | CC-BY-SA | Nothing: a checklist |
| [Semgrep](https://github.com/semgrep/semgrep) (18k) | Static scan of our code for insecure patterns | LGPL-2.1 | Installing its tool |
| [Gitleaks](https://github.com/gitleaks/gitleaks) (31k) | Scans the whole git history for leaked keys (our own check covers current files only) | MIT | Installing its tool |
| [OSV-Scanner](https://github.com/google/osv-scanner) (11.6k) | Checks every package against the public vulnerability database | Apache-2.0 | Installing its tool |
| `npx expo-doctor` | Expo's health check of the project | MIT | Already used: 19 of 20 pass |

Not recommended: fastlane (EAS already does this for an Expo app), Detox (Maestro is simpler for our needs).

## 2. Blockers: must be fixed before submitting

| # | Missing | Why it blocks | Who |
|---|---|---|---|
| 1 | **Delete my account, inside the app** | Apple Guideline 5.1.1(v): an app that lets people create an account must let them start deleting it in the app. Google Play asks the same, plus a web link | App screen + backend |
| 2 | **Real privacy policy and terms** | `src/services/legal-content.ts` says of itself: placeholder, not reviewed by counsel. Both stores also need the policy at a public web address | Owner + lawyer |
| 3 | **A review account** | Sign-in is by emailed code. A store reviewer cannot receive it. Apple rejects apps it cannot sign in to (Guideline 2.1). Needs a demo client with data and a fixed way in | Backend + owner |
| 4 | **App icon is not square** (2658 x 1677) | Expo doctor fails on it; a build needs 1024 x 1024. The brand kit has the right file | `app.json`: owner's approval |
| 5 | **App name and splash** | Name is "Mizan", splash is the old light one. Decided name is Mizan Connect | `app.json`: owner's approval |
| 6 | **iPad** | `supportsTablet` is on, so Apple reviews the app on an iPad. The screens are designed for a phone | Decide: turn it off, or design iPad |
| 7 | **AI advisor: consent** | Apple Guideline 5.1.2(i): say clearly that personal data goes to a third-party AI and get permission first. Google Play: AI-generated content needs a way to report it | App screen + legal text |
| 8 | **Privacy answers for both stores** | Apple's App Privacy form and Google's Data safety form. We collect: email, financial information, photos, audio, messages, documents | Owner, with a list we prepare |
| 9 | **Google's Financial features declaration** | Required for every app on Play; ours handles financial information | Owner, in Play Console |
| 10 | **Production build has never been made** | `eas.json` production profile has no server address or key; the submit profile is empty. No development build exists either | Us, after approvals |
| 11 | **Encryption declaration** | Without `ITSAppUsesNonExemptEncryption` in `app.json`, Apple asks at every upload | `app.json`: owner's approval |
| 12 | **No tests at all** | Not a store rule, but nothing protects sign-in, approvals or uploads from breaking silently. Today's upgrade found uploads had been failing unnoticed | Us, after approval of the test packages |

Also to know before the first Android release: a personal Google Play developer account created after November 2023 must run a closed test with at least 12 testers for 14 days before it may publish. An organisation account does not, but needs a D-U-N-S number.

## 3. Security

### Checked today

| Check | Result |
|---|---|
| Secrets in source (`npm run check:secrets`) | None |
| Known vulnerabilities, shipped packages (`npm audit --omit=dev`) | 3 moderate, all in Expo's build tooling (`minimatch`), none in code that runs on the phone. No fix offered that does not go back to SDK 52 |
| Where the session is kept | Encrypted device storage (`expo-secure-store`), not plain storage |
| Links that can sign someone in | Off (`detectSessionInUrl: false`) |
| Approvals | Need a one-time code; the request id comes from the server's list, never from a link |
| Opening links | The report download opens only `https`; payment pages open in the system browser, no card entered in the app |
| Debug logging | No `console` statement in the source |
| File uploads | Were throwing on every call. Fixed in PR #12 |

### Not checked: needs its own work

- **The server.** Row-level security (can one client ever read another's data), the edge functions, the storage buckets, rate limits. This decides the app's real security and is in the backend repo.
- **A scan of the built apps** with MobSF. Needs a production build first.
- **The whole git history** with Gitleaks.
- **The OWASP MASVS checklist**, point by point.

### Recommended for a finance app, not built

- Face ID / fingerprint lock when the app opens.
- Hide the screen in the app switcher.
- Sign out after a period of no use.
- A warning on a jailbroken or rooted phone.

## 4. Tests needed

| Kind | Covers | Tool | State |
|---|---|---|---|
| Unit | Money formatting, request parsing, link checks | Jest | None. 30 checks for the request parser exist as a one-off script, not in the repo |
| Screen | Home states, Requests count, Approve buttons on and off | React Native Testing Library | None |
| End-to-end | Sign in, Home, approve, decline, message with photo and voice, report download, Arabic | Maestro | None |
| Devices | Small iPhone, large iPhone, two Android sizes | Phones or emulators | Not done on any device |
| Accessibility | VoiceOver, TalkBack, large text, Reduce Motion, contrast | By hand | Partly, in code review only |
| Arabic | Every screen right to left, by a native speaker | By hand | Not done |
| No connection | Every screen offline | By hand | Not done |

## 5. Pages not built

| Page | State |
|---|---|
| Delete my account | Missing. Blocker 1 |
| AI consent | Missing. Blocker 7 |
| Help and contact support | Missing. Apple asks for a support address; people need a way to reach someone |
| Page not found | Missing: a bad link shows the router's default |
| Something went wrong (error screen) | Missing: a crash in one screen takes the app down |
| No connection | Missing as a designed state |
| Update required | Missing: no way to stop an old version that the server no longer supports |
| App lock (Face ID) | Missing |
| Notification settings and push notifications | Missing. `expo-notifications` is not installed |
| About: version, licences | Missing |
| Invitation (join by your accountant's invite) | Designed, not built. Today an invite arrives as a link into the email step |
| Sign-in and code screens on the new design | Old layout |
| Calendar, More, Settings, Companies, Documents, Activity, Notifications, Billing, Receipt capture on the new design | Old layout, working |
| Your services | Designed, needs backend |
| A figure in detail, month / quarter / year | Designed, needs backend |
| Book a meeting | Designed, needs backend |
| Invoices from your accountant, with payment | Designed, needs backend |
| Month plan: agreed targets and progress | Asked for on 2026-11-25. Design to follow; needs backend |

Built on the new design so far: launch intro, welcome, Home, Requests, Approve, Messages, Reports, one report with PDF download.

## 6. Uploading to the stores: who does what

Stream D never types a password, a code or a payment detail. Those steps are the owner's.

| Step | Who |
|---|---|
| Apple Developer Program, 99 USD a year. Google Play Console, 25 USD once | Owner |
| Sign in to Expo's build service on this PC (`npx eas-cli login --browser`) | Owner |
| Create the app records in App Store Connect and Play Console | Owner, with our checklist |
| Approve the `app.json` changes (name, icon, splash, iPad, encryption line) | Owner |
| Signing keys | Expo creates and keeps them; owner confirms in the prompt |
| Build, upload to TestFlight and Play's internal track | Us, on the owner's go |
| Store listing: screenshots, description in English and Arabic, privacy answers | We draft, owner approves and submits |
| Press "Submit for review" | Owner |

## 7. Suggested order

1. Owner tests the current build on a phone (now possible on SDK 58).
2. Decide blockers 4, 5, 6 and 11: one `app.json` change.
3. Approve the test packages; add the first tests and one Maestro flow.
4. Backend: review account, account deletion, server security review.
5. Build Delete my account, AI consent, Help, error screens.
6. Lawyer: privacy policy and terms.
7. First production build to TestFlight and Play internal testing. MobSF scan of both.
8. Fix what the scan and the testers find. Then submit.
