import { apiBaseUrl, parseJsonResponse } from "./apiClient";

interface BboxInfoRaw {
    port: string;
}

export interface BboxInfo {
    port: number;
}

export async function getBboxInfo(): Promise<BboxInfo> {
    const response = await fetch(`${apiBaseUrl()}/api/info`, { method: "GET" });
    const envelope = await parseJsonResponse<BboxInfoRaw>(response);
    return { port: Number(envelope.data?.port) || 8000 };
}
