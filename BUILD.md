# Building & shipping OpenSeason (EAS)

You're on Windows with no Mac — that's fine. **EAS Build compiles both iOS and
Android in Anthropic-free cloud infra; you never need Xcode.** Run everything
below in PowerShell from the project folder.

## One-time setup

```powershell
# 1. Log in to your Expo account (create one free at expo.dev if needed)
npx eas-cli login

# 2. Link this repo to an EAS project. This writes extra.eas.projectId into
#    app.json and sets the owner automatically.
npx eas-cli init
```

That's it for config — `eas.json` (build profiles + your public Supabase env) is
already committed.

## Build for your phone (internal testing)

```powershell
# Android — produces an installable .apk you can sideload or share
npx eas-cli build --platform android --profile preview

# iOS — installable on registered devices (needs an Apple Developer account, $99/yr).
# EAS will prompt to log in to Apple and register your device UDID.
npx eas-cli build --platform ios --profile preview
```

Each command prints a build URL. When it finishes:
- **Android:** download the `.apk` from the link and install it, or run
  `npx eas-cli build:run -p android` to install to a connected device/emulator.
- **iOS:** install via the QR/link on a registered device.

Push notifications, Apple/Google sign-in, and the reticle icon only work on these
real builds — not in the web preview or Expo Go.

## Ship to the stores

```powershell
# Build production binaries
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production

# Submit — TestFlight (iOS) and Play Console internal testing (Android)
npx eas-cli submit --platform ios --profile production
npx eas-cli submit --platform android --profile production
```

`eas submit` walks you through App Store Connect / Play Console credentials the
first time and stores them for later.

## Over-the-air updates (JS-only changes, no rebuild)

```powershell
npx eas-cli update --branch preview  --message "content + bug fixes"   # to test builds
npx eas-cli update --branch production --message "content refresh"      # to store builds
```
Use this to push new season data or UI tweaks instantly. Native changes
(new permissions, SDK bumps, the app icon) still require a full `eas build`.

## Push-notification credentials

- **Android:** EAS provisions FCM automatically on the production build — no action for testing.
- **iOS:** EAS generates the APNs key during the iOS build (accept the prompt). Required for
  the `send-alerts` job to actually reach iPhones.

## Notes

- **Secrets:** `eas.json` contains only the **public** Supabase URL + publishable
  key (safe to ship — RLS protects the data). Never put the `service_role` or
  Anthropic key here; those live as Supabase function secrets.
- **Bundle IDs:** `com.openseason.app` (both platforms) — change in `app.json`
  before your first store submission if you want a different identifier.
- **Version bumps:** edit `expo.version` in `app.json`; production builds
  auto-increment the native build number.
