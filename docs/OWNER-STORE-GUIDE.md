# Mizan Connect: what only you can do, step by step

Written 2026-11-25 for the owner. It goes with `STORE-READINESS.md`. Everything here needs your identity, your signature, your money or your decision, so stream D cannot do it for you. Stream D never types a password, a verification code or a payment detail.

Screen and button names on Apple's and Google's sites change from time to time. If a name here does not match, look for the nearest one.

## Part 1. Accounts, once

### 1.1 A D-U-N-S number for the company (free)

Both stores ask for it when the account belongs to a company. It is a nine-digit number that identifies the legal entity.

1. Open Apple's D-U-N-S lookup: `https://developer.apple.com/enroll/duns-lookup/`
2. Sign in with your Apple ID.
3. Enter the company's legal name and address exactly as on the trade licence: **MIZAN AI TECHNOLOGIES (FZE)**, Block C-C01-206, Sharjah Research, Technology and Innovation Park, Sharjah, United Arab Emirates.
4. If the company is found, the number is emailed to you. If not, the same page lets you request one, free of charge.
5. Allow up to two weeks. Start this first: everything else waits on it. The company was incorporated on 1 October 2026, so it very likely has no number yet and you will need to request one. Keep the trade licence (number 20383) at hand: you may be asked to upload it.

### 1.2 Apple Developer Program (99 USD a year)

You need: an Apple ID with two-factor authentication switched on; the D-U-N-S number; a company website on the company's own domain; an email address on that domain; and authority to sign for the company.

1. Open `https://developer.apple.com/programs/enroll/`
2. Choose to enrol as a **Company / Organization**, not as an individual. As an individual, your own name is shown as the seller in the App Store.
3. Enter the legal entity name, D-U-N-S number, website and your role.
4. Apple may phone you to confirm you can sign for the company. Answer it.
5. Pay the yearly fee when Apple asks.
6. When it is active, sign in to `https://appstoreconnect.apple.com` once and accept the agreements shown there.

### 1.3 Google Play Console (25 USD, once)

1. Open `https://play.google.com/console/signup`
2. Choose **An organisation**. A personal account must run a closed test with 12 testers for 14 days before it may publish; an organisation account does not.
3. Enter the D-U-N-S number and the company details. Google checks them against the D-U-N-S record.
4. Verify your identity with the documents Google asks for, and verify the contact phone and email.
5. Pay the one-time fee.

### 1.4 Expo, on this PC

The project already belongs to the Expo account `mizan92s-team`.

1. In a terminal in the project folder, run: `npx --yes eas-cli@latest login --browser`
2. A browser opens. Sign in there yourself.
3. Tell stream D it is done. From then on stream D can start builds on your word, without ever seeing a password.

## Part 2. Decisions

| # | Decision | Recommendation | Why |
|---|---|---|---|
| 1 | iPad | Off. Decided 2026-11-25 | The screens are designed for a phone |
| 2 | Name shown under the icon | Mizan Connect | The name you chose |
| 3 | App icon | The brand kit's `MIZAN_Z_App_Icon_Dark.png` | It is square, as the stores require |
| 4 | Splash screen | Dark, matching the intro | Today it is light, then the dark intro: a visible jump |
| 5 | Who may use the app | Adults only (18+) | Business finance; simpler age and privacy forms |
| 6 | Countries | UAE first, then the Gulf | Each country can add legal duties |
| 7 | Price | Free to download | The accountant's firm pays for the service, outside the app |

## Part 3. Things to give us

| What | For |
|---|---|
| A public web address for the privacy policy, and one for the terms | Both stores require them. A page on the company website is enough |
| A support email and a support web page | Shown in both stores |
| A phone number and name for Apple's and Google's reviewers | Asked for in the review form; not shown to the public |
| A test client for the reviewers (see 3.1) | They must be able to sign in |
| The company's legal name and address as you want them shown | Google shows the developer's details |
| Short and long description of the app, English and Arabic | We draft, you approve |

### 3.1 The review account

The app signs in with a code sent by email. A reviewer in California cannot read your client's inbox. Apple rejects an app it cannot sign in to.

