# Pour Across America

A professional wine tasting journal and intelligence app built with React Native (Expo) and Supabase.

## Key Features

- Multi-step wine entry flow (basics, structure, aromas, notes)
- **AI label scanning**: GPT-4o Vision auto-fills wine details from a label photo
- **ProWineCard**: Pentagon radar chart (Acidity/Body/Alcohol/Tannin/Intensity), aroma profile bars, score circle, "Best Value" badge — matching the reference design
- **Wine Comparison Mode**: Pick 2 wines from your history to compare side-by-side with VS. layout and score comparison bar
- Vivino-style wine card with ratings, flavor bars, food pairings, grape pills
- Share wine cards via native share sheet or in-app user sharing
- "Shared with Me" inbox with unread badge on HomeScreen
- Wine history, search, and filtering

## Tech Stack

- **Framework**: React Native with Expo SDK 51
- **Language**: TypeScript
- **Backend/Database**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: Zustand
- **Navigation**: React Navigation (Native Stack + Bottom Tabs, adaptive sidebar on tablet/desktop)
- **Charts**: react-native-svg (custom RadarChart)
- **Styling**: React Native StyleSheet with centralized theme
- **Responsive**: `useResponsive` hook in `src/hooks/useResponsive.ts`; breakpoints: phone < 600, tablet 600–1023, desktop ≥ 1024

## Project Structure

```
src/
  components/   # Reusable UI components
    charts/     # RadarChart, AromaProfileBars
    ui/         # Button, TextInput, Badge, ResponsiveContainer
    wine/       # WineIdentityCard, StyleSummaryBar, SkeletonWineListItem
  hooks/        # useResponsive (breakpoints, isPhone/isTablet/isDesktop/isWide)
  lib/          # supabase.ts client setup
  navigation/   # RootNavigator, AuthNavigator, MainNavigator (adaptive sidebar)
  screens/      # Auth, Home, Search, Detail, Entry, Settings, Comparison
  stores/       # Zustand stores: auth, wine, entryDrafts
  theme/        # Colors, Typography, Spacing
  types/        # TypeScript interfaces
  utils/        # Helper functions
supabase/
  migrations/   # SQL migration files
  seed.sql      # Seed data
assets/         # App icons and splash screen images
```

## Running the App

The app runs in web mode via Expo Metro bundler on port 5000.

**Workflow**: "Start application" - runs `npx expo start --web --port 5000`

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

## Key Features

- Multi-step wine entry flow (Basics, Structure, Aromas, Technical Score, Notes)
- Technical scoring algorithm based on balance, intensity, complexity, finish, typicity
- Aroma profiling with radar chart visualization
- Offline-ready auth with secure token persistence

## Two-Tier User System

- **Enthusiast** (default): standard wine logging, scoring, sharing
- **Sommelier** (applied, admin-approved): unlocks terroir fields in Step 5, verified badge
- `user_role`, `sommelier_status`, `sommelier_cert_url` columns on `user_profiles` (via `002_user_roles.sql`)
- Cert images stored in private `sommelier-certs` Supabase Storage bucket
- Admin approves by setting `sommelier_status = 'approved'` in Supabase dashboard

## Supabase Auth / RLS Notes

- Email confirmation is **disabled** — `data.session` is always non-null after `signUp()`
- **Trigger**: `on_auth_user_created` on `auth.users` calls `public.handle_new_user()` — currently a **no-op** (`RETURN NEW` only). Profile is created client-side after signup.
- **Profile creation**: `signUpWithEmail()` in `src/lib/supabase.ts` upserts `user_profiles` immediately after `auth.signUp()`. Calls `getSession()` first to ensure the session is committed to memory before the DB call (guards a React Native async-storage race).
- **Profile load retry**: `authStore.loadProfile()` retries up to 3× with 1 s gaps — guards the race where `SIGNED_IN` event fires before the upsert completes.
- **Key RLS policies on `user_profiles`**: `user_profiles_insert WITH CHECK (true)` (public role) allows the client-side upsert; `user_profiles_self_update USING (auth.uid() = id)` allows own-profile edits.
- **Sommelier cert storage policies**: `users can upload sommelier certs` and `users can view sommelier certs` on `storage.objects` scoped to `sommelier-certs` bucket.
- **`postgres` role in Supabase cloud is NOT a true superuser** — SECURITY DEFINER functions owned by `postgres` do NOT bypass RLS. Use permissive INSERT policies instead of relying on trigger ownership.

## Notes

- The app uses React Navigation (not Expo Router) with `src/` directory structure
- Entry point is `index.js` → `App.tsx` → `RootNavigator`
- Path alias `@/` maps to `./src/`
- Supabase client gracefully falls back to placeholder values when env vars are missing
