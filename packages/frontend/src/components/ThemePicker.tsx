import { useState, useEffect, useRef } from 'react';
import { Palette } from 'lucide-react';
import { useTheme, THEMES } from '../hooks/useTheme';
import type { Theme } from '../hooks/useTheme';

const LABELS: Record<Theme, string> = {
  lemonade: 'Lemonade',
  light: 'Light',
  dark: 'Dark',
  cupcake: 'Cupcake',
  dracula: 'Dracula',
  synthwave: 'Synthwave',
  retro: 'Retro',
  cyberpunk: 'Cyberpunk',
  forest: 'Forest',
  aqua: 'Aqua',
};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-base-100 border border-base-300 rounded-xl shadow-xl p-2 grid grid-cols-2 gap-1 w-52">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => { setTheme(t); setOpen(false); }}
              className={`flex flex-col items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-base-200 ${
                theme === t ? 'ring-2 ring-primary' : ''
              }`}
            >
              <span data-theme={t} className="flex gap-0.5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-primary block" />
                <span className="w-3 h-3 rounded-full bg-secondary block" />
                <span className="w-3 h-3 rounded-full bg-accent block" />
              </span>
              <span className="truncate">{LABELS[t]}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-circle btn-primary shadow-lg"
        title="Change theme"
      >
        <Palette size={20} />
      </button>
    </div>
  );
}
