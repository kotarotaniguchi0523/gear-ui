import { serve } from "@hono/node-server";
import { app } from "./routes";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(`GEAR-UI server listening on http://${hostname}:${info.port}`);
});
