import type { PortfolioSignal } from "@/lib/hiring/portfolio";
import type { RoleBriefRow } from "@/lib/db/schema/role-briefs";

export interface DiscoverySourceResult {
  urls: string[];
  cost_aud: number;
}

export interface DiscoverySource {
  name: string;
  fetch(brief: RoleBriefRow): Promise<DiscoverySourceResult>;
}

export interface DiscoveryCandidate {
  url: string;
  name: string | null;
  platform: PortfolioSignal["platform"];
  signal: PortfolioSignal;
  score: number;
  reasoning: string | null;
  source_name: string;
}

export interface DiscoveryRunResult {
  role_brief_id: string;
  candidates: DiscoveryCandidate[];
  total_cost_aud: number;
  urls_discovered: number;
  urls_ingested: number;
  urls_skipped_duplicate: number;
  cost_cap_hit: boolean;
}
