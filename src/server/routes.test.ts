import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { codexAuthStatus } from "@/server/routes";

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function tempCodexHome() {
  const dir = mkdtempSync(join(tmpdir(), "gear-ui-codex-"));
  tempDirs.push(dir);
  return dir;
}

describe("codex auth status", () => {
  it("reports unavailable when the server user has no Codex auth files", async () => {
    const data = codexAuthStatus(tempCodexHome());

    expect(data.available).toBe(false);
    expect("codexHome" in data).toBe(false);
  });

  it("reports available when Codex auth exists", async () => {
    const home = tempCodexHome();
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, "auth.json"), "{}", "utf8");

    const data = codexAuthStatus(home);

    expect(data.available).toBe(true);
    expect(data.auth).toBe("codex-login");
  });
});
