import { create } from 'zustand';
import { WineEntry, WineEntryDraft, computeTechnicalScore } from '@/types';
import {
  listWineEntries,
  createWineEntry,
  findRecentWineEntry,
  updateWineEntry,
  deleteWineEntry,
  searchWineEntries,
} from '@/lib/supabase';

const PAGE_SIZE = 20;

interface WineStore {
  entries: WineEntry[];
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  loadError: string | null;
  lastSaveError: string | null;
  searchResults: WineEntry[];
  searching: boolean;

  loadEntries: (userId: string) => Promise<void>;
  loadMore: (userId: string) => Promise<void>;
  addEntry: (userId: string, draft: WineEntryDraft) => Promise<WineEntry | null>;
  updateEntry: (id: string, updates: Partial<WineEntryDraft>) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  search: (userId: string, query: string, filters?: Record<string, unknown>) => Promise<void>;
  clearSearch: () => void;
  patchEntryBlurhash: (id: string, blurhash: string) => void;
}

export const useWineStore = create<WineStore>((set, get) => ({
  entries: [],
  totalCount: 0,
  loading: false,
  loadingMore: false,
  hasMore: false,
  currentPage: 0,
  loadError: null,
  lastSaveError: null,
  searchResults: [],
  searching: false,

  loadEntries: async (userId) => {
    set({ loading: true, currentPage: 0, loadError: null });
    const { data, error, count } = await listWineEntries(userId, { limit: PAGE_SIZE, offset: 0 });
    if (!error && data) {
      const total = count ?? data.length;
      set({
        entries: data as WineEntry[],
        totalCount: total,
        hasMore: data.length < total,
        currentPage: 0,
        loading: false,
        loadError: null,
      });
    } else {
      set({
        loading: false,
        loadError: error?.message ?? 'Could not load your wine list. Please try again.',
      });
    }
  },

  loadMore: async (userId) => {
    const { loadingMore, hasMore, currentPage, entries } = get();
    if (loadingMore || !hasMore) return;
    set({ loadingMore: true });
    const nextPage = currentPage + 1;
    const offset = nextPage * PAGE_SIZE;
    const { data, error, count } = await listWineEntries(userId, {
      limit: PAGE_SIZE,
      offset,
    });
    if (!error && data) {
      const total = count ?? get().totalCount;
      const allEntries = [...entries, ...(data as WineEntry[])];
      set({
        entries: allEntries,
        totalCount: total,
        hasMore: allEntries.length < total,
        currentPage: nextPage,
        loadingMore: false,
      });
    } else {
      set({ loadingMore: false });
    }
  },

  addEntry: async (userId, draft) => {
    const technical_score = computeTechnicalScore(draft as Partial<WineEntry>);
    // Destructure fields that may not yet exist as DB columns (added via
    // migrations 004 / 005).  Each is only included in the payload when it
    // carries a real value so the INSERT succeeds on older DB instances too.
    const {
      back_label_photo_url,
      label_photo_url,
      label_photo_blurhash,
      aromas_other_note,
      grape_blends,
      sweetness,
      custom_aromas,
      // subregion was added in migration 010 — only include when non-empty so
      // the INSERT still succeeds on DB instances where the column doesn't exist yet.
      subregion,
      ...rest
    } = draft;
    // Clamp every constrained field to its valid DB range so a stale draft or
    // edge-case shortcut value never causes a 23514 check-constraint violation.
    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, Math.round(v)));

    const payload: Record<string, unknown> = {
      ...rest,
      user_id: userId,
      technical_score: clamp(technical_score, 0, 100),
      // Structure wheel — DB requires 1..10
      acidity:       clamp(draft.acidity       ?? 5, 1, 10),
      tannin:        clamp(draft.tannin        ?? 5, 1, 10),
      body:          clamp(draft.body          ?? 5, 1, 10),
      alcohol:       clamp(draft.alcohol       ?? 5, 1, 10),
      intensity:     clamp(draft.intensity     ?? 5, 1, 10),
      finish_length: clamp(draft.finish_length ?? 5, 1, 10),
      // Technical score dimensions — DB requires 0..20
      score_balance:    clamp(draft.score_balance    ?? 10, 0, 20),
      score_intensity:  clamp(draft.score_intensity  ?? 10, 0, 20),
      score_complexity: clamp(draft.score_complexity ?? 10, 0, 20),
      score_finish:     clamp(draft.score_finish     ?? 10, 0, 20),
      score_typicity:   clamp(draft.score_typicity   ?? 10, 0, 20),
      // Vintage — DB requires NULL or 1800..2100; null out anything outside that range
      vintage: (draft.vintage !== null && draft.vintage !== undefined &&
                draft.vintage >= 1800 && draft.vintage <= 2100)
        ? draft.vintage : null,
      ...(label_photo_url        ? { label_photo_url }        : {}),
      ...(label_photo_blurhash   ? { label_photo_blurhash }   : {}),
      ...(back_label_photo_url   ? { back_label_photo_url }   : {}),
      ...(aromas_other_note      ? { aromas_other_note }      : {}),
      ...(grape_blends           ? { grape_blends }           : {}),
      ...(sweetness !== undefined ? { sweetness }             : {}),
      ...(subregion              ? { subregion }              : {}),
      // custom_aromas is always an array; include even when empty so it overwrites stale data
      custom_aromas: custom_aromas ?? [],
    };
    const { data, error } = await createWineEntry(payload);
    if (error || !data) {
      // On iOS a brief network blip can drop the response after the INSERT
      // already committed on the server. Detect this by attempting a recovery
      // query for an entry with the same name created in the last 30 s.
      const isNetworkError = (error?.message ?? '').includes('Network request failed');
      if (isNetworkError) {
        const { data: recovered } = await findRecentWineEntry(userId, draft.name);
        if (recovered) {
          set({ lastSaveError: null });
          const entry = recovered as WineEntry;
          set((state) => ({
            entries: [entry, ...state.entries],
            totalCount: state.totalCount + 1,
          }));
          return entry;
        }
        // Recovery also failed — show a clean message, not the raw native stack trace
        const cleanMsg = 'Network connection lost. Please check your connection and try again.';
        console.warn('[wineStore] addEntry FAILED (network):', error?.message, '| payload keys:', Object.keys(payload).join(', '));
        set({ lastSaveError: cleanMsg });
        return null;
      }
      const msg = [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(' | ') || 'Unknown error';
      console.warn('[wineStore] addEntry FAILED:', msg, '| payload keys:', Object.keys(payload).join(', '));
      set({ lastSaveError: msg });
      return null;
    }
    set({ lastSaveError: null });

    const entry = data as WineEntry;
    set((state) => ({
      entries: [entry, ...state.entries],
      totalCount: state.totalCount + 1,
    }));
    return entry;
  },

  updateEntry: async (id, updates) => {
    const technical_score =
      updates.score_balance !== undefined ||
      updates.score_intensity !== undefined ||
      updates.score_complexity !== undefined ||
      updates.score_finish !== undefined ||
      updates.score_typicity !== undefined
        ? computeTechnicalScore(updates as Partial<WineEntry>)
        : undefined;

    const payload = technical_score !== undefined ? { ...updates, technical_score } : updates;
    const { data, error } = await updateWineEntry(id, payload);
    if (!error && data) {
      set((state) => ({
        entries: state.entries.map((e) => (e.id === id ? (data as WineEntry) : e)),
      }));
    }
  },

  removeEntry: async (id) => {
    await deleteWineEntry(id);
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
      totalCount: Math.max(0, state.totalCount - 1),
    }));
  },

  search: async (userId, query, filters) => {
    set({ searching: true });
    const { data, error } = await searchWineEntries(userId, query, filters);
    if (!error && data) {
      set({ searchResults: data as WineEntry[], searching: false });
    } else {
      set({ searching: false });
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  patchEntryBlurhash: (id, blurhash) => {
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, label_photo_blurhash: blurhash } : e
      ),
      searchResults: state.searchResults.map((e) =>
        e.id === id ? { ...e, label_photo_blurhash: blurhash } : e
      ),
    }));
  },
}));
