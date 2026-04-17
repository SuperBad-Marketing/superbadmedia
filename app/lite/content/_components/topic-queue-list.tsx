"use client";

/**
 * Topic queue list with veto buttons (CE-10).
 *
 * Spec: docs/specs/content-engine.md §2.1 Stage 2.
 * Subscriber can see and veto topics, not reorder or add.
 * Each topic shows keyword, rankability score, and expandable outline.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { vetoTopicAction } from "../actions";
import type { TopicOutline } from "@/lib/content-engine/topic-queue";
import type { ContentGap } from "@/lib/content-engine/rankability";

interface QueuedTopic {
  id: string;
  keyword: string;
  rankabilityScore: number | null;
  contentGaps: ContentGap[] | null;
  outline: TopicOutline | null;
  createdAtMs: number;
}

export function TopicQueueList({ topics }: { topics: QueuedTopic[] }) {
  const [vetoedIds, setVetoedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  async function handleVeto(topicId: string) {
    const result = await vetoTopicAction(topicId);
    if (result.ok) {
      setVetoedIds((prev) => new Set([...prev, topicId]));
    }
  }

  function toggleExpand(topicId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }

  const visibleTopics = topics.filter((t) => !vetoedIds.has(t.id));

  if (visibleTopics.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        All topics vetoed. New topics will appear after the next research run.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleTopics.map((topic) => {
        const expanded = expandedIds.has(topic.id);
        return (
          <div
            key={topic.id}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => toggleExpand(topic.id)}
                  className="text-left"
                >
                  <h3 className="font-medium">{topic.keyword}</h3>
                </button>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  {topic.rankabilityScore !== null && (
                    <span>
                      Rankability:{" "}
                      <span className="font-medium tabular-nums">
                        {topic.rankabilityScore}
                      </span>
                      /100
                    </span>
                  )}
                  {topic.outline && (
                    <span>
                      ~{topic.outline.targetWordCount} words
                    </span>
                  )}
                  {topic.outline?.featuredSnippetOpportunity && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-brand-pink/30 text-brand-pink"
                    >
                      Snippet opportunity
                    </Badge>
                  )}
                  <span>
                    {new Date(topic.createdAtMs).toLocaleDateString("en-AU")}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpand(topic.id)}
                  className="text-xs text-muted-foreground"
                >
                  {expanded ? "Collapse" : "Outline"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVeto(topic.id)}
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Veto
                </Button>
              </div>
            </div>

            {expanded && topic.outline && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="space-y-3">
                  {topic.outline.sections.map((section, i) => (
                    <div key={i}>
                      <h4 className="text-sm font-medium">
                        {section.heading}
                      </h4>
                      <ul className="mt-1 ml-4 list-disc text-xs text-muted-foreground">
                        {section.keyPoints.map((point, j) => (
                          <li key={j}>{point}</li>
                        ))}
                      </ul>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                        ~{section.estimatedWords} words
                      </p>
                    </div>
                  ))}
                </div>

                {topic.contentGaps && topic.contentGaps.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                      Content Gaps
                    </h4>
                    <ul className="space-y-1">
                      {topic.contentGaps.map((gap, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium">{gap.angle}</span>
                          {" — "}
                          {gap.reasoning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
