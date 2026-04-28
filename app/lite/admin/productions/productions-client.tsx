"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clapperboard, LayoutGrid } from "lucide-react";
import type {
  ProductionRow,
  ProductionChatMessageRow,
} from "@/lib/db/schema/productions";
import { QuickCapture } from "./_components/quick-capture";
import { IdeaCard } from "./_components/idea-card";
import { EpisodeDetail } from "./_components/episode-detail";
import { ProductionPipeline } from "./_components/production-pipeline";
import {
  createIdeaAction,
  listProductionsAction,
  getProductionAction,
} from "./actions";

type View = "ideas" | "pipeline";

interface ProductionsClientProps {
  initialProductions: ProductionRow[];
  chatCounts: Record<string, number>;
}

export function ProductionsClient({
  initialProductions,
  chatCounts: initialChatCounts,
}: ProductionsClientProps) {
  const [view, setView] = React.useState<View>("ideas");
  const [productions, setProductions] =
    React.useState<ProductionRow[]>(initialProductions);
  const [chatCounts, setChatCounts] =
    React.useState<Record<string, number>>(initialChatCounts);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedData, setSelectedData] = React.useState<{
    production: ProductionRow;
    chatMessages: ProductionChatMessageRow[];
  } | null>(null);
  const reduceMotion = useReducedMotion();

  const ideas = productions.filter((p) => p.status === "idea");
  const pipelineCount = productions.filter((p) => p.status !== "idea").length;

  async function refresh() {
    const fresh = await listProductionsAction();
    setProductions(fresh);
  }

  async function handleCapture(title: string, thought: string) {
    setIsCapturing(true);
    try {
      const created = await createIdeaAction({
        title,
        initialThought: thought || undefined,
      });
      setProductions((prev) => [created, ...prev]);
      setTimeout(refresh, 3000);
    } finally {
      setIsCapturing(false);
    }
  }

  async function openDetail(id: string) {
    setSelectedId(id);
    const data = await getProductionAction(id);
    if (data) {
      const { chatMessages, ...prod } = data;
      setSelectedData({ production: prod, chatMessages });
    }
  }

  async function handleDetailUpdated() {
    await refresh();
    if (selectedId) {
      const data = await getProductionAction(selectedId);
      if (data) {
        const { chatMessages, ...prod } = data;
        setSelectedData({ production: prod, chatMessages });
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* View toggle */}
      <div className="flex items-center gap-1 px-4 pb-3">
        <div className="flex rounded-[8px] bg-[color:rgba(253,245,230,0.03)] p-1">
          {(
            [
              { id: "ideas" as const, label: "Ideas", icon: Clapperboard, count: ideas.length },
              { id: "pipeline" as const, label: "Pipeline", icon: LayoutGrid, count: pipelineCount },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className="relative flex cursor-pointer items-center gap-1.5 rounded-[6px] border-none px-3 py-1.5"
              style={{
                background:
                  view === v.id
                    ? "rgba(253, 245, 230, 0.08)"
                    : "transparent",
                color:
                  view === v.id
                    ? "var(--color-brand-cream)"
                    : "var(--color-neutral-500)",
                transition: "all 180ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <v.icon className="size-3.5" strokeWidth={1.5} />
              <span
                className="font-[family-name:var(--font-label)] text-[10px] uppercase"
                style={{ letterSpacing: "1.5px" }}
              >
                {v.label}
              </span>
              <span
                className="font-[family-name:var(--font-label)] text-[10px] tabular-nums"
                style={{
                  color:
                    view === v.id
                      ? "var(--color-brand-pink)"
                      : "var(--color-neutral-600)",
                }}
              >
                {v.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === "ideas" ? (
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {/* Quick capture */}
          <div className="mb-5">
            <QuickCapture
              onCapture={handleCapture}
              isSubmitting={isCapturing}
            />
          </div>

          {/* Ideas grid */}
          {ideas.length === 0 ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.3, ease: "easeOut" }
              }
              className="flex flex-col items-center justify-center rounded-[12px] px-8 py-16"
              style={{
                background: "var(--color-surface-2)",
                boxShadow: "var(--surface-highlight)",
              }}
            >
              <Clapperboard
                className="mb-3 size-8 text-[color:var(--color-neutral-600)]"
                strokeWidth={1}
              />
              <p
                className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "-0.2px" }}
              >
                No episode ideas yet.
              </p>
              <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
                name a business and let the brainstorm begin.
              </p>
            </motion.div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ideas.map((p) => (
                <IdeaCard
                  key={p.id}
                  production={p}
                  chatCount={chatCounts[p.id] ?? 0}
                  onClick={() => openDetail(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <ProductionPipeline
            productions={productions}
            onCardClick={(id) => openDetail(id)}
            onUpdated={refresh}
          />
        </div>
      )}

      {/* Detail sheet */}
      <EpisodeDetail
        production={selectedData?.production ?? null}
        chatMessages={selectedData?.chatMessages ?? []}
        open={selectedId !== null}
        onClose={() => {
          setSelectedId(null);
          setSelectedData(null);
        }}
        onUpdated={handleDetailUpdated}
      />
    </div>
  );
}
