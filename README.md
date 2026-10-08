# Rajesh Video Studio (MySQL version)

Zaroori: Node.js 18+, MySQL (Workbench wala), FFmpeg (sirf export ke liye).

## 1. Database (MySQL Workbench me)
Workbench kholo, apne connection se connect karo, ye query chalao:

    CREATE DATABASE rvs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

## 2. backend/.env set karo
`backend/.env` file kholo aur sirf DATABASE_URL badlo:

    DATABASE_URL="mysql://root:APNA_PASSWORD@localhost:3306/rvs"

IMPORTANT: password me special character ho (@ # / : ?) to use URL-encode karo.
Jaise  @ -> %40   # -> %23   / -> %2F   : -> %3A

## 3. Install aur tables banao
    cd backend
    npm i
    npx prisma db push        # Workbench me rvs database me tables ban jaayenge
    npm run dev               # API: http://localhost:4000

Check: browser me http://localhost:4000/api/health kholo -> {"ok":true}

## 4. Frontend (naya terminal)
    cd frontend
    npm i
    npm run dev               # App: http://localhost:5173

Frontend ko API se jodne ke liye koi .env nahi chahiye (Vite proxy /api ko localhost:4000 par bhejta hai).

## Ek command se (root folder se)
    npm run install:all
    npm run setup
    npm run dev

## Agar error aaye
- P1001 "Can't reach database": MySQL service chal rahi hai? Port 3306 sahi hai?
- P1000 "Authentication failed": .env me username/password galat (ya special char encode nahi kiya).
- P1003 "Database rvs does not exist": step 1 ki query chalao.
- Login page par "Network error": backend terminal me dekho chal raha hai ya nahi, aur /api/health check karo.
- Export: `ffmpeg -version` chalna chahiye. Cloud storage optional hai (.env.example me S3 settings).

## FFmpeg install (export ke liye zaroori)
Windows: PowerShell me `winget install Gyan.FFmpeg`, phir terminal band karke naya kholo, aur `ffmpeg -version` chalao.
Agar "not recognized" aaye to backend/.env me full path do (apne folder ke hisaab se):
    FFMPEG_PATH="C:/ffmpeg/bin/ffmpeg.exe"
    FFPROBE_PATH="C:/ffmpeg/bin/ffprobe.exe"
Text export ke liye Windows par arial.ttf apne aap use hota hai. Alag font chahiye to FFMPEG_FONT="C:/Windows/Fonts/arial.ttf".
Mac/Linux: `brew install ffmpeg` / `sudo apt install ffmpeg`. Env change ke baad backend restart karo.

## PHONE APP (APK)
Ye project ab Android app bhi hai (Capacitor). Pehle zaroori baat: app ko backend chahiye.
Phone app "localhost" nahi dekh sakta, isliye app ke login page par "Server" box aayega.
Wahan us computer ka address likho jis par backend chal raha hai, jaise  http://192.168.1.5:4000
(computer ka IP: Windows me `ipconfig` -> IPv4 Address. Phone aur computer SAME Wi-Fi par hon.)
Ghar ke bahar chalane ke liye backend ko internet par deploy karna padega (hosting chahiye).

### APK banane ke 2 tareeke
A) Bina Android Studio (GitHub se):
   1. Is poore folder ko ek GitHub repository me upload karo.
   2. GitHub -> Actions -> "Build Android APK" -> Run workflow.
   3. 5-10 minute baad run me neeche "Artifacts" me rajesh-video-studio-apk download karo -> zip kholo -> app-debug.apk.
B) Android Studio se:
   1. cd frontend && npm i && npm run android:sync
   2. Android Studio kholo -> Open -> frontend/android folder.
   3. Build -> Build Bundle(s)/APK(s) -> Build APK(s). APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk

### Phone me install
APK file phone me bhejo -> kholo -> "Install unknown apps" allow karo -> Install.
(Ye debug APK hai, personal use ke liye. Play Store ke liye signed release build alag banta hai.)

### Bina APK ke (PWA)
Agar app HTTPS website par deploy ho, Chrome me kholkar menu -> "Install app" / "Add to Home screen" se app jaisa chalta hai.

