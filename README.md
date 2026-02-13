# efb-monitor-mcp

전자금융업 등록/말소 현황 조회 MCP 서버

금융감독원 FINE 포털에서 엑셀 파일을 자동 다운로드하여 파싱하고, MCP(Model Context Protocol) 도구로 제공합니다.

## 주요 기능

- **업체 검색** (`search_efinance_companies`) - 업체명, 업종, 등록/말소 상태로 검색
- **통계 조회** (`get_efinance_statistics`) - 업종별 등록/말소 업체 수 요약
- **자동 캐시** - 6시간 TTL 인메모리 캐시, 강제 갱신 옵션 지원
- **SSRF 방어** - 다운로드 URL 경로 화이트리스트, 리다이렉트 차단

## 지원 업종

| 약칭 | 정식 명칭 |
|------|-----------|
| 선불 | 선불전자지급수단 발행 및 관리업 |
| 직불 | 직불전자지급수단 발행 및 관리업 |
| PG | 전자지급결제대행업 |
| ESCROW | 결제대금예치업 |
| EBPP | 전자고지결제업 |

## 설치 및 실행

### 요구사항

- Node.js >= 18.0.0

### 설치

```bash
npm install
npm run build
```

### Claude Desktop 설정

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "efb-monitor": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "FINE_PAGE_NTT_ID": "63573"
      }
    }
  }
}
```

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `FINE_PAGE_NTT_ID` | FINE 포털 게시글 ID (숫자만 허용) | `63573` |

## MCP 도구

### search_efinance_companies

전자금융업 등록 및 말소 현황을 조회합니다.

| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| `company_name` | string | 검색할 업체명 (부분 일치) | - |
| `business_type` | string | 업종 필터 (`선불`, `직불`, `PG`, `ESCROW`, `EBPP`, `전체`) | `전체` |
| `status` | string | 상태 필터 (`등록`, `말소`, `전체`) | `전체` |
| `refresh` | boolean | 캐시 무시 강제 갱신 | `false` |

### get_efinance_statistics

업종별 등록/말소 업체 수 통계를 조회합니다.

| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| `refresh` | boolean | 캐시 무시 강제 갱신 | `false` |

## 프로젝트 구조

```
src/
├── index.ts          # MCP 서버 엔트리포인트 (도구 등록, 핸들러)
├── types.ts          # 상수, 타입, 인터페이스 (leaf node)
├── fine-portal.ts    # FINE 포털 HTML fetch, 엑셀 URL 추출, SSRF 방어
├── excel-parser.ts   # 등록/말소 시트 파싱, 엑셀→데이터 변환
├── cache.ts          # 인메모리 TTL 캐시, 데이터 수집 오케스트레이션
├── validation.ts     # MCP 도구 입력 검증 (화이트리스트 기반)
└── formatters.ts     # 검색 결과/통계 포맷팅
```

### 모듈 의존성

```
index.ts
├── cache.ts
│   ├── fine-portal.ts → types.ts
│   └── excel-parser.ts → types.ts
├── validation.ts → types.ts
└── formatters.ts → types.ts
```

## 보안

- **SSRF 방어**: 다운로드 URL 경로가 `/fine/cmmn/file/fileDown.do`로 시작하는지 검증, `redirect: "error"`로 리다이렉트 차단
- **입력 검증**: 업체명 100자 제한, 업종/상태 화이트리스트 검증
- **환경 변수 검증**: `FINE_PAGE_NTT_ID`는 숫자만 허용 (1~10자리)
- **타임아웃**: 모든 HTTP 요청에 30초 AbortController 타임아웃 적용

## 기술 스택

- TypeScript ESM (`"type": "module"`)
- MCP SDK (`@modelcontextprotocol/sdk`)
- xlsx (엑셀 파싱)
- Node.js 내장 fetch (외부 HTTP 의존성 없음)

## 라이선스

MIT
