import { describe, it, expect } from "vitest";
import { validateSearchArgs } from "../src/validation.js";
import { MAX_COMPANY_NAME_LENGTH } from "../src/types.js";

describe("validateSearchArgs", () => {
  // ── company_name ──

  it("should pass when company_name is omitted", () => {
    const result = validateSearchArgs({});
    expect(result.company_name).toBeUndefined();
  });

  it("should pass when company_name is within max length", () => {
    const result = validateSearchArgs({ company_name: "카카오페이" });
    expect(result.company_name).toBe("카카오페이");
  });

  it("should pass when company_name is exactly max length", () => {
    const name = "가".repeat(MAX_COMPANY_NAME_LENGTH);
    const result = validateSearchArgs({ company_name: name });
    expect(result.company_name).toBe(name);
  });

  it("should throw McpError when company_name exceeds max length", () => {
    const name = "가".repeat(MAX_COMPANY_NAME_LENGTH + 1);
    expect(() => validateSearchArgs({ company_name: name })).toThrow(
      `${MAX_COMPANY_NAME_LENGTH}자 이내`,
    );
  });

  it("should coerce non-string company_name to string", () => {
    const result = validateSearchArgs({ company_name: 123 });
    expect(result.company_name).toBe("123");
  });

  // ── business_type ──

  it("should default business_type to 전체 when omitted", () => {
    const result = validateSearchArgs({});
    expect(result.business_type).toBe("전체");
  });

  it.each(["선불", "직불", "PG", "ESCROW", "EBPP", "전체"])(
    "should accept valid business_type: %s",
    (type) => {
      const result = validateSearchArgs({ business_type: type });
      expect(result.business_type).toBe(type);
    },
  );

  it("should throw McpError for invalid business_type", () => {
    expect(() => validateSearchArgs({ business_type: "없는업종" })).toThrow(
      "유효하지 않은 업종",
    );
  });

  // ── status ──

  it("should default status to 전체 when omitted", () => {
    const result = validateSearchArgs({});
    expect(result.status).toBe("전체");
  });

  it.each(["등록", "말소", "전체"])("should accept valid status: %s", (status) => {
    const result = validateSearchArgs({ status });
    expect(result.status).toBe(status);
  });

  it("should throw McpError for invalid status", () => {
    expect(() => validateSearchArgs({ status: "보류" })).toThrow("유효하지 않은 상태");
  });

  // ── refresh ──

  it("should default refresh to false when omitted", () => {
    const result = validateSearchArgs({});
    expect(result.refresh).toBe(false);
  });

  it("should set refresh to true when explicitly true", () => {
    const result = validateSearchArgs({ refresh: true });
    expect(result.refresh).toBe(true);
  });

  it("should set refresh to false for truthy non-boolean values", () => {
    const result = validateSearchArgs({ refresh: "true" });
    expect(result.refresh).toBe(false);
  });
});
