# Cadence Club

A social fitness mobile app for iOS and Android, built with Expo and React Native.

## Features

- **Activity tracking** — real-time GPS with map, pace, distance, elevation and calories
- **Weekly training plan** — generated automatically from the user's goal and preferences
- **Social feed** — share activities, give boosts and comment on the community's runs
- **Routes** — discover and create routes on the map, filtered by activity type
- **Full profile** — personal records, badges, streaks, monthly charts and gear
- **Health** — synchronisation with Apple Health (iOS) and Health Connect (Android)
- **Push notifications** — motivation and training reminders
- **Internationalisation** — Portuguese and English
- **Authentication** — email/password, Google and Apple Sign-In

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Expo](https://expo.dev) SDK 57 / React Native 0.86 |
| Navigation | [Expo Router](https://expo.github.io/router) (file-based) |
| Backend | [Supabase](https://supabase.com) (auth, database, storage) |
| State | [Zustand](https://zustand-demo.pmnd.rs) |
| Queries | [TanStack Query](https://tanstack.com/query) |
| Maps | [Mapbox](https://www.mapbox.com) via `@rnmapbox/maps` |
| Typography | Barlow + Barlow Condensed + DM Mono |
| Analytics | [PostHog](https://posthog.com) |

## Requirements

- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- A [Supabase](https://supabase.com) account
- A [Mapbox](https://www.mapbox.com) account
- Xcode (for iOS) or Android Studio (for Android)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_MAPBOX_TOKEN=pk.<token>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_POSTHOG_KEY=<posthog-key>
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 3. Supabase database

Make sure the following tables exist in your Supabase project:

- `profiles` — user data
- `activities` — recorded activities
- `training_plans` — weekly training plans
- `routes` — created routes
- `equipment` — the user's gear

The RLS policies must allow each user to read and write their own data.

## Development

```bash
# Start the Metro server
npm start

# iOS (simulator)
npm run ios

# Android (emulator)
npm run android
```

## Tests

```bash
npm test              # run everything once
npm run test:watch    # watch mode
npm run test:coverage # with a coverage report
npm run typecheck     # tsc --noEmit
```

They run on [jest-expo](https://docs.expo.dev/develop/unit-testing/) and cover
pure logic and services — calculations (splits, calories, pace, unit
conversion), the offline sync queue, the privacy zones and the training plan
generators. No test touches the network, the disk or the real Supabase: the
Supabase client, `expo-file-system` and `AsyncStorage` are all replaced by
doubles in `src/test-utils/`.

Conventions:

- Tests live next to the code, with the `.test.ts` suffix.
- `src/test-utils/` holds the shared helpers (it is not picked up by the runner).
  - `supabaseMock.ts` — a chainable query builder; lets you pin the response and
    assert that the right filter was applied.
  - `fileSystemMock.ts` — an in-memory file system.
  - `geoFixtures.ts` / `activityFixtures.ts` — GPS traces and activities.
- The synthetic traces run along a meridian, where the haversine formula reduces
  to `R × Δlatitude` — that gives exact distances, which lets us assert "this
  split is 1000 m" without depending on rounding.

A note on dependencies: `jest-expo@57.0.3` asks for
`@react-native/jest-preset@^0.86.2` while `react-native@0.86.0` pins `0.86.0`.
The conflict is resolved with an `overrides` entry in `package.json`, so there
is no need to install with `--legacy-peer-deps`.

## Building for distribution

```bash
# Android APK for testers (no Play Store)
eas build --platform android --profile preview

# iOS for testers (TestFlight)
eas build --platform ios --profile preview

# Production
eas build --platform all --profile production
```

## Project structure

```
src/
├── app/                  # Routes (Expo Router)
│   ├── (auth)/           # Sign-in, sign-up, onboarding
│   ├── (tabs)/           # Main tabs: Today, Feed, Record, Routes, Profile
│   ├── activity/         # Activity detail
│   ├── profile/          # Profile, editing, gear, settings
│   └── map/              # Route creation
├── components/           # Reusable components
├── hooks/                # Custom hooks
├── services/             # Supabase, auth, activities, maps
├── store/                # Zustand stores
├── lib/                  # Constants, themes, types, i18n
├── test-utils/           # Doubles and fixtures used by the tests
└── utils/                # Utilities (formatting, calculations)
```

## Google authentication

For Google Sign-In to work:

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com)
2. Add a Web OAuth client with the callback: `https://<project>.supabase.co/auth/v1/callback`
3. Add an iOS OAuth client with the bundle ID: `com.akcelgraca.cadence`
4. In Supabase, enable the Google provider under **Authentication → Providers**
5. Under **Authentication → URL Configuration**, add `cadence://` to the Redirect URLs

## Licence

Private — all rights reserved.
