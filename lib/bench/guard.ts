import { cookies } from "next/headers";

export const BENCH_SESSION_COOKIE = "sbl_bench_session";

export type BenchSession = {
  candidateId: string;
};

export function encodeBenchSession(session: BenchSession): string {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

export function decodeBenchSession(raw: string): BenchSession | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8"),
    ) as Partial<BenchSession>;
    if (!parsed?.candidateId || typeof parsed.candidateId !== "string") {
      return null;
    }
    return { candidateId: parsed.candidateId };
  } catch {
    return null;
  }
}

export async function getBenchSession(): Promise<BenchSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(BENCH_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeBenchSession(raw);
}
