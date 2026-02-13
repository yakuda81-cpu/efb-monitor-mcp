/**
 * 엑셀 파일 파싱 - 등록/말소 시트 파싱 및 데이터 추출
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import * as XLSX from "xlsx";
import {
  BUSINESS_TYPES,
  DATA_START_ROW,
  REG_COL,
  CAN_COL,
  type BusinessType,
  type EFinanceCompany,
  type EFinanceData,
} from "./types.js";

// ============================================================
// Excel 날짜 변환
// ============================================================

function excelDateToString(serial: number): string {
  if (!serial || serial < 1) return "";
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ============================================================
// 시트 파싱
// ============================================================

export function parseRegisteredSheet(sheet: XLSX.WorkSheet): EFinanceCompany[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const companies: EFinanceCompany[] = [];

  const typeColumns: [number, BusinessType][] = BUSINESS_TYPES.map(
    (type, i) => [REG_COL.TYPE_START + i, type],
  );

  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const no = Number(row[REG_COL.NO]);
    if (!no || no < 1) continue;

    const name = String(row[REG_COL.NAME] ?? "").trim();
    if (!name) continue;

    const dateVal = row[REG_COL.DATE];
    const dateStr =
      typeof dateVal === "number" ? excelDateToString(dateVal) : String(dateVal ?? "").trim();

    const types: BusinessType[] = [];
    for (const [colIdx, typeName] of typeColumns) {
      const cell = String(row[colIdx] ?? "").trim();
      if (cell.includes("●") || cell.includes("○")) {
        types.push(typeName);
      }
    }

    companies.push({
      번호: no,
      업체명: name,
      업종목록: types,
      등록일: dateStr,
      말소일: "",
      상태: "등록",
      비고: "",
    });
  }

  return companies;
}

export function parseCancelledSheet(sheet: XLSX.WorkSheet): EFinanceCompany[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const companies: EFinanceCompany[] = [];

  const typeColumns: [number, BusinessType][] = BUSINESS_TYPES.map(
    (type, i) => [CAN_COL.TYPE_START + i, type],
  );

  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const no = Number(row[CAN_COL.NO]);
    if (!no || no < 1) continue;

    const name = String(row[CAN_COL.NAME] ?? "").trim();
    if (!name) continue;

    const dateVal = row[CAN_COL.DATE];
    const dateStr =
      typeof dateVal === "number" ? excelDateToString(dateVal) : String(dateVal ?? "").trim();

    const types: BusinessType[] = [];
    for (const [colIdx, typeName] of typeColumns) {
      const cell = String(row[colIdx] ?? "").trim();
      if (cell.includes("말소") || cell.includes("취소")) {
        types.push(typeName);
      }
    }

    companies.push({
      번호: no,
      업체명: name,
      업종목록: types,
      등록일: "",
      말소일: dateStr,
      상태: "말소",
      비고: "",
    });
  }

  return companies;
}

// ============================================================
// 엑셀 파일 파싱 (워크북 → EFinanceData)
// ============================================================

export function parseExcelData(buffer: ArrayBuffer, fileName: string): EFinanceData {
  const workbook = XLSX.read(buffer, { type: "array" });

  const dateMatch = fileName.match(/(\d{8})/);
  const dateStr = dateMatch?.[1];
  const dataDate = dateStr
    ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    : "알 수 없음";

  let registered: EFinanceCompany[] = [];
  let cancelled: EFinanceCompany[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    console.error(`[EFB] 시트: "${sheetName}"`);

    if (sheetName.includes("말소") || sheetName.includes("취소")) {
      cancelled = parseCancelledSheet(sheet);
      console.error(`[EFB]   말소/취소 ${cancelled.length}건 파싱`);
    } else if (sheetName.includes("등록")) {
      registered = parseRegisteredSheet(sheet);
      console.error(`[EFB]   등록 ${registered.length}건 파싱`);
    }
  }

  if (registered.length === 0 && cancelled.length === 0) {
    throw new McpError(
      ErrorCode.InternalError,
      "엑셀 파일에서 데이터를 추출할 수 없습니다. 파일 구조가 변경되었을 수 있습니다.",
    );
  }

  return { registered, cancelled, dataDate, fileName, fetchedAt: new Date() };
}
