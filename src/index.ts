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

import { getEFinanceData } from "./cache.js";
import { validateSearchArgs } from "./validation.js";
import { filterCompanies, formatSearchResult, formatStatistics } from "./formatters.js";

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
