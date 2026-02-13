/**
 * 인메모리 캐시 및 데이터 수집 오케스트레이션
 */

import { CACHE_TTL_MS, type EFinanceData } from "./types.js";
import { fetchFinePageHtml, extractExcelDownloadUrl, downloadExcelFile } from "./fine-portal.js";
import { parseExcelData } from "./excel-parser.js";

// ============================================================
// 캐시
// ============================================================

let cachedData: EFinanceData | null = null;

function isCacheValid(): boolean {
  if (!cachedData) return false;
  return Date.now() - cachedData.fetchedAt.getTime() < CACHE_TTL_MS;
}

export async function getEFinanceData(forceRefresh = false): Promise<EFinanceData> {
  if (!forceRefresh && isCacheValid() && cachedData) {
    console.error("[EFB] 캐시 사용 (TTL 이내)");
    return cachedData;
  }

  console.error("[EFB] FINE 포털에서 데이터 가져오는 중...");

  const html = await fetchFinePageHtml();
  const { url, fileName } = extractExcelDownloadUrl(html);
  console.error(`[EFB] 엑셀 파일: ${fileName}`);

  const buffer = await downloadExcelFile(url);
  console.error(`[EFB] 다운로드 완료: ${buffer.byteLength} bytes`);

  cachedData = parseExcelData(buffer, fileName);
  console.error(
    `[EFB] 파싱 완료: 등록 ${cachedData.registered.length}건, 말소 ${cachedData.cancelled.length}건`,
  );

  return cachedData;
}
