# Android packaging 001 — BLOCKED, not a friends release

## Identity and supported runtime

- App label: Trap & Tonic. Stable application ID: `com.trapandtonic.game`.
- Packaging target: versionName `1.0.0`, versionCode `1`. This is not Android/full-commission acceptance.
- Minimum Android API24, compile/target API36. Stable native WebView origin: `https://localhost`.
- Capacitor core/android/CLI8.5.3, App8.1.2, Preferences8.0.1; exact npm lockfile retained.
- Concrete Node24.18.0; task-local Temurin JDK21.0.12.1+1; Gradle8.14.3 binary distribution (publisher SHA256 pinned); AGP8.13.0.
- AGP8.13's actual default/minimum SDK Build Tools is35.0.0 (official release-note capture). The initial SDK discovery listed36.0.0 as a proposed package; that is not the actual default requirement. Use the reconciled toolchain requirements in the output folder.

## What actually ran

TypeScript compilation, Vite production build, Capacitor native-project generation/sync and seven focused pure storage/packaging probes passed. Gradle downloaded with its pinned checksum, configured the app/plugins, then failed: `Failed to find target with hash string 'android-36'`. SDK auto-download was explicitly disabled. No SDK licence acceptance occurred. No APK, signature, installation, native offline start or physical-device result exists.

The previous144-node broad suite/browser evidence belongs to the previous presentation candidate. It was not rerun or transferred to this candidate. The single final integrated round is still parent-owned after final art/packaging. Original unit files are preserved; seven new probe nodes are appended to the canonical command for that future round.

## Native storage and lifecycle implementation

The numerical save schema, existing validators, local primary/backup keys and safe save/rotation engine remain unchanged. After a validated local save, native snapshots are serialized through Preferences group `TrapAndTonic`, key `trap_and_tonic_native_checkpoint_v1`; writes read back before completion. Primary must validate before mirroring; only a valid backup is mirrored. Tutorial bytes remain separate and their existing UI loader validates them.

On startup, healthy local game progress wins. Only when no supported local checkpoint validates can a validated native snapshot recover it. Rejected local preimages are archived before overwrite; archive/storage failure stops recovery. Unsupported native envelope versions block fresh-campaign mounting and preserve the stored backup. This is internal consistency validation, not encryption/authentication. Actual Android SharedPreferences durability/OS-kill behavior is NOT device-proven by the pure probes.

Back saves first: secondary workspace→Home, Home→Pause, Pause→Resume; at title it requests native exit only after the mirror completes. Background/pause requests save and leaves a running game paused. Foreground does not auto-run a raid or advance time. Native App listeners handle lifecycle. Process restart hydrates before mounting the game. Device race/force-stop tests remain mandatory.

A browser/PWA save is not automatically accessible from the Android sandbox. Retain it and use the existing explicit compatible JSON import workflow if transferring; native import/export behavior still needs device verification. Never clear app data or uninstall as a repair without an independently recoverable export.

## Offline and permissions

Native web assets are copied into the project/APK; no remote server URL is configured. Native startup does not register a service worker, avoiding a cached older web build replacing packaged bytes. Remote Google-font links were removed; typography uses the existing system/Georgia/monospace fallbacks. Gameplay needs no network/paid API. App manifest requests no runtime/network/storage permission; examined Capacitor/App/Preferences library manifests are empty. Merged APK permission inspection is still unexecuted. Cleartext and WebView debugging are disabled; portrait orientation is explicit. The unused template Google Services Gradle hook was removed; no account/Google Services config is read.

## Reproducible commands and licence blocker

Run commands from the explicit builder/game directory using the concrete Node executable. `../outputs/android-1.0-001/run.mjs` captures fresh command outputs with scoped CI/cache/Node environment; it was used for `npm run build` and `capacitor sync android`. Repeat both after the parent's final artwork integration, NOT a full test campaign yet.

Google SDK licence text and its hash are retained at `../outputs/android-1.0-001/discovery/android-sdk-license.txt` and `sdk-license-blocker.json`. Explicit owner acceptance is required before downloading/using command-line SDK tools or accepting SDK packages. No `yes` pipe, licence-hash injection or privileged approval is permitted. Official command-line tools URL/checksum and actual package requirements are in `native-toolchain-requirements.json`. Owner-approved SDK setup must remain task-local; platform-tools is also needed for later device tests. No global environment/PATH installation.

