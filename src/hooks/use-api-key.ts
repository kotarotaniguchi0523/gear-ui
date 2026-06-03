"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "gear-ui:anthropic-api-key";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readKey(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // localStorage unavailable
    return "";
  }
}

export function useApiKey() {
  // localStorage is an external store: read it via useSyncExternalStore so the
  // server snapshot ("") and the post-hydration client value never mismatch.
  const apiKey = useSyncExternalStore(subscribe, readKey, () => "");
  const loaded = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const save = useCallback((value: string) => {
    const trimmed = value.trim();
    try {
      if (trimmed) {
        window.localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    // setItem/removeItem don't emit a "storage" event in the same tab, so
    // notify subscribers manually to re-render.
    notify();
  }, []);

  const clear = useCallback(() => save(""), [save]);

  return { apiKey, save, clear, loaded, hasKey: apiKey.length > 0 };
}
