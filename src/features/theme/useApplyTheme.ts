import { useEffect } from 'react';
import { useThemeStore } from './themeStore';

export function useApplyTheme() {
  const resolved = useThemeStore((s) => s.resolved);

  useEffect(() => {
    if (resolved === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [resolved]);
}
