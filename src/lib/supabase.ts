import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
// expo-file-system's stable API changed shape in SDK 54 (expo-file-system/next
// became the default). Importing the /legacy subpath keeps readAsStringAsync +
// EncodingType.Base64 working exactly as before without touching call sites.
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Platform } from 'react-native';

// ─── Secure Storage Adapter ───────────────────────────────────────────────────

const ExpoSecureStoreAdapter = {
  getItem: (key: string): string | null | Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): void | Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string): void | Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// ─── Supabase Client ──────────────────────────────────────────────────────────

// These are EXPO_PUBLIC_ values — already public by definition (baked into the JS bundle).
// Hardcoded here to bypass EAS environment variable conflicts that cause "Network request failed".
const supabaseUrl = 'https://wldcernnxtzhkpqfjamk.supabase.co';
const supabaseAnonKey = 'sb_publishable_corJZoELDMUijew3Tf4P4g_b-B5jLuA';


const createSupabaseClient = () => {
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (e) {
    console.warn('Supabase client could not be initialized.');
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
};

export const supabase = createSupabaseClient();

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

// ─── Apple Sign In ────────────────────────────────────────────────────────────

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function generateAppleNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const rawNonce = generateRandomString(32);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );
  return { rawNonce, hashedNonce };
}

export async function signInWithApple(
  identityToken: string,
  rawNonce: string,
  displayName?: string | null
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce: rawNonce,
  });

  if (error) return { error: error.message };

  if (data.session && data.user) {
    await supabase.auth.getSession();

    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', data.user.id)
      .single();

    if (!existingProfile) {
      const { error: upsertError } = await supabase.from('user_profiles').upsert({
        id: data.user.id,
        email: data.user.email ?? '',
        display_name: displayName ?? null,
        user_role: 'enthusiast',
        subscription_tier: 'free',
        is_creator: false,
      });
      if (upsertError) {
        console.error('[signInWithApple] profile upsert failed:', upsertError.message);
      }
    }
  }

  return { error: null };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  userRole: 'enthusiast' | 'sommelier' = 'enthusiast'
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, user_role: userRole },
    },
  });
  if (error) throw error;

  // When email confirmation is disabled the session is available immediately.
  // Create the profile from the client using the authenticated session.
  // The server-side trigger is a no-op; this is the sole profile creation path.
  if (data.session && data.user) {
    // Call getSession() first to ensure the Supabase client has fully committed
    // the new session to its in-memory state before making authenticated DB calls.
    // This guards against a React Native timing issue with async SecureStore.
    await supabase.auth.getSession();

    const { error: profileError } = await supabase.from('user_profiles').upsert(
      {
        id: data.user.id,
        email: data.user.email ?? email,
        display_name: displayName,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (profileError) {
      console.error('[signup] profile upsert error:', JSON.stringify(profileError));
      throw new Error(profileError.message);
    }
  }

  return data;
}

export async function signOut() {
  return supabase.auth.signOut();
}

// ─── Password Recovery ────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'pouracrossamerica://reset-password',
  });
  // Intentionally not surfaced to the caller for unknown-email cases — the
  // screen shows a generic confirmation regardless, to avoid leaking whether
  // an account exists. Only used for logging here.
  if (error) {
    console.warn('[requestPasswordReset]', error.message);
  }
  return { error: error?.message ?? null };
}

export async function setRecoverySession(
  accessToken: string,
  refreshToken: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return { error: error?.message ?? null };
}

export async function updateUserPassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message ?? null };
}

// ─── Account Deletion ─────────────────────────────────────────────────────────

export async function deleteOwnAccount(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('delete_own_account');
  return { error: error?.message ?? null };
}

// ─── Invites ──────────────────────────────────────────────────────────────────

// Excludes 0/O and 1/I/L — avoids ambiguity when a code is read off a shared
// text message rather than tapped as a link.
const INVITE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateInviteCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

export async function createInvite(inviterId: string): Promise<{ code: string | null; error: string | null }> {
  // `code` is unique-constrained; retry a few times on the astronomically
  // unlikely chance of a collision rather than fail outright.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    const { error } = await supabase.from('invites').insert({ inviter_id: inviterId, code });
    if (!error) return { code, error: null };
    if (error.code !== '23505') return { code: null, error: error.message };
  }
  return { code: null, error: 'Could not generate a unique invite code. Please try again.' };
}

export async function validateInviteCode(code: string): Promise<{ valid: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from('invite_lookup')
    .select('code')
    .eq('code', code)
    .maybeSingle();
  if (error) return { valid: false, error: error.message };
  return { valid: !!data, error: null };
}

