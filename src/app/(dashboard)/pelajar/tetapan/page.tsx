'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { 
  Settings, User, Bell, Mic, Camera, Save, 
  Volume2, CheckCircle2, ShieldCheck, Mail, ClipboardList, Loader2, AlertCircle, PlayCircle, Video as VideoIcon
} from 'lucide-react';

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export default function TetapanPelajarPage() {
  const [activeTab, setActiveTab] = useState<'profil' | 'notifikasi' | 'audio' | 'kehadiran'>('profil');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // STATE UNTUK PROFIL
  const [profile, setProfile] = useState({
    id: '',
    nama: '',
    email: '',
    telefon: '',
    kataLaluan: '',
    avatarUrl: ''
  });

  // STATE UNTUK NOTIFIKASI
  const [notifSettings, setNotifSettings] = useState({
    emailTasmik: true,
    peringatanMurajaah: true,
    laporanMingguan: false,
    bunyiNotifikasi: true,
    waktuMurajaah: 'Lepas Subuh'
  });

  // STATE UNTUK AUDIO & VIDEO
  const [avSettings, setAvSettings] = useState({
    mikrofon: 'default',
    kamera: 'default',
    pembesarSuara: 'default',
    autoBukaKamera: false,
    autoBisuMikrofon: true,
    kurangkanHingar: true
  });

  // STATE SENARAI PERANTI SEBENAR (DINAMIK)
  const [audioInputs, setAudioInputs] = useState<DeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<DeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceInfo[]>([]);

  // STATE UJIAN PERANTI SECARA LIVE
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoTesting, setIsVideoTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAudioTesting, setIsAudioTesting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // STATE UNTUK KEHADIRAN
  const [kehadiranRecords, setKehadiranRecords] = useState<any[]>([]);

  // 1. PANGGIL DATA DARI SUPABASE (TIADA LOCAL STORAGE)
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const uId = authData.user.id;
          
          const { data: dbProfile } = await supabase.from('profiles').select('*').eq('id', uId).single();

          if (dbProfile) {
            setProfile({
              id: dbProfile.id,
              nama: dbProfile.full_name || '',
              email: dbProfile.email || authData.user.email || '',
              telefon: dbProfile.phone || '',
              kataLaluan: '',
              avatarUrl: dbProfile.avatar_url || ''
            });

            // Ekstrak tetapan notifikasi dan AV dari lajur system_prefs (JSONB)
            if (dbProfile.system_prefs) {
              const prefs = typeof dbProfile.system_prefs === 'string' ? JSON.parse(dbProfile.system_prefs) : dbProfile.system_prefs;
              if (prefs.notifSettings) setNotifSettings(prefs.notifSettings);
              if (prefs.avSettings) setAvSettings(prefs.avSettings);
            }
          }

          // Tarik rekod kehadiran
          const { data: att } = await supabase.from('attendance').select('*').eq('user_id', uId).order('created_at', { ascending: false });
          if (att && att.length > 0) {
            setKehadiranRecords(att);
          }
        }
      } catch (err) {
        console.error('Ralat menarik maklumat pelajar:', err);
      }
    };
    fetchUserData();
  }, []);

  // 2. KESAN PERANTI AUDIO & VIDEO SEBENAR PELAJAR
  useEffect(() => {
    const getDevices = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        setAudioInputs(devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Mikrofon Sistem' })));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Pembesar Suara Sistem' })));
        setVideoInputs(devices.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Kamera Sistem' })));
      } catch (err) {
        console.warn("Kebenaran peranti ditolak.", err);
      }
    };
    getDevices();
  }, []);

  // BERSIHKAN UJIAN PERANTI JIKA TUKAR TAB
  useEffect(() => {
    return () => {
      stopVideoTest();
      stopAudioTest();
    };
  }, [activeTab]);

  // ========================================================
  // FUNGSI UJIAN PERANTI SECARA LANGSUNG (LIVE DEVICE TEST)
  // ========================================================
  const stopVideoTest = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsVideoTesting(false);
  };

  const startVideoTest = async () => {
    try {
      stopVideoTest();
      const constraints = avSettings.kamera !== 'default' ? { deviceId: { exact: avSettings.kamera } } : true;
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
      videoStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsVideoTesting(true);
    } catch (err) {
      alert("Gagal mengakses kamera. Sila pastikan pelayar web anda membenarkan akses kamera.");
    }
  };

  const stopAudioTest = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsAudioTesting(false);
    setAudioLevel(0);
  };

  const startAudioTest = async () => {
    try {
      stopAudioTest();
      const constraints = avSettings.mikrofon !== 'default' ? { deviceId: { exact: avSettings.mikrofon } } : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      audioStreamRef.current = stream;
      
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateLevel = () => {
        if (!audioContextRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        setAudioLevel(average);
        requestAnimationFrame(updateLevel);
      };
      updateLevel();
      setIsAudioTesting(true);
    } catch (err) {
      alert("Gagal mengakses mikrofon. Sila pastikan pelayar web membenarkan akses mikrofon.");
    }
  };

  const playTestSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Nota D5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("AudioContext tidak disokong", e);
    }
  };

  // PENGENDALI MUAT NAIK GAMBAR PROFIL
  const compressImage = (file: File, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 320;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.85));
      };
    };
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Saiz gambar melebihi had 2MB. Sila pilih gambar yang lebih kecil.");
      return;
    }
    setIsUploadingAvatar(true);
    compressImage(file, async (base64String) => {
      setProfile(prev => ({ ...prev, avatarUrl: base64String }));
      setIsUploadingAvatar(false);
      setSaveMessage('Gambar profil dipilih! Sila klik butang "Simpan Profil" untuk kemas kini.');
      setTimeout(() => setSaveMessage(''), 4000);
    });
  };

  const handleUpdateJustifikasi = (id: string, text: string) => {
    setKehadiranRecords(kehadiranRecords.map(k => k.id === id ? { ...k, remarks: text } : k));
  };

  // 3. FUNGSI SIMPAN DATA KE SUPABASE
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      if (activeTab === 'profil' || activeTab === 'notifikasi' || activeTab === 'audio') {
        if (!profile.id) throw new Error("ID Pengguna tidak dijumpai.");

        const updatePayload: any = {
          full_name: profile.nama,
          phone: profile.telefon,
          avatar_url: profile.avatarUrl,
          system_prefs: { notifSettings, avSettings }
        };

        const { error } = await supabase.from('profiles').update(updatePayload).eq('id', profile.id);
        if (error) throw error;

        if (activeTab === 'profil' && profile.kataLaluan) {
          const { error: pwdErr } = await supabase.auth.updateUser({ password: profile.kataLaluan });
          if (pwdErr) throw pwdErr;
          setProfile(prev => ({ ...prev, kataLaluan: '' }));
        }

        window.dispatchEvent(new Event('avatarUpdated'));
      } 
      else if (activeTab === 'kehadiran') {
        const updates = kehadiranRecords.map(rec => 
          supabase.from('attendance').update({ remarks: rec.remarks }).eq('id', rec.id)
        );
        await Promise.all(updates);
      }

      setSaveMessage(
        activeTab === 'kehadiran' ? 'Justifikasi kehadiran berjaya disimpan!' : 
        activeTab === 'notifikasi' ? 'Tetapan notifikasi berjaya dikemas kini!' :
        activeTab === 'audio' ? 'Konfigurasi peranti berjaya disimpan!' :
        'Maklumat profil berjaya disimpan!'
      );
    } catch (err: any) {
      alert(`Ralat menyimpan: ${err.message || 'Sila cuba lagi'}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return (
    <DashboardLayout userName={profile.nama || 'Pelajar'} userRole="Pelajar">
      <div className="settings-container">
        
        {/* HEADER TETAPAN */}
        <div className="settings-header-box">
          <div className="header-icon">
            <Settings size={26} />
          </div>
          <div>
            <h1 className="header-title">Tetapan Global Akaun</h1>
            <p className="header-subtitle">Urus maklumat peribadi, rekod kehadiran, dan konfigurasi peranti tasmik anda.</p>
          </div>
        </div>

        <div className="settings-layout">
          
          {/* KIRI: MENU TAB */}
          <div className="settings-sidebar">
            <button className={`tab-btn ${activeTab === 'profil' ? 'active' : ''}`} onClick={() => { setActiveTab('profil'); setSaveMessage(''); }}>
              <User size={18} /> Profil Pelajar
            </button>
            <button className={`tab-btn ${activeTab === 'kehadiran' ? 'active' : ''}`} onClick={() => { setActiveTab('kehadiran'); setSaveMessage(''); }}>
              <ClipboardList size={18} /> Rekod Kehadiran
            </button>
            <button className={`tab-btn ${activeTab === 'notifikasi' ? 'active' : ''}`} onClick={() => { setActiveTab('notifikasi'); setSaveMessage(''); }}>
              <Bell size={18} /> Peringatan & Notifikasi
            </button>
            <button className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => { setActiveTab('audio'); setSaveMessage(''); }}>
              <Mic size={18} /> Audio & Bilik Tasmik
            </button>
          </div>

          {/* KANAN: KANDUNGAN TAB */}
          <div className="settings-content">
            
            {saveMessage && (
              <div className="save-alert">
                <CheckCircle2 size={18} /> {saveMessage}
              </div>
            )}

            {/* TAB 1: PROFIL PELAJAR */}
            {activeTab === 'profil' && (
              <div className="tab-pane fade-in">
                <h2 className="pane-title">Maklumat Peribadi</h2>
                <p className="pane-desc">Kemas kini maklumat profil dan foto pengenalan diri anda.</p>
                
                <div className="avatar-upload-section">
                  <div className="avatar-wrapper">
                    <div className="avatar-display">
                      {isUploadingAvatar ? (
                        <Loader2 size={28} className="spin-loader" />
                      ) : profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="Foto Profil" className="avatar-img" />
                      ) : (
                        <span className="avatar-initial">
                          {profile.nama ? profile.nama.charAt(0).toUpperCase() : 'P'}
                        </span>
                      )}
                    </div>
                    
                    <button type="button" className="btn-camera-badge" onClick={() => avatarInputRef.current?.click()} title="Muat naik foto profil">
                      <Camera size={15} />
                    </button>
                    <input type="file" ref={avatarInputRef} accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                  </div>

                  <div className="avatar-text-info">
                    <h4>Foto Profil Pelajar</h4>
                    <p>Klik ikon kamera untuk memuat naik atau menukar foto profil anda (Format disokong: PNG, JPG maks 2MB).</p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Nama Penuh</label>
                    <input type="text" value={profile.nama} onChange={(e) => setProfile({...profile, nama: e.target.value})} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>E-mel Pelajar (Log Masuk)</label>
                    <div className="input-with-icon">
                      <Mail size={16} className="input-icon" />
                      <input type="email" value={profile.email} disabled style={{ background: '#f1f5f9', color: '#64748b' }} className="form-input has-icon" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>No. Telefon bimbit</label>
                    <input type="text" value={profile.telefon} onChange={(e) => setProfile({...profile, telefon: e.target.value})} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>Kata Laluan Sistem (Biarkan kosong jika tidak tukar)</label>
                    <div className="input-with-icon">
                      <ShieldCheck size={16} className="input-icon" />
                      <input type="password" value={profile.kataLaluan} onChange={(e) => setProfile({...profile, kataLaluan: e.target.value})} placeholder="Masukkan kata laluan baharu..." className="form-input has-icon" />
                    </div>
                  </div>
                </div>

                <div className="pane-footer">
                  <button className="btn-save" onClick={handleSave} disabled={isSaving || isUploadingAvatar}>
                    {isSaving ? 'Menyimpan...' : <><Save size={18} /> Simpan Profil</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: REKOD KEHADIRAN */}
            {activeTab === 'kehadiran' && (
              <div className="tab-pane fade-in">
                <h2 className="pane-title">Rekod Kehadiran Kelas</h2>
                <p className="pane-desc">Semak sejarah kehadiran kelas anda. Sila berikan justifikasi jika anda sakit, lewat, atau tidak hadir.</p>

                <div className="table-container">
                  <div className="table-header-row">
                    <div className="col-tarikh">Tarikh</div>
                    <div className="col-masa">Masa Masuk</div>
                    <div className="col-status">Status</div>
                    <div className="col-justifikasi">Justifikasi / Sebab</div>
                  </div>

                  <div className="table-body">
                    {kehadiranRecords.length === 0 ? (
                      <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#64748b' }}>
                        Tiada rekod kehadiran yang dijumpai untuk profil anda buat masa ini.
                      </div>
                    ) : (
                      kehadiranRecords.map(rekod => (
                        <div key={rekod.id} className="table-row">
                          <div className="col-tarikh font-semibold">{rekod.date || new Date(rekod.created_at).toLocaleDateString('ms-MY')}</div>
                          <div className="col-masa">{rekod.time_in && rekod.time_in !== '-' ? rekod.time_in : '-'}</div>
                          <div className="col-status">
                            <span className={`status-badge status-${(rekod.status || '').replace(/\s+/g, '').toLowerCase()}`}>
                              {rekod.status}
                            </span>
                          </div>
                          <div className="col-justifikasi">
                            {rekod.status !== 'Hadir' && rekod.status !== 'Hadir Fizikal' && rekod.status !== 'Hadir Online' ? (
                              <input 
                                type="text"
                                value={rekod.remarks || ''}
                                onChange={(e) => handleUpdateJustifikasi(rekod.id, e.target.value)}
                                placeholder="Nyatakan sebab (Contoh: Demam panas)..."
                                className="justifikasi-input"
                              />
                            ) : (
                              <span className="justifikasi-none">Tiada justifikasi diperlukan</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pane-footer">
                  <button className="btn-save" onClick={handleSave} disabled={isSaving || kehadiranRecords.length === 0}>
                    {isSaving ? 'Menghantar...' : <><Save size={18} /> Hantar & Simpan Justifikasi</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: PERINGATAN & NOTIFIKASI */}
            {activeTab === 'notifikasi' && (
              <div className="tab-pane fade-in">
                <h2 className="pane-title">Tetapan Notifikasi</h2>
                <p className="pane-desc">Kawal cara sistem memberitahu anda mengenai kelas dan tugasan.</p>
                
                <div className="toggle-list">
                  <div className="toggle-item">
                    <div className="toggle-info">
                      <h4>Peringatan Sesi Tasmik Live</h4>
                      <p>Hantar peringatan 30 minit sebelum kelas bermula</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={notifSettings.emailTasmik} onChange={(e) => setNotifSettings({...notifSettings, emailTasmik: e.target.checked})} />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <h4>Peringatan Murajaah Harian</h4>
                      <p>Sistem akan mengingatkan anda untuk mengulang hafazan setiap hari</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={notifSettings.peringatanMurajaah} onChange={(e) => setNotifSettings({...notifSettings, peringatanMurajaah: e.target.checked})} />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  {notifSettings.peringatanMurajaah && (
                    <div className="sub-setting-box">
                      <label>Waktu Pilihan Peringatan Murajaah:</label>
                      <select value={notifSettings.waktuMurajaah} onChange={(e) => setNotifSettings({...notifSettings, waktuMurajaah: e.target.value})} className="form-select">
                        <option value="Lepas Subuh">Selepas Subuh</option>
                        <option value="Lepas Asar">Selepas Asar</option>
                        <option value="Lepas Maghrib">Selepas Maghrib</option>
                        <option value="Sebelum Tidur">Sebelum Tidur</option>
                      </select>
                    </div>
                  )}

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <h4>Laporan Prestasi Mingguan</h4>
                      <p>Terima ringkasan hafazan mingguan ke e-mel anda</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={notifSettings.laporanMingguan} onChange={(e) => setNotifSettings({...notifSettings, laporanMingguan: e.target.checked})} />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <h4>Bunyi Notifikasi Sistem</h4>
                      <p>Mainkan bunyi 'ting' apabila mesej atau teguran guru masuk</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={notifSettings.bunyiNotifikasi} onChange={(e) => setNotifSettings({...notifSettings, bunyiNotifikasi: e.target.checked})} />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>

                <div className="pane-footer">
                  <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Menyimpan...' : <><Save size={18} /> Simpan Tetapan Notifikasi</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: AUDIO & BILIK TASMIK */}
            {activeTab === 'audio' && (
              <div className="tab-pane fade-in">
                <h2 className="pane-title">Tetapan Audio & Video</h2>
                <p className="pane-desc">Uji dan konfigurasi peranti mikrofon dan kamera sebelum memasuki Bilik Tasmik Live.</p>
                
                {audioInputs.length === 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '10px', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={18} /> Sila benarkan akses kamera dan mikrofon pada pelayar web anda untuk menyenaraikan peranti yang tepat.
                  </div>
                )}

                <div className="device-grid">
                  {/* KAD MIKROFON */}
                  <div className="device-card">
                    <div className="device-header">
                      <Mic size={20} color="#0062ff" /> <h3>Mikrofon (Input)</h3>
                    </div>
                    <select 
                      value={avSettings.mikrofon} 
                      onChange={(e) => {
                        setAvSettings({...avSettings, mikrofon: e.target.value});
                        if (isAudioTesting) stopAudioTest(); // Berhenti ujian jika tukar device
                      }} 
                      className="form-select device-select"
                    >
                      <option value="default">Mikrofon Sistem (Lalai)</option>
                      {audioInputs.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                      ))}
                    </select>
                    
                    <button className="btn-test" onClick={isAudioTesting ? stopAudioTest : startAudioTest} style={{ background: isAudioTesting ? '#fef2f2' : '#fff', color: isAudioTesting ? '#dc2626' : '#475569' }}>
                      {isAudioTesting ? 'Berhenti Ujian' : 'Uji Mikrofon'}
                    </button>
                    
                    {isAudioTesting && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Tahap Suara:</div>
                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${Math.min((audioLevel / 100) * 100, 100)}%`, 
                            background: audioLevel > 50 ? '#059669' : audioLevel > 20 ? '#d97706' : '#0062ff',
                            transition: 'width 0.1s ease, background 0.2s ease'
                          }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KAD PEMBESAR SUARA */}
                  <div className="device-card">
                    <div className="device-header">
                      <Volume2 size={20} color="#0062ff" /> <h3>Pembesar Suara (Output)</h3>
                    </div>
                    <select value={avSettings.pembesarSuara} onChange={(e) => setAvSettings({...avSettings, pembesarSuara: e.target.value})} className="form-select device-select">
                      <option value="default">Pembesar Suara Sistem (Lalai)</option>
                      {audioOutputs.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                      ))}
                    </select>
                    <button className="btn-test" onClick={playTestSound} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <PlayCircle size={15} /> Uji Bunyi (Test Audio)
                    </button>
                  </div>

                  {/* KAD KAMERA */}
                  <div className="device-card">
                    <div className="device-header">
                      <Camera size={20} color="#0062ff" /> <h3>Kamera Web (Video)</h3>
                    </div>
                    <select 
                      value={avSettings.kamera} 
                      onChange={(e) => {
                        setAvSettings({...avSettings, kamera: e.target.value});
                        if (isVideoTesting) stopVideoTest(); // Berhenti ujian jika tukar device
                      }} 
                      className="form-select device-select"
                    >
                      <option value="default">Kamera Sistem (Lalai)</option>
                      {videoInputs.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                      ))}
                    </select>
                    <button className="btn-test" onClick={isVideoTesting ? stopVideoTest : startVideoTest} style={{ background: isVideoTesting ? '#fef2f2' : '#fff', color: isVideoTesting ? '#dc2626' : '#475569' }}>
                      {isVideoTesting ? 'Berhenti Pratonton' : 'Pratonton Kamera'}
                    </button>
                    
                    {isVideoTesting && (
                      <div style={{ marginTop: '0.5rem', width: '100%', height: '140px', background: '#000', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="sub-heading">Tetapan Kemasukan Bilik Live (Lalai)</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '-0.5rem 0 1rem 0' }}>Tetapan ini akan diaplikasikan secara automatik setiap kali anda menyertai kelas Live.</p>
                <div className="toggle-list">
                  <div className="toggle-item">
                    <div className="toggle-info">
                      <h4>Buka kamera secara automatik</h4>
                      <p>Kamera akan terus menyala sebaik sahaja masuk ke Bilik Tasmik</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={avSettings.autoBukaKamera} onChange={(e) => setAvSettings({...avSettings, autoBukaKamera: e.target.checked})} />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <h4>Bisukan mikrofon (Mute) secara automatik</h4>
                      <p>Elakkan gangguan bunyi ketika baru menyertai kelas</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={avSettings.autoBisuMikrofon} onChange={(e) => setAvSettings({...avSettings, autoBisuMikrofon: e.target.checked})} />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <h4>Sistem Pengurangan Hingar (Noise Cancellation)</h4>
                      <p>Menapis bunyi bising kipas dan latar belakang untuk bacaan yang jelas</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={avSettings.kurangkanHingar} onChange={(e) => setAvSettings({...avSettings, kurangkanHingar: e.target.checked})} />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </div>

                <div className="pane-footer">
                  <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Menyimpan...' : <><Save size={18} /> Simpan Tetapan A/V</>}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding-bottom: 2rem;
          font-family: 'Inter', sans-serif;
        }

        /* Header Style */
        .settings-header-box {
          background: #ffffff;
          padding: 1.5rem 2rem;
          border-radius: 16px;
          border: 1px solid #eef2f6;
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .header-icon {
          width: 54px;
          height: 54px;
          background: #eff6ff;
          color: #0062ff;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .header-title { margin: 0 0 0.25rem 0; font-size: 1.4rem; font-weight: 800; color: #0f172a; }
        .header-subtitle { margin: 0; font-size: 0.9rem; color: #64748b; }

        /* Layout Kiri Kanan */
        .settings-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .settings-layout { grid-template-columns: 1fr; }
        }

        /* Sidebar Kiri */
        .settings-sidebar {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef2f6;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .tab-btn {
          width: 100%;
          text-align: left;
          padding: 1rem 1.25rem;
          border: none;
          background: transparent;
          color: #64748b;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: all 0.2s ease;
        }
        .tab-btn:hover { background: #f8fafc; color: #0f172a; }
        .tab-btn.active { background: #eff6ff; color: #0062ff; font-weight: 700; }

        /* Content Kanan */
        .settings-content {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #eef2f6;
          padding: 2.5rem;
          min-height: 500px;
          position: relative;
        }
        .pane-title { margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 800; color: #0f172a; }
        .pane-desc { margin: 0 0 2rem 0; font-size: 0.9rem; color: #64748b; }
        
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Avatar Upload UI */
        .avatar-upload-section {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2rem;
          padding-bottom: 1.75rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .avatar-wrapper {
          position: relative;
          width: 88px;
          height: 88px;
          flex-shrink: 0;
        }
        .avatar-display {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #eff6ff;
          color: #0062ff;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #cbd5e1;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .avatar-initial {
          font-size: 2.4rem;
          font-weight: 800;
        }
        .btn-camera-badge {
          position: absolute;
          bottom: 0;
          right: 0;
          background: #0062ff;
          color: #ffffff;
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          transition: transform 0.2s;
        }
        .btn-camera-badge:hover {
          transform: scale(1.1);
          background: #0052d6;
        }
        .avatar-text-info h4 {
          margin: 0 0 0.3rem 0;
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }
        .avatar-text-info p {
          margin: 0;
          font-size: 0.85rem;
          color: #64748b;
          line-height: 1.4;
        }
        .spin-loader {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        /* Alert Berjaya */
        .save-alert {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #059669;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 2rem;
          animation: slideDown 0.3s ease-out;
        }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        /* Forms */
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
        
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-group label { font-size: 0.85rem; font-weight: 600; color: #475569; }
        .form-input { padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.95rem; color: #1e293b; outline: none; transition: 0.2s; }
        .form-input:focus { border-color: #0062ff; box-shadow: 0 0 0 3px rgba(0, 98, 255, 0.1); }
        .form-select { padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.95rem; color: #1e293b; outline: none; background: #fff; cursor: pointer; }
        
        .input-with-icon { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 1rem; color: #94a3b8; }
        .form-input.has-icon { padding-left: 2.75rem; width: 100%; box-sizing: border-box; }

        /* Jadual Kehadiran Sebaris */
        .table-container {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .table-header-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 2fr;
          gap: 1rem;
          background: #f8fafc;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 700;
          font-size: 0.85rem;
          color: #475569;
        }
        .table-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 2fr;
          gap: 1rem;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #f1f5f9;
          align-items: center;
          font-size: 0.85rem;
          color: #1e293b;
          transition: background 0.2s;
        }
        .table-row:last-child { border-bottom: none; }
        .table-row:hover { background: #f8fafc; }
        .font-semibold { font-weight: 600; color: #0f172a; }

        .status-badge {
          display: inline-flex;
          padding: 0.35rem 0.8rem;
          border-radius: 20px;
          font-weight: 700;
          font-size: 0.75rem;
        }
        .status-hadir, .status-hadirfizikal, .status-hadironline { background: #dcfce7; color: #166534; }
        .status-lewat { background: #fef3c7; color: #b45309; }
        .status-tidakhadir { background: #fee2e2; color: #dc2626; }
        .status-sakit { background: #e0e7ff; color: #4338ca; } 

        .justifikasi-input {
          width: 100%;
          padding: 0.6rem 0.85rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          outline: none;
          font-size: 0.8rem;
          background: #ffffff;
          transition: 0.2s;
        }
        .justifikasi-input:focus { border-color: #0062ff; box-shadow: 0 0 0 2px rgba(0, 98, 255, 0.1); }
        .justifikasi-none { color: #94a3b8; font-style: italic; font-size: 0.8rem; }

        @media (max-width: 768px) {
          .table-header-row, .table-row {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }
          .table-header-row { display: none; }
          .table-row {
            padding: 1.25rem;
            border-bottom: 4px solid #f1f5f9;
          }
          .col-tarikh::before { content: "Tarikh: "; color: #64748b; font-weight: 500; }
          .col-masa::before { content: "Masa: "; color: #64748b; font-weight: 500; }
          .col-status { margin-bottom: 0.5rem; margin-top: 0.5rem; }
        }

        /* Toggles Switch Custom UI */
        .toggle-list { display: flex; flex-direction: column; gap: 1rem; }
        .toggle-item { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; border: 1px solid #e2e8f0; border-radius: 12px; transition: 0.2s; }
        .toggle-item:hover { background: #f8fafc; }
        .toggle-info h4 { margin: 0 0 0.3rem 0; font-size: 0.95rem; color: #1e293b; font-weight: 700; }
        .toggle-info p { margin: 0; font-size: 0.8rem; color: #64748b; }
        
        .switch { position: relative; display: inline-block; width: 48px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .3s; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; }
        input:checked + .slider { background-color: #0062ff; }
        input:focus + .slider { box-shadow: 0 0 1px #0062ff; }
        input:checked + .slider:before { transform: translateX(24px); }
        .slider.round { border-radius: 24px; }
        .slider.round:before { border-radius: 50%; }

        .sub-setting-box { background: #f8fafc; padding: 1rem 1.25rem; border-radius: 10px; margin: -0.5rem 0 0.5rem 0; border-left: 4px solid #0062ff; display: flex; align-items: center; justify-content: space-between; }
        .sub-setting-box label { font-size: 0.85rem; font-weight: 600; color: #475569; }

        /* Audio & Video Cards */
        .device-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem; }
        .device-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .device-header { display: flex; align-items: center; gap: 0.5rem; }
        .device-header h3 { margin: 0; font-size: 0.95rem; color: #1e293b; font-weight: 700; }
        .device-select { width: 100%; border-color: #cbd5e1; }
        .btn-test { background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 0.6rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; }
        .btn-test:hover { background: #f1f5f9; color: #0f172a; border-color: #94a3b8; }
        .sub-heading { margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 800; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 2rem; }

        /* Butang Simpan */
        .pane-footer { margin-top: 2.5rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem; display: flex; justify-content: flex-end; }
        .btn-save { background: #0062ff; color: #ffffff; border: none; padding: 0.85rem 1.75rem; border-radius: 10px; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; }
        .btn-save:hover { background: #0055dd; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 98, 255, 0.2); }
        .btn-save:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
      `}</style>
    </DashboardLayout>
  );
}