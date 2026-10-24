'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { 
  LiveKitRoom, 
  VideoConference, 
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import styles from '@/app/(dashboard)/pelajar/tasmik-live/BilikTasmik.module.css';

export default function BilikLiveGuruPage() {
  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('');

  useEffect(() => {
    async function getToken() {
      try {
        const res = await fetch('/api/livekit/token?room=halaqah-1&username=Ustaz_Roslan_(Guru)');
        const data = await res.json();
        setToken(data.token);
        setWsUrl(data.wsUrl);
      } catch (e) {
        console.error('Gagal mendapatkan token LiveKit Guru', e);
      }
    }
    getToken();
  }, []);

  return (
    <DashboardLayout userName="Roslan Tahir" userRole="guru">
      <div className={styles.container}>
        
        {/* PANEL VIDEO KESELURUHAN (GRID 2 LAJUR) */}
        <div style={{ gridColumn: 'span 2', height: 'calc(100vh - 120px)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: '#0f172a' }}>
          {token && wsUrl ? (
            <LiveKitRoom
              video={true}
              audio={true}
              token={token}
              serverUrl={wsUrl}
              data-lk-theme="default"
              style={{ height: '100%' }}
              onDisconnected={() => { window.location.href = '/guru'; }}
            >
              <VideoConference />
              <RoomAudioRenderer />
            </LiveKitRoom>
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <span>Menyambung ke Bilik Halaqah...</span>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}