## PHOTO VIDEO MAKER (naya)
Dashboard par "Photo Video Maker" button, ya seedha http://localhost:5173/studio
- Photos add karo -> "Auto Cinematic video" dabao -> Export.
- 60 motion presets, 13 effects, 12 transitions, 12 filters, 9 text animations (Hindi + English), 8 particles, 12 backgrounds, green screen.
- Music (beat sync), voice-over record/upload, whoosh sound effects, fade, volume.
- Ye poora browser me chalta hai: backend/database ke bina bhi. Export bhi browser me hota hai, to static hosting par chal sakta hai.

## LIVE (internet par) KARNA
Static (Studio ke liye kaafi): frontend folder ko Vercel / Netlify / Cloudflare Pages par deploy karo (build: npm run build, output: dist).
Poora app (login, projects, server export):
 1. MySQL: Aiven / TiDB Cloud / Railway (free plan) me database banao, DATABASE_URL copy karo.
 2. Backend: backend/Dockerfile ko Render / Railway / Fly.io par deploy karo (FFmpeg Dockerfile me hai). Env: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, CLIENT_URL=<frontend ka URL>.
 3. Frontend deploy karte waqt env do: VITE_API_URL=https://<backend-url>/api
 4. Files ke liye S3/R2 (backend/.env.example me S3_ settings).

## BACKEND LIVE HO GAYA? APP/APK KO USSE JODO
Backend ka live address (jaise https://rvs-backend.onrender.com) copy karo. Phir:

1) APK ke liye
   - frontend/.env.production kholo aur likho:  VITE_API_URL=https://rvs-backend.onrender.com/api
   - cd frontend && npm i && npm run android:sync
   - Android Studio se APK banao  YA  GitHub par: Settings -> Secrets and variables -> Actions -> Variables -> New variable
     Name: API_URL   Value: https://rvs-backend.onrender.com   (phir Actions -> Build Android APK -> Run workflow)
   - Naya APK install karo. Login page par ab Server box nahi aayega, app seedha live backend se judega.
   - Bina rebuild ke test karna ho: .env.production khali chhodo, APK login page ke "Server" box me live address likho.

2) Website (Vercel / Netlify) ke liye
   - Vercel -> Project -> Settings -> Environment Variables:  VITE_API_URL = https://rvs-backend.onrender.com/api  (phir Redeploy)
   - Backend ke env me:  CLIENT_URL = https://aapki-website.vercel.app   (phir backend Redeploy)

3) Backend par zaroor check karo
   - /api/health kholo -> {"ok":true} aana chahiye.
   - Env: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, CLIENT_URL.
   - Render/Railway ki disk restart par saaf ho jaati hai: upload ki hui files ke liye S3 / Cloudflare R2 (backend/.env.example me S3_ settings) lagao.

## PHONE PAR ASLI APP — SABSE AASAAN TAREEKA (APK ke bina bhi)
Ye website ab "installable app" hai (icon, full screen, offline shell, install button).

A) 1 MINUTE ME (abhi)
   1. Naya frontend Vercel par deploy karo (Vercel me Environment Variable: VITE_API_URL = https://aapka-backend/api, phir Redeploy).
   2. Phone ke Chrome me apni Vercel site kholo. Home par "Install RVS on your phone" card aayega -> Install.
      (Card na aaye to: Chrome menu ⋮ -> "Install app". iPhone: Safari -> Share -> "Add to Home Screen".)
   3. Home screen par RVS icon aa jayega. Ye full screen app ki tarah khulta hai.

B) ASLI APK FILE (Android Studio ki zaroorat nahi)
   1. Phone/laptop browser me https://www.pwabuilder.com kholo, apni Vercel site ka link daalo, "Start".
   2. "Package for stores" -> Android -> Package ID: com.rajesh.videostudio -> Generate -> zip download.
   3. Zip me ".apk" file milegi -> phone me bhejo -> install (Install unknown apps allow karo).
   4. Address bar chhupane ke liye: zip me "assetlinks.json" aur SHA-256 milega. frontend/assetlinks.template.json ka content ye SHA daalkar
      frontend/public/.well-known/assetlinks.json naam se rakho, phir Vercel Redeploy karo.
   Ye APK Chrome engine par chalta hai, isliye Photo Video Maker ka export, mic (voice-over) aur download sab Chrome jaise hi chalte hain.
