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
    // `build` must be listed in fields[] or the relationship is not serialised
    // and every version reads as "(none attached)" -- including live ones.
    `/v1/apps/${APP_ID}/appStoreVersions?limit=8&fields[appStoreVersions]=versionString,appStoreState,platform,createdDate,releaseType,build&include=build`,
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

async function patch(path, body) {
  return api(path, { method: 'PATCH', body: JSON.stringify(body) });
}
async function post(path, body) {
  return api(path, { method: 'POST', body: JSON.stringify(body) });
}

/**
 * Create the version record if missing, set its release notes, attach the
 * build, and submit it for review.
 *
 * Prints every step and changes nothing unless --go is passed.
 */
async function submit(versionString, buildNumber, go) {
  const say = (s) => console.log(`  ${go ? '' : '[dry-run] '}${s}`);
  console.log(`\nSubmitting ${versionString} / build ${buildNumber}${go ? '' : '  (DRY RUN)'}`);

  // 1. The build must exist and have cleared Apple's processing.
  const b = await api(
    `/v1/builds?filter[app]=${APP_ID}&filter[version]=${buildNumber}&limit=1` +
      `&fields[builds]=version,processingState`,
  );
  if (!b) return;
  if (!b.data.length) {
    console.error(`  build ${buildNumber} is not in App Store Connect yet`);
    process.exitCode = 1;
    return;
  }
  const build = b.data[0];
  if (build.attributes.processingState !== 'VALID') {
    console.error(
      `  build ${buildNumber} is ${build.attributes.processingState}, not VALID -- ` +
        `Apple is still processing it. Try again shortly.`,
    );
    process.exitCode = 1;
    return;
  }
  say(`build ${buildNumber} is VALID (${build.id})`);

  // 2. Find or create the version record.
  const existing = await api(
    `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${versionString}` +
      `&limit=1&fields[appStoreVersions]=versionString,appStoreState`,
  );
  if (!existing) return;
  let versionId = existing.data.length ? existing.data[0].id : null;
  if (versionId) {
    say(`version ${versionString} exists (${existing.data[0].attributes.appStoreState})`);
  } else {
    say(`create version ${versionString}, releaseType AFTER_APPROVAL`);
    if (go) {
      const made = await post('/v1/appStoreVersions', {
        data: {
          type: 'appStoreVersions',
          attributes: {
            platform: 'IOS',
            versionString,
            releaseType: 'AFTER_APPROVAL',
          },
          relationships: { app: { data: { type: 'apps', id: APP_ID } } },
        },
      });
      if (!made) return;
      versionId = made.data.id;
      say(`created ${versionId}`);
    }
  }
  if (!versionId) {
    say('(cannot continue in dry run without a version record)');
    return;
  }

  // 3. Release notes, from the file in store/ so they are reviewable in git.
  const notes = fs
    .readFileSync(`${__dirname}/../store/whatsnew-${versionString}.txt`, 'utf8')
    .trim();
  const locs = await api(
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations` +
      `?fields[appStoreVersionLocalizations]=locale`,
  );
  if (!locs) return;
  const en = locs.data.find((l) => l.attributes.locale === 'en-US');
  say(`set "What's New" on en-US (${notes.length} chars)`);
  if (go) {
    if (en) {
      const r = await patch(`/v1/appStoreVersionLocalizations/${en.id}`, {
        data: { type: 'appStoreVersionLocalizations', id: en.id, attributes: { whatsNew: notes } },
      });
      if (!r) return;
    } else {
      const r = await post('/v1/appStoreVersionLocalizations', {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale: 'en-US', whatsNew: notes },
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
          },
        },
      });
      if (!r) return;
    }
  }

  // 4. Attach the build.
  say(`attach build ${buildNumber}`);
  if (go) {
    const r = await patch(`/v1/appStoreVersions/${versionId}/relationships/build`, {
      data: { type: 'builds', id: build.id },
    });
    if (r === null && process.exitCode === 1) return;
  }

  // 5. Submit for review. Apple allows one open submission at a time.
  const open = await api(
    `/v1/reviewSubmissions?filter[app]=${APP_ID}` +
      `&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES` +
      `&fields[reviewSubmissions]=state&limit=5`,
  );
  if (open && open.data.length) {
    console.error(
      `  an open review submission already exists (${open.data
        .map((r) => r.attributes.state)
        .join(', ')}) -- resolve or cancel it in App Store Connect first`,
    );
    process.exitCode = 1;
    return;
  }
  say('create review submission, add this version to it, mark it submitted');
  if (go) {
    const rs = await post('/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: 'IOS' },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } },
      },
    });
    if (!rs) return;
    const item = await post('/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: rs.data.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
        },
      },
    });
    if (!item) return;
    const done = await patch(`/v1/reviewSubmissions/${rs.data.id}`, {
      data: { type: 'reviewSubmissions', id: rs.data.id, attributes: { submitted: true } },
    });
    if (!done) return;
    console.log(`\n  SUBMITTED. state: ${done.data.attributes.state}`);
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
  } else if (cmd === 'submit') {
    const version = process.argv[3];
    const build = process.argv[4];
    if (!version || !build) {
      console.error('Usage: node scripts/asc.js submit <version> <buildNumber> [--go]');
      process.exit(2);
    }
    await submit(version, build, process.argv.includes('--go'));
  } else {
    console.error(`Unknown command: ${cmd}`);
    console.error('Commands: state, builds, shots, submit');
    process.exit(2);
  }
  console.log('');
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
