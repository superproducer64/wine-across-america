# Pour Across America — LLM Project Context

> Share this file with any LLM to give it full working knowledge of this codebase.  
> Last updated: April 27, 2026

---

## 1. Project Overview

**Pour Across America** is a professional wine tasting journal and intelligence app.

- **Platform**: iOS (primary, TestFlight via EAS Build) + Web (port 5000)
- **Framework**: React Native with Expo SDK 51
- **Language**: TypeScript (strict)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State**: Zustand
- **Navigation**: React Navigation v6 (Native Stack + Bottom Tabs)
- **Entry point**: `index.js` → `App.tsx` → `src/navigation/RootNavigator.tsx`
- **Path alias**: `@/` → `./src/`
- **Bundle ID**: `com.pouracrossamerica.app`

---

## 2. Design System

### Colors (`src/theme/index.ts`)
```ts
Colors = {
  gold: '#C4847A',         // primary accent — buttons, active states, borders
  goldLight: '#E8C4BC',    // lighter gold
  goldPale: '#FDF0ED',     // pale gold background tint
  ink: '#1F1518',          // primary text
  inkMid: '#2A1A1A',       // secondary text
  inkMuted: '#5A4040',     // muted text
  inkFaint: '#B8AAAA',     // placeholder / disabled
  surface: '#FDFBFA',      // main background
  surfaceAlt: '#F7F0EE',   // cards / inputs
  border: 'rgba(196,132,122,0.25)',
  borderStrong: 'rgba(196,132,122,0.5)',
  red: '#8B2E2E',
  green: '#2E6B45',
  blue: '#2E4E8B',
}
```

### Typography (`src/theme/index.ts`)
```ts
Fonts = {
  playfair: 'PlayfairDisplay_400Regular',         // headings
  playfairItalic: 'PlayfairDisplay_400Regular_Italic',
  playfairSemiBold: 'PlayfairDisplay_600SemiBold',
  dmSans: 'DMSans_300Light',                      // body light
  dmSansRegular: 'DMSans_400Regular',             // body regular
  dmSansMedium: 'DMSans_500Medium',               // body medium/labels
}
```

### Spacing
```ts
Spacing = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32, huge:48 }
Radius  = { sm:4, md:6, lg:12, xl:20, full:9999 }
```

### Rules
- **No `Alert.alert()`** — inline banners only (red or green)
- All components use `StyleSheet.create()` — no inline style objects where avoidable
- Responsive via `useResponsive` hook: phone < 600px, tablet 600–1023px, desktop ≥ 1024px
- Sidebar width: `SIDEBAR_WIDTH = 220`, max content width: `MAX_CONTENT_WIDTH = 720`

---

## 3. Navigation Structure

```
RootNavigator (Native Stack)
├── Auth (AuthNavigator — Native Stack)
│   ├── Login
│   └── Signup
└── Main (MainNavigator — Native Stack wrapping Tabs + modals)
    ├── Tabs (Bottom Tab / adaptive sidebar on wide screens)
    │   ├── Home
    │   ├── Search
    │   ├── AddEntry  (opens WineEntryScreen)
    │   └── Settings
    ├── WineDetail    { entryId: string }
    ├── SharedWineDetail  { snapshot, senderName }
    ├── Comparison
    └── Admin
```

**File**: `src/navigation/types.ts` — all param list types  
**File**: `src/navigation/MainNavigator.tsx` — adaptive sidebar logic  
**File**: `src/navigation/RootNavigator.tsx` — auth session bootstrap + `usePushNotifications` hook

---

## 4. Data Models