export async function redeemInvite(code: string): Promise<{ inviterId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('redeem_invite', { invite_code: code });
  if (error) return { inviterId: null, error: error.message };
  return { inviterId: (data as string | null) ?? null, error: null };
}

// ─── Wine Entry CRUD ──────────────────────────────────────────────────────────

export async function createWineEntry(entry: Omit<Parameters<typeof supabase.from>[0] extends 'wine_entries' ? never : object, never>) {
  return supabase.from('wine_entries').insert(entry).select().single();
}

export async function findRecentWineEntry(userId: string, name: string, withinMs = 30_000) {
  const cutoff = new Date(Date.now() - withinMs).toISOString();
  return supabase
    .from('wine_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('name', name)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
}

export async function updateWineEntry(id: string, updates: Record<string, unknown>) {
  return supabase.from('wine_entries').update(updates).eq('id', id).select().single();
}

export async function deleteWineEntry(id: string) {
  return supabase.from('wine_entries').delete().eq('id', id);
}

export async function getWineEntry(id: string) {
  return supabase.from('wine_entries').select('*').eq('id', id).single();
}

export async function listWineEntries(userId: string, options?: {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
  filters?: Record<string, unknown>;
}) {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const query = supabase
    .from('wine_entries')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order(options?.orderBy ?? 'created_at', { ascending: options?.ascending ?? false })
    .range(offset, offset + limit - 1);

  return query;
}

export async function searchWineEntries(userId: string, searchQuery: string, filters?: {
  minScore?: number;
  maxScore?: number;
  country?: string;
  region?: string;
  terroir_soil?: string[];
  maxPrice?: number;
}) {
  let query = supabase
    .from('wine_entries')
    .select('*')
    .eq('user_id', userId);

  if (searchQuery) {
    // Search across text fields; aromas_other_note covers user-written free notes
    query = query.or(
      `name.ilike.%${searchQuery}%,producer.ilike.%${searchQuery}%,region.ilike.%${searchQuery}%,country.ilike.%${searchQuery}%,aromas_other_note.ilike.%${searchQuery}%,free_notes.ilike.%${searchQuery}%`
    );
  }

  if (filters?.minScore !== undefined) {
    query = query.gte('technical_score', filters.minScore);
  }
  if (filters?.maxScore !== undefined) {
    query = query.lte('technical_score', filters.maxScore);
  }
  if (filters?.country) {
    query = query.eq('country', filters.country);
  }
  if (filters?.region) {
    query = query.eq('region', filters.region);
  }
  if (filters?.terroir_soil && filters.terroir_soil.length > 0) {
    query = query.contains('terroir_soil', filters.terroir_soil);
  }

  return query.order('created_at', { ascending: false });
}

// ─── Usage Insights (aggregate-only, derived from existing operational data) ───
// No new tracking/instrumentation is added here — this reads data the app
// already stores to function (signups, entries, shares) and aggregates it
// for the admin Insights dashboard. See migration 017 for the read policy.

export type UsageInsights = {
  totalUsers: number;
  usersWithAtLeastOneEntry: number;
  totalEntries: number;
  entriesLast7Days: number;
  entriesLast30Days: number;
  avgEntriesPerActiveUser: number;
  entriesWithPhoto: number;
  entriesWithNotes: number;
  entriesWithTerroir: number;
  customGrapeVarietiesAdded: number;
  proUsers: number;
  sommelierApproved: number;
  totalShares: number;
  sharesSeen: number;
  signupsLast30Days: number;
};

export async function fetchUsageInsights(): Promise<{ data: UsageInsights | null; error: string | null }> {
  try {
    const now = Date.now();
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profiles,
      entries,
      entriesLast7,
      entriesLast30,
      entriesWithPhoto,
      entriesWithNotes,
      entriesWithTerroir,
      customGrapes,
      shares,
      sharesSeen,
      signupsLast30,
    ] = await Promise.all([
      supabase.from('user_profiles').select('id, user_id:id, subscription_tier, user_role, sommelier_status', { count: 'exact' }),
      supabase.from('wine_entries').select('user_id', { count: 'exact' }),
      supabase.from('wine_entries').select('id', { count: 'exact', head: true }).gte('created_at', since7d),
      supabase.from('wine_entries').select('id', { count: 'exact', head: true }).gte('created_at', since30d),
      supabase.from('wine_entries').select('id', { count: 'exact', head: true }).not('label_photo_url', 'is', null),
      supabase.from('wine_entries').select('id', { count: 'exact', head: true }).not('free_notes', 'is', null),
      supabase.from('wine_entries').select('id', { count: 'exact', head: true }).not('terroir_soil', 'is', null),
      supabase.from('grape_varieties').select('id', { count: 'exact', head: true }).eq('is_custom', true),
      supabase.from('shared_wines').select('id', { count: 'exact', head: true }),
      supabase.from('shared_wines').select('id', { count: 'exact', head: true }).eq('seen', true),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', since30d),
    ]);

    const firstError = [
      profiles, entries, entriesLast7, entriesLast30, entriesWithPhoto,
      entriesWithNotes, entriesWithTerroir, customGrapes, shares, sharesSeen, signupsLast30,
    ].find((r) => r.error)?.error;

    if (firstError) {
      console.error('[fetchUsageInsights] error:', JSON.stringify(firstError));
      return { data: null, error: firstError.message };
    }

    const totalUsers = profiles.count ?? 0;
    const totalEntries = entries.count ?? 0;
    const uniqueActiveUsers = new Set((entries.data ?? []).map((e: { user_id: string }) => e.user_id));
    const usersWithAtLeastOneEntry = uniqueActiveUsers.size;
    const proUsers = (profiles.data ?? []).filter((p: { subscription_tier: string }) => p.subscription_tier === 'pro').length;
    const sommelierApproved = (profiles.data ?? []).filter(
      (p: { user_role: string; sommelier_status: string | null }) =>
        p.user_role === 'sommelier' && p.sommelier_status === 'approved'
    ).length;

    return {
      data: {
        totalUsers,
        usersWithAtLeastOneEntry,
        totalEntries,
        entriesLast7Days: entriesLast7.count ?? 0,
        entriesLast30Days: entriesLast30.count ?? 0,
        avgEntriesPerActiveUser: usersWithAtLeastOneEntry > 0 ? totalEntries / usersWithAtLeastOneEntry : 0,
        entriesWithPhoto: entriesWithPhoto.count ?? 0,
        entriesWithNotes: entriesWithNotes.count ?? 0,
        entriesWithTerroir: entriesWithTerroir.count ?? 0,
        customGrapeVarietiesAdded: customGrapes.count ?? 0,
        proUsers,
        sommelierApproved,
        totalShares: shares.count ?? 0,
        sharesSeen: sharesSeen.count ?? 0,
        signupsLast30Days: signupsLast30.count ?? 0,
      },
      error: null,
    };
  } catch (e) {
    console.error('[fetchUsageInsights] unexpected error:', e);
    return { data: null, error: e instanceof Error ? e.message : 'Failed to load insights' };
  }
}

