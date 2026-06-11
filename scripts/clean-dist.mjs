#!/usr/bin/env node

import { rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
rmSync("tsconfig.server.tsbuildinfo", { force: true });
