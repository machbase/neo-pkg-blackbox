import { useState } from 'react';
import type { FFmpegOption } from '../../types/server';
import Icon from '../common/Icon';

const RTSP_TRANSPORT_OPTIONS = ['tcp', 'udp', 'udp_multicast', 'http'];
const RTSP_FLAGS_OPTIONS = ['prefer_tcp', 'filter_src', 'listen', 'latm', 'rfc2190', 'skip_rtcp'];

export interface FFmpegConfigType {
  rtspTransport: string;
  rtspFlags: string;
  bufferSize: number;
  maxDelay: number;
  probesize: number;
  analyzeduration: number;
  useWallclockAsTimestamps: string;
  videoCodec: string;
  format: string;
  segDuration: number;
  useTemplate: boolean;
  useTimeline: boolean;
  ffmpegCommand: string;
  outputDir: string;
  archiveDir: string;
}

export const FFMPEG_DEFAULT_CONFIG: FFmpegConfigType = {
  rtspTransport: 'tcp',
  rtspFlags: 'prefer_tcp',
  bufferSize: 1024000,
  maxDelay: 500000,
  probesize: 5000000,
  analyzeduration: 5000000,
  useWallclockAsTimestamps: '1',
  videoCodec: 'copy',
  format: 'dash',
  segDuration: 5,
  useTemplate: true,
  useTimeline: true,
  ffmpegCommand: '',
  outputDir: '',
  archiveDir: '',
};

export function ffmpegConfigToOptions(config: FFmpegConfigType): FFmpegOption[] {
  return [
    { k: 'rtsp_transport', v: config.rtspTransport },
    { k: 'rtsp_flags', v: config.rtspFlags },
    { k: 'buffer_size', v: String(config.bufferSize) },
    { k: 'max_delay', v: String(config.maxDelay) },
    { k: 'probesize', v: String(config.probesize) },
    { k: 'analyzeduration', v: String(config.analyzeduration) },
    { k: 'use_wallclock_as_timestamps', v: config.useWallclockAsTimestamps },
    { k: 'c:v', v: config.videoCodec },
    { k: 'f', v: config.format },
    { k: 'seg_duration', v: String(config.segDuration) },
    { k: 'use_template', v: config.useTemplate ? '1' : '0' },
    { k: 'use_timeline', v: config.useTimeline ? '1' : '0' },
  ];
}

export function optionsToFFmpegConfig(options: FFmpegOption[], extra?: { ffmpeg_command?: string; output_dir?: string; archive_dir?: string }): FFmpegConfigType {
  const config = { ...FFMPEG_DEFAULT_CONFIG };
  for (const opt of options) {
    switch (opt.k) {
      case 'rtsp_transport': config.rtspTransport = String(opt.v); break;
      case 'rtsp_flags': config.rtspFlags = String(opt.v); break;
      case 'buffer_size': config.bufferSize = Number(opt.v) || 0; break;
      case 'max_delay': config.maxDelay = Number(opt.v) || 0; break;
      case 'probesize': config.probesize = Number(opt.v) || 0; break;
      case 'analyzeduration': config.analyzeduration = Number(opt.v) || 0; break;
      case 'use_wallclock_as_timestamps': config.useWallclockAsTimestamps = String(opt.v); break;
      case 'c:v': config.videoCodec = String(opt.v); break;
      case 'f': config.format = String(opt.v); break;
      case 'seg_duration': config.segDuration = Number(opt.v) || 0; break;
      case 'use_template': config.useTemplate = opt.v === '1' || opt.v === 1; break;
      case 'use_timeline': config.useTimeline = opt.v === '1' || opt.v === 1; break;
    }
  }
  if (extra?.ffmpeg_command) config.ffmpegCommand = extra.ffmpeg_command;
  if (extra?.output_dir) config.outputDir = extra.output_dir;
  if (extra?.archive_dir) config.archiveDir = extra.archive_dir;
  return config;
}

