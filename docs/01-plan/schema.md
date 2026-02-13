# efb-monitor-mcp Schema

> 데이터 구조, 엔티티, 관계 정의

---

## 1. Entities

### 1.1 EFinanceCompany (전자금융업체)

```typescript
interface EFinanceCompany {
  번호: number;          // 엑셀 행 번호
  업체명: string;        // 회사명
  업종목록: BusinessType[]; // 등록된 업종 (복수 가능)
  등록일: string;        // YYYY-MM-DD
  말소일: string;        // YYYY-MM-DD (등록 업체는 빈 문자열)
  상태: "등록" | "말소";  // 현재 상태
  비고: string;          // 추가 정보
}
```

### 1.2 EFinanceData (조회 데이터)

```typescript
interface EFinanceData {
  registered: EFinanceCompany[];  // 등록 업체 목록
  cancelled: EFinanceCompany[];   // 말소 업체 목록
  dataDate: string;               // 데이터 기준일 (YYYY-MM-DD)
  fileName: string;               // 엑셀 파일명
  fetchedAt: Date;                // 데이터 수집 시각
}
```

### 1.3 BusinessType (업종)

```typescript
const BUSINESS_TYPES = ["선불", "직불", "PG", "ESCROW", "EBPP"] as const;
type BusinessType = (typeof BUSINESS_TYPES)[number];
```

### 1.4 SearchArgs (검색 파라미터)

```typescript
interface SearchArgs {
  company_name?: string;   // 업체명 검색 (부분 일치, 최대 100자)
  business_type: string;   // 업종 필터 (기본: "전체")
  status: string;          // 상태 필터 (기본: "전체")
  refresh: boolean;        // 캐시 무시 여부
}
```

## 2. Constants

| 상수 | 값 | 용도 |
|------|-----|------|
| `FINE_BASE_URL` | `https://fine.fss.or.kr` | FINE 포털 도메인 |
| `FINE_PAGE_PATH` | `/fine/bbs/B0000392/view.do` | 게시판 경로 |
| `FINE_ALLOWED_PATH_PREFIX` | `/fine/cmmn/file/fileDown.do` | 허용된 다운로드 경로 (SSRF 방어) |
| `FETCH_TIMEOUT_MS` | 30,000 (30초) | HTTP 요청 타임아웃 |
| `CACHE_TTL_MS` | 21,600,000 (6시간) | 캐시 유효 기간 |
| `MAX_COMPANY_NAME_LENGTH` | 100 | 검색어 최대 길이 |
| `MAX_DISPLAY` | 50 | 검색 결과 최대 표시 수 |
| `DATA_START_ROW` | 5 | 엑셀 데이터 시작 행 (0-indexed) |
| `REG_COL` | `{NO:1, DATE:2, NAME:3, TYPE_START:4}` | 등록 시트 컬럼 인덱스 |
| `CAN_COL` | `{NO:0, DATE:1, NAME:2, TYPE_START:3}` | 말소 시트 컬럼 인덱스 |

## 3. MCP Tools

| Tool | 설명 | 파라미터 |
|------|------|---------|
| `search_efinance_companies` | 업체 검색 | company_name?, business_type?, status?, refresh? |
| `get_efinance_statistics` | 통계 요약 | refresh? |

## 4. Entity Relationships

```
                    ┌────────────────┐
                    │  .env          │
                    │  FINE_PAGE_    │
                    │  NTT_ID       │
                    └───────┬────────┘
                            │
                            ▼
┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ FINE Portal  │───▶│ Excel File    │───▶│ XLSX Parser  │
│ (HTML page)  │    │ (.xlsx)       │    │              │
└──────────────┘    └───────────────┘    └──────┬───────┘
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                            ┌──────────────┐       ┌──────────────┐
                            │ 등록 시트     │       │ 말소 시트     │
                            │ registered[] │       │ cancelled[]  │
                            └──────┬───────┘       └──────┬───────┘
                                   │                      │
                                   ▼                      ▼
                            ┌──────────────────────────────┐
                            │        EFinanceData          │
                            │  registered + cancelled      │
                            │  dataDate, fileName          │
                            └──────────────┬───────────────┘
                                           │
                                    ┌──────┴──────┐
                                    ▼             ▼
                              Cache (TTL)   MCP Tools
                              ┌─────────┐   ┌───────────────┐
                              │ 6시간   │   │ search        │
                              │ in-mem  │   │ statistics    │
                              └─────────┘   └───────────────┘
```

## 5. Data Flow

```
MCP Client (Claude Code)
    │
    ▼ CallToolRequest
MCP Server (index.ts)
    │
    ├─▶ validateSearchArgs()     입력 검증
    │
    ├─▶ getEFinanceData()        데이터 수집
    │       │
    │       ├─ isCacheValid()?   캐시 확인
    │       │   ├─ YES → return cached
    │       │   └─ NO ↓
    │       ├─ fetchFinePageHtml()     HTML 다운로드
    │       ├─ extractExcelDownloadUrl()  엑셀 URL 추출
    │       ├─ downloadExcelFile()     엑셀 다운로드
    │       └─ parseExcelData()        엑셀 파싱
    │               ├─ parseRegisteredSheet()
    │               └─ parseCancelledSheet()
    │
    ├─▶ filterCompanies()        필터링
    │
    └─▶ formatSearchResult()     결과 포맷
        formatStatistics()
```

## 6. Module Dependency (목표 구조)

```
src/types.ts          (no imports - leaf node)
    ▲    ▲    ▲    ▲    ▲
    │    │    │    │    │
    │    │    │    │    └── src/formatters.ts
    │    │    │    └─────── src/validation.ts
    │    │    └──────────── src/cache.ts
    │    └───────────────── src/excel-parser.ts
    └────────────────────── src/fine-portal.ts

src/index.ts ──▶ all modules (MCP server entrypoint)
```

Rule: `src/types.ts` is the only shared dependency. No circular dependencies.
