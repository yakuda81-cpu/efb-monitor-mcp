/**
 * FINE 포털 통신 - HTML 페이지 fetch, 엑셀 다운로드 URL 추출
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  FINE_BASE_URL,
  FINE_PAGE_URL,
  FINE_ALLOWED_PATH_PREFIX,
  FETCH_TIMEOUT_MS,
} from "./types.js";

// ============================================================
// fetch 유틸리티
// ============================================================

function createFetchOptions(
  accept?: string,
): { headers: Record<string, string>; signal: AbortSignal; redirect: RequestRedirect } {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (compatible; efb-monitor-mcp/1.0.0)",
  };
  if (accept) {
    headers["Accept"] = accept;
  }

  return { headers, signal: controller.signal, redirect: "error" };
}

// ============================================================
// HTML fetch & 엑셀 URL 추출
// ============================================================

export async function fetchFinePageHtml(): Promise<string> {
  const response = await fetch(FINE_PAGE_URL, createFetchOptions("text/html"));

  if (!response.ok) {
    throw new McpError(
      ErrorCode.InternalError,
      "FINE 포털 페이지 요청에 실패했습니다.",
    );
  }

  return response.text();
}

export function extractExcelDownloadUrl(html: string): { url: string; fileName: string } {
  const linkRegex =
    /href="(\/fine\/cmmn\/file\/fileDown\.do\?[^"]+)"[^>]*>\s*([^<]*전자금융업[^<]*\.xlsx)/i;
  const match = html.match(linkRegex);

  if (!match) {
    throw new McpError(
      ErrorCode.InternalError,
      "FINE 포털 페이지에서 엑셀 파일 다운로드 링크를 찾을 수 없습니다. 페이지 구조가 변경되었을 수 있습니다.",
    );
  }

  const path = match[1]!.replace(/&amp;/g, "&");
  const fileName = match[2]!.trim();

  if (!path.startsWith(FINE_ALLOWED_PATH_PREFIX)) {
    throw new McpError(
      ErrorCode.InternalError,
      "추출된 다운로드 경로가 허용된 패턴과 일치하지 않습니다.",
    );
  }

  return { url: `${FINE_BASE_URL}${path}`, fileName };
}

export async function downloadExcelFile(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, createFetchOptions());

  if (!response.ok) {
    throw new McpError(
      ErrorCode.InternalError,
      "엑셀 파일 다운로드에 실패했습니다.",
    );
  }

  return response.arrayBuffer();
}
