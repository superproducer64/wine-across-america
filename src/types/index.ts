// ─── Enums & Constants ───────────────────────────────────────────────────────

export type TerriorSoil =
  | 'limestone' | 'chalk' | 'marl' | 'calcareous' | 'dolomite' | 'flint'
  | 'clay' | 'terra-rossa' | 'red-iron'
  | 'sand' | 'gravel' | 'galets' | 'loam' | 'silt' | 'alluvial'
  | 'volcanic' | 'volcanic-ash' | 'tuff' | 'basalt'
  | 'granite' | 'decomposed-granite' | 'slate' | 'schist' | 'shale';

export type TerriorClimate =
  | 'cool' | 'cool-continental' | 'temperate' | 'oceanic' | 'maritime'
  | 'moderate' | 'continental' | 'mediterranean' | 'warm' | 'hot'
  | 'semi-arid' | 'alpine-mountain' | 'tropical' | 'desert';

export const TERROIR_SOIL_LABELS: Record<TerriorSoil, string> = {
  // Sedimentary / carbonate
  limestone:          'Limestone',
  chalk:              'Chalk',
  marl:               'Marl',
  calcareous:         'Calcareous soils',
  dolomite:           'Dolomite',
  flint:              'Flint (Silex)',
  // Clay-based
  clay:               'Clay',
  'terra-rossa':      'Terra rossa',
  'red-iron':         'Red iron-rich soils',
  // Sandy / gravelly
  sand:               'Sand',
  gravel:             'Gravel',
  galets:             'Pebbles / Galets roulés',
  loam:               'Loam',
  silt:               'Silt',
  alluvial:           'Alluvial soils',
  // Volcanic
  volcanic:           'Volcanic',
  'volcanic-ash':     'Volcanic ash',
  tuff:               'Tuff',
  basalt:             'Basalt',
  // Metamorphic / igneous
  granite:            'Granite',
  'decomposed-granite': 'Decomposed granite',
  slate:              'Slate',
  schist:             'Schist',
  shale:              'Shale',
};

export const TERROIR_CLIMATE_LABELS: Record<TerriorClimate, string> = {
  cool:               'Cool',
  'cool-continental': 'Cool-Continental',
  temperate:          'Temperate',
  oceanic:            'Oceanic',
  maritime:           'Maritime',
  moderate:           'Moderate',
  continental:        'Continental',
  mediterranean:      'Mediterranean',
  warm:               'Warm',
  hot:                'Hot',
  'semi-arid':        'Semi-arid',
  'alpine-mountain':  'Alpine / Mountain',
  tropical:           'Tropical',
  desert:             'Desert',
};

// ─── Aroma Data ──────────────────────────────────────────────────────────────

export interface AromaCategory {
  id: string;
  label: string;
  emoji: string;
  /** Subcategories shown to all profiles */
  subcategories: string[];
  /** Subcategories shown only to Sommelier users (s: true items in AROMA_WHEEL) */
  sommelierSubcategories?: string[];
}

/** All subcategory strings for a category, respecting the caller's profile */
export function getCategorySubcategories(
  cat: AromaCategory,
  isSommelier: boolean
): string[] {
  const shared = cat.subcategories;
  if (!isSommelier) return shared;
  return [...shared, ...(cat.sommelierSubcategories ?? [])];
}

export type AromaWheelItem = string | { name: string; s: true };

