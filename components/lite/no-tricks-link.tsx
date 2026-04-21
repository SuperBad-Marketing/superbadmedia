"use client";

import { useCallback } from "react";
import {
  readPublicEggState,
  writePublicEggState,
  setTricksDisabled,
} from "@/lib/eggs/public-egg-state";
import { neutral } from "@/lib/design-tokens";

export function NoTricksLink() {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const state = readPublicEggState();
    const updated = setTricksDisabled(state, true);
    writePublicEggState(updated);
  }, []);

  return (
    <a
      href="#"
      onClick={handleClick}
      className="text-[11px] tracking-wide opacity-40 transition-opacity hover:opacity-70"
      style={{ color: neutral[500] }}
    >
      no tricks
    </a>
  );
}
