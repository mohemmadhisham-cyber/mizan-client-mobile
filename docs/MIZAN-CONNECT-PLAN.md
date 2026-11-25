# Mizan Connect — audit, plan and design brief (2026-11-25)

Status: **draft for owner approval.** Design direction decided 2026-11-25 (D1: B with A's Requests screen); the other decisions in §11 are open. Nothing in this plan is built. No dependency is installed, no bundle id or app name is changed, no backend object is touched, nothing is deleted.

Stream D of four. Sources: the owner's brief of 2026-11-25; `# MIZAN — STRATEGIC TRANSFORMATION.txt` §2–8 and §14; `balance-beams-ai/docs/plans/mizan-pro/MASTER-PLAN.md`; the brand kit (`balance-beams-ai/mizan_brand_kit`); the owner's Design canvas "Flowdo App Concept"; this repository at `origin/main` (03c87dc) plus `feat/figma-reskin`; `flowdo/`; `balance-beams-ai` at `origin/main`; the live migration list of Supabase project `nnqylkxtwmqjnyyqufix` (read only).

Design proposal (three directions, interactive, private to the owner): https://claude.ai/code/artifact/a7918799-618d-41d8-b6f8-c4c20e8e659d

---

## 0. The short version

1. The app in this repository is already an accountant-led client app. It has **no self-signup that creates a business, no in-app purchase and no plan picker.** Stopping the self-managed channel costs very little here: two screens change meaning, one onboarding message changes, one quick-action row goes.
2. The self-managed channel exists mostly **in the database**. Four migrations (capture engine, pricing catalogue, usage ledger, leads function) are **applied on the live project** and contain the `self_managed` operating mode, the "Flowdo Direct" house firm and Flowdo plan groups. They are not committed to git in `balance-beams-ai`. Nothing there is deleted by this plan; the mode is switched off behind a guard after approval.
3. Mizan Connect is this app, enhanced: the home screen is organised by **the services the client bought**, with requests, reports, documents, agreements, invoices, meetings and messages hanging off each service and off one shared inbox. A client with one service sees a three-tab app.
4. About half of the backend the new app needs already exists and is in use (messages, document requests, approvals, reports, calendar, notifications, receipts). The other half exists for the professional but has **no client read path yet** (services, agreements, payment links, meetings join, dashboard snapshots, push tokens, branding mode). These are listed in §6 as descriptions, not as SQL, because another stream owns the database.
5. Native quality needs real work: every list is a `ScrollView`, most screens are English-only, the theme choice is not saved, the co-branding switch exists but is never called, and Android predictive back is turned off.

---

## 1. Audit of this repository

### 1.1 Shape

- Expo SDK 57, React Native 0.86, React 19, expo-router (typed routes), React Compiler on, Reanimated 4, TanStack Query, Supabase JS, i18next. About 9,500 lines in `src`.
- Navigation: a root `Stack` with a custom five-item tab bar (Home, Activity, AI Advisor, Reports, Tasks). `documents` and `more` are tab routes hidden from the bar. Detail screens are pushed on the root stack with a hand-built header. Only `capture` has a declared presentation (full-screen modal).
- State: server state in TanStack Query (stale 60 s, one retry). Auth in a React context (`src/lib/auth-context.tsx`) that loads `user_roles` and the client's status. Dashboard preferences in a small local module. No global client store, which is right for this size.
- Auth: email one-time code; invite accepted through the `client-accept` function; session stored in SecureStore with a chunked adapter. A gate (`use-auth-gate.ts`) routes to onboarding, pending-approval, access-suspended or the tabs.
- CI: typecheck, lint, i18n parity, secret scan. No unit or end-to-end tests exist.

### 1.2 Every screen

| Route | What it does | Data | State |
|---|---|---|---|
| `(onboarding)/welcome`, `email`, `verify` | Welcome, email, 6-digit code | Supabase OTP | Real. "Get Started" lets anyone create a login with no invite; they land on pending-approval. |
| `pending-approval` | "Ask your accountant for an invite" | `user_roles` | Real. English only. |
| `access-suspended` | Client suspended; "Renew now" opens a pay link | `client-billing` function | Real. Tied to firm dunning (see §3). |
| `(tabs)/index` Home | KPIs, cash chart, critical tasks, insights, quick actions | `client-dashboard` function (Odoo), `insights`, counts of approvals and document requests | Real. "Pay bill" and "Transfer" quick actions only open More: placeholders. |
| `(tabs)/activity` | Timeline of receipts and published reports | `receipts`, `report_deliveries` | Real. |
| `(tabs)/ai-advisor` | Ask-AI chat plus "Queries" tab = chat with the accountant | `ai` function; `accountant_messages` + realtime + `chat-attachments` bucket; `transcribe-audio` | Real. Two different things share one screen. |
| `(tabs)/reports`, `report/[id]`, `reports-archive` | Published reports, detail, archive, PDF link | `report_deliveries`, `documents` bucket | Real. |
| `(tabs)/tasks` | Approvals (with step-up code) and document requests | `approval_requests`, `document_requests`, `otp` | Real. One action kind still shows "Coming soon". |
| `(tabs)/documents` | The client's receipts and their status | `receipts` | Real, but it is receipts only, not a document vault. |
| `capture`, `receipt-wizard` | Camera or gallery, single or batch, OCR review, send to accountant | `receipts` bucket and table, `receipt-ocr` | Real. Client captures, accountant posts. Not self-managed. |
| `calendar` | Week strip, events, add event | `calendar_events` | Real. Meetings appear only as calendar rows; no join. |
| `notifications` | In-app notification centre | `notifications` | Real. No push notifications. |
| `billing` | The **firm's** Mizan plan and invoices, read-only | `get_my_firm_billing_summary`, `get_my_firm_invoices` | Real, but the wrong subject for a client (see §3). |
| `companies` | The client's one company, team list, "Add Company" explainer | `clients`, `get_client_team_members` | Real. One company per login today. |
| `settings`, `backup-codes` | Language, appearance, backup codes, sessions, legal | `backup-codes` function | Real. Theme mode is not persisted; language change asks for a restart. |
| `privacy-policy`, `terms-of-service` | In-app legal text | local file | Draft copy, not lawyer-reviewed. |
| `(tabs)/more` | Menu to the screens above | — | Real. |

Nothing in the app is sample data. Every service file reads the live backend or shows an empty state.

### 1.3 What is tied to self-managed or direct-to-client billing

| Piece | Finding |
|---|---|
| `billing.tsx`, `services/billing.ts` | Shows the professional's own Mizan subscription to the client. Under the new model the client should see **their** invoices from the professional, not the professional's bill from Mizan. |
| `access-suspended.tsx`, `grace-period-banner.tsx`, `services/client-billing.ts`, `firm-lock-status.ts` | The client is asked to "Renew now" for the firm's overdue Mizan invoice. This exposes firm dunning to the client and asks the client to pay Mizan directly. |
| `(onboarding)/welcome` "Get Started", `auth.ts` `sendEmailOtp(email, true)` | Creates a login for anyone. It does not create a business, so it is not a self-managed signup, but it invites people with no professional. |
| `companies.tsx` "Add Company" | Already explains that companies are linked by the accountant. Fine. |
| `capture.tsx` | Receipt capture for the accountant to review. Keep. |
| Home quick actions "Pay bill", "Transfer" | Placeholders that suggest self-service banking. |
| `(tabs)/ai-advisor` Ask-AI | A client-facing AI. The strategy file requires client-facing AI to be "separately governed and approved" and never to replace the professional by default. |

### 1.4 Performance and motion today

- **Lists:** no `FlatList`, `SectionList` or FlashList anywhere. Reports, receipts, notifications, activity, chat and tasks render with `ScrollView` + `.map`. Fine at 20 rows, slow and memory-heavy at 300.
- **Transitions:** default stack push everywhere except capture. No shared-element or layout transitions. Entering animations only on the welcome screen.
- **Android back:** `predictiveBackGestureEnabled: false` in `app.json`.
- **Tab bar:** indicator animates `width` and `translateX` on the UI thread; acceptable. Layout is measured with `onLayout` and React state, which re-renders the whole bar per tab.
- **Data:** Home fires five queries that share one edge-function call through a 30-second module cache; good. No persisted query cache, so a cold start with no network shows nothing.
- **Images:** `expo-image` is installed and used for receipts.
- **Colour:** 57 hard-coded hex values in screens and components bypass the theme, so they do not follow dark mode or co-branding.
- **Language:** 73 keys in `en.json`. About 15 of 27 screens have no translated strings at all. Right-to-left is honoured in a few places only (`I18nManager.isRTL` in More).

### 1.5 Store readiness

Ready: bundle id and package `com.mizan.client`, version 1.0.0, EAS project linked (`mizan92s-team`), build profiles, permission strings, secret scan, privacy and terms URLs.

Not ready:

- App name is "Mizan"; icon and splash are the old mark (`assets/images/mizan-mark.png`), not the brand kit's `MIZAN_Z_App_Icon_Dark.png`. Splash and adaptive-icon background are `#F9F9FE` (old lavender-white).
- `README.md` is the Expo template text.
- `eas.json` `production` has no `env`; the preview profile carries the public URL and publishable key inline (not a secret, but production needs the same two values).
- `ios.supportsTablet: true` with a phone-only portrait layout: Apple will review it on iPad.
- No push notification setup, no account-deletion path in the app (Apple requires one when accounts can be created in-app), no data-safety forms, no screenshots.
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK` is requested on Android; Google asks for a declaration and a video for foreground-service permissions. It is only needed if audio plays in the background.
- Legal copy is not lawyer-reviewed.

### 1.6 `flowdo/` repository

- Never committed (index only, no commits). Contains a README, a `CLAUDE.md`, two placeholder app READMEs, an `.env.example`, and `docs/db/` with four SQL drafts, a plain-English summary and isolation tests.
- The apps were never scaffolded. There is no code to migrate.
- Useful and worth keeping: `docs/db/PHASE1_SQL_SUMMARY.md` (the clearest description of the capture engine's safety rules), `phase1_isolation_tests.sql`, and the capture design itself (one photo → several receipts, duplicate check, WhatsApp forward, approval list with history). These serve professional-managed clients equally well.

### 1.7 Self-managed pieces in the backend (listed, not changed)

Verified against the live migration list on 2026-11-25:

| Piece | Where | State |
|---|---|---|
| `capture_engine_foundation` (20261108120000) | Live DB. File untracked in `balance-beams-ai/supabase/migrations` and in `flowdo/docs/db`. | **Applied.** Creates `capture_workspaces.operating_mode` (`self_managed` / `accountant_managed`), `acquired_via` (`flowdo_signup`, …), `approval_policy` (`owner_final`, `owner_draft`, `client_then_accountant`), the "Flowdo Direct" house firm row, `firms.is_house`, capture channels, messages, documents, jobs, proposals, the marketplace "Get an accountant" request and the mode-switch function with its log. |
| `pricing_catalog_billing` (20261108121000) | Same | **Applied.** Plan groups `flowdo_self` and `flowdo_managed`, `audience` and `visible_to` values that include `self_managed`, plans, meters, coupons, agent prices, capture subscriptions and entitlements, Services & Shop catalogue and orders. |
| `usage_cost_ledger` (20261108122000) | Same | **Applied.** Usage and cost per business. Not specific to self-managed. |
| `capture_leads_function` (20261109120000) | Same | **Applied.** Marketplace leads for agents from self-managed owners. |
| `capture-*`, `flowdo-*`, `pricing-*`, `cost-*` edge functions | Named in `flowdo/README.md` | **Do not exist** on `origin/main` (96 functions, none with these names). |
| `whatsapp-intake` function | `supabase/functions/whatsapp-intake` | Exists. Matches a sender's phone to a client and files the media in the document vault. Accountant-managed already. |
| Branch `claude/flowdo-track-b-44e4f7` | `balance-beams-ai` | Exists with a worktree. Not inspected in depth; the backend stream should say what it holds. |

Not known from here: whether any row in `capture_workspaces` has `operating_mode = 'self_managed'`, and whether any `capture_subscriptions` row exists. The backend stream should run those two counts before anything is switched off. If both are zero, there are no customers to migrate.

---

## 2. The owner's Design canvas ("Flowdo App Concept")

### 2.1 What it contains

Twenty artboards at 390 × 844, most of them clickable, in four rows:

1. **Getting started:** Welcome, Get started (phone number, then a choice: "Start my business on Flowdo" or "I have an invite from my accountant"), Business setup, Link WhatsApp assistant.
2. **Self-managed business:** Home, Approvals inbox (owner approves = recorded), Proposal from a WhatsApp order, Capture (one photo → three receipts), Assistant chat, On WhatsApp, Plan & billing (trial, tiers, paid through the App Store).
3. **Accountant-managed business:** Home ("Managed by Al Noor Accounting, powered by MIZAN"), Approvals ("You confirm. Al Noor records and posts."), My accountant (messages and requests in one place), Published reports and deadlines.
4. **Shared:** Services & Shop, Get an accountant (matched firms with prices), More (businesses and connections), Home in Arabic (right-to-left), the tab bar component.

Style: warm sand ground `#F5EFE6`, deep teal ink `#12302F`, green action `#1C7C64`, indigo `#3B4BA8` for anything that belongs to the accountant, cream cards with a 1 px sand border, radii 12 to 24, Bricolage Grotesque for headings and figures, Inter for text. A four-item tab bar whose third item changes with the mode (Assistant or Accountant). No motion notes.

### 2.2 Keep

- **Row 3 as the spine of Mizan Connect.** The managed Home, "You confirm, your accountant posts", My accountant with messages and requests side by side, and Published reports with deadlines are already the new concept.
- **The colour rule that the professional has their own colour.** In the new brand this becomes the co-brand accent (§7).
- **"Managed by … powered by MIZAN"** on Home. This is Mode 2 co-branding in one line.
- **Capture: one photo, several receipts, duplicates checked.** It serves a managed client as well as it served a self-managed one.
- **Approvals with a confidence chip and a visible state after the tap** (Reviewing, Recorded).
- **Deadlines "handled by Al Noor"** with Filed, Preparing, Upcoming.
- **More → Your businesses** as a switcher. It becomes the provider and company switch the strategy file asks for.
- **The Arabic home** as proof that right-to-left is designed, not mirrored by accident.
- **Four tabs, not five.**

### 2.3 Conflicts with the new concept

| Canvas piece | Conflict | What happens to it |
|---|---|---|
| Name "Flowdo" on every screen and in the wordmark | Replaced by Mizan Connect; the drawn "Flowdo" logo is replaced by the supplied Mizan files | Renamed, relogoed |
| Row 2 entirely (self-managed Home, owner-final Approvals, Plan & billing) | The channel is discontinued | Archived on the canvas; nothing built |
| Get started → "Start my business on Flowdo, 7-day free trial" | Self-signup that creates a business | Removed; invite or request-a-professional only |
| Business setup, Link WhatsApp as self-service steps | Set up by the professional during onboarding | Reused inside the professional's onboarding of a client |
| Plan & billing "Paid through the App Store" | No client subscription to Mizan; also removes the store's in-app-purchase rules from scope | Removed. Replaced by "Invoices & payments" from the professional |
| Assistant tab and "On WhatsApp" assistant number | "Discontinue the standalone AI responder" | Disabled for clients by default; see §5.6 |
| Get an accountant marketplace with prices | A self-managed owner choosing among firms. Every client now already has a professional | Reused as "Request another service" sent to the client's own professional |
| Services & Shop: financing, devices, Flowdo/MIZAN toggle | Financing and devices are separate regulated or commercial decisions | Parked. Only "Other services from your professional" remains |
| Colours and type | The new brand kit sets Forest Green `#153F35`, Muted Gold `#B69A68`, Deep Black `#111816`, Warm Ivory `#F5F3EE`, Manrope + Inter + IBM Plex Sans Arabic | The canvas's layout carries over; its palette and fonts do not |
| Sign-in by phone number | The app and backend use email one-time codes | Keep email unless the owner decides otherwise (SMS has a per-message cost and needs a provider) |

---

## 3. Self-managed removal — classification

Classes are the strategy file's: KEEP, REUSE, DISABLE, REFACTOR, ARCHIVE, REMOVE AFTER APPROVAL. No historical data is destroyed by any row.

### 3.1 This repository

| Piece | Class | Action |
|---|---|---|
| Email one-time code, invite accept (`auth.ts`, `client-accept`) | KEEP | Unchanged |
| Welcome "Get Started" open sign-up | REFACTOR | Two paths: "I have an invite" and "I don't have a professional yet" (sends an inquiry to the CRM; creates no account). Sign-in for existing users stays. |
| `pending-approval` | REFACTOR | Becomes "Waiting for your professional"; translated; offers the inquiry path |
| `capture`, `receipt-wizard`, `receipts.ts` | KEEP | Becomes one action inside Documents and inside a service |
| `billing.tsx`, `services/billing.ts` | REFACTOR | Becomes "Invoices & payments": the client's own invoices (`invoices client read` policy exists) and pay links. The firm's Mizan plan is no longer shown to a client. |
| `access-suspended`, `grace-period-banner`, `client-billing.ts`, `firm-lock-status.ts` | REFACTOR | Client sees "Your professional has paused this workspace" and a contact action. Firm dunning and the renew-for-the-firm link are not shown to clients. Needs the owner's decision (§11, D4). |
| Home quick actions "Pay bill", "Transfer" | REMOVE AFTER APPROVAL | Two buttons with no function |
| `companies.tsx` | REFACTOR | Becomes the provider and company switcher |
| `(tabs)/ai-advisor` Ask-AI half | DISABLE | Behind a per-firm flag, off by default, until client-facing AI is governed (§5.6) |
| `(tabs)/ai-advisor` "Queries" half, `accountant-chat` | KEEP | Becomes the Messages tab |
| `README.md` template | REFACTOR | Real README |
| Old icon, splash, wordmark assets | ARCHIVE | Replaced by brand-kit files; old files kept in git history |

### 3.2 `flowdo/` repository

| Piece | Class | Action |
|---|---|---|
| The repository | ARCHIVE | Keep the folder; add a one-line README note "superseded by Mizan Connect, 2026-11-25" after approval. It has no commits, so there is nothing to archive on GitHub. |
| `docs/db/PHASE1_SQL_SUMMARY.md`, `phase1_isolation_tests.sql` | REUSE | Copy into `balance-beams-ai/docs` so the capture engine's rules and tests live with the code that owns them (backend stream) |
| `apps/mobile`, `apps/web` placeholders | ARCHIVE | Never scaffolded |
| `.env.example` `EXPO_PUBLIC_FLOWDO_ASSISTANT_WA_NUMBER` | ARCHIVE | Not carried over |

### 3.3 Backend (owned by another stream; proposals only)

| Piece | Class | Proposed action |
|---|---|---|
| Capture tables: workspaces, members, channels, messages, documents, jobs, proposals, proposal events, corrections, catalogue, access log | KEEP | They are the capture engine for accountant-managed clients |
| `capture_workspaces.operating_mode = 'self_managed'`, `approval_policy` `owner_final` / `owner_draft`, `acquired_via = 'flowdo_signup'` | DISABLE | A guard that refuses **new** rows or switches into these values. Existing rows and the check constraints stay, so history remains valid. |
| "Flowdo Direct" house firm row, `firms.is_house` | ARCHIVE | Row stays (rows may reference it). Renamed in display only if the owner wants; never deleted. |
| Mode-switch function and its log (`workspace_conversions`) | KEEP | Still the only way a business changes hands; the self-managed direction is refused by the guard |
| Marketplace "Get an accountant" requests, `capture_leads_function` | DISABLE | No new requests. Direct inquiries go to the CRM (`contact_messages` → leads), as the strategy file says. |
| Pricing: `flowdo_self` plan group and plans with `audience = 'self_managed'` | DISABLE | Mark inactive, hide from every price list. Price versions are frozen by design, so nothing is edited. |
| Pricing: `flowdo_managed` group, meters, coupons, agent prices | REFACTOR | Rename the display names to Mizan Connect; the keys stay |
| `capture_subscriptions`, `capture_entitlements` | KEEP | They drive what a managed client may use |
| `usage_events`, `cost_ledger`, `cost_rates`, `cost_fixed`, `fx_rates` | KEEP | The admin stream's cost ledger builds on them |
| Services & Shop catalogue and orders (`service_catalog`, `service_orders`) | REUSE | Source for "Request another service" |
| The four migration files being untracked in git | REFACTOR | Commit them as they were applied, so the repository matches production. This is the one urgent item: today a fresh database built from git would not match live. |
| Any self-managed customers | — | Count first (§1.7). If any exist: individual migration to a professional, written notice, no loss of records. |
| Public pricing pages, self-managed marketing | REMOVE AFTER APPROVAL | Website stream |

---

## 4. Naming

### 4.1 Where the names appear

| Name | Where | Change |
|---|---|---|
| Flowdo | `flowdo/` (folder, README, CLAUDE.md, `.env.example`); the Design canvas title and all 20 artboards; live DB: firm row "Flowdo Direct", plan-group keys `flowdo_self`/`flowdo_managed` and their display names, `acquired_via = 'flowdo_signup'`, comments in two migrations; branch `claude/flowdo-track-b-44e4f7` | Display names → Mizan Connect. Keys, enum values, branch and folder names stay (the strategy file forbids automatic renames of internal identifiers). |
| Mizora | Not found in this repository, in `flowdo/`, or in `balance-beams-ai/supabase`. It appears only in the strategy file and earlier prompts. | Nothing to change in code |
| Flowdo / Mizora / self-managed in documents | `balance-beams-ai` planning documents on other branches (advisory architecture and reuse matrix, academy master plan, Mizan Pro master plan and roadmap) | Owned by those streams; update wording when each document is next revised |
| "Mizan" as the app name | `app.json` `name`; `i18n` `common.appName` (EN "Mizan", AR "ميزان"); permission strings in `app.json` (camera, photos, microphone); `settings.tsx` restart alert; `ai-advisor.tsx` greeting and error; `i18n` "Ask Mizan..."; `capture.tsx` permission text; `legal-content.ts`; header accessibility labels; `STORE_SUBMISSION.md`; `CLAUDE.md` title | App name → "Mizan Connect" (AR "ميزان كونكت", to be confirmed). The master brand stays "Mizan" where the sentence is about the company. |
| `scheme: "mizan"`, `slug: "mizan-client-mobile"`, `com.mizan.client`, EAS project | `app.json` | **No change proposed.** The bundle id is not visible to users and changing it after a store listing exists creates a new app. |

### 4.2 What only the owner can do

1. **Decide the store name.** "Mizan Connect" must be free on both stores. Apple names are unique per storefront and limited to 30 characters; check App Store Connect when creating the app record. Google allows duplicates but rejects impersonation.
2. **Trademark check** for "Mizan Connect" in UAE and KSA, classes 9, 36 and 42 (the brand guide also asks for clearance before public launch).
3. **Confirm the bundle id** `com.mizan.client` stays, or choose another **before** the first store upload. After upload it cannot change.
4. **Apple Developer Program** enrolment as an organisation (needs a D-U-N-S number; USD 99 a year). **Google Play Console** organisation account (USD 25 once; needs identity and organisation verification, and a closed test with 12 testers for 14 days applies only to new personal accounts, not organisations).
5. **Signing:** let EAS manage iOS certificates and the Android upload key; enrol in Play App Signing. The owner signs in; no credential is ever typed by an assistant.
6. **Store listing owner details:** support email, support URL, marketing URL, privacy policy URL (exists: `https://mizan.team/privacy`), a demo account for app review.
7. **Arabic name** spelling.
8. **A vector master of the logo.** The brand kit says the PNGs are approved for controlled digital use and asks for a professional vector redraw before launch. App icons need a 1024 px master; the supplied icon is 1254 px, which is enough for the stores.

---

## 5. The new app

### 5.1 Principle

The client sees **what they bought and what needs them**, never the professional's internal workspaces. A service is a line the client recognises ("Bookkeeping", "VAT", "Payroll", "Odoo setup"). Everything else hangs off a service or off one shared inbox.

### 5.2 Structure

```
Home          what needs you · your services · latest from your professional
Requests      everything waiting on the client, across services
Messages      one thread with the professional (per provider)
More          documents · invoices & payments · agreements · meetings · reports archive ·
              your professional · companies · settings
```

A **service screen** (opened from Home) has the same five parts for every service, each shown only when it has content:

1. Status: one sentence and a stage ("October books: closing, 3 of 5 steps").
2. Needs you: requests and approvals for this service.
3. Latest: the most recent report or dashboard snapshot.
4. Dates: deadlines the professional is handling, and meetings.
5. Agreement and fee: the signed scope, the billing cycle, the last invoice.

### 5.3 The modules and what feeds them

| What the client sees | Exists in the app today | Backend |
|---|---|---|
| Overview (Home) | Home KPIs and counts | `client-dashboard`, `insights` |
| Service status | No | `engagements.service_key` (no client read yet) |
| Requests and tasks | Tasks tab | `approval_requests`, `document_requests`, `client_requests` |
| Reports and dashboards | Reports, report detail, archive | `report_deliveries`; snapshots not yet |
| Documents | Receipts only | `documents` (client read and insert exist), `receipts`, `branded_deliveries` |
| Agreements | No | `engagement_letters`, `engagement_contracts`, `client_proposals` (no client read yet; signing is by public token today) |
| Invoices and payments | Wrong subject (firm's plan) | `invoices` (client read exists), `payment_links` (no client read), `payments-public` |
| Meetings | Calendar rows only | `meetings`, `meeting_participants` (participant read exists), `meetings` function |
| Messages | Inside AI Advisor | `accountant_messages` + realtime |
| Notifications | In-app list | `notifications`; no push |
| Their professional | No | `firms`, `firm_themes`, profile media |

### 5.4 Progressive disclosure

- **One service:** Home shows the service itself, opened flat (no card to tap). Tabs: Home, Requests, Messages. More is a profile button in the header.
- **Two to four services:** Home shows service cards. Four tabs.
- **Five or more, or more than one company or provider:** a switcher in the header; services group by company.
- A module with nothing in it does not appear. Invoices appears with the first invoice; Meetings with the first meeting; Agreements with the first agreement.
- Requests is always present: an empty Requests screen ("Nothing needs you") is the app's most reassuring state.

### 5.5 What each tab replaces

| Today | Mizan Connect |
|---|---|
| Home | Home (reordered: needs-you first, then services, then figures) |
| Activity | Folded into each service's "Latest" and into Notifications |
| AI Advisor | Messages (the accountant chat half) |
| Reports | Inside each service, plus an archive under More |
| Tasks | Requests |
| Documents (hidden) | Documents under More, with receipts as one section |
| More (hidden) | More |

No new screen is created where an existing one can be reshaped. Net count goes from 27 route files to about 24.

### 5.6 Client-facing AI

Off by default. When a professional turns it on for a client (a firm-level setting, with the owner's governance rules), it appears inside Messages as "Ask about your numbers", clearly labelled as an assistant, answering only from the client's published reports, and with a visible "Ask [professional's name] instead". It never appears as a tab and never on the home screen.

---

## 6. How it connects to Mizan Pro

### 6.1 The five flows

| Flow | Professional does (Mizan Pro) | Client gets (Mizan Connect) | Exists | Missing |
|---|---|---|---|---|
| **Dashboard snapshot → report** | Presents a dashboard, taps "Snapshot to report" | A report with the frozen figures and their as-of date, under the service | `report_deliveries` (client read, published only), `report-publish`, report detail screen | `workspace_dashboards` is a draft in `supabase/pending/`. A snapshot needs a defined payload: widget id, label, value in minor units, currency, as-of date. Proposal: store it as a `report_deliveries` row with `kind = 'snapshot'` and a versioned JSON payload, so the app's existing reader can render it. Internal items (fees, commissions, notes) must be stripped on the server, as the master plan §1.3 requires. |
| **Document request** | Requests a document with a due date | A request card; upload from camera or files; status until accepted | `document_requests` (client read), `documents` (client insert/read), Tasks screen | Client cannot mark a request fulfilled or attach the upload to it. Needs a server action "fulfil request" that links the document and sets the status, so the client never updates the request row directly. |
| **Meeting request** | Schedules a meeting with the client | Invitation with accept/decline, consent prompt where required, a join action, reminders | `meetings`, `meeting_participants`, participant read policy, consent RPC, `calendar_events` link, `meetings` function | A client-initiated "ask for a meeting" (could reuse `client_requests` with a kind). Join opens the meeting room in the browser first; a native room is a later decision. Push reminders. |
| **Payment link** | Issues an invoice or a pay link | Invoice in the list; "Pay" opens the hosted pay page in an in-app browser tab; receipt afterwards | `invoices` client read, `payment_links`, `payments-public`, hosted `/pay/<token>` | No client read on `payment_links`. Proposal: an RPC `get_my_payment_links()` that returns only the caller's client's active links with safe display fields. **No payment is taken inside the app** (see §8.8). |
| **Messages** | Writes, attaches, sends a voice note | Realtime thread, attachments, voice notes with transcript | `accountant_messages`, realtime, `chat-attachments`, `transcribe-audio` | Read receipts and an unread count on the tab; push for new messages |

### 6.2 Other missing pieces (described, not drafted)

Nothing is written to `supabase/pending/` by this stream. The pieces below touch RLS on tables other streams are changing, and one writer owns migrations.

1. **My services.** `engagements` has firm and HQ policies only. Needed: `get_my_services()` returning, for the caller's client, `service_key`, display name (EN/AR, from the `service_lines` draft), status, started date, and nothing about fees unless the agreement says the client may see them.
2. **My agreements.** Client read path for the client's own signed `engagement_letters` / `engagement_contracts` and accepted `client_proposals`: title, signed date, a short-lived signed URL to the PDF. Read-only.
3. **Push tokens.** A table for device tokens (user, platform, token, locale, last seen) with self-only RLS, and a sender in `notifications-dispatch`. Needs `expo-notifications` in the app (dependency approval) and an APNs key and FCM credentials from the owner.
4. **Branding mode.** `firm_themes.theme` is free JSON (`brandName`, `logoUrl`, `primary`, `accent`). Needed: a `mode` (`mizan_managed` or `co_branded`), a validated shape, an approved flag, and a version for cache invalidation. The `firm-theme` function's public read takes any `firmId` from the caller; for the app it should resolve the firm from the session instead ("do not trust client-supplied tenant identifiers").
5. **More than one company or provider per login.** `user_roles.client_id` and `user_client()` resolve one client. A provider or company switch needs either several `client_user` rows with an "active client" claim, or the capture engine's `capture_members` (one login, several businesses), which is already live. The backend stream should choose one; the app only needs "list my contexts" and "switch".
6. **Account deletion request.** `dsr_requests` exists; the app needs a client-facing entry that files one (Apple requirement).
7. **Suspension reason.** A client-safe reason on `clients` status so the app can say "paused by your professional" without reading firm billing.

### 6.3 Edge-function budget

`origin/main` has 96 functions against a limit the master plan gives as 98. This stream adds **no** new function. Every new client action goes into an existing function (`client-dashboard`, `client-accept`, `meetings`, `payments-public`) or an RPC.

---

## 7. Branding engine in the app (modes 1 and 2)

### 7.1 What the app reads

One call after sign-in and on each context switch: brand for the active provider. Cached on the device with its version; refreshed in the background.

```
mode            mizan_managed | co_branded
businessName    "Al Noor Advisory"            (mode 2)
logoUrl         signed, validated image       (mode 2)
primary         hex                           (mode 2, checked for contrast)
accent          hex                           (mode 2)
contact         name, title, phone, email, working hours
welcome         short message, EN and AR
version         integer
```

### 7.2 Where it applies

| Surface | Mode 1 — Mizan managed | Mode 2 — co-branded |
|---|---|---|
| App icon, store listing, splash, app name | Mizan Connect | Mizan Connect (cannot vary per professional) |
| Header mark | Mizan Z mark | Professional's logo |
| Primary and accent colours | Forest Green, Muted Gold | Professional's two colours, clamped to pass 4.5:1 on both themes; fall back to Mizan if they fail |
| Home line | "Your Mizan professional: Hessa" | "Al Noor Advisory · powered by Mizan" |
| Professional card, Messages header | Name, title, photo | Name, title, photo, firm name |
| Reports and PDFs | Mizan template | Professional's template (`branded_deliveries`) with "Powered by Mizan" |
| Invitation and welcome screen | Mizan | Professional's welcome, Mizan attribution |
| Push notification title | "Mizan Connect" | "Mizan Connect" (system-controlled); the body names the professional |
| Legal: invoice issuer, contracting party, payment beneficiary | From the commercial model, never from the theme | Same. The theme changes colours and logos only. |

"Powered by Mizan" is always present in mode 2 and uses the supplied Mizan mark unmodified.

### 7.3 In code

- `ThemeProvider.setBrand` already rebuilds both palettes from four tokens. It is never called. Phase 2 wires it to the brand call and adds the contrast clamp.
- The 57 hard-coded colours move to tokens first, or co-branding will leave navy and mint patches behind.
- The Mizan tokens change from navy/mint (`#001E40`, `#6BFE9C`) to the brand kit: Forest Green `#153F35`, Muted Gold `#B69A68`, Deep Black `#111816`, Warm Ivory `#F5F3EE`, Soft Sage `#DCE5DC`.
- Fonts: the kit recommends Manrope for English headings, Inter for text, IBM Plex Sans Arabic for Arabic. Inter and Plex Arabic are installed; Manrope would be one new font package (needs approval) or headings stay in Inter.
- Mode 3 (white label) is out of scope.

---

## 8. Native quality

### 8.1 Navigation

- Expo Router native tabs or the current JS tabs: keep the JS tab bar (it is custom and already built), but move every detail screen to **native stack** headers with large titles on iOS and Material top bars on Android, instead of the hand-built `DetailHeader`. This gives the system back-swipe, the back-button long-press menu and correct right-to-left behaviour for free.
- Presentation rules: detail = push; a task the client completes (upload, approve, pay, accept a meeting) = sheet with detents; capture = full-screen modal.
- Deep links: `mizan://` scheme exists; add universal links for invites, pay links, meeting invites and report links so a push or an email opens the right screen.
- Turn Android predictive back on once the modals are sheets.

### 8.2 Gestures

- Edge swipe back everywhere (native stack).
- Swipe actions on request rows only where the action is safe to undo (mark read). Approvals are never a swipe.
- Pull to refresh on every list.
- Sheets drag to dismiss; a sheet with unsent input asks before closing.

### 8.3 Transitions (the "smoother than today" part)

- **Service card → service screen:** shared-element transition on the card's title and status ring; the card's surface grows into the screen background. 320 ms, ease-out.
- **Report row → report:** shared title and headline figure.
- **Tab change:** content cross-fades (120 ms) while the indicator slides; no horizontal slide between tabs.
- **Request completed:** the row collapses with a layout animation and the Requests badge counts down; one success haptic.
- **Figures:** numbers do not count up. A changed figure fades between values (tabular numerals keep the width).
- **Skeletons** match the final layout so nothing jumps when data arrives.
- All of it respects Reduce Motion (the hook exists): shared elements become cross-fades, layout animations become instant.
- Reanimated 4 shared-element transitions are still marked experimental with the native stack. If they misbehave on Android, the fallback is a zoom transition on iOS 18+ and a container-transform-like fade-through on Android. This is checked on devices in Phase 3 before it is promised.

### 8.4 Lists

- Every list moves to a virtualised list. `FlatList` needs no new dependency; FlashList is faster for long mixed lists (chat, documents) and would be one approved dependency.
- Stable keys, fixed row heights where possible, `getItemLayout` for the chat.
- Paginate reports, documents, notifications and messages (the queries today use `limit(50)` with no paging).
- Images through `expo-image` with a memory and disk cache and blurred placeholders for receipts.

### 8.5 Haptics

`expo-haptics` is installed and used for tab presses. Add: selection on segmented controls, success on approve / upload / payment return, warning on destructive confirm. Nothing on scroll, nothing on navigation.

### 8.6 Offline

- Persist the query cache (TanStack Query persister on device storage; one small dependency) so Home, Requests, the last reports and the message thread open with the last known data and an "as of" time.
- Queue uploads: a receipt or document captured offline is stored locally and sent when the connection returns, with a visible "Waiting to send" state. Money actions (approve, pay) are never queued; they need a connection and say so.
- One connection banner, not a spinner per card.

### 8.7 Accessibility (WCAG 2.2 AA)

- Labels, roles and states on every control; today several pressable `Text` elements carry `onPress` and are not buttons for a screen reader.
- Dynamic type to 200% without clipping; test Home and Requests at the largest size.
- Contrast: Muted Gold on Warm Ivory fails for text (about 2.5:1). Gold is used for lines, marks and large numerals only; text on ivory is Forest Green or Deep Black.
- Touch targets 44 pt / 48 dp minimum.
- Status is never colour alone: every chip has a word, and an icon where it helps.
- Focus order follows reading order in both directions.

### 8.8 Payments and the stores

Clients pay a professional for real-world services. Both stores allow this outside in-app purchase, and it must **not** use in-app purchase. The app opens the hosted pay page in the system browser tab (`expo-web-browser`, already used) and returns by deep link. No card field is rendered in the app, which also keeps the app out of PCI scope. The app sells no digital subscription, so there is no in-app purchase at all.

### 8.9 Arabic and right-to-left

- All strings move to `en.json` / `ar.json`; the parity check in CI already exists.
- Layout uses start/end, never left/right; icons that imply direction (chevrons, back, send) flip; charts keep left-to-right time axes with Arabic labels (confirm with the owner).
- Numerals: Western digits with Arabic text by default (matches UAE and KSA banking apps); currency as "د.إ" / "ر.س" after the amount in Arabic.
- Dates in Gregorian with Arabic month names; Hijri is a later option.
- Language switches without a restart where the platform allows; a direction change still needs one reload, done automatically with a clear message.
- IBM Plex Sans Arabic at matched optical size (Arabic text set about 6% larger with more line height).

### 8.10 Security carried over

No secret in the bundle (two public values only), SecureStore session, step-up code for approvals, tenant isolation by RLS with a cross-tenant denial test added to CI, money as integer minor units end to end (`billing.ts` multiplies a decimal by 100 today; that reader goes away with the screen).

---

## 9. Phases

Each phase is one or two small pull requests, each with a design approved first.

| Phase | Scope | Done looks like |
|---|---|---|
| **0 — Approvals** | Owner picks a design direction, answers §11 | Decisions recorded in this file |
| **1 — Foundation, no visible redesign** | Tokens to the brand kit; remove hard-coded colours; all strings translated; lists virtualised; theme and language persisted; native stack headers; README | Typecheck, lint, i18n parity green. Every screen works in dark, in Arabic, at 200% text. Scrolling 500 rows stays at 60 fps on a mid-range Android phone. No new dependency unless approved. |
| **2 — Name, logo, branding modes 1 and 2** | App name strings, supplied icon and splash (config change approved separately), brand call wired to `setBrand`, contrast clamp, "powered by Mizan" | A test firm with a logo and two colours re-themes the app on sign-in; a firm with unreadable colours falls back to Mizan; legal screens unchanged by theme |
| **3 — New shell** | Four tabs, Home by service, Requests, Messages split out of AI Advisor, More; shared-element and layout transitions; haptics | A client with one service sees three tabs and a flat Home; with three services sees cards. Transitions verified on one iPhone and one Android device with Reduce Motion on and off. |
| **4 — Service spine** | Service screen; services from the backend; reports and snapshots under a service | Needs §6.2 item 1 and the snapshot payload from the backend stream. A snapshot presented in Mizan Pro appears in the app with the same figures and date. |
| **5 — Documents and requests** | Document vault, upload to a request, offline upload queue | A request is fulfilled from the camera with no connection and syncs later; the professional sees it against the request |
| **6 — Invoices, payments, agreements** | Client invoices, pay link in a browser tab with return, agreements list and PDF | A test invoice is paid through the hosted page and shows Paid in the app without a manual refresh |
| **7 — Meetings and push** | Invitations, accept/decline, consent, join in browser; push for messages, requests, reports, meetings | Needs push credentials from the owner. A message sent from Mizan Pro arrives as a push that opens the thread. |
| **8 — Self-managed switch-off in the app** | Invite-only onboarding with the inquiry path; suspension copy; AI behind the flag | No route in the app creates a business or asks a client to pay Mizan |
| **9 — Store release** | Screenshots, listings in EN and AR, data-safety forms, account deletion, review demo account, TestFlight and closed testing, then production | Both stores approve. Each build and each submission is started only on the owner's word. |

Phases 1–3 need nothing from the backend and can start as soon as a direction is chosen. Phases 4–7 each wait for one named backend piece.

---

## 10. Apps worth studying

Study the pattern, not the pixels. None of their assets, layouts or copy is to be reproduced.

| App | Study it for | What exactly to learn |
|---|---|---|
| **Mercury** (business banking) | Calm, premium money UI | One headline figure per screen; quiet secondary figures; long lists that stay readable; empty states written as a sentence with one action |
| **Wise** | Status and trust | A transfer's timeline with plain-language steps and times; this is the model for a service's status and for "your VAT return: filed" |
| **Revolut Business / Qonto** | Requests and approvals | Approve/decline sheets with the amount large, the context small, and a second confirmation only for money; badge counts that mean something |
| **Monzo** | Friendly density and motion | Feed rows that expand in place; list-to-detail transitions where the row becomes the header; haptics used sparingly |
| **Linear (mobile)** | Speed | Optimistic updates, instant navigation, a keyboard-first inbox; nothing waits for the network before the UI responds |
| **Things 3** | Layout transitions | The card that grows into a screen and collapses back along the same path; the reference for service card → service screen |
| **Apple Wallet and Apple Fitness** | Native feel | Large titles that collapse on scroll, sheets with detents, shared-element zoom; what "native" means on iOS |
| **Airbnb** | Messages plus tasks | One thread with the host where requests, documents and payments appear as cards in the conversation; trip → details hierarchy maps to service → details |
| **Notion Calendar (Cron)** | Meetings | Join button on the event, time-zone clarity, compact day view |
| **STC Pay / Al Rajhi / Tabby** | Arabic-first products | True right-to-left layouts, Arabic type sizes and line heights, numerals and currency placement, bilingual switching |
| **Careem** | Bilingual super-app | How one app serves several services with one home and progressive disclosure, in Arabic and English |
| **Copilot Money** | Charts on a phone | Touch scrubbing on a chart, a few colours, labels on the chart instead of a legend |

Four principles to take from them:

1. **Navigation:** few tabs, deep stacks, one inbox. Nothing is more than two taps from Home.
2. **Motion:** the thing you tapped is the thing that moves. 200–350 ms, ease-out, interruptible.
3. **Density:** one large figure, then a short list. Space is spent on the line the client must act on.
4. **Empty states:** say what will appear here and who will put it there ("Hessa will post your October report here").

---

## 11. Decisions needed from the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Design direction A, B or C (artifact) | **Decided 2026-11-25 by the owner: B (Horizon) for Home, the service screen and the app shell, with A's (Briefing) Requests screen.** |
| D2 | Store name "Mizan Connect" and Arabic spelling | Check availability and trademark first (§4.2) |
| D3 | Keep bundle id `com.mizan.client` | Keep |
| D4 | What a client sees when the professional's Mizan account is overdue | "Paused by your professional" with contact; never ask the client to pay Mizan |
| D5 | Open sign-up on the welcome screen | Invite only, plus "I don't have a professional" → CRM inquiry |
| D6 | Client-facing AI | Off by default; per-firm switch after governance rules exist |
| D7 | Sign-in by email code (today) or phone | Stay with email for now |
| D8 | New dependencies: FlashList, query-cache persister, `expo-notifications`, Manrope font | Approve the first three; Manrope optional |
| D9 | iPad support | Phone only for the first release (`supportsTablet: false`) |
| D10 | Numerals and dates in Arabic | Western digits, Gregorian dates |
| D11 | Who commits the four untracked capture/pricing migrations in `balance-beams-ai` | Backend stream, now |
| D12 | Vector logo master and final icon | Commission before the store release |

## 12. What to build first after approval

Phase 1, as three small pull requests, none of which changes how the app looks to a client beyond the colours:

1. **Tokens:** brand-kit palette in `src/theme`, remove the 57 hard-coded colours, persist theme mode.
2. **Language:** move every string to i18n, right-to-left pass on all screens, language switch without a manual restart.
3. **Lists and headers:** virtualised lists with paging, native stack headers, pull to refresh.

These three make every later phase cheaper and are safe to ship on their own.
