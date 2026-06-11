/**
 * Browser-side reader for the SSE streams produced by the Hono generation routes.
 *
 * Pass a map of event name -> handler. Each handler receives the parsed JSON
 * payload of its event (or the raw string if it was not valid JSON).
 */
export type SseHandlers = Record<string, (data: unknown) => void>;

export async function consumeSse(
  response: Response,
  handlers: SseHandlers
): Promise<void> {
  if (!response.body) throw new Error("Response has no body to stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      dispatch(chunk, handlers);
    }
  }
}

function dispatch(chunk: string, handlers: SseHandlers): void {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  const handler = handlers[event];
  if (!handler) return;

  const raw = dataLines.join("\n");
  if (!raw) {
    handler(undefined);
    return;
  }
  try {
    handler(JSON.parse(raw));
  } catch {
    handler(raw);
  }
}
