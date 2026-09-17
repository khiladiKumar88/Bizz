# MatchCraft v2 — Native Keyboard Extensions

AI-powered dating reply assistant as a native keyboard extension for iOS and Android. Uses the same Cloudflare Worker backend as v1.

---

## Architecture

```
v1 backend (unchanged)
  worker/src/index.js — Cloudflare Worker, stateless AI proxy

v2 native apps
  ios/MatchCraft/      — iOS app + keyboard extension (Swift/UIKit)
  android/MatchCraft/  — Android app + IME (Kotlin)
```

The keyboard extensions:
1. Accept a screenshot pasted from the clipboard
2. Send it (base64 JPEG) to the Cloudflare Worker
3. Display 5 AI-generated reply suggestions in the keyboard panel
4. Insert the chosen suggestion directly into the focused text field

No keystrokes are ever logged or transmitted. The AI only processes an image you explicitly paste.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Xcode | 15+ |
| XcodeGen | 2.40+ (`brew install xcodegen`) |
| Android Studio | Hedgehog (2023.1) or newer |
| JDK | 17+ |
| Deployed Cloudflare Worker | (from v1) |

---

## iOS — Build & Run

### 1. Generate the Xcode project

```bash
cd ios/MatchCraft
chmod +x setup.sh
./setup.sh          # installs XcodeGen if needed, runs xcodegen generate
```

### 2. Configure the Worker URL

Open `MatchCraftKeyboard/APIClient.swift` and replace the placeholder:

```swift
private let baseURL = "https://matchcraft-api.YOUR-NAME.workers.dev"
```

### 3. Open in Xcode

```bash
open MatchCraft.xcodeproj
```

Select the **MatchCraft** scheme and an iOS 16+ simulator, then **Run (⌘R)**.

### 4. Enable the keyboard in the simulator

1. The app launches the 4-step onboarding automatically.
2. Tap **"Open Keyboard Settings"** — this opens the iOS input method settings.
3. In Settings → General → Keyboard → Keyboards → Add New Keyboard, find **MatchCraftKeyboard** and add it.
4. **Allow Full Access** (required for network requests).

> **Simulator tip:** The clipboard-paste flow is easiest to test on a physical device. On Simulator, use the **Edit → Paste** menu or `⌘V` to paste an image into the UIPasteboard.

### 5. Test the keyboard

1. Open Safari or Notes in the simulator.
2. Tap a text field to bring up the keyboard.
3. Long-press the 🌐 globe key and select **MatchCraftKeyboard**.
4. Tap **✨**, paste a screenshot, choose a tone, tap **Generate**.
5. Tap any suggestion to insert it.

---

## Android — Build & Run

### 1. Configure the Worker URL

Open `android/MatchCraft/app/build.gradle.kts` and update:

```kotlin
buildConfigField("String", "WORKER_BASE_URL",
    "\"https://matchcraft-api.YOUR-NAME.workers.dev\"")
```

### 2. Open in Android Studio

```
File → Open → android/MatchCraft
```

Wait for Gradle sync to complete.

### 3. Run on emulator

Select an AVD (API 26+) and click **Run ▶**. The emulator must have Google Play Services for clipboard access to work reliably.

The app shows the onboarding flow on first launch.

### 4. Enable the IME

1. Tap **"Open Keyboard Settings"** in the onboarding.
2. In the system Keyboard settings, enable **MatchCraft AI Keyboard**.
3. Return to the app; the status card turns green.

### 5. Test the keyboard

1. Open any messaging app or text field.
2. Tap the keyboard-switch icon in the navigation bar or the globe button in the MatchCraft keyboard panel.
3. Select **MatchCraft AI Keyboard** from the picker.
4. Paste a screenshot (copy an image to clipboard first), choose a tone, tap **Generate**.
5. Tap a suggestion to insert it.

> **Emulator clipboard tip:** Use `adb shell am broadcast -a clipper.set -e text ""` to seed text, or use Android Studio's "Clipboard" tool window (in the emulator extended controls) to paste an image.

---

## Backend (v1 — unchanged)

See [`worker/README.md`](../worker/README.md) or the v1 README for full deployment steps. Summary:

```bash
cd worker
npx wrangler secret put CLAUDE_API_KEY
npx wrangler deploy
```

The `WORKER_BASE_URL` in both native apps must point to the deployed worker URL.

---

## Privacy

MatchCraft keyboard extensions:
- **Never** read or log keystrokes
- **Never** access messages you type
- **Never** transmit anything except an image you explicitly paste and the tone you select
- Full Network Access (iOS) / INTERNET permission (Android) is used only for the Worker API call

---

## Project Structure

```
ios/MatchCraft/
├── project.yml                        # XcodeGen config
├── setup.sh                           # one-shot project generator
├── MatchCraft/                        # container app
│   ├── AppDelegate.swift
│   ├── SceneDelegate.swift
│   ├── Onboarding/OnboardingViewController.swift
│   ├── Main/MainViewController.swift
│   └── Info.plist
└── MatchCraftKeyboard/                # keyboard extension
    ├── KeyboardViewController.swift
    ├── APIClient.swift
    └── Info.plist

android/MatchCraft/
├── settings.gradle.kts
├── gradle/libs.versions.toml
└── app/
    ├── build.gradle.kts
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/matchcraft/app/
        │   ├── MainActivity.kt
        │   ├── OnboardingActivity.kt
        │   └── keyboard/
        │       ├── MatchCraftIME.kt
        │       └── APIClient.kt
        └── res/
            ├── layout/
            │   ├── activity_main.xml
            │   ├── activity_onboarding.xml
            │   ├── keyboard_main.xml
            │   └── suggestion_item.xml
            ├── drawable/
            ├── color/
            └── xml/method.xml
```
