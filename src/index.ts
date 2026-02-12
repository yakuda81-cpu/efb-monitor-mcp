/**
 * 전자금융업 등록/말소 현황 조회 MCP 서버
 * 금융감독원 FINE 포털에서 엑셀 파일을 자동 다운로드하여 파싱
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as XLSX from "xlsx";

// ============================================================
// 상수 & 타입
// ============================================================

const FINE_BASE_URL = "https://fine.fss.or.kr";
const FINE_PAGE_PATH = "/fine/bbs/B0000392/view.do";
const FINE_ALLOWED_PATH_PREFIX = "/fine/cmmn/file/fileDown.do";
const FETCH_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간
const MAX_COMPANY_NAME_LENGTH = 100;
const MAX_DISPLAY = 50;

const BUSINESS_TYPES = ["선불", "직불", "PG", "ESCROW", "EBPP"] as const;
type BusinessType = (typeof BUSINESS_TYPES)[number];

const VALID_BUSINESS_TYPES = new Set<string>([...BUSINESS_TYPES, "전체"]);
const VALID_STATUSES = new Set<string>(["등록", "말소", "전체"]);

// 등록 시트 컬럼 인덱스
const REG_COL = { NO: 1, DATE: 2, NAME: 3, TYPE_START: 4 } as const;
// 말소 시트 컬럼 인덱스
const CAN_COL = { NO: 0, DATE: 1, NAME: 2, TYPE_START: 3 } as const;
// 데이터 시작 행 (0-indexed, 헤더 이후)
const DATA_START_ROW = 5;

function validateNttId(value: string): string {
  if (!/^\d{1,10}$/.test(value)) {
    throw new Error(`유효하지 않은 FINE_PAGE_NTT_ID: "${value}" (숫자만 허용)`);
  }
  return value;
}

const FINE_PAGE_NTT_ID = validateNttId(process.env.FINE_PAGE_NTT_ID || "63573");
const FINE_PAGE_URL = `${FINE_BASE_URL}${FINE_PAGE_PATH}?nttId=${FINE_PAGE_NTT_ID}&menuNo=900495&pageIndex=1`;

interface EFinanceCompany {
  번호: number;
  업체명: string;
  업종목록: BusinessType[];
  등록일: string;
  말소일: string;
  상태: "등록" | "말소";
  비고: string;
}

interface EFinanceData {
  registered: EFinanceCompany[];
  cancelled: EFinanceCompany[];
  dataDate: string;
  fileName: string;
  fetchedAt: Date;
}

// ============================================================
// fetch 유틸리티
// ============================================================

function createFetchOptions(
  accept?: string,
): { headers: Record<string, string>; signal: AbortSignal } {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (compatible; efb-monitor-mcp/1.0.0)",
  };
  if (accept) {
    headers["Accept"] = accept;
  }

  return { headers, signal: controller.signal };
}

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
// FINE 포털 HTML fetch → 엑셀 URL 추출
// ============================================================

async function fetchFinePageHtml(): Promise<string> {
  const response = await fetch(FINE_PAGE_URL, createFetchOptions("text/html"));

  if (!response.ok) {
    throw new McpError(
      ErrorCode.InternalError,
      "FINE 포털 페이지 요청에 실패했습니다.",
    );
  }

  return response.text();
}

function extractExcelDownloadUrl(html: string): { url: string; fileName: string } {
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

// ============================================================
// 엑셀 다운로드 & 파싱
// ============================================================

async function downloadExcelFile(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, createFetchOptions());

  if (!response.ok) {
    throw new McpError(
      ErrorCode.InternalError,
      "엑셀 파일 다운로드에 실패했습니다.",
    );
  }

  return response.arrayBuffer();
}

function parseRegisteredSheet(sheet: XLSX.WorkSheet): EFinanceCompany[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const companies: EFinanceCompany[] = [];

  const typeColumns: [number, BusinessType][] = [
    [REG_COL.TYPE_START, "선불"],
    [REG_COL.TYPE_START + 1, "직불"],
    [REG_COL.TYPE_START + 2, "PG"],
    [REG_COL.TYPE_START + 3, "ESCROW"],
    [REG_COL.TYPE_START + 4, "EBPP"],
  ];

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

function parseCancelledSheet(sheet: XLSX.WorkSheet): EFinanceCompany[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const companies: EFinanceCompany[] = [];

  const typeColumns: [number, BusinessType][] = [
    [CAN_COL.TYPE_START, "선불"],
    [CAN_COL.TYPE_START + 1, "직불"],
    [CAN_COL.TYPE_START + 2, "PG"],
    [CAN_COL.TYPE_START + 3, "ESCROW"],
    [CAN_COL.TYPE_START + 4, "EBPP"],
  ];

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

function parseExcelData(buffer: ArrayBuffer, fileName: string): EFinanceData {
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

// ============================================================
// 캐시
// ============================================================

let cachedData: EFinanceData | null = null;

function isCacheValid(): boolean {
  if (!cachedData) return false;
  return Date.now() - cachedData.fetchedAt.getTime() < CACHE_TTL_MS;
}

async function getEFinanceData(forceRefresh = false): Promise<EFinanceData> {
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

// ============================================================
// 입력 검증
// ============================================================

function validateSearchArgs(args: Record<string, unknown>): {
  company_name?: string;
  business_type: string;
  status: string;
  refresh: boolean;
} {
  const company_name = args.company_name != null ? String(args.company_name) : undefined;
  if (company_name && company_name.length > MAX_COMPANY_NAME_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `업체명은 ${MAX_COMPANY_NAME_LENGTH}자 이내로 입력해주세요.`,
    );
  }

  const business_type = args.business_type != null ? String(args.business_type) : "전체";
  if (!VALID_BUSINESS_TYPES.has(business_type)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `유효하지 않은 업종: "${business_type}". 허용 값: ${[...VALID_BUSINESS_TYPES].join(", ")}`,
    );
  }

  const status = args.status != null ? String(args.status) : "전체";
  if (!VALID_STATUSES.has(status)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `유효하지 않은 상태: "${status}". 허용 값: ${[...VALID_STATUSES].join(", ")}`,
    );
  }

  const refresh = args.refresh === true;

  return { company_name, business_type, status, refresh };
}

// ============================================================
// 결과 포맷터
// ============================================================

function getAllCompanies(data: EFinanceData): EFinanceCompany[] {
  return [...data.registered, ...data.cancelled];
}

function filterCompanies(
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

function formatSearchResult(companies: EFinanceCompany[], data: EFinanceData): string {
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

function formatStatistics(data: EFinanceData): string {
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

// ============================================================
// MCP 서버
// ============================================================

const server = new Server(
  { name: "efb-monitor-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_efinance_companies",
      description:
        "전자금융업 등록 및 말소 현황을 조회합니다. 금융감독원 FINE 포털에서 최신 데이터를 가져와 업체명, 업종, 등록/말소 상태로 검색합니다.",
      inputSchema: {
        type: "object" as const,
        properties: {
          company_name: {
            type: "string",
            description: "검색할 업체명 (부분 일치, 예: '카카오', '네이버')",
          },
          business_type: {
            type: "string",
            enum: ["선불", "직불", "PG", "ESCROW", "EBPP", "전체"],
            description:
              "업종 필터: 선불(선불전자지급수단), 직불(직불전자지급수단), PG(전자지급결제대행), ESCROW(결제대금예치), EBPP(전자고지결제). 기본값: 전체",
          },
          status: {
            type: "string",
            enum: ["등록", "말소", "전체"],
            description: "등록/말소 상태 필터. 기본값: 전체",
          },
          refresh: {
            type: "boolean",
            description: "true면 캐시를 무시하고 최신 데이터를 다시 가져옵니다. 기본값: false",
          },
        },
        required: [],
      },
    },
    {
      name: "get_efinance_statistics",
      description:
        "전자금융업 등록/말소 현황의 통계 요약을 조회합니다. 업종별 등록/말소 업체 수를 한눈에 파악할 수 있습니다.",
      inputSchema: {
        type: "object" as const,
        properties: {
          refresh: {
            type: "boolean",
            description: "true면 캐시를 무시하고 최신 데이터를 다시 가져옵니다. 기본값: false",
          },
        },
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "search_efinance_companies": {
        const validated = validateSearchArgs(args as Record<string, unknown>);
        const data = await getEFinanceData(validated.refresh);
        const filtered = filterCompanies(
          data,
          validated.company_name,
          validated.business_type,
          validated.status,
        );

        return {
          content: [{ type: "text", text: formatSearchResult(filtered, data) }],
        };
      }

      case "get_efinance_statistics": {
        const refresh = (args as Record<string, unknown>).refresh === true;
        const data = await getEFinanceData(refresh);

        return {
          content: [{ type: "text", text: formatStatistics(data) }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `알 수 없는 도구: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `도구 실행 중 오류가 발생했습니다.`,
    );
  }
});

// ============================================================
// 서버 시작
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("전자금융업 등록/말소 현황 MCP 서버 시작됨");
}

main().catch((error) => {
  console.error("서버 시작 실패:", error);
  process.exit(1);
});
