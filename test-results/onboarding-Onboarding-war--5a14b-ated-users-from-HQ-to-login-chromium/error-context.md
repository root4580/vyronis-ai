# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding.spec.ts >> Onboarding war room >> redirects unauthenticated users from HQ to login
- Location: tests/e2e/onboarding.spec.ts:5:7

# Error details

```
TimeoutError: browserType.launch: Timeout 180000ms exceeded.
Call log:
  - <launching> /var/folders/8r/1hcbn1hx49b1yttsq3v6gkmh0000gn/T/cursor-sandbox-cache/b5fe4677b182229ffd42e882cdea3819/playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-x64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --user-data-dir=/var/folders/8r/1hcbn1hx49b1yttsq3v6gkmh0000gn/T/playwright_chromiumdev_profile-aenInQ --remote-debugging-pipe --no-startup-window
  - <launched> pid=15533
  - [pid=15533][err] Received signal 11 SEGV_MAPERR 000000000010
  - [pid=15533][err]  [0x000106971073]
  - [pid=15533][err]  [0x000106974a33]
  - [pid=15533][err]  [0x7ff80564f31d]
  - [pid=15533][err]  [0x00000000010b]
  - [pid=15533][err]  [0x0001034ff475]
  - [pid=15533][err]  [0x00010413720a]
  - [pid=15533][err]  [0x0001030d2436]
  - [pid=15533][err]  [0x000104867bb2]
  - [pid=15533][err]  [0x000104868bdc]
  - [pid=15533][err]  [0x00020ba56530]
  - [pid=15533][err] [end of stack trace]

```