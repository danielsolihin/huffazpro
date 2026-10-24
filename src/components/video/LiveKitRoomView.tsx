'use client';

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ParticipantTile,
  useTracks,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

interface LiveKitRoomViewProps {
  roomName: string;
  userName: string;
  onDisconnect?: () => void;
}

// Pelindung ralat dalaman LiveKit
class LiveKitErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("LiveKit warning intercepted:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#020617', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span>Menyelaraskan video bilik tasmik...</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// Kawalan Pantas Kompak (Hanya Ikon, Tiada Teks Terpotong)
function CompactTasmikControls() {
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const toggleMic = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  const toggleCam = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    }
  };

  const handleLeave = () => {
    if (room) {
      room.disconnect();
    }
  };

  return (
    <div style={{
      background: '#0f172a',
      padding: '0.65rem',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '0.85rem',
      borderTop: '1px solid #1e293b'
    }}>
      {/* Butang Mikrofon (Ikon Sahaja) */}
      <button
        type="button"
        onClick={toggleMic}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: 'none',
          background: isMicrophoneEnabled ? '#334155' : '#ef4444',
          color: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        title={isMicrophoneEnabled ? 'Matikan Mikrofon' : 'Hidupkan Mikrofon'}
      >
        {isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
      </button>

      {/* Butang Kamera (Ikon Sahaja) */}
      <button
        type="button"
        onClick={toggleCam}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: 'none',
          background: isCameraEnabled ? '#334155' : '#ef4444',
          color: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        title={isCameraEnabled ? 'Matikan Kamera' : 'Hidupkan Kamera'}
      >
        {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
      </button>

      {/* Butang Tamatkan Panggilan (Ikon Sahaja) */}
      <button
        type="button"
        onClick={handleLeave}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: 'none',
          background: '#dc2626',
          color: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(220,38,38,0.3)'
        }}
        title="Tamatkan Panggilan"
      >
        <PhoneOff size={17} />
      </button>
    </div>
  );
}

// Susunan Video Guru & Pelajar
function TasmikConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: '260px', background: '#020617', position: 'relative' }}>
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: tracks.length > 1 ? '1fr 1fr' : '1fr',
        gap: '8px',
        padding: '8px',
        minHeight: '200px',
        background: '#020617'
      }}>
        {tracks.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '0.85rem',
            padding: '2rem'
          }}>
            <Loader2 className="animate-spin" size={28} color="#3b82f6" style={{ marginBottom: '0.5rem' }} />
            <span>Menyambungkan kamera dan audio...</span>
          </div>
        ) : (
          tracks.map((track) => (
            <ParticipantTile
              key={`${track.participant.identity}_${track.source}`}
              trackRef={track}
              style={{ borderRadius: '12px', overflow: 'hidden', height: '100%' }}
            />
          ))
        )}
      </div>

      <RoomAudioRenderer />
      
      {/* Kawalan Ikon Sahaja */}
      <CompactTasmikControls />
    </div>
  );
}

export default function LiveKitRoomView({ roomName, userName, onDisconnect }: LiveKitRoomViewProps) {
  const [token, setToken] = useState<string>('');
  const [isLoadingToken, setIsLoadingToken] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let isCancelled = false;

    if (!roomName || !userName) return;

    const fetchTokenSafely = async () => {
      setIsLoadingToken(true);
      setErrorMsg('');

      const endpoints = [
        '/api/get-participant-token',
        '/api/livekit',
        '/api/token'
      ];

      let validToken = '';

      for (const ep of endpoints) {
        try {
          const resp = await fetch(`${ep}?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(userName)}`);
          if (!resp.ok) continue;

          const rawText = await resp.text();
          if (rawText.trim().startsWith('{')) {
            const data = JSON.parse(rawText);
            if (data.token) {
              validToken = data.token;
              break;
            }
          }
        } catch {
          // Teruskan carian endpoint seterusnya
        }
      }

      if (isCancelled) return;

      if (validToken) {
        setToken(validToken);
      } else {
        setErrorMsg('Gagal memulakan bilik panggilan video. Sila semak sambungan API LiveKit.');
      }
      setIsLoadingToken(false);
    };

    fetchTokenSafely();

    return () => {
      isCancelled = true;
    };
  }, [roomName, userName]);

  const handleDisconnect = () => {
    setToken('');
    if (onDisconnect) {
      onDisconnect();
    }
  };

  if (isLoadingToken) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '260px',
        background: '#0f172a',
        color: '#94a3b8',
        borderRadius: '16px'
      }}>
        <Loader2 className="animate-spin" size={30} color="#0062ff" style={{ marginBottom: '0.75rem' }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Menyediakan bilik video...</span>
      </div>
    );
  }

  if (errorMsg || !token) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        background: '#0f172a',
        color: '#f87171',
        borderRadius: '16px',
        minHeight: '240px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{errorMsg || 'Token bilik tidak sah.'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '1rem',
            padding: '0.45rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: '#0062ff',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.8rem'
          }}
        >
          Muat Semula
        </button>
      </div>
    );
  }

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  return (
    <LiveKitErrorBoundary>
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={livekitUrl}
        data-lk-theme="default"
        onDisconnected={handleDisconnect}
        style={{ height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden' }}
      >
        <TasmikConference />
      </LiveKitRoom>
    </LiveKitErrorBoundary>
  );
}