// Raw taxonomy — category label maps to its items. Plain strings are visible
// to every role; { name, s: true } entries are Sommelier-only.
export const AROMA_WHEEL: Record<string, AromaWheelItem[]> = {
  'Citrus': ['Lemon', 'Lime', 'Grapefruit', 'Orange', { name: 'Mandarin', s: true }, { name: 'Lemon zest', s: true }, { name: 'Orange peel', s: true }],
  'Orchard Fruit': ['Green apple', 'Red apple', 'Pear', 'Quince', { name: 'Baked apple', s: true }, { name: 'Apple skin', s: true }, { name: 'Gooseberry', s: true }],
  'Stone Fruit': ['Peach', 'Apricot', 'Nectarine', { name: 'White peach', s: true }, { name: 'Peach skin', s: true }, { name: 'Yellow plum', s: true }],
  'Tropical Fruit': ['Pineapple', 'Mango', 'Passion fruit', 'Melon', 'Banana', 'Lychee', { name: 'Papaya', s: true }, { name: 'Guava', s: true }, { name: 'Cantaloupe', s: true }, { name: 'Honeydew', s: true }, { name: 'Dragon fruit', s: true }, { name: 'Starfruit (carambola)', s: true }],
  'Red Fruit': ['Strawberry', 'Raspberry', 'Red cherry', 'Red currant', { name: 'Ripe strawberry', s: true }, { name: 'Sour cherry', s: true }, { name: 'Cranberry', s: true }, { name: 'Pomegranate', s: true }, { name: 'Red plum', s: true }, { name: 'Mulberry', s: true }],
  'Black Fruit': ['Blackberry', 'Blackcurrant', 'Black cherry', 'Plum', { name: 'Ripe plum', s: true }],
  'Floral': ['Rose', 'Violet', 'Jasmine', 'White flowers', { name: 'Orange blossom', s: true }, { name: 'Lavender', s: true }],
  'Herbal / Green': ['Grass', 'Bell pepper', 'Mint', 'Fresh herbs', { name: 'Eucalyptus', s: true }, { name: 'Dried herbs', s: true }, { name: 'Green pepper', s: true }, { name: 'Thyme', s: true }, { name: 'Tomato leaf', s: true }],
  'Spice': ['Black pepper', 'White pepper', 'Clove', 'Cinnamon', { name: 'Pink pepper', s: true }, { name: 'Baking spice', s: true }, { name: 'Nutmeg', s: true }, { name: 'Anise', s: true }, { name: 'Licorice', s: true }],
  'Oak / Toast': ['Vanilla', 'Toast', 'Smoke', 'Cedar', 'Chocolate', { name: 'Coffee', s: true }, { name: 'Espresso', s: true }, { name: 'Mocha', s: true }, { name: 'Caramelized wood', s: true }, { name: 'Charred wood', s: true }],
  'Earthy': ['Mushroom', 'Wet leaves', 'Leather', 'Tobacco', { name: 'Forest floor', s: true }, { name: 'Truffle', s: true }, { name: 'Tobacco leaf', s: true }, { name: 'Dusty earth', s: true }, { name: 'Game', s: true }],
  'Mineral': ['Chalk', 'Wet stone', 'Saline', { name: 'Flint', s: true }, { name: 'Slate', s: true }, { name: 'Oyster shell', s: true }, { name: 'Iron', s: true }, { name: 'Graphite', s: true }],
  'Sweet / Ripe': ['Honey', 'Jam', 'Dried fruit', 'Raisin', 'Prune', { name: 'Fig', s: true }, { name: 'Caramel', s: true }, { name: 'Toffee', s: true }, { name: 'Molasses', s: true }, { name: 'Date', s: true }],
  'Other': ['Butter', 'Cream', 'Yeast', 'Brioche', 'Bread', 'Petrol', { name: 'Yogurt', s: true }, { name: 'Wax', s: true }, { name: 'Rubber', s: true }, { name: 'Almond', s: true }, { name: 'Hazelnut', s: true }, { name: 'Walnut', s: true }, { name: 'Lees', s: true }],
};

// Stable id slugs + emoji per category, independent of AROMA_WHEEL's label
// keys — existing wine_entries rows store aromas_l1 as these ids (e.g.
// 'citrus'), so they must not change even if a display label is edited.
const AROMA_CATEGORY_META: { label: string; id: string; emoji: string }[] = [
  // ── Order matches Appendix I (left column → right column) ───────────────────
  { label: 'Citrus', id: 'citrus', emoji: '🍋' },
  { label: 'Orchard Fruit', id: 'orchard-fruit', emoji: '🍎' },
  { label: 'Stone Fruit', id: 'stone-fruit', emoji: '🍑' },
  { label: 'Tropical Fruit', id: 'tropical-fruit', emoji: '🍍' },
  { label: 'Red Fruit', id: 'red-fruit', emoji: '🍓' },
  { label: 'Black Fruit', id: 'black-fruit', emoji: '🫐' },
  { label: 'Floral', id: 'floral', emoji: '🌸' },
  { label: 'Herbal / Green', id: 'herbal-green', emoji: '🌿' },
  { label: 'Spice', id: 'spice', emoji: '🌶️' },
  { label: 'Oak / Toast', id: 'oak-toast', emoji: '🌰' },
  { label: 'Earthy', id: 'earthy', emoji: '🌍' },
  { label: 'Mineral', id: 'mineral', emoji: '🪨' },
  { label: 'Sweet / Ripe', id: 'sweet-ripe', emoji: '🍯' },
  { label: 'Other', id: 'other', emoji: '🍞' },
];