interface FFmpegConfigProps {
  value: FFmpegConfigType;
  onChange: (config: FFmpegConfigType) => void;
  readOnly?: boolean;
}

export default function FFmpegConfig({ value, onChange, readOnly = false }: FFmpegConfigProps) {
  const [collapsed, setCollapsed] = useState(true);
  const update = <K extends keyof FFmpegConfigType>(key: K, val: FFmpegConfigType[K]) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <article className="card">
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <h3 className="card-title" style={{ marginBottom: 0 }}>FFmpeg Configuration</h3>
        <span
          style={{
            display: 'inline-flex',
            justifyContent: 'center',
            color: 'var(--color-on-surface-tertiary)',
            transition: 'transform 0.15s',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          }}
        >
          <Icon name="chevron_right" className="icon-sm" />
        </span>
      </div>

      {!collapsed && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Input & Network */}
          <SectionTitle>Input &amp; Network</SectionTitle>
          <Row>
            <SelectField label="RTSP Transport" value={value.rtspTransport} options={RTSP_TRANSPORT_OPTIONS} onChange={(v) => update('rtspTransport', v)} disabled={readOnly} />
            <SelectField label="RTSP Flags" value={value.rtspFlags} options={RTSP_FLAGS_OPTIONS} onChange={(v) => update('rtspFlags', v)} disabled={readOnly} />
          </Row>
          <Row>
            <NumberField label="Buffer Size" value={value.bufferSize} onChange={(v) => update('bufferSize', v)} disabled={readOnly} />
            <NumberField label="Max Delay" value={value.maxDelay} onChange={(v) => update('maxDelay', v)} disabled={readOnly} />
          </Row>
          <Row>
            <NumberField label="Probe Size" value={value.probesize} onChange={(v) => update('probesize', v)} disabled={readOnly} />
            <NumberField label="Analyze Duration" value={value.analyzeduration} onChange={(v) => update('analyzeduration', v)} disabled={readOnly} />
          </Row>

          {/* Output & DASH */}
          <SectionTitle>Output &amp; DASH</SectionTitle>
          <Row>
            <TextField label="Video Codec" value={value.videoCodec} onChange={(v) => update('videoCodec', v)} disabled={readOnly} />
            <TextField label="Format" value={value.format} onChange={(v) => update('format', v)} disabled={readOnly} />
          </Row>
          <Row>
            <NumberField label="Segment Duration (s)" value={value.segDuration} onChange={(v) => update('segDuration', v)} disabled={readOnly} />
            <div style={{ display: 'flex', gap: 16 }}>
              <CheckboxField label="Use Template" checked={value.useTemplate} onChange={(v) => update('useTemplate', v)} disabled={readOnly} />
              <CheckboxField label="Use Timeline" checked={value.useTimeline} onChange={(v) => update('useTimeline', v)} disabled={readOnly} />
            </div>
          </Row>

          {/* Paths */}
          <SectionTitle>Paths</SectionTitle>
          <TextField label="FFmpeg Command" value={value.ffmpegCommand} onChange={(v) => update('ffmpegCommand', v)} disabled={readOnly} />
          <Row>
            <TextField label="Output Directory" value={value.outputDir} onChange={(v) => update('outputDir', v)} disabled={readOnly} />
            <TextField label="Archive Directory" value={value.archiveDir} onChange={(v) => update('archiveDir', v)} disabled={readOnly} />
          </Row>
        </div>
      )}
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '12px 16px' }}>{children}</div>;
}
function TextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return <div><label className="form-label">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{ width: '100%' }} /></div>;
}
function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return <div><label className="form-label">{label}</label><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} disabled={disabled} style={{ width: '100%' }} /></div>;
}
function SelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return <div><label className="form-label">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{ width: '100%' }}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>;
}
function CheckboxField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', cursor: disabled ? 'default' : 'pointer' }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />{label}</label>;
}
