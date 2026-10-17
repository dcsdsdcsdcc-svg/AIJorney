export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'noevix-theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'dark' || val === 'light' || val === 'system') {
      return val;
    }
  } catch {}
  return 'system';
}

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
}

export function setStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  applyTheme(theme);
}

export function toggleTheme() {
  const current = getStoredTheme();
  const isDark =
    current === 'dark' ||
    (current === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next: Theme = isDark ? 'light' : 'dark';
  setStoredTheme(next);
}
