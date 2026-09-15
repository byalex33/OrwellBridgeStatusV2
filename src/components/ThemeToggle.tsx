"use client";

// Circle-blur variant adapted from https://beui.dev/components/motion/theme-toggle
// Copyright (c) 2026 Saurabh Chauhan. MIT license: ./beui-LICENSE.txt
import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  const transitioning = useRef(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  async function toggle() {
    if (dark === null || transitioning.current) return;
    const root = document.documentElement;
    const next = !dark;
    const apply = () => {
      root.classList.toggle("dark", next);
      document.cookie = `theme=${next ? "dark" : "light"}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setDark(next);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !document.startViewTransition) {
      apply();
      return;
    }
    transitioning.current = true;
    root.dataset.beuiVt = "circle-blur";
    try {
      await document.startViewTransition(apply).finished;
    } catch {
      // An interrupted transition must still leave the requested theme applied.
      apply();
    } finally {
      delete root.dataset.beuiVt;
      transitioning.current = false;
    }
  }

  return (
    <button type="button" disabled={dark === null} onClick={toggle}
      aria-label={dark === null ? "Change colour theme" : dark ? "Switch to light mode" : "Switch to dark mode"}
      className="shrink-0 rounded-xl border border-border p-2.5 text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {dark === null ? <span className="block h-4 w-4" /> : dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