export const AROMA_CATEGORIES: AromaCategory[] = AROMA_CATEGORY_META.map(({ label, id, emoji }) => {
  const items = AROMA_WHEEL[label] ?? [];
  const subcategories: string[] = [];
  const sommelierSubcategories: string[] = [];
  items.forEach((item) => {
    if (typeof item === 'string') subcategories.push(item);
    else sommelierSubcategories.push(item.name);
  });
  return { id, label, emoji, subcategories, sommelierSubcategories };
});

export interface AromaGroup {
  id: string;
  label: string;
  emoji: string;
  color: string;
  categoryIds: string[];
  description: string;
}

export const AROMA_GROUPS: AromaGroup[] = [
  {
    id: 'fruit',
    label: 'Fruit',
    emoji: '🍎',
    color: '#C9635A',
    categoryIds: ['citrus', 'orchard-fruit', 'stone-fruit', 'tropical-fruit', 'red-fruit', 'black-fruit'],
    description: 'Citrus, orchard fruit, stone fruit, tropical fruit, red fruit, black fruit',
  },
  {
    id: 'floral',
    label: 'Floral',
    emoji: '🌸',
    color: '#A87EC8',
    categoryIds: ['floral'],
    description: 'Rose, jasmine, violet, blossom',
  },
  {
    id: 'herbal',
    label: 'Herbal',
    emoji: '🌿',
    color: '#6E9456',
    categoryIds: ['herbal-green'],
    description: 'Grass, bell pepper, mint, fresh herbs',
  },
  {
    id: 'spice',
    label: 'Spice',
    emoji: '🌶️',
    color: '#C4874A',
    categoryIds: ['spice'],
    description: 'Black pepper, clove, baking spice, cinnamon',
  },
  {
    id: 'earth',
    label: 'Earth',
    emoji: '🌍',
    color: '#8B5E38',
    categoryIds: ['earthy'],
    description: 'Mushroom, forest floor, leather, tobacco',
  },
  {
    id: 'oak',
    label: 'Oak',
    emoji: '🌰',
    color: '#B89A52',
    categoryIds: ['oak-toast', 'other'],
    description: 'Vanilla, smoke, toast · Cream, butter, brioche',
  },
  {
    id: 'mineral',
    label: 'Mineral',
    emoji: '🪨',
    color: '#6A8BA0',
    categoryIds: ['mineral'],
    description: 'Chalk, wet stone, salt, flint',
  },
  {
    id: 'sweet',
    label: 'Sweet',
    emoji: '🍯',
    color: '#C47880',
    categoryIds: ['sweet-ripe'],
    description: 'Honey, jam, dried fruit, caramel',
  },
];

// ─── Wine Style Shortcuts ─────────────────────────────────────────────────────

export interface WineShortcut {
  id: string;
  name: string;
  emoji: string;
  styleLabel: string;
  forWines: string;
  aromas_l1: string[];
  aromas_l2: string[];
  structure: {
    sweetness: number;
    acidity: number;
    tannin: number;
    body: number;
    alcohol: number;
    intensity: number;
    finish_length: number;
  };
}

