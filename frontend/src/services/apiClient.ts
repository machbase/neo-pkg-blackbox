import type { ApiEnvelope } from "../types/configApi";

export function apiBaseUrl(): string {
    return "/public/neo-pkg-blackbox/cgi-bin";
}

// cgi-bin 응답 봉투는 두 종류:
//   /servers, /servers/config       → { success, reason, elapse, data }
//   /api/* (info, install, ...)     → { ok, data, reason? }
// 어느 쪽이든 ApiEnvelope<T> 로 정규화한다.
export function parseEnvelope<T>(raw: unknown): ApiEnvelope<T> {
    if (!raw || typeof raw !== "object") {
        throw new Error("Invalid API response");
    }
    const obj = raw as Record<string, unknown>;
    const successFlag = typeof obj.success === "boolean"
        ? obj.success
        : typeof obj.ok === "boolean"
            ? obj.ok
            : null;
    if (successFlag === null) {
        throw new Error("Invalid API response: missing success/ok");
    }
    return {
        success: successFlag,
        reason: typeof obj.reason === "string" ? obj.reason : "",
        elapse: typeof obj.elapse === "string" ? obj.elapse : undefined,
        data: obj.data as T,
    };
}

export async function parseJsonResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
    const body: unknown = await response.json();
    const envelope = parseEnvelope<T>(body);
    if (!response.ok) {
        throw new Error(envelope.reason || `HTTP ${response.status}`);
    }
    if (!envelope.success) {
        throw new Error(envelope.reason || "Request failed");
    }
    return envelope;
}
