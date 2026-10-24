'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardAdminLayout from '@/components/dashboard/DashboardAdminLayout';
import { supabase } from '@/lib/supabase';
import { 
  Settings, Building2, GraduationCap, Database, 
  Save, UploadCloud, AlertTriangle, CheckCircle2,
  UserCircle, Camera, Loader2, Plus, Trash2, X
} from 'lucide-react';

interface SystemSettings {
  id?: string;
  instName: string; instRegNo: string; instMotto: string;
  instAddress: string; instPhone: string; instEmail: string; instLogoUrl: string;
  academicSession: string; semester: string; passingMark: number;
  maintenanceMode: boolean; autoNotification: boolean;
  availableSessions: string[];
  availableSemesters: string[];
}

interface AdminProfile {
  id?: string;
  name: string; email: string; avatarUrl: string; password?: string;
}

export default function AdminTetapanPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'profil' | 'akademik' | 'sistem' | 'admin'>('profil');
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const adminAvatarRef = useRef<HTMLInputElement>(null);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // MODAL URUS SENARAI
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [newItemText, setNewItemText] = useState('');

  const defaultSettings: SystemSettings = {
    instName: 'Maahad Tahfiz HuffazPro', instRegNo: 'MTH-2020-8819', instMotto: 'Pusat Kecemerlangan Hafazan Interaktif',
    instAddress: 'No 12, Jalan Tasmik Utama, Pusat Bandar Shah Alam, 40000 Selangor', instPhone: '+60 3-5512 3456', instEmail: 'admin@huffazpro.edu.my', instLogoUrl: '',
    academicSession: 'Sesi 2026/2027', semester: 'Semester 1', passingMark: 80, maintenanceMode: false, autoNotification: true,
    availableSessions: ['Sesi 2025/2026', 'Sesi 2026/2027'],
    availableSemesters: ['Semester 1', 'Semester 2', 'Cuti Penggal Persekolahan']
  };

  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [adminProfile, setAdminProfile] = useState<AdminProfile>({ name: 'Pentadbir Utama', email: 'admin@huffazpro.edu.my', avatarUrl: '', password: '' });

  useEffect(() => {
    setMounted(true);
    
    const fetchSettingsAndProfile = async () => {
      setIsLoading(true);
      try {
        const { data: settingsData } = await supabase.from('settings').select('*').limit(1).single();
        if (settingsData) {
          setSettings({
            id: settingsData.id,
            instName: settingsData.inst_name || defaultSettings.instName,
            instRegNo: settingsData.inst_reg_no || defaultSettings.instRegNo,
            instMotto: settingsData.inst_motto || defaultSettings.instMotto,
            instAddress: settingsData.inst_address || defaultSettings.instAddress,
            instPhone: settingsData.inst_phone || defaultSettings.instPhone,
            instEmail: settingsData.inst_email || defaultSettings.instEmail,
            instLogoUrl: settingsData.inst_logo_url || '',
            academicSession: settingsData.academic_session || defaultSettings.academicSession,
            semester: settingsData.semester || defaultSettings.semester,
            passingMark: settingsData.passing_mark || defaultSettings.passingMark,
            maintenanceMode: settingsData.maintenance_mode || false,
            autoNotification: settingsData.auto_notification !== undefined ? settingsData.auto_notification : true,
            availableSessions: settingsData.available_sessions || defaultSettings.availableSessions,
            availableSemesters: settingsData.available_semesters || defaultSettings.availableSemesters
          });
        }

        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
          if (profile) {
            setAdminProfile({
              id: profile.id,
              name: profile.full_name || 'Pentadbir',
              email: profile.email || authData.user.email || '',
              avatarUrl: profile.avatar_url || '',
              password: ''
            });
          }
        }
      } catch (error) {
        console.error('Ralat menarik data tetapan:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettingsAndProfile();
  }, []);

  const uploadImageToStorage = async (file: File, bucket: string, pathPrefix: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${pathPrefix}-${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: true });
    if (error) throw error;
    
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setToastMessage({ type: 'success', text: 'Memuat naik logo...' });
      const publicUrl = await uploadImageToStorage(file, 'logos', 'inst-logo');
      setSettings({ ...settings, instLogoUrl: publicUrl });
      setToastMessage({ type: 'success', text: 'Logo sedia untuk disimpan.' });
    } catch (error: any) {
      setToastMessage({ type: 'error', text: `Gagal muat naik: Pastikan bucket 'logos' wujud.` });
    }
  };

  const handleAdminAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setToastMessage({ type: 'success', text: 'Memuat naik gambar profil...' });
      const publicUrl = await uploadImageToStorage(file, 'avatars', 'admin-avatar');
      setAdminProfile({ ...adminProfile, avatarUrl: publicUrl });
      setToastMessage({ type: 'success', text: 'Gambar profil sedia untuk disimpan.' });
    } catch (error: any) {
      setToastMessage({ type: 'error', text: `Gagal muat naik: Pastikan bucket 'avatars' wujud.` });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dbSettingsData = {
        inst_name: settings.instName,
        inst_reg_no: settings.instRegNo,
        inst_motto: settings.instMotto,
        inst_address: settings.instAddress,
        inst_phone: settings.instPhone,
        inst_email: settings.instEmail,
        inst_logo_url: settings.instLogoUrl,
        academic_session: settings.academicSession,
        semester: settings.semester,
        passing_mark: settings.passingMark,
        maintenance_mode: settings.maintenanceMode,
        auto_notification: settings.autoNotification,
        available_sessions: settings.availableSessions,
        available_semesters: settings.availableSemesters
      };

      if (settings.id) {
        await supabase.from('settings').update(dbSettingsData).eq('id', settings.id);
      } else {
        const { data } = await supabase.from('settings').insert([dbSettingsData]).select().single();
        if (data) setSettings({...settings, id: data.id});
      }

      setToastMessage({ type: 'success', text: 'Tetapan sistem berjaya disimpan di Supabase.' });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error: any) {
      setToastMessage({ type: 'error', text: `Gagal menyimpan: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (adminProfile.id) {
        await supabase.from('profiles').update({
          full_name: adminProfile.name,
          avatar_url: adminProfile.avatarUrl
        }).eq('id', adminProfile.id);
      }
      if (adminProfile.password) {
        const { error } = await supabase.auth.updateUser({ password: adminProfile.password });
        if (error) throw error;
        setAdminProfile({ ...adminProfile, password: '' });
      }
      setToastMessage({ type: 'success', text: 'Profil pentadbir berjaya dikemas kini.' });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error: any) {
      setToastMessage({ type: 'error', text: `Ralat kemaskini profil: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSystem = async () => {
    if (confirm("AMARAN KERAS: Tindakan ini akan memadam KESEMUA data (profiles, evaluations, attendance). Adakah anda pasti?")) {
      const userInput = prompt("Taip 'PADAM SEMUA' untuk meneruskan:");
      if (userInput === 'PADAM SEMUA') {
        try {
          await supabase.from('evaluations').delete().neq('id', '0');
          await supabase.from('attendance').delete().neq('id', '0');
          alert("Pangkalan data (Evaluation & Attendance) telah dikosongkan. Sistem akan dimuat semula.");
          window.location.reload();
        } catch (error: any) {
          alert(`Gagal memadam: ${error.message}`);
        }
      } else { 
        alert("Proses dibatalkan."); 
      }
    }
  };

  // PENGURUSAN SENARAI SESI & SEMESTER
  const addSessionItem = () => {
    if (newItemText.trim() && !settings.availableSessions.includes(newItemText.trim())) {
      setSettings({...settings, availableSessions: [...settings.availableSessions, newItemText.trim()]});
      setNewItemText('');
    }
  };
  const removeSessionItem = (item: string) => {
    const updated = settings.availableSessions.filter(s => s !== item);
    setSettings({...settings, availableSessions: updated});
    if (settings.academicSession === item) setSettings({...settings, academicSession: updated[0] || '', availableSessions: updated});
  };

  const addSemesterItem = () => {
    if (newItemText.trim() && !settings.availableSemesters.includes(newItemText.trim())) {
      setSettings({...settings, availableSemesters: [...settings.availableSemesters, newItemText.trim()]});
      setNewItemText('');
    }
  };
  const removeSemesterItem = (item: string) => {
    const updated = settings.availableSemesters.filter(s => s !== item);
    setSettings({...settings, availableSemesters: updated});
    if (settings.semester === item) setSettings({...settings, semester: updated[0] || '', availableSemesters: updated});
  };

  if (!mounted) return <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}></div>;

  if (isLoading) {
    return (
      <DashboardAdminLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Loader2 className="animate-spin" size={40} color="#0062ff" />
        </div>
      </DashboardAdminLayout>
    );
  }

  return (
    <DashboardAdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
        
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Settings size={26} color="#0062ff" /> Tetapan Institusi
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Ubah suai maklumat asas, parameter akademik, dan penyelenggaraan sistem Maahad.
            </p>
          </div>
        </div>

        {toastMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: toastMessage.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${toastMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`, padding: '1rem 1.5rem', borderRadius: '12px', color: toastMessage.type === 'success' ? '#065f46' : '#991b1b', fontWeight: 600 }}>
            {toastMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            {toastMessage.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #eef2f6', padding: '1rem', width: '250px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button onClick={() => setActiveTab('profil')} style={tabButtonStyle(activeTab === 'profil')}><Building2 size={18}/> Profil Institusi</button>
            <button onClick={() => setActiveTab('akademik')} style={tabButtonStyle(activeTab === 'akademik')}><GraduationCap size={18}/> Tetapan Akademik</button>
            <button onClick={() => setActiveTab('sistem')} style={tabButtonStyle(activeTab === 'sistem')}><Database size={18}/> Penyelenggaraan DB</button>
            <hr style={{ borderTop: '1px solid #f1f5f9', margin: '0.5rem 0' }} />
            <button onClick={() => setActiveTab('admin')} style={tabButtonStyle(activeTab === 'admin', true)}><UserCircle size={18}/> Akaun Pentadbir</button>
          </div>

          <div style={{ flex: 1, minWidth: '300px', background: '#fff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden' }}>
            
            {activeTab !== 'admin' ? (
              <form onSubmit={handleSaveSettings}>
                {/* TAB 1: PROFIL INSTITUSI */}
                {activeTab === 'profil' && (
                  <div style={{ padding: '2rem' }}>
                    <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>Maklumat Rasmi Maahad</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: '#f8fafc', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {settings.instLogoUrl ? <img src={settings.instLogoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Building2 size={32} color="#94a3b8" />}
                      </div>
                      <div>
                        <input type="file" ref={logoInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                        <button type="button" onClick={() => logoInputRef.current?.click()} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <UploadCloud size={16}/> Muat Naik Logo
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Nama Institusi / Maahad</label><input type="text" value={settings.instName} onChange={(e) => setSettings({...settings, instName: e.target.value})} style={inputStyle} required /></div>
                      <div><label style={labelStyle}>No. Pendaftaran Organisasi (SSM/JAIS)</label><input type="text" value={settings.instRegNo} onChange={(e) => setSettings({...settings, instRegNo: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Moto Pendididikan</label><input type="text" value={settings.instMotto} onChange={(e) => setSettings({...settings, instMotto: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. Telefon Utama</label><input type="text" value={settings.instPhone} onChange={(e) => setSettings({...settings, instPhone: e.target.value})} style={inputStyle} required /></div>
                      <div><label style={labelStyle}>Alamat E-mel Rasmi</label><input type="email" value={settings.instEmail} onChange={(e) => setSettings({...settings, instEmail: e.target.value})} style={inputStyle} required /></div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Alamat Penuh Premis</label><textarea rows={3} value={settings.instAddress} onChange={(e) => setSettings({...settings, instAddress: e.target.value})} style={{...inputStyle, resize: 'vertical'}} required /></div>
                    </div>
                  </div>
                )}

                {/* TAB 2: TETAPAN AKADEMIK (DIKEMAS KINI) */}
                {activeTab === 'akademik' && (
                  <div style={{ padding: '2rem' }}>
                    <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>Kalendar & Penilaian Akademik</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Sesi Pengajian Semasa</label>
                          <select value={settings.academicSession} onChange={(e) => setSettings({...settings, academicSession: e.target.value})} style={{...inputStyle, cursor: 'pointer'}}>
                            {settings.availableSessions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <button type="button" onClick={() => {setNewItemText(''); setShowSessionModal(true)}} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }} title="Urus Senarai Sesi"><Settings size={18} color="#475569"/></button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Semester Aktif</label>
                          <select value={settings.semester} onChange={(e) => setSettings({...settings, semester: e.target.value})} style={{...inputStyle, cursor: 'pointer'}}>
                            {settings.availableSemesters.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <button type="button" onClick={() => {setNewItemText(''); setShowSemesterModal(true)}} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }} title="Urus Senarai Semester"><Settings size={18} color="#475569"/></button>
                      </div>

                      <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <label style={labelStyle}>Gred Tasmik Minimum (Lulus / Jayyid)</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <input type="range" min="40" max="90" value={settings.passingMark} onChange={(e) => setSettings({...settings, passingMark: Number(e.target.value)})} style={{ flex: 1, accentColor: '#0062ff' }} />
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0062ff', width: '60px', textAlign: 'center' }}>{settings.passingMark}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: SISTEM */}
                {activeTab === 'sistem' && (
                  <div style={{ padding: '2rem' }}>
                    <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>Kawalan Pangkalan Data</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                        <div><h4 style={{ margin: '0 0 0.2rem 0', color: '#0f172a', fontSize: '0.95rem' }}>Notifikasi Automatik</h4></div>
                        <input type="checkbox" checked={settings.autoNotification} onChange={(e) => setSettings({...settings, autoNotification: e.target.checked})} style={{ width: '20px', height: '20px', accentColor: '#0062ff' }} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: settings.maintenanceMode ? '#fef2f2' : '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: `1px solid ${settings.maintenanceMode ? '#fecaca' : '#e2e8f0'}`, cursor: 'pointer' }}>
                        <div><h4 style={{ margin: '0 0 0.2rem 0', color: settings.maintenanceMode ? '#991b1b' : '#0f172a', fontSize: '0.95rem' }}>Mod Penyelenggaraan Sistem (Maintenance)</h4></div>
                        <input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})} style={{ width: '20px', height: '20px', accentColor: '#dc2626' }} />
                      </label>
                      <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '1rem 0' }} />
                      <div>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '0.95rem' }}>Kecemasan: Set Semula Pangkalan Data</h4>
                        <button type="button" onClick={handleResetSystem} style={{ background: '#fff', border: '1px solid #fecaca', color: '#dc2626', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertTriangle size={16} /> Padam Data (Evals & Att)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #eef2f6', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={isSubmitting} style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isSubmitting ? 0.7 : 1 }}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
                    Simpan Perubahan Tetapan
                  </button>
                </div>
              </form>
            ) : (
              
              /* TAB 4: AKAUN ADMIN */
              <form onSubmit={handleSaveAdmin}>
                <div style={{ padding: '2rem' }}>
                  <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>Profil & Kata Laluan Pentadbir</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 800, overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                        {adminProfile.avatarUrl ? <img src={adminProfile.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : adminProfile.name.charAt(0)}
                      </div>
                      <div onClick={() => adminAvatarRef.current?.click()} style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: '#0062ff', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                        <Camera size={14} />
                      </div>
                      <input type="file" ref={adminAvatarRef} accept="image/*" style={{ display: 'none' }} onChange={handleAdminAvatarUpload} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.2rem 0', fontWeight: 700, color: '#0f172a' }}>Gambar Profil (Avatar)</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Klik ikon kamera untuk menukar gambar rasmi anda.</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div>
                      <label style={labelStyle}>Nama Pentadbir</label>
                      <input type="text" value={adminProfile.name} onChange={(e) => setAdminProfile({...adminProfile, name: e.target.value})} style={inputStyle} required />
                    </div>
                    <div>
                      <label style={labelStyle}>E-mel Log Masuk (Tidak boleh ditukar)</label>
                      <input type="email" value={adminProfile.email} disabled style={{...inputStyle, background: '#f1f5f9'}} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
                      <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#0f172a' }}>Kemaskini Keselamatan (Security)</h4>
                      <div>
                        <label style={labelStyle}>Kata Laluan Baharu (Biarkan kosong jika tidak mahu tukar)</label>
                        <input type="password" placeholder="Masukkan kata laluan baharu..." value={adminProfile.password} onChange={(e) => setAdminProfile({...adminProfile, password: e.target.value})} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div style={{ padding: '1.25rem 2rem', background: '#f8fafc', borderTop: '1px solid #eef2f6', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={isSubmitting} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isSubmitting ? 0.7 : 1 }}>
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
                    Simpan Profil Akaun
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>

        {/* MODAL PENGURUSAN SESI PENGAJIAN */}
        {showSessionModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Urus Senarai Sesi Pengajian</h3>
                <button type="button" onClick={() => setShowSessionModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}><X size={18} /></button>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <input type="text" placeholder="Tambah Sesi Baru..." value={newItemText} onChange={(e) => setNewItemText(e.target.value)} style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} />
                  <button onClick={addSessionItem} type="button" style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer' }}><Plus size={18}/></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {settings.availableSessions.length === 0 ? <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada data sesi.</p> : null}
                  {settings.availableSessions.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.65rem 1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>{s}</span>
                      <button onClick={() => removeSessionItem(s)} type="button" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
                <button onClick={() => setShowSessionModal(false)} type="button" style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Tutup</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PENGURUSAN SEMESTER AKTIF */}
        {showSemesterModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Urus Senarai Semester</h3>
                <button type="button" onClick={() => setShowSemesterModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}><X size={18} /></button>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <input type="text" placeholder="Tambah Semester Baru..." value={newItemText} onChange={(e) => setNewItemText(e.target.value)} style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} />
                  <button onClick={addSemesterItem} type="button" style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer' }}><Plus size={18}/></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {settings.availableSemesters.length === 0 ? <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada data semester.</p> : null}
                  {settings.availableSemesters.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.65rem 1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>{s}</span>
                      <button onClick={() => removeSemesterItem(s)} type="button" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
                <button onClick={() => setShowSemesterModal(false)} type="button" style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>Tutup</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardAdminLayout>
  );
}

const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' };
const inputStyle = { width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff', color: '#0f172a' };
const tabButtonStyle = (isActive: boolean, isSpecial: boolean = false) => ({
  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '10px', border: 'none', 
  background: isActive ? (isSpecial ? '#0f172a' : '#eff6ff') : 'transparent', 
  color: isActive ? (isSpecial ? '#fff' : '#0062ff') : '#475569', 
  fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.2s'
});