export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-12">
      <div className="max-w-md space-y-3 text-center">
        <p
          className="uppercase tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-label)",
            fontSize: "var(--text-micro)",
            color: "var(--neutral-500)",
          }}
        >
          Phase 5 · Wave 1 · A2
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-h1)",
            lineHeight: "var(--text-h1-lh)",
            color: "var(--neutral-100)",
          }}
        >
          SuperBad
        </h1>
        <p
          style={{
            fontFamily: "var(--font-narrative)",
            fontSize: "var(--text-narrative)",
            color: "var(--neutral-300)",
            fontStyle: "italic",
          }}
        >
          Design baseline online. Primitives land in A3.
        </p>
        <p style={{ fontSize: "var(--text-small)", color: "var(--neutral-500)" }}>
          <a href="/lite/design" style={{ color: "var(--brand-pink)" }}>
            /lite/design
          </a>{" "}
          — token reference.
        </p>
      </div>
    </main>
  );
}
