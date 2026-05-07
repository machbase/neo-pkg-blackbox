import { parseEnvelope } from "./apiClient";
import { resolveBboxBaseUrl } from "./configApi";
import type { RetentionStatus, RetentionRunResult } from "../types/retention";

export class RetentionConflictError extends Error {
  constructor(message = "Retention is already running") {
    super(message);
    this.name = "RetentionConflictError";
  }
}

export async function getRetentionStatus(): Promise<RetentionStatus> {
  const base = await resolveBboxBaseUrl();
  const response = await fetch(`${base}/api/retention/status`);
  const raw: unknown = await response.json();
  const envelope = parseEnvelope<RetentionStatus>(raw);
  if (!response.ok || !envelope.success) {
    throw new Error(envelope.reason || `HTTP ${response.status}`);
  }
  return envelope.data;
}

export async function runRetention(dryRun: boolean): Promise<RetentionRunResult> {
  const base = await resolveBboxBaseUrl();
  const response = await fetch(`${base}/api/retention/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dry_run: dryRun }),
  });
  if (response.status === 409) {
    throw new RetentionConflictError();
  }
  const raw: unknown = await response.json();
  const envelope = parseEnvelope<RetentionRunResult>(raw);
  if (!response.ok || !envelope.success) {
    throw new Error(envelope.reason || `HTTP ${response.status}`);
  }
  return envelope.data;
}
