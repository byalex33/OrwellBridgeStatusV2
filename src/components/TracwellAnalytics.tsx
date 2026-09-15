"use client";

import { useEffect } from "react";
import { createTracwell, type TracwellClient } from "tracwell";

export let analytics: TracwellClient | undefined;

export default function TracwellAnalytics() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || typeof document === "undefined") return;
    analytics ??= createTracwell({
      projectKey: "tw_live_a3d8db4110f747f6ac554dfa91ae71b6",
      collectionMode: "private",
      consent: "granted",
      respectDoNotTrack: true,
    });
  }, []);

  return null;
}
