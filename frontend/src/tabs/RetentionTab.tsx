import { useEffect, useState } from "react";
import type { RetentionSettings } from "../types/settings";
import type { RetentionStatus } from "../types/retention";
import Icon from "../components/common/Icon";
import { useRetention } from "../hooks/useRetention";
import { getLocalTimezoneLabel } from "../utils/timeUtils";

type RetentionTabProps = {
    settings: RetentionSettings;
    onChange: (next: RetentionSettings) => void;
};

function formatLocalDateTime(iso: string | undefined | null): string {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

const KIND_BADGE_STYLES: Record<string, string> = {
    main: "border-info/40 bg-info/10 text-info",
    log: "border-success/40 bg-success/10 text-success",
};

function KindBadge({ kind }: { kind: string }) {
    const style = KIND_BADGE_STYLES[kind] ?? "border-border bg-surface-elevated text-on-surface-secondary";
    return (
        <span className={`inline-block px-1.5 py-0.5 rounded-base text-[10px] font-medium uppercase tracking-wide border ${style}`}>
            {kind}
        </span>
    );
}

function HeaderStatusBadge({
    status,
    statusLoading,
    statusError,
    manualRunning,
}: {
    status: RetentionStatus | null;
    statusLoading: boolean;
    statusError: string | null;
    manualRunning: boolean;
}) {
    if (statusError) {
        return (
            <div className="relative group">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-base border border-error/30 bg-error/10 text-error text-xs font-medium uppercase tracking-wide cursor-help">
                    <Icon name="error" className="icon-sm" />
                    Status error
                </span>
                <div className="hidden group-hover:block absolute left-0 top-full mt-2 z-20 min-w-72 max-w-md w-max p-3 rounded-base border border-border bg-surface-elevated shadow-lg text-xs text-error break-words">
                    {statusError}
                </div>
            </div>
        );
    }

    if (statusLoading && !status) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-base border border-border bg-surface-elevated text-on-surface-disabled text-xs font-medium uppercase tracking-wide">
                Loading
            </span>
        );
    }

    if (!status) return null;

    const last = status.last_run;
    const isRunning = status.running || manualRunning;
    return (
        <div className="relative group">
            {isRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-base border border-warning/30 bg-warning/10 text-warning text-xs font-medium uppercase tracking-wide cursor-help">
                    <span className="block w-1.5 h-1.5 rounded-full shrink-0 bg-warning" />
                    Running
                </span>
            ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-base border border-border bg-surface-elevated text-on-surface-disabled text-xs font-medium uppercase tracking-wide cursor-help">
                    Idle
                </span>
            )}
            <div className="hidden group-hover:flex flex-col gap-2.5 absolute left-0 top-full mt-2 z-20 min-w-72 max-w-md w-max p-3 rounded-base border border-border bg-surface-elevated shadow-lg text-xs">
                <div>
                    <div className="font-medium text-on-surface mb-0.5">Next run</div>
                    {status.next_run_at ? (
                        <div className="text-on-surface-secondary whitespace-nowrap">{formatLocalDateTime(status.next_run_at)}</div>
                    ) : (
                        <div className="text-on-surface-hint">Not scheduled.</div>
                    )}
                </div>
                <div>
                    <div className="font-medium text-on-surface mb-0.5">Last result</div>
                    {last ? (
                        <div className="text-on-surface-secondary flex flex-col gap-0.5">
                            <span className="whitespace-nowrap">Finished: {formatLocalDateTime(last.finished_at)}</span>
                            <span>
                                {last.dry_run ? "Dry-run" : "Actual run"} · rows {last.candidate_rows ?? 0} · files {last.deleted_files ?? 0} · skipped {last.skipped_files ?? 0}
                            </span>
                        </div>
                    ) : (
                        <div className="text-on-surface-hint">No previous run.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function RetentionTab({ settings, onChange }: RetentionTabProps) {
    const [dryRun, setDryRun] = useState(true);
    const { status, statusLoading, statusError, runManual, running, lastRunResult } = useRetention();

    const tzLabel = getLocalTimezoneLabel();
    const enabled = settings.enabled;

    const setEnabled = (v: boolean) => onChange({ ...settings, enabled: v });
    const setKeepValue = (v: number) => onChange({ ...settings, keepValue: v });
    const setKeepUnit = (v: "hours" | "days") => onChange({ ...settings, keepUnit: v });
    const setStartAtLocal = (v: string) => onChange({ ...settings, startAtLocal: v });
    const setIntervalHours = (v: number) => onChange({ ...settings, intervalHours: v });

    // 숫자 input 은 빈 문자열 표시를 허용하기 위해 로컬 텍스트 버퍼를 둔다.
    // (Number("") === 0 이라 toNumber 만으로는 backspace 직후 즉시 "0" 으로 되돌려져 편집이 막힌다.)
    const [keepValueText, setKeepValueText] = useState(String(settings.keepValue));
    const [intervalHoursText, setIntervalHoursText] = useState(String(settings.intervalHours));

    useEffect(() => {
        setKeepValueText(String(settings.keepValue));
    }, [settings.keepValue]);

    useEffect(() => {
        setIntervalHoursText(String(settings.intervalHours));
    }, [settings.intervalHours]);

    // Targets(deleteDatabase / deleteFiles / consistencyCleanup) 는 정책상 항상 true 로 전송된다.
    // UI 노출 없음 — toPostPayload 에서 강제 true 로 직렬화한다.

    const runBtnLabel = running ? "Running..." : "Run Now";
    const runResult = lastRunResult;

    // Manual Run 결과 요약. 라벨은 한 단어로 통일 — dry_run 여부는 카드 헤더에서 이미 표시됨.
    const summaryItems: { label: string; value: number }[] = runResult
        ? [
              { label: "Rows", value: runResult.candidate_rows ?? 0 },
              { label: "Files", value: runResult.deleted_files ?? 0 },
              { label: "Missing", value: runResult.missing_files ?? 0 },
              { label: "Skipped", value: runResult.skipped_files ?? 0 },
              { label: "Metadata", value: runResult.deleted_metadata ?? 0 },
          ]
        : [];

    return (
        <section className="flex flex-col gap-6">
            <div className="page-title-group">
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="page-title">Retention</h1>
                    <HeaderStatusBadge status={status} statusLoading={statusLoading} statusError={statusError} manualRunning={running} />
                </div>
                <p className="page-desc">Automatically remove old recordings on a recurring schedule, or run a one-off cleanup manually.</p>
            </div>

            <div className="flex flex-col gap-4">
                {/* (1) Schedule Card */}
                <article className="card">
                    <h3 className="card-title">
                        <Icon name="timer" className="icon-sm" />
                        Schedule
                    </h3>

                    <div className="flex items-center justify-between gap-2 mt-3 p-3 rounded-base border border-border bg-surface">
                        <div>
                            <p className="text-sm font-medium text-on-surface">Enable scheduled retention</p>
                            <p className="text-xs text-on-surface-hint mt-1">Run cleanup automatically based on the schedule below.</p>
                        </div>
                        <div className={`switch ${enabled ? "active" : ""}`} onClick={() => setEnabled(!enabled)}>
                            <div className="switch-thumb" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3 mt-3 items-end">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="retention-keep-value" className="form-label">
                                Keep duration
                            </label>
                            <input
                                id="retention-keep-value"
                                name="retention-keep-value"
                                type="number"
                                min={0}
                                value={keepValueText}
                                disabled={!enabled}
                                className="w-full"
                                onChange={(event) => {
                                    const raw = event.target.value;
                                    setKeepValueText(raw);
                                    if (raw === "") return;
                                    const parsed = Number(raw);
                                    if (!Number.isNaN(parsed)) setKeepValue(parsed);
                                }}
                                onBlur={() => {
                                    if (keepValueText === "") setKeepValueText(String(settings.keepValue));
                                }}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="retention-keep-unit" className="form-label">
                                Unit
                            </label>
                            <select
                                id="retention-keep-unit"
                                name="retention-keep-unit"
                                value={settings.keepUnit}
                                disabled={!enabled}
                                className="w-full"
                                onChange={(event) => setKeepUnit(event.target.value as RetentionSettings["keepUnit"])}
                            >
                                <option value="hours">hours</option>
                                <option value="days">days</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-3">
                        <label htmlFor="retention-start-at" className="form-label">
                            Start time (local)
                        </label>
                        <input
                            id="retention-start-at"
                            name="retention-start-at"
                            type="time"
                            value={settings.startAtLocal}
                            disabled={!enabled}
                            className="w-full"
                            onChange={(event) => setStartAtLocal(event.target.value)}
                        />
                        <p className="text-xs text-on-surface-hint">Stored in UTC ({tzLabel})</p>
                    </div>

                    <div className="flex flex-col gap-2 mt-3">
                        <label htmlFor="retention-interval-hours" className="form-label">
                            Interval (hours, 0 = 24h)
                        </label>
                        <input
                            id="retention-interval-hours"
                            name="retention-interval-hours"
                            type="number"
                            min={0}
                            value={intervalHoursText}
                            disabled={!enabled}
                            className="w-full"
                            onChange={(event) => {
                                const raw = event.target.value;
                                setIntervalHoursText(raw);
                                if (raw === "") return;
                                const parsed = Number(raw);
                                if (!Number.isNaN(parsed)) setIntervalHours(parsed);
                            }}
                            onBlur={() => {
                                if (intervalHoursText === "") setIntervalHoursText(String(settings.intervalHours));
                            }}
                        />
                    </div>
                </article>

                {/* (2) Manual Run Card */}
                <article className={`card ${!enabled ? "opacity-60" : ""}`} aria-disabled={!enabled}>
                    <h3 className="card-title">
                        <Icon name="play_circle" className="icon-sm" />
                        Manual Run
                    </h3>
                    <p className="text-xs text-on-surface-hint mt-2">
                        Trigger a one-off retention pass against the currently saved configuration. Dry-run previews candidate deletions without modifying data.
                    </p>

                    {!enabled && (
                        <div className="mt-3 p-3 rounded-base border border-warning/30 bg-warning/10 text-warning text-xs flex items-start gap-2">
                            <Icon name="info" className="icon-sm shrink-0 mt-0.5" />
                            <span>Enable scheduled retention above to use Manual Run — it executes against the saved schedule configuration.</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-3 p-3 rounded-base border border-border bg-surface">
                        <div>
                            <p className="text-sm font-medium text-on-surface">Dry run</p>
                            <p className="text-xs text-on-surface-hint mt-1">Preview candidates without deleting anything.</p>
                        </div>
                        <div
                            className={`switch ${dryRun ? "active" : ""} ${!enabled ? "pointer-events-none opacity-60" : ""}`}
                            onClick={() => enabled && setDryRun((v) => !v)}
                        >
                            <div className="switch-thumb" />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                        <button type="button" className="btn btn-primary" disabled={running || !enabled} onClick={() => void runManual(dryRun)}>
                            <Icon name="play_circle" className="icon-sm" />
                            {runBtnLabel}
                        </button>
                    </div>

                    {runResult && (
                        <div className="mt-4 p-3 rounded-base border border-border bg-surface flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-sm font-medium text-on-surface">{runResult.dry_run ? "Dry-run preview" : "Run result"}</p>
                                <span className="text-xs text-on-surface-hint">{formatLocalDateTime(runResult.finished_at)}</span>
                            </div>

                            <div className="text-xs">
                                <span className="text-on-surface-hint">Cutoff </span>
                                <span className="text-on-surface-secondary">{formatLocalDateTime(runResult.cutoff)}</span>
                                <span className="text-on-surface-hint"> — older data is targeted</span>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {summaryItems.map((item) => {
                                    const dim = item.value === 0;
                                    return (
                                        <div
                                            key={item.label}
                                            className="flex flex-col gap-0.5 px-2.5 py-2 rounded-base border border-border bg-surface-elevated"
                                        >
                                            <span className="text-[11px] uppercase tracking-wide text-on-surface-hint whitespace-nowrap">{item.label}</span>
                                            <span
                                                className={`font-mono text-xl font-semibold leading-none ${dim ? "text-on-surface-disabled" : "text-on-surface"}`}
                                            >
                                                {item.value}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {(() => {
                                const tables = runResult.tables ?? [];
                                if (tables.length === 0) return null;
                                return (
                                    <div className="text-xs">
                                        <p className="text-on-surface-hint mb-2">Per-table breakdown ({tables.length})</p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="text-on-surface-hint border-b border-border">
                                                        <th className="text-left py-1.5 pr-3 font-normal">Table</th>
                                                        <th className="text-left py-1.5 pr-3 font-normal">Kind</th>
                                                        <th className="text-right py-1.5 pr-3 font-normal">Rows</th>
                                                        <th className="text-right py-1.5 pr-3 font-normal">Files</th>
                                                        <th className="text-right py-1.5 pr-3 font-normal">Missing</th>
                                                        <th className="text-right py-1.5 pr-3 font-normal">Skipped</th>
                                                        <th className="text-right py-1.5 pr-3 font-normal">Meta</th>
                                                        <th className="text-left py-1.5 font-normal">Cameras</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tables.map((t) => {
                                                        const rows = t.candidate_rows ?? 0;
                                                        const files = t.deleted_files ?? 0;
                                                        const missing = t.missing_files ?? 0;
                                                        const skipped = t.skipped_files ?? 0;
                                                        const meta = t.deleted_metadata ?? 0;
                                                        const cameras = t.cameras ?? [];
                                                        return (
                                                            <tr key={`${t.table}-${t.kind}`} className="border-b border-border last:border-0">
                                                                <td className="py-1.5 pr-3 font-medium text-on-surface font-mono">{t.table}</td>
                                                                <td className="py-1.5 pr-3">
                                                                    <KindBadge kind={t.kind} />
                                                                </td>
                                                                <td className={`text-right py-1.5 pr-3 font-mono ${rows === 0 ? "text-on-surface-hint" : "text-on-surface"}`}>{rows}</td>
                                                                <td className={`text-right py-1.5 pr-3 font-mono ${files === 0 ? "text-on-surface-hint" : "text-on-surface"}`}>{files}</td>
                                                                <td className={`text-right py-1.5 pr-3 font-mono ${missing === 0 ? "text-on-surface-hint" : "text-on-surface"}`}>{missing}</td>
                                                                <td className={`text-right py-1.5 pr-3 font-mono ${skipped === 0 ? "text-on-surface-hint" : "text-on-surface"}`}>{skipped}</td>
                                                                <td className={`text-right py-1.5 pr-3 font-mono ${meta === 0 ? "text-on-surface-hint" : "text-on-surface"}`}>{meta}</td>
                                                                <td className="py-1.5">
                                                                    {cameras.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {cameras.map((c) => (
                                                                                <span
                                                                                    key={c.camera_id}
                                                                                    className="px-1.5 py-0.5 rounded-base bg-surface-elevated text-on-surface-secondary border border-border font-mono text-[11px]"
                                                                                >
                                                                                    {c.camera_id}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-on-surface-hint">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </article>
            </div>
        </section>
    );
}
