"use client";

import { useState } from "react";
import { VideoCreateForm } from "./video-create-form";
import { VideoLibrary } from "./video-library";

export function VideoStudioClient() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Content{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Video Studio
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Video Studio
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Describe what you want, tune the brief, hit generate.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            the machine does the rest.
          </em>
        </p>
      </header>

      <div className="mt-6 space-y-8 px-4">
        <VideoCreateForm
          onCreated={() => setRefreshKey((k) => k + 1)}
        />

        <div>
          <div className="mb-4 flex items-center justify-between">
            <span
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              Library
            </span>
          </div>
          <VideoLibrary refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
