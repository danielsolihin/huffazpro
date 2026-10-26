'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  Settings, User, GraduationCap, Bell, Lock, 
  Camera, UploadCloud, FileText, Trash2, CheckCircle2, 
  AlertCircle, Save, Loader2, CalendarCheck, Printer, Clock, Eye,
  Volume2, Type, Send
} from 'lucide-react';
import styles from './Tetapan.module.css';

interface CertificateItem {
  id: string;
  name: string; // Menyimpan URL penuh Supabase Storage
  size: string;
  verified: boolean;
}

interface TeacherAttendanceRecord {
  id: string;
  tarikh: string;
  hari: string;
  masaMasuk: string;
  masaKeluar: string;
  jumlahJam: string;
  status: string;
  catatan: string;
}

const formatTimeAMPM = (timeInput: any): string => {
  if (!timeInput || timeInput === '-') return '-';
  if (typeof timeInput === 'string' && (timeInput.includes('T') || timeInput.length > 12)) {
    const d = new Date(timeInput);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (typeof timeInput === 'string') {
    let cleanTime = timeInput.replace(/PTG|PETANG|MLM|MALAM/gi, 'PM').replace(/PG|PAGI/gi, 'AM').trim();
    if (cleanTime.includes(':')) return cleanTime;
  }
  const d = new Date(timeInput);
  if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return String(timeInput);
};

const getDisplayFileName = (url: string) => {
  try {
    if (url.startsWith('http')) {
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      const decoded = decodeURIComponent(lastPart);
      return decoded.includes('_') ? decoded.substring(decoded.indexOf('_') + 1) : decoded;
    }
    return url;
  } catch {
    return 'Dokumen Sijil';
  }
};

export default function TetapanGuruPage() {
  const [activeTab, setActiveTab] = useState<'profil' | 'akademik' | 'notifikasi' | 'keselamatan' | 'kehadiran'>('profil');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 1. STATE PROFIL PERIBADI
  const [userId, setUserId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [namaPenuh, setNamaPenuh] = useState('');
  const [idStaf, setIdStaf] = useState('');
  const [noTelefon, setNoTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [biodata, setBiodata] = useState('');

  // 2. STATE AKADEMIK
  const [tahapKelulusan, setTahapKelulusan] = useState('');
  const [bidang, setBidang] = useState('');
  const [institusi, setInstitusi] = useState('');
  const [tahunGraduat, setTahunGraduat] = useState('');
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);

  // 3. STATE NOTIFIKASI, KELAS & PREFERENSI SISTEM
  const [kelasSeliaan, setKelasSeliaan] = useState('');
  const [senaraiKelas, setSenaraiKelas] = useState<{id: string, name: string}[]>([]);
  
  // State Preferensi (Disimpan dalam Supabase DB: lajur system_prefs)
  const [notifHadir, setNotifHadir] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifPeringatanHarian, setNotifPeringatanHarian] = useState(false);
  const [qariAudio, setQariAudio] = useState('ar.alafasy');
  const [quranFontSize, setQuranFontSize] = useState('Biasa');

  // 4. STATE KATA LALUAN
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 5. STATE KEHADIRAN
  const [periodFilter, setPeriodFilter] = useState<'harian' | 'mingguan' | 'bulanan' | 'tahunan'>('bulanan');
  const [allAttendanceLogs, setAllAttendanceLogs] = useState<TeacherAttendanceRecord[]>([]);

  const fetchTeacherProfile = async () => {
    setIsLoadingData(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) return;
      const currentId = authData.user.id;
      setUserId(currentId);

      // Tarik Senarai Kelas Dari DB (Dinamik)
      let classesList: {id: string, name: string}[] = [];
      const { data: classesData } = await supabase.from('classes').select('id, name').order('name');
      if (classesData) {
        classesList = classesData;
        setSenaraiKelas(classesData);
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentId).single();

      if (profile) {
        setNamaPenuh(profile.full_name || '');
        setIdStaf(profile.matrik_or_id || '-');
        setNoTelefon(profile.phone || '');
        setEmail(profile.email || authData.user.email || '');
        setBiodata(profile.address || '');
        setAvatarUrl(profile.avatar_url || '');

        setTahapKelulusan(profile.highest_education || '');
        setBidang(profile.specialization || '');

        let initialClassId = profile.class_id || '';
        if (!initialClassId && profile.class_name) {
          const match = classesList.find(c => c.name === profile.class_name);
          if (match) initialClassId = match.id;
        }
        setKelasSeliaan(initialClassId);

        // Muat Tetapan Notifikasi & Aplikasi daripada Pangkalan Data Supabase
        if (profile.system_prefs) {
          let prefs = typeof profile.system_prefs === 'string' ? JSON.parse(profile.system_prefs) : profile.system_prefs;
          if (prefs) {
            setNotifHadir(prefs.notifHadir ?? true);
            setNotifEmail(prefs.notifEmail ?? false);
            setNotifPeringatanHarian(prefs.notifPeringatanHarian ?? false);
            setQariAudio(prefs.qariAudio ?? 'ar.alafasy');
            setQuranFontSize(prefs.quranFontSize ?? 'Biasa');
          }
        }

        // Ekstrak URL sijil berpisah koma dari pangkalan data
        if (profile.certificate_docs) {
          const urls = profile.certificate_docs.split(',').map((u: string) => u.trim()).filter(Boolean);
          const loadedCerts = urls.map((url: string, idx: number) => ({
            id: `cert-db-${idx}-${Date.now()}`,
            name: url,
            size: 'Dokumen Tersimpan',
            verified: true
          }));
          setCertificates(loadedCerts);
        } else {
          setCertificates([]);
        }
      }

      // TARIK DATA KEHADIRAN
      const { data: attData } = await supabase.from('attendance').select('*').eq('user_id', currentId).order('created_at', { ascending: false });
      if (attData && attData.length > 0) {
        const formattedLogs: TeacherAttendanceRecord[] = attData.map((att: any) => {
          let dateStr = att.date;
          let dayName = '-';
          if (!dateStr && att.created_at) {
            dateStr = new Date(att.created_at).toISOString().split('T')[0];
          }
          if (dateStr) {
            dayName = new Date(dateStr).toLocaleDateString('ms-MY', { weekday: 'long' });
          } else {
            dateStr = new Date().toLocaleDateString('ms-MY');
          }

          return {
            id: att.id,
            tarikh: dateStr,
            hari: dayName,
            masaMasuk: formatTimeAMPM(att.time_in) !== '-' ? formatTimeAMPM(att.time_in) : formatTimeAMPM(att.created_at),
            masaKeluar: formatTimeAMPM(att.time_out) !== '-' ? formatTimeAMPM(att.time_out) : '-',
            jumlahJam: att.duration || '-',
            status: att.status || 'Hadir Bertugas',
            catatan: att.remarks || att.notes || 'Portal Pentasmik'
          };
        });
        setAllAttendanceLogs(formattedLogs);
      }
    } catch (err) { 
      console.error('Ralat menarik data profil guru:', err); 
    } finally { 
      setIsLoadingData(false); 
    }
  };

  useEffect(() => {
    fetchTeacherProfile();
  }, []);

  const getFilteredAttendance = () => {
    switch (periodFilter) {
      case 'harian': return allAttendanceLogs.slice(0, 1);
      case 'mingguan': return allAttendanceLogs.slice(0, 7);
      case 'bulanan': return allAttendanceLogs.slice(0, 30);
      case 'tahunan': return allAttendanceLogs;
      default: return allAttendanceLogs;
    }
  };

  const displayedAttendance = getFilteredAttendance();
  const totalDays = displayedAttendance.length;
  const hadirDays = displayedAttendance.filter(a => a.status.includes('Hadir')).length;
  const lewatDays = displayedAttendance.filter(a => a.status.includes('Lewat')).length;
  const cutiDays = displayedAttendance.filter(a => a.status.includes('Cuti') || a.status.includes('Sakit')).length;
  const attendanceRate = totalDays > 0 ? Math.round(((hadirDays + lewatDays) / totalDays) * 100) : 0;

  const handlePrintAttendance = () => window.print();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setToastMessage({ type: 'error', text: 'Saiz gambar melebihi had maksimum 3MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const img = new Image();
        img.src = uploadEvent.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          setAvatarUrl(compressed);
          setToastMessage({ type: 'success', text: 'Gambar profil dipilih. Sila klik "Simpan Perubahan".' });
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (certificates.length + files.length > 3) {
      setToastMessage({ type: 'error', text: `Anda hanya dibenarkan menyimpan maksimum 3 fail sijil.` });
      if (certInputRef.current) certInputRef.current.value = '';
      return;
    }

    const totalNewSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalNewSize > 5 * 1024 * 1024) { 
      setToastMessage({ type: 'error', text: `Jumlah saiz muat naik melebihi had 5MB yang dibenarkan.` });
      if (certInputRef.current) certInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setToastMessage({ type: 'success', text: 'Sedang memuat naik fail ke pangkalan data...' });

    try {
      const newCerts: CertificateItem[] = [];

      for (const file of files) {
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${Date.now()}_${cleanFileName}`;

        const { error: uploadError } = await supabase.storage.from('certificates').upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('certificates').getPublicUrl(fileName);

        newCerts.push({
          id: `cert-${Date.now()}-${Math.random()}`,
          name: publicUrlData.publicUrl,
          size: formatBytes(file.size),
          verified: false
        });
      }

      setCertificates(prev => [...prev, ...newCerts]);
      setToastMessage({ type: 'success', text: `${files.length} fail berjaya dimuat naik! Sila klik "Simpan Perubahan".` });
    } catch (error: any) {
      setToastMessage({ type: 'error', text: `Gagal muat naik: ${error.message}` });
    } finally {
      setIsUploading(false);
      if (certInputRef.current) certInputRef.current.value = '';
    }
  };

  const removeCertificate = (id: string) => {
    setCertificates((prev) => prev.filter((c) => c.id !== id));
    setToastMessage({ type: 'success', text: 'Dokumen dikeluarkan dari senarai. Klik "Simpan Perubahan" untuk kemaskini.' });
  };

  // =========================================================================
  // FUNGSI UTAMA PROSES SIMPAN DATA KE SUPABASE (TERMASUK PREF SISTEM)
  // =========================================================================
  const handleSave = async () => {
    setToastMessage(null);

    if (activeTab === 'keselamatan') {
      if (newPassword.length < 6) { 
        setToastMessage({ type: 'error', text: 'Kata laluan baharu mestilah sekurang-kurangnya 6 aksara.' }); 
        return; 
      }
      if (newPassword !== confirmPassword) { 
        setToastMessage({ type: 'error', text: 'Kata laluan dan pengesahan tidak sepadan.' }); 
        return; 
      }
    }

    setIsSaving(true);
    try {
      if (!userId) throw new Error('Sesi log masuk tidak sah atau telah tamat.');

      const combinedCertsUrl = certificates.length > 0 ? certificates.map(c => c.name).join(',') : null;
      const cleanVal = (val: any) => (val === undefined || val === '') ? null : val;

      // Himpunkan Tetapan Sistem / Notifikasi
      const prefsData = {
        notifHadir,
        notifEmail,
        notifPeringatanHarian,
        qariAudio,
        quranFontSize
      };

      const updateData = {
        full_name: cleanVal(namaPenuh),
        phone: cleanVal(noTelefon),
        avatar_url: cleanVal(avatarUrl),
        class_id: cleanVal(kelasSeliaan),
        highest_education: cleanVal(tahapKelulusan),
        specialization: cleanVal(bidang),
        address: cleanVal(biodata),
        certificate_docs: combinedCertsUrl,
        system_prefs: prefsData
      };

      const { error: profileError } = await supabase.from('profiles').update(updateData).eq('id', userId);
      if (profileError) throw new Error(profileError.message || 'Gagal menyimpan ke profil.');

      if (kelasSeliaan) {
        try { await supabase.from('classes').update({ teacher_id: userId }).eq('id', kelasSeliaan); } catch (e) {}
      }

      if (activeTab === 'keselamatan' && newPassword) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwdError) throw pwdError;
        setNewPassword(''); 
        setConfirmPassword('');
      }

      window.dispatchEvent(new Event('avatarUpdated'));
      window.dispatchEvent(new Event('preferencesUpdated'));
      
      setToastMessage({ type: 'success', text: 'Alhamdulillah, maklumat & tetapan berjaya disimpan ke pangkalan data!' });

      await fetchTeacherProfile();

    } catch (err: any) {
      console.error('Ralat simpan:', err);
      setToastMessage({ type: 'error', text: `Gagal menyimpan: ${err.message || 'Sila cuba lagi'}` });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingData) {
    return (
      <DashboardGuruLayout userName={namaPenuh || 'Guru'} userRole="Ketua Pentasmik">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Loader2 className="animate-spin" size={40} color="#0062ff" />
        </div>
      </DashboardGuruLayout>
    );
  }

  return (
    <DashboardGuruLayout userName={namaPenuh || 'Guru'} userRole="Ketua Pentasmik">
      <div className={styles.container} style={{ position: 'relative' }}>
        
        {/* FIXED TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="no-print" style={{
            position: 'fixed', top: '80px', right: '24px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '0.65rem',
            padding: '1rem 1.35rem', borderRadius: '12px', background: toastMessage.type === 'success' ? '#059669' : '#dc2626',
            color: '#ffffff', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)', fontWeight: 700, fontSize: '0.88rem',
            animation: 'fadeInScale 0.2s ease-out'
          }}>
            {toastMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '0.5rem', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        <div className={`no-print ${styles.headerCard}`}>
          <div className={styles.titleWrap}>
            <h1 className={styles.mainTitle}><Settings size={24} color="#0062ff" /> Tetapan Profil & Sistem</h1>
            <p className={styles.subtitle}>Urus maklumat peribadi, kelulusan akademik, rekod kehadiran guru dan notifikasi di sini.</p>
          </div>
        </div>

        <div className={styles.layoutGrid}>
          {/* MENU NAVIGASI SISI */}
          <div className={`no-print ${styles.sidebarMenu}`}>
            <button className={`${styles.tabBtn} ${activeTab === 'profil' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('profil'); setToastMessage(null); }}>
              <User size={18} /> Profil Peribadi
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'akademik' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('akademik'); setToastMessage(null); }}>
              <GraduationCap size={18} /> Latar Belakang Akademik
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'kehadiran' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('kehadiran'); setToastMessage(null); }}>
              <CalendarCheck size={18} /> Laporan Kehadiran Guru
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'notifikasi' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('notifikasi'); setToastMessage(null); }}>
              <Bell size={18} /> Tetapan Notifikasi & Aplikasi
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'keselamatan' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('keselamatan'); setToastMessage(null); }}>
              <Lock size={18} /> Keselamatan (Kata Laluan)
            </button>
          </div>

          {/* KANDUNGAN TAB AKTIF */}
          <div className={`${styles.contentCard} ${activeTab === 'kehadiran' ? 'print-attendance-area' : 'no-print'}`}>
            
            {/* TAB 1: PROFIL PERIBADI */}
            {activeTab === 'profil' && (
              <div className="no-print">
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionTitleText}><User size={18} color="#0062ff" /> Maklumat Asas Profil</span>
                </h2>
                <div className={styles.profileAvatarArea}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Gambar Profil" className={styles.avatarPreview} />
                  ) : (
                    <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '2.5rem', fontWeight: 800 }}>
                      {namaPenuh ? namaPenuh.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                  <div>
                    <input type="file" ref={avatarInputRef} accept="image/*" className={styles.hiddenInput} onChange={handleAvatarChange} />
                    <button type="button" className={styles.changePhotoBtn} onClick={() => avatarInputRef.current?.click()}>
                      <Camera size={15} /> Tukar Gambar Profil
                    </button>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.4rem', marginBottom: 0 }}>Sokongan format: JPG, PNG, WEBP. Saiz maksimum 3MB.</p>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}><label className={styles.label}>Nama Penuh</label><input type="text" className={styles.input} value={namaPenuh} onChange={(e) => setNamaPenuh(e.target.value)} /></div>
                  <div className={styles.formGroup}><label className={styles.label}>ID Staf / No. MyKad (Kekal)</label><input type="text" className={styles.input} value={idStaf} disabled style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} /></div>
                  <div className={styles.formGroup}><label className={styles.label}>Nombor Telefon</label><input type="tel" className={styles.input} value={noTelefon} onChange={(e) => setNoTelefon(e.target.value)} /></div>
                  <div className={styles.formGroup}><label className={styles.label}>Alamat E-mel Utama</label><input type="email" className={styles.input} value={email} readOnly style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} /></div>
                  <div className={`${styles.formGroup} ${styles.formGroupFull}`}><label className={styles.label}>Alamat Penuh / Biodata Ringkas</label><textarea className={`${styles.input} ${styles.textarea}`} value={biodata} onChange={(e) => setBiodata(e.target.value)} /></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                  <button 
                    type="button" 
                    onClick={handleSave} 
                    disabled={isSaving || isUploading}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      background: (isSaving || isUploading) ? '#94a3b8' : '#0062ff', color: '#ffffff', border: 'none',
                      padding: '0.75rem 1.75rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700,
                      cursor: (isSaving || isUploading) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease'
                    }}
                  >
                    {isSaving ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <><Save size={18} /> Simpan Perubahan</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: LATAR BELAKANG AKADEMIK */}
            {activeTab === 'akademik' && (
              <div className="no-print">
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionTitleText}><GraduationCap size={18} color="#10b981" /> Maklumat Kelayakan Akademik</span>
                </h2>
                
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}><label className={styles.label}>Tahap Kelulusan Tertinggi</label><input type="text" className={styles.input} placeholder="Cth: Ijazah Sarjana Muda" value={tahapKelulusan} onChange={(e) => setTahapKelulusan(e.target.value)} /></div>
                  <div className={styles.formGroup}><label className={styles.label}>Bidang Pengkhususan</label><input type="text" className={styles.input} placeholder="Cth: Usuluddin & Tafsir" value={bidang} onChange={(e) => setBidang(e.target.value)} /></div>
                  <div className={styles.formGroup}><label className={styles.label}>Institusi Pengajian</label><input type="text" className={styles.input} placeholder="Nama universiti / maahad" value={institusi} onChange={(e) => setInstitusi(e.target.value)} /></div>
                  <div className={styles.formGroup}><label className={styles.label}>Tahun Bergraduat</label><input type="number" className={styles.input} placeholder="Cth: 2020" value={tahunGraduat} onChange={(e) => setTahunGraduat(e.target.value)} /></div>
                </div>

                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: '1.75rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Dokumen Sijil Kelulusan & Tauliah Mengajar</span>
                  <span style={{ fontSize: '0.75rem', color: '#0062ff', background: '#eff6ff', padding: '0.25rem 0.65rem', borderRadius: '12px', fontWeight: 700 }}>
                    {certificates.length}/3 Fail Dimuat Naik
                  </span>
                </h3>
                
                <input 
                  type="file" 
                  ref={certInputRef} 
                  accept=".pdf,image/*" 
                  multiple 
                  className={styles.hiddenInput} 
                  onChange={handleCertUpload} 
                />

                <div 
                  onClick={() => { if (!isUploading && certificates.length < 3) certInputRef.current?.click(); }} 
                  style={{
                    border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '2rem', textAlign: 'center', background: '#f8fafc',
                    cursor: (isUploading || certificates.length >= 3) ? 'not-allowed' : 'pointer',
                    opacity: (isUploading || certificates.length >= 3) ? 0.6 : 1, transition: 'all 0.2s ease'
                  }}
                >
                  {isUploading ? <Loader2 size={32} color="#0062ff" className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} /> : <UploadCloud size={32} color="#0062ff" style={{ margin: '0 auto 0.5rem auto' }} />}
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700, color: '#1e293b' }}>
                    {isUploading ? 'Memuat naik dokumen...' : certificates.length >= 3 ? 'Had fail maksimum dicapai' : 'Klik untuk Pilih Fail Sijil dari Peranti'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Sila muat naik sehingga 3 fail (PDF/JPG/PNG). Saiz keseluruhan tidak melebihi 5MB.</p>
                </div>

                {certificates.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
                    {certificates.map((cert) => (
                      <div key={cert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.85rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <FileText size={20} color="#0062ff" />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{getDisplayFileName(cert.name)}</span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{cert.size}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            type="button" 
                            onClick={() => window.open(cert.name, '_blank')}
                            style={{ background: '#ecfdf5', border: 'none', color: '#059669', cursor: 'pointer', padding: '0.45rem', borderRadius: '6px' }}
                            title="Papar Fail"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => removeCertificate(cert.id)} 
                            style={{ background: '#fef2f2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.45rem', borderRadius: '6px' }}
                            title="Padam Fail"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                  <button 
                    type="button" 
                    onClick={handleSave} 
                    disabled={isSaving || isUploading}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      background: (isSaving || isUploading) ? '#94a3b8' : '#0062ff', color: '#ffffff', border: 'none',
                      padding: '0.75rem 1.75rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700,
                      cursor: (isSaving || isUploading) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease',
                      boxShadow: '0 4px 6px -1px rgba(0, 98, 255, 0.25)'
                    }}
                  >
                    {isSaving ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <><Save size={18} /> Simpan Perubahan</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: KEHADIRAN GURU */}
            {activeTab === 'kehadiran' && (
              <div className="printable-modal" style={{ background: '#fff', width: '100%' }}>
                
                {/* HEADER CETAKAN (Hanya dilihat masa print) */}
                <div className="print-only" style={{ display: 'none', flexDirection: 'column', textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', paddingTop: '1rem' }}>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>Maahad Tahfiz HuffazPro Malaysia</h2>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', color: '#334155' }}>Laporan Kehadiran Guru</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#475569', marginTop: '1rem' }}>
                    <span>Nama Guru: <strong>{namaPenuh}</strong></span>
                    <span>Bulan / Tahun: <strong>{new Date().toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })}</strong></span>
                  </div>
                </div>

                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                  <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                    <span className={styles.sectionTitleText}><CalendarCheck size={18} color="#059669" /> Rekod Kehadiran Kendiri Guru</span>
                  </h2>
                  <button 
                    type="button" 
                    onClick={handlePrintAttendance}
                    style={{ 
                      background: '#0f172a', color: '#fff', border: 'none', padding: '0.55rem 1rem', 
                      borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', 
                      display: 'inline-flex', alignItems: 'center', gap: '6px' 
                    }}
                  >
                    <Printer size={15} /> Cetak Laporan
                  </button>
                </div>
                
                <div className="no-print" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {['harian', 'mingguan', 'bulanan', 'tahunan'].map(f => (
                    <button 
                      key={f} 
                      onClick={() => setPeriodFilter(f as any)}
                      style={{ 
                        background: periodFilter === f ? '#0062ff' : '#f8fafc', 
                        color: periodFilter === f ? '#fff' : '#64748b', 
                        border: periodFilter === f ? '1px solid #0062ff' : '1px solid #e2e8f0',
                        padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {f === 'harian' ? 'Hari Ini' : f}
                    </button>
                  ))}
                </div>

                {allAttendanceLogs.length === 0 ? (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    Tiada rekod log kehadiran yang direkodkan buat masa ini.
                  </div>
                ) : (
                  <>
                    <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                        <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Kadar Kehadiran</p>
                        <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>{attendanceRate}%</p>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                        <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Hadir / Bertugas</p>
                        <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{hadirDays} Hari</p>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                        <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Lewat Hadir</p>
                        <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#d97706' }}>{lewatDays} Hari</p>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                        <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Cuti / Sakit</p>
                        <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#64748b' }}>{cutiDays} Hari</p>
                      </div>
                    </div>

                    <div className="print-area" style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '0.85rem 1rem' }}>Tarikh & Hari</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Waktu Masuk</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Waktu Keluar</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Tempoh Bertugas</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Catatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedAttendance.map((rec) => (
                            <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <strong style={{ color: '#0f172a' }}>{rec.tarikh}</strong>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{rec.hari}</div>
                              </td>
                              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{rec.masaMasuk}</td>
                              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{rec.masaKeluar}</td>
                              <td style={{ padding: '0.85rem 1rem' }}>{rec.jumlahJam}</td>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <span style={{ 
                                  padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                                  background: rec.status.includes('Hadir') ? '#dcfce7' : rec.status.includes('Lewat') ? '#fef3c7' : '#f1f5f9',
                                  color: rec.status.includes('Hadir') ? '#166534' : rec.status.includes('Lewat') ? '#b45309' : '#475569',
                                }}>
                                  {rec.status}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>{rec.catatan}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 4: NOTIFIKASI & TETAPAN SISTEM */}
            {activeTab === 'notifikasi' && (
              <div className="no-print">
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionTitleText}><Bell size={18} color="#f59e0b" /> Tetapan Notifikasi & Aplikasi</span>
                </h2>
                
                {/* Bahagian 1: Pengurusan Kelas */}
                <h3 style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 700, marginTop: '1rem', marginBottom: '0.75rem' }}>Bahagian 1: Pengurusan Kelas</h3>
                <div className={styles.formGroup} style={{ marginBottom: '1.75rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label className={styles.label} style={{ fontSize: '0.85rem' }}>Pilihan Kelas Seliaan Utama (Tasmik)</label>
                  <select className={styles.input} value={kelasSeliaan} onChange={(e) => setKelasSeliaan(e.target.value)} style={{ marginTop: '0.5rem' }}>
                    <option value="">-- Pilih Kelas Seliaan --</option>
                    {senaraiKelas.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Nota: Senarai pelajar dalam dashboard anda akan dipaparkan mengikut pilihan kelas di atas.</p>
                </div>

                {/* Bahagian 2: Preferensi Visual & Audio */}
                <h3 style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 700, marginTop: '2rem', marginBottom: '0.75rem' }}>Bahagian 2: Preferensi Visual & Audio Al-Quran</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.75rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <label className={styles.label} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Volume2 size={16} color="#0062ff" /> Suara Qari (Audio Bacaan)</label>
                    <select className={styles.input} value={qariAudio} onChange={(e) => setQariAudio(e.target.value)} style={{ marginTop: '0.5rem' }}>
                      <option value="ar.alafasy">Mishary Rashid Alafasy</option>
                      <option value="ar.abdulbasit">Abdul Baset Abdul Samad</option>
                      <option value="ar.sudais">Abdurrahmaan As-Sudais</option>
                      <option value="ar.husary">Mahmoud Khalil Al-Husary</option>
                    </select>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <label className={styles.label} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Type size={16} color="#0062ff" /> Saiz Tulisan Al-Quran Lalai</label>
                    <select className={styles.input} value={quranFontSize} onChange={(e) => setQuranFontSize(e.target.value)} style={{ marginTop: '0.5rem' }}>
                      <option value="Kecil">Kecil</option>
                      <option value="Biasa">Sederhana (Biasa)</option>
                      <option value="Besar">Besar</option>
                      <option value="Sangat Besar">Sangat Besar</option>
                    </select>
                  </div>
                </div>

                {/* Bahagian 3: Notifikasi Automasi */}
                <h3 style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 700, marginTop: '2rem', marginBottom: '0.75rem' }}>Bahagian 3: Tetapan Notifikasi & Automasi</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <p style={{ margin: '0 0 0.3rem 0', fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Notifikasi Pelajar Hadir (Bilik Live)</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Paparkan amaran dan bunyikan loceng apabila pelajar menyertai bilik tasmik online.</p>
                    </div>
                    <label className={styles.switch}>
                      <input type="checkbox" checked={notifHadir} onChange={(e) => setNotifHadir(e.target.checked)} />
                      <span className={styles.slider}></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <p style={{ margin: '0 0 0.3rem 0', fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Peringatan Tasmik Harian (Auto SMS/Push)</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Hantar peringatan mesra secara automatik kepada pelajar setiap pagi untuk menghafal.</p>
                    </div>
                    <label className={styles.switch}>
                      <input type="checkbox" checked={notifPeringatanHarian} onChange={(e) => setNotifPeringatanHarian(e.target.checked)} />
                      <span className={styles.slider}></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <p style={{ margin: '0 0 0.3rem 0', fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>Laporan Peringatan Bulanan (E-mel)</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Hantar salinan ringkasan rekod hafazan kohort ke e-mel anda setiap hujung bulan.</p>
                    </div>
                    <label className={styles.switch}>
                      <input type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
                      <span className={styles.slider}></span>
                    </label>
                  </div>
                  
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                  <button 
                    type="button" 
                    onClick={handleSave} 
                    disabled={isSaving}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                      background: isSaving ? '#94a3b8' : '#0062ff', color: '#ffffff', border: 'none',
                      padding: '0.85rem 2rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 700,
                      cursor: isSaving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(0, 98, 255, 0.25)'
                    }}
                  >
                    {isSaving ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <><Send size={18} /> Simpan Tetapan Aplikasi</>}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: KESELAMATAN (KATA LALUAN) */}
            {activeTab === 'keselamatan' && (
              <div className="no-print">
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionTitleText}><Lock size={18} color="#ef4444" /> Keselamatan Kata Laluan</span>
                </h2>
                
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Kata Laluan Baharu</label>
                    <input type="password" className={styles.input} placeholder="Minima 6 aksara" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Sahkan Kata Laluan Baharu</label>
                    <input type="password" className={styles.input} placeholder="Ulang kata laluan baharu" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                  <button 
                    type="button" 
                    onClick={handleSave} 
                    disabled={isSaving}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      background: isSaving ? '#94a3b8' : '#0062ff', color: '#ffffff', border: 'none',
                      padding: '0.75rem 1.75rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700,
                      cursor: isSaving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSaving ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <><Save size={18} /> Simpan Perubahan</>}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style jsx global>{`
        .spinIcon { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeInScale { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        
        /* CSS Khusus Untuk Pengalaman Cetakan Yang Baik */
        @media print {
          body * {
            visibility: hidden;
          }
          
          .printable-modal, .printable-modal * {
            visibility: visible !important;
          }
          
          .printable-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-only {
            display: flex !important;
          }
          
          .print-area {
            overflow: visible !important;
            border: none !important;
          }
          
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          
          .print-table th, .print-table td {
            border: 1px solid #334155 !important;
            padding: 10px !important;
            color: #000 !important;
          }
          
          .print-table th {
            background-color: #f1f5f9 !important;
          }
        }
      `}</style>
    </DashboardGuruLayout>
  );
}