### `WineEntry` (`src/types/index.ts`)
```ts
interface WineEntry {
  id: string;
  user_id: string;

  // Basics (Step 1)
  name: string;
  producer: string;
  vintage: number | null;
  country: string;
  region: string;
  appellation: string;
  grapes: string[];                         // legacy flat list
  grape_blends: GrapeBlendEntry[] | null;   // structured { name, percentage }
  price: PriceEntry[];                      // array supports glass + bottle
  tasting_date: string;                     // YYYY-MM-DD
  location_name: string;
  location_geo: { lat: number; lng: number } | null;

  // Structure Wheel (Step 2) — 1-10 sliders
  acidity: number;
  tannin: number;
  body: number;
  alcohol: number;
  intensity: number;
  finish_length: number;

  // Technical Score (Step 4) — 0-20 each, sum = technical_score (0-100)
  score_balance: number;
  score_intensity: number;
  score_complexity: number;
  score_finish: number;
  score_typicity: number;
  technical_score: number;    // computed = sum of score_* fields × 1

  // Aromas (Step 3)
  aromas_l1: string[];             // category IDs (e.g. 'citrus', 'floral')
  aromas_l2: string[];             // specific notes (e.g. 'Lemon', 'Violet')
  aromas_other_note: string | null; // free-form text under the "Other" category

  // Notes (Step 5)
  free_notes: string;
  tags: string[];
  want_another_glass: boolean;
  want_to_buy: boolean;

  // Terroir (Step 5 — Sommelier only)
  terroir_soil: 'limestone'|'volcanic'|'granite'|'clay'|'sand' | null;
  terroir_climate: 'cool'|'moderate'|'warm' | null;
  terroir_visible: boolean;

  // Signature Score (creator/admin only)
  sig_sense_of_place: number | null;   // 0-20
  sig_story: number | null;
  sig_viticulture: number | null;
  sig_structure: number | null;
  sig_enjoyment: number | null;
  signature_score: number | null;      // computed

  label_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

// Draft omits computed/server fields:
type WineEntryDraft = Omit<WineEntry, 'id'|'user_id'|'technical_score'|'signature_score'|'created_at'|'updated_at'>;
```

### `PriceEntry`
```ts
interface PriceEntry {
  amount: number;
  currency: string;
  date: string;
  location: string;
  type?: 'glass' | 'bottle';   // undefined = legacy untyped (treated as bottle)
}
```

### `GrapeBlendEntry`
```ts
interface GrapeBlendEntry {
  name: string;
  percentage: number | null;
}
```

### `UserProfile` (Supabase table: `user_profiles`)
```ts
interface UserProfile {
  id: string;                  // = auth.users.id
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;         // gates admin panel access (set via SQL)
  user_role: 'enthusiast' | 'sommelier';
  sommelier_cert_url: string | null;
  sommelier_status: 'pending' | 'approved' | 'rejected' | null;
  sommelier_rejection_reason: string | null;  // set by admin on rejection
  push_token: string | null;   // Expo push token for notifications
  created_at: string;
}
```

---

## 5. Supabase Schema

### Tables
| Table | Purpose |
|-------|---------|
| `user_profiles` | Extended user data, roles, sommelier status |
| `wine_entries` | All wine tasting records |
| `shared_wines` | Wine sharing inbox — snapshot JSON + sender/recipient |

### Key `user_profiles` Columns
| Column | Type | Notes |
|--------|------|-------|
| `is_creator` | `boolean` | Set to `true` via SQL for admins |
| `user_role` | `text` | `'enthusiast'` (default) or `'sommelier'` |
| `sommelier_status` | `text` | `'pending'`, `'approved'`, `'rejected'` |
| `sommelier_rejection_reason` | `text` | Optional rejection explanation shown to user |
| `push_token` | `text` | Expo push token, saved on app open |

### Key `wine_entries` Columns
| Column | Type | Notes |
|--------|------|-------|
| `aromas_other_note` | `text` | Free-form "other" aroma note |
| `price` | `jsonb` | Array of `PriceEntry` objects |
| `grape_blends` | `jsonb` | Array of `GrapeBlendEntry` or null |

### RLS Policies (current, clean — no recursion)
```sql
-- user_profiles: all authenticated users can read all profiles
SELECT USING (true)  -- "authenticated read all profiles"

-- user_profiles: all authenticated users can update (admin gating in app layer)
UPDATE USING (true)  -- "authenticated update profiles"

-- user_profiles: allow client-side profile creation on signup
INSERT WITH CHECK (true)  -- "user_profiles_insert"
```

