# efb-monitor-mcp Glossary

> 전자금융업 등록/말소 현황 조회 MCP 서버 - 도메인 용어 정의

---

## 1. 도메인 용어 (전자금융업)

| 용어 | English | 정의 | 근거 |
|------|---------|------|------|
| 전자금융업 | Electronic Financial Business (EFB) | 전자금융거래법에 따라 등록된 금융업 | 전자금융거래법 제28조 |
| 선불전자지급수단 | Prepaid Electronic Payment | 선불 충전 후 결제하는 수단 (예: 카카오페이머니) | 전자금융거래법 제2조 14호 |
| 직불전자지급수단 | Debit Electronic Payment | 은행 계좌에서 즉시 출금되는 결제 수단 | 전자금융거래법 제2조 12호 |
| PG (전자지급결제대행) | Payment Gateway | 온라인 결제를 중개하는 서비스 (예: KG이니시스, 토스페이먼츠) | 전자금융거래법 제2조 19호 |
| ESCROW (결제대금예치) | Escrow Service | 구매자 확인 전까지 결제대금을 보관하는 서비스 | 전자금융거래법 제2조 20호 |
| EBPP (전자고지결제) | Electronic Bill Presentment & Payment | 전자 청구서 발송 및 결제 서비스 | 전자금융거래법 제2조 21호 |
| 등록 | Registration | 금융감독원에 전자금융업 등록 완료 상태 | |
| 말소 | Cancellation | 전자금융업 등록이 취소/말소된 상태 | |
| FINE 포털 | FINE Portal | 금융감독원 금융정보시스템 (fine.fss.or.kr) | |
| 기준일 | Data Date | 엑셀 파일명에 포함된 데이터 기준 날짜 (YYYYMMDD) | |

## 2. 기술 용어

| 용어 | 정의 | 참조 |
|------|------|------|
| MCP | Model Context Protocol - AI 모델이 외부 도구를 호출하는 프로토콜 | [MCP Spec](https://modelcontextprotocol.io) |
| MCP Tool | MCP 서버가 제공하는 호출 가능한 함수 | MCP SDK |
| StdioTransport | stdin/stdout을 통한 MCP 통신 방식 | MCP SDK |
| XLSX | Microsoft Excel Open XML 스프레드시트 형식 | ECMA-376 |
| SSRF | Server-Side Request Forgery - 서버 측 요청 위조 공격 | OWASP |
| TTL | Time To Live - 캐시 유효 기간 | |
| AbortController | fetch 요청 타임아웃 제어를 위한 Web API | WhatWG |

## 3. Mapping Table (도메인 <-> 코드)

| 도메인 용어 | 코드 변수/타입 | 모듈 |
|------------|--------------|------|
| 전자금융업 5업종 | `BUSINESS_TYPES` (`선불\|직불\|PG\|ESCROW\|EBPP`) | types.ts |
| 업종 타입 | `BusinessType` | types.ts |
| 전자금융업체 | `EFinanceCompany` | types.ts |
| 조회 데이터 | `EFinanceData` | types.ts |
| 등록 상태 | `VALID_STATUSES` (`등록\|말소\|전체`) | types.ts |
| FINE 포털 URL | `FINE_BASE_URL`, `FINE_PAGE_URL` | types.ts |
| 캐시 유효기간 | `CACHE_TTL_MS` (6시간) | types.ts |
| fetch 타임아웃 | `FETCH_TIMEOUT_MS` (30초) | types.ts |
| 게시글 ID | `FINE_PAGE_NTT_ID` (env var) | types.ts |

## 4. 용어 사용 규칙

1. **코드**: 영문 camelCase/PascalCase (`EFinanceCompany`, `businessType`)
2. **MCP Tool 응답**: 한국어 (`전자금융업 등록/말소 현황`)
3. **로그 메시지**: 한국어 (`[EFB] 파싱 완료`)
4. **상수**: UPPER_SNAKE_CASE (`FINE_BASE_URL`, `CACHE_TTL_MS`)
5. **환경 변수**: UPPER_SNAKE_CASE (`FINE_PAGE_NTT_ID`)