Once approved/installed, set these ONLY in the build child environment:

- `ANDROID_LOCAL_JAVA_HOME`: retained task-local JDK home from discovery/jdk-install.json.
- `ANDROID_LOCAL_SDK_ROOT`: task-local SDK containing platforms;android-36 and build-tools;35.0.0.
- `ANDROID_LOCAL_WORKROOT`: private/cache directory outside source, inside the task's output/toolchain directory.
- `ANDROID_BUILD_EVIDENCE_DIR`: fresh output directory.

Invoke concrete Node with `scripts/android-local-build.mjs :app:assembleDebug`. It redirects Java/Gradle/Android private state and scratch directories into that task directory, never reads an existing user's debug key, disables SDK auto-download and uses no persistent daemon. Expected output only on success: `android/app/build/outputs/apk/debug/app-debug.apk`. The actual retained invocation is ../outputs/android-1.0-001/probe-native-build.py; it currently fails honestly on the missing SDK target.

## Signing/install safety

No APK or signing key was produced. No release signing credentials were chosen or supplied. A future `assembleDebug` output is DEBUG-SIGNED, not a friends release; its private debug material must remain in the task-local private Android/JVM home and outside all source/evidence archives. Friends upgrade continuity requires the parent's explicit persistent private signing identity decision. Same app ID plus same signing identity and increased versionCode are required for an in-place update. Never advise uninstalling an existing build merely to bypass a certificate mismatch.

Only after an actual signed APK is produced: inspect package/version/minSDK/merged permissions and signer, retain APK SHA256 and certificate identity, then owner-authorize a test device/USB or manual file install. The user must personally approve any OS install-source/security prompt; no bypass. ADB `install -r` is only an update attempt, not authority to erase existing data. Do not give friends a nonexistent/unsigned/unqualified package.

## Final artwork handoff slot

Final art now exists in `art/outputs/game-art-final-001/INTEGRATION.md`. Parent owns full integration and the coordinated final gate. This builder stage intentionally retains the provisional70 runtime images and template native launcher/splash resources. Do not ship those resources as completed final artwork.

Use only the director's final manifest/registry/inventory/counts, verify hashes/provenance, and integrate runtime ID aliases without changing game IDs/state. Android PNG inputs are adaptive foreground/background432, monochrome432, launcher512/1024 and splash emblem1152. Parent derives density resources, replaces native `ic_launcher`/round/adaptive and splash resources, and uses the specified parchment backing. Original drawings remain unchanged. Then rebuild Vite and sync Android again before producing/freeze-pinning the final APK. No earlier art/browser acceptance transfers automatically.

## Parent's ONE final round

Freeze final source, public assets, native resources, bundled web assets and signed APK with closed manifests. Run canonical unit identity preservation (previous144 plus appended probes), lint/build as applicable, targeted375/412 Normal/XLARGE tutorial/scouting/paid-request rendered actions, real conserved craft/sale/raid/report-inspection, reload and offline proofs. Updated OWN browser smoke plumbing uses validated loopback TEST_URL (defaults4178; reserved8765/public endpoints rejected), current navigation and technical disclosures; assertions and old failure archives are preserved. The changed own smoke has compiled but has NOT been browser-rerun in this stage. Other legacy harness selectors remain explicit inspection work; do not relabel obsolete-selector failures as gameplay evidence.

On Android verify actual install, airplane-mode cold start, pause/resume/Back, force-stop/process death/reopen, healthy/corrupt checkpoint conservation, tutorial persistence, compatible import/export, signed upgrade without data loss, safe-area/touch/nav visibility and real device performance. Same independent reviewer must review exact final bytes. Corrections are bounded to install/start/save/data-loss blockers; remaining polish goes to Anil, not another campaign loop.

Known retained issues: final art/native icons not integrated here; no Android/device acceptance; three moderate npm audit findings in dev-only Capacitor CLI→unused iOS xcode→uuid chain (no automatic downgrade/audit-fix); existing >500kB JS warning; native flatDir metadata warning; offline fallback font geometry and native export/safe-area behavior unverified. No numerical balance/physics changes, publication, commit or extra agents.
