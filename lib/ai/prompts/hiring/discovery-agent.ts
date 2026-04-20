export interface DiscoveryAgentPromptInput {
  role_name: string;
  style_summary: string;
  extracted_tags: string[];
  style_do_list: string[];
  discovery_search_hints: string[];
  location_pref_city: string | null;
  remote_ok: boolean;
  rate_range: string | null;
}

export function buildDiscoverySearchQueriesPrompt(
  input: DiscoveryAgentPromptInput,
): string {
  const locationHint = input.location_pref_city
    ? `Location preference: ${input.location_pref_city}${input.remote_ok ? " or remote" : ""}`
    : input.remote_ok
      ? "Location: remote OK"
      : "";

  const hints = input.discovery_search_hints.length > 0
    ? `Previous search hints that worked well:\n${input.discovery_search_hints.map((h) => `- ${h}`).join("\n")}`
    : "";

  return [
    `You are sourcing freelance candidates for this role: "${input.role_name}".`,
    "",
    `Style summary: ${input.style_summary}`,
    "",
    `Style tags: ${input.extracted_tags.join(", ")}`,
    input.style_do_list.length > 0
      ? `Style signals to look for: ${input.style_do_list.join(", ")}`
      : "",
    locationHint,
    input.rate_range ? `Rate range: ${input.rate_range}` : "",
    "",
    hints,
    "",
    "Generate 5-10 targeted web search queries to find freelancers whose",
    "portfolio matches this style. Mix specific and broad queries.",
    "Include platform-specific queries (Vimeo, Behance, Dribbble, personal sites).",
    "Include location-specific queries if a city preference exists.",
    "",
    "Return ONLY a JSON array of search query strings, no other text.",
    'Example: ["melbourne food colourist portfolio freelance","documentary video editor australia branded content"]',
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function buildDiscoveryResultsFilterPrompt(
  role_name: string,
  style_summary: string,
  extracted_tags: string[],
  urls: string[],
): string {
  return [
    `You are reviewing search results for the role: "${role_name}".`,
    "",
    `Style summary: ${style_summary}`,
    `Style tags: ${extracted_tags.join(", ")}`,
    "",
    "From these URLs, select ONLY the ones that look like individual",
    "freelancer/creative portfolio pages (not company pages, job boards,",
    "directories, or articles about the field).",
    "",
    "URLs to evaluate:",
    ...urls.map((u, i) => `${i + 1}. ${u}`),
    "",
    "Return ONLY a JSON array of the selected URLs, no other text.",
    "If none look like individual portfolios, return an empty array [].",
  ].join("\n");
}
