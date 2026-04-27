import { runApifyActor } from "./apify-runner";
import type { ViabilityProfile } from "../types";

const ACTOR_ID = "curious_coder~linkedin-company-url-scraper";

interface RawLinkedInItem {
  name?: string;
  description?: string;
  industry?: string;
  companySize?: string;
  employeeCount?: number;
  followerCount?: number;
  website?: string;
  specialities?: string[];
  headquarters?: string;
  founded?: number;
  type?: string;
}

export interface LinkedInCompanyResult {
  company_name: string | null;
  employee_count_range: string | null;
  industry: string | null;
  follower_count: number | null;
  has_active_page: boolean;
  error?: string;
}

export async function scrapeLinkedInCompany(
  companyName: string,
  domain: string | null,
): Promise<LinkedInCompanyResult> {
  const searchQuery = domain
    ? `${companyName} ${domain}`
    : companyName;

  try {
    const items = await runApifyActor<RawLinkedInItem>({
      actorId: ACTOR_ID,
      jobName: "apify.linkedin_company",
      estimatedCostAud: 0.02,
      input: {
        searchQueries: [searchQuery],
        maxResults: 1,
      },
    });

    if (items.length === 0) {
      return emptyResult();
    }

    const company = items[0];
    const employeeRange = company.companySize ?? inferEmployeeRange(company.employeeCount);

    return {
      company_name: company.name ?? null,
      employee_count_range: employeeRange,
      industry: company.industry ?? null,
      follower_count: company.followerCount ?? null,
      has_active_page: !!(company.name && (company.followerCount ?? 0) > 0),
    };
  } catch (err) {
    return {
      ...emptyResult(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function emptyResult(): LinkedInCompanyResult {
  return {
    company_name: null,
    employee_count_range: null,
    industry: null,
    follower_count: null,
    has_active_page: false,
  };
}

function inferEmployeeRange(count: number | undefined): string | null {
  if (count == null) return null;
  if (count <= 1) return "1";
  if (count <= 10) return "2-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  return "500+";
}

export function applyLinkedInToProfile(
  profile: Partial<ViabilityProfile>,
  result: LinkedInCompanyResult,
): Partial<ViabilityProfile> {
  return {
    ...profile,
    linkedin: {
      company_name: result.company_name,
      employee_count_range: result.employee_count_range,
      industry: result.industry,
      follower_count: result.follower_count,
      has_active_page: result.has_active_page,
    },
    fetch_errors: result.error
      ? { ...profile.fetch_errors, linkedin: result.error }
      : profile.fetch_errors,
  };
}
