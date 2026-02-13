import { describe, it, expect } from "vitest";
import { filterCompanies, formatSearchResult, formatStatistics } from "../src/formatters.js";
import { MAX_DISPLAY, type BusinessType } from "../src/types.js";
import { createCompany, createData } from "./fixtures/test-helpers.js";

// ============================================================
// filterCompanies
// ============================================================

describe("filterCompanies", () => {
  const data = createData({
    registered: [
      createCompany({ 업체명: "카카오페이", 업종목록: ["PG", "선불"] as BusinessType[], 상태: "등록" }),
      createCompany({ 업체명: "네이버파이낸셜", 업종목록: ["PG"] as BusinessType[], 상태: "등록" }),
      createCompany({ 업체명: "토스페이먼츠", 업종목록: ["ESCROW"] as BusinessType[], 상태: "등록" }),
    ],
    cancelled: [
      createCompany({ 업체명: "카카오뱅크", 업종목록: ["직불"] as BusinessType[], 상태: "말소" }),
    ],
  });

  it("should return all companies when no filters applied", () => {
    const result = filterCompanies(data);
    expect(result).toHaveLength(4);
  });

  it("should filter by company name (case-insensitive)", () => {
    const result = filterCompanies(data, "카카오");
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.업체명)).toContain("카카오페이");
    expect(result.map((c) => c.업체명)).toContain("카카오뱅크");
  });

  it("should filter by business type", () => {
    const result = filterCompanies(data, undefined, "PG");
    expect(result).toHaveLength(2);
  });

  it("should not filter when business type is 전체", () => {
    const result = filterCompanies(data, undefined, "전체");
    expect(result).toHaveLength(4);
  });

  it("should filter by status 등록", () => {
    const result = filterCompanies(data, undefined, undefined, "등록");
    expect(result).toHaveLength(3);
  });

  it("should filter by status 말소", () => {
    const result = filterCompanies(data, undefined, undefined, "말소");
    expect(result).toHaveLength(1);
    expect(result[0]!.업체명).toBe("카카오뱅크");
  });

  it("should not filter when status is 전체", () => {
    const result = filterCompanies(data, undefined, undefined, "전체");
    expect(result).toHaveLength(4);
  });

  it("should combine all filters", () => {
    const result = filterCompanies(data, "카카오", "PG", "등록");
    expect(result).toHaveLength(1);
    expect(result[0]!.업체명).toBe("카카오페이");
  });

  it("should return empty when no match", () => {
    const result = filterCompanies(data, "존재하지않는회사");
    expect(result).toHaveLength(0);
  });

  it("should handle empty data", () => {
    const emptyData = createData();
    const result = filterCompanies(emptyData);
    expect(result).toHaveLength(0);
  });
});

// ============================================================
// formatSearchResult
// ============================================================

describe("formatSearchResult", () => {
  const data = createData({ dataDate: "2024-06-01" });

  it("should show zero results message", () => {
    const result = formatSearchResult([], data);
    expect(result).toContain("검색 결과: 0건");
    expect(result).toContain("검색 조건에 맞는 업체가 없습니다");
  });

  it("should format a single company", () => {
    const companies = [
      createCompany({
        업체명: "테스트회사",
        상태: "등록",
        업종목록: ["PG", "선불"] as BusinessType[],
        등록일: "2024-01-01",
      }),
    ];
    const result = formatSearchResult(companies, data);
    expect(result).toContain("[1] 테스트회사");
    expect(result).toContain("상태: 등록");
    expect(result).toContain("업종: PG, 선불");
    expect(result).toContain("등록일: 2024-01-01");
  });

  it("should not show 말소일 if empty", () => {
    const companies = [createCompany({ 말소일: "" })];
    const result = formatSearchResult(companies, data);
    expect(result).not.toContain("말소일:");
  });

  it("should show 말소일 for cancelled companies", () => {
    const companies = [createCompany({ 말소일: "2024-03-15", 상태: "말소" })];
    const result = formatSearchResult(companies, data);
    expect(result).toContain("말소일: 2024-03-15");
  });

  it("should truncate at MAX_DISPLAY", () => {
    const companies = Array.from({ length: MAX_DISPLAY + 10 }, (_, i) =>
      createCompany({ 업체명: `회사${i + 1}` }),
    );
    const result = formatSearchResult(companies, data);
    expect(result).toContain(`[${MAX_DISPLAY}]`);
    expect(result).not.toContain(`[${MAX_DISPLAY + 1}]`);
    expect(result).toContain(`외 10건`);
  });

  it("should not show truncation message when exactly MAX_DISPLAY", () => {
    const companies = Array.from({ length: MAX_DISPLAY }, (_, i) =>
      createCompany({ 업체명: `회사${i + 1}` }),
    );
    const result = formatSearchResult(companies, data);
    expect(result).not.toContain("외");
  });

  it("should include dataDate in header", () => {
    const result = formatSearchResult([], data);
    expect(result).toContain("기준일: 2024-06-01");
  });
});

// ============================================================
// formatStatistics
// ============================================================

describe("formatStatistics", () => {
  it("should show zero stats for empty data", () => {
    const data = createData({ dataDate: "2024-06-01" });
    const result = formatStatistics(data);
    expect(result).toContain("등록: 0개사");
    expect(result).toContain("말소/취소: 0개사");
    expect(result).toContain("기준일: 2024-06-01");
  });

  it("should count companies and types correctly", () => {
    const data = createData({
      registered: [
        createCompany({ 업종목록: ["PG", "선불"] as BusinessType[] }),
        createCompany({ 업종목록: ["PG"] as BusinessType[] }),
      ],
      cancelled: [
        createCompany({ 업종목록: ["ESCROW"] as BusinessType[], 상태: "말소" }),
      ],
    });
    const result = formatStatistics(data);
    expect(result).toContain("등록: 2개사 (3개 업종)");
    expect(result).toContain("말소/취소: 1개사 (1개 업종)");
  });

  it("should show per-type breakdown in table", () => {
    const data = createData({
      registered: [
        createCompany({ 업종목록: ["PG", "선불"] as BusinessType[] }),
      ],
      cancelled: [
        createCompany({ 업종목록: ["PG"] as BusinessType[], 상태: "말소" }),
      ],
    });
    const result = formatStatistics(data);
    expect(result).toContain("| PG | 1건 | 1건 |");
    expect(result).toContain("| 선불 | 1건 | 0건 |");
    expect(result).toContain("| 직불 | 0건 | 0건 |");
  });

  it("should include markdown table headers", () => {
    const data = createData();
    const result = formatStatistics(data);
    expect(result).toContain("| 업종 | 등록 | 말소 |");
    expect(result).toContain("|------|------|------|");
  });
});
