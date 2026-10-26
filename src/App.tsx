import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  Home,
  Shirt,
  Sparkles,
  Heart,
  Settings,
  Plus,
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wind,
  Check,
  Trash2,
  Pencil,
  Download,
  Upload,
  ShieldCheck,
  Smartphone,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  CloudSun,
  Info,
} from 'lucide-react';
import { db, deleteItem, exportBackup, importBackup, validateBackup } from './db';
import {
  categories,
  colors,
  styles,
  styleNames,
  weatherNames,
  occasions,
  defaultPreferences,
  defaultWeather,
  type Item,
  type Preferences,
  type Weather,
  type Suggestion,
  type Outfit,
} from './types';
import { recommend, signature } from './engine';
import { enableDemo } from './demo';
import {
  Button,
  Modal,
  Board,
  WeatherIcon,
  Empty,
  ItemCard,
  SectionHeading,
  FavoriteIcon,
} from './components';
import ItemForm from './ItemForm';
type Page = 'home' | 'wardrobe' | 'generator' | 'favorites' | 'settings';
const nav = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'wardrobe', label: 'Гардероб', icon: Shirt },
  { id: 'generator', label: 'Подбор', icon: Sparkles },
  { id: 'favorites', label: 'Избранное', icon: Heart },
  { id: 'settings', label: 'Настройки', icon: Settings },
] as const;
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function App() {
  const profile = useLiveQuery(() => db.preferences.get('profile')),
    allItems = useLiveQuery(() => db.items.orderBy('createdAt').reverse().toArray()),
    allOutfits = useLiveQuery(() => db.outfits.orderBy('createdAt').reverse().toArray()),
    ratings = useLiveQuery(() => db.ratings.toArray());
  const prefs = profile ?? defaultPreferences;
  const [page, setPage] = useState<Page>(() => {
    const x = location.hash.slice(1);
    return nav.some((n) => n.id === x) ? (x as Page) : 'home';
  });
  const [weather, setWeather] = useState<Weather>(defaultWeather),
    [weatherReady, setWeatherReady] = useState(false),
    [toast, setToast] = useState(''),
    [error, setError] = useState('');
  const [form, setForm] = useState<Item | 'new' | null>(null),
    [detail, setDetail] = useState<Item | null>(null),
    [confirmDelete, setConfirmDelete] = useState<Item | null>(null),
    [install, setInstall] = useState(false),
    [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null);
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all'),
    [filterOpen, setFilterOpen] = useState(false),
    [color, setColor] = useState('all'),
    [filterStyle, setFilterStyle] = useState('all'),
    [season, setSeason] = useState('all');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]),
    [missing, setMissing] = useState<string[]>([]),
    [current, setCurrent] = useState(0),
    [generated, setGenerated] = useState(false),
    [seen, setSeen] = useState<string[]>([]),
    [savedView, setSavedView] = useState<Outfit | null>(null);
  const [restore, setRestore] = useState<{ text: string; count: number } | null>(null),
    [busy, setBusy] = useState(false);
  const importFile = useRef<HTMLInputElement>(null);
  const items = useMemo(
      () => (allItems ?? []).filter((i) => i.demo === prefs.demoMode),
      [allItems, prefs.demoMode],
    ),
    outfits = useMemo(
      () => (allOutfits ?? []).filter((o) => o.demo === prefs.demoMode),
      [allOutfits, prefs.demoMode],
    );
  const scopeRatings = useMemo(
    () => (ratings ?? []).filter((r) => r.demo === prefs.demoMode),
    [ratings, prefs.demoMode],
  );
  const suggestion = suggestions[current];
  const currentItems = suggestion ? items.filter((i) => suggestion.ids.includes(i.id)) : [];
  const preview = useMemo(
    () => recommend(items, weather, prefs, scopeRatings).suggestions[0],
    [items, weather, prefs, scopeRatings],
  );
  const previewItems = preview ? items.filter((i) => preview.ids.includes(i.id)) : [];
  const go = (p: Page) => {
    setPage(p);
    location.hash = p;
    setSavedView(null);
    window.scrollTo({ top: 0 });
  };
  const notify = (s: string) => {
    setToast(s);
    if ('vibrate' in navigator) navigator.vibrate(8);
  };
  const run = async (fn: () => Promise<void>) => {
    try {
      setError('');
      await fn();
    } catch (e) {
      setError((e as Error).message || 'Не удалось выполнить действие. Проверьте свободное место.');
    }
  };
  useEffect(() => {
    db.meta
      .get('weather')
      .then((v) => {
        if (v) setWeather(v.value);
        setWeatherReady(true);
      })
      .catch(() =>
        setError('Не удалось открыть локальное хранилище. Разрешите хранение данных в браузере.'),
      );
    const hash = () => {
      const p = location.hash.slice(1);
      if (nav.some((n) => n.id === p)) setPage(p as Page);
    };
    window.addEventListener('hashchange', hash);
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);
  useEffect(() => {
    if (weatherReady)
      db.meta
        .put({ id: 'weather', value: weather })
        .catch(() => setError('Не удалось сохранить погоду'));
  }, [weather, weatherReady]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setSuggestions([]);
    setGenerated(false);
    setSeen([]);
    setCurrent(0);
  }, [prefs.demoMode]);
  useEffect(() => {
    setSuggestions([]);
    setGenerated(false);
    setSeen([]);
  }, [weather]);
  async function finishOnboarding(demo: boolean, name: string) {
    setBusy(true);
    await run(async () => {
      if (demo) await enableDemo();
      await db.preferences.put({ ...prefs, onboarded: true, demoMode: demo, name: name.trim() });
      notify(demo ? 'Демогардероб готов к примерке' : 'Ваш гардероб начинается здесь');
    });
    setBusy(false);
  }
  function generate() {
    setSavedView(null);
    const result = recommend(items, weather, prefs, scopeRatings, seen);
    setSuggestions(result.suggestions);
    setMissing(result.missing);
    setCurrent(0);
    setGenerated(true);
    setSeen((s) =>
      [...s, ...result.suggestions.slice(0, 1).map((o) => signature(o.ids))].slice(-100),
    );
    go('generator');
  }
  async function saveOutfit() {
    if (!suggestion) return;
    const id = signature(suggestion.ids);
    const existing = outfits.find((o) => o.id === id);
    if (existing) {
      await db.outfits.delete(id);
      notify('Образ удалён из избранного');
      return;
    }
    await db.outfits.put({
      id,
      itemIds: suggestion.ids,
      name: `${suggestion.variant} · ${weather.occasion.toLowerCase()}`,
      weather: { ...weather },
      reason: suggestion.reason,
      demo: prefs.demoMode,
      createdAt: Date.now(),
    });
    notify('Образ в избранном');
  }
  async function rate(value: 1 | -1) {
    if (!suggestion) return;
    await db.ratings.put({
      id: signature(suggestion.ids),
      itemIds: suggestion.ids,
      value,
      demo: prefs.demoMode,
    });
    notify(value === 1 ? 'Запомнили, что вам нравится' : 'Учтём: этот образ будет ниже в подборке');
  }
  async function backup() {
    const text = await exportBackup();
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `pink-wardrobe-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    notify('Резервная копия скачана');
  }
  const activeRating = suggestion
    ? scopeRatings.find((r) => r.id === signature(suggestion.ids))?.value
    : undefined;
  const visible = items.filter(
    (i) =>
      (category === 'all' || i.category === category) &&
      (color === 'all' || i.color === color || i.secondColor === color) &&
      (filterStyle === 'all' || i.style === filterStyle) &&
      (season === 'all' || i.season === season) &&
      `${i.name} ${i.notes} ${i.subcategory}`.toLowerCase().includes(query.toLowerCase()),
  );
  if (!allItems || !allOutfits || !ratings || !weatherReady)
    return (
      <div className="loading-screen">
        <Shirt size={40} aria-hidden="true" />
        <p>Открываем ваш гардероб…</p>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <a href="#main" className="skip-link">
          Перейти к содержимому
        </a>
        <aside className="sidebar">
          <a href="#home" onClick={() => go('home')} className="brand">
            <span className="brand-mark">
              <Shirt strokeWidth={1.1} />
            </span>
            <span>
              pink<span className="brand-second">wardrobe</span>
            </span>
          </a>
          <p className="brand-caption">
            Меньше «нечего надеть».
            <br />
            Больше вас.
          </p>
          <nav aria-label="Основная навигация">
            {nav.map((n) => (
              <a
                href={`#${n.id}`}
                key={n.id}
                aria-current={page === n.id ? 'page' : undefined}
                className={page === n.id ? 'nav-active' : ''}
                onClick={() => go(n.id)}
              >
                <n.icon size={20} strokeWidth={1.5} aria-hidden="true" />
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="storage-note" onClick={() => setInstall(true)}>
              <ShieldCheck size={20} strokeWidth={1.4} aria-hidden="true" />
              <span>
                Ваш гардероб.
                <br />
                <strong>Только на вашем устройстве.</strong>
              </span>
            </button>
            <button className="profile-link" onClick={() => go('settings')}>
              <span className="avatar">{prefs.name?.[0]?.toUpperCase() || 'В'}</span>
              <span>
                {prefs.name || 'Ваш профиль'}
                <small>Личное пространство</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <a href="#home" onClick={() => go('home')} className="mobile-brand">
              <Shirt size={22} strokeWidth={1.3} aria-hidden="true" />
              pink wardrobe
            </a>
            <span className="desktop-only">Моё личное пространство</span>
            <div className="topbar-right">
              <span className={`scope-label ${prefs.demoMode ? 'demo' : ''}`}>
                {prefs.demoMode ? 'Демогардероб' : 'Личный гардероб'}
              </span>
              <button
                className="icon-btn profile-top"
                aria-label="Открыть профиль"
                onClick={() => go('settings')}
              >
                <span className="avatar small">{prefs.name?.[0]?.toUpperCase() || 'В'}</span>
              </button>
            </div>
          </header>
          <main id="main">
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
              >
                {page === 'home' && (
                  <>
                    <div className="greeting">
                      <h1>
                        Доброе утро,
                        <br />
                        {prefs.name || 'красавица'} <span aria-hidden="true">♡</span>
                      </h1>
                      <p>Хороший день начинается с любимых вещей.</p>
                    </div>
                    <div className="home-grid">
                      <div className="home-left">
                        <button
                          className="weather-card"
                          onClick={() => go('generator')}
                          aria-label="Изменить погоду"
                        >
                          <div>
                            <span>Погода для образа</span>
                            <div className="temperature">
                              {weather.temp > 0 ? '+' : ''}
                              {weather.temp}°<small>{weatherNames[weather.condition]}</small>
                            </div>
                            <p>
                              <Wind size={14} aria-hidden="true" />
                              {weather.wind} м/с <span>Задана вами</span>
                            </p>
                          </div>
                          <WeatherIcon condition={weather.condition} />
                          <ArrowUpRight className="weather-arrow" size={20} aria-hidden="true" />
                        </button>
                        <div className="inspiration">
                          <div className="inspiration-top">
                            <Sparkles size={23} strokeWidth={1.3} aria-hidden="true" />
                            <span>Всё нужное уже у вас</span>
                          </div>
                          <h2>
                            Новый день.
                            <br />
                            Ваш новый образ.
                          </h2>
                          <p>
                            Любимые вещи, свежие сочетания
                            <br className="desktop-only" /> и немного вдохновения.
                          </p>
                          <Button onClick={generate}>
                            Подобрать образ
                            <ArrowRight size={18} aria-hidden="true" />
                          </Button>
                          <small>По погоде, настроению и вашим правилам</small>
                        </div>
                      </div>
                      <section className="today-look">
                        <div className="today-heading">
                          <h2>Вдохновение на сегодня</h2>
                          <span>
                            {previewItems.length
                              ? `${previewItems.length} вещи из гардероба`
                              : 'Ваш будущий образ'}
                          </span>
                        </div>
                        <button
                          className="board-link"
                          onClick={generate}
                          aria-label="Открыть рекомендованный образ"
                        >
                          <Board items={previewItems} />
                        </button>
                        <div className="look-caption">
                          <div>
                            <p>
                              {previewItems.length
                                ? 'Маленькая история вашего стиля'
                                : 'Начните с любимых вещей'}
                            </p>
                            <span>
                              {previewItems.length
                                ? weather.occasion
                                : 'Добавьте фото, и мы найдём сочетания'}
                            </span>
                          </div>
                          <button
                            className="round-button"
                            onClick={generate}
                            aria-label="Посмотреть образ"
                          >
                            <ArrowUpRight size={22} aria-hidden="true" />
                          </button>
                        </div>
                      </section>
                    </div>
                    <div className="home-lower">
                      <section>
                        <SectionHeading
                          title="Недавно в гардеробе"
                          action="Все вещи"
                          onClick={() => go('wardrobe')}
                        />
                        {items.length ? (
                          <div className="recent-grid">
                            {items.slice(0, 3).map((i, n) => (
                              <ItemCard
                                key={i.id}
                                item={i}
                                index={n}
                                onClick={() => setDetail(i)}
                              />
                            ))}
                            <button className="add-tile" onClick={() => setForm('new')}>
                              <Plus size={26} strokeWidth={1.2} aria-hidden="true" />
                              <span>
                                Добавить
                                <br />
                                любимую вещь
                              </span>
                            </button>
                          </div>
                        ) : (
                          <Empty
                            title="Место для ваших вещей"
                            text="Начните с верха, низа и обуви — или с любимого платья."
                            action="Добавить вещь"
                            onAction={() => setForm('new')}
                          />
                        )}
                      </section>
                      <aside className="style-note">
                        <span className="note-spark">
                          <Sparkles size={20} strokeWidth={1.2} aria-hidden="true" />
                        </span>
                        <h2>
                          Стиль —<br />
                          это быть собой.
                        </h2>
                        <p>
                          Попробуйте один цвет в разных оттенках. Такие сочетания выглядят спокойно
                          и собранно.
                        </p>
                        <span>Маленькая заметка о стиле</span>
                      </aside>
                    </div>
                    <section className="home-favorites">
                      <SectionHeading
                        title="Хочется повторить"
                        action="Избранное"
                        onClick={() => go('favorites')}
                      />
                      {outfits.length ? (
                        <div className="saved-preview">
                          {outfits.slice(0, 2).map((o) => (
                            <button
                              key={o.id}
                              onClick={() => {
                                setSavedView(o);
                                go('favorites');
                                setSavedView(o);
                              }}
                            >
                              <Heart size={18} aria-hidden="true" />
                              <span>{o.name}</span>
                              <ArrowRight size={18} aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">
                          Сохраняйте удачные сочетания — любимые образы будут здесь.
                        </p>
                      )}
                    </section>
                  </>
                )}
                {page === 'wardrobe' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <h1>Мой гардероб</h1>
                        <p>
                          {items.length} вещей ·{' '}
                          {prefs.demoMode ? 'отдельная демоколлекция' : 'ваша личная коллекция'}
                        </p>
                      </div>
                      <Button onClick={() => setForm('new')}>
                        <Plus size={18} aria-hidden="true" />
                        <span>Добавить вещь</span>
                      </Button>
                    </div>
                    <div className="wardrobe-toolbar">
                      <label className="search-field">
                        <Search size={18} aria-hidden="true" />
                        <input
                          aria-label="Поиск по гардеробу"
                          placeholder="Найти ту самую вещь…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <button
                        aria-label="Фильтры"
                        className={`filter-btn ${filterOpen ? 'selected' : ''}`}
                        aria-expanded={filterOpen}
                        onClick={() => setFilterOpen(!filterOpen)}
                      >
                        <SlidersHorizontal size={18} aria-hidden="true" />
                        <span>Фильтры</span>
                      </button>
                    </div>
                    <div className="category-tabs" aria-label="Категории">
                      <button
                        aria-pressed={category === 'all'}
                        className={category === 'all' ? 'selected' : ''}
                        onClick={() => setCategory('all')}
                      >
                        Все вещи <span>{items.length}</span>
                      </button>
                      {Object.entries(categories).map(([k, v]) => (
                        <button
                          key={k}
                          aria-pressed={category === k}
                          className={category === k ? 'selected' : ''}
                          onClick={() => setCategory(k)}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    {filterOpen && (
                      <div className="filter-panel form-grid">
                        <label>
                          Цвет
                          <select value={color} onChange={(e) => setColor(e.target.value)}>
                            <option value="all">Любой цвет</option>
                            {Object.keys(colors).map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Стиль
                          <select
                            value={filterStyle}
                            onChange={(e) => setFilterStyle(e.target.value)}
                          >
                            <option value="all">Любой стиль</option>
                            {styles.map((s) => (
                              <option value={s} key={s}>
                                {styleNames[s]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Сезон
                          <select value={season} onChange={(e) => setSeason(e.target.value)}>
                            <option value="all">Все сезоны</option>
                            {['Всесезонная', 'Лето', 'Зима', 'Весна / осень'].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="text-btn"
                          onClick={() => {
                            setColor('all');
                            setFilterStyle('all');
                            setSeason('all');
                            setCategory('all');
                            setQuery('');
                          }}
                        >
                          Сбросить фильтры
                        </button>
                      </div>
                    )}
                    {visible.length ? (
                      <div className="wardrobe-grid">
                        {visible.map((i, n) => (
                          <ItemCard key={i.id} item={i} index={n} onClick={() => setDetail(i)} />
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title={items.length ? 'Ничего не нашлось' : 'Ваш стиль начинается здесь'}
                        text={
                          items.length
                            ? 'Попробуйте другой запрос или сбросьте фильтры.'
                            : 'Добавьте свои фотографии. Они останутся на этом устройстве.'
                        }
                        action={items.length ? undefined : 'Добавить первую вещь'}
                        onAction={() => setForm('new')}
                      />
                    )}
                  </>
                )}
                {page === 'generator' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <h1>{generated ? 'Ваши сочетания' : 'Что наденем сегодня?'}</h1>
                        <p>Ваша погода. Ваши планы. Только ваши вещи.</p>
                      </div>
                      <Sparkles className="page-symbol" size={30} strokeWidth={1} />
                    </div>
                    <div
                      className={`generator-grid ${generated && suggestion ? 'has-result' : ''}`}
                    >
                      <form
                        className="weather-form panel"
                        onSubmit={(e) => {
                          e.preventDefault();
                          generate();
                        }}
                      >
                        <h2>Начнём с погоды</h2>
                        <div className="temp-control">
                          <WeatherIcon condition={weather.condition} />
                          <label>
                            Температура, °C
                            <input
                              type="number"
                              min={-25}
                              max={40}
                              required
                              value={weather.temp}
                              onChange={(e) =>
                                setWeather({ ...weather, temp: Number(e.target.value) })
                              }
                            />
                          </label>
                        </div>
                        <input
                          className="temp-range"
                          type="range"
                          min={-25}
                          max={40}
                          value={weather.temp}
                          aria-label="Температура ползунок"
                          onChange={(e) => setWeather({ ...weather, temp: Number(e.target.value) })}
                        />
                        <div className="range-labels">
                          <span>−25°</span>
                          <span>+40°</span>
                        </div>
                        <fieldset>
                          <legend>За окном</legend>
                          <div className="weather-options">
                            {Object.entries(weatherNames).map(([k, v]) => (
                              <button
                                type="button"
                                key={k}
                                className={weather.condition === k ? 'selected' : ''}
                                aria-pressed={weather.condition === k}
                                onClick={() =>
                                  setWeather({ ...weather, condition: k as Weather['condition'] })
                                }
                              >
                                <WeatherIcon condition={k as Weather['condition']} />
                                <span>{v}</span>
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <label>
                          Ветер, м/с
                          <input
                            type="number"
                            min={0}
                            max={60}
                            required
                            value={weather.wind}
                            onChange={(e) =>
                              setWeather({ ...weather, wind: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          Какие планы?
                          <select
                            value={weather.occasion}
                            onChange={(e) => setWeather({ ...weather, occasion: e.target.value })}
                          >
                            {occasions.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Настроение образа
                          <select
                            value={weather.style}
                            onChange={(e) => setWeather({ ...weather, style: e.target.value })}
                          >
                            <option value="any">Доверюсь своему стилю</option>
                            {styles.map((s) => (
                              <option key={s} value={s}>
                                {styleNames[s]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button type="submit" className="full">
                          <Sparkles size={18} aria-hidden="true" />
                          Подобрать образ
                        </Button>
                        <p className="fine-print">
                          Погода задаётся вручную. Вещи выбираются локально по правилам сочетаний.
                        </p>
                      </form>
                      <section className="result-area">
                        {generated && suggestion && (
                          <button
                            className="edit-weather text-btn"
                            onClick={() => {
                              setGenerated(false);
                              setSuggestions([]);
                            }}
                          >
                            <ArrowLeft size={16} aria-hidden="true" />
                            Изменить погоду · {weather.temp}° · {weatherNames[weather.condition]}
                          </button>
                        )}
                        {savedView ? null : generated && suggestion ? (
                          <>
                            <div className="variant-tabs">
                              {suggestions.map((s, i) => (
                                <button
                                  key={signature(s.ids)}
                                  onClick={() => {
                                    setCurrent(i);
                                    setSeen((old) => [...old, signature(s.ids)].slice(-100));
                                  }}
                                  aria-pressed={current === i}
                                  className={current === i ? 'selected' : ''}
                                >
                                  {s.variant}
                                </button>
                              ))}
                            </div>
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={signature(suggestion.ids)}
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -12 }}
                                transition={{ duration: 0.18 }}
                              >
                                <Board items={currentItems} />
                              </motion.div>
                            </AnimatePresence>
                            <div className="result-actions">
                              <Button onClick={() => run(saveOutfit)} secondary>
                                <FavoriteIcon
                                  active={outfits.some((o) => o.id === signature(suggestion.ids))}
                                />
                                {outfits.some((o) => o.id === signature(suggestion.ids))
                                  ? 'Сохранён'
                                  : 'В избранное'}
                              </Button>
                              <Button onClick={generate} secondary>
                                <RefreshCw size={17} aria-hidden="true" />
                                Другой образ
                              </Button>
                            </div>
                            <div className="reason">
                              <h2>Почему это работает</h2>
                              <p>{suggestion.reason}</p>
                              <ul className="outfit-list">
                                {currentItems.map((i) => (
                                  <li key={i.id}>
                                    <button onClick={() => setDetail(i)}>
                                      <span
                                        className="color-dot"
                                        style={{ background: colors[i.color] }}
                                      />
                                      {i.name}
                                      <ChevronRight size={15} aria-hidden="true" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              <div className="rating">
                                <span>Это ваше?</span>
                                <button
                                  className="icon-btn"
                                  aria-label="Нравится образ"
                                  aria-pressed={activeRating === 1}
                                  onClick={() => run(() => rate(1))}
                                >
                                  <ThumbsUp size={19} aria-hidden="true" />
                                </button>
                                <button
                                  className="icon-btn"
                                  aria-label="Не нравится образ"
                                  aria-pressed={activeRating === -1}
                                  onClick={() => run(() => rate(-1))}
                                >
                                  <ThumbsDown size={19} aria-hidden="true" />
                                </button>
                              </div>
                              {suggestions.length < 3 && (
                                <p className="fine-print">
                                  Сейчас доступны {suggestions.length} разных сочетания. Больше
                                  вещей — больше вариантов.
                                </p>
                              )}
                            </div>
                          </>
                        ) : generated ? (
                          <Empty
                            title="Нужно немного дополнить гардероб"
                            text={`Для ${weather.temp > 0 ? '+' : ''}${weather.temp} °C и погоды «${weatherNames[weather.condition].toLowerCase()}» не хватает: ${missing.join('; ')}. Мы не добавляем несуществующие вещи.`}
                            action="Добавить вещь"
                            onAction={() => setForm('new')}
                          />
                        ) : (
                          <div className="generator-intro">
                            <Board items={previewItems} />
                            <h2>
                              Ваши вещи.
                              <br />
                              Новые возможности.
                            </h2>
                            <p>
                              Задайте погоду и повод — соберём до трёх разных сочетаний и объясним
                              выбор.
                            </p>
                          </div>
                        )}
                      </section>
                    </div>
                  </>
                )}
                {page === 'favorites' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <h1>{savedView ? 'Любимый образ' : 'Хочется повторить'}</h1>
                        <p>
                          {savedView
                            ? savedView.name
                            : `${outfits.length} сохранённых образов · ваши маленькие открытия`}
                        </p>
                      </div>
                      {savedView && (
                        <Button secondary onClick={() => setSavedView(null)}>
                          <ArrowLeft size={17} aria-hidden="true" />К образам
                        </Button>
                      )}
                    </div>
                    {savedView ? (
                      <div className="saved-detail">
                        <Board items={items.filter((i) => savedView.itemIds.includes(i.id))} />
                        <div className="panel">
                          <h2>{savedView.name}</h2>
                          <p>
                            {savedView.weather.temp} °C ·{' '}
                            {weatherNames[savedView.weather.condition]} ·{' '}
                            {savedView.weather.occasion}
                          </p>
                          <p>{savedView.reason}</p>
                          <ul className="outfit-list">
                            {items
                              .filter((i) => savedView.itemIds.includes(i.id))
                              .map((i) => (
                                <li key={i.id}>
                                  <button onClick={() => setDetail(i)}>
                                    {i.name}
                                    <ChevronRight size={16} aria-hidden="true" />
                                  </button>
                                </li>
                              ))}
                          </ul>
                          <Button
                            secondary
                            onClick={() =>
                              run(async () => {
                                await db.outfits.delete(savedView.id);
                                setSavedView(null);
                                notify('Образ удалён из избранного');
                              })
                            }
                          >
                            <Trash2 size={17} aria-hidden="true" />
                            Удалить из избранного
                          </Button>
                        </div>
                      </div>
                    ) : outfits.length ? (
                      <div className="favorites-grid">
                        {outfits.map((o) => (
                          <article className="favorite-card" key={o.id}>
                            <button
                              className="board-link"
                              onClick={() => setSavedView(o)}
                              aria-label={`Открыть ${o.name}`}
                            >
                              <Board
                                compact
                                items={items.filter((i) => o.itemIds.includes(i.id))}
                              />
                            </button>
                            <h2>{o.name}</h2>
                            <div className="favorite-footer">
                              <span>
                                {o.weather.temp}° · {weatherNames[o.weather.condition]}
                              </span>
                              <button
                                className="icon-btn"
                                aria-label={`Удалить образ ${o.name}`}
                                onClick={() =>
                                  run(async () => {
                                    await db.outfits.delete(o.id);
                                    notify('Образ удалён');
                                  })
                                }
                              >
                                <Heart size={20} fill="currentColor" aria-hidden="true" />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Оставьте место для любимого"
                        text="Сохраните первый удачный образ, и он всегда будет под рукой."
                        action="Подобрать образ"
                        onAction={() => go('generator')}
                      />
                    )}
                  </>
                )}
                {page === 'settings' && (
                  <>
                    <div className="page-heading">
                      <div>
                        <h1>Всё по-вашему</h1>
                        <p>Маленькие детали, которые делают стиль вашим.</p>
                      </div>
                    </div>
                    <SettingsForm
                      key={JSON.stringify(prefs)}
                      prefs={prefs}
                      onSave={async (p) => {
                        await db.preferences.put(p);
                        setSuggestions([]);
                        setGenerated(false);
                        notify('Предпочтения сохранены');
                      }}
                    />
                    <section className="settings-row">
                      <div>
                        <h2>Личное и демонстрационное</h2>
                        <p>
                          Это два отдельных гардероба. Собственные вещи добавляются только в личный.
                        </p>
                      </div>
                      <div className="panel">
                        <div className="scope-switch">
                          <button
                            aria-pressed={!prefs.demoMode}
                            className={!prefs.demoMode ? 'selected' : ''}
                            onClick={() =>
                              run(async () => {
                                await db.preferences.put({ ...prefs, demoMode: false });
                                notify('Открыт личный гардероб');
                              })
                            }
                          >
                            Мои вещи
                          </button>
                          <button
                            aria-pressed={prefs.demoMode}
                            className={prefs.demoMode ? 'selected' : ''}
                            onClick={() =>
                              run(async () => {
                                await enableDemo();
                                await db.preferences.put({ ...prefs, demoMode: true });
                                notify('Открыт демогардероб');
                              })
                            }
                          >
                            Демогардероб
                          </button>
                        </div>
                        <p className="fine-print">
                          В демо — фотографии каталога DummyJSON. Это примеры, не ваши вещи.
                          Диапазоны и стили демонстрационные.
                        </p>
                        <a
                          className="source-link"
                          href="https://dummyjson.com/docs/products"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Источник фотографий
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      </div>
                    </section>
                    <section className="settings-row">
                      <div>
                        <h2>Сохранить своё</h2>
                        <p>
                          Резервная копия содержит фотографии, образы, оценки, погоду и настройки
                          обоих гардеробов.
                        </p>
                      </div>
                      <div className="panel backup-panel">
                        <Button secondary onClick={() => run(backup)}>
                          <Download size={18} aria-hidden="true" />
                          Экспортировать копию
                        </Button>
                        <Button secondary onClick={() => importFile.current?.click()}>
                          <Upload size={18} aria-hidden="true" />
                          Восстановить из файла
                        </Button>
                        <input
                          ref={importFile}
                          type="file"
                          accept=".json,application/json"
                          aria-label="Файл резервной копии"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f)
                              run(async () => {
                                if (f.size > 100 * 1024 * 1024)
                                  throw Error('Максимальный размер копии — 100 МБ');
                                const text = await f.text();
                                const b = validateBackup(text);
                                setRestore({ text, count: b.items.length });
                              });
                          }}
                        />
                        <p className="fine-print">
                          Данные хранятся в этом браузере. Регулярно скачивайте копию: очистка
                          данных сайта удалит гардероб.
                        </p>
                      </div>
                    </section>
                    <section className="settings-row">
                      <div>
                        <h2>Всегда под рукой</h2>
                        <p>
                          Установите Pink Wardrobe на главный экран. После первого открытия
                          приложение работает и без интернета.
                        </p>
                      </div>
                      <div className="panel">
                        <Button secondary onClick={() => setInstall(true)}>
                          <Smartphone size={18} aria-hidden="true" />
                          Установить приложение
                        </Button>
                        <p className="fine-print">
                          Бесплатно. Без аккаунта, подписки и отправки фото на сервер.
                        </p>
                      </div>
                    </section>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
          <footer className="app-footer">
            <span>pink wardrobe</span>
            <span>С любовью к вещам, которые уже ваши.</span>
          </footer>
        </div>
        <nav className="bottom-nav" aria-label="Мобильная навигация">
          {nav.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={() => go(n.id)}
              aria-current={page === n.id ? 'page' : undefined}
            >
              <n.icon size={21} strokeWidth={page === n.id ? 2 : 1.4} aria-hidden="true" />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              className="toast"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
            >
              <Check size={18} aria-hidden="true" />
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        {error && (
          <Modal title="Не получилось" onClose={() => setError('')}>
            <p role="alert">{error}</p>
            <Button onClick={() => setError('')}>Понятно</Button>
          </Modal>
        )}
        {!prefs.onboarded && !error && <Welcome busy={busy} onStart={finishOnboarding} />}
        {form && (
          <Modal
            title={form === 'new' ? 'Новая любимая вещь' : 'Редактировать вещь'}
            wide
            onClose={() => setForm(null)}
          >
            <ItemForm
              item={form === 'new' ? undefined : form}
              onSave={async (i) => {
                await db.transaction('rw', db.items, db.preferences, async () => {
                  await db.items.put(i);
                  if (form === 'new' && prefs.demoMode)
                    await db.preferences.put({ ...prefs, demoMode: false });
                });
                setForm(null);
                setDetail(null);
                setSuggestions([]);
                setGenerated(false);
                notify('Вещь сохранена в гардеробе');
              }}
            />
          </Modal>
        )}
        {detail && !form && (
          <Modal title={detail.name} onClose={() => setDetail(null)}>
            <img className="detail-photo" src={detail.photo} alt={detail.name} />
            <div className="detail-tags">
              <span>
                {categories[detail.category]}
                {detail.subcategory ? ` · ${detail.subcategory}` : ''}
              </span>
              <span>{styleNames[detail.style]}</span>
              <span>
                {detail.minTemp}…{detail.maxTemp} °C
              </span>
              <span>{detail.season}</span>
              <span>
                {detail.color}
                {detail.secondColor ? ` + ${detail.secondColor}` : ''}
              </span>
              <span>{detail.rain ? 'Подходит для осадков' : 'Для сухой погоды'}</span>
            </div>
            {detail.notes && <p>{detail.notes}</p>}
            <div className="button-row">
              <Button
                secondary
                onClick={() => {
                  setForm(detail);
                }}
              >
                <Pencil size={17} aria-hidden="true" />
                Изменить
              </Button>
              <Button
                secondary
                onClick={() => {
                  setConfirmDelete(detail);
                  setDetail(null);
                }}
              >
                <Trash2 size={17} aria-hidden="true" />
                Удалить
              </Button>
            </div>
          </Modal>
        )}
        {confirmDelete && (
          <Modal title="Попрощаться с вещью?" onClose={() => setConfirmDelete(null)}>
            <p>
              «{confirmDelete.name}» будет удалена. Сохранённые образы и оценки с этой вещью тоже
              удалятся.
            </p>
            <div className="button-row">
              <Button secondary onClick={() => setConfirmDelete(null)}>
                Оставить
              </Button>
              <Button
                onClick={() =>
                  run(async () => {
                    await deleteItem(confirmDelete.id);
                    setConfirmDelete(null);
                    setSuggestions([]);
                    setGenerated(false);
                    notify('Вещь удалена');
                  })
                }
              >
                Удалить вещь
              </Button>
            </div>
          </Modal>
        )}
        {restore && (
          <Modal title="Восстановить гардероб?" onClose={() => setRestore(null)}>
            <p>
              В копии {restore.count} вещей. Текущие вещи, образы, оценки и настройки будут
              заменены. Перед восстановлением можно скачать текущую копию.
            </p>
            <div className="button-row">
              <Button secondary onClick={() => run(backup)}>
                Скачать текущую
              </Button>
              <Button
                onClick={() =>
                  run(async () => {
                    await importBackup(restore.text);
                    const w = await db.meta.get('weather');
                    setWeather(w?.value ?? defaultWeather);
                    setRestore(null);
                    setSuggestions([]);
                    setGenerated(false);
                    setSeen([]);
                    notify('Гардероб восстановлен вместе с фото');
                  })
                }
              >
                Восстановить
              </Button>
            </div>
          </Modal>
        )}
        {install && (
          <Modal title="Ваш гардероб — рядом" onClose={() => setInstall(false)}>
            <Smartphone size={42} strokeWidth={1.1} aria-hidden="true" />
            <p>
              На iPhone откройте приложение в Safari, нажмите «Поделиться», затем «На экран
              “Домой”».
            </p>
            <p>
              В Chrome Android откройте меню и выберите «Установить приложение» или «Добавить на
              главный экран».
            </p>
            {installPrompt && (
              <Button
                onClick={() =>
                  run(async () => {
                    await installPrompt.prompt();
                    await installPrompt.userChoice;
                    setInstallPrompt(null);
                    setInstall(false);
                  })
                }
              >
                Установить
              </Button>
            )}
            <p className="fine-print">
              Установка и автономный режим доступны в production-сборке через HTTPS или localhost. В
              локальной сети без HTTPS можно открыть приложение в браузере.
            </p>
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}
function Welcome({
  busy,
  onStart,
}: {
  busy: boolean;
  onStart: (demo: boolean, name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  return (
    <Modal
      title="Добро пожаловать"
      onClose={() => {
        if (!busy) onStart(false, name);
      }}
    >
      <div className="welcome">
        <div className="welcome-mark">
          <Shirt size={54} strokeWidth={0.8} aria-hidden="true" />
        </div>
        <h2>
          Ваш гардероб.
          <br />
          Новая история.
        </h2>
        <p>
          Пусть любимые вещи находят друг друга.
          <br />
          Подбирайте образы по погоде и настроению.
        </p>
        <label>
          Как вас называть?
          <input
            value={name}
            maxLength={60}
            placeholder="Ваше имя — по желанию"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button className="full" disabled={busy} onClick={() => onStart(false, name)}>
          Начать со своих вещей
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
        <Button className="full" secondary disabled={busy} onClick={() => onStart(true, name)}>
          {busy ? 'Готовим гардероб…' : 'Сначала попробовать демо'}
        </Button>
        <p className="fine-print">
          <ShieldCheck size={15} aria-hidden="true" />
          Фото остаются на устройстве. Без регистрации.
        </p>
      </div>
    </Modal>
  );
}
function SettingsForm({
  prefs,
  onSave,
}: {
  prefs: Preferences;
  onSave: (p: Preferences) => Promise<void>;
}) {
  const [p, setP] = useState(prefs),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  function patch(v: Partial<Preferences>) {
    setP((x) => ({ ...x, ...v }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (p.comfortMin > p.comfortMax) {
      setError('Проверьте порядок температур');
      return;
    }
    setSaving(true);
    try {
      await onSave(p);
    } catch {
      setError('Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="settings-form">
      <section className="settings-row">
        <div>
          <h2>Знакомство со стилем</h2>
          <p>Учитываем любимые оттенки и стили при следующем подборе.</p>
        </div>
        <div className="panel">
          <label>
            Ваше имя
            <input
              maxLength={60}
              value={p.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Как вас называть?"
            />
          </label>
          <fieldset>
            <legend>Любимые цвета</legend>
            <div className="color-options">
              {Object.entries(colors).map(([c, hex]) => (
                <button
                  type="button"
                  key={c}
                  className={p.favoriteColors.includes(c) ? 'selected' : ''}
                  aria-pressed={p.favoriteColors.includes(c)}
                  onClick={() =>
                    patch({
                      favoriteColors: p.favoriteColors.includes(c)
                        ? p.favoriteColors.filter((x) => x !== c)
                        : [...p.favoriteColors, c],
                    })
                  }
                >
                  <span className="color-dot" style={{ background: hex }} />
                  {c}
                  {p.favoriteColors.includes(c) && <Check size={13} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Близкие вам стили</legend>
            <div className="style-options">
              {styles.map((s) => (
                <button
                  type="button"
                  key={s}
                  aria-pressed={p.styles.includes(s)}
                  className={p.styles.includes(s) ? 'selected' : ''}
                  onClick={() =>
                    patch({
                      styles: p.styles.includes(s)
                        ? p.styles.filter((x) => x !== s)
                        : [...p.styles, s],
                    })
                  }
                >
                  {styleNames[s]}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            Сочетания, которые не нравятся
            <textarea
              maxLength={3000}
              rows={2}
              value={p.dislikedPairs}
              onChange={(e) => patch({ dislikedPairs: e.target.value })}
              placeholder="розовый + красный; синий + зелёный"
            />
          </label>
          <p className="fine-print">
            Названия цветов как в списке выше. Цвета разделяйте +, пары — точкой с запятой.
          </p>
          <div className="form-grid">
            <label>
              Комфортно от, °C
              <input
                type="number"
                min={-25}
                max={40}
                required
                value={p.comfortMin}
                onChange={(e) => patch({ comfortMin: Number(e.target.value) })}
              />
            </label>
            <label>
              Комфортно до, °C
              <input
                type="number"
                min={-25}
                max={40}
                required
                value={p.comfortMax}
                onChange={(e) => patch({ comfortMax: Number(e.target.value) })}
              />
            </label>
          </div>
          <label>
            Многослойность
            <select
              value={p.layering}
              onChange={(e) => patch({ layering: e.target.value as Preferences['layering'] })}
            >
              <option value="auto">По погоде</option>
              <option value="love">Люблю дополнительные слои</option>
              <option value="minimal">Только необходимые слои</option>
            </select>
          </label>
          <p className="fine-print">
            Ниже комфортного диапазона подбор учитывает температуру на 2 °C прохладнее, выше — на 2
            °C теплее. Необходимая защита от холода сохраняется при любой настройке.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            <Check size={18} aria-hidden="true" />
            {saving ? 'Сохраняем…' : 'Сохранить предпочтения'}
          </Button>
        </div>
      </section>
    </form>
  );
}
