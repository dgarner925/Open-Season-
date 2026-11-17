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
 *   node scripts/asc.js version <version>             # create the record
 *   node scripts/asc.js upload-shots <version> <dir>   # replaces the 6.5" set
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
      // Print each asset's delivery state, not just its name. An upload that
      // reached Apple but failed processing still has a fileName, so a list of
      // names alone reads as "six screenshots" for a set that will show none.
      const rows = imgs ? imgs.data.map((i) => i.attributes) : [];
      console.log(`    ${s.attributes.screenshotDisplayType}: ${rows.length} image(s)`);
      for (const a of rows) {
        const st = a.assetDeliveryState || {};
        const errs = (st.errors || []).map((e) => e.description || e.code).join('; ');
        console.log(`      ${String(a.fileName).padEnd(10)} ${st.state || '?'}${errs ? ' -- ' + errs : ''}`);
      }
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

  // 3b. Notes to the reviewer, if the release has any. Optional: a version
  // with nothing unusual in it does not need to explain itself. A version that
  // adds user-generated content does -- Guideline 1.2 wants the moderation
  // story stated, not discovered.
  const notesPath = `${__dirname}/../store/review-notes-${versionString}.txt`;
  if (fs.existsSync(notesPath)) {
    const reviewNotes = fs.readFileSync(notesPath, 'utf8').trim();
    say(`set App Review notes (${reviewNotes.length} chars)`);
    if (go) {
      const detail = await api(
        `/v1/appStoreVersions/${versionId}/appStoreReviewDetail?fields[appStoreReviewDetails]=notes`,
      );
      // A version created moments ago has no review detail yet, and Apple
      // answers 404 rather than an empty document.
      if (detail && detail.data && detail.data.id) {
        const r = await patch(`/v1/appStoreReviewDetails/${detail.data.id}`, {
          data: {
            type: 'appStoreReviewDetails',
            id: detail.data.id,
            attributes: { notes: reviewNotes },
          },
        });
        if (!r) return;
      } else {
        process.exitCode = 0; // the 404 above is expected, not a failure
        const r = await post('/v1/appStoreReviewDetails', {
          data: {
            type: 'appStoreReviewDetails',
            attributes: { notes: reviewNotes },
            relationships: {
              appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } },
            },
          },
        });
        if (!r) return;
      }
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

/**
 * Pull the open review submission back out of Apple's queue.
 *
 * Apple allows exactly one open submission per app, so a newer version cannot
 * be submitted while an older one is waiting. Cancelling is a one-way door for
 * that submission's place in the queue -- the version record survives and can
 * be resubmitted, but it goes to the back of the line -- so this prints what it
 * would cancel and does nothing without --go.
 */
async function withdraw(go) {
  const open = await api(
    `/v1/reviewSubmissions?filter[app]=${APP_ID}` +
      `&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES` +
      `&fields[reviewSubmissions]=state,submittedDate&include=items&limit=5`,
  );
  if (!open) return false;
  if (!open.data.length) {
    console.log('\n  nothing is open in review; nothing to withdraw');
    return true;
  }
  for (const rs of open.data) {
    console.log(
      `\n${go ? '' : '[dry-run] '}cancel review submission ${rs.id} (${rs.attributes.state})`,
    );
    if (!go) continue;
    // `canceled` is the documented way out: DELETE is refused once a
    // submission has been submitted.
    const done = await patch(`/v1/reviewSubmissions/${rs.id}`, {
      data: { type: 'reviewSubmissions', id: rs.id, attributes: { canceled: true } },
    });
    if (!done) return false;
    console.log(`  cancelled. state: ${done.data.attributes.state}`);
  }
  return true;
}


/**
 * Replace the 6.5" screenshot set on a version with the PNGs in a directory,
 * in filename order.
 *
 * Screenshots belong to an appStoreVersion, and a version that is already
 * READY_FOR_SALE is frozen -- Apple will not let the live listing's pictures
 * be swapped in place. So this refuses any version that is not open for
 * editing, and names the state rather than failing halfway through.
 *
 * Upload is Apple's three-step dance: reserve the asset and receive a list of
 * upload operations, PUT each byte range where it says, then PATCH the asset
 * with `uploaded: true` and the file's MD5 so Apple can verify it arrived
 * whole. Skipping the checksum leaves an asset stuck in UPLOAD_COMPLETE
 * forever, which reads in the UI as a screenshot that silently never appears.
 */
const EDITABLE = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]);

