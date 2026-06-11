#!/usr/bin/env node

import { chdir } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

chdir(packageRoot);
await import("../dist/server/index.js");
