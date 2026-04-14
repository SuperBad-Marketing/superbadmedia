"use client";

import * as React from "react";
import { toast as sonnerToast } from "sonner";

import { useSound, type SoundKey } from "./sound-provider";

/**
 * `useToastWithSound` — the locked toast entry point for feature code.
 *
 * Design-system baseline §6 + sales-pipeline §11A.2: "All toasts go
 * through the locked `toast()` primitive. Sound pairings apply
 * automatically — feature code never calls sound APIs directly."
 *
 * The hook returns sonner-compatible methods plus a `sound` option that
 * plays a registry-locked key via `SoundProvider`. Respects
 * `soundsEnabled` and `prefers-reduced-motion: reduce` (handled by the
 * provider). Silent no-op if the sound file hasn't landed yet.
 *
 * Usage:
 *   const toast = useToastWithSound()
 *   toast("Moved to Lead.", { sound: "kanban-drop" })
 *   toast.error("Couldn't move that deal.", { sound: "error" })
 */
export interface ToastOptionsWithSound {
  sound?: SoundKey;
  description?: string;
  duration?: number;
  id?: string | number;
}

type ToastFn = (
  message: string,
  options?: ToastOptionsWithSound,
) => string | number;

export interface ToastWithSound extends ToastFn {
  success: ToastFn;
  error: ToastFn;
  warning: ToastFn;
  info: ToastFn;
}

export function useToastWithSound(): ToastWithSound {
  const { play } = useSound();

  return React.useMemo<ToastWithSound>(() => {
    const wrap = (
      fn: (
        message: string,
        options?: Omit<ToastOptionsWithSound, "sound">,
      ) => string | number,
    ): ToastFn => {
      return (message, options) => {
        if (options?.sound) play(options.sound);
        const { sound: _sound, ...rest } = options ?? {};
        return fn(message, rest);
      };
    };

    const base = wrap((msg, opts) => sonnerToast(msg, opts)) as ToastWithSound;
    base.success = wrap((msg, opts) => sonnerToast.success(msg, opts));
    base.error = wrap((msg, opts) => sonnerToast.error(msg, opts));
    base.warning = wrap((msg, opts) => sonnerToast.warning(msg, opts));
    base.info = wrap((msg, opts) => sonnerToast(msg, opts));
    return base;
  }, [play]);
}
