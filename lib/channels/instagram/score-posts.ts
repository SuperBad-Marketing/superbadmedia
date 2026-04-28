interface RawPost {
  url?: string;
  displayUrl?: string;
  imageUrl?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
  type?: string;
}

export interface ScoredPost {
  permalink: string | null;
  imageUrl: string | null;
  caption: string | null;
  likes: number;
  comments: number;
  type: string | null;
  publishedAtMs: number;
  postEr: number;
  performanceScore: number;
  recencyWeight: number;
  finalScore: number;
}

export function scoreCompetitorPosts(
  posts: RawPost[],
  accountFollowers: number,
): ScoredPost[] {
  if (posts.length === 0 || accountFollowers <= 0) return [];

  const mapped = posts.map((p) => {
    const likes = p.likesCount ?? 0;
    const comments = p.commentsCount ?? 0;
    const publishedAtMs = p.timestamp
      ? new Date(p.timestamp).getTime()
      : Date.now();

    const postEr = (likes + comments) / accountFollowers;

    return {
      permalink: p.url ?? null,
      imageUrl: p.displayUrl ?? p.imageUrl ?? null,
      caption: p.caption ?? null,
      likes,
      comments,
      type: p.type ?? null,
      publishedAtMs,
      postEr,
      performanceScore: 0,
      recencyWeight: 0,
      finalScore: 0,
    };
  });

  const avgEr =
    mapped.reduce((sum, p) => sum + p.postEr, 0) / mapped.length;

  const safeAvgEr = avgEr > 0 ? avgEr : 0.001;

  const now = Date.now();
  const DAY_MS = 86_400_000;

  for (const post of mapped) {
    post.performanceScore = post.postEr / safeAvgEr;

    const ageMs = now - post.publishedAtMs;
    const ageDays = ageMs / DAY_MS;

    if (ageDays < 7) post.recencyWeight = 1.0;
    else if (ageDays < 14) post.recencyWeight = 0.9;
    else if (ageDays < 30) post.recencyWeight = 0.7;
    else post.recencyWeight = 0.5;

    post.finalScore = post.performanceScore * post.recencyWeight;
  }

  return mapped
    .filter((p) => p.finalScore >= 1.5 && p.imageUrl)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 15);
}
