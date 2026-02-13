import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { parseRegisteredSheet, parseCancelledSheet, parseExcelData } from "../src/excel-parser.js";
import { DATA_START_ROW, BUSINESS_TYPES } from "../src/types.js";

// ============================================================
// Helpers: build real XLSX sheets from AOA data
// ============================================================

/**
 * Build a registered sheet.
 * Header rows (0..4) are filler; data starts at DATA_START_ROW (5).
 * Columns: [skip, NO, DATE, NAME, 선불, 직불, PG, ESCROW, EBPP]
 * (REG_COL: NO=1, DATE=2, NAME=3, TYPE_START=4)
 */
function buildRegisteredAoa(
  rows: Array<{
    no: number;
    date: string | number;
    name: string;
    types: Record<string, string>;
  }>,
): unknown[][] {
  // Header rows must contain data so sheet_to_json preserves row indices
  const header: unknown[][] = Array.from({ length: DATA_START_ROW }, (_, i) => [`header-${i}`]);
  const dataRows = rows.map((r) => {
    const row: unknown[] = ["", r.no, r.date, r.name];
    for (const t of BUSINESS_TYPES) {
      row.push(r.types[t] ?? "");
    }
    return row;
  });
  return [...header, ...dataRows];
}

/**
 * Build a cancelled sheet.
 * Columns: [NO, DATE, NAME, 선불, 직불, PG, ESCROW, EBPP]
 * (CAN_COL: NO=0, DATE=1, NAME=2, TYPE_START=3)
 */
function buildCancelledAoa(
  rows: Array<{
    no: number;
    date: string | number;
    name: string;
    types: Record<string, string>;
  }>,
): unknown[][] {
  const header: unknown[][] = Array.from({ length: DATA_START_ROW }, (_, i) => [`header-${i}`]);
  const dataRows = rows.map((r) => {
    const row: unknown[] = [r.no, r.date, r.name];
    for (const t of BUSINESS_TYPES) {
      row.push(r.types[t] ?? "");
    }
    return row;
  });
  return [...header, ...dataRows];
}

function aoaToSheet(aoa: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(aoa);
}

// ============================================================
// parseRegisteredSheet
// ============================================================

describe("parseRegisteredSheet", () => {
  it("should parse a single registered company", () => {
    const aoa = buildRegisteredAoa([
      { no: 1, date: "2024-01-15", name: "테스트회사", types: { PG: "●" } },
    ]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      번호: 1,
      업체명: "테스트회사",
      상태: "등록",
      업종목록: ["PG"],
    });
  });

  it("should parse multiple business types", () => {
    const aoa = buildRegisteredAoa([
      { no: 1, date: "2024-01-01", name: "멀티업종", types: { 선불: "●", PG: "○", EBPP: "●" } },
    ]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result[0]!.업종목록).toEqual(["선불", "PG", "EBPP"]);
  });

  it("should recognize ○ as valid marker", () => {
    const aoa = buildRegisteredAoa([
      { no: 1, date: "2024-01-01", name: "회사", types: { 직불: "○" } },
    ]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result[0]!.업종목록).toContain("직불");
  });

  it("should skip rows with no=0 or negative", () => {
    const aoa = buildRegisteredAoa([
      { no: 0, date: "2024-01-01", name: "스킵회사", types: { PG: "●" } },
      { no: -1, date: "2024-01-01", name: "스킵회사2", types: { PG: "●" } },
      { no: 1, date: "2024-01-01", name: "유효회사", types: { PG: "●" } },
    ]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result).toHaveLength(1);
    expect(result[0]!.업체명).toBe("유효회사");
  });

  it("should skip rows with empty name", () => {
    const aoa = buildRegisteredAoa([
      { no: 1, date: "2024-01-01", name: "", types: { PG: "●" } },
      { no: 2, date: "2024-01-01", name: "  ", types: { PG: "●" } },
    ]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result).toHaveLength(0);
  });

  it("should convert Excel serial date to YYYY-MM-DD", () => {
    // 45306 = 2024-01-15 in Excel serial date
    const aoa = buildRegisteredAoa([
      { no: 1, date: 45306, name: "날짜테스트", types: { PG: "●" } },
    ]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result[0]!.등록일).toBe("2024-01-15");
  });

  it("should handle string dates as-is", () => {
    const aoa = buildRegisteredAoa([
      { no: 1, date: "2023-12-25", name: "문자날짜", types: {} },
    ]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result[0]!.등록일).toBe("2023-12-25");
  });

  it("should return empty array for sheet with only headers", () => {
    const aoa: unknown[][] = Array.from({ length: DATA_START_ROW }, (_, i) => [`header-${i}`]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result).toHaveLength(0);
  });

  it("should set 상태 as 등록 and 말소일 as empty", () => {
    const aoa = buildRegisteredAoa([
      { no: 1, date: "2024-01-01", name: "등록회사", types: {} },
    ]);
    const result = parseRegisteredSheet(aoaToSheet(aoa));
    expect(result[0]!.상태).toBe("등록");
    expect(result[0]!.말소일).toBe("");
  });
});

