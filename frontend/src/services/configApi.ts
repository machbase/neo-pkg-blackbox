import type { ApiConfigData, ApiConfigPostBody } from "../types/configApi";
import { parseJsonResponse } from "./apiClient";
import { getBboxInfo } from "./infoApi";

type ApiResult = {
    success: boolean;
    reason: string;
};

let bboxBaseUrlPromise: Promise<string> | null = null;

function resolveBboxBaseUrl(): Promise<string> {
    if (!bboxBaseUrlPromise) {
        bboxBaseUrlPromise = getBboxInfo()
            .then((info) => `${window.location.protocol}//${window.location.hostname}:${info.port}`)
            .catch((err) => { bboxBaseUrlPromise = null; throw err; });
    }
    return bboxBaseUrlPromise;
}

// 첫 설치 시 config.json 이 없으면 백엔드는 404 + success:false 를 반환한다.
// 이는 정상 흐름이므로 throw 하지 않고 null 을 돌려 caller 가 fallback 하게 한다.
export async function getConfig(): Promise<ApiConfigData | null> {
    const base = await resolveBboxBaseUrl();
    const response = await fetch(`${base}/api/config`, { method: "GET" });
    if (response.status === 404) return null;
    const envelope = await parseJsonResponse<ApiConfigData>(response);
    return envelope.data;
}

export async function postConfig(payload: ApiConfigPostBody): Promise<ApiResult> {
    const base = await resolveBboxBaseUrl();
    const response = await fetch(`${base}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const envelope = await parseJsonResponse<unknown>(response);
    return {
        success: envelope.success,
        reason: envelope.reason || "",
    };
}
