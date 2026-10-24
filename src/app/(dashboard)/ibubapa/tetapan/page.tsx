'use client';

import React, { useState, useEffect } from 'react';
import DashboardIbuBapaLayout from '@/components/dashboard/DashboardIbuBapaLayout';
import { supabase } from '@/lib/supabase';
import { 
  Settings, User, Phone, Mail, MessageCircle, 
  Bell, Save, Shield, GraduationCap, Camera, Lock, Send, X, Loader2, Link2, UserPlus, UserMinus
} from 'lucide-react';

export default function IbuBapaTetapanPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'profil' | 'notifikasi' | 'guru' | 'anak'>('anak');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // State Profil Penjaga Dinamik (Supabase)
  const [userId, setUserId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentAddress, setParentAddress] = useState('');
  const [parentAvatar, setParentAvatar] = useState<string | null>(null);

  // State Pautan Anak
  const [linkedChildren, setLinkedChildren] = useState<any[]>([]);
  const [childIcInput, setChildIcInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // State Tukar Kata Laluan
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // State Borang Pertanyaan Guru
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [isSendingInquiry, setIsSendingInquiry] = useState(false);

  // Senarai Guru
  const [teachersList, setTeachersList] = useState<{id: string, name: string, email: string, phone: string}[]>([]);

  // State Notifikasi
  const [notifyAbsence, setNotifyAbsence] = useState(true);
  const [notifyGrades, setNotifyGrades] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchParentData();
  }, []);

  const fetchParentData = async () => {
    setIsLoading(true);
    try {
      // 1. Tarik Data Sesi Waris
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const uId = authData.user.id;
      setUserId(uId);

      // 2. Tarik Profil Waris
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uId)
        .single();

      if (profile) {
        setParentName(profile.full_name || '');
        setParentPhone(profile.phone || '');
        setParentEmail(profile.email || authData.user.email || '');
        setParentAddress(profile.address || '');
        setParentAvatar(profile.avatar_url || null);
      }

      // 3. Tarik Senarai Anak Yang Telah Dipautkan
      await fetchLinkedChildren(uId);

      // 4. Tarik Senarai Guru
      const { data: gurus } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'Guru');

      if (gurus && gurus.length > 0) {
        setTeachersList(gurus.map(g => ({
          id: g.id,
          name: g.full_name || 'Guru',
          email: g.email || 'Tiada Emel',
          phone: g.phone || ''
        })));
      }

    } catch (err) {
      console.error('Ralat menarik data waris:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLinkedChildren = async (parentId: string) => {
    try {
      const { data: children, error } = await supabase
        .from('profiles')
        // PUNCA MASALAH: Dibuang 'class_name' di sini kerana lajur itu tiada dalam database anda
        .select('id, full_name, matrik_or_id') 
        .eq('role', 'Pelajar')
        .eq('parent_id', parentId);
      
      if (error) console.error("Ralat carian anak:", error.message);

      if (children) {
        setLinkedChildren(children);
      } else {
        setLinkedChildren([]);
      }
    } catch (err) {
      console.error("Ralat fetch:", err);
      setLinkedChildren([]);
    }
  };

  // =========================================================================
  // FUNGSI PAUTAN ANAK YANG TEPAT (MENGGUNAKAN MATRIK_OR_ID)
  // =========================================================================
  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Perangkap Ralat Awal Supaya Butang Tidak 'Mati'
    if (!childIcInput.trim()) {
      alert('Sila masukkan No. MyKad anak anda ke dalam petak kosong.');
      return;
    }

    if (!userId) {
      alert('Sistem sedang memuatkan ID sesi anda. Sila tunggu sebentar atau muat semula (refresh) halaman.');
      return;
    }

    setIsLinking(true);
    try {
      const rawInput = childIcInput.trim();
      const cleanDigits = rawInput.replace(/\D/g, ''); 
      const formattedWithHyphen = cleanDigits.length === 12 
        ? `${cleanDigits.slice(0, 6)}-${cleanDigits.slice(6, 8)}-${cleanDigits.slice(8, 12)}` 
        : rawInput;

      // Bina Array senarai format MyKad untuk dicari (mengelakkan ralat syntax Supabase)
      const searchValues = Array.from(new Set([rawInput, cleanDigits, formattedWithHyphen]));

      const { data: students, error: searchError } = await supabase
        .from('profiles')
        .select('id, full_name, matrik_or_id, parent_id, role')
        .eq('role', 'Pelajar')
        .in('matrik_or_id', searchValues);

      if (searchError) {
        alert(`Ralat pangkalan data: ${searchError.message}`);
        setIsLinking(false);
        return;
      }

      if (!students || students.length === 0) {
        alert(`Ralat: Tiada rekod pelajar dijumpai dengan No. MyKad/Matrik "${rawInput}". Pastikan nombor yang dimasukkan wujud di pangkalan data.`);
        setIsLinking(false);
        return;
      }

      const student = students[0];

      if (student.parent_id === userId) {
        alert(`Pelajar ${student.full_name} sememangnya sudah dipautkan kepada akaun anda.`);
        await fetchLinkedChildren(userId);
        setIsLinking(false);
        return;
      }

      if (student.parent_id && student.parent_id !== userId) {
        alert(`Ralat: Pelajar ${student.full_name} telah dipautkan ke akaun waris yang lain.`);
        setIsLinking(false);
        return;
      }

      // Ikat ID Pelajar dengan ID Waris Ini
      const { data: updatedRecord, error: updateError } = await supabase
        .from('profiles')
        .update({ parent_id: userId })
        .eq('id', student.id)
        .select(); 

      if (updateError) throw updateError;

      if (!updatedRecord || updatedRecord.length === 0) {
          alert('RALAT RLS: Supabase menghalang penyimpanan rekod ini. Sila semak semula polisi RLS di pangkalan data.');
          setIsLinking(false);
          return;
      }

      alert(`Alhamdulillah! Akaun anakanda ${student.full_name} berjaya dipautkan dan tersimpan di pangkalan data.`);
      setChildIcInput('');
      
      // Refresh Data Serta-merta
      await fetchLinkedChildren(userId);
      window.dispatchEvent(new Event('activeChildChanged'));

    } catch (err: any) {
      alert(`Gagal memautkan akaun: ${err.message || err}`);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkChild = async (childId: string, childName: string) => {
    if (!confirm(`Adakah anda pasti mahu membatalkan pautan rekod untuk ${childName}?`)) return;

    try {
      await supabase
        .from('profiles')
        .update({ parent_id: null })
        .eq('id', childId);
      
      alert('Pautan pelajar berjaya dibatalkan.');
      await fetchLinkedChildren(userId);
      window.dispatchEvent(new Event('activeChildChanged'));
    } catch (err) {
      alert('Gagal membatalkan pautan.');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
          setParentAvatar(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      alert('Ralat: Kata laluan baharu dan pengesahan tidak sepadan!');
      return;
    }

    setIsSaving(true);
    try {
      if (!userId) throw new Error('Tiada sesi pengguna dikesan.');

      await supabase.from('profiles').update({
        full_name: parentName,
        phone: parentPhone,
        address: parentAddress,
        avatar_url: parentAvatar
      }).eq('id', userId);

      if (newPassword) {
        await supabase.auth.updateUser({ password: newPassword });
        setNewPassword('');
        setConfirmPassword('');
      }

      alert('Alhamdulillah, profil berjaya dikemas kini!');
    } catch (err: any) {
      alert(`Gagal menyimpan profil: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryMessage.trim() || !selectedTeacherId || !userId) return;

    setIsSendingInquiry(true);
    try {
      await supabase.from('notifications').insert([{
        user_id: selectedTeacherId,
        sender_id: userId,
        type: 'info',
        title: `Pertanyaan Ibu Bapa: ${parentName}`,
        message: inquiryMessage
      }]);

      setInquiryMessage('');
      setSelectedTeacherId(null);
      setSelectedTeacherName(null);
      alert('Mesej pertanyaan anda telah berjaya dihantar ke Papan Pemuka guru berkenaan.');
    } catch (err: any) {
      alert(`Ralat menghantar mesej: ${err.message}`);
    } finally {
      setIsSendingInquiry(false);
    }
  };

  const handleWhatsApp = (phone: string, teacherName: string) => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '601123456789';
    const finalPhone = cleanPhone.startsWith('0') ? `6${cleanPhone}` : cleanPhone; 
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(`Assalamualaikum ${teacherName}, saya${parentName || 'waris pelajar'} ingin bertanya mengenai anak saya.`)}`;
    window.open(url, '_blank');
  };

  if (!mounted) return <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}></div>;

  if (isLoading) {
    return (
      <DashboardIbuBapaLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Loader2 className="animate-spin" size={40} color="#059669" />
        </div>
      </DashboardIbuBapaLayout>
    );
  }

  return (
    <DashboardIbuBapaLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* HEADER MODUL */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Settings size={26} color="#059669" /> Tetapan & Pautan Anak
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Urus pautan akaun pelajar, maklumat waris, dan hubungi guru pentasmik.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* MENU TAB KIRI */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #eef2f6', textAlign: 'center' }}>
              <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 1rem auto' }}>
                {parentAvatar ? (
                  <img src={parentAvatar} alt="Profil" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #dcfce7' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#059669', color: '#fff', fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid #dcfce7' }}>
                    {parentName ? parentName.charAt(0).toUpperCase() : 'W'}
                  </div>
                )}
              </div>
              <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{parentName || 'Profil Belum Lengkap'}</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Waris Berdaftar</p>
            </div>
            
            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button 
                onClick={() => setActiveTab('anak')}
                style={{ background: activeTab === 'anak' ? '#ecfdf5' : 'transparent', color: activeTab === 'anak' ? '#059669' : '#475569', border: 'none', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              >
                <Link2 size={18} /> Pautan Profil Anak
              </button>
              <button 
                onClick={() => setActiveTab('profil')}
                style={{ background: activeTab === 'profil' ? '#ecfdf5' : 'transparent', color: activeTab === 'profil' ? '#059669' : '#475569', border: 'none', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              >
                <User size={18} /> Profil Penjaga & Katalaluan
              </button>
              <button 
                onClick={() => setActiveTab('guru')}
                style={{ background: activeTab === 'guru' ? '#ecfdf5' : 'transparent', color: activeTab === 'guru' ? '#059669' : '#475569', border: 'none', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              >
                <GraduationCap size={18} /> Direktori Guru Tasmik
              </button>
              <button 
                onClick={() => setActiveTab('notifikasi')}
                style={{ background: activeTab === 'notifikasi' ? '#ecfdf5' : 'transparent', color: activeTab === 'notifikasi' ? '#059669' : '#475569', border: 'none', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              >
                <Bell size={18} /> Notifikasi Sistem
              </button>
            </div>
          </div>

          {/* KANDUNGAN TAB KANAN */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', minHeight: '500px' }}>
            
            {/* TAB: PAUTAN ANAK */}
            {activeTab === 'anak' && (
              <div style={{ padding: '2rem' }}>
                <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Link2 size={20} color="#059669" /> Urus Pautan Rekod Anak
                </h2>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserPlus size={16} color="#0062ff"/> Tambah Pautan Pelajar
                  </h3>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>Masukkan Nombor MyKad atau Nombor Pasport anak anda untuk memautkan data hafazan mereka ke papan pemuka anda.</p>
                  
                  <form onSubmit={handleLinkChild} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <input 
                      type="text" 
                      placeholder="Contoh: 112233445566" 
                      value={childIcInput}
                      onChange={(e) => setChildIcInput(e.target.value)}
                      required
                      style={{ flex: 1, minWidth: '250px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                    />
                    <button 
                      type="submit" 
                      disabled={isLinking}
                      style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: isLinking ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {isLinking ? <Loader2 size={16} className="animate-spin"/> : 'Pautkan Anak'}
                    </button>
                  </form>
                </div>

                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a' }}>Senarai Anak Di Bawah Pantauan Anda</h3>
                
                {linkedChildren.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: '12px', color: '#b45309' }}>
                    <Shield size={32} color="#f59e0b" style={{ margin: '0 auto 0.5rem auto' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Belum ada rekod anak dipautkan.</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>Sila gunakan ruangan di atas untuk mendaftarkan No. MyKad anak anda.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    {linkedChildren.map(child => (
                      <div key={child.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                            {child.full_name ? child.full_name.charAt(0) : 'P'}
                          </div>
                          <div>
                            <h4 style={{ margin: '0 0 0.2rem 0', color: '#0f172a', fontSize: '1rem' }}>{child.full_name}</h4>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>No. MyKad: {child.matrik_or_id}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleUnlinkChild(child.id, child.full_name)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <UserMinus size={14}/> Batal Pautan
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* TAB: DIREKTORI GURU */}
            {activeTab === 'guru' && (
              <div style={{ padding: '2rem' }}>
                <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <GraduationCap size={20} color="#059669" /> Direktori Guru Pentasmik
                </h2>

                {teachersList.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Tiada rekod guru dijumpai buat masa ini.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {teachersList.map((teacher) => (
                      <div key={teacher.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#f8fafc', display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name)}&background=0f172a&color=fff&size=100`} alt="Ustaz" style={{ borderRadius: '50%', width: '70px', height: '70px' }} />
                        
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.2rem', color: '#0f172a' }}>{teacher.name}</h3>
                          <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>Guru Pentasmik Berdaftar</p>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#334155' }}>
                              <Phone size={14} color="#64748b" /> {teacher.phone || 'Tiada Rekod Telefon'}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#334155' }}>
                              <Mail size={14} color="#64748b" /> {teacher.email}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => handleWhatsApp(teacher.phone, teacher.name)}
                              style={{ background: '#25D366', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                              <MessageCircle size={16} /> WhatsApp Guru
                            </button>
                            <button 
                              onClick={() => { setSelectedTeacherId(teacher.id); setSelectedTeacherName(teacher.name); }}
                              style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                              <Send size={14} /> Hantar Pertanyaan
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: PROFIL PENJAGA & KATA LALUAN */}
            {activeTab === 'profil' && (
              <form onSubmit={handleSaveProfile} style={{ padding: '2rem' }}>
                <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={20} color="#059669" /> Maklumat Peribadi & Keselamatan
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem' }}>
                    {parentAvatar ? <img src={parentAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (parentName ? parentName.charAt(0).toUpperCase() : 'W')}
                  </div>
                  <div>
                    <label htmlFor="avatarUpload" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                      <Camera size={16} /> Tukar Gambar Profil
                    </label>
                    <input id="avatarUpload" type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Nama Penuh Waris</label>
                    <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>No Telefon (WhatsApp)</label>
                    <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} required />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Alamat E-mel</label>
                    <input type="email" value={parentEmail} readOnly style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem', outline: 'none', color: '#64748b' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Alamat Kediaman</label>
                    <textarea rows={2} value={parentAddress} onChange={(e) => setParentAddress(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }} />
                  </div>
                </div>

                <h3 style={{ margin: '1.5rem 0 1rem 0', fontSize: '1rem', color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Lock size={16} color="#059669" /> Kemaskini Kata Laluan (Pilihan)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>Kata Laluan Baharu</label>
                    <input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>Sahkan Kata Laluan</label>
                    <input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={isSaving} style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isSaving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16}/> Simpan Profil</>}
                  </button>
                </div>
              </form>
            )}

            {/* TAB: NOTIFIKASI SISTEM */}
            {activeTab === 'notifikasi' && (
              <div style={{ padding: '2rem' }}>
                <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem', color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bell size={20} color="#059669" /> Keutamaan Notifikasi
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.2rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Amaran Ketidakhadiran & Lewat</h4>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Terima amaran e-mel jika anak lewat atau ponteng kelas.</p>
                    </div>
                    <input type="checkbox" checked={notifyAbsence} onChange={(e) => setNotifyAbsence(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#059669', cursor: 'pointer' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.2rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Laporan Keputusan Tasmik</h4>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>Terima notifikasi apabila guru selesai merekodkan gred baru.</p>
                    </div>
                    <input type="checkbox" checked={notifyGrades} onChange={(e) => setNotifyGrades(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: '#059669', cursor: 'pointer' }} />
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* MODAL BORANG PERTANYAAN RASMI KE GURU */}
      {selectedTeacherId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Hantar Pertanyaan Rasmi</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Kepada: {selectedTeacherName}</span>
              </div>
              <button type="button" onClick={() => setSelectedTeacherId(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendInquiry} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Mesej / Pertanyaan Anda</label>
                <textarea 
                  rows={4} 
                  placeholder="Taipkan soalan atau perbincangan..." 
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setSelectedTeacherId(null)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Batal
                </button>
                <button type="submit" disabled={isSendingInquiry} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {isSendingInquiry ? <Loader2 size={15} className="animate-spin"/> : <Send size={15} />} Hantar
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </DashboardIbuBapaLayout>
  );
}