export type UserActivitySummary = {
  user_id: string;
  display_name: string | null;
  wines_logged: number;
  last_tasting_date: string | null;
  last_active_at: string | null;
};

export async function fetchUserActivitySummary(): Promise<{ data: UserActivitySummary[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_activity_summary')
    .select('user_id, display_name, wines_logged, last_tasting_date, last_active_at');

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as UserActivitySummary[], error: null };
}

export type AppAdmin = {
  id: string;
  email: string;
  display_name: string | null;
};

export async function fetchAdmins(): Promise<{ data: AppAdmin[] | null; error: string | null }> {
  const { data: adminRows, error: adminError } = await supabase
    .from('app_admins')
    .select('user_id');

  if (adminError) {
    return { data: null, error: adminError.message };
  }

  const ids = (adminRows ?? []).map((r: { user_id: string }) => r.user_id);
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, display_name')
    .in('id', ids);

  if (profileError) {
    return { data: null, error: profileError.message };
  }

  return { data: (profiles ?? []) as AppAdmin[], error: null };
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(userId: string) {
  return supabase.from('user_profiles').select('*').eq('id', userId).single();
}

export async function updateUserProfile(userId: string, updates: Record<string, unknown>) {
  return supabase.from('user_profiles').update(updates).eq('id', userId).select().single();
}

// ─── Member Directory ──────────────────────────────────────────────────────────

export type MemberDirectoryEntry = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
  user_role: string;
  member_since: string;
};

export async function fetchMemberDirectory(): Promise<{ data: MemberDirectoryEntry[] | null; error: string | null }> {
  const { data, error } = await supabase.from('member_directory').select('*');

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as MemberDirectoryEntry[], error: null };
}

// ─── Sommelier Certification Upload ──────────────────────────────────────────