**Critical RLS notes:**
- The `postgres` role in Supabase Cloud does **NOT** bypass RLS
- Self-referencing policies (policy on table X queries table X) cause infinite recursion — use `USING (true)` instead
- `SECURITY DEFINER` trigger functions owned by `postgres` are still subject to RLS

### Storage Buckets
| Bucket | Access | Purpose |
|--------|--------|---------|
| `sommelier-certs` | Private (signed URLs, 1hr) | Sommelier certification images |
| `wine-labels` | Public | Label photos uploaded during entry |

---

## 6. Authentication

### Flow
1. `signUpWithEmail()` → `supabase.auth.signUp()` → on success, call `getSession()` then upsert `user_profiles`
2. `signInWithEmail()` → standard email/password
3. `signInWithApple()` → nonce generated via `expo-crypto` SHA-256 → `supabase.auth.signInWithIdToken(provider: 'apple')`
4. Session stored via `expo-secure-store` on native, `localStorage` on web
5. `RootNavigator` bootstraps session on mount and listens to `onAuthStateChange`

### Profile Load
- `authStore.loadProfile()` retries up to 3× with 1 s gaps
- Guards the race where `SIGNED_IN` fires before client-side upsert completes

### Email Confirmation
- **Disabled** in Supabase — `data.session` is always non-null after `signUp()`

---

## 7. Key Functions (`src/lib/supabase.ts`)

### Auth
| Function | Signature | Description |
|----------|-----------|-------------|
| `signInWithEmail` | `(email, password)` | Standard sign-in |
| `signUpWithEmail` | `(email, password, displayName, role?)` | Sign up + profile upsert |
| `signInWithApple` | `(identityToken, rawNonce, displayName?)` | Apple OAuth sign-in |
| `generateAppleNonce` | `()` → `{ rawNonce, hashedNonce }` | SHA-256 nonce pair |
| `signOut` | `()` | Sign out |

### Wine CRUD
| Function | Signature | Description |
|----------|-----------|-------------|
| `createWineEntry` | `(entry)` | Insert new entry |
| `updateWineEntry` | `(id, updates)` | Partial update |
| `deleteWineEntry` | `(id)` | Delete entry |
| `getWineEntry` | `(id)` | Fetch single entry |
| `listWineEntries` | `(userId, options?)` | Paginated list (default 20/page) |
| `searchWineEntries` | `(userId, query, filters?)` | Full-text + filter search |

### User Profiles
| Function | Description |
|----------|-------------|
| `getUserProfile(userId)` | Fetch profile |
| `updateUserProfile(userId, updates)` | Partial update |
| `searchUserByEmail(email)` | Used for wine sharing recipient lookup |

### Sommelier System
| Function | Description |
|----------|-------------|
| `uploadSommelierCert(userId, imageDataUrl)` | Upload cert to `sommelier-certs` bucket |
| `submitSommelierApplication(userId, certUrl, applicantName?)` | Set role/status to pending, fires push notification |
| `fetchPendingSommelierApplications()` | Admin: list pending |
| `updateSommelierStatus(userId, decision, rejectionReason?)` | Admin: approve or reject |
| `getSommelierCertSignedUrl(certUrl)` | 1-hour signed URL for private cert image |
| `getPendingSommelierCount()` | Admin badge count |

### Push Notifications
| Function | Description |
|----------|-------------|
| `savePushToken(userId, token)` | Upsert Expo push token to profile |
| `notifyAdminsOfNewApplication(applicantName)` | Fetch all `is_creator=true` tokens, POST to Expo Push API |

### Sharing
| Function | Description |
|----------|-------------|
| `shareWineWithUser(senderId, senderName, recipientId, snapshot)` | Insert into `shared_wines` |
| `getSharedWithMe(userId)` | Fetch recipient's inbox |
| `markShareSeen(shareId)` | Mark as read |

### Label Photos
| Function | Description |
|----------|-------------|
| `uploadLabelPhoto(userId, imageDataUrl)` | Upload to `wine-labels` bucket |

---

## 8. Zustand Stores

