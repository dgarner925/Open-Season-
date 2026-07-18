module.exports = (config) => ({
  type: "widget",
  displayName: "OpenSeason",
  // Slate + Ember, matching the app theme.
  colors: {
    $accent: "#E0794A",
    $widgetBackground: "#0D0D14",
  },
  // Share the App Group with the main app so the widget can read the next event.
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