export const WINE_SHORTCUTS: WineShortcut[] = [
  {
    id: 'fresh-crisp-white',
    name: 'Fresh & Crisp White',
    emoji: '🍋',
    styleLabel: 'Light · Refreshing · Zesty',
    forWines: 'Sauvignon Blanc, Albariño, Pinot Grigio, Txakoli',
    aromas_l1: ['citrus', 'herbal-green', 'mineral'],
    aromas_l2: ['Lemon', 'Lime', 'Grass', 'Saline'],
    structure: { sweetness: 2, acidity: 8, tannin: 1, body: 3, alcohol: 3, intensity: 6, finish_length: 5 },
  },
  {
    id: 'ripe-round-white',
    name: 'Ripe & Round White',
    emoji: '🍑',
    styleLabel: 'Smooth · Fruity · Round',
    forWines: 'Unoaked Chardonnay, Viognier, Chenin Blanc',
    aromas_l1: ['stone-fruit', 'tropical-fruit'],
    aromas_l2: ['Peach', 'Apricot', 'Mango'],
    structure: { sweetness: 3, acidity: 5, tannin: 1, body: 6, alcohol: 6, intensity: 6, finish_length: 6 },
  },
  {
    id: 'oaky-chardonnay',
    name: 'Oaky Chardonnay',
    emoji: '🌰',
    styleLabel: 'Rich · Creamy · Oak-Driven',
    forWines: 'Oaked Chardonnay, Napa Chardonnay, White Burgundy',
    aromas_l1: ['oak-toast', 'stone-fruit', 'other'],
    aromas_l2: ['Vanilla', 'Toast', 'Peach', 'Butter', 'Cream'],
    structure: { sweetness: 2, acidity: 5, tannin: 1, body: 7, alcohol: 7, intensity: 7, finish_length: 7 },
  },
  {
    id: 'light-juicy-red',
    name: 'Light & Juicy Red',
    emoji: '🍓',
    styleLabel: 'Fresh · Vibrant · Easy Drinking',
    forWines: 'Pinot Noir, Gamay, Light Reds',
    aromas_l1: ['red-fruit', 'floral', 'herbal-green'],
    aromas_l2: ['Strawberry', 'Raspberry', 'Violet', 'Fresh herbs'],
    structure: { sweetness: 2, acidity: 7, tannin: 3, body: 3, alcohol: 3, intensity: 6, finish_length: 5 },
  },
  {
    id: 'ripe-smooth-red',
    name: 'Ripe & Smooth Red',
    emoji: '🫐',
    styleLabel: 'Soft · Fruit-Forward · Smooth',
    forWines: 'Merlot, Zinfandel, Grenache',
    aromas_l1: ['black-fruit', 'spice', 'sweet-ripe'],
    aromas_l2: ['Blackberry', 'Plum', 'Clove', 'Jam'],
    structure: { sweetness: 3, acidity: 5, tannin: 5, body: 6, alcohol: 6, intensity: 6, finish_length: 6 },
  },
  {
    id: 'bold-structured-red',
    name: 'Bold & Structured Red',
    emoji: '🍷',
    styleLabel: 'Powerful · Structured · Intense',
    forWines: 'Cabernet Sauvignon, Syrah, Malbec',
    aromas_l1: ['black-fruit', 'oak-toast', 'earthy'],
    aromas_l2: ['Blackcurrant', 'Cedar', 'Smoke', 'Tobacco'],
    structure: { sweetness: 2, acidity: 5, tannin: 8, body: 9, alcohol: 9, intensity: 9, finish_length: 7 },
  },
];

// Legacy alias kept so nothing else breaks during migration
export const AROMA_SHORTCUTS: Record<string, string[]> = Object.fromEntries(
  WINE_SHORTCUTS.map((s) => [s.name, s.aromas_l1])
);

// ─── Price Entry ─────────────────────────────────────────────────────────────

export interface PriceEntry {
  amount: number;
  currency: string;
  date: string;
  location: string;
  type?: 'glass' | 'bottle';
}

// ─── Wine Entry ───────────────────────────────────────────────────────────────

export interface WineEntry {
  id: string;
  user_id: string;

  // Basics
  name: string;
  producer: string;
  vintage: number | null;
  country: string;
  region: string;
  subregion: string;
  appellation: string;
  grapes: string[];
  grape_blends: GrapeBlendEntry[] | null;
  price: PriceEntry[];
  tasting_date: string;
  location_name: string;
  location_geo: { lat: number; lng: number } | null;