export async function uploadSommelierCert(
  userId: string,
  fileUri: string,
  mimeType?: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const buffer = await readUriAsArrayBuffer(fileUri);
    const resolvedMime =
      mimeType ??
      (fileUri.endsWith('.png') ? 'image/png' : fileUri.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    const ext =
      resolvedMime === 'image/png' ? 'png'
      : resolvedMime === 'application/pdf' ? 'pdf'
      : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('sommelier-certs')
      .upload(path, buffer, { contentType: resolvedMime, upsert: true });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('sommelier-certs').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e: unknown) {
    return { url: null, error: String(e) };
  }
}

export async function submitSommelierApplication(
  userId: string,
  certUrl: string,
  applicantName?: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      user_role: 'sommelier',
      sommelier_cert_url: certUrl,
      sommelier_status: 'pending',
    })
    .eq('id', userId);
  if (error) {
    console.error('[submitSommelierApplication] error:', JSON.stringify(error));
    return { error: error.message };
  }
  notifyAdminsOfNewApplication(applicantName ?? null);
  return { error: null };
}

// ─── Push Notifications ───────────────────────────────────────────────────────

export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({ push_token: token })
    .eq('id', userId);
}

export async function notifyAdminsOfNewApplication(
  applicantName: string | null
): Promise<void> {
  try {
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('push_token')
      .eq('is_creator', true)
      .not('push_token', 'is', null);

    if (!admins || admins.length === 0) return;

    const messages = admins
      .filter((a) => a.push_token)
      .map((a) => ({
        to: a.push_token,
        title: '🎓 New Sommelier Application',
        body: applicantName
          ? `${applicantName} has submitted their certification for review.`
          : 'A new certification is waiting for your review.',
        data: { screen: 'Admin' },
        sound: 'default',
      }));

    if (messages.length === 0) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.error('[notifyAdminsOfNewApplication]', e);
  }
}

// ─── Admin: Sommelier Applications ───────────────────────────────────────────

export async function getPendingSommelierCount(): Promise<number> {
  const { count } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('sommelier_status', 'pending');
  return count ?? 0;
}

export async function fetchPendingSommelierApplications() {
  return supabase
    .from('user_profiles')
    .select('id, email, display_name, sommelier_cert_url, sommelier_status, created_at')
    .eq('sommelier_status', 'pending')
    .order('created_at', { ascending: true });
}

export async function updateSommelierStatus(
  userId: string,
  decision: 'approved' | 'rejected' | 'needs_resubmission',
  rejectionReason?: string
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {
    sommelier_status: decision,
    // approved → elevate role; anything else → keep / revert to enthusiast
    user_role: decision === 'approved' ? 'sommelier' : 'enthusiast',
  };
  if ((decision === 'rejected' || decision === 'needs_resubmission') && rejectionReason?.trim()) {
    updates.sommelier_rejection_reason = rejectionReason.trim();
  }
  if (decision === 'approved') {
    updates.sommelier_rejection_reason = null;
  }
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);
  if (error) {
    console.error('[updateSommelierStatus] error:', JSON.stringify(error));
    return { error: error.message };
  }
  return { error: null };
}

export async function getSommelierCertSignedUrl(
  certUrl: string
): Promise<string | null> {
  try {
    const marker = '/sommelier-certs/';
    const idx = certUrl.indexOf(marker);
    if (idx === -1) return certUrl;
    const path = certUrl.slice(idx + marker.length);
    const { data, error } = await supabase.storage
      .from('sommelier-certs')
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch (err) {
    console.error('[supabase] getSignedCertUrl failed:', err);
    return null;
  }
}

// ─── Local File Upload Helpers ─────────────────────────────────────────────
// fetch(uri).blob() is unreliable for locally-picked files: on Android the
// picker can hand back a content:// URI that fetch() can't read at all
// ("Network request failed"), and on iOS it can resolve to an empty body
// ("No content provided" from storage). expo-file-system reads the bytes
// directly instead, which works for file://, content://, and data: URIs.
async function readUriAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (uri.startsWith('data:')) {
    const match = /^data:[^;]+;base64,(.*)$/s.exec(uri);
    if (!match) throw new Error('Malformed data URI');
    return decodeBase64(match[1]);
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return decodeBase64(base64);
}

async function localImageToArrayBuffer(uri: string): Promise<{ buffer: ArrayBuffer; ext: string; contentType: string }> {
  const buffer = await readUriAsArrayBuffer(uri);
  if (uri.startsWith('data:')) {
    const mime = /^data:([^;]+);base64,/.exec(uri)?.[1] ?? 'image/jpeg';
    return { buffer, ext: mime === 'image/png' ? 'png' : 'jpg', contentType: mime };
  }
  const extMatch = /\.(\w+)(?:\?.*)?$/.exec(uri);
  const ext = (extMatch?.[1] || 'jpg').toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  return { buffer, ext: ext === 'png' ? 'png' : 'jpg', contentType };
}

// ─── Label Photo Upload ───────────────────────────────────────────────────────

export async function uploadLabelPhoto(
  userId: string,
  imageUri: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { buffer, ext, contentType } = await localImageToArrayBuffer(imageUri);
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('wine-labels')
      .upload(path, buffer, { contentType, upsert: false });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('wine-labels').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e: unknown) {
    return { url: null, error: String(e) };
  }
}

