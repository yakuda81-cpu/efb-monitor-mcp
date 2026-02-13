/**
 * 상수, 타입, 인터페이스 정의
 * 모든 모듈의 공유 기반 (leaf node - 다른 src/ 모듈을 import하지 않음)
 */

// ============================================================
// FINE 포털 상수
// ============================================================

export const FINE_BASE_URL = "https://fine.fss.or.kr";
export const FINE_PAGE_PATH = "/fine/bbs/B0000392/view.do";
export const FINE_ALLOWED_PATH_PREFIX = "/fine/cmmn/file/fileDown.do";

// ============================================================
// 제한값 상수
// ============================================================

export const FETCH_TIMEOUT_MS = 30_000;
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간
export const MAX_COMPANY_NAME_LENGTH = 100;
export const MAX_DISPLAY = 50;

// ============================================================
// 엑셀 파싱 상수
// ============================================================

export const BUSINESS_TYPES = ["선불", "직불", "PG", "ESCROW", "EBPP"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const VALID_BUSINESS_TYPES = new Set<string>([...BUSINESS_TYPES, "전체"]);
export const VALID_STATUSES = new Set<string>(["등록", "말소", "전체"]);

// 등록 시트 컬럼 인덱스
export const REG_COL = { NO: 1, DATE: 2, NAME: 3, TYPE_START: 4 } as const;
// 말소 시트 컬럼 인덱스
export const CAN_COL = { NO: 0, DATE: 1, NAME: 2, TYPE_START: 3 } as const;
// 데이터 시작 행 (0-indexed, 헤더 이후)
export const DATA_START_ROW = 5;

// ============================================================
// 환경 변수
// ============================================================

function validateNttId(value: string): string {
  if (!/^\d{1,10}$/.test(value)) {
    throw new Error(`유효하지 않은 FINE_PAGE_NTT_ID: "${value}" (숫자만 허용)`);
  }
  return value;
}

export const FINE_PAGE_NTT_ID = validateNttId(process.env.FINE_PAGE_NTT_ID || "63573");
export const FINE_PAGE_URL = `${FINE_BASE_URL}${FINE_PAGE_PATH}?nttId=${FINE_PAGE_NTT_ID}&menuNo=900495&pageIndex=1`;

// ============================================================
// 인터페이스
// ============================================================

export interface EFinanceCompany {
  번호: number;
  업체명: string;
  업종목록: BusinessType[];
  등록일: string;
  말소일: string;
  상태: "등록" | "말소";
  비고: string;
}

export interface EFinanceData {
  registered: EFinanceCompany[];
  cancelled: EFinanceCompany[];
  dataDate: string;
  fileName: string;
  fetchedAt: Date;
}
