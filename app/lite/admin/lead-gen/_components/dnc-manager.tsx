"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DncEmailRow } from "@/lib/db/schema/dnc";
import type { DncDomainRow } from "@/lib/db/schema/dnc";
import {
  addDncEmailAction,
  removeDncEmailAction,
  addDncDomainAction,
  removeDncDomainAction,
} from "../actions";

interface DncManagerProps {
  emails: DncEmailRow[];
  domains: DncDomainRow[];
}

export function DncManager({ emails, domains }: DncManagerProps) {
  return (
    <div className="space-y-8">
      <DncEmailSection emails={emails} />
      <DncDomainSection domains={domains} />
    </div>
  );
}

function DncEmailSection({ emails }: { emails: DncEmailRow[] }) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addDncEmailAction(email, reason || undefined);
      if (!result.ok) {
        setError(result.error);
      } else {
        setEmail("");
        setReason("");
      }
    });
  }

  return (
    <section>
      <h3 className="text-sm font-medium mb-3">Blocked Emails</h3>
      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="spam@example.com"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Reason (optional)
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Competitor"
            className="h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={isPending || !email.trim()}
        >
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocked emails.</p>
      ) : (
        <div className="space-y-1">
          {emails.map((row) => (
            <DncRow
              key={row.id}
              id={row.id}
              label={row.email}
              reason={row.reason}
              source={row.source}
              addedAt={row.added_at as unknown as number}
              onRemove={removeDncEmailAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DncDomainSection({ domains }: { domains: DncDomainRow[] }) {
  const [domain, setDomain] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!domain.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addDncDomainAction(domain, reason || undefined);
      if (!result.ok) {
        setError(result.error);
      } else {
        setDomain("");
        setReason("");
      }
    });
  }

  return (
    <section>
      <h3 className="text-sm font-medium mb-3">Blocked Domains</h3>
      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Domain
          </label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Reason (optional)
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Competitor domain"
            className="h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={isPending || !domain.trim()}
        >
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocked domains.</p>
      ) : (
        <div className="space-y-1">
          {domains.map((row) => (
            <DncRow
              key={row.id}
              id={row.id}
              label={row.domain}
              reason={row.reason}
              source={null}
              addedAt={row.added_at as unknown as number}
              onRemove={removeDncDomainAction}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DncRow({
  id,
  label,
  reason,
  source,
  addedAt,
  onRemove,
}: {
  id: string;
  label: string;
  reason: string | null;
  source: string | null;
  addedAt: number;
  onRemove: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      await onRemove(id);
    });
  }

  return (
    <div
      className={`flex items-center justify-between rounded border border-border/50 px-3 py-2 text-sm ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs">{label}</span>
        {reason && (
          <span className="text-xs text-muted-foreground">— {reason}</span>
        )}
        {source && (
          <Badge variant="outline" className="text-xs">
            {source}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(addedAt).toLocaleDateString("en-AU")}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleRemove}
        disabled={isPending}
        className="text-xs text-muted-foreground hover:text-red-500 h-6 px-2"
      >
        Remove
      </Button>
    </div>
  );
}
