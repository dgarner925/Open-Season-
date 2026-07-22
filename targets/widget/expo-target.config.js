module.exports = (config) => ({
  type: "widget",
  displayName: "Open Season",
  // Ember — warm charcoal + copper, matching the app theme.
  colors: {
    $accent: "#d99e7f",
    $widgetBackground: "#100e0c",
  },
  // Share the App Group with the main app so the widget can read the next event.
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
