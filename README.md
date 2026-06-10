# 📷 Candid Cam — Disposable Camera App

Retro-aesthetic disposable camera for events. Share the app, everyone gets N shots, all photos land in one shared gallery in real time.

**Built with:** Expo (React Native) + Firebase

---

## Quick Setup (10 minutes)

### 1. Install Expo Go on your phone
- iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
- Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

### 2. Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Add a **Web app** (yes, Web — the JS SDK works for React Native)
4. Copy your config values

**Enable Firestore:**
- Firestore Database → Create database → **Start in test mode**

**Enable Storage:**
- Storage → Get started → **Start in test mode**

### 3. Add your Firebase config

Open `firebase.js` and replace the placeholder values in `firebaseConfig` with your actual values.

### 4. Install dependencies & run

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone. That's it!

---

## How it works

1. **Create event** → You get a 6-char code (e.g. `K3MN7X`)
2. **Share the code** (via WhatsApp, text, etc.)
3. **Guests open Expo Go → scan your QR**, OR you share your `exp://` link
4. Everyone gets their shot limit — takes photos with filters
5. **Gallery updates live** as photos come in
6. **Save / Share** individual photos to camera roll or Instagram/WhatsApp

---

## Features

| Feature | Details |
|---------|---------|
| Camera | Front/back, flash (torch), 3s/10s timer, grid overlay |
| Filters | Natural, Kodak, Fuji, Expired, B&W, Fade, Vivid, Cinema |
| Limits | 5 / 10 / 20 / 36 shots per person (host picks) |
| Gallery | Real-time, polaroid style, save to camera roll, share |
| Share | Native share sheet → WhatsApp, Instagram, iMessage, etc. |

---

## Firestore Rules

Paste in Firebase Console → Firestore → Rules tab:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{id}  { allow read, write: if true; }
    match /photos/{id}  { allow read, write: if true; }
  }
}
```

## Storage Rules

Firebase Console → Storage → Rules tab:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} { allow read, write: if true; }
  }
}
```

> These are open rules for events. Tighten them before going to production.

---

## Notes

- The app runs in **Expo Go** — no build needed
- Photos are stored permanently in Firebase Storage (free tier: 5 GB)
- User identity persists on-device via `expo-secure-store`
- The "B&W" filter uses an overlay (true grayscale requires a native build / EAS)
