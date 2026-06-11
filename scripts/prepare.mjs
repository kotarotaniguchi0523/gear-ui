#!/usr/bin/env node

import { accessSync, constants, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const hooksDir = ".git/hooks";

function canInstallHooks() {
  if (!existsSync(hooksDir)) {
    return false;
  }
  try {
    accessSync(hooksDir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

if (!canInstallHooks()) {
  console.log("prepare: skipping lefthook install; Git hooks are unavailable.");
  process.exit(0);
}

const result = spawnSync("pnpm", ["exec", "lefthook", "install"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
