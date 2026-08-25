# Building the APK

This app is a **client + server** app. Only the React UI (`client/`) goes inside the
APK. The Express server (`server/`) does the AI parsing, the `sharp` poster
rendering and the Supabase writes — none of that can run on the phone, so the
server must stay hosted somewhere the phone can reach.

## 1. Host the server

Run `server/` on a machine the phone can reach and note its base URL:

- Quick LAN test: `npm run server` on this PC, then use `http://<your-lan-ip>:5000`
- Real deployment: any Node host (Render, Railway, Fly, a VPS) over `https://`

## 2. Point the app at it

    cd client
    cp .env.example .env       # then set VITE_API_BASE_URL=<server base URL>

Leave `VITE_API_BASE_URL` empty for `npm run dev` — the Vite proxy handles it there.

## 3. Install the Android toolchain (one time)

Not installed on this machine yet:

- **JDK 21** — https://adoptium.net (or the JDK bundled with Android Studio)
- **Android Studio** — https://developer.android.com/studio, then in
  SDK Manager install *Android SDK Platform 35* + *Android SDK Build-Tools*

Then set the env vars (PowerShell, one time):

    setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-21..."
    setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"

## 4. Build

    cd client
    npm run apk

The debug APK lands at:

    client/android/app/build/outputs/apk/debug/app-debug.apk

Copy it to the phone and install it (Settings needs "install unknown apps" allowed).

`npm run open:android` opens the project in Android Studio instead, if you'd
rather build/run from there.

## 5. Release build (for Play Store or a signed share)

    cd client/android
    ./gradlew bundleRelease     # .aab for Play Store
    ./gradlew assembleRelease   # .apk

Release builds need a signing keystore — see
https://capacitorjs.com/docs/android/deploying-to-google-play

## Notes

- `android:usesCleartextTraffic="true"` is set in `AndroidManifest.xml` so an
  `http://` LAN server works during testing. Remove it once the server is https.
- The share sheet uses the Web Share API, which works in the Android WebView for
  files. `@capacitor/share` and `@capacitor/filesystem` are installed if a native
  fallback is ever needed.
- After changing any client code: `npm run build:android` re-syncs `dist/` into
  the native project.
