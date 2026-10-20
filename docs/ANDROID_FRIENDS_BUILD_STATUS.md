# Trap & Tonic 1.0.0 — signed manual-phone-test build

This is the current status, superseding the historical forecast, presentation and Android preparation reports for delivery disposition. It is **not** full-game completion, device acceptance or a store release. The earlier checkpoint003 branch remains the published playtest baseline; this successor is stacked on it without merging the existing draft PR chain.

## Included changes

- Forecast/scouting shows known information and uncertainty; completed-report replay remains distinct from prediction.
- Illustrated hub and Workshop/Trade/Expedition/History navigation, progressive disclosure, real craft → sell → expedition → completed-report tutorial, skip/resume and tutorial-only restart.
- Original first-pass artwork for the finite registered inventory: 284 SVGs and six raster master exports, with explicit shared/category mappings. Coverage is not a promise of bespoke art for unimplemented future content or that every asset is simultaneously visible.
- Capacitor Android wrapper, original launcher/splash resources, local assets, validated native checkpoint recovery and serialized Preferences mirrors. Application ID `com.trapandtonic.game`, versionName `1.0.0`, versionCode `1`, minSdk24, targetSdk36.
- AF01 startup correction: malformed redundant native mirror no longer blocks validator-approved healthy local PRIMARY/BACKUP progress. The rejected string is retained/read back before replacement. Full, oversized or unverifiable retention pauses mirrors without erasing originals; missing healthy-local and readable future-version guards remain enforced.

## Exact distributed artifact

Corrected release APK `Trap-and-Tonic-1.0.0.apk`:

```
SHA256 6ab69ff8a1e72d3375d22db43efd15ae92643297d89cf8bcd6469ec46b730aa4
Signing certificate SHA256 4b1d8630d48e164b7564729827706e95e9f439318fafa672e171c0bf0f240619
Corrected frozen source ZIP SHA256 8fee1195e7c7c7650c91bc8851740f4c9ae123e0246cb647c920a7bb1bc578e0
Source manifest SHA256 f115ebe149112452c9f92aa43d2019079ab00a037ce896c84159559ebf808c70
Independent AF01 report SHA256 38448392dda604bc59d9ebe78c1ac22c5a0e391121846cc90b8357253d19aca9
```

The corrected signed APK was sent through the owner's configured Telegram destination, with installation notes and device-test caveats. Transport success is not proof of opening or installation. Signing keys/passwords are retained privately outside Git and are never part of this publication. APK binaries, SDK/JDK caches, generated web copies and private raw evidence are intentionally not source-controlled. No public GitHub release is implied.

## Verification and limits

One coordinated final automated round exercised 151 canonical tests, browser tutorial/offline paths, artwork and static APK checks. It initially returned HOLD for AF01; historical failures remain preserved. One bounded correction followed, then a separate targeted independent retest: original five-case reproducer, 12 focused regressions and seven independent key-aware groups passed. These are separate populations, **not** a rerun or summed canonical test total. All nine targeted reviewer commands exited0; AF01 disposition RESOLVED in this scope. All938 frozen source members remained unchanged during that review; all388 corrected web files mapped exactly into the final APK, with art preserved. Publication adds this status document only; Git checkout normalization is distinct from raw archive identity.

Physical Android installation, native offline startup, Back/pause/force-stop durability, import/export/upgrade, safe areas and performance remain **NOT TESTED**. The owner chose to install on their own phone. Minor scrolling/large-text/accessibility/settings issues, existing harness limitations and unfinished economic balance remain for hands-on inspection. Native retention/pause notices can be masked by higher-priority local-backup notices; automated retention proof is not proof of visible native UI notices. Full commissioned progression/content remains incomplete.

Earlier harness failures are not relabelled passes. Remote GitHub CI is a separate exact-commit result: the inherited offline harness has an obsolete Home-selector assumption, and some browser scripts have inherited port/selector constraints. A failure there must be reported honestly, not hidden by weakening tests or a new polishing loop.

## Building and testing

Use Node24 and the committed lockfile:

```sh
npm ci
npm run lint
npm test
node --test scripts/native-startup-af01.test.mjs
npm run build
npm run android:sync
```

For native builds use JDK21, Android API36 and Build Tools35.0.0 with the committed Gradle wrapper (8.14.3/AGP8.13.0). Accept applicable SDK terms yourself. Configure your local SDK path outside Git; consult `scripts/android-local-build.mjs` for isolated debug-build environment inputs. A normal release build uses `android/gradlew :app:assembleRelease` from the Android directory with your configured environment. Align and sign its unsigned output using the owner's existing release identity; source checkout alone does not grant access to that private key. Verify package/version, non-debuggable flag, asset mapping, signature and alignment before distribution. Future updates need the same key and a higher versionCode.

Prefer this signed build for first installation. Do not uninstall a debug build or clear app data to bypass a certificate mismatch: first preserve a separately recoverable save. User-controlled encrypted backup of the signing key and usable password is still required for update continuity. No private key or password should be posted to GitHub, logs or chat.
