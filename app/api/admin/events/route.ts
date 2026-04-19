import { auth } from "@/lib/auth/session";
import { killSwitches } from "@/lib/kill-switches";
import { subscribeAdminEvents } from "@/lib/events/admin-event-bus";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!killSwitches.admin_sse_enabled) {
    return new Response("SSE disabled", { status: 503 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      unsubscribe = subscribeAdminEvents((event) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream closed — unsubscribe on next tick.
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
