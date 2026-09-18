# MatchCraft v3 — Android Floating Overlay

A persistent floating bubble that sits on top of any app (Tinder, Instagram, etc.), giving one-tap access to AI-generated dating replies without switching apps. Android-only — iOS does not permit system-wide third-party overlays.

---

## What's new in v3

| Feature | Details |
|---------|---------|
| Floating bubble | 60dp circle pinned to the screen edge, draggable vertically, snaps to nearest edge on release |
| Expand-on-tap panel | MaterialCard with screenshot loader, tone + platform chips, generate button, and suggestions — all in a floating window |
| Tap-outside collapse | `FLAG_WATCH_OUTSIDE_TOUCH` collapses the panel back to the bubble on any outside touch |
| Long-press / drag-off | Drag the bubble off-screen (or use the in-app Stop button) to dismiss |
| Foreground service | Persistent notification "MatchCraft is running" with a Stop action; required by Android for visible overlays |
| Gallery shortcut | Loads the most recent image from MediaStore automatically — just screenshot the dating app and tap the bubble |
| Permission onboarding | Clear explanation screen that deep-links to `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` and detects return |

---

## Android version quirks

| Android version | Overlay behavior |
|----------------|-----------------|
| 8.0–9.x (API 26–28) | `TYPE_APPLICATION_OVERLAY` works; no foreground service type needed |
| 10–13 (API 29–33) | Same; `READ_EXTERNAL_STORAGE` for gallery access |
| 14+ (API 34+) | `foregroundServiceType="dataSync"` required in manifest + `FOREGROUND_SERVICE_DATA_SYNC` permission; `READ_MEDIA_IMAGES` replaces `READ_EXTERNAL_STORAGE` |
| Any MIUI / ColorOS / OneUI | OEM battery optimizers may kill the service — user must whitelist MatchCraft in battery settings |
| Android 12+ | `PendingIntent.FLAG_IMMUTABLE` required (already set) |

`Settings.canDrawOverlays(context)` is the reliable runtime check for the overlay permission across all API levels. The legacy `checkSelfPermission` path does **not** work for `SYSTEM_ALERT_WINDOW`.

---

## Prerequisites

Same as v2, plus:

- Android emulator or device running API 26+
- The Cloudflare Worker from v1 deployed (see `worker/` in this repo)

---

## Build & run

### 1. Configure the Worker URL

In `android/MatchCraft/app/build.gradle.kts`:

```kotlin
buildConfigField("String", "WORKER_BASE_URL",
    "\"https://matchcraft-api.YOUR-NAME.workers.dev\"")
```

### 2. Open in Android Studio

```
File → Open → android/MatchCraft
```

Sync Gradle, then run on an API 26+ emulator.

### 3. Grant gallery permission (first run)

On Android 13+, the app will request `READ_MEDIA_IMAGES` when the bubble panel first tries to load a screenshot. Grant it.

---

## Testing the overlay end-to-end

### Grant "Display over other apps"

1. Launch the app → tap **🫧 Start Floating Bubble**.
2. The permission screen appears — tap **"Open Permission Settings →"**.
3. Android opens *Settings → Apps → Special app access → Display over other apps → MatchCraft* — toggle **Allowed** on.
4. Press Back. The app detects the grant in `onResume` and starts the service automatically.

### See the bubble over another app

1. The app calls `moveTaskToBack(true)` after launching the service, so Chrome (or the home screen) comes to the front immediately.
2. The 💘 bubble appears in the top-right corner.
3. Drag it up/down to reposition; it snaps to the nearest vertical edge when you lift your finger.

### Expand the panel

1. Tap the bubble — the panel opens as a floating card.
2. The latest screenshot from your gallery is loaded automatically. Tap **↺ Reload** if you want a fresher one.
3. Select a tone chip (Flirty is default) and optionally a platform.
4. Tap **✨ Craft My Reply** — suggestions appear as tappable cards.
5. Tap a suggestion to copy it to the clipboard; paste it in the dating app.

### Collapse / dismiss

- Tap anywhere **outside** the panel → collapses back to the bubble.
- Drag the bubble off the left or right screen edge → bubble disappears (service still running; pull-down notification shows "MatchCraft is running").
- Tap **Stop** in the notification, or open the app and tap **Stop Bubble** → service terminates, no bubble.

### Emulator screenshot shortcut

The emulator's gallery starts empty. To seed a test image:

```bash
# Push any JPEG to the emulator's Pictures folder
adb push test_screenshot.jpg /sdcard/Pictures/test.jpg

# Notify MediaStore of the new file
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d "file:///sdcard/Pictures/test.jpg"
```

Then tap **↺ Reload Latest Screenshot** in the bubble panel.

---

## Notification

The foreground service shows a persistent low-priority notification:

> **MatchCraft is running**  
> Tap to open · your bubble is active  
> [Stop]

Tapping **Stop** sends `ACTION_STOP` to the service, which calls `stopSelf()`, removes both the bubble and panel views from the WindowManager, and cancels the notification cleanly.

---

## Privacy

The overlay does **not** read your screen content automatically. It only acts on a screenshot you explicitly load from your gallery. No keystrokes, no OCR, no screen recording — ever. This is stated in the permission onboarding screen and again as a footer in the bubble panel.

---

## Project structure (v3 additions)

```
android/MatchCraft/app/src/main/
├── AndroidManifest.xml               ← added SYSTEM_ALERT_WINDOW, FOREGROUND_SERVICE*,
│                                         READ_MEDIA_IMAGES, OverlayService declaration
├── java/com/matchcraft/app/
│   ├── OverlayPermissionActivity.kt  ← permission onboarding + deep-link
│   ├── overlay/
│   │   ├── OverlayService.kt         ← foreground service, bubble + panel management
│   │   └── ScreenshotHelper.kt       ← MediaStore query for latest image
│   └── MainActivity.kt               ← updated with overlay start/stop controls
└── res/
    ├── layout/
    │   ├── overlay_bubble.xml        ← 60dp circle
    │   ├── overlay_panel.xml         ← floating card UI
    │   └── activity_overlay_permission.xml
    ├── drawable/
    │   ├── bubble_bg.xml             ← rose gradient oval
    │   └── panel_bg.xml              ← rounded rect
    └── color/
        └── chip_text_selector.xml    ← white when checked, dark otherwise
```
