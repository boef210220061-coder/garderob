import { db } from './db';
import { type Item } from './types';
const samples: [number, string, Item['category'], string, string][] = [
  [162, 'Небесно-голубое платье', 'dress', 'голубой', 'romantic'],
  [164, 'Платье в сером оттенке', 'dress', 'серый', 'classic'],
  [165, 'Мятное платье', 'dress', 'зелёный', 'romantic'],
  [166, 'Платье в клетку', 'dress', 'серый', 'casual'],
  [177, 'Чёрное вечернее платье', 'dress', 'чёрный', 'classic'],
  [180, 'Платье в горошек', 'dress', 'белый', 'romantic'],
  [186, 'Чёрные босоножки', 'shoes', 'чёрный', 'classic'],
  [187, 'Золотистые туфли', 'shoes', 'бежевый', 'romantic'],
  [188, 'Классические туфли', 'shoes', 'чёрный', 'classic'],
  [173, 'Кожаная сумка', 'accessory', 'коричневый', 'classic'],
  [174, 'Голубая сумка', 'accessory', 'голубой', 'classic'],
  [176, 'Чёрная сумка', 'accessory', 'чёрный', 'casual'],
  [86, 'Рубашка с коротким рукавом', 'top', 'синий', 'casual'],
];
export async function enableDemo() {
  if (await db.items.get('demo-162')) return;
  const items = await Promise.all(
    samples.map(async ([id, name, category, color, style], index) => {
      const res = await fetch(`${import.meta.env.BASE_URL}demo/${id}.webp`);
      if (!res.ok) throw Error('Не удалось загрузить демофото');
      const blob = await res.blob();
      const photo = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return {
        id: `demo-${id}`,
        name,
        category,
        color,
        style,
        subcategory: '',
        secondColor: '',
        season: 'Весна / осень',
        minTemp: 14,
        maxTemp: 32,
        rain: false,
        notes: 'Демонстрационная вещь. Фото из открытого каталога DummyJSON.',
        photo,
        demo: true,
        createdAt: Date.now() - index * 1000,
      } satisfies Item;
    }),
  );
  await db.items.bulkPut(items);
}
