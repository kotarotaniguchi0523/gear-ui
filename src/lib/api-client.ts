import { hc } from "hono/client";
import type { AppType } from "@/server/routes";

export const apiClient = hc<AppType>("/");
