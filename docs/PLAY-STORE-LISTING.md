# Mizan Connect on Google Play: what to type into each form

Written 2026-11-28 by stream D for the owner, for the first Android release. Copy each block into the Play Console. Anything in **[brackets]** is yours to fill in or confirm. Screen names on Google's site change from time to time; look for the nearest one.

This goes with `OWNER-STORE-GUIDE.md` (accounts) and `STORE-READINESS.md` (what the app does).

---

## 1. Create the app

| Field | Answer |
|---|---|
| App name | Mizan Connect |
| Default language | English (United States) — then add Arabic as a translation |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both (developer programme policies; US export laws) |

## 2. Store listing

### English

**Short description** (80 characters at most):

> Your company's books, your accountant's requests and messages, in one place.

**Full description:**

> Mizan Connect is the app for businesses whose accountant works with Mizan.
>
> See where your company stands today:
> • Money in, money out, profit and cash, from your own books
> • What each figure is made of, month by month
> • VAT due and its date
> • Your invoices to customers, paid and unpaid
>
> Work with your accountant without the back and forth:
> • Approve or decline what your accountant sends you, with a code for anything that matters
> • Send receipts with your camera, documents as PDF, and voice notes
> • Read your monthly reports and download them
> • Get a notification when something needs you
>
> Ask the AI advisor plain questions about your own figures. It answers from your books and never changes them; your accountant decides.
>
> Sign in with a code sent to your email. No password to remember. You can lock the app with your fingerprint or your phone's passcode.
>
> In English and Arabic, in light and dark.
>
> Mizan Connect needs an invitation from your accountant's firm.

### Arabic (العربية)

**وصف قصير:**

> دفاتر شركتك وطلبات محاسبك ورسائله، في مكان واحد.

**الوصف الكامل:**

> ميزان كونكت هو تطبيق الشركات التي يعمل محاسبها مع ميزان.
>
> اعرف وضع شركتك اليوم:
> • الداخل والخارج والربح والنقد، من دفاترك
> • ممّ يتكوّن كل رقم، شهراً بشهر
> • ضريبة القيمة المضافة المستحقة وموعدها
> • فواتيرك لعملائك، المدفوعة وغير المدفوعة
>
> تعامل مع محاسبك من دون ذهاب وإياب:
> • وافق على ما يرسله محاسبك أو ارفضه، برمز لكل أمر مهم
> • أرسل الإيصالات بالكاميرا، والمستندات بصيغة PDF، والرسائل الصوتية
> • اقرأ تقاريرك الشهرية ونزّلها
> • يصلك إشعار عندما يحتاجك أمر ما
>
> اسأل المستشار الذكي أسئلة بسيطة عن أرقامك. يجيب من دفاترك ولا يغيّرها؛ القرار لمحاسبك.
>
> سجّل الدخول برمز يصلك على بريدك الإلكتروني، من دون كلمة مرور. ويمكنك قفل التطبيق ببصمة إصبعك أو رمز هاتفك.
>
> بالعربية والإنجليزية، بالوضع الفاتح والداكن.
>
> يتطلب ميزان كونكت دعوة من مكتب محاسبك.

### Graphics

| Asset | Size | Where it comes from |
|---|---|---|
| App icon | 512 × 512 PNG | The brand kit's `MIZAN_Z_App_Icon_Dark.png`, exported at 512. Used as supplied. |
| Feature graphic | 1024 × 500 | **[To make]** from the brand kit: the dark field with the Z mark. Stream D can lay one out; it must not redraw the logo. |
| Phone screenshots | at least 2, up to 8; 1080 × 1920 or larger | **[To take]** on a real Android phone, signed in to the review account: Home, a figure's detail, Requests, Messages, Reports. Use the review account so no real client's figures show. |

### Category and contact

| Field | Answer |
|---|---|
| Category | Business |
| Tags | Accounting, Finance |
| Email | **[support address, e.g. support@mizan.team]** |
| Website | https://mizan.team |
| Privacy policy | https://mizan.team/privacy **[must cover the app: the lawyer should check it against `docs/legal/PRIVACY-POLICY.md`]** |

## 3. App content (Policy → App content)

