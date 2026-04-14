/**
 * Dev-only seed for the Sales Pipeline board.
 *
 * Populates one deal per non-terminal stage (plus a Won + a Lost) so the
 * /lite/admin/pipeline board has something to drag around. Backdates one
 * deal's last_stage_change_at_ms far enough to trigger the stale halo.
 *
 * Usage: npx tsx scripts/seed-pipeline.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { deals, type DealStage } from "../lib/db/schema/deals";
import { companies } from "../lib/db/schema/companies";
import { createDealFromLead } from "../lib/crm/create-deal-from-lead";

const SAMPLES: Array<{
  company: string;
  domain: string;
  contactName: string;
  email: string;
  title: string;
  stage: DealStage;
  /** Make this deal stale by backdating last_stage_change_at_ms by N days. */
  backdateDays?: number;
  wonOutcome?: "retainer" | "saas" | "project";
  lossReason?: "price" | "timing" | "ghosted";
  billingMode?: "stripe" | "manual";
  trialShootStatus?: "none" | "booked" | "arrived" | "shot" | "completed_awaiting_feedback" | "completed_feedback_provided";
}> = [
  { company: "Thetford Joinery", domain: "thetfordjoinery.com.au", contactName: "Dan Thetford", email: "dan@thetfordjoinery.com.au", title: "Retainer — lead", stage: "lead" },
  { company: "Northcote Dental", domain: "northcotedental.com.au", contactName: "Amrita Shah", email: "amrita@northcotedental.com.au", title: "Retainer — contacted", stage: "contacted", backdateDays: 10, billingMode: "manual" },
  { company: "Brunswick Brew Co", domain: "brunswickbrew.com", contactName: "Kyle Richards", email: "kyle@brunswickbrew.com", title: "SaaS — conversation", stage: "conversation" },
  { company: "Fitzroy Florist", domain: "fitzroyflorist.com.au", contactName: "Jess Lin", email: "jess@fitzroyflorist.com.au", title: "Trial shoot booked", stage: "trial_shoot", trialShootStatus: "booked" },
  { company: "Preston Plumbing", domain: "prestonplumbing.com.au", contactName: "Sam O'Neill", email: "sam@prestonplumbing.com.au", title: "Retainer quoted", stage: "quoted", backdateDays: 12 },
  { company: "Carlton Cafe Group", domain: "carltoncafegroup.com", contactName: "Marco Russo", email: "marco@carltoncafegroup.com", title: "Retainer negotiation — manual bill", stage: "negotiating", billingMode: "manual" },
  { company: "Collingwood Autos", domain: "collingwoodautos.com.au", contactName: "Tess Harding", email: "tess@collingwoodautos.com.au", title: "Won — retainer", stage: "won", wonOutcome: "retainer" },
  { company: "Yarraville Yoga", domain: "yarravilleyoga.com.au", contactName: "Nia Patel", email: "nia@yarravilleyoga.com.au", title: "Lost — ghosted", stage: "lost", lossReason: "ghosted" },
];

function main(): void {
  const now = Date.now();
  let created = 0;
  let reused = 0;

  for (const sample of SAMPLES) {
    const { deal, companyReused } = createDealFromLead(
      {
        company: { name: sample.company, domain: sample.domain },
        contact: { name: sample.contactName, email: sample.email },
        source: "dev_seed_pipeline",
        title: sample.title,
        nowMs: now,
      },
      db,
    );
    if (companyReused) reused += 1;

    const stageChangeAtMs = sample.backdateDays
      ? now - sample.backdateDays * 24 * 60 * 60 * 1000
      : now;

    db.update(deals)
      .set({
        stage: sample.stage,
        last_stage_change_at_ms: stageChangeAtMs,
        won_outcome: sample.wonOutcome ?? null,
        loss_reason: sample.lossReason ?? null,
        updated_at_ms: now,
      })
      .where(eq(deals.id, deal.id))
      .run();

    if (sample.billingMode || sample.trialShootStatus) {
      const updates: Record<string, unknown> = { updated_at_ms: now };
      if (sample.billingMode) updates.billing_mode = sample.billingMode;
      if (sample.trialShootStatus) updates.trial_shoot_status = sample.trialShootStatus;
      db.update(companies)
        .set(updates)
        .where(eq(companies.id, deal.company_id))
        .run();
    }

    created += 1;
    const staleNote = sample.backdateDays
      ? ` (backdated ${sample.backdateDays}d — stale halo)`
      : "";
    console.log(`  ✓ ${sample.stage.padEnd(12)} ${sample.company}${staleNote}`);
  }

  console.log(`\nSeeded ${created} deal(s). Company dedupe reused: ${reused}.`);
  console.log("Open http://localhost:3001/lite/admin/pipeline");
}

main();
