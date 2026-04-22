"use client";

import { useTransition } from "react";

import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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

function RadioOption({
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
    <RadioGroup
      value={current}
      onValueChange={onSelect}
      className="flex gap-3"
    >
      {values.map((v) => {
        const id = `${name}-${v}`;
        return (
          <label
            key={v}
            htmlFor={id}
            className="flex items-center gap-2 cursor-pointer"
          >
            <RadioGroupItem id={id} value={v} />
            <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
              {labels[v]}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}

export function DisplaySettings({ motion, sounds, density, textSize, theme, typeface, tricksEnabled }: Props) {
  const [, startTransition] = useTransition();

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
        <RadioOption
          name="motion"
          values={MOTION_PREFERENCES}
          labels={MOTION_LABELS}
          current={motion}
          onSelect={(v) => submit(updateMotionPreference, v)}
        />
      </SettingRow>

      <SettingRow
        label="Sounds"
        description="Toggle interface sounds on or off."
      >
        <Switch
          checked={sounds}
          onCheckedChange={(checked: boolean) =>
            submit(updateSoundsEnabled, String(checked))
          }
        />
      </SettingRow>

      <SettingRow
        label="Density"
        description="How much space between elements. Compact fits more on screen."
      >
        <RadioOption
          name="density"
          values={DENSITY_PREFERENCES}
          labels={DENSITY_LABELS}
          current={density}
          onSelect={(v) => submit(updateDensityPreference, v)}
        />
      </SettingRow>

      <SettingRow
        label="Text size"
        description="Increase body text for readability."
      >
        <RadioOption
          name="text-size"
          values={TEXT_SIZE_PREFERENCES}
          labels={TEXT_SIZE_LABELS}
          current={textSize}
          onSelect={(v) => submit(updateTextSizePreference, v)}
        />
      </SettingRow>

      <SettingRow
        label="Theme"
        description="Colour mood. Late Shift dims for night work, Quiet Hours strips back further."
      >
        <RadioOption
          name="theme"
          values={THEME_PRESETS}
          labels={THEME_LABELS}
          current={theme}
          onSelect={(v) => submit(updateThemePreset, v)}
        />
      </SettingRow>

      <SettingRow
        label="Typeface"
        description="Font pairing for body and narrative text."
      >
        <RadioOption
          name="typeface"
          values={TYPEFACE_PRESETS}
          labels={TYPEFACE_LABELS}
          current={typeface}
          onSelect={(v) => submit(updateTypefacePreset, v)}
        />
      </SettingRow>

      <SettingRow
        label="No tricks"
        description="Turns off hidden eggs and surprises. The ambient voice stays."
      >
        <Switch
          checked={!tricksEnabled}
          onCheckedChange={(checked: boolean) =>
            submit(updateTricksEnabled, String(!checked))
          }
        />
      </SettingRow>
    </div>
  );
}
