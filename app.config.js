// app.json stays the source of truth for everything static. This file exists for
// one reason: google-services.json cannot live in this repository.
//
// Android push goes Expo push service -> FCM, and FCM will not issue this app a
// token unless google-services.json is compiled into the build. The file was
// never wired up, so Android builds through 2026-11-06 could not register a push
// token at all -- not flaky delivery, no delivery. On an app whose promise is
// "never miss an opener", that is the whole product missing.
//
// The file itself is not a credential in Google's sense (it ships inside every
// APK and anyone can extract it), but this repo is public and has leaked a key
// before, so it does not go in. EAS holds it as a file-type environment variable
// and mounts it at build time; GOOGLE_SERVICES_JSON is the path EAS provides.
//
// Locally, `npx expo run:android` will not have that variable. It falls back to
// the path below so a developer with the file beside the project can still build;
// without it, Expo simply omits the key and the Android build has no push.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ??
      config.android?.googleServicesFile ??
      './google-services.json',
  },
});
