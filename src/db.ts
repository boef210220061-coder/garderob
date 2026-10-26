import Dexie, { type Table } from 'dexie';
import {
  categories,
  colors,
  styles,
  occasions,
  defaultPreferences,
  type Item,
  type Outfit,
  type Preferences,
  type Rating,
  type Weather,
} from './types';
class WardrobeDB extends Dexie {
  items!: Table<Item, string>;
  outfits!: Table<Outfit, string>;
  preferences!: Table<Preferences, string>;
  ratings!: Table<Rating, string>;
  meta!: Table<{ id: string; value: Weather }, string>;
  constructor() {
    super('pink-wardrobe');
    this.version(1).stores({
      items: 'id,category,demo,createdAt',
      outfits: 'id,demo,createdAt',
      preferences: 'id',
      ratings: 'id',
      meta: 'id',
    });
  }
}
export const db = new WardrobeDB();
export async function deleteItem(id: string) {
  await db.transaction('rw', db.items, db.outfits, db.ratings, async () => {
    await db.items.delete(id);
    for (const o of await db.outfits.toArray())
      if (o.itemIds.includes(id)) await db.outfits.delete(o.id);
    for (const r of await db.ratings.toArray())
      if (r.itemIds.includes(id)) await db.ratings.delete(r.id);
  });
}
export async function exportBackup() {
  return JSON.stringify(
    {
      format: 'pink-wardrobe',
      version: 1,
      exportedAt: new Date().toISOString(),
      items: await db.items.toArray(),
      outfits: await db.outfits.toArray(),
      preferences: (await db.preferences.get('profile')) ?? defaultPreferences,
      ratings: await db.ratings.toArray(),
      weather: (await db.meta.get('weather'))?.value,
    },
    null,
    2,
  );
}
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, n = 300) => typeof v === 'string' && v.length <= n;
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const strings = (v: unknown, max = 100): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every((x) => str(x));
function validWeather(w: unknown): boolean {
  return (
    obj(w) &&
    num(w.temp, -25, 40) &&
    ['sun', 'cloud', 'rain', 'snow'].includes(w.condition as string) &&
    num(w.wind, 0, 60) &&
    occasions.includes(w.occasion as string) &&
    ['any', ...styles].includes(w.style as string)
  );
}
export function validateBackup(raw: string) {
  if (raw.length > 100 * 1024 * 1024) throw Error('Резервная копия больше 100 МБ');
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw Error('Не удалось прочитать JSON-файл');
  }
  const bad = () => {
    throw Error('Файл не является корректной резервной копией Pink Wardrobe');
  };
  if (
    !obj(v) ||
    v.format !== 'pink-wardrobe' ||
    v.version !== 1 ||
    !Array.isArray(v.items) ||
    v.items.length > 2000 ||
    !Array.isArray(v.outfits) ||
    !Array.isArray(v.ratings) ||
    !obj(v.preferences)
  )
    return bad();
  const ids = new Map<string, boolean>();
  for (const x of v.items) {
    if (
      !obj(x) ||
      !str(x.id) ||
      ids.has(x.id as string) ||
      !str(x.name, 100) ||
      !Object.keys(categories).includes(x.category as string) ||
      !Object.keys(colors).includes(x.color as string) ||
      !(x.secondColor === '' || Object.keys(colors).includes(x.secondColor as string)) ||
      !styles.includes(x.style as (typeof styles)[number]) ||
      !str(x.season) ||
      !str(x.subcategory) ||
      !str(x.notes, 3000) ||
      !num(x.minTemp, -25, 40) ||
      !num(x.maxTemp, -25, 40) ||
      (x.minTemp as number) > (x.maxTemp as number) ||
      typeof x.demo !== 'boolean' ||
      typeof x.rain !== 'boolean' ||
      !num(x.createdAt, 0, 1e16) ||
      typeof x.photo !== 'string' ||
      x.photo.length > 5000000 ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x.photo)
    )
      return bad();
    ids.set(x.id as string, x.demo as boolean);
  }
  const unique = new Set<string>();
  for (const o of v.outfits) {
    if (
      !obj(o) ||
      !str(o.id) ||
      unique.has(o.id as string) ||
      !str(o.name) ||
      !str(o.reason, 5000) ||
      !strings(o.itemIds, 10) ||
      !o.itemIds.length ||
      !o.itemIds.every((id) => ids.has(id) && ids.get(id) === o.demo) ||
      !validWeather(o.weather) ||
      !num(o.createdAt, 0, 1e16)
    )
      return bad();
    unique.add(o.id as string);
  }
  unique.clear();
  for (const r of v.ratings) {
    if (
      !obj(r) ||
      !str(r.id) ||
      unique.has(r.id as string) ||
      ![1, -1].includes(r.value as number) ||
      !strings(r.itemIds, 10) ||
      !r.itemIds.every((id) => ids.has(id) && ids.get(id) === r.demo)
    )
      return bad();
    unique.add(r.id as string);
  }
  const p = v.preferences;
  if (
    p.id !== 'profile' ||
    !str(p.name, 60) ||
    !strings(p.favoriteColors, 10) ||
    !p.favoriteColors.every((c) => c in colors) ||
    !strings(p.styles, 5) ||
    !p.styles.every((s) => styles.includes(s as (typeof styles)[number])) ||
    !str(p.dislikedPairs, 3000) ||
    !num(p.comfortMin, -25, 40) ||
    !num(p.comfortMax, -25, 40) ||
    (p.comfortMin as number) > (p.comfortMax as number) ||
    !['auto', 'love', 'minimal'].includes(p.layering as string) ||
    typeof p.onboarded !== 'boolean' ||
    typeof p.demoMode !== 'boolean' ||
    (v.weather !== undefined && !validWeather(v.weather))
  )
    return bad();
  return v as unknown as {
    items: Item[];
    outfits: Outfit[];
    ratings: Rating[];
    preferences: Preferences;
    weather?: Weather;
  };
}
export async function importBackup(raw: string) {
  const b = validateBackup(raw);
  await db.transaction(
    'rw',
    [db.items, db.outfits, db.ratings, db.preferences, db.meta],
    async () => {
      await db.items.clear();
      await db.outfits.clear();
      await db.ratings.clear();
      await db.meta.clear();
      await db.items.bulkPut(b.items);
      await db.outfits.bulkPut(b.outfits);
      await db.ratings.bulkPut(b.ratings);
      await db.preferences.put(b.preferences);
      if (b.weather) await db.meta.put({ id: 'weather', value: b.weather });
    },
  );
  return b.preferences;
}
