export const categories = {
  top: 'Верх',
  bottom: 'Низ',
  dress: 'Платье',
  shoes: 'Обувь',
  outer: 'Верхняя одежда',
  accessory: 'Аксессуар',
} as const;
export type Category = keyof typeof categories;
export const styles = ['casual', 'romantic', 'classic', 'sporty', 'streetwear'] as const;
export const styleNames: Record<string, string> = {
  casual: 'Повседневный',
  romantic: 'Романтичный',
  classic: 'Классический',
  sporty: 'Спортивный',
  streetwear: 'Уличный',
};
export const colors: Record<string, string> = {
  белый: '#F9F8F5',
  чёрный: '#2B2729',
  бежевый: '#CDBDA6',
  розовый: '#D991AA',
  синий: '#526B91',
  серый: '#969294',
  коричневый: '#805B48',
  красный: '#B84452',
  зелёный: '#66816F',
  голубой: '#A0C5D8',
};
export interface Item {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  color: string;
  secondColor: string;
  season: string;
  style: string;
  minTemp: number;
  maxTemp: number;
  rain: boolean;
  notes: string;
  photo: string;
  demo: boolean;
  createdAt: number;
}
export interface Preferences {
  id: 'profile';
  name: string;
  favoriteColors: string[];
  styles: string[];
  dislikedPairs: string;
  comfortMin: number;
  comfortMax: number;
  layering: 'auto' | 'love' | 'minimal';
  onboarded: boolean;
  demoMode: boolean;
}
export type Weather = {
  temp: number;
  condition: 'sun' | 'cloud' | 'rain' | 'snow';
  wind: number;
  occasion: string;
  style: string;
};
export const weatherNames = { sun: 'Солнечно', cloud: 'Облачно', rain: 'Дождь', snow: 'Снег' };
export const occasions = [
  'На каждый день',
  'Прогулка',
  'Учёба',
  'Свидание',
  'Работа',
  'Мероприятие',
];
export const defaultWeather: Weather = {
  temp: 16,
  condition: 'sun',
  wind: 3,
  occasion: 'На каждый день',
  style: 'any',
};
export const defaultPreferences: Preferences = {
  id: 'profile',
  name: '',
  favoriteColors: [],
  styles: [],
  dislikedPairs: '',
  comfortMin: 12,
  comfortMax: 24,
  layering: 'auto',
  onboarded: false,
  demoMode: false,
};
export interface Outfit {
  id: string;
  itemIds: string[];
  name: string;
  weather: Weather;
  reason: string;
  demo: boolean;
  createdAt: number;
}
export interface Rating {
  id: string;
  value: 1 | -1;
  itemIds: string[];
  demo: boolean;
}
export interface Suggestion {
  ids: string[];
  score: number;
  reason: string;
  variant: string;
}
