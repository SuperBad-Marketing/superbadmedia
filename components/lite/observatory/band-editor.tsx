"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BandValues {
  per_call_ceiling_aud: number;
  daily_ceiling_aud: number;
  learned_band_multiplier: number;
}

interface BandEditorProps {
  job: string;
  defaults: BandValues;
  current: BandValues;
  onSaved?: (result: { previous: BandValues; current: BandValues }) => void;
}

export function BandEditor({ job, defaults, current, onSaved }: BandEditorProps) {
  const [perCall, setPerCall] = useState(String(current.per_call_ceiling_aud));
  const [daily, setDaily] = useState(String(current.daily_ceiling_aud));
  const [multiplier, setMultiplier] = useState(String(current.learned_band_multiplier));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hasChanges =
    Number(perCall) !== current.per_call_ceiling_aud ||
    Number(daily) !== current.daily_ceiling_aud ||
    Number(multiplier) !== current.learned_band_multiplier;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const perCallNum = Number(perCall);
    const dailyNum = Number(daily);
    const multiplierNum = Number(multiplier);

    if (isNaN(perCallNum) || perCallNum < 0) {
      setError("Per-call ceiling must be a non-negative number.");
      setSaving(false);
      return;
    }
    if (isNaN(dailyNum) || dailyNum < 0) {
      setError("Daily ceiling must be a non-negative number.");
      setSaving(false);
      return;
    }
    if (isNaN(multiplierNum) || multiplierNum <= 0) {
      setError("Multiplier must be a positive number.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/observatory/bands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job,
          per_call_ceiling_aud: perCallNum,
          daily_ceiling_aud: dailyNum,
          learned_band_multiplier: multiplierNum,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }

      const result = await res.json();
      setSaved(true);
      onSaved?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [job, perCall, daily, multiplier, onSaved]);

  const handleReset = useCallback(() => {
    setPerCall(String(defaults.per_call_ceiling_aud));
    setDaily(String(defaults.daily_ceiling_aud));
    setMultiplier(String(defaults.learned_band_multiplier));
    setSaved(false);
    setError(null);
  }, [defaults]);

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">
        If this is a new normal, raise the band.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${job}-per-call`} className="text-xs">
            Per-call ceiling (AUD)
          </Label>
          <Input
            id={`${job}-per-call`}
            type="number"
            min="0"
            step="0.01"
            value={perCall}
            onChange={(e) => { setPerCall(e.target.value); setSaved(false); }}
          />
          <span className="text-xs text-muted-foreground">
            Default: ${defaults.per_call_ceiling_aud.toFixed(2)}
          </span>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${job}-daily`} className="text-xs">
            Daily ceiling (AUD)
          </Label>
          <Input
            id={`${job}-daily`}
            type="number"
            min="0"
            step="0.5"
            value={daily}
            onChange={(e) => { setDaily(e.target.value); setSaved(false); }}
          />
          <span className="text-xs text-muted-foreground">
            Default: ${defaults.daily_ceiling_aud.toFixed(2)}
          </span>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`${job}-multiplier`} className="text-xs">
            Learned-band multiplier
          </Label>
          <Input
            id={`${job}-multiplier`}
            type="number"
            min="0.1"
            step="0.5"
            value={multiplier}
            onChange={(e) => { setMultiplier(e.target.value); setSaved(false); }}
          />
          <span className="text-xs text-muted-foreground">
            Default: {defaults.learned_band_multiplier}×
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {saved && !error && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Band updated. Detectors will use the new values on next sweep.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          size="sm"
        >
          {saving ? "Saving…" : "Save band"}
        </Button>
        <Button
          onClick={handleReset}
          variant="ghost"
          size="sm"
          disabled={saving}
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
