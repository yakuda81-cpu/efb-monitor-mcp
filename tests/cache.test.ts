import { describe, it, expect, vi, beforeEach } from "vitest";
import { CACHE_TTL_MS } from "../src/types.js";

// ============================================================
// cache.ts tests - uses vi.doMock + dynamic import for module isolation
// ============================================================

function createMockData(overrides: Record<string, unknown> = {}) {
  return {
    registered: [{ 번호: 1, 업체명: "테스트", 업종목록: [], 등록일: "", 말소일: "", 상태: "등록", 비고: "" }],
    cancelled: [],
    dataDate: "2024-06-01",
    fileName: "test.xlsx",
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe("getEFinanceData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  async function setupModule(mockData: ReturnType<typeof createMockData>) {
    const mockFetchHtml = vi.fn().mockResolvedValue("<html>mock</html>");
    const mockExtractUrl = vi.fn().mockReturnValue({ url: "https://example.com/file.xlsx", fileName: "test.xlsx" });
    const mockDownload = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const mockParse = vi.fn().mockReturnValue(mockData);

    vi.doMock("../src/fine-portal.js", () => ({
      fetchFinePageHtml: mockFetchHtml,
      extractExcelDownloadUrl: mockExtractUrl,
      downloadExcelFile: mockDownload,
    }));

    vi.doMock("../src/excel-parser.js", () => ({
      parseExcelData: mockParse,
    }));

    const { getEFinanceData } = await import("../src/cache.js");
    return { getEFinanceData, mockFetchHtml, mockExtractUrl, mockDownload, mockParse };
  }

  it("should fetch data on first call", async () => {
    const mockData = createMockData();
    const { getEFinanceData, mockFetchHtml } = await setupModule(mockData);

    const result = await getEFinanceData();
    expect(result).toEqual(mockData);
    expect(mockFetchHtml).toHaveBeenCalledOnce();
  });

  it("should use cache on second call within TTL", async () => {
    const mockData = createMockData();
    const { getEFinanceData, mockFetchHtml } = await setupModule(mockData);

    await getEFinanceData();
    await getEFinanceData();

    expect(mockFetchHtml).toHaveBeenCalledOnce();
  });

  it("should force refresh when forceRefresh=true", async () => {
    const mockData = createMockData();
    const { getEFinanceData, mockFetchHtml } = await setupModule(mockData);

    await getEFinanceData();
    await getEFinanceData(true);

    expect(mockFetchHtml).toHaveBeenCalledTimes(2);
  });

  it("should refetch after TTL expires", async () => {
    vi.useFakeTimers();
    const mockData = createMockData({ fetchedAt: new Date() });
    const { getEFinanceData, mockFetchHtml } = await setupModule(mockData);

    await getEFinanceData();

    vi.advanceTimersByTime(CACHE_TTL_MS + 1);

    await getEFinanceData();

    expect(mockFetchHtml).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("should call full pipeline: fetchHtml -> extractUrl -> download -> parse", async () => {
    const mockData = createMockData();
    const { getEFinanceData, mockFetchHtml, mockExtractUrl, mockDownload, mockParse } =
      await setupModule(mockData);

    await getEFinanceData();

    expect(mockFetchHtml).toHaveBeenCalledOnce();
    expect(mockExtractUrl).toHaveBeenCalledWith("<html>mock</html>");
    expect(mockDownload).toHaveBeenCalledWith("https://example.com/file.xlsx");
    expect(mockParse).toHaveBeenCalled();
  });

  it("should propagate errors from fetch", async () => {
    vi.doMock("../src/fine-portal.js", () => ({
      fetchFinePageHtml: vi.fn().mockRejectedValue(new Error("network error")),
      extractExcelDownloadUrl: vi.fn(),
      downloadExcelFile: vi.fn(),
    }));
    vi.doMock("../src/excel-parser.js", () => ({
      parseExcelData: vi.fn(),
    }));

    const { getEFinanceData } = await import("../src/cache.js");

    await expect(getEFinanceData()).rejects.toThrow("network error");
  });
});
