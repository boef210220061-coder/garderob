import { beforeEach, it, expect } from 'vitest';
import { db, exportBackup, importBackup, deleteItem, validateBackup } from '../../src/db';
import { defaultPreferences, defaultWeather, type Item } from '../../src/types';
const item: Item = {
  id: 'a',
  name: 'Платье',
  category: 'dress',
  style: 'classic',
  color: 'чёрный',
  secondColor: '',
  subcategory: '',
  season: 'Лето',
  minTemp: 15,
  maxTemp: 35,
  rain: false,
  notes: '',
  photo: 'data:image/jpeg;base64,AA==',
  demo: false,
  createdAt: 1,
};
beforeEach(async () => {
  await Promise.all([
    db.items.clear(),
    db.outfits.clear(),
    db.ratings.clear(),
    db.preferences.clear(),
    db.meta.clear(),
  ]);
});
it('roundtrips photos, favorites, ratings, profile and weather', async () => {
  await db.items.put(item);
  await db.preferences.put({ ...defaultPreferences, name: 'Аня', onboarded: true });
  await db.outfits.put({
    id: 'o',
    itemIds: ['a'],
    name: 'Образ',
    reason: 'Причина',
    demo: false,
    createdAt: 1,
    weather: defaultWeather,
  });
  await db.ratings.put({ id: 'r', itemIds: ['a'], value: 1, demo: false });
  await db.meta.put({ id: 'weather', value: defaultWeather });
  const backup = await exportBackup();
  await db.items.clear();
  await importBackup(backup);
  expect((await db.items.get('a'))?.photo).toBe(item.photo);
  expect(await db.outfits.count()).toBe(1);
  expect(await db.ratings.count()).toBe(1);
  expect((await db.preferences.get('profile'))?.name).toBe('Аня');
});
it('cascades deletion of outfits and ratings', async () => {
  await db.items.put(item);
  await db.outfits.put({
    id: 'o',
    itemIds: ['a'],
    name: 'Образ',
    reason: '',
    demo: false,
    createdAt: 1,
    weather: defaultWeather,
  });
  await db.ratings.put({ id: 'r', itemIds: ['a'], value: -1, demo: false });
  await deleteItem('a');
  expect(await db.items.count()).toBe(0);
  expect(await db.outfits.count()).toBe(0);
  expect(await db.ratings.count()).toBe(0);
});
it('rejects malformed backup without touching stored data', async () => {
  await db.items.put(item);
  await expect(importBackup('{"format":"other"}')).rejects.toThrow();
  expect(await db.items.count()).toBe(1);
});
it('rejects remote photo URL and dangling outfit refs', async () => {
  await db.items.put(item);
  let b = JSON.parse(await exportBackup());
  b.items[0].photo = 'https://example.com/photo.jpg';
  expect(() => validateBackup(JSON.stringify(b))).toThrow();
  b = JSON.parse(await exportBackup());
  b.outfits = [
    {
      id: 'x',
      itemIds: ['ghost'],
      name: 'x',
      reason: '',
      createdAt: 1,
      weather: defaultWeather,
      demo: false,
    },
  ];
  expect(() => validateBackup(JSON.stringify(b))).toThrow();
});
it('rejects mixed demo and personal outfit references', async () => {
  await db.items.put({ ...item, demo: true });
  let b = JSON.parse(await exportBackup());
  b.outfits = [
    {
      id: 'x',
      itemIds: ['a'],
      name: 'x',
      reason: '',
      createdAt: 1,
      weather: defaultWeather,
      demo: false,
    },
  ];
  expect(() => validateBackup(JSON.stringify(b))).toThrow();
});
