import { useState, useEffect } from 'react';

export const THEMES = [
  'lemonade', 'light', 'dark', 'cupcake', 'dracula',
  'synthwave', 'retro', 'cyberpunk', 'forest', 'aqua',
] as const;

export type Theme = typeof THEMES[number];

const STORAGE_KEY = 'quiz-theme';
const DEFAULT: Theme = 'lemonade';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme;
    const initial = THEMES.includes(saved) ? saved : DEFAULT;
    document.documentElement.setAttribute('data-theme', initial);
    return initial;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
