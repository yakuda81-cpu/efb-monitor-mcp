import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractExcelDownloadUrl, fetchFinePageHtml, downloadExcelFile } from "../src/fine-portal.js";

// ============================================================
// extractExcelDownloadUrl (pure function)
// ============================================================

describe("extractExcelDownloadUrl", () => {
  const validHtml = `
    <a href="/fine/cmmn/file/fileDown.do?atchFileId=FILE_000001&amp;fileSn=1"
       class="link">전자금융업_등록현황_20240601.xlsx</a>
  `;

  it("should extract url and fileName from valid HTML", () => {
    const result = extractExcelDownloadUrl(validHtml);
    expect(result.url).toBe(
      "https://fine.fss.or.kr/fine/cmmn/file/fileDown.do?atchFileId=FILE_000001&fileSn=1",
    );
    expect(result.fileName).toBe("전자금융업_등록현황_20240601.xlsx");
  });

  it("should decode &amp; to &", () => {
    const html = `
      <a href="/fine/cmmn/file/fileDown.do?a=1&amp;b=2&amp;c=3">전자금융업_test.xlsx</a>
    `;
    const result = extractExcelDownloadUrl(html);
    expect(result.url).toContain("a=1&b=2&c=3");
    expect(result.url).not.toContain("&amp;");
  });

  it("should throw McpError when no matching link found", () => {
    expect(() => extractExcelDownloadUrl("<html>no link</html>")).toThrow(
      "엑셀 파일 다운로드 링크를 찾을 수 없습니다",
    );
  });

  it("should throw McpError when link text does not contain .xlsx", () => {
    const html = `<a href="/fine/cmmn/file/fileDown.do?id=1">전자금융업_문서.pdf</a>`;
    expect(() => extractExcelDownloadUrl(html)).toThrow(
      "엑셀 파일 다운로드 링크를 찾을 수 없습니다",
    );
  });

  it("should throw McpError for SSRF - path outside allowed prefix", () => {
    const html = `
      <a href="/evil/path/fileDown.do?id=1">전자금융업_test.xlsx</a>
    `;
    expect(() => extractExcelDownloadUrl(html)).toThrow(
      "엑셀 파일 다운로드 링크를 찾을 수 없습니다",
    );
  });

  it("should trim whitespace from fileName", () => {
    const html = `
      <a href="/fine/cmmn/file/fileDown.do?id=1">  전자금융업_등록현황_20240601.xlsx  </a>
    `;
    const result = extractExcelDownloadUrl(html);
    expect(result.fileName).toBe("전자금융업_등록현황_20240601.xlsx");
  });

  it("should match case-insensitively for 전자금융업", () => {
    const html = `
      <a href="/fine/cmmn/file/fileDown.do?id=1">전자금융업_REGISTERED_20240601.xlsx</a>
    `;
    const result = extractExcelDownloadUrl(html);
    expect(result.fileName).toBe("전자금융업_REGISTERED_20240601.xlsx");
  });
});

// ============================================================
// fetchFinePageHtml (fetch mocking)
// ============================================================

describe("fetchFinePageHtml", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should return HTML text on success", async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue("<html>fine portal</html>"),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const result = await fetchFinePageHtml();
    expect(result).toBe("<html>fine portal</html>");
  });

  it("should throw McpError on non-ok response", async () => {
    const mockResponse = { ok: false, status: 500, statusText: "Server Error" };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await expect(fetchFinePageHtml()).rejects.toThrow("FINE 포털 페이지 요청에 실패했습니다");
  });

  it("should pass correct headers including User-Agent", async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await fetchFinePageHtml();

    const callArgs = vi.mocked(fetch).mock.calls[0]!;
    const options = callArgs[1] as RequestInit;
    expect((options.headers as Record<string, string>)["User-Agent"]).toContain("efb-monitor-mcp");
    expect((options.headers as Record<string, string>)["Accept"]).toBe("text/html");
    expect(options.redirect).toBe("error");
  });
});

// ============================================================
// downloadExcelFile (fetch mocking)
// ============================================================

describe("downloadExcelFile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should return ArrayBuffer on success", async () => {
    const buffer = new ArrayBuffer(8);
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(buffer),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const result = await downloadExcelFile("https://fine.fss.or.kr/file.xlsx");
    expect(result).toBe(buffer);
  });

  it("should throw McpError on non-ok response", async () => {
    const mockResponse = { ok: false, status: 404 };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await expect(downloadExcelFile("https://fine.fss.or.kr/file.xlsx")).rejects.toThrow(
      "엑셀 파일 다운로드에 실패했습니다",
    );
  });
});
