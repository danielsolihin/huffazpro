'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  Settings, User, GraduationCap, Bell, Lock, 
  Camera, UploadCloud, FileText, Trash2, CheckCircle2, 
  AlertCircle, Save, Loader2, CalendarCheck, Printer, Clock, Eye
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
  status: 'Hadir' | 'Lewat' | 'Cuti Sakit' | 'Cuti Rehat';
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

  // 3. STATE NOTIFIKASI & KELAS
  const [kelasSeliaan, setKelasSeliaan] = useState('');
  const [notifHadir, setNotifHadir] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [senaraiKelas, setSenaraiKelas] = useState<{id: string, name: string}[]>([]);

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

      let classesList: {id: string, name: string}[] = [];
      const { data: classesData } = await supabase.from('classes').select('id, name');
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

      const { data: attData } = await supabase.from('attendance').select('*').eq('user_id', currentId).order('created_at', { ascending: false });
      if (attData && attData.length > 0) {
        const formattedLogs: TeacherAttendanceRecord[] = attData.map((att: any) => ({
          id: att.id,
          tarikh: att.date || new Date(att.created_at).toLocaleDateString('ms-MY'),
          hari: new Date(att.created_at).toLocaleDateString('ms-MY', { weekday: 'long' }),
          masaMasuk: formatTimeAMPM(att.time_in) !== '-' ? formatTimeAMPM(att.time_in) : '08:00 AM',
          masaKeluar: formatTimeAMPM(att.time_out) !== '-' ? formatTimeAMPM(att.time_out) : '04:30 PM',
          jumlahJam: att.duration || '8 Jam',
          status: att.status || 'Hadir',
          catatan: att.remarks || att.notes || 'Bertugas di Maahad'
        }));
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
      case 'mingguan': return allAttendanceLogs.slice(0, 5);
      case 'bulanan': return allAttendanceLogs;
      case 'tahunan': return allAttendanceLogs;
      default: return allAttendanceLogs;
    }
  };

  const displayedAttendance = getFilteredAttendance();
  const totalDays = displayedAttendance.length;
  const hadirDays = displayedAttendance.filter(a => a.status === 'Hadir').length;
  const lewatDays = displayedAttendance.filter(a => a.status === 'Lewat').length;
  const cutiDays = displayedAttendance.filter(a => a.status === 'Cuti Sakit' || a.status === 'Cuti Rehat').length;
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

  // MUAT NAIK PELBAGAI SIJIL (Maks 3 Fail, Saiz Keseluruhan Maks 5MB)
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
  // FUNGSI UTAMA PROSES SIMPAN DATA KE SUPABASE (LAJUR DISAHKAN SAHAJA)
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

      // Gabungkan kesemua URL fail menjadi 1 string berpisah koma
      const combinedCertsUrl = certificates.length > 0 ? certificates.map(c => c.name).join(',') : null;

      const cleanVal = (val: any) => (val === undefined || val === '') ? null : val;

      // HANYA MENGGUNAKAN LAJUR YASAS YANG DIPASTIKAN WUJUD DALAM SCHEMA PROFILES
      const updateData = {
        full_name: cleanVal(namaPenuh),
        phone: cleanVal(noTelefon),
        avatar_url: cleanVal(avatarUrl),
        class_id: cleanVal(kelasSeliaan),
        highest_education: cleanVal(tahapKelulusan),
        specialization: cleanVal(bidang),
        address: cleanVal(biodata),
        certificate_docs: combinedCertsUrl
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (profileError) {
        throw new Error(profileError.message || 'Gagal menyimpan ke profil.');
      }

      if (kelasSeliaan) {
        try { 
          await supabase.from('classes').update({ teacher_id: userId }).eq('id', kelasSeliaan); 
        } catch (e) {}
      }

      if (activeTab === 'keselamatan' && newPassword) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwdError) throw pwdError;
        setNewPassword(''); 
        setConfirmPassword('');
      }

      window.dispatchEvent(new Event('avatarUpdated'));
      setToastMessage({ type: 'success', text: 'Alhamdulillah, maklumat & dokumen berjaya disimpan!' });

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
          <div style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '1rem 1.35rem',
            borderRadius: '12px',
            background: toastMessage.type === 'success' ? '#059669' : '#dc2626',
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
            fontWeight: 700,
            fontSize: '0.88rem',
            animation: 'fadeInScale 0.2s ease-out'
          }}>
            {toastMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{toastMessage.text}</span>
            <button 
              onClick={() => setToastMessage(null)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '0.5rem', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* HEADER KAD */}
        <div className={styles.headerCard}>
          <div className={styles.titleWrap}>
            <h1 className={styles.mainTitle}><Settings size={24} color="#0062ff" /> Tetapan Profil & Sistem</h1>
            <p className={styles.subtitle}>Urus maklumat peribadi, kelulusan akademik, rekod kehadiran guru dan notifikasi di sini.</p>
          </div>
        </div>

        <div className={styles.layoutGrid}>
          {/* MENU NAVIGASI SISI */}
          <div className={styles.sidebarMenu}>
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
              <Bell size={18} /> Tetapan Notifikasi & Kelas
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'keselamatan' ? styles.activeTab : ''}`} onClick={() => { setActiveTab('keselamatan'); setToastMessage(null); }}>
              <Lock size={18} /> Keselamatan (Kata Laluan)
            </button>
          </div>

          {/* KANDUNGAN TAB AKTIF */}
          <div className={styles.contentCard}>
            
            {/* TAB 1: PROFIL PERIBADI */}
            {activeTab === 'profil' && (
              <div>
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
              <div>
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

                {/* BUTANG SIMPAN PERUBAHAN */}
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

            {/* TAB 3: LAPORAN KEHADIRAN GURU */}
            {activeTab === 'kehadiran' && (
              <div>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionTitleText}><CalendarCheck size={18} color="#059669" /> Rekod Kehadiran Kendiri Guru</span>
                  <button type="button" className={styles.btnPrintAttendance} onClick={handlePrintAttendance}>
                    <Printer size={15} /> Cetak Laporan Kehadiran
                  </button>
                </h2>
                
                <div className={styles.periodFilterBar}>
                  <div className={styles.periodButtonGroup}>
                    <button type="button" className={`${styles.periodBtn} ${periodFilter === 'harian' ? styles.periodBtnActive : ''}`} onClick={() => setPeriodFilter('harian')}>Hari Ini</button>
                    <button type="button" className={`${styles.periodBtn} ${periodFilter === 'mingguan' ? styles.periodBtnActive : ''}`} onClick={() => setPeriodFilter('mingguan')}>Mingguan</button>
                    <button type="button" className={`${styles.periodBtn} ${periodFilter === 'bulanan' ? styles.periodBtnActive : ''}`} onClick={() => setPeriodFilter('bulanan')}>Bulanan</button>
                    <button type="button" className={`${styles.periodBtn} ${periodFilter === 'tahunan' ? styles.periodBtnActive : ''}`} onClick={() => setPeriodFilter('tahunan')}>Tahunan</button>
                  </div>
                </div>

                {allAttendanceLogs.length === 0 ? (
                  <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#64748b' }}>Tiada rekod log kehadiran yang direkodkan buat masa ini.</div>
                ) : (
                  <>
                    <div className={styles.attSummaryGrid}>
                      <div className={styles.attSummaryCard}><p className={styles.attSummaryLabel}>Kadar Kehadiran</p><p className={styles.attSummaryVal} style={{ color: '#059669' }}>{attendanceRate}%</p></div>
                      <div className={styles.attSummaryCard}><p className={styles.attSummaryLabel}>Hadir</p><p className={styles.attSummaryVal}>{hadirDays} Hari</p></div>
                      <div className={styles.attSummaryCard}><p className={styles.attSummaryLabel}>Lewat</p><p className={styles.attSummaryVal} style={{ color: '#d97706' }}>{lewatDays} Hari</p></div>
                      <div className={styles.attSummaryCard}><p className={styles.attSummaryLabel}>Cuti / Sakit</p><p className={styles.attSummaryVal} style={{ color: '#64748b' }}>{cutiDays} Hari</p></div>
                    </div>

                    <div className={styles.attTableWrapper}>
                      <table className={styles.attTable}>
                        <thead>
                          <tr><th>Tarikh & Hari</th><th>Waktu Masuk</th><th>Waktu Keluar</th><th>Tempoh Bertugas</th><th>Status</th><th>Catatan</th></tr>
                        </thead>
                        <tbody>
                          {displayedAttendance.map((rec) => (
                            <tr key={rec.id}>
                              <td><strong>{rec.tarikh}</strong><div style={{ fontSize: '0.75rem', color: '#64748b' }}>{rec.hari}</div></td>
                              <td><span style={{ fontWeight: 600 }}>{rec.masaMasuk}</span></td>
                              <td><span style={{ fontWeight: 600 }}>{rec.masaKeluar}</span></td>
                              <td>{rec.jumlahJam}</td>
                              <td><span className={rec.status === 'Hadir' ? styles.badgeHadir : rec.status === 'Lewat' ? styles.badgeLewat : styles.badgeCuti}>{rec.status}</span></td>
                              <td>{rec.catatan}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 4: NOTIFIKASI & KELAS */}
            {activeTab === 'notifikasi' && (
              <div>
                <h2 className={styles.sectionTitle}><span className={styles.sectionTitleText}><Bell size={18} color="#f59e0b" /> Tetapan Notifikasi & Kelas</span></h2>
                
                <div className={styles.formGroup} style={{ marginBottom: '1.75rem' }}>
                  <label className={styles.label}>Pilihan Kelas Seliaan Utama (Tasmik)</label>
                  <select className={styles.input} value={kelasSeliaan} onChange={(e) => setKelasSeliaan(e.target.value)}>
                    <option value="">-- Pilih Kelas Seliaan --</option>
                    {senaraiKelas.map((cls) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.toggleList}>
                  <div className={styles.toggleItem}>
                    <div className={styles.toggleInfo}>
                      <p className={styles.toggleTitle}>Notifikasi Pelajar Hadir (Bilik Live)</p>
                      <p className={styles.toggleDesc}>Paparkan amaran loceng apabila pelajar menyertai bilik tasmik online.</p>
                    </div>
                    <label className={styles.switch}>
                      <input type="checkbox" checked={notifHadir} onChange={(e) => setNotifHadir(e.target.checked)} />
                      <span className={styles.slider}></span>
                    </label>
                  </div>

                  <div className={styles.toggleItem}>
                    <div className={styles.toggleInfo}>
                      <p className={styles.toggleTitle}>Laporan Peringatan Bulanan (E-mel)</p>
                      <p className={styles.toggleDesc}>Hantar salinan ringkasan rekod hafazan kohort ke e-mel setiap hujung bulan.</p>
                    </div>
                    <label className={styles.switch}>
                      <input type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
                      <span className={styles.slider}></span>
                    </label>
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

            {/* TAB 5: KESELAMATAN */}
            {activeTab === 'keselamatan' && (
              <div>
                <h2 className={styles.sectionTitle}><span className={styles.sectionTitleText}><Lock size={18} color="#ef4444" /> Keselamatan Kata Laluan</span></h2>
                
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
    </DashboardGuruLayout>
  );
}