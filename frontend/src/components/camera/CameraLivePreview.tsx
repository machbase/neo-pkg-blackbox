import { useRef, useEffect, useState } from 'react';
import Icon from '../common/Icon';

interface CameraLivePreviewProps {
  webrtcUrl?: string;
}

function LiveVideoContent({ webrtcUrl }: { webrtcUrl?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;

    const cleanup = () => {
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    if (!webrtcUrl || !videoRef.current) {
      cleanup();
      if (!cancelled) setStatus('idle');
      return cleanup;
    }

    cleanup();

    const connect = async () => {
      if (!cancelled) setStatus('connecting');
      try {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pcRef.current = pc;

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (event) => {
          if (event.track.kind === 'video' && videoRef.current) {
            const video = videoRef.current;
            video.srcObject = event.streams[0];
            const play = () => { video.play().then(() => { if (!cancelled) setStatus('live'); }).catch(() => { if (!cancelled) setStatus('error'); }); };
            if (video.readyState >= 3) play();
            else video.addEventListener('canplay', play, { once: true });
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            if (!cancelled) setStatus('error');
          }
        };

        const offer = await pc.createOffer();
        if (cancelled) return;
        await pc.setLocalDescription(offer);

        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') { resolve(); return; }
          const handler = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', handler); resolve(); } };
          pc.addEventListener('icegatheringstatechange', handler);
        });
        if (cancelled) return;

        const response = await fetch(webrtcUrl, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription?.sdp });
        if (!response.ok) throw new Error(`WHEP failed: ${response.status}`);

        const answerSdp = await response.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    connect();
    return () => { cancelled = true; cleanup(); };
  }, [webrtcUrl]);

  const overlayStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', fontSize: 'var(--font-size-sm)', color: 'var(--color-on-surface-disabled)',
  };

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000', borderRadius: 'var(--radius-base)', overflow: 'hidden' }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      {!webrtcUrl && <div style={overlayStyle}>No stream available</div>}
      {webrtcUrl && status === 'connecting' && <div style={overlayStyle}>Connecting...</div>}
      {webrtcUrl && status === 'error' && <div style={overlayStyle}>Connection failed</div>}
    </div>
  );
}

export default function CameraLivePreview({ webrtcUrl }: CameraLivePreviewProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  return (
    <>
      <button className="btn btn-ghost" onClick={() => setOpen(true)} disabled={!webrtcUrl}>
        <Icon name="play_circle" className="icon-sm" /> Preview
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-error)', color: '#fff', fontSize: 10, fontWeight: 700 }}>LIVE</span>
                Preview
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} style={{ padding: '0 4px' }}>
                <Icon name="close" className="icon-sm" />
              </button>
            </div>
            <LiveVideoContent webrtcUrl={webrtcUrl} />
          </div>
        </div>
      )}
    </>
  );
}
