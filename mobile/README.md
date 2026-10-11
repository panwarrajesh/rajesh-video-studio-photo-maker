# Rajesh Video Studio – Mobile app (Expo / React Native)

Same account, projects and media as the website (same backend). Login stays saved on the phone (Android Keystore via expo-secure-store).

## 1. Run it on your phone (Expo Go)
```bash
cd mobile
npm install
cp .env.example .env        # then edit: EXPO_PUBLIC_API_URL=https://YOUR-BACKEND-URL/api   (no localhost in production)
npx expo start              # scan the QR code with the Expo Go app (phone + laptop on the same Wi-Fi)
```

## 2. Build the Android APK (no Android Studio needed)
```bash
npm install -g eas-cli
eas login                    # free Expo account
eas build:configure          # first time only, accept the defaults
# open eas.json and replace YOUR-BACKEND-URL in the "preview" profile
eas build -p android --profile preview      # ~10-15 min, gives you a download link for the .apk
```
Install the APK on the phone ("Install unknown apps" must be allowed). For Google Play use `--profile production` (an .aab file).
Secrets are never committed: only the public API URL is in `eas.json`. Keystores are created and stored by EAS.

## 3. Tests
`npm test` runs 49 tests: persistent login (restart, offline, token refresh, revoked session, logout), the timeline engine (split / trim / speed / ripple / snap / undo-redo), the editor screen.

## What the app does
Login (stays logged in) · New video from the gallery (multi-select, upload with progress and retry) · fixed centre playhead timeline that scrolls under it (swipe to scrub, pinch to zoom, tap to select, drag handles to trim, long-press to move) · Split, Delete, Duplicate, Undo, Redo, Speed, Volume, Text (Hindi/English), Audio, Effects, Filters · autosave · Export through the server (FFmpeg) with progress, then Save / Share.

## Honest limits
- The preview shows filters as colour tints (the exported video uses the real FFmpeg filters).
- No thumbnails strip on video clips yet, and no sticker / keyframe / transition UI beyond Fade and Cross Fade.
- Export needs internet and the server; large uploads are retried but not resumable.
