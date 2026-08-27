'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

const emptySubscribe = () => () => {};

// Returns false on the server and the first client render, then true once
// hydrated. Avoids the `setState`-in-`useEffect` mount pattern (and the
// react-hooks/set-state-in-effect warning) while still preventing the
// theme icon from causing a hydration mismatch.
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export const ToggleTheme = () => {
  const hydrated = useHydrated();
  const { theme, setTheme } = useTheme();

  // マウント前は非活性なプレースホルダを表示（SSRとの整合性・レイアウトシフト防止）
  if (!hydrated) {
    return <span className="w-8 h-8 block" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 cursor-pointer"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <FiSun className="w-5 h-5" aria-hidden="true" />
      ) : (
        <FiMoon className="w-5 h-5" aria-hidden="true" />
      )}
      <span className="sr-only">
        {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      </span>
    </button>
  );
};
