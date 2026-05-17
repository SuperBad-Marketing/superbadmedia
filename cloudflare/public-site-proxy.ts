const VERCEL_ORIGIN = "superbadmarketing.vercel.app";

function rewriteVercelLocation(location: string, originalHost: string): string {
  try {
    const url = new URL(location);
    if (url.hostname === VERCEL_ORIGIN) {
      url.hostname = originalHost;
      return url.toString();
    }
  } catch {
    return location;
  }

  return location;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const incomingUrl = new URL(request.url);
    const targetUrl = new URL(request.url);
    targetUrl.protocol = "https:";
    targetUrl.hostname = VERCEL_ORIGIN;

    const proxyRequest = new Request(targetUrl.toString(), request);
    proxyRequest.headers.set("x-forwarded-host", incomingUrl.host);
    proxyRequest.headers.set(
      "x-forwarded-proto",
      incomingUrl.protocol.replace(":", ""),
    );
    proxyRequest.headers.set("x-superbad-original-host", incomingUrl.host);

    const response = await fetch(proxyRequest);
    const headers = new Headers(response.headers);
    const location = headers.get("location");

    if (location) {
      headers.set("location", rewriteVercelLocation(location, incomingUrl.host));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
