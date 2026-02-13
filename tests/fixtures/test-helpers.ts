import type { EFinanceCompany, EFinanceData, BusinessType } from "../../src/types.js";

export function createCompany(overrides: Partial<EFinanceCompany> = {}): EFinanceCompany {
  return {
    번호: 1,
    업체명: "테스트업체",
    업종목록: ["PG"] as BusinessType[],
    등록일: "2024-01-01",
    말소일: "",
    상태: "등록",
    비고: "",
    ...overrides,
  };
}

export function createData(overrides: Partial<EFinanceData> = {}): EFinanceData {
  return {
    registered: [],
    cancelled: [],
    dataDate: "2024-06-01",
    fileName: "전자금융업_등록현황_20240601.xlsx",
    fetchedAt: new Date("2024-06-01T00:00:00Z"),
    ...overrides,
  };
}

export function assertMcpError(fn: () => unknown, messageIncludes?: string): void {
  try {
    fn();
    throw new Error("Expected McpError to be thrown");
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === undefined) {
      throw new Error(`Expected McpError but got: ${String(error)}`);
    }
    if (messageIncludes && !err.message?.includes(messageIncludes)) {
      throw new Error(
        `Expected message to include "${messageIncludes}" but got: "${err.message}"`,
      );
    }
  }
}

export async function assertMcpErrorAsync(
  fn: () => Promise<unknown>,
  messageIncludes?: string,
): Promise<void> {
  try {
    await fn();
    throw new Error("Expected McpError to be thrown");
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === undefined) {
      throw new Error(`Expected McpError but got: ${String(error)}`);
    }
    if (messageIncludes && !err.message?.includes(messageIncludes)) {
      throw new Error(
        `Expected message to include "${messageIncludes}" but got: "${err.message}"`,
      );
    }
  }
}