  // Structure Wheel (1-10)
  sweetness: number | null; // null on entries saved before migration 006
  acidity: number;
  tannin: number;
  body: number;
  alcohol: number;
  intensity: number;
  finish_length: number;

  // Technical Score (0-20 each)
  score_balance: number;
  score_intensity: number;
  score_complexity: number;
  score_finish: number;
  score_typicity: number;
  technical_score: number; // computed

  // Tasting notes
  free_notes: string;
  aromas_l1: string[];
  aromas_l2: string[];
  aromas_other_note: string | null;
  /** User-typed custom aroma/flavor tags, saved alongside predefined L1/L2 tags */
  custom_aromas: string[];
  tags: string[];
  want_another_glass: boolean;
  want_to_buy: boolean;

  // Terroir
  terroir_soil: TerriorSoil[] | null;
  terroir_climate: TerriorClimate | null;
  terroir_visible: boolean;

  // Creator / Signature Score (creator-only write)
  sig_sense_of_place: number | null;
  sig_story: number | null;
  sig_viticulture: number | null;
  sig_structure: number | null;
  sig_enjoyment: number | null;
  signature_score: number | null;

  // Label photos
  label_photo_url: string | null;
  // Stores a tiny 32×32 base64 JPEG data URI (data:image/jpeg;base64,…) that
  // expo-image uses as an instant placeholder while the full label loads.
  // Named "blurhash" per the original spec but contains a data URI, not a
  // strict blurhash string — the visual effect is the same.
  label_photo_blurhash: string | null;
  back_label_photo_url: string | null;

  created_at: string;
  updated_at: string;
}

export type WineEntryDraft = Omit<WineEntry, 'id' | 'user_id' | 'technical_score' | 'signature_score' | 'created_at' | 'updated_at'>;

// ─── User / Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'enthusiast' | 'sommelier';
export type SommelierStatus = 'pending' | 'approved' | 'rejected' | 'needs_resubmission';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
  subscription_tier: 'free' | 'pro';
  user_role: UserRole;
  sommelier_cert_url: string | null;
  sommelier_status: SommelierStatus | null;
  sommelier_rejection_reason: string | null;
  directory_visible: boolean;
  created_at: string;
}

// ─── Wine Data Lists ──────────────────────────────────────────────────────────

