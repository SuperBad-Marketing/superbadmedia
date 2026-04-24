import { db as defaultDb } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { eq } from "drizzle-orm";

export interface MatchResult {
  companyId: string;
  companyName: string;
  confidence: number;
  signals: string[];
}

export async function matchBriefToClient(
  businessName: string,
  contactName: string,
  contactEmail: string,
  dbInstance = defaultDb,
): Promise<MatchResult | null> {
  const allCompanies = await dbInstance
    .select({
      id: companies.id,
      name: companies.name,
      name_normalised: companies.name_normalised,
    })
    .from(companies);

  const allContacts = await dbInstance
    .select({
      id: contacts.id,
      company_id: contacts.company_id,
      name: contacts.name,
      email_normalised: contacts.email_normalised,
    })
    .from(contacts);

  const normInput = normalise(businessName);
  const emailDomain = contactEmail.split("@")[1]?.toLowerCase();
  const normContactName = normalise(contactName);

  let bestMatch: MatchResult | null = null;

  for (const company of allCompanies) {
    const signals: string[] = [];
    let score = 0;

    const normCompany = company.name_normalised ?? normalise(company.name);
    const nameSim = similarity(normInput, normCompany);
    if (nameSim >= 0.7) {
      score += nameSim * 0.6;
      signals.push(`name match (${Math.round(nameSim * 100)}%)`);
    }

    const companyContacts = allContacts.filter(
      (c) => c.company_id === company.id,
    );

    const emailMatch = companyContacts.some((c) => {
      if (!c.email_normalised) return false;
      if (c.email_normalised === contactEmail.toLowerCase()) return true;
      const cDomain = c.email_normalised.split("@")[1];
      return cDomain && emailDomain && cDomain === emailDomain;
    });
    if (emailMatch) {
      score += 0.3;
      signals.push("email domain match");
    }

    const nameMatch = companyContacts.some(
      (c) => similarity(normalise(c.name), normContactName) >= 0.8,
    );
    if (nameMatch) {
      score += 0.1;
      signals.push("contact name match");
    }

    if (score > 0 && (!bestMatch || score > bestMatch.confidence)) {
      bestMatch = {
        companyId: company.id,
        companyName: company.name,
        confidence: Math.min(score, 1),
        signals,
      };
    }
  }

  return bestMatch;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(pty|ltd|inc|llc|co|corp|limited|proprietary)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;

  if (longer.includes(shorter) && shorter.length >= 3) {
    return shorter.length / longer.length + 0.2;
  }

  const distance = levenshtein(a, b);
  return Math.max(0, 1 - distance / longer.length);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
