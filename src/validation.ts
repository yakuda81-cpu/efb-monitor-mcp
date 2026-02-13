/**
 * MCP 도구 입력 검증
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { MAX_COMPANY_NAME_LENGTH, VALID_BUSINESS_TYPES, VALID_STATUSES } from "./types.js";

export interface ValidatedSearchArgs {
  company_name?: string;
  business_type: string;
  status: string;
  refresh: boolean;
}

export function validateSearchArgs(args: Record<string, unknown>): ValidatedSearchArgs {
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
