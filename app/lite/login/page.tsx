import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const callbackUrl = String(formData.get("callbackUrl") ?? "/lite/admin/pipeline");
    await signIn("credentials", { email, redirectTo: callbackUrl });
  }

  return <LoginForm searchParamsPromise={searchParams} action={loginAction} />;
}

async function LoginForm({
  searchParamsPromise,
  action,
}: {
  searchParamsPromise: Promise<{ callbackUrl?: string; error?: string }>;
  action: (fd: FormData) => Promise<void>;
}) {
  const sp = await searchParamsPromise;
  if (!sp) redirect("/lite/admin/pipeline");
  return (
    <main style={{ maxWidth: 420, margin: "10vh auto", padding: "2rem", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>SuperBad — sign in</h1>
      {sp.error && <p style={{ color: "crimson" }}>Sign-in failed. Check the email.</p>}
      <form action={action}>
        <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/lite/admin/pipeline"} />
        <label style={{ display: "block", marginBottom: "0.5rem" }}>Email</label>
        <input
          type="email"
          name="email"
          required
          autoFocus
          style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: 4 }}
        />
        <button
          type="submit"
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: 4, background: "#111", color: "#fff", border: 0 }}
        >
          Sign in
        </button>
      </form>
      <p style={{ marginTop: "1.5rem", fontSize: "0.85rem", color: "#666" }}>
        Dev-only placeholder. Real login page lands in Wave 2 B-series.
      </p>
    </main>
  );
}
