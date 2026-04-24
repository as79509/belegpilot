import { describe, expect, it } from "vitest";

import { parseChartOfAccountsHeuristically } from "@/lib/chart-of-accounts";

describe("parseChartOfAccountsHeuristically", () => {
  it("parses simple account text into structured rows", () => {
    const accounts = parseChartOfAccountsHeuristically(
      "1000 Kasse\n1020 Bank\n2000 Kreditoren\n4200 Bueromaterial",
    );

    expect(accounts).toHaveLength(4);
    expect(accounts[0]).toEqual({
      accountNo: "1000",
      name: "Kasse",
      kind: "asset",
      isActive: true,
    });
    expect(accounts[3]?.accountNo).toBe("4200");
  });
});