export const COUNTRIES_AND_REGIONS: Record<string, Record<string, string[]>> = {
  France: {
    Bordeaux: ['Médoc', 'Saint-Émilion', 'Pomerol', 'Sauternes', 'Pessac-Léognan'],
    Burgundy: ['Côte de Nuits', 'Côte de Beaune', 'Chablis', 'Mâconnais'],
    'Rhône Valley': ['Northern Rhône', 'Southern Rhône', 'Châteauneuf-du-Pape'],
    Champagne: ['Grand Cru', 'Premier Cru'],
    Alsace: ['Alsace', 'Alsace Grand Cru'],
    Loire: ['Sancerre', 'Pouilly-Fumé', 'Muscadet', 'Chinon'],
    Provence: ['Côtes de Provence', 'Bandol'],
    Languedoc: ['Languedoc-Roussillon', 'Pic Saint-Loup'],
  },
  Italy: {
    Tuscany: ['Chianti Classico', 'Brunello di Montalcino', 'Bolgheri', 'Montepulciano'],
    Piedmont: ['Barolo', 'Barbaresco', 'Barbera d\'Asti', 'Moscato d\'Asti'],
    Veneto: ['Amarone', 'Soave', 'Valpolicella', 'Prosecco'],
    Sicily: ['Etna', 'Marsala', 'Nero d\'Avola'],
    Sardinia: ['Cannonau di Sardegna', 'Vermentino di Sardegna'],
    'Friuli-Venezia Giulia': ['Collio', 'Friuli Colli Orientali'],
  },
  Spain: {
    Rioja: ['Rioja Alta', 'Rioja Alavesa', 'Rioja Oriental'],
    Ribera: ['Ribera del Duero'],
    Priorat: ['Priorat DOCa'],
    Galicia: ['Rías Baixas', 'Ribeira Sacra'],
    Catalonia: ['Penedès', 'Cava'],
    Jerez: ['Jerez-Xérès-Sherry'],
  },
  'United States': {
    Alabama: [],
    Alaska: [],
    Arizona: ['Sonoita', 'Willcox'],
    Arkansas: ['Altus', 'Arkansas Mountain'],
    California: ['Napa Valley', 'Sonoma', 'Paso Robles', 'Santa Barbara', 'Monterey', 'Lodi', 'Sierra Foothills', 'Santa Cruz Mountains', 'Livermore Valley', 'Temecula Valley', 'Mendocino', 'Lake County'],
    Colorado: ['Grand Valley', 'West Elks', 'Rocky Mountain'],
    Connecticut: ['Southeastern New England'],
    Delaware: [],
    Florida: [],
    Georgia: ['Dahlonega Plateau', 'Georgia'],
    Hawaii: ['Maui'],
    Idaho: ['Snake River Valley', 'Eagle Foothills'],
    Illinois: [],
    Indiana: [],
    Iowa: [],
    Kansas: [],
    Kentucky: [],
    Louisiana: [],
    Maine: [],
    Maryland: ['Catoctin', 'Cumberland Valley'],
    Massachusetts: ['Southeastern New England'],
    Michigan: ['Leelanau Peninsula', 'Old Mission Peninsula', 'Lake Michigan Shore'],
    Minnesota: [],
    Mississippi: [],
    Missouri: ['Augusta', 'Ozark Highlands', 'Hermann'],
    Montana: [],
    Nebraska: [],
    Nevada: [],
    'New Hampshire': [],
    'New Jersey': ['Warren Hills', 'Central Delaware Valley'],
    'New Mexico': ['Mesilla Valley', 'Middle Rio Grande Valley'],
    'New York': ['Finger Lakes', 'Long Island', 'Hudson River Region', 'Lake Erie', 'Niagara Escarpment'],
    'North Carolina': ['Yadkin Valley', 'Swan Creek', 'Haw River Valley'],
    'North Dakota': [],
    Ohio: ['Lake Erie', 'Grand River Valley', 'Isle St. George', 'Ohio River Valley'],
    Oklahoma: [],
    Oregon: ['Willamette Valley', 'Rogue Valley', 'Umpqua Valley', 'Columbia Valley', 'Applegate Valley', 'Chehalem Mountains', 'Dundee Hills', 'Eola-Amity Hills'],
    Pennsylvania: ['Lancaster Valley', 'Cumberland Valley', 'Lake Erie'],
    'Rhode Island': ['Southeastern New England'],
    'South Carolina': [],
    'South Dakota': [],
    Tennessee: [],
    Texas: ['Texas Hill Country', 'High Plains', 'Fredericksburg', 'Bell Mountain', 'Escondido Valley'],
    Utah: [],
    Vermont: [],
    Virginia: ['Monticello', 'Shenandoah Valley', 'Northern Neck George Washington Birthplace', 'Eastern Shore'],
    Washington: ['Columbia Valley', 'Walla Walla', 'Yakima Valley', 'Red Mountain', 'Wahluke Slope', 'Horse Heaven Hills', 'Rattlesnake Hills'],
    'West Virginia': ['Kanawha River Valley', 'Ohio River Valley'],
    Wisconsin: [],
    Wyoming: [],
  },
  Germany: {
    Mosel: ['Mosel', 'Saar', 'Ruwer'],
    Rheingau: ['Rheingau'],
    Pfalz: ['Pfalz'],
    Baden: ['Baden'],
    Rheinhessen: ['Rheinhessen'],
  },
  Argentina: {
    Mendoza: ['Luján de Cuyo', 'Maipú', 'Uco Valley'],
    Salta: ['Cafayate'],
    Patagonia: ['Río Negro', 'Neuquén'],
  },
  Chile: {
    'Maipo Valley': ['Maipo Valley'],
    Colchagua: ['Colchagua Valley'],
    Casablanca: ['Casablanca Valley'],
    Leyda: ['Leyda Valley'],
  },
  Australia: {
    'South Australia': ['Barossa Valley', 'Clare Valley', 'McLaren Vale', 'Eden Valley'],
    Victoria: ['Yarra Valley', 'Mornington Peninsula', 'Heathcote'],
    'Western Australia': ['Margaret River'],
    'New South Wales': ['Hunter Valley'],
  },
  'New Zealand': {
    Marlborough: ['Marlborough'],
    'Central Otago': ['Central Otago'],
    Hawke: ["Hawke's Bay"],
  },
  Portugal: {
    Douro: ['Douro', 'Port'],
    Alentejo: ['Alentejo'],
    Lisboa: ['Lisboa'],
    'Vinho Verde': ['Minho'],
  },
  Austria: {
    Wachau: ['Wachau'],
    Kamptal: ['Kamptal'],
    Kremstal: ['Kremstal'],
    Styria: ['Südsteiermark'],
  },
};

