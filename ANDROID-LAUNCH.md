# Open Season — Android (Google Play) launch, step by step

You've shipped iOS. Android is similar but has a few things iOS doesn't. **Read
these two heads-ups first — they change your timeline and what you need.**

> ### ⚠️ Heads-up 1 — The 14-day closed-test gate (personal accounts)
> Google requires **new personal developer accounts** to run a **closed test with
> a minimum number of testers (currently ~12; the Console shows the exact number)
> who stay opted-in for 14 continuous days** *before* you're allowed to push to
> production. So a personal-account launch is **~2+ weeks minimum**, and you need
> real people with Android phones to join the test. (Registering as an
> "Organization" instead can waive this, but needs a business identity.)
>
> ### ⚠️ Heads-up 2 — You need an Android device (or emulator) + a push key
> - To test the app you need **an Android phone or an emulator** — your iPhone
>   can't run it. (Android Studio's emulator is free; see Phase 4.)
> - Android push notifications need a **Firebase/FCM key** you set up once
>   (Phase 2). iOS did this automatically; Android does not.

Everything below is run from **PowerShell in the project folder**, or in a web
console where noted. Do these **after** iOS v1.0 is approved.

---

## Phase 0 — What you'll end up with
- A Google Play Developer account
- A Firebase project (just for the Android push key)
- An Android **preview APK** you install on a phone to test
- A **production AAB** uploaded to Play, through internal → closed → production

---

## Phase 1 — Create the two accounts

