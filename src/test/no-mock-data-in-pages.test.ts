import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard: pages that render org-scoped data (Reports, Performance,
 * Calendar, Timeline, Ads, Campaigns, Projects) must NEVER import from
 * `@/lib/mock-data`. Any such import previously caused a brand-new user in
 * a different organization to see hard-coded demo records on these screens.
 *
 * If you add a new page that needs sample data, fetch it from the database
 * via useOrgData() / useTasks() instead.
 */
const PAGES_DIR = join(process.cwd(), "src/pages");
const FORBIDDEN = /from ['"]@\/lib\/mock-data['"]/;

describe("pages do not import mock-data (cross-tenant safety)", () => {
  const files = readdirSync(PAGES_DIR).filter((f) => f.endsWith(".tsx"));
  for (const file of files) {
    it(`${file} has no mock-data import`, () => {
      const src = readFileSync(join(PAGES_DIR, file), "utf8");
      const match = src.match(FORBIDDEN);
      expect(match, `${file} imports mock-data — would leak cross-tenant demo rows`).toBeNull();
    });
  }
});
