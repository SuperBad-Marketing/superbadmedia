/**
 * Melbourne metro + Geelong location detection for Rundown sequence
 * track assignment. Primary signal: form city field. No enrichment
 * fallback currently available (ViabilityProfile doesn't store address).
 */

const MELBOURNE_KEYWORDS = [
  "melbourne",
  "geelong",
  // Inner suburbs
  "fitzroy", "collingwood", "richmond", "south yarra", "prahran",
  "st kilda", "carlton", "brunswick", "northcote", "thornbury",
  "abbotsford", "cremorne", "south melbourne", "port melbourne",
  "docklands", "southbank", "footscray", "seddon",
  "yarraville", "williamstown", "kensington", "flemington",
  "parkville", "north melbourne", "west melbourne",
  // Inner east
  "hawthorn", "camberwell", "kew", "balwyn", "box hill",
  "glen iris", "malvern", "toorak", "armadale", "caulfield",
  "elsternwick", "brighton", "elwood", "balaclava", "windsor",
  // South east
  "moorabbin", "bentleigh", "oakleigh", "clayton",
  "glen waverley", "mount waverley", "mulgrave", "dandenong",
  "noble park", "springvale", "cheltenham", "mentone", "mordialloc",
  "frankston", "cranbourne", "narre warren", "berwick",
  "pakenham", "officer", "clyde",
  // East
  "ringwood", "croydon", "lilydale", "mooroolbark", "bayswater",
  "boronia", "ferntree gully", "rowville", "scoresby",
  "vermont", "mitcham", "nunawading", "blackburn", "doncaster",
  "templestowe", "bulleen", "eltham", "greensborough",
  // North
  "preston", "reservoir", "coburg", "pascoe vale", "glenroy",
  "broadmeadows", "craigieburn", "sunbury", "epping", "south morang",
  "mill park", "bundoora", "lalor", "thomastown", "heidelberg",
  "ivanhoe", "fairfield", "alphington", "clifton hill",
  // West
  "sunshine", "st albans", "deer park", "caroline springs",
  "taylors lakes", "sydenham", "melton", "werribee", "hoppers crossing",
  "point cook", "tarneit", "truganina", "laverton", "altona",
  "newport", "spotswood", "wyndham",
  // Mornington Peninsula (within ~50km)
  "mornington", "mount martha", "mount eliza", "baxter",
  // Geelong region
  "belmont", "highton", "newtown", "north geelong", "south geelong",
  "corio", "norlane", "lara", "leopold", "ocean grove",
  "torquay", "armstrong creek", "grovedale", "waurn ponds",
];

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[,.\-]/g, " ").replace(/\s+/g, " ");
}

function matchesMelbourneKeyword(text: string): boolean {
  const norm = normalise(text);
  return MELBOURNE_KEYWORDS.some((kw) => norm.includes(kw));
}

function matchesMelbournePostcode(text: string): boolean {
  const postcodeMatch = text.match(/\b(3\d{3})\b/);
  if (!postcodeMatch) return false;
  const code = parseInt(postcodeMatch[1], 10);
  return code >= 3000 && code <= 3999;
}

export function isMelbourneArea(city: string | null | undefined): boolean {
  if (!city) return false;
  if (matchesMelbourneKeyword(city)) return true;
  if (matchesMelbournePostcode(city)) return true;
  return false;
}