// ─── Grape Blend Entry ────────────────────────────────────────────────────────

export interface GrapeBlendEntry {
  name: string;
  percentage: number | null;
}

// ─── Grape Varieties Reference List ──────────────────────────────────────────

export const GRAPE_VARIETIES = [
  // White
  'Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Pinot Gris', 'Pinot Grigio',
  'Gewürztraminer', 'Albariño', 'Grüner Veltliner', 'Viognier', 'Chenin Blanc',
  'Muscadet', 'Roussanne', 'Marsanne', 'Vermentino', 'Trebbiano', 'Fiano',
  'Greco di Tufo', 'Arneis', 'Gavi / Cortese', 'Falanghina', 'Verdejo',
  'Torrontés', 'Assyrtiko', 'Muscat', 'Pinot Blanc', 'Sémillon', 'Malvasia',
  'Palomino', 'Garganega', 'Friulano', 'Pecorino', 'Catarratto',

  // Red
  'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah / Shiraz', 'Grenache',
  'Tempranillo', 'Sangiovese', 'Nebbiolo', 'Barbera', 'Dolcetto', 'Montepulciano',
  'Aglianico', 'Primitivo / Zinfandel', "Nero d'Avola", 'Carménère', 'Malbec',
  'Cabernet Franc', 'Mourvèdre', 'Gamay', 'Petite Sirah', 'Petit Verdot',
  'Garnacha', 'Bobal', 'Mencía', 'Touriga Nacional', 'Tinta Barroca',
  'Blaufränkisch', 'Zweigelt', 'St. Laurent', 'Corvina', 'Rondinella',
  'Molinara', 'Sagrantino', 'Lagrein', 'Teroldego', 'Nerello Mascalese',
  'Frappato', 'Cannonau', 'Monastrell', 'Cinsault', 'Carignan', 'Pinotage',
  'Tannat', 'Loureiro', 'Alvarinho', 'Xinomavro', 'Agiorgitiko',
].sort();

// ─── Structure Wheel ─────────────────────────────────────────────────────────

export interface StructureDimension {
  key: keyof Pick<WineEntry, 'sweetness' | 'acidity' | 'tannin' | 'body' | 'alcohol' | 'intensity' | 'finish_length'>;
  label: string;
  displayLabel: string;
  lowAnchor: string;
  highAnchor: string;
  tip: string;
}

export const STRUCTURE_DIMENSIONS: StructureDimension[] = [
  {
    key: 'sweetness',
    label: 'Sweetness',
    displayLabel: 'Sweetness',
    lowAnchor: '🍋 Bone dry',
    highAnchor: '🍯 Very sweet',
    tip: 'Residual sugar on the tip of the tongue',
  },
  {
    key: 'acidity',
    label: 'Acidity',
    displayLabel: 'Acidity',
    lowAnchor: '🍌 Banana/melon',
    highAnchor: '🍋 Lemon juice',
    tip: 'The more your mouth waters, the higher the acidity',
  },
  {
    key: 'tannin',
    label: 'Tannin',
    displayLabel: 'Tannin',
    lowAnchor: '🧶 Silk',
    highAnchor: '🍵 Strong black tea',
    tip: 'Focus on gums and teeth, not tongue',
  },
  {
    key: 'body',
    label: 'Body',
    displayLabel: 'Body',
    lowAnchor: '💧 Water',
    highAnchor: '🥛 Heavy cream',
    tip: 'Think texture, not flavor',
  },
  {
    key: 'alcohol',
    label: 'Alcohol',
    displayLabel: 'Alcohol',
    lowAnchor: '❄️ No heat',
    highAnchor: '🥃 Whiskey burn',
    tip: 'Focus on throat/chest warmth after swallowing',
  },
  {
    key: 'intensity',
    label: 'Intensity',
    displayLabel: 'Intensity',
    lowAnchor: '🌫️ Faint/neutral',
    highAnchor: '🌺 Perfume store',
    tip: 'How quickly do you notice it?',
  },
  {
    key: 'finish_length',
    label: 'Finish Length',
    displayLabel: 'Finish Length',
    lowAnchor: '💨 Disappears',
    highAnchor: '⏱️ 30+ seconds',
    tip: 'Count seconds after swallowing',
  },
];

