import type { ApiConfigData, ApiConfigPostBody } from "../types/configApi";
import { apiBaseUrl, parseJsonResponse } from "./apiClient";

type ApiResult = {
    success: boolean;
    reason: string;
};

const ENDPOINT = "/servers/config";

// 첫 설치 시 config.json 이 없으면 백엔드는 404 + success:false 를 반환한다.
// 이는 정상 흐름이므로 throw 하지 않고 null 을 돌려 caller 가 fallback 하게 한다.
export async function getConfig(): Promise<ApiConfigData | null> {
    const response = await fetch(`${apiBaseUrl()}${ENDPOINT}`, {
        method: "GET",
    });
    if (response.status === 404) return null;
    const envelope = await parseJsonResponse<ApiConfigData>(response);
    return envelope.data;
}

export async function postConfig(payload: ApiConfigPostBody): Promise<ApiResult> {
    const url = `${apiBaseUrl()}${ENDPOINT}`;
    const init: RequestInit = {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    };

    let response = await fetch(url, { ...init, method: "PUT" });
    if (response.status === 404) {
        response = await fetch(url, { ...init, method: "POST" });
    }

    const envelope = await parseJsonResponse<unknown>(response);
    return {
        success: envelope.success,
        reason: envelope.reason || "",
    };
}
