import { cx } from '../lib/cx.ts';
import { Icon } from './Icon.tsx';

export interface SettingsItem {
  id: string;
  label: string;
  icon: string;
  /** Valor/estado a la derecha, ej. "Marketing: desactivado". */
  value?: string;
  tone?: 'default' | 'danger';
  onSelect: () => void;
}

export function SettingsList({ items, label }: { items: SettingsItem[]; label?: string }) {
  return (
    <nav aria-label={label}>
      <ul className="rounded-2xl border border-outline-variant bg-surface-container-low divide-y divide-outline-variant overflow-hidden">
        {items.map((it) => (
          <li key={it.id}>
            <button type="button" onClick={it.onSelect} className="w-full min-h-14 flex items-center gap-3 px-4 text-left hover:bg-surface-container">
              <Icon name={it.icon} className={cx('text-[22px]', it.tone === 'danger' ? 'text-error' : 'text-on-surface-variant')} />
              <span className={cx('flex-1 font-body-md text-body-md', it.tone === 'danger' ? 'text-error' : 'text-on-surface')}>{it.label}</span>
              {it.value && <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full border border-outline-variant text-on-surface-variant">{it.value}</span>}
              {it.tone !== 'danger' && <Icon name="chevron_right" className="text-[20px] text-on-surface-variant" />}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
