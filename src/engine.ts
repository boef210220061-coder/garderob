import {
  type Item,
  type Preferences,
  type Weather,
  type Rating,
  type Suggestion,
  categories,
} from './types';
const neutrals = new Set(['белый', 'чёрный', 'бежевый', 'серый', 'коричневый']);
const hue: Record<string, number> = {
  розовый: 335,
  красный: 350,
  зелёный: 140,
  синий: 220,
  голубой: 200,
};
export const signature = (ids: string[]) => [...ids].sort().join('|');
export function harmony(a: string, b: string) {
  if (a === b || neutrals.has(a) || neutrals.has(b)) return 3;
  const d = Math.min(
    Math.abs((hue[a] ?? 0) - (hue[b] ?? 0)),
    360 - Math.abs((hue[a] ?? 0) - (hue[b] ?? 0)),
  );
  return d <= 45 || d >= 150 ? 2 : -4;
}
export function recommend(
  items: Item[],
  weather: Weather,
  prefs: Preferences,
  ratings: Rating[],
  seen: string[] = [],
): { suggestions: Suggestion[]; missing: string[] } {
  const apparent = Math.max(
    -25,
    Math.min(
      40,
      weather.temp -
        (weather.wind >= 8 ? 3 : 0) -
        (weather.temp < prefs.comfortMin ? 2 : weather.temp > prefs.comfortMax ? -2 : 0),
    ),
  );
  const wet = weather.condition === 'rain' || weather.condition === 'snow';
  const pool = items.filter(
    (i) =>
      apparent >= i.minTemp &&
      apparent <= i.maxTemp &&
      (!wet || !['shoes', 'outer'].includes(i.category) || i.rain),
  );
  const by = (c: Item['category']) => pool.filter((i) => i.category === c);
  const bases: Item[][] = [];
  for (const t of by('top')) for (const b of by('bottom')) bases.push([t, b]);
  for (const d of by('dress')) bases.push([d]);
  const missing: string[] = [];
  if (!bases.length) missing.push('Верх и низ или платье для этой температуры');
  if (!by('shoes').length)
    missing.push(wet ? 'Непромокаемая обувь для этой погоды' : 'Обувь для этой температуры');
  const needOuter = apparent < 15 || wet || (weather.wind >= 8 && apparent < 22);
  if (needOuter && !by('outer').length)
    missing.push(wet ? 'Непромокаемая верхняя одежда' : 'Тёплая верхняя одежда');
  if (missing.length) return { suggestions: [], missing };
  let candidates: Suggestion[] = [];
  const coats: (Item | null)[] = needOuter
    ? by('outer')
    : prefs.layering === 'love' && apparent < 23 && by('outer').length
      ? by('outer')
      : [null];
  const extras: (Item | null)[] = [null, ...by('accessory')];
  for (const base of bases)
    for (const shoe of by('shoes'))
      for (const coat of coats)
        for (const acc of extras) {
          const parts = [...base, shoe, ...(coat ? [coat] : []), ...(acc ? [acc] : [])];
          if (
            parts.some((a) =>
              parts.some(
                (b) =>
                  a.id !== b.id &&
                  ((a.style === 'sporty' && b.style === 'romantic') ||
                    (a.style === 'romantic' && b.style === 'sporty')),
              ),
            )
          )
            continue;
          const banned = prefs.dislikedPairs
            .toLowerCase()
            .split(/[;\n]/)
            .map((p) => p.trim())
            .filter(Boolean);
          if (
            banned.some((pair) => {
              const cs = pair.split(/[+,/]/).map((x) => x.trim());
              return (
                cs.length >= 2 &&
                cs.every((c) => parts.some((p) => p.color === c || p.secondColor === c))
              );
            })
          )
            continue;
          const ids = parts.map((i) => i.id);
          let score = 0;
          for (let a = 0; a < parts.length; a++)
            for (let b = a + 1; b < parts.length; b++) {
              score += harmony(parts[a].color, parts[b].color);
              if (parts[a].secondColor)
                score += harmony(parts[a].secondColor, parts[b].color) * 0.5;
              if (parts[b].secondColor)
                score += harmony(parts[a].color, parts[b].secondColor) * 0.5;
            }
          score += parts.filter((i) => prefs.favoriteColors.includes(i.color)).length * 3;
          score +=
            parts.filter((i) =>
              (weather.style === 'any' ? prefs.styles : [weather.style]).includes(i.style),
            ).length * 5;
          const wanted =
            weather.occasion === 'Свидание'
              ? 'romantic'
              : ['Работа', 'Мероприятие'].includes(weather.occasion)
                ? 'classic'
                : weather.occasion === 'Прогулка'
                  ? 'casual'
                  : null;
          score += parts.filter((i) => i.style === wanted).length * 4;
          for (const r of ratings) {
            if (signature(r.itemIds) === signature(ids)) score += r.value * 40;
            score += r.value * parts.filter((i) => r.itemIds.includes(i.id)).length * 2;
          }
          if (seen.includes(signature(ids))) score -= 1000;
          score += parts.reduce(
            (s, i) => s + Math.min(apparent - i.minTemp, i.maxTemp - apparent) * 0.12,
            0,
          );
          const reason = [
            needOuter
              ? 'Верхний слой защищает от прохлады' + (wet ? ' и осадков.' : '.')
              : 'Вещи подходят для тёплой погоды.',
            wet
              ? 'Обувь отмечена как подходящая для дождя.'
              : 'Температурные диапазоны всех вещей подходят.',
            'Цвета оценены по нейтральным, близким и комплементарным сочетаниям.',
            wanted
              ? `Учитываем повод «${weather.occasion}».`
              : 'Учитываем ваши цвета, стили и оценки.',
          ].join(' ');
          candidates.push({ ids, score, reason, variant: '' });
        }
  candidates.sort((a, b) => b.score - a.score || signature(a.ids).localeCompare(signature(b.ids)));
  const chosen: Suggestion[] = [];
  for (const variant of ['Комфортный', 'Стильный', 'Альтернативный']) {
    const ranked = candidates
      .map((c) => ({
        ...c,
        score:
          c.score +
          (variant === 'Комфортный'
            ? (6 - c.ids.length) * 3
            : variant === 'Стильный'
              ? c.ids.length * 2
              : 0) -
          chosen.reduce((s, o) => s + c.ids.filter((id) => o.ids.includes(id)).length * 3, 0),
      }))
      .sort((a, b) => b.score - a.score);
    const next = ranked.find((c) => !chosen.some((o) => signature(o.ids) === signature(c.ids)));
    if (next) chosen.push({ ...next, variant });
  }
  return {
    suggestions: chosen,
    missing: chosen.length ? [] : ['Нет совместимых сочетаний с учётом стиля и ваших исключений'],
  };
}
export function explainItems(items: Item[]) {
  return items.map((i) => `${categories[i.category]}: ${i.name}`).join(', ');
}
