# Roadguard (formerly PotHoleRadar)

Roadguard is an on-device road hazard and pothole radar app built with React Native and Expo.
This codebase has been refactored to be **100% local and offline-first**:
- All remote authentication, registration, login screens, and token requirements have been removed.
- On first launch, the app asks **"What's your name?"** and saves it in `AsyncStorage`.
- The Home screen greets you with **"Hi [username]"** (e.g. "Hi Alex") and includes an instant inline/modal name edit button.
- All scanned pothole reports are stored on the device filesystem with `@react-native-async-storage/async-storage` and `expo-file-system`.
- Scanned pothole photos from camera or gallery are saved to the persistent local document directory.
- The AI Scanner calls `EXPO_PUBLIC_SEVERITY_API_URL + "/scan"` (`https://pothole-yp4s.onrender.com/scan`) without any token headers, automatically committing the report, bounding boxes, severity, confidence, and local image URI to device storage upon analysis completion.

## Architecture

1. **User Identity & Greeting**:
   - `AsyncStorage` key `roadguard:username`
   - Initial onboarding in `app/index.tsx`
   - Greeting header `Hi [username]` with edit pencil in `app/(tabs)/index.tsx`
   - Settings name manager in `app/settings.tsx`
   - Profile view in `app/(tabs)/profile.tsx`

2. **On-Device Storage**:
   - Storage manager: `lib/storage.ts`
   - Local reports key: `roadguard:reports:v1`
   - Scan history key: `roadguard:scan-history:v1`
   - Photo file persistence: `expo-file-system` saving into `FileSystem.documentDirectory + "roadguard_scans/"`
   - Reports schema: `id`, `image_uri`, `severity`, `confidence`, `date` / `createdAt`, `latitude`, `longitude`, `address`, `note`, `status`

3. **AI Scanner**:
   - Service helper: `lib/ai-detection.ts`
   - Target API: `POST https://pothole-yp4s.onrender.com/scan` with multipart `file`
   - Screen: `app/ai-scan.tsx`
   - Automatically saves report and local image upon analysis completion.
   - History viewer: `app/scan-history.tsx`

## Running the App

```bash
# Install dependencies
npm install

# Start development server
npx expo start
```
