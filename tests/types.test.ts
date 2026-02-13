import { describe, it, expect } from "vitest";
import {
  FINE_BASE_URL,
  FINE_PAGE_PATH,
  FINE_ALLOWED_PATH_PREFIX,
  FETCH_TIMEOUT_MS,
  CACHE_TTL_MS,
  MAX_COMPANY_NAME_LENGTH,
  MAX_DISPLAY,
  BUSINESS_TYPES,
  VALID_BUSINESS_TYPES,
  VALID_STATUSES,
  DATA_START_ROW,
  REG_COL,
  CAN_COL,
} from "../src/types.js";

// ============================================================
// Constants verification
// ============================================================

describe("constants", () => {
  it("should have correct FINE portal URL base", () => {
    expect(FINE_BASE_URL).toBe("https://fine.fss.or.kr");
  });

  it("should have HTTPS in base URL", () => {
    expect(FINE_BASE_URL).toMatch(/^https:\/\//);
  });

  it("should have allowed path prefix starting with /fine/", () => {
    expect(FINE_ALLOWED_PATH_PREFIX).toMatch(/^\/fine\//);
  });

  it("should have reasonable timeout (10-60 seconds)", () => {
    expect(FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(FETCH_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  it("should have cache TTL of at least 1 hour", () => {
    expect(CACHE_TTL_MS).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });

  it("should have MAX_COMPANY_NAME_LENGTH > 0", () => {
    expect(MAX_COMPANY_NAME_LENGTH).toBeGreaterThan(0);
  });

  it("should have MAX_DISPLAY > 0", () => {
    expect(MAX_DISPLAY).toBeGreaterThan(0);
  });
});

describe("BUSINESS_TYPES", () => {
  it("should contain exactly 5 types", () => {
    expect(BUSINESS_TYPES).toHaveLength(5);
  });

  it("should include all expected types", () => {
    expect([...BUSINESS_TYPES]).toEqual(["선불", "직불", "PG", "ESCROW", "EBPP"]);
  });
});

describe("VALID_BUSINESS_TYPES", () => {
  it("should include all BUSINESS_TYPES plus 전체", () => {
    for (const type of BUSINESS_TYPES) {
      expect(VALID_BUSINESS_TYPES.has(type)).toBe(true);
    }
    expect(VALID_BUSINESS_TYPES.has("전체")).toBe(true);
  });

  it("should have size of BUSINESS_TYPES + 1", () => {
    expect(VALID_BUSINESS_TYPES.size).toBe(BUSINESS_TYPES.length + 1);
  });
});

describe("VALID_STATUSES", () => {
  it("should contain 등록, 말소, 전체", () => {
    expect(VALID_STATUSES.has("등록")).toBe(true);
    expect(VALID_STATUSES.has("말소")).toBe(true);
    expect(VALID_STATUSES.has("전체")).toBe(true);
  });

  it("should have exactly 3 entries", () => {
    expect(VALID_STATUSES.size).toBe(3);
  });
});

describe("column index constants", () => {
  it("should have REG_COL with correct structure", () => {
    expect(REG_COL.NO).toBeDefined();
    expect(REG_COL.DATE).toBeDefined();
    expect(REG_COL.NAME).toBeDefined();
    expect(REG_COL.TYPE_START).toBeDefined();
    expect(REG_COL.TYPE_START).toBeGreaterThan(REG_COL.NAME);
  });

  it("should have CAN_COL with correct structure", () => {
    expect(CAN_COL.NO).toBeDefined();
    expect(CAN_COL.DATE).toBeDefined();
    expect(CAN_COL.NAME).toBeDefined();
    expect(CAN_COL.TYPE_START).toBeDefined();
    expect(CAN_COL.TYPE_START).toBeGreaterThan(CAN_COL.NAME);
  });

  it("should have DATA_START_ROW > 0 (after header rows)", () => {
    expect(DATA_START_ROW).toBeGreaterThan(0);
  });
});