// ─── Avatar Upload ──────────────────────────────────────────────────────────

export async function uploadAvatar(
  userId: string,
  imageUri: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { buffer } = await localImageToArrayBuffer(imageUri);
    // Fixed filename per user (always .jpg regardless of source format) —
    // RLS scopes write access to this folder, and upsert replaces the
    // previous avatar in place at the same path rather than accumulating
    // orphaned files if a future upload happens to be a different format.
    const path = `${userId}/avatar.jpg`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    // Bust CDN/browser cache — the path is stable across uploads, so
    // without this a replaced avatar can keep showing the old cached image.
    return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
  } catch (e: unknown) {
    return { url: null, error: String(e) };
  }
}

// ─── Wine Card Upload ───────────────────────────────────────────────────────

export async function uploadWineCard(
  userId: string,
  entryId: string,
  imageUri: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { buffer } = await localImageToArrayBuffer(imageUri);
    const path = `${userId}/${entryId}-${Date.now()}.png`;

    const { error } = await supabase.storage
      .from('wine-cards')
      .upload(path, buffer, { contentType: 'image/png', upsert: false });

    if (error) return { url: null, error: error.message };

    const { data } = supabase.storage.from('wine-cards').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (e: unknown) {
    return { url: null, error: String(e) };
  }
}

// ─── User Search ──────────────────────────────────────────────────────────────

export async function searchUserByEmail(email: string) {
  return supabase
    .from('user_profiles')
    .select('id, email, display_name')
    .ilike('email', email.trim())
    .limit(5);
}

// ─── Direct Messages ──────────────────────────────────────────────────────────
// Two-way messaging: any member can message any other member, and recipients
// can reply — the RLS policy only requires sender_id = auth.uid(). Messages
// between two users are grouped client-side into a single conversation thread.

export type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  attachment_url: string | null;
  read: boolean;
  created_at: string;
};

export type Conversation = {
  otherUserId: string;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  lastMessage: DirectMessage;
  unreadCount: number;
};

export async function sendMessage(
  senderId: string,
  recipientId: string,
  content: string,
  attachmentUrl?: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('messages').insert({
    sender_id: senderId,
    recipient_id: recipientId,
    content,
    attachment_url: attachmentUrl ?? null,
  });
  return { error: error?.message ?? null };
}

export async function fetchConversations(
  userId: string
): Promise<{ data: Conversation[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  const messages = (data ?? []) as DirectMessage[];
  const byOther = new Map<string, DirectMessage[]>();
  messages.forEach((m) => {
    const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id;
    const list = byOther.get(otherId) ?? [];
    list.push(m);
    byOther.set(otherId, list);
  });

  const otherIds = [...byOther.keys()];
  const profiles = otherIds.length
    ? await supabase.from('user_profiles').select('id, display_name, avatar_url').in('id', otherIds)
    : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
  const profileMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));

  const conversations: Conversation[] = otherIds.map((otherId) => {
    const list = byOther.get(otherId)!; // already sorted desc by created_at
    return {
      otherUserId: otherId,
      otherDisplayName: profileMap.get(otherId)?.display_name ?? null,
      otherAvatarUrl: profileMap.get(otherId)?.avatar_url ?? null,
      lastMessage: list[0],
      unreadCount: list.filter((m) => m.recipient_id === userId && !m.read).length,
    };
  });

  conversations.sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  );

  return { data: conversations, error: null };
}

export async function fetchConversationMessages(
  userId: string,
  otherUserId: string
): Promise<{ data: DirectMessage[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
    )
    .order('created_at', { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }
  return { data: (data ?? []) as DirectMessage[], error: null };
}

export async function markConversationRead(
  userId: string,
  otherUserId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('sender_id', otherUserId)
    .eq('read', false);
  return { error: error?.message ?? null };
}

export async function fetchUnreadMessageCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);
  return count ?? 0;
}
