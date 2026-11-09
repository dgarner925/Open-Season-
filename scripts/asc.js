#!/usr/bin/env node
/**
 * App Store Connect API, with no dependencies.
 *
 * The previous version of this lived in a session scratchpad and vanished with
 * it, so it is in the repo this time. It mints its own ES256 JWT using Node's
 * crypto -- `dsaEncoding: 'ieee-p1363'` emits r||s, which is exactly the
 * signature format JOSE wants, so no jwt library is needed.
 *
 * The private key is read straight from disk and never printed. Nothing in
 * here echoes the key, the token, or any header containing them.
 *
 * Usage:
 *   node scripts/asc.js state                 # report only, changes nothing
 *   node scripts/asc.js builds
 *   node scripts/asc.js submit <version> <buildNumber>
 *
 * Env (same vars the EAS build uses):
 *   EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID
 */
const crypto = require('crypto');
const fs = require('fs');

const APP_ID = '6791993537';
const BASE = 'https://api.appstoreconnect.apple.com';

function token() {
  const keyPath = process.env.EXPO_ASC_API_KEY_PATH;
  const kid = process.env.EXPO_ASC_KEY_ID;
  const iss = process.env.EXPO_ASC_ISSUER_ID;
  if (!keyPath || !kid || !iss) {
    console.error('Missing EXPO_ASC_API_KEY_PATH / EXPO_ASC_KEY_ID / EXPO_ASC_ISSUER_ID');
    process.exit(2);
  }
  const key = fs.readFileSync(keyPath, 'utf8'); // never logged
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid, typ: 'JWT' });
  const body = b64({
    iss,
    iat: now,
    exp: now + 15 * 60, // Apple rejects anything over 20 minutes
    aud: 'appstoreconnect-v1',
  });
  const sig = crypto
    .sign('sha256', Buffer.from(`${head}.${body}`), {
      key,
      dsaEncoding: 'ieee-p1363',
    })
    .toString('base64url');
  return `${head}.${body}.${sig}`;
}

const JWT = token();

async function api(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${JWT}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    // Print Apple's own error detail, which never contains the key or token.
    const errs = json && json.errors ? json.errors : [{ title: text.slice(0, 500) }];
    console.error(`\n  HTTP ${res.status} on ${path}`);
    for (const e of errs) {
      console.error(`    ${e.title || ''}${e.detail ? ' -- ' + e.detail : ''}`);
    }
    process.exitCode = 1;
    return null;
  }
  return json;
}

async function state() {
  const v = await api(
    `/v1/apps/${APP_ID}/appStoreVersions?limit=8&fields[appStoreVersions]=versionString,appStoreState,platform,createdDate,releaseType&include=build`,
  );
  if (!v) return;
  console.log('\nApp Store versions (newest first):');
  for (const row of v.data) {
    const a = row.attributes;
    const buildRel = row.relationships && row.relationships.build;
    const buildId = buildRel && buildRel.data ? buildRel.data.id : null;
    const build = buildId && v.included
      ? v.included.find((i) => i.id === buildId && i.type === 'builds')
      : null;
    console.log(
      `  ${a.versionString.padEnd(8)} ${String(a.appStoreState).padEnd(26)} ` +
        `build ${build ? build.attributes.version : '(none attached)'}`,
    );
  }
}

async function builds() {
  const b = await api(
    `/v1/builds?filter[app]=${APP_ID}&limit=6&sort=-version&fields[builds]=version,processingState,uploadedDate,expired`,
  );
  if (!b) return;
  console.log('\nRecent builds:');
  for (const row of b.data) {
    const a = row.attributes;
    console.log(
      `  build ${String(a.version).padEnd(5)} ${String(a.processingState).padEnd(12)} ` +
        `${a.expired ? 'EXPIRED ' : ''}uploaded ${a.uploadedDate}`,
    );
  }
}

/**
 * What the store listing currently shows. Worth knowing before shipping a
 * redesign: screenshots are attached per version, and a new version inherits
 * the previous one's, so a visual overhaul can go live behind pictures of the
 * old app.
 */
async function shots() {
  const v = await api(
    `/v1/apps/${APP_ID}/appStoreVersions?limit=1&fields[appStoreVersions]=versionString,appStoreState`,
  );
  if (!v || !v.data.length) return;
  const ver = v.data[0];
  const locs = await api(
    `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,whatsNew`,
  );
  if (!locs) return;
  console.log(`\nStore listing for ${ver.attributes.versionString} (${ver.attributes.appStoreState}):`);
  for (const l of locs.data) {
    const sets = await api(
      `/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType`,
    );
    const n = sets ? sets.data.length : 0;
    console.log(`  ${l.attributes.locale}: ${n} screenshot set(s)`);
    for (const s of (sets ? sets.data : [])) {
      const imgs = await api(
        `/v1/appScreenshotSets/${s.id}/appScreenshots?fields[appScreenshots]=fileName,assetDeliveryState&limit=10`,
      );
      const names = imgs ? imgs.data.map((i) => i.attributes.fileName) : [];
      console.log(
        `    ${s.attributes.screenshotDisplayType}: ${names.length} image(s)` +
          (names.length ? ` -- e.g. ${names[0]}` : ''),
      );
    }
    const wn = (l.attributes.whatsNew || '').replace(/\s+/g, ' ').trim();
    console.log(`  "What's New" on ${l.attributes.locale}: ${wn ? wn.slice(0, 140) + '...' : '(empty)'}`);
  }
}

async function main() {
  const cmd = process.argv[2] || 'state';
  if (cmd === 'state') {
    await state();
    await builds();
  } else if (cmd === 'builds') {
    await builds();
  } else if (cmd === 'shots') {
    await shots();
  } else {
    console.error(`Unknown command: ${cmd}`);
    console.error('Commands: state, builds');
    process.exit(2);
  }
  console.log('');
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