### 1a. Google Play Developer account ($25, one-time)
1. Go to **https://play.google.com/console** and sign in with the Google account
   you want to own the app (use one you'll keep — this is permanent).
2. Choose account type: **Personal** (fastest) or **Organization** (waives the
   14-day gate but needs a business/D-U-N-S identity). Pick Personal unless you
   have a business entity.
3. Pay the **$25** one-time fee.
4. Complete **identity verification** (Google will ask for name, address, and a
   photo ID). This can take a few hours to a couple days — **start it early.**

### 1b. Firebase project (for the push key only)
1. Go to **https://console.firebase.google.com** → **Add project**.
2. Name it `Open Season` (or anything). You can **disable Google Analytics** —
   not needed.
3. Once created, click the **Android icon** ("Add app") and register:
   - **Android package name:** `com.openseason.app`  ← must match exactly
   - Nickname/App: `Open Season` (optional). Skip the SHA-1 for now.
4. **Download `google-services.json`** when prompted. Save it into the project
   root: `C:\Users\david\OneDrive\Desktop\GirHub Claude\google-services.json`
5. Skip the "add the SDK" code steps — Expo handles that. Click through / Continue
   to console.

---

## Phase 2 — Android push credentials (FCM)

You need TWO things from Firebase: the `google-services.json` (Phase 1b, goes in
the app) and a **service-account key** (lets Expo's push service send to Android).

### 2a. Point the app at google-services.json
Add one line to `app.json` under the `"android"` block (I've left the spot for
you — put it right after `"versionCode": 1,`):
```json
"android": {
  "package": "com.openseason.app",
  "versionCode": 1,
  "googleServicesFile": "./google-services.json",
  "adaptiveIcon": { ... }
}
```

### 2b. Get the FCM service-account key
1. Firebase Console → your project → **⚙️ (gear) → Project settings**.
2. Tab: **Service accounts** → **Generate new private key** → confirm.
   A `.json` file downloads. Save it somewhere safe **outside** the repo (it's a
   secret — do NOT commit it), e.g. `C:\Users\david\keys\os-fcm.json`.

### 2c. Upload the key to Expo
```powershell
npx eas-cli credentials
```
- Choose **Android** → the **production** build profile.
- Choose **"Google Service Account"** → **"Manage your Google Service Account Key
  for Push Notifications (FCM V1)"** → **Upload** → point it at `os-fcm.json`.
- Done. Expo can now deliver Android notifications.

> Both files are **gitignored-worthy secrets except google-services.json** (that
> one is safe to commit, but you don't have to). Never commit the service-account
> key.

---

## Phase 3 — One-time config (mostly already done)

### 3a. Google Sign-In redirect (Supabase)
Google sign-in on Android uses the same browser flow as iOS, so if **Google
sign-in already works on your iPhone build, this is already set.** To confirm:
1. Supabase dashboard → **Authentication → URL Configuration**.
2. Under **Redirect URLs**, make sure `openseason://auth-callback` (or
   `openseason://**`) is listed. Add it if missing → Save.

### 3b. Push the v1.1 database migration
The current code includes the v1.1 features, which need the DB migration. It's
**additive and safe for the live iOS app** (adds columns/tables, breaks nothing):
```powershell
npx supabase db push
```
*(Only needed once, whenever you cut the first build off the current code.)*

---

## Phase 4 — Build a test APK and try it on a phone

### 4a. (If you don't have an Android phone) set up an emulator
1. Install **Android Studio** (free): https://developer.android.com/studio
2. Open it → **More Actions → Virtual Device Manager → Create Device** → pick a
   Pixel → download a system image (e.g. latest) → Finish → press ▶ to boot it.

### 4b. Build the APK
```powershell
npx eas-cli build --platform android --profile preview
```
- First run asks a few setup questions (accept defaults; it generates an Android
  **keystore** for you and stores it — say **yes**, let EAS manage it).
- ~10–20 min. It prints a build URL with a downloadable **`.apk`**.

### 4c. Install & test
- **Physical phone:** open the build URL on the phone, download the APK, tap to
  install (allow "install from unknown sources" if asked).
- **Emulator/attached phone:** `npx eas-cli build:run -p android` installs the
  latest build directly.
- Test: sign in (Email + Google), pick states/species, check the Home/Seasons/
  Tags screens, add-to-calendar, and (on a real phone) that a notification can
  arrive.

---

## Phase 5 — Create the app + listing in Play Console

1. Play Console → **Create app**.
   - App name: **Open Season: Dates & Draws**
   - Default language: English (US); App or game: **App**; Free.
   - Accept the declarations.
2. Left menu → **Grow → Store presence → Main store listing.** Paste from
   **`play-store/LISTING.md`**:
   - Short + full description (copy blocks provided)
   - **Feature graphic:** upload `play-store/feature.png`
   - **Phone screenshots:** upload `play-store/01.png … 05.png`
   - App icon: Play uses the icon from your build automatically.
3. Left menu → **Policy → App content** and complete each card. These are
   **required before you can release**:
   - **Privacy policy:** `https://dgarner925.github.io/OpenSeason-Legal/`
   - **Data safety:** answers are in `play-store/LISTING.md` (email only, no
     location/tracking, in-app account delete).
   - **Content rating:** fill the questionnaire (expect Everyone/Teen).
   - **Target audience, ads (none), government app (no)**, etc.

---

## Phase 6 — Internal testing (fast, just to prove it works)
1. Build the **production** binary (an `.aab`, what Play wants):
   ```powershell
   npx eas-cli build --platform android --profile production
   ```
2. Play Console → **Test and release → Testing → Internal testing → Create new
   release**.
3. **Upload the `.aab`** (download it from the EAS build page, then drag it in).
   *(First time, uploading manually is simpler than automated submit — see the
   appendix if you'd rather automate.)*
4. Add yourself as a tester (create an email list), save, **review, and roll out
   to internal testing.**
5. Open the tester opt-in link on your device, install from Play, confirm it runs.

---

## Phase 7 — Closed testing (the 14-day gate)
*(Personal accounts only — skip if you registered as an Organization.)*
1. Play Console → **Testing → Closed testing → Create track / new release.**
2. Upload the same `.aab` (or promote the internal one).
3. Add **at least the required number of testers** (the page shows the exact count,
   ~12) via an email list. They must **accept the invite and install**.
4. Keep them opted in for **14 continuous days.** Play shows a countdown and a
   **"Apply for production access"** button when you've met the bar.

---

## Phase 8 — Production
1. Complete **"Apply for production access"** (personal accounts) and wait for the
   grant.
2. Play Console → **Production → Create new release** → upload/promote the `.aab`.
3. Set rollout to **100%**, review, and **Send for review.** Google review is
   usually hours-to-days.
4. Approved → it's live on the Play Store. 🎉

---

## Appendix — Automate submissions (optional, later)
To use `npx eas-cli submit -p android` instead of manual upload:
1. Play Console → **Setup → API access** → link a Google Cloud project → **Create
   service account** → in Google Cloud grant it a key (JSON) → back in Play
   Console **grant it release permissions** (Users & permissions).
2. Save the JSON, and either pass it interactively on first `submit`, or add to
   `eas.json` → `submit.production.android.serviceAccountKeyPath`. `track` is
   already set to `internal`.

## Gotchas / notes
- **No home-screen widget on Android** — that's iOS-only tech. Fine to launch
  without; a Glance widget is a future project.
- **Package name is permanent** — `com.openseason.app` can never change once
  published. It's already correct.
- **Version bumps:** edit `expo.version` in `app.json`; production builds
  auto-increment `versionCode`.
- **Keystore:** let EAS manage it. If you ever lose it you can't update the app,
  so don't delete the EAS credentials.
- **Secrets:** never commit the FCM service-account key or the Play service-account
  key. `google-services.json` is safe to commit but optional.