// ============================================================
// parseCancelledSheet
// ============================================================

describe("parseCancelledSheet", () => {
  it("should parse a single cancelled company", () => {
    const aoa = buildCancelledAoa([
      { no: 1, date: "2024-02-01", name: "말소회사", types: { PG: "말소" } },
    ]);
    const result = parseCancelledSheet(aoaToSheet(aoa));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      번호: 1,
      업체명: "말소회사",
      상태: "말소",
      업종목록: ["PG"],
    });
  });

  it("should recognize 취소 as valid marker", () => {
    const aoa = buildCancelledAoa([
      { no: 1, date: "2024-01-01", name: "취소회사", types: { ESCROW: "취소" } },
    ]);
    const result = parseCancelledSheet(aoaToSheet(aoa));
    expect(result[0]!.업종목록).toContain("ESCROW");
  });

  it("should parse multiple cancelled types", () => {
    const aoa = buildCancelledAoa([
      { no: 1, date: "2024-01-01", name: "멀티말소", types: { 선불: "말소", PG: "취소" } },
    ]);
    const result = parseCancelledSheet(aoaToSheet(aoa));
    expect(result[0]!.업종목록).toEqual(["선불", "PG"]);
  });

  it("should set 상태 as 말소 and 등록일 as empty", () => {
    const aoa = buildCancelledAoa([
      { no: 1, date: "2024-03-01", name: "말소기업", types: {} },
    ]);
    const result = parseCancelledSheet(aoaToSheet(aoa));
    expect(result[0]!.상태).toBe("말소");
    expect(result[0]!.등록일).toBe("");
    expect(result[0]!.말소일).toBe("2024-03-01");
  });

  it("should skip rows with invalid no", () => {
    const aoa = buildCancelledAoa([
      { no: 0, date: "2024-01-01", name: "스킵", types: {} },
      { no: 1, date: "2024-01-01", name: "유효", types: {} },
    ]);
    const result = parseCancelledSheet(aoaToSheet(aoa));
    expect(result).toHaveLength(1);
  });
});

// ============================================================
// parseExcelData
// ============================================================

describe("parseExcelData", () => {
  function buildWorkbook(sheets: Record<string, unknown[][]>): ArrayBuffer {
    const wb = XLSX.utils.book_new();
    for (const [name, aoa] of Object.entries(sheets)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
    }
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return out as ArrayBuffer;
  }

  it("should parse workbook with both sheets", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const buffer = buildWorkbook({
      "등록현황": buildRegisteredAoa([
        { no: 1, date: "2024-01-01", name: "등록회사", types: { PG: "●" } },
      ]),
      "말소현황": buildCancelledAoa([
        { no: 1, date: "2024-02-01", name: "말소회사", types: { PG: "말소" } },
      ]),
    });

    const result = parseExcelData(buffer, "전자금융업_등록현황_20240601.xlsx");
    expect(result.registered).toHaveLength(1);
    expect(result.cancelled).toHaveLength(1);
    expect(result.dataDate).toBe("2024-06-01");
    expect(result.fileName).toBe("전자금융업_등록현황_20240601.xlsx");
  });

  it("should extract date from fileName", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const buffer = buildWorkbook({
      "등록현황": buildRegisteredAoa([
        { no: 1, date: "2024-01-01", name: "회사", types: {} },
      ]),
    });

    const result = parseExcelData(buffer, "전자금융업_20231231.xlsx");
    expect(result.dataDate).toBe("2023-12-31");
  });

  it("should set dataDate to 알 수 없음 when no date in fileName", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const buffer = buildWorkbook({
      "등록현황": buildRegisteredAoa([
        { no: 1, date: "2024-01-01", name: "회사", types: {} },
      ]),
    });

    const result = parseExcelData(buffer, "전자금융업_현황.xlsx");
    expect(result.dataDate).toBe("알 수 없음");
  });

  it("should throw McpError when no data found", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const buffer = buildWorkbook({
      "기타시트": [["no data"]],
    });

    expect(() => parseExcelData(buffer, "test.xlsx")).toThrow(
      "엑셀 파일에서 데이터를 추출할 수 없습니다",
    );
  });

  it("should recognize 취소 in sheet name as cancelled sheet", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const buffer = buildWorkbook({
      "등록현황": buildRegisteredAoa([
        { no: 1, date: "2024-01-01", name: "등록회사", types: {} },
      ]),
      "취소현황": buildCancelledAoa([
        { no: 1, date: "2024-01-01", name: "취소회사", types: { PG: "취소" } },
      ]),
    });

    const result = parseExcelData(buffer, "test_20240101.xlsx");
    expect(result.cancelled).toHaveLength(1);
    expect(result.cancelled[0]!.업체명).toBe("취소회사");
  });
});
