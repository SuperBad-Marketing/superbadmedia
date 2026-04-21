"use client";

import { useCallback, useState } from "react";

const COOKIE_NAME = "tricks_disabled";

function isTricksDisabled(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
}

export function NoTricksLink() {
  const [disabled, setDisabled] = useState(isTricksDisabled);

  const toggle = useCallback(async () => {
    const next = !disabled;
    await fetch("/api/no-tricks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: next }),
    });
    setDisabled(next);
  }, [disabled]);

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        fontFamily: "var(--font-label)",
        fontSize: "var(--text-micro)",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "var(--neutral-600)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        transition: "color 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.color = "var(--neutral-400)";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.color = "var(--neutral-600)";
      }}
    >
      {disabled ? "tricks on" : "no tricks"}
    </button>
  );
}
