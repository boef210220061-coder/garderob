import { describe, it, expect } from 'vitest';
import { recommend, signature } from '../../src/engine';
import { defaultPreferences, defaultWeather, type Item, type Weather } from '../../src/types';
const item = (id: string, category: Item['category'], props: Partial<Item> = {}): Item => ({
  id,
  category,
  name: id,
  photo: 'data:image/jpeg;base64,AA==',
  color: 'бежевый',
  secondColor: '',
  style: 'casual',
  minTemp: -25,
  maxTemp: 40,
  rain: true,
  season: 'Всесезонная',
  notes: '',
  subcategory: '',
  createdAt: 1,
  demo: false,
  ...props,
});
const wardrobe = [
  item('top', 'top'),
  item('bottom', 'bottom'),
  item('shoes', 'shoes'),
  item('coat', 'outer'),
  item('dress', 'dress'),
  item('bag', 'accessory'),
  item('top2', 'top', { color: 'чёрный' }),
  item('shoe2', 'shoes', { color: 'белый' }),
];
describe('weather and real wardrobe invariants', () => {
  for (const temp of [-25, 40])
    it(`supports extreme ${temp} with default comfort preferences`, () => {
      expect(
        recommend(wardrobe, { ...defaultWeather, temp }, defaultPreferences, []).suggestions.length,
      ).toBeGreaterThan(0);
    });
  it('reports empty wardrobe honestly', () => {
    expect(recommend([], defaultWeather, defaultPreferences, []).missing.length).toBeGreaterThan(0);
  });
  for (const temp of [-25, -10, 0, 10, 20, 40])
    for (const condition of ['sun', 'cloud', 'rain', 'snow'] as const)
      it(`${temp} ${condition}: real ids, valid composition, weather`, () => {
        const weather: Weather = { ...defaultWeather, temp, condition };
        const result = recommend(
          wardrobe,
          weather,
          { ...defaultPreferences, comfortMin: -25, comfortMax: 40 },
          [],
        );
        expect(result.suggestions.length).toBeGreaterThan(0);
        for (const s of result.suggestions) {
          expect(s.ids.every((id) => wardrobe.some((i) => i.id === id))).toBe(true);
          const cats = s.ids.map((id) => wardrobe.find((i) => i.id === id)!.category);
          expect(cats.includes('dress') || (cats.includes('top') && cats.includes('bottom'))).toBe(
            true,
          );
          expect(cats.includes('dress') && cats.includes('bottom')).toBe(false);
          expect(cats).toContain('shoes');
          if (temp < 15 || ['rain', 'snow'].includes(condition)) expect(cats).toContain('outer');
        }
      });
  it('never substitutes unsafe rain footwear', () => {
    const w = wardrobe
      .filter((i) => i.category !== 'shoes')
      .concat(item('dry', 'shoes', { rain: false }));
    expect(
      recommend(w, { ...defaultWeather, condition: 'rain' }, defaultPreferences, []).suggestions,
    ).toEqual([]);
  });
  it('respects individual thermal limits', () => {
    const w = wardrobe.map((i) => ({ ...i, minTemp: 15, maxTemp: 25 }));
    expect(
      recommend(w, { ...defaultWeather, temp: -10 }, defaultPreferences, []).suggestions,
    ).toEqual([]);
  });
  it('offers unique alternatives and rotates away from seen sets', () => {
    const a = recommend(wardrobe, defaultWeather, defaultPreferences, []);
    expect(new Set(a.suggestions.map((o) => signature(o.ids))).size).toBe(3);
    const b = recommend(
      wardrobe,
      defaultWeather,
      defaultPreferences,
      [],
      a.suggestions.map((o) => signature(o.ids)),
    );
    expect(a.suggestions.some((o) => signature(o.ids) === signature(b.suggestions[0].ids))).toBe(
      false,
    );
  });
  it('negative feedback changes ranking', () => {
    const a = recommend(wardrobe, defaultWeather, defaultPreferences, []).suggestions[0];
    const b = recommend(wardrobe, defaultWeather, defaultPreferences, [
      { id: signature(a.ids), itemIds: a.ids, value: -1, demo: false },
    ]).suggestions[0];
    expect(signature(a.ids)).not.toBe(signature(b.ids));
  });
  it('excluded colors cannot occur together', () => {
    const w = wardrobe.map((i) =>
      i.id === 'top'
        ? { ...i, color: 'розовый' }
        : i.id === 'bottom'
          ? { ...i, color: 'красный' }
          : i,
    );
    const r = recommend(
      w,
      defaultWeather,
      { ...defaultPreferences, dislikedPairs: 'розовый + красный' },
      [],
    );
    for (const s of r.suggestions)
      expect(s.ids.includes('top') && s.ids.includes('bottom')).toBe(false);
  });
  it('favorite colors affect future suggestions', () => {
    const w = [
      item('pink', 'dress', { color: 'розовый' }),
      item('blue', 'dress', { color: 'синий' }),
      item('shoe', 'shoes'),
    ];
    const r = recommend(
      w,
      defaultWeather,
      { ...defaultPreferences, favoriteColors: ['розовый'] },
      [],
    );
    expect(r.suggestions[0].ids).toContain('pink');
  });
  it('wind and comfort preferences require protection', () => {
    const r = recommend(
      wardrobe,
      { ...defaultWeather, temp: 19, wind: 10 },
      { ...defaultPreferences, comfortMin: 22 },
      [],
    );
    expect(r.suggestions[0].ids).toContain('coat');
  });
});