// ─── Technical Score ─────────────────────────────────────────────────────────

export interface TechnicalCategory {
  key: keyof Pick<WineEntry, 'score_balance' | 'score_intensity' | 'score_complexity' | 'score_finish' | 'score_typicity'>;
  label: string;
  description: string;
}

export const TECHNICAL_CATEGORIES: TechnicalCategory[] = [
  {
    key: 'score_balance',
    label: 'Balance',
    description: 'Do acidity, tannin, alcohol, body, fruit, and oak work in harmony?',
  },
  {
    key: 'score_intensity',
    label: 'Intensity',
    description: 'How expressive is the wine on the nose and palate?',
  },
  {
    key: 'score_complexity',
    label: 'Complexity',
    description: 'How many layers? Does it evolve, open up, stay interesting?',
  },
  {
    key: 'score_finish',
    label: 'Finish Quality',
    description: 'Quality and length of what remains after swallowing',
  },
  {
    key: 'score_typicity',
    label: 'Typicity',
    description: 'Does it express its grape, region, and intended style clearly?',
  },
];

// ─── Signature Score (creator) ────────────────────────────────────────────────

export interface SignatureCategory {
  key: keyof Pick<WineEntry, 'sig_sense_of_place' | 'sig_story' | 'sig_viticulture' | 'sig_structure' | 'sig_enjoyment'>;
  label: string;
  description: string;
}

export const SIGNATURE_CATEGORIES: SignatureCategory[] = [
  {
    key: 'sig_sense_of_place',
    label: 'Sense of Place',
    description: 'Does the wine clearly communicate its terroir and origin?',
  },
  {
    key: 'sig_story',
    label: 'Story & Authenticity',
    description: 'Does the producer have a compelling, honest story?',
  },
  {
    key: 'sig_viticulture',
    label: 'Viticulture & Winemaking',
    description: 'Quality of farming and cellar practices',
  },
  {
    key: 'sig_structure',
    label: 'Structure & Balance',
    description: 'Technical quality assessment',
  },
  {
    key: 'sig_enjoyment',
    label: 'Overall Enjoyment',
    description: 'Would you drink this again? Pure pleasure factor.',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function computeTechnicalScore(entry: Partial<WineEntry>): number {
  return (
    (entry.score_balance ?? 0) +
    (entry.score_intensity ?? 0) +
    (entry.score_complexity ?? 0) +
    (entry.score_finish ?? 0) +
    (entry.score_typicity ?? 0)
  );
}

export function computeSignatureScore(entry: Partial<WineEntry>): number | null {
  const vals = [
    entry.sig_sense_of_place,
    entry.sig_story,
    entry.sig_viticulture,
    entry.sig_structure,
    entry.sig_enjoyment,
  ];
  if (vals.some((v) => v == null)) return null;
  return vals.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

export function getStyleSummary(entry: Partial<WineEntry>) {
  const acidity = entry.acidity ?? 5;
  const tannin = entry.tannin ?? 5;
  const body = entry.body ?? 5;
  const alcohol = entry.alcohol ?? 5;

  // Normalize to 0-1
  return {
    // Low acidity → sweet-ish perception; high acidity → dry
    dryness: acidity / 10,
    // Body maps to fullness
    fullness: body / 10,
    // Direct acidity mapping
    acidity: acidity / 10,
    // Tannin maps to tannic
    tannin: tannin / 10,
  };
}
