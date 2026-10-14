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
`npm test` runs 71 tests (login, timeline, uploads, film strips, diagnostics): persistent login (restart, offline, token refresh, revoked session, logout), the timeline engine (split / trim / speed / ripple / snap / undo-redo), the editor screen.

## What the app does
Login (stays logged in) · video clips show real frames like a film strip · projects get a thumbnail · New video from the gallery (multi-select, upload with progress and retry) · fixed centre playhead timeline that scrolls under it (swipe to scrub, pinch to zoom, tap to select, drag handles to trim, long-press to move) · Split, Delete, Duplicate, Undo, Redo, Speed, Volume, Text (Hindi/English), Audio, Effects, Filters · autosave · Export through the server (FFmpeg) with progress, then Save / Share.

## Honest limits
- The preview shows filters as colour tints (the exported video uses the real FFmpeg filters).
- No sticker / keyframe / transition UI beyond Fade and Cross Fade.
- Export needs internet and the server; large uploads are retried but not resumable.

## Agar app na chale (pehle ye 2 minute)
1. App kholo -> login screen par **"Not working? Check connection"** (ya Home par **Help**). Ye bata deta hai ki kya toota hai. **Share report** dabakar WhatsApp par bhej do.
2. App crash ho to ab blank screen nahi aata: "Something went wrong" screen aati hai, uska **Share error report** bhejo.

Sabse aam wajah (report me inhi me se koi ✗ dikhega):
| Dikhta hai | Matlab | Fix |
|---|---|---|
| Server address is set ✗ | App me backend ka address nahi | `EXPO_PUBLIC_API_URL=https://BACKEND/api` (mobile/.env ya eas.json), phir dobara build/start |
| Server is reachable ✗ | Phone server tak nahi pahunch raha | Address `https://` se shuru aur `/api` par khatam ho; phone browser me `<address>/health` kholo; free hosting ho to 1 minute ruk kar dobara |
| Login table exists ✗ | Backend update hua par database nahi | server par `npx prisma db push`, backend restart |
| Database works ✗ | MySQL se connect nahi | `DATABASE_URL` check karo |
| FFmpeg installed ✗ | Export nahi hoga | FFmpeg install (backend/Dockerfile me hai) |
| Expo Go "incompatible" | Expo Go purana | Play Store me Expo Go update karo (SDK 57 chahiye) ya APK banao |

Backend update karne ke baad zaroor: `npm install` (naya `express-async-errors` aaya hai), `npx prisma db push`, phir restart. `https://BACKEND/api/health/deep` browser me kholkar bhi ye sab dikh jaata hai.

`shared/` ka code ab app ke andar (`src/shared`) bhi rakha hai, taaki sirf `mobile/` folder se bhi build ho. `../shared` badalo to `npm run sync-shared` chalao.