### `authStore` (`src/stores/authStore.ts`)
```ts
{ session, user, profile, loading }
{ setSession, loadProfile, updateProfile }
```
- `loadProfile()` retries 3× / 1s gap
- `setSession()` triggers `loadProfile()` when session is set

### `wineStore` (`src/stores/wineStore.ts`)
```ts
{ entries, totalCount, loading, loadingMore, hasMore, currentPage, searchResults, searching }
{ loadEntries, loadMore, addEntry, updateEntry, removeEntry, search, clearSearch }
```
- `addEntry()` computes `technical_score = sum of 5 score fields` before insert
- Pagination: 20 per page
- Free tier limit constant: `FREE_TIER_LIMIT = 30`

### `entryDraftStore` (`src/stores/entryDraftStore.ts`)
```ts
{ draft: WineEntryDraft, currentStep: number }
{ setBasics, setStructureWheel, setAromas, setAromasOtherNote,
  setTechnicalScore, setNotesAndTerroir, setGrapeBlends, setLabelPhoto,
  setStep, reset, loadForEdit }
```


---

## 9. Wine Entry Flow (5 Steps)

| Step | File | What it captures |
|------|------|-----------------|
| 1 — Basics | `Step1Basics.tsx` | Name, producer, vintage, country, region, appellation, grape blends, price (glass/bottle pill), tasting date (calendar), location |
| 2 — Structure Wheel | `Step2StructureWheel.tsx` | Acidity, Tannin, Body, Alcohol, Intensity, Finish Length (1-10 sliders) |
| 3 — Aromas | `Step3Aromas.tsx` | L1 categories + L2 specific notes + "Other" free-form text |
| 4 — Technical Score | `Step4TechnicalScore.tsx` | Balance, Intensity, Complexity, Finish, Typicity (0-20 each) |
| 5 — Notes & Terroir | `Step5NotesAndTerroir.tsx` | Free notes, tags, want-another-glass, want-to-buy, terroir (Sommelier only) |

**Container**: `src/screens/entry/WineEntryScreen.tsx` — step state machine, progress dots, submit

---

## 10. Key UI Components

### Shared (`src/components/ui/`)
| Component | Description |
|-----------|-------------|
| `Button` | Variants: default (gold), destructive (red), ghost, outline |
| `TextInput` | With show/hide password toggle when `secureTextEntry` is passed |
| `DatePickerInput` | Custom calendar modal, returns `YYYY-MM-DD`, marks today with ring, selected with gold fill |
| `Badge` | Count badge, used for unread/pending counts |
| `ScoreSlider` | Used in structure wheel and technical score steps |

### Wine (`src/components/wine/`)
| Component | Description |
|-----------|-------------|
| `WineListItem` | Row in history list — name, score pill, vintage, producer |
| `WineIdentityCard` | Full card with label photo, scores, grape pills |
| `VivinoStyleCard` | Vivino-inspired card with rating, flavor bars, food pairings |
| `ProWineCard` | Pentagon radar chart, aroma bars, score circle, "Best Value" badge |
| `WineComparisonCard` | Side-by-side VS layout for Comparison screen |
| `LabelScannerModal` | GPT-4o Vision label scan, auto-fills Step 1 fields |
| `GrapeBlendInput` | Repeating rows for grape name + percentage, validated |
| `ShareWithUserModal` | Search user by email, share wine snapshot |
| `WineRadarChart` | SVG radar/pentagon chart |
| `AromaProfileBars` | Horizontal bar chart per aroma category |
| `TechnicalScoreDisplay` | Score breakdown display |
| `TerriorBadge` | Pill badge for soil/climate |

---

## 11. Aroma System

### 14 L1 Categories (IDs used in `aromas_l1`)
`citrus`, `tree-fruit`, `tropical`, `red-fruit`, `dark-fruit`, `dried-fruit`,  
`floral`, `herbaceous`, `earthy`, `mineral`, `oak-spice`, `savory`, `sweet-baking`, `other`

### Quick Shortcuts (preset category sets)
| Label | Applies |
|-------|---------|
| Crisp white | citrus, mineral, herbaceous |
| Rich white | tree-fruit, oak-spice, sweet-baking |
| Light red | red-fruit, floral, earthy |
| Bold red | dark-fruit, oak-spice, savory |
| Sparkling | citrus, floral, mineral |

