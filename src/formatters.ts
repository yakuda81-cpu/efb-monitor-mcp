/**
 * 검색 결과 및 통계 포맷터
 */

import {
  BUSINESS_TYPES,
  MAX_DISPLAY,
  type BusinessType,
  type EFinanceCompany,
  type EFinanceData,
} from "./types.js";

// ============================================================
// 필터링
// ============================================================

function getAllCompanies(data: EFinanceData): EFinanceCompany[] {
  return [...data.registered, ...data.cancelled];
}

export function filterCompanies(
  data: EFinanceData,
  companyName?: string,
  businessType?: string,
  status?: string,
): EFinanceCompany[] {
  let result = getAllCompanies(data);

  if (companyName) {
    const keyword = companyName.toLowerCase();
    result = result.filter((c) => c.업체명.toLowerCase().includes(keyword));
  }

  if (businessType && businessType !== "전체") {
    result = result.filter((c) => c.업종목록.includes(businessType as BusinessType));
  }

  if (status && status !== "전체") {
    result = result.filter((c) => c.상태 === status);
  }

  return result;
}

// ============================================================
// 포맷터
// ============================================================

export function formatSearchResult(companies: EFinanceCompany[], data: EFinanceData): string {
  let result = `## 전자금융업 등록/말소 현황 검색 결과\n`;
  result += `기준일: ${data.dataDate} | 검색 결과: ${companies.length}건\n`;

  if (companies.length === 0) {
    result += "\n검색 조건에 맞는 업체가 없습니다.";
    return result;
  }

  const display = companies.slice(0, MAX_DISPLAY);

  for (let i = 0; i < display.length; i++) {
    const c = display[i];
    if (!c) continue;
    result += `\n[${i + 1}] ${c.업체명}`;
    result += `\n    상태: ${c.상태}`;
    result += `\n    업종: ${c.업종목록.join(", ") || "-"}`;
    if (c.등록일) result += `\n    등록일: ${c.등록일}`;
    if (c.말소일) result += `\n    말소일: ${c.말소일}`;
  }

  if (companies.length > MAX_DISPLAY) {
    result += `\n\n... 외 ${companies.length - MAX_DISPLAY}건 (검색 조건을 좁혀주세요)`;
  }

  return result;
}

export function formatStatistics(data: EFinanceData): string {
  const { registered, cancelled, dataDate } = data;

  const regByType: Record<string, number> = {};
  for (const type of BUSINESS_TYPES) regByType[type] = 0;
  for (const c of registered) {
    for (const t of c.업종목록) regByType[t] = (regByType[t] ?? 0) + 1;
  }

  const canByType: Record<string, number> = {};
  for (const type of BUSINESS_TYPES) canByType[type] = 0;
  for (const c of cancelled) {
    for (const t of c.업종목록) canByType[t] = (canByType[t] ?? 0) + 1;
  }

  const totalRegTypes = Object.values(regByType).reduce((a, b) => a + b, 0);
  const totalCanTypes = Object.values(canByType).reduce((a, b) => a + b, 0);

  let result = `## 전자금융업 등록/말소 현황 통계\n`;
  result += `기준일: ${dataDate}\n\n`;

  result += `### 전체 현황\n`;
  result += `- 등록: ${registered.length}개사 (${totalRegTypes}개 업종)\n`;
  result += `- 말소/취소: ${cancelled.length}개사 (${totalCanTypes}개 업종)\n\n`;

  result += `### 업종별 현황\n`;
  result += `| 업종 | 등록 | 말소 |\n`;
  result += `|------|------|------|\n`;
  for (const type of BUSINESS_TYPES) {
    result += `| ${type} | ${regByType[type]}건 | ${canByType[type]}건 |\n`;
  }

  return result;
}