The backend needs one demo client company with realistic sample data, and a way for a reviewer to sign in without a real inbox. This is a backend task; it is in the notes for that stream. Your part: agree that a demo client may exist in production, and give it a name.

## Part 4. The lawyer

The policy drafts are written to professional structure, but a draft is not legal advice. Before real clients rely on them, a lawyer who knows UAE data protection law must read them.

Give the lawyer:

1. The two drafts: privacy policy and terms of use.
2. `STORE-READINESS.md`, section 2, so they see what the stores ask for.
3. `docs/legal/PRIVACY-POLICY.md` and `docs/legal/TERMS-OF-USE.md`: every place marked **[TO CONFIRM]** is a question for the lawyer or a fact for you to supply.
4. These questions:
   - Which company is the data controller, and at which address?
   - Is the accountant's firm a controller or a processor of the client's data, and does the client contract say so?
   - Are our transfers of data outside the UAE (hosting, the AI provider) covered as the law requires?
   - How long must accounting records be kept, and how does that limit a request to delete an account?
   - Is the consent wording for the AI advisor enough?
   - Which law and which courts govern the terms?
   - The trade licence lists artificial-intelligence research, training and development services. The app serves clients of accounting firms. Do the licensed activities cover providing this software, and is the wording "Mizan provides software, Mizan is not your accountant" enough?

### 4.1 Free tools found for policies

Searched on GitHub on 2026-11-25. None replaces the lawyer; they make the lawyer's work shorter.

| Tool | Use |
|---|---|
| [anthropics/claude-for-legal](https://github.com/anthropics/claude-for-legal) (10k stars, Apache-2.0) | Legal skills for an AI assistant. Its `privacy-legal` set does a privacy impact assessment and a gap analysis against a regulation. Good for checking the drafts before the lawyer sees them |
| [github/site-policy](https://github.com/github/site-policy) (CC0, free to copy) | GitHub's own published policies. A professional model for wording and structure |
| [basecamp/policies](https://github.com/basecamp/policies) | Plain-language policies from a software company, published for reuse with credit |
| [nisrulz/app-privacy-policy-generator](https://github.com/nisrulz/app-privacy-policy-generator) (5k stars) | A generator for a basic mobile-app policy. Too generic for a finance app; useful only as a checklist |

## Part 5. Creating the app in each store

Do this after Parts 1 and 2. Stream D prepares every answer; you click.

### 5.1 App Store Connect

1. `https://appstoreconnect.apple.com` > Apps > the plus button > New App.
2. Platform: iOS. Name: Mizan Connect. Primary language: English (U.K.).
3. Bundle ID: choose `com.mizan.client`. If it is not in the list, tell stream D: the first build registers it.
4. SKU: any internal code, for example `mizan-connect-ios`.
5. Later, in the app's page: **App Privacy** (we give you the answers), **Age Rating** (a questionnaire), and the review information with the demo account.

### 5.2 Google Play Console

1. `https://play.google.com/console` > Create app.
2. Name: Mizan Connect. Default language: English (United Kingdom). App, not game. Free.
3. Accept the declarations.
4. In **App content**, fill in, with our prepared answers: Privacy policy, App access (the demo sign-in), Ads (none), Content rating, Target audience (18 and over), Data safety, Financial features.

## Part 6. Testers

- **TestFlight (iPhone):** in App Store Connect > Users and Access, add each tester's Apple ID email. They install the TestFlight app and accept the invitation.
- **Google internal testing:** in Play Console > Testing > Internal testing, add the testers' Google account emails and send them the opt-in link.

## Part 7. Submitting

1. Stream D builds and uploads to TestFlight and to Play's internal track, on your word.
2. You and the testers use the app for some days. Problems are fixed.
3. Stream D prepares the store pages. You read and approve them.
4. You press **Submit for Review** (Apple) and **Send for review** (Google). That click is yours.
5. If a store rejects the app, send stream D the full message. It names the rule; we fix that and resubmit.

## What stream D will never do

- Type your password, a verification code, a card number or a bank detail.
- Accept a legal agreement in your name.
- Press the final submit button.
- Publish to the public without your word.