### "Other" Free-Form
- When "Other" is selected and expanded, a multiline text input appears below the subcategory chips
- Stored as `aromas_other_note` (text column on `wine_entries`)
- Displayed in the summary card with ✨ prefix

---

## 12. Two-Tier User System

### Enthusiast (default)
- All wine entry steps
- History, search, sharing
- 30-entry free tier limit

### Sommelier (applied + admin-approved)
- All Enthusiast features
- Terroir fields in Step 5 (soil type, climate)
- "Verified Sommelier" gold badge on profile
- Application flow: upload Level 3 cert image → `sommelier_status = 'pending'` → admin reviews

### Application States
| `sommelier_status` | Badge shown | User can |
|-------------------|-------------|----------|
| `null` | None | Apply |
| `'pending'` | Yellow "Pending Review" | Wait |
| `'approved'` | Gold "Verified" | Use terroir fields |
| `'rejected'` | Red "Not Approved" | See rejection reason, reapply |

### Files
- `src/screens/settings/SettingsScreen.tsx` — application upload form, status display, rejection reason card
- `src/components/auth/SommelierCertUpload.tsx` — cert image picker + upload
- `src/screens/admin/AdminScreen.tsx` — pending list, approve/reject with optional reason

---

## 13. Admin System

- Gated by `user_profiles.is_creator = true` (set via SQL, never through the UI)
- Badge on Account screen shows pending application count (refreshes on `useFocusEffect`)
- `AdminScreen` shows applicant name, email, submission date, cert image (signed URL)
- **Reject flow**: tap Reject → inline text form opens → "Confirm Rejection" sends reason
- Rejection reason stored in `sommelier_rejection_reason`, displayed to applicant in their Account screen
- **Approve**: instant, sets `user_role = 'sommelier'`, `sommelier_status = 'approved'`, clears rejection reason

---

## 14. Push Notifications

**Setup** (`src/hooks/usePushNotifications.ts`, called in `RootNavigator`):
1. Native only (skipped on web)
2. Requests `Notifications.requestPermissionsAsync()`
3. Gets `Notifications.getExpoPushTokenAsync({ projectId? })`
4. Calls `savePushToken(userId, token)` → stored in `user_profiles.push_token`

**Admin alerts** (`notifyAdminsOfNewApplication`):
- Called inside `submitSommelierApplication()` (fire-and-forget)
- Fetches all profiles where `is_creator = true AND push_token IS NOT NULL`
- POSTs batch to `https://exp.host/--/api/v2/push/send`
- Notification: title "🎓 New Sommelier Application", body includes applicant name

**Note**: Push notifications are native-only. They activate after EAS build is installed on a real device.

---

## 15. AI Label Scanning

- **Model**: GPT-4o Vision (`src/utils/wineOcr.ts`)
- **API key**: `EXPO_PUBLIC_OPENAI_API_KEY` (env secret)
- **Entry point**: `LabelScannerModal` component, opened from Step 1
- **Output**: `WineLabelData` — name, producer, vintage, country, region, appellation, grapes[]
- Auto-fills matching Step 1 fields; does not overwrite fields the user has already typed

---

## 16. EAS Build / iOS

- `eas.json` configured with `development`, `preview`, `production` profiles
- Bundle ID: `com.pouracrossamerica.app`
- `autoIncrement: true` on production
- Apple Sign In declared in `app.json` under `expo-apple-authentication` plugin
- **Submit section** in `eas.json` needs: `appleId`, `ascAppId`, `appleTeamId` (user fills in)
- `expo-notifications` plugin in `app.json` with gold accent color `#C4847A`

---

## 17. Pending SQL Migrations

Run these in the Supabase SQL editor if they haven't been applied yet:

