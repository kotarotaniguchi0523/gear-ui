/**
 * Server-Sent Events (SSE) helper for streaming LLM generation to the browser.
 *
 * Generation routes opt into streaming only when the client sends
 * `Accept: text/event-stream`; otherwise they keep returning plain JSON so the
 * HTTP API stays usable by non-streaming callers. See `wantsEventStream`.
 */

/** True when the request asked for an SSE stream rather than a JSON response. */
export function wantsEventStream(request: Request): boolean {
  return (
    request.headers.get("accept")?.includes("text/event-stream") ?? false
  );
}

type Emit = (event: string, data: unknown) => void;

/**
 * Build a streaming `Response` that runs `producer`, handing it an `emit`
 * function for pushing named SSE events. Any thrown error is reported to the
 * client as an `error` event (the stream has already committed a 200, so we
 * cannot change the status code mid-flight) and the stream is then closed.
 */
export function createSseResponse(
  producer: (emit: Emit) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (event, data) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      try {
        await producer(emit);
      } catch (error) {
        // A client abort (cancelled generation / disconnect) lands here too.
        // Try to surface the error, but the stream may already be torn down —
        // in which case enqueue throws and there is nothing left to report to.
        try {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          emit("error", { error: message });
        } catch {
          /* connection already closed */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disable proxy buffering (nginx) so chunks reach the client immediately.
      "x-accel-buffering": "no",
    },
  });
}