async function uploadShots(versionString, dir, go) {
  const say = (s) => console.log(`  ${go ? '' : '[dry-run] '}${s}`);
  const files = fs
    .readdirSync(dir)
    .filter((n) => /\.(png|jpg|jpeg)$/i.test(n))
    .sort();
  if (!files.length) {
    console.error(`  no images in ${dir}`);
    process.exitCode = 1;
    return;
  }
  console.log(`
Screenshots -> ${versionString}${go ? '' : '  (DRY RUN)'}`);

  const v = await api(
    `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${versionString}` +
      `&limit=1&fields[appStoreVersions]=versionString,appStoreState`,
  );
  if (!v) return;
  if (!v.data.length) {
    console.error(`  no version record for ${versionString}`);
    process.exitCode = 1;
    return;
  }
  const ver = v.data[0];
  const state = ver.attributes.appStoreState;
  if (!EDITABLE.has(state)) {
    console.error(
      `  version ${versionString} is ${state}; Apple only allows screenshots to be
` +
        `  changed on a version that is still open for editing. Create the next
` +
        `  version record first -- the pictures go up with it.`,
    );
    process.exitCode = 1;
    return;
  }
  say(`version ${versionString} is ${state}`);

  const locs = await api(
    `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations` +
      `?fields[appStoreVersionLocalizations]=locale`,
  );
  if (!locs) return;
  const en = locs.data.find((l) => l.attributes.locale === 'en-US');
  if (!en) {
    console.error('  no en-US localization on that version');
    process.exitCode = 1;
    return;
  }

  const sets = await api(
    `/v1/appStoreVersionLocalizations/${en.id}/appScreenshotSets` +
      `?fields[appScreenshotSets]=screenshotDisplayType`,
  );
  if (!sets) return;
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === 'APP_IPHONE_65');
  if (set) {
    const existing = await api(
      `/v1/appScreenshotSets/${set.id}/appScreenshots?fields[appScreenshots]=fileName&limit=20`,
    );
    const n = existing ? existing.data.length : 0;
    say(`replace the ${n} image(s) already in the 6.5" set`);
    if (go && existing) {
      for (const img of existing.data) {
        await api(`/v1/appScreenshots/${img.id}`, { method: 'DELETE' });
      }
    }
  } else {
    say('create the 6.5" screenshot set');
    if (go) {
      const made = await post('/v1/appScreenshotSets', {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: 'APP_IPHONE_65' },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: en.id },
            },
          },
        },
      });
      if (!made) return;
      set = made.data;
    }
  }

  for (const name of files) {
    const bytes = fs.readFileSync(`${dir}/${name}`);
    say(`upload ${name} (${Math.round(bytes.length / 1024)} KB)`);
    if (!go) continue;

    const reserved = await post('/v1/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileSize: bytes.length, fileName: name },
        relationships: {
          appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } },
        },
      },
    });
    if (!reserved) return;

    for (const op of reserved.data.attributes.uploadOperations) {
      const headers = {};
      for (const h of op.requestHeaders || []) headers[h.name] = h.value;
      const res = await fetch(op.url, {
        method: op.method,
        headers,
        body: bytes.subarray(op.offset, op.offset + op.length),
      });
      if (!res.ok) {
        console.error(`    upload chunk failed: HTTP ${res.status}`);
        process.exitCode = 1;
        return;
      }
    }

    const md5 = crypto.createHash('md5').update(bytes).digest('hex');
    const done = await patch(`/v1/appScreenshots/${reserved.data.id}`, {
      data: {
        type: 'appScreenshots',
        id: reserved.data.id,
        attributes: { uploaded: true, sourceFileChecksum: md5 },
      },
    });
    if (!done) return;
    console.log(`    ${name}: ${done.data.attributes.assetDeliveryState?.state || 'uploaded'}`);
  }
  if (go) console.log(`
  ${files.length} screenshot(s) on ${versionString}.`);
}


/**
 * Create the version record on its own, without a build.
 *
 * Screenshots and release notes hang off a version, and a released version is
 * frozen, so staging the next release's listing means making the record
 * first. It is invisible to users until it is submitted, and can be deleted
 * while it is still PREPARE_FOR_SUBMISSION.
 */
async function makeVersion(versionString, go) {
  const existing = await api(
    `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${versionString}` +
      `&limit=1&fields[appStoreVersions]=versionString,appStoreState`,
  );
  if (!existing) return;
  if (existing.data.length) {
    console.log(
      `
  ${versionString} already exists (${existing.data[0].attributes.appStoreState})`,
    );
    return;
  }
  console.log(`
${go ? '' : '[dry-run] '}create version ${versionString}, releaseType AFTER_APPROVAL`);
  if (!go) return;
  const made = await post('/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: { platform: 'IOS', versionString, releaseType: 'AFTER_APPROVAL' },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  if (!made) return;
  console.log(`  created ${made.data.id} (${made.data.attributes.appStoreState})`);
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
  } else if (cmd === 'withdraw') {
    await withdraw(process.argv.includes('--go'));
  } else if (cmd === 'version') {
    const version = process.argv[3];
    if (!version) {
      console.error('Usage: node scripts/asc.js version <version> [--go]');
      process.exit(2);
    }
    await makeVersion(version, process.argv.includes('--go'));
  } else if (cmd === 'upload-shots') {
    const version = process.argv[3];
    const dir = process.argv[4];
    if (!version || !dir) {
      console.error('Usage: node scripts/asc.js upload-shots <version> <dir> [--go]');
      process.exit(2);
    }
    await uploadShots(version, dir, process.argv.includes('--go'));
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
    console.error('Commands: state, builds, shots, version, upload-shots, withdraw, submit');
    process.exit(2);
  }
  console.log('');
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