```sql
-- Two-tier user system
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'enthusiast';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS sommelier_status TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS sommelier_cert_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_creator BOOLEAN NOT NULL DEFAULT false;

-- Admin rejection reason
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS sommelier_rejection_reason TEXT;

-- Push notifications
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Aromas other note
ALTER TABLE public.wine_entries ADD COLUMN IF NOT EXISTS aromas_other_note TEXT;

-- Promote a user to admin
UPDATE public.user_profiles SET is_creator = true WHERE email = 'your@email.com';
```

---

## 18. Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_OPENAI_API_KEY` | GPT-4o Vision for label scanning |

---

## 19. File Map (Key Files)

```
App.tsx                          — fonts, splash, GestureHandler root
src/
  lib/supabase.ts                — ALL Supabase calls + auth helpers
  theme/index.ts                 — Colors, Fonts, Spacing, Radius, Shadows
  types/index.ts                 — WineEntry, UserProfile, Aromas, all constants
  navigation/
    RootNavigator.tsx            — session bootstrap, push hook
    MainNavigator.tsx            — adaptive sidebar + tab/stack
    types.ts                     — all param lists
  stores/
    authStore.ts                 — session, profile, retry logic
    wineStore.ts                 — CRUD, pagination, search
    entryDraftStore.ts           — 5-step draft state machine
  screens/
    auth/LoginScreen.tsx         — email login + Apple Sign In (iOS)
    auth/SignupScreen.tsx        — email signup + cert upload for sommelier
    home/HomeScreen.tsx          — wine history list + shared-with-me badge
    search/SearchScreen.tsx      — search + filter
    detail/WineDetailScreen.tsx  — full wine view + edit + share
    entry/WineEntryScreen.tsx    — step container
    entry/steps/Step1Basics.tsx  — basics + price pill + calendar + GPT scan
    entry/steps/Step2StructureWheel.tsx
    entry/steps/Step3Aromas.tsx  — L1/L2 chips + "Other" free-form text
    entry/steps/Step4TechnicalScore.tsx
    entry/steps/Step5NotesAndTerroir.tsx
    settings/SettingsScreen.tsx  — profile, sommelier apply, admin badge
    admin/AdminScreen.tsx        — approve/reject + rejection reason form
    comparison/ComparisonScreen.tsx
  components/
    ui/Button.tsx
    ui/TextInput.tsx             — with show/hide password toggle
    ui/DatePickerInput.tsx       — custom calendar modal
    ui/Badge.tsx
    ui/ScoreSlider.tsx
    wine/ProWineCard.tsx         — pentagon radar + score circle
    wine/VivinoStyleCard.tsx
    wine/LabelScannerModal.tsx   — GPT-4o label scan
    wine/GrapeBlendInput.tsx     — structured grape % entry
    wine/WineComparisonCard.tsx
    wine/ShareWithUserModal.tsx
    auth/SommelierCertUpload.tsx
  hooks/
    useResponsive.ts             — breakpoints, isWide, SIDEBAR_WIDTH
    usePushNotifications.ts      — permission + token registration
  utils/
    wineOcr.ts                   — GPT-4o Vision call + response parsing
    foodPairings.ts
    profileText.ts
    imagePlaceholder.ts
```

---

## 20. Known Constraints & Gotchas

| Topic | Note |
|-------|------|
| RLS recursion | Never write a policy on `user_profiles` that subqueries `user_profiles` — use `USING (true)` |
| `postgres` role | Does NOT bypass RLS in Supabase cloud |
| Email confirmation | Disabled — session is always non-null after signup |
| Profile creation | Client-side only after signup; server trigger is a no-op |
| Push notifications | Native only — not available in Expo web build |
| Apple Sign In | iOS only — button hidden on web |
| `aromas_other_note` | Only appears when "Other" (id: `'other'`) is selected AND expanded |
| Price entries | Array supports both glass and bottle simultaneously; legacy untyped entries treated as bottle |
| `tasting_date` | Stored as `YYYY-MM-DD`; `DatePickerInput` appends `T12:00:00` on parse to avoid UTC offset day shifts |
| Free tier limit | 30 entries; enforced in `wineStore.addEntry()` — `FREE_TIER_LIMIT = 30` |
| Signed cert URLs | 1-hour expiry; re-fetched each time `AdminScreen` mounts |
