// Dynamic config on top of app.json. Its only job: inject google-services.json
// (Firebase/FCM) from the GOOGLE_SERVICES_JSON file env var on EAS build
// machines — the file itself stays out of this public repo.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
});
