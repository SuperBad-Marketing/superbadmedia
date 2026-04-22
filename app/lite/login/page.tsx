"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/lite/admin/pipeline";
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (result?.error) {
      window.location.href = `/lite/login?error=${result.error}`;
    } else if (result?.ok) {
      window.location.href = callbackUrl;
    }
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 420, margin: "10vh auto", padding: "2rem", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>SuperBad — sign in</h1>
      {error && <p style={{ color: "crimson" }}>Sign-in failed ({error})</p>}
      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>Email</label>
        <input
          type="email"
          name="email"
          required
          autoFocus
          style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: 4 }}
        />
        <label style={{ display: "block", marginBottom: "0.5rem", marginTop: "1rem" }}>Password</label>
        <input
          type="password"
          name="password"
          required
          style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", borderRadius: 4 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: 4, background: "#111", color: "#fff", border: 0, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p style={{ marginTop: "1.5rem", fontSize: "0.85rem", color: "#666" }}>
        Dev-only placeholder. Real login page lands in Wave 2 B-series.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