### Privacy policy
https://mizan.team/privacy

### App access
Choose **All or some functionality is restricted** and add the review account:

| Field | Answer |
|---|---|
| Name | Store review |
| Username | **[the review email, set on the server as `CONNECT_REVIEW_EMAIL`]** |
| Password | **[the six-digit code, set as `CONNECT_REVIEW_CODE`]** |
| Instructions | Enter the email and tap Continue. When asked for the code, type the six digits above instead of a code from an email. The account is a demo company with demo figures. |

The review sign-in works only until `CONNECT_REVIEW_UNTIL` (at most 90 days ahead). Set a new code and date for each review, and update this form.

### Ads
No, the app does not contain ads.

### Content rating
Fill in the questionnaire. Category: **Utility, Productivity, Communication, or Other**. Answer **No** to every question about violence, sexual content, language, drugs, gambling and user-shared content seen by the public. (Messages go only between a client and their own accountant.) Expected rating: Everyone / PEGI 3.

### Target audience
**18 and over** only. Not designed for children.

### News app
No.

### Health apps, government apps
No.

### Financial features
Select **None of the above**, or the nearest "other" option: the app shows a business its own accounting and does not lend, invest, move money or hold funds. Paying an invoice opens the accountant's own payment page in the browser.

### Data safety

**Does the app collect or share any of the required user data types?** Yes.
**Is all collected data encrypted in transit?** Yes.
**Do you provide a way for users to request that their data be deleted?** Yes, in the app and at https://mizan.team/delete-account

| Data type | Collected | Shared | Optional? | Why |
|---|---|---|---|---|
| Personal info → Email address | Yes | No | Required | Account management (sign-in) |
| Personal info → Name | Yes | No | Required | Account management |
| Financial info → Other financial info | Yes | No | Required | App functionality (your company's figures, invoices, receipts) |
| Messages → Other in-app messages | Yes | No | Optional | App functionality (messages with your accountant) |
| Photos and videos → Photos | Yes | **Yes** (AI provider, only after you agree in the app) | Optional | App functionality (receipts; read by AI to fill in the details) |
| Audio → Voice or sound recordings | Yes | **Yes** (AI provider, only after you agree) | Optional | App functionality (voice notes, voice questions turned into text) |
| Files and docs | Yes | No | Optional | App functionality (PDFs sent to your accountant) |
| App activity → Other user-generated content | Yes | **Yes** (AI provider, only after you agree) | Optional | App functionality (questions to the AI advisor) |
| Device or other IDs | Yes | No | Optional | App functionality (to send notifications to this phone) |

Not collected: location, contacts, calendar, health, web history, crash logs, analytics. **[Confirm none of these is added before release.]**

"Shared" here means sent to another company for its own processing. Supabase (hosting) and Expo/Google (delivering notifications) act on Mizan's behalf and are service providers, which Google does not count as sharing. **[The lawyer should confirm the AI provider's role.]**

## 4. Release

1. **Testing → Internal testing → Create new release.** Upload the `.aab` file from the EAS build (stream D gives you the link). Add yourself and your team as testers by email.
2. Install from the test link on an Android phone and go through the checklist in section 5.
3. **Production → Create new release**, promote the same build, write release notes (below), and send for review. If your account is a personal one, Google first asks for a closed test with 12 testers for 14 days.
4. Countries: **[UAE first]**.

**Release notes** (English): `First release of Mizan Connect.`
(Arabic): `الإصدار الأول من ميزان كونكت.`

## 5. Check on a real phone before sending it for review

- [ ] Sign in with a code from email, and with the review account
- [ ] Home figures load; tap each figure
- [ ] A request from the accountant: approve with the code
- [ ] Send a photo, a PDF and a voice note in Messages
- [ ] Open a report and its PDF
- [ ] Settings: turn on the app lock (fingerprint), close the app for a minute, open it
- [ ] Settings: turn on notifications (needs Firebase set up, see `OWNER-STORE-GUIDE.md`); or check it says "not available yet"
- [ ] Arabic: switch language; everything reads right to left
- [ ] Dark mode
- [ ] Delete my account screen opens (do not send it from a real account)
