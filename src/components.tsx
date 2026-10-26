import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Plus,
  X,
  Shirt,
  CloudSun,
  Sun,
  CloudRain,
  Snowflake,
  Cloud,
  Heart,
} from 'lucide-react';
import { categories, type Item, type Weather } from './types';
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${secondary ? 'secondary' : 'primary'} ${className}`}
    >
      {children}
    </motion.button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    const prior = document.activeElement as HTMLElement;
    d?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      d?.close();
      document.body.style.overflow = old;
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="modal-inner"
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>
        {children}
      </motion.div>
    </dialog>
  );
}
export function WeatherIcon({
  condition,
  className = '',
}: {
  condition: Weather['condition'];
  className?: string;
}) {
  const Icon = { sun: Sun, cloud: Cloud, rain: CloudRain, snow: Snowflake }[condition] || CloudSun;
  return <Icon className={`weather-icon ${className}`} aria-hidden="true" strokeWidth={1.25} />;
}
export function Empty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <Shirt size={48} strokeWidth={1} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <Button onClick={onAction}>
          <Plus size={18} aria-hidden="true" />
          {action}
        </Button>
      )}
    </div>
  );
}
export function Board({ items, compact = false }: { items: Item[]; compact?: boolean }) {
  return (
    <div className={`outfit-board ${compact ? 'compact' : ''}`} aria-label="Композиция образа">
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          className={`board-piece piece-${item.category}`}
          style={{ '--order': index } as React.CSSProperties}
          initial={{ opacity: 0, scale: 0.92, rotate: index % 2 ? 3 : -3 }}
          animate={{ opacity: 1, scale: 1, rotate: index % 2 ? 3 : -3 }}
          transition={{ duration: 0.24, delay: index * 0.035 }}
        >
          <img src={item.photo} alt={item.name} />
          <span>{categories[item.category]}</span>
        </motion.div>
      ))}
      {!items.length && (
        <div className="board-placeholder">
          <Shirt size={64} strokeWidth={0.8} aria-hidden="true" />
          <p>Здесь сложится ваш образ</p>
        </div>
      )}
    </div>
  );
}
export function ItemCard({
  item,
  onClick,
  index = 0,
}: {
  item: Item;
  onClick: () => void;
  index?: number;
}) {
  return (
    <motion.button
      className="item-card"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.035 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="item-photo">
        <img src={item.photo} alt={item.name} loading="lazy" />
        {item.demo && <span className="demo-label">Демо</span>}
      </div>
      <div className="item-info">
        <span>{categories[item.category]}</span>
        <h3>{item.name}</h3>
      </div>
    </motion.button>
  );
}
export function SectionHeading({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button className="text-btn" onClick={onClick}>
          {action}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
export function FavoriteIcon({ active = false }: { active?: boolean }) {
  return (
    <motion.span
      key={String(active)}
      initial={active ? { scale: 0.6 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 450, damping: 15 }}
      className="inline-icon"
    >
      <Heart aria-hidden="true" size={19} fill={active ? 'currentColor' : 'none'} />
    </motion.span>
  );
}
