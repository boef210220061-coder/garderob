import { useRef, useState, type FormEvent } from 'react';
import { Camera, Upload, Check, LoaderCircle } from 'lucide-react';
import { categories, colors, styles, styleNames, type Item } from './types';
import { compressPhoto } from './images';
import { Button } from './components';
export default function ItemForm({
  item,
  onSave,
}: {
  item?: Item;
  onSave: (item: Item) => Promise<void>;
}) {
  const [value, setValue] = useState<Item>(
    item ?? {
      id: crypto.randomUUID(),
      name: '',
      category: 'top',
      subcategory: '',
      color: 'бежевый',
      secondColor: '',
      season: 'Всесезонная',
      style: 'casual',
      minTemp: 10,
      maxTemp: 28,
      rain: false,
      notes: '',
      photo: '',
      demo: false,
      createdAt: Date.now(),
    },
  );
  const [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const gallery = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  const patch = (v: Partial<Item>) => setValue((x) => ({ ...x, ...v }));
  async function photo(file?: File) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      patch({ photo: await compressPhoto(file) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!value.name.trim()) {
      setError('Укажите название вещи');
      return;
    }
    if (!value.photo) {
      setError('Добавьте фотографию вещи');
      return;
    }
    if (value.minTemp > value.maxTemp) {
      setError('Минимальная температура должна быть не выше максимальной');
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...value, name: value.name.trim() });
    } catch {
      setError('Не удалось сохранить вещь. Проверьте свободное место на устройстве.');
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="item-form">
      <div className={`photo-upload ${busy ? 'skeleton' : ''}`}>
        {busy ? (
          <>
            <LoaderCircle className="spin" aria-hidden="true" />
            <span role="status">Обрабатываем фото…</span>
          </>
        ) : value.photo ? (
          <img src={value.photo} alt="Фото вещи" />
        ) : (
          <>
            <Camera size={36} strokeWidth={1.3} aria-hidden="true" />
            <p>Ваша вещь в лучшем свете</p>
            <span>Фото целиком, на спокойном фоне</span>
          </>
        )}
      </div>
      <div className="button-row">
        <Button secondary onClick={() => gallery.current?.click()} disabled={busy}>
          <Upload size={17} aria-hidden="true" />
          Из галереи
        </Button>
        <Button secondary onClick={() => camera.current?.click()} disabled={busy}>
          <Camera size={17} aria-hidden="true" />
          Камера
        </Button>
      </div>
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        aria-label="Фотография из галереи"
        hidden
        onChange={(e) => photo(e.target.files?.[0])}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Снять фотографию"
        hidden
        onChange={(e) => photo(e.target.files?.[0])}
      />
      <label>
        Название
        <input
          required
          maxLength={100}
          value={value.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Например, любимый свитер"
        />
      </label>
      <div className="form-grid">
        <label>
          Категория
          <select
            value={value.category}
            onChange={(e) => patch({ category: e.target.value as Item['category'] })}
          >
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Подкатегория
          <input
            maxLength={100}
            value={value.subcategory}
            onChange={(e) => patch({ subcategory: e.target.value })}
            placeholder="Свитер, джинсы…"
          />
        </label>
        <label>
          Основной цвет
          <select value={value.color} onChange={(e) => patch({ color: e.target.value })}>
            {Object.keys(colors).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Дополнительный цвет
          <select
            value={value.secondColor}
            onChange={(e) => patch({ secondColor: e.target.value })}
          >
            <option value="">Без второго цвета</option>
            {Object.keys(colors).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Сезон
          <select value={value.season} onChange={(e) => patch({ season: e.target.value })}>
            {['Всесезонная', 'Лето', 'Зима', 'Весна / осень'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Стиль
          <select value={value.style} onChange={(e) => patch({ style: e.target.value })}>
            {styles.map((s) => (
              <option key={s} value={s}>
                {styleNames[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Температура от, °C
          <input
            type="number"
            min={-25}
            max={40}
            required
            value={value.minTemp}
            onChange={(e) => patch({ minTemp: Number(e.target.value) })}
          />
        </label>
        <label>
          Температура до, °C
          <input
            type="number"
            min={-25}
            max={40}
            required
            value={value.maxTemp}
            onChange={(e) => patch({ maxTemp: Number(e.target.value) })}
          />
        </label>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={value.rain}
          onChange={(e) => patch({ rain: e.target.checked })}
        />
        Подходит для дождя и снега
      </label>
      <label>
        Заметки
        <textarea
          maxLength={3000}
          value={value.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Посадка, ткань, любимые сочетания"
          rows={2}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || saving} className="full">
        <Check size={18} aria-hidden="true" />
        {saving ? 'Сохраняем…' : item ? 'Сохранить изменения' : 'Добавить в гардероб'}
      </Button>
      <p className="fine-print">Фото сжимается на устройстве. Пропорции сохраняются.</p>
    </form>
  );
}
