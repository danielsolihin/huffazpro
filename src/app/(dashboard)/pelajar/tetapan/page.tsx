'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { 
  Settings, User, Bell, Mic, Camera, Save, 
  Volume2, CheckCircle2, ShieldCheck, Mail, ClipboardList, Loader2
} from 'lucide-react';

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

  // STATE UNTUK KEHADIRAN
  const [kehadiranRecords, setKehadiranRecords] = useState<any[]>([]);

  // 1. PANGGIL DATA DARI SUPABASE & LOCAL STORAGE SEMASA PAGE DIBUKA
  useEffect(() => {
    const fetchUserData = async () => {
      let currentStudentName = '';

      try {
        // A. Tarik profil terus dari Supabase Auth & Profiles Table
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const uId = authData.user.id;
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uId)
            .single();

          if (dbProfile) {
            currentStudentName = dbProfile.full_name || '';
            setProfile({
              id: dbProfile.id,
              nama: dbProfile.full_name || '',
              email: dbProfile.email || authData.user.email || '',
              telefon: dbProfile.phone || '',
              kataLaluan: '',
              avatarUrl: dbProfile.avatar_url || ''
            });
          }

          // Tarik rekod kehadiran pelajar dari Supabase
          const { data: att } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', uId)
            .order('created_at', { ascending: false });

          if (att && att.length > 0) {
            setKehadiranRecords(att);
          }
        } else {
          // Fallback sekiranya sesi luar talian
          const savedProfile = localStorage.getItem('huffazpro_student_profile');
          if (savedProfile) {
            const parsedProfile = JSON.parse(savedProfile);
            setProfile(parsedProfile);
            currentStudentName = parsedProfile.nama;
          }
        }
      } catch (err) {
        console.error('Ralat menarik maklumat pelajar:', err);
      }

      // B. Tarik tetapan notifikasi & A/V
      const savedNotif = localStorage.getItem('huffazpro_student_notif');
      if (savedNotif) setNotifSettings(JSON.parse(savedNotif));

      const savedAV = localStorage.getItem('huffazpro_student_av');
      if (savedAV) setAvSettings(JSON.parse(savedAV));
    };

    fetchUserData();
  }, []);

  // FUNGSI KOMPRESI GAMBAR PROFIL
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
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        callback(compressedBase64);
      };
    };
  };

  // PENGENDALI MUAT NAIK GAMBAR PROFIL
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    compressImage(file, async (base64String) => {
      setProfile(prev => ({ ...prev, avatarUrl: base64String }));

      // Kemas kini secara langsung ke Supabase jika akaun berdaftar
      if (profile.id) {
        try {
          await supabase
            .from('profiles')
            .update({ avatar_url: base64String })
            .eq('id', profile.id);
        } catch (err) {
          console.error('Ralat mengemas kini gambar ke Supabase:', err);
        }
      }

      // Simpan salinan ke localStorage
      const savedProfile = JSON.parse(localStorage.getItem('huffazpro_student_profile') || '{}');
      localStorage.setItem('huffazpro_student_profile', JSON.stringify({ ...savedProfile, avatarUrl: base64String }));

      setIsUploadingAvatar(false);
      setSaveMessage('Gambar profil berjaya dikemaskini!');
      setTimeout(() => setSaveMessage(''), 3000);
    });
  };

  // FUNGSI UPDATE TEXT JUSTIFIKASI
  const handleUpdateJustifikasi = (id: string, text: string) => {
    const updated = kehadiranRecords.map(k => k.id === id ? { ...k, justifikasi: text } : k);
    setKehadiranRecords(updated);
  };

  // 2. FUNGSI SIMPAN DATA KE SUPABASE & LOCAL STORAGE
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      if (activeTab === 'profil') {
        // Simpan ke Supabase Profiles Table
        if (profile.id) {
          const updatePayload: any = {
            full_name: profile.nama,
            phone: profile.telefon,
            avatar_url: profile.avatarUrl
          };

          await supabase.from('profiles').update(updatePayload).eq('id', profile.id);

          // Kemas kini kata laluan sekiranya diisi
          if (profile.kataLaluan) {
            await supabase.auth.updateUser({ password: profile.kataLaluan });
            setProfile(prev => ({ ...prev, kataLaluan: '' }));
          }
        }

        localStorage.setItem('huffazpro_student_profile', JSON.stringify(profile));
      }

      if (activeTab === 'notifikasi') {
        localStorage.setItem('huffazpro_student_notif', JSON.stringify(notifSettings));
      }

      if (activeTab === 'audio') {
        localStorage.setItem('huffazpro_student_av', JSON.stringify(avSettings));
      }

      if (activeTab === 'kehadiran') {
        localStorage.setItem('huffazpro_student_attendance', JSON.stringify(kehadiranRecords));
      }

      setSaveMessage(activeTab === 'kehadiran' ? 'Justifikasi kehadiran berjaya disimpan!' : 'Tetapan berjaya disimpan!');
    } catch (err: any) {
      console.error('Ralat semasa menyimpan:', err);
      setSaveMessage(`Ralat menyimpan: ${err.message || 'Sila cuba lagi'}`);
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
            <button 
              className={`tab-btn ${activeTab === 'profil' ? 'active' : ''}`}
              onClick={() => setActiveTab('profil')}
            >
              <User size={18} /> Profil Pelajar
            </button>
            <button 
              className={`tab-btn ${activeTab === 'kehadiran' ? 'active' : ''}`}
              onClick={() => setActiveTab('kehadiran')}
            >
              <ClipboardList size={18} /> Rekod Kehadiran
            </button>
            <button 
              className={`tab-btn ${activeTab === 'notifikasi' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifikasi')}
            >
              <Bell size={18} /> Peringatan & Notifikasi
            </button>
            <button 
              className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
              onClick={() => setActiveTab('audio')}
            >
              <Mic size={18} /> Audio & Bilik Tasmik
            </button>
          </div>

          {/* KANAN: KANDUNGAN TAB */}
          <div className="settings-content">
            
            {/* ALERT BERJAYA SIMPAN */}
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
                
                {/* BAHAGIAN MUAT NAIK GAMBAR PROFIL */}
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
                    
                    <button 
                      type="button" 
                      className="btn-camera-badge"
                      onClick={() => avatarInputRef.current?.click()}
                      title="Muat naik foto profil"
                    >
                      <Camera size={15} />
                    </button>

                    <input 
                      type="file" 
                      ref={avatarInputRef} 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleAvatarUpload} 
                    />
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
                    <label>E-mel Pelajar</label>
                    <div className="input-with-icon">
                      <Mail size={16} className="input-icon" />
                      <input type="email" value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} className="form-input has-icon" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>No. Telefon bimbit</label>
                    <input type="text" value={profile.telefon} onChange={(e) => setProfile({...profile, telefon: e.target.value})} className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>Kata Laluan Sistem (Biarkan kosong jika tidak mahu tukar)</label>
                    <div className="input-with-icon">
                      <ShieldCheck size={16} className="input-icon" />
                      <input type="password" value={profile.kataLaluan} onChange={(e) => setProfile({...profile, kataLaluan: e.target.value})} placeholder="Masukkan kata laluan baharu..." className="form-input has-icon" />
                    </div>
                  </div>
                </div>

                <div className="pane-footer">
                  <button className="btn-save" onClick={handleSave} disabled={isSaving}>
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
                    <div className="col-masa">Masa</div>
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
                          <div className="col-tarikh font-semibold">{rekod.tarikh || rekod.date}</div>
                          <div className="col-masa">{rekod.masa || rekod.time_in || rekod.timeIn || '-'}</div>
                          <div className="col-status">
                            <span className={`status-badge status-${(rekod.status || '').replace(/\s+/g, '').toLowerCase()}`}>
                              {rekod.status}
                            </span>
                          </div>
                          <div className="col-justifikasi">
                            {rekod.status !== 'Hadir' && rekod.status !== 'Hadir Fizikal' && rekod.status !== 'Hadir Online' ? (
                              <input 
                                type="text"
                                value={rekod.justifikasi || ''}
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
                <p className="pane-desc">Konfigurasi peranti mikrofon dan kamera sebelum memasuki Bilik Tasmik Live.</p>
                
                <div className="device-grid">
                  <div className="device-card">
                    <div className="device-header">
                      <Mic size={20} color="#0062ff" /> <h3>Mikrofon (Input)</h3>
                    </div>
                    <select value={avSettings.mikrofon} onChange={(e) => setAvSettings({...avSettings, mikrofon: e.target.value})} className="form-select device-select">
                      <option value="default">Mikrofon Sistem (Lalai)</option>
                      <option value="headset">Headset Microphone (Realtek)</option>
                      <option value="usb">USB Condenser Mic</option>
                    </select>
                    <button className="btn-test">Uji Mikrofon</button>
                  </div>

                  <div className="device-card">
                    <div className="device-header">
                      <Volume2 size={20} color="#0062ff" /> <h3>Pembesar Suara (Output)</h3>
                    </div>
                    <select value={avSettings.pembesarSuara} onChange={(e) => setAvSettings({...avSettings, pembesarSuara: e.target.value})} className="form-select device-select">
                      <option value="default">Pembesar Suara Sistem (Lalai)</option>
                      <option value="headphones">Headphones (Realtek)</option>
                    </select>
                    <button className="btn-test">Uji Bunyi (Test Audio)</button>
                  </div>

                  <div className="device-card">
                    <div className="device-header">
                      <Camera size={20} color="#0062ff" /> <h3>Kamera Web (Video)</h3>
                    </div>
                    <select value={avSettings.kamera} onChange={(e) => setAvSettings({...avSettings, kamera: e.target.value})} className="form-select device-select">
                      <option value="default">Kamera Web Bersepadu (Lalai)</option>
                      <option value="obs">OBS Virtual Camera</option>
                    </select>
                    <button className="btn-test">Pratonton Kamera</button>
                  </div>
                </div>

                <h3 className="sub-heading">Tetapan Kemasukan Bilik Live</h3>
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