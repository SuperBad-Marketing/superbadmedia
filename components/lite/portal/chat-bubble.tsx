"use client";

interface ChatBubbleProps {
  portalToken: string;
}

export function ChatBubble({ portalToken }: ChatBubbleProps) {
  return (
    <a
      href={`/lite/portal/${portalToken}`}
      aria-label="Back to chat"
      className="fixed bottom-5 left-5 z-20 grid h-[46px] w-[46px] place-items-center rounded-full border border-[rgba(253,245,230,0.1)] bg-[var(--color-neutral-700)] text-[var(--color-brand-cream)] transition-all duration-300 hover:scale-[1.06] hover:border-[rgba(244,160,176,0.3)] hover:bg-[var(--color-neutral-600)] sm:bottom-8 sm:left-8 sm:h-[52px] sm:w-[52px]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    </a>
  );
}
