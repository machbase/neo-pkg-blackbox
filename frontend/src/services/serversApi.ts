import { apiBaseUrl, parseJsonResponse } from "./apiClient";

export interface ServerEntry {
    alias: string;
    ip: string;
    port: number;
}

export type ServerEntryPatch = Partial<ServerEntry>;

type ApiResult = {
    success: boolean;
    reason: string;
};

export async function listServers(): Promise<ServerEntry[]> {
    const response = await fetch(`${apiBaseUrl()}/servers`, {
        method: "GET",
    });
    const envelope = await parseJsonResponse<ServerEntry[]>(response);
    return envelope.data ?? [];
}

export async function getServer(alias: string): Promise<ServerEntry> {
    const response = await fetch(`${apiBaseUrl()}/servers?alias=${encodeURIComponent(alias)}`, { method: "GET" });
    const envelope = await parseJsonResponse<ServerEntry>(response);
    return envelope.data;
}

export async function createServer(entry: ServerEntry): Promise<ServerEntry> {
    const response = await fetch(`${apiBaseUrl()}/servers`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
    });
    const envelope = await parseJsonResponse<ServerEntry>(response);
    return envelope.data;
}

export async function updateServer(alias: string, patch: ServerEntryPatch): Promise<ServerEntry> {
    const response = await fetch(`${apiBaseUrl()}/servers?alias=${encodeURIComponent(alias)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
    });
    const envelope = await parseJsonResponse<ServerEntry>(response);
    return envelope.data;
}

export async function deleteServer(alias: string): Promise<ApiResult> {
    const response = await fetch(`${apiBaseUrl()}/servers?alias=${encodeURIComponent(alias)}`, { method: "DELETE" });
    const envelope = await parseJsonResponse<unknown>(response);
    return {
        success: envelope.success,
        reason: envelope.reason || "",
    };
}
