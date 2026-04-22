"use client";

import { useState, useTransition } from "react";

import type { MotionPreference, DensityPreference, TextSizePreference, ThemePreset, TypefacePreset } from "@/lib/design-tokens";
import {
  MOTION_PREFERENCES,
  DENSITY_PREFERENCES,
  TEXT_SIZE_PREFERENCES,
  THEME_PRESETS,
  TYPEFACE_PRESETS,
} from "@/lib/design-tokens";
import {
  updateMotionPreference,
  updateSoundsEnabled,
  updateDensityPreference,
  updateTextSizePreference,
  updateThemePreset,
  updateTypefacePreset,
  updateTricksEnabled,
} from "./actions";

type Props = {
  motion: MotionPreference;
  sounds: boolean;
  density: DensityPreference;
  textSize: TextSizePreference;
  theme: ThemePreset;
  typeface: TypefacePreset;
  tricksEnabled: boolean;
};

const MOTION_LABELS: Record<MotionPreference, string> = {
  full: "Full",
  reduced: "Reduced",
  off: "Off",
};

const DENSITY_LABELS: Record<DensityPreference, string> = {
  comfort: "Comfortable",
  compact: "Compact",
};

const TEXT_SIZE_LABELS: Record<TextSizePreference, string> = {
  standard: "Standard",
  large: "Large",
};

const THEME_LABELS: Record<ThemePreset, string> = {
  standard: "Standard",
  "late-shift": "Late Shift",
  "quiet-hours": "Quiet Hours",
};

const TYPEFACE_LABELS: Record<TypefacePreset, string> = {
  house: "House",
  "long-read": "Long Read",
  dispatch: "Dispatch",
};

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-8 py-5 border-b border-[color:var(--color-neutral-700)]">
      <div className="flex flex-col gap-1 max-w-[400px]">
        <span className="font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-neutral-100)]">
          {label}
        </span>
        <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)] leading-[1.45]">
          {description}
        </span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NativeRadioGroup({
  name,
  values,
  labels,
  current,
  onSelect,
}: {
  name: string;
  values: readonly string[];
  labels: Record<string, string>;
  current: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex gap-4" role="radiogroup">
      {values.map((v) => {
        const id = `${name}-${v}`;
        const selected = v === current;
        return (
          <label
            key={v}
            htmlFor={id}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <span className="relative flex items-center justify-center">
              <input
                type="radio"
                id={id}
                name={name}
                value={v}
                checked={selected}
                onChange={() => onSelect(v)}
                className="peer sr-only"
              />
              <span
                className="block size-4 rounded-full border-2 transition-colors peer-checked:border-[color:var(--color-brand-pink)] border-[color:var(--color-neutral-500)]"
              />
              {selected && (
                <span className="absolute size-2 rounded-full bg-[color:var(--color-brand-pink)]" />
              )}
            </span>
            <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
              {labels[v]}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function NativeToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors"
      style={{
        backgroundColor: checked
          ? "var(--color-brand-pink)"
          : "var(--color-neutral-600)",
      }}
    >
      <span
        className="block size-4 rounded-full bg-white transition-transform"
        style={{
          transform: checked ? "translateX(24px)" : "translateX(4px)",
        }}
      />
    </button>
  );
}

export function DisplaySettings({ motion, sounds, density, textSize, theme, typeface, tricksEnabled }: Props) {
  const [pending, startTransition] = useTransition();
  const [localMotion, setLocalMotion] = useState(motion);
  const [localSounds, setLocalSounds] = useState(sounds);
  const [localDensity, setLocalDensity] = useState(density);
  const [localTextSize, setLocalTextSize] = useState(textSize);
  const [localTheme, setLocalTheme] = useState(theme);
  const [localTypeface, setLocalTypeface] = useState(typeface);
  const [localTricks, setLocalTricks] = useState(tricksEnabled);

  function submit(action: (fd: FormData) => Promise<void>, value: string) {
    const fd = new FormData();
    fd.set("value", value);
    startTransition(() => action(fd));
  }

  return (
    <div className="max-w-[680px]">
      <SettingRow
        label="Motion"
        description="Controls how much animation you see. Reduced keeps the essentials, off disables all motion."
      >
        <NativeRadioGroup
          name="motion"
          values={MOTION_PREFERENCES}
          labels={MOTION_LABELS}
          current={localMotion}
          onSelect={(v) => {
            setLocalMotion(v as MotionPreference);
            submit(updateMotionPreference, v);
          }}
        />
      </SettingRow>

      <SettingRow
        label="Sounds"
        description="Toggle interface sounds on or off."
      >
        <NativeToggle
          checked={localSounds}
          onChange={(next) => {
            setLocalSounds(next);
            submit(updateSoundsEnabled, String(next));
          }}
        />
      </SettingRow>

      <SettingRow
        label="Density"
        description="How much space between elements. Compact fits more on screen."
      >
        <NativeRadioGroup
          name="density"
          values={DENSITY_PREFERENCES}
          labels={DENSITY_LABELS}
          current={localDensity}
          onSelect={(v) => {
            setLocalDensity(v as DensityPreference);
            submit(updateDensityPreference, v);
          }}
        />
      </SettingRow>

      <SettingRow
        label="Text size"
        description="Increase body text for readability."
      >
        <NativeRadioGroup
          name="text-size"
          values={TEXT_SIZE_PREFERENCES}
          labels={TEXT_SIZE_LABELS}
          current={localTextSize}
          onSelect={(v) => {
            setLocalTextSize(v as TextSizePreference);
            submit(updateTextSizePreference, v);
          }}
        />
      </SettingRow>

      <SettingRow
        label="Theme"
        description="Colour mood. Late Shift dims for night work, Quiet Hours strips back further."
      >
        <NativeRadioGroup
          name="theme"
          values={THEME_PRESETS}
          labels={THEME_LABELS}
          current={localTheme}
          onSelect={(v) => {
            setLocalTheme(v as ThemePreset);
            submit(updateThemePreset, v);
          }}
        />
      </SettingRow>

      <SettingRow
        label="Typeface"
        description="Font pairing for body and narrative text."
      >
        <NativeRadioGroup
          name="typeface"
          values={TYPEFACE_PRESETS}
          labels={TYPEFACE_LABELS}
          current={localTypeface}
          onSelect={(v) => {
            setLocalTypeface(v as TypefacePreset);
            submit(updateTypefacePreset, v);
          }}
        />
      </SettingRow>

      <SettingRow
        label="No tricks"
        description="Turns off hidden eggs and surprises. The ambient voice stays."
      >
        <NativeToggle
          checked={!localTricks}
          onChange={(checked) => {
            setLocalTricks(!checked);
            submit(updateTricksEnabled, String(!checked));
          }}
        />
      </SettingRow>
    </div>
  );
}
