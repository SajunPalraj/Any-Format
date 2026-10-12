"use client";
import React, { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

const emptySubscribe = (callback) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(
    emptySubscribe,
    () => {
      if (typeof window === "undefined") return false;
      return (
        document.documentElement.classList.contains("dark") ||
        localStorage.getItem("theme") === "dark"
      );
    },
    () => false
  );

  const toggleTheme = () => {
    const nextState = !isDark;
    if (nextState) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    // Dispatch storage event so useSyncExternalStore updates immediately
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-xs transition-all cursor-pointer font-mono text-xs active:scale-95"
    >
      {isDark ? (
        <>
          <Sun className="w-4 h-4 text-amber-500 animate-in spin-in-180 duration-300" />
          <span className="hidden sm:inline font-semibold">Light</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-blue-600 animate-in spin-in-180 duration-300" />
          <span className="hidden sm:inline font-semibold">Dark</span>
        </>
      )}
    </button>
  );
}
