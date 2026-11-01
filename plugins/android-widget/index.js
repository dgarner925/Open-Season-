const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

/**
 * Adds the Legal Light home-screen widget to the Android project.
 *
 * The iOS widget comes from @bacons/apple-targets (targets/widget); Android has
 * no equivalent plugin, so this copies a hand-written AppWidgetProvider and its
 * resources into the prebuilt project and registers the receiver. Everything it
 * writes lives in this folder, so the generated android/ directory stays
 * disposable — nothing here is edited in place after a prebuild.
 */

const SRC = __dirname;
const RECEIVER = '.LegalLightWidget';

/** Copy a file, making its parent directories. */
function place(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function withWidgetFiles(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error('android-widget: expo.android.package is not set');

      const root = cfg.modRequest.platformProjectRoot;
      const main = path.join(root, 'app', 'src', 'main');

      // The provider, with its package line and broadcast action filled in.
      const kotlin = fs
        .readFileSync(path.join(SRC, 'LegalLightWidget.kt'), 'utf8')
        .replace(/__PACKAGE__/g, pkg);
      const javaDir = path.join(main, 'java', ...pkg.split('.'));
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(path.join(javaDir, 'LegalLightWidget.kt'), kotlin, 'utf8');

      for (const rel of [
        ['layout', 'legal_light_widget.xml'],
        ['drawable', 'widget_bg.xml'],
        ['xml', 'legal_light_widget_info.xml'],
        ['values', 'legal_light_widget_strings.xml'],
      ]) {
        place(path.join(SRC, 'res', ...rel), path.join(main, 'res', ...rel));
      }

      return cfg;
    },
  ]);
}

function withWidgetReceiver(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) throw new Error('android-widget: no <application> in the manifest');

    app.receiver = (app.receiver ?? []).filter(
      (r) => r.$?.['android:name'] !== RECEIVER,
    );
    app.receiver.push({
      $: {
        'android:name': RECEIVER,
        // The system targets the component directly and our own tick broadcast
        // is explicit, so nothing outside the app needs to reach this.
        'android:exported': 'false',
      },
      'intent-filter': [
        { action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/legal_light_widget_info',
          },
        },
      ],
    });

    return cfg;
  });
}

module.exports = function withAndroidWidget(config) {
  return withWidgetReceiver(withWidgetFiles(config));
};
