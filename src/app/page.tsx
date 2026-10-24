'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Mail, Lock, EyeOff, Eye, ArrowRight, ShieldCheck, 
  User, Users, GraduationCap, Camera, ChevronLeft, BookOpen, 
  KeyRound, Send, FileText, UserCheck, Loader2, X, Plus
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  
  const [view, setView] = useState<'login' | 'register-role' | 'register-simple' | 'complete-profile' | 'forgot-password'>('login');
  const [selectedRole, setSelectedRole] = useState<'Pelajar' | 'Guru' | 'Waris'>('Pelajar');
  
  // State Log Masuk
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // State Pendaftaran Ringkas
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // State Pengguna Semasa & Borang Lengkap
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // FUNGSI 1: LOG MASUK (SUPABASE AUTH & PROFILES)
  // =========================================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      if (profileData) {
        setCurrentUser(profileData);
        if (!profileData.is_profile_complete) {
          setFormData(profileData); 
          setView('complete-profile');
        } else {
          const rolePath = profileData.role === 'Waris' ? 'ibubapa' : profileData.role.toLowerCase();
          router.push(`/${rolePath}/dashboard`);
        }
      } else {
        setCurrentUser({ id: authData.user.id, email: authData.user.email, role: 'Pelajar' });
        setView('complete-profile');
      }

    } catch (error: any) {
      alert(`Log Masuk Gagal: ${error.message || 'E-mel atau kata laluan tidak sah.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // FUNGSI 2: PENDAFTARAN RINGKAS (SUPABASE AUTH & PROFILES)
  // =========================================================================
  const handleSimpleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      alert('Ralat: Kata laluan dan pengesahan kata laluan tidak sepadan!');
      return;
    }

    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: authData.user.id,
              full_name: regName.trim(),
              email: regEmail.trim(),
              role: selectedRole,
              is_profile_complete: false
            },
            { onConflict: 'id' }
          );

        if (profileError) throw profileError;
      }

      alert('Pendaftaran berjaya! Sila log masuk untuk melengkapkan maklumat profil anda.');
      
      setRegName(''); setRegEmail(''); setRegPassword(''); setRegConfirmPassword('');
      setEmail(regEmail.trim()); 
      setPassword('');
      setView('login');
    } catch (error: any) {
      alert(`Pendaftaran Gagal: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // FUNGSI 3: KEMASKINI PROFIL LENGKAP KE SUPABASE & AUTO-REDIRECT
  // =========================================================================
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsLoading(true);

    try {
      const dataToUpdate = {
        ...formData,
        is_profile_complete: true
      };

      const { error } = await supabase
        .from('profiles')
        .update(dataToUpdate)
        .eq('id', currentUser.id);

      if (error) throw error;

      const userRole = currentUser.role || formData.role || 'Pelajar';
      const rolePath = userRole === 'Waris' ? 'ibubapa' : userRole.toLowerCase();
      router.push(`/${rolePath}/dashboard`);

    } catch (error: any) {
      alert(`Ralat menyimpan profil ke pangkalan data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelCompleteProfile = async () => {
    if (confirm("Adakah anda ingin membatalkan proses melengkapkan profil? Anda akan didaftar keluar.")) {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setFormData({});
      setView('login');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      alert(`Pautan pemulihan kata laluan telah dihantar ke e-mel: ${email}. Sila semak peti masuk anda.`);
      setView('login');
    } catch (error: any) {
      alert(`Ralat: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH; 
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setFormData({ ...formData, avatar_url: compressedDataUrl });
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFormData({ ...formData, certificate_docs: file.name });
  };

  return (
    <div className="login-page-wrapper">
      
      {/* KAD UTAMA LOG MASUK */}
      <div className="login-main-card">
        
        {/* PANEL KIRI: BRANDING */}
        <div className="login-brand-panel">
          <div className="brand-bg-pattern"></div>

          <h2 className="brand-title">HUFFAZ PRO</h2>

          <div className="brand-center-icon">
            <div className="brand-icon-glow"></div>
            <BookOpen size={180} color="#ffffff" strokeWidth={1} className="brand-book-icon" />
          </div>

          <div className="brand-footer-text">
            <h3 style={{ fontSize: '1.4rem', color: '#ffffff', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Sistem Pengurusan Pintar</h3>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5, maxWidth: '90%' }}>
              Alami revolusi pengurusan maahad dengan integrasi data menyeluruh, pemantauan prestasi masa nyata, dan automasi pentadbiran.
            </p>
          </div>
        </div>

        {/* PANEL KANAN: BORANG */}
        <div className="login-form-panel">
          
          {/* VIEW: LOG MASUK */}
          {view === 'login' && (
            <div style={{ margin: 'auto 0' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <ShieldCheck size={24} color="#0f172a" />
              </div>
              
              <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>Selamat Kembali</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 1.75rem 0' }}>Log masuk untuk mengakses portal rasmi anda</p>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.45rem' }}>E-mel Pengguna</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="email" 
                      placeholder="anda@contoh.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.45rem' }}>Kata Laluan</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.85rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none', letterSpacing: showPassword ? 'normal' : '2px', boxSizing: 'border-box' }} 
                    />
                    <div onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }}>
                      {showPassword ? <Eye size={18} color="#94a3b8"/> : <EyeOff size={18} color="#94a3b8"/>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}>
                    <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} style={{ accentColor: '#c026d3', width: '16px', height: '16px' }} />
                    Ingat saya
                  </label>
                  <button type="button" onClick={() => setView('forgot-password')} style={{ background: 'none', border: 'none', fontSize: '0.8rem', color: '#475569', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Lupa Kata Laluan?</button>
                </div>

                <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.95rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(to right, #d946ef, #a855f7)', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Log Masuk'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                  Belum mempunyai akaun? <span onClick={() => setView('register-role')} style={{ color: '#a855f7', fontWeight: 700, cursor: 'pointer' }}>Daftar Akaun Baru</span>
                </p>
              </div>
            </div>
          )}

          {/* VIEW: LUPA KATA LALUAN */}
          {view === 'forgot-password' && (
            <div style={{ margin: 'auto 0' }}>
              <button onClick={() => setView('login')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.88rem', fontWeight: 600, padding: 0 }}>
                <ChevronLeft size={18}/> Kembali
              </button>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <KeyRound size={24} color="#dc2626" />
              </div>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>Lupa Kata Laluan?</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 1.75rem 0', lineHeight: '1.5' }}>Masukkan alamat e-mel anda untuk menerima pautan pemulihan.</p>

              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.45rem' }}>E-mel Berdaftar</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="email" placeholder="anda@contoh.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                      style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} 
                    />
                  </div>
                </div>
                <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.95rem', borderRadius: '12px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Hantar Pautan Pemulihan</>}
                </button>
              </form>
            </div>
          )}

          {/* VIEW: PILIH KATEGORI PENDAFTARAN */}
          {view === 'register-role' && (
            <div style={{ margin: 'auto 0' }}>
              <button onClick={() => setView('login')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.88rem', fontWeight: 600, padding: 0 }}>
                <ChevronLeft size={18}/> Batal
              </button>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>Pilih Kategori Anda</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 1.5rem 0' }}>Pilih peranan untuk mendaftar ke dalam sistem.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div onClick={() => { setSelectedRole('Pelajar'); setView('register-simple'); }} style={{ border: '2px solid #e2e8f0', background: '#fff', borderRadius: '14px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '10px', color: '#0062ff' }}><BookOpen size={22}/></div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.15rem 0', color: '#0f172a', fontSize: '1.05rem' }}>Pelajar</h3>
                  </div>
                  <ArrowRight size={18} color="#cbd5e1"/>
                </div>

                <div onClick={() => { setSelectedRole('Waris'); setView('register-simple'); }} style={{ border: '2px solid #e2e8f0', background: '#fff', borderRadius: '14px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ background: '#fef3c7', padding: '0.85rem', borderRadius: '10px', color: '#d97706' }}><Users size={22}/></div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.15rem 0', color: '#0f172a', fontSize: '1.05rem' }}>Ibu Bapa / Waris</h3>
                  </div>
                  <ArrowRight size={18} color="#cbd5e1"/>
                </div>

                <div onClick={() => { setSelectedRole('Guru'); setView('register-simple'); }} style={{ border: '2px solid #e2e8f0', background: '#fff', borderRadius: '14px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <div style={{ background: '#ecfdf5', padding: '0.85rem', borderRadius: '10px', color: '#059669' }}><GraduationCap size={22}/></div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 0.15rem 0', color: '#0f172a', fontSize: '1.05rem' }}>Guru / Staf</h3>
                  </div>
                  <ArrowRight size={18} color="#cbd5e1"/>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: PENDAFTARAN ASAS */}
          {view === 'register-simple' && (
            <div style={{ margin: 'auto 0' }}>
              <button onClick={() => setView('register-role')} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.88rem', fontWeight: 600, padding: 0 }}>
                <ChevronLeft size={18}/> Kembali
              </button>
              
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>Daftar Akaun {selectedRole}</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 1.5rem 0' }}>Sila cipta maklumat log masuk anda terlebih dahulu.</p>

              <form onSubmit={handleSimpleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.45rem' }}>Nama Penuh</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" placeholder="Nama penuh mengikut MyKad" value={regName} onChange={(e) => setRegName(e.target.value)} required style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.45rem' }}>E-mel</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="email" placeholder="anda@contoh.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div className="responsive-grid-2">
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.45rem' }}>Kata Laluan Baru</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input type="password" placeholder="••••••••" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.45rem' }}>Sahkan Kata Laluan</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                      <input type="password" placeholder="••••••••" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.9rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.95rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(to right, #d946ef, #a855f7)', color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Daftar Akaun'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* =========================================================================
          MODAL TIMBUL (POPUP) TENGAH SKRIN: LENGKAPKAN MAKLUMAT PENGGUNA
      ========================================================================= */}
      {view === 'complete-profile' && currentUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          
          <div className="profile-modal-box">
            
            {/* TAJUK MODAL */}
            <div style={{
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid #eef2f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#ffffff'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={19} color="#7c3aed" strokeWidth={3} />
                Pendaftaran {currentUser.role} Baharu
              </h3>
              <button 
                type="button" 
                onClick={handleCancelCompleteProfile}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* KANDUNGAN BORANG MODAL */}
            <form onSubmit={handleCompleteProfile} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              
              <div className="profile-modal-body">
                
                {/* 1. BORANG PELAJAR */}
                {currentUser.role === 'Pelajar' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    
                    {/* AVATAR PELAJAR */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 0.5rem auto' }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#f8fafc', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', fontWeight: 800, overflow: 'hidden', border: '3px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.06)' }}>
                          {formData.avatar_url ? <img src={formData.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : (formData.full_name ? formData.full_name.charAt(0).toUpperCase() : 'P')}
                        </div>
                        <div onClick={() => avatarInputRef.current?.click()} style={{ position: 'absolute', bottom: '0px', right: '0px', background: '#7c3aed', color: '#fff', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                          <Camera size={14} />
                        </div>
                        <input type="file" ref={avatarInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Klik ikon kamera untuk memuat naik gambar (maks 5MB)</p>
                    </div>

                    {/* MAKLUMAT ASAS PELAJAR */}
                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 800 }}>
                        <User size={17} color="#7c3aed" /> Maklumat Pelajar
                      </h4>
                      <div className="responsive-grid-2">
                        <div><label style={labelStyle}>Nama Penuh *</label><input type="text" placeholder="cth. Ahmad bin Ali" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} required style={inputStyle} /></div>
                        <div><label style={labelStyle}>No. MyKad/Pasport *</label><input type="text" placeholder="990101-14-1234 atau pasport" value={formData.matrik_or_id || ''} onChange={e => setFormData({...formData, matrik_or_id: e.target.value})} required style={inputStyle} /></div>

                        <div><label style={labelStyle}>Jantina *</label><select value={formData.gender || ''} onChange={e => setFormData({...formData, gender: e.target.value})} style={inputStyle} required><option value="">Pilih Jantina</option><option value="Lelaki">Lelaki</option><option value="Perempuan">Perempuan</option></select></div>
                        <div className="responsive-sub-grid">
                          <div><label style={labelStyle}>Tarikh Lahir</label><input type="date" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})} style={inputStyle} /></div>
                          <div><label style={labelStyle}>Tempat Lahir</label><input type="text" placeholder="cth. Kuala Lumpur" value={formData.pob || ''} onChange={e => setFormData({...formData, pob: e.target.value})} style={inputStyle} /></div>
                        </div>

                        <div><label style={labelStyle}>Negeri Kelahiran</label><input type="text" placeholder="Pilih negeri" value={formData.state_of_birth || ''} onChange={e => setFormData({...formData, state_of_birth: e.target.value})} style={inputStyle} /></div>
                        <div className="responsive-sub-grid">
                          <div><label style={labelStyle}>Negara Kelahiran</label><input type="text" placeholder="Pilih negara" value={formData.country_of_birth || ''} onChange={e => setFormData({...formData, country_of_birth: e.target.value})} style={inputStyle} /></div>
                          <div><label style={labelStyle}>Kewarganegaraan</label><input type="text" placeholder="cth. Warganegara" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} style={inputStyle} /></div>
                        </div>

                        <div><label style={labelStyle}>Bangsa</label><input type="text" placeholder="Pilih bangsa" value={formData.race || ''} onChange={e => setFormData({...formData, race: e.target.value})} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Status Kewarganegaraan</label><select value={formData.citizenship_status || ''} onChange={e => setFormData({...formData, citizenship_status: e.target.value})} style={inputStyle}><option value="">Pilih status</option><option value="Warganegara">Warganegara</option><option value="Bukan Warganegara">Bukan Warganegara</option></select></div>

                        <div className="full-col"><label style={labelStyle}>Alamat Tempat Tinggal</label><textarea placeholder="Alamat penuh tempat tinggal" rows={2} value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>

                        <div><label style={labelStyle}>Poskod</label><input type="text" placeholder="cth. 50000" value={formData.postcode || ''} onChange={e => setFormData({...formData, postcode: e.target.value})} style={inputStyle} /></div>
                        <div className="responsive-sub-grid">
                          <div><label style={labelStyle}>Bandar</label><input type="text" placeholder="cth. Kuala Lumpur" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} style={inputStyle} /></div>
                          <div><label style={labelStyle}>Negeri</label><input type="text" placeholder="Pilih negeri" value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})} style={inputStyle} /></div>
                        </div>

                        <div><label style={labelStyle}>No. Telefon Pelajar *</label><input type="text" placeholder="cth. +60123456789" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} required style={inputStyle} /></div>
                        <div><label style={labelStyle}>E-mel Pelajar (Log Masuk)</label><input type="email" value={formData.email || ''} readOnly style={{...inputStyle, background: '#f8fafc', color: '#64748b'}} /></div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />

                    {/* MAKLUMAT KESIHATAN */}
                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 800 }}>
                        <ShieldCheck size={17} color="#7c3aed" /> Maklumat Kesihatan
                      </h4>
                      <div className="responsive-grid-2">
                        <div className="full-col"><label style={labelStyle}>Keadaan Kesihatan Umum</label><input type="text" placeholder="Pilih keadaan kesihatan" value={formData.health_status || ''} onChange={e => setFormData({...formData, health_status: e.target.value})} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Alahan yang Diketahui</label><textarea placeholder="cth. Alahan kacang, debu..." rows={2} value={formData.allergies || ''} onChange={e => setFormData({...formData, allergies: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                        <div><label style={labelStyle}>Keperluan Pemakanan Khas</label><textarea placeholder="cth. Vegetarian, tiada makanan pedas..." rows={2} value={formData.dietary_needs || ''} onChange={e => setFormData({...formData, dietary_needs: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                        <div><label style={labelStyle}>Keperluan Bantuan Pembelajaran</label><textarea placeholder="cth. Memerlukan alat bantuan..." rows={2} value={formData.learning_aids || ''} onChange={e => setFormData({...formData, learning_aids: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                        <div><label style={labelStyle}>Ubat Kecemasan</label><textarea placeholder="Ubat yang perlu diketahui oleh pihak maahad" rows={2} value={formData.emergency_meds || ''} onChange={e => setFormData({...formData, emergency_meds: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                      </div>
                    </div>

                  </div>
                )}

                {/* 2. BORANG GURU */}
                {currentUser.role === 'Guru' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 800 }}>
                      <UserCheck size={17} color="#7c3aed" /> Borang Maklumat Guru
                    </h4>
                    
                    <div className="responsive-grid-2">
                      <div><label style={labelStyle}>Nama Penuh *</label><input type="text" placeholder="Nama Penuh" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} required style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. MyKad/Pasport *</label><input type="text" placeholder="No. MyKad/Pasport" value={formData.matrik_or_id || ''} onChange={e => setFormData({...formData, matrik_or_id: e.target.value})} required style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Status Perkahwinan</label><select value={formData.marital_status || ''} onChange={e => setFormData({...formData, marital_status: e.target.value})} style={inputStyle}><option value="">Pilih status</option><option value="Bujang">Bujang</option><option value="Berkahwin">Berkahwin</option></select></div>
                      <div><label style={labelStyle}>Tarikh Lahir</label><input type="date" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Kewarganegaraan</label><input type="text" placeholder="Pilih kewarganegaraan" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Emel (Wajib untuk Log Masuk)</label><input type="email" value={formData.email || ''} readOnly style={{...inputStyle, background: '#f8fafc', color: '#64748b'}} /></div>
                      
                      <div><label style={labelStyle}>Kelulusan Akademik Tertinggi</label><input type="text" placeholder="Cth: Ijazah Sarjana Muda" value={formData.highest_education || ''} onChange={e => setFormData({...formData, highest_education: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Bidang Pengkhususan</label><input type="text" placeholder="Cth: Usuluddin & Tafsir" value={formData.specialization || ''} onChange={e => setFormData({...formData, specialization: e.target.value})} style={inputStyle} /></div>
                      
                      <div className="full-col"><label style={labelStyle}>Alamat</label><textarea placeholder="Alamat penuh tempat tinggal" rows={2} value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                      
                      <div><label style={labelStyle}>No. telefon *</label><input type="text" placeholder="No. telefon" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} required style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. telefon pejabat</label><input type="text" placeholder="No. telefon pejabat" value={formData.office_contact || ''} onChange={e => setFormData({...formData, office_contact: e.target.value})} style={inputStyle} /></div>
                    </div>

                    <div onClick={() => certInputRef.current?.click()} style={{ marginTop: '0.75rem', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem 1rem', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }}>
                      <FileText size={28} color={formData.certificate_docs ? '#059669' : '#94a3b8'} style={{ margin: '0 auto 0.5rem auto' }} />
                      <p style={{ margin: 0, fontSize: '0.85rem', color: formData.certificate_docs ? '#059669' : '#475569', textDecorationLine: formData.certificate_docs ? 'none' : 'underline', textDecorationColor: '#ef4444', fontWeight: formData.certificate_docs ? 700 : 500 }}>
                        {formData.certificate_docs ? `Fail Tersimpan: ${formData.certificate_docs}` : 'Muatnaik sijil/dokumen akademik'}
                      </p>
                    </div>
                    <input type="file" ref={certInputRef} accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }} onChange={handleCertUpload} />
                  </div>
                )}

                {/* 3. BORANG WARIS */}
                {currentUser.role === 'Waris' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 800 }}>
                      <Users size={17} color="#7c3aed" /> Maklumat Bapa / Penjaga
                    </h4>
                    
                    <div className="responsive-grid-2">
                      <div><label style={labelStyle}>Nama Penuh *</label><input type="text" placeholder="Nama Penuh" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} required style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. MyKad/Pasport *</label><input type="text" placeholder="No. MyKad/Pasport" value={formData.matrik_or_id || ''} onChange={e => setFormData({...formData, matrik_or_id: e.target.value})} required style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Hubungan dengan pelajar</label><input type="text" placeholder="Cth: Bapa/Ibu" value={formData.relationship || ''} onChange={e => setFormData({...formData, relationship: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Tarikh Lahir</label><input type="date" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Kewarganegaraan</label><input type="text" placeholder="Pilih kewarganegaraan" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Pekerjaan</label><input type="text" placeholder="Pekerjaan" value={formData.occupation || ''} onChange={e => setFormData({...formData, occupation: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Jawatan</label><input type="text" placeholder="Jawatan" value={formData.job_title || ''} onChange={e => setFormData({...formData, job_title: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Nama majikan/organisasi</label><input type="text" placeholder="Nama majikan/organisasi" value={formData.employer || ''} onChange={e => setFormData({...formData, employer: e.target.value})} style={inputStyle} /></div>
                      
                      <div className="full-col"><label style={labelStyle}>Alamat tempat kerja</label><textarea placeholder="Alamat tempat kerja" rows={2} value={formData.work_address || ''} onChange={e => setFormData({...formData, work_address: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                      
                      <div><label style={labelStyle}>No. telefon *</label><input type="text" placeholder="No. telefon" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} required style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. telefon pejabat</label><input type="text" placeholder="No. telefon pejabat" value={formData.office_contact || ''} onChange={e => setFormData({...formData, office_contact: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>E-mel</label><input type="email" value={formData.email || ''} readOnly style={{...inputStyle, background: '#f8fafc', color: '#64748b'}} /></div>
                      <div><label style={labelStyle}>Pendapatan bulanan</label><select value={formData.income || ''} onChange={e => setFormData({...formData, income: e.target.value})} style={inputStyle}><option value="">Pilih julat pendapatan</option><option value="B40">B40 (Bawah RM4,850)</option><option value="M40">M40 (RM4,851 - RM10,959)</option><option value="T20">T20 (Lebih RM10,960)</option></select></div>
                    </div>
                  </div>
                )}

              </div>

              {/* KAKI BORANG MODAL */}
              <div className="profile-modal-footer">
                <button 
                  type="button" 
                  onClick={handleCancelCompleteProfile}
                  className="modal-btn-cancel"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="modal-btn-submit"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={17} /> : <FileText size={17} />}
                  Simpan Data Pengguna
                </button>
              </div>

            </form>

          </div>

        </div>
      )}

      {/* STYLES RESPONSIVE MUDAH ALIH & TABLET */}
      <style jsx global>{`
        .login-page-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f5f3ff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 100 100'%3E%3Cg stroke='%23a855f7' stroke-width='1.5' fill='none' opacity='0.05'%3E%3Crect x='25' y='25' width='50' height='50' /%3E%3Crect x='25' y='25' width='50' height='50' transform='rotate(45 50 50)' /%3E%3Ccircle cx='50' cy='50' r='10' /%3E%3C/g%3E%3C/svg%3E");
          padding: 2rem;
          font-family: 'Inter', sans-serif;
          position: relative;
        }

        .login-main-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border-radius: 32px;
          padding: 1rem;
          width: 100%;
          max-width: 1100px;
          display: flex;
          gap: 1rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.8);
          min-height: 650px;
        }

        .login-brand-panel {
          flex: 1;
          background: linear-gradient(135deg, #c084fc 0%, #818cf8 100%);
          border-radius: 24px;
          padding: 3.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.05);
        }

        .brand-bg-pattern {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 100 100'%3E%3Cg stroke='%23ffffff' stroke-width='1' fill='none' opacity='0.08'%3E%3Cpolygon points='50,5 95,50 50,95 5,50' /%3E%3Cpolygon points='20,20 80,20 80,80 20,80' /%3E%3Ccircle cx='50' cy='50' r='15' /%3E%3C/g%3E%3C/svg%3E");
          background-size: 120px 120px;
        }

        .brand-title {
          font-size: 2.8rem;
          color: rgba(255, 255, 255, 0.95);
          fontWeight: 800;
          margin: 0;
          z-index: 10;
          letter-spacing: 2px;
          line-height: 1.1;
        }

        .brand-center-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .brand-icon-glow {
          position: absolute;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 70%);
          filter: blur(25px);
          z-index: -1;
        }

        .brand-book-icon {
          filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.4));
        }

        .brand-footer-text {
          z-index: 10;
        }

        .login-form-panel {
          flex: 1;
          background: transparent;
          border-radius: 24px;
          padding: 3rem 3.5rem;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow-y: auto;
        }

        .responsive-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.15rem;
        }

        .responsive-sub-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .full-col {
          grid-column: 1 / -1;
        }

        .profile-modal-box {
          background-color: #ffffff;
          border-radius: 24px;
          width: 100%;
          max-width: 850px;
          max-height: 92vh;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.2);
          animation: modalSlideUp 0.25s ease-out;
        }

        .profile-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 2rem;
        }

        .profile-modal-footer {
          padding: 1.25rem 2rem;
          border-top: 1px solid #eef2f6;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1rem;
          background-color: #ffffff;
        }

        .modal-btn-cancel {
          padding: 0.75rem 1.75rem;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
        }

        .modal-btn-submit {
          padding: 0.75rem 1.75rem;
          border-radius: 10px;
          border: none;
          background: #7c3aed;
          color: #ffffff;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
        }

        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ==============================================================
           TABLET RESPONSIVE (Skrin < 1024px)
        ============================================================== */
        @media (max-width: 1023px) {
          .login-page-wrapper {
            padding: 1.25rem;
          }
          .login-brand-panel {
            padding: 2.25rem;
          }
          .brand-title {
            font-size: 2.2rem;
          }
          .brand-book-icon {
            width: 130px !important;
            height: 130px !important;
          }
          .login-form-panel {
            padding: 2rem 2.25rem;
          }
        }

        /* ==============================================================
           SMARTPHONE RESPONSIVE (Skrin < 768px)
        ============================================================== */
        @media (max-width: 767px) {
          .login-page-wrapper {
            padding: 0.75rem;
            align-items: flex-start;
          }
          .login-main-card {
            flex-direction: column !important;
            min-height: auto !important;
            border-radius: 20px !important;
            padding: 0.5rem !important;
            gap: 0 !important;
          }
          .login-brand-panel {
            border-radius: 16px 16px 0 0 !important;
            padding: 1.75rem 1.25rem !important;
            min-height: auto !important;
            text-align: center;
            align-items: center;
          }
          .brand-title {
            font-size: 1.8rem !important;
          }
          .brand-center-icon {
            display: none !important; /* Jimatkan ruang skrin telefon */
          }
          .brand-footer-text {
            display: none !important; /* Jimatkan ruang skrin telefon */
          }
          .login-form-panel {
            padding: 1.75rem 1.25rem !important;
          }
          .responsive-grid-2 {
            grid-template-columns: 1fr !important;
            gap: 0.9rem !important;
          }
          .responsive-sub-grid {
            grid-template-columns: 1fr !important;
            gap: 0.9rem !important;
          }
          .profile-modal-box {
            max-height: 94vh !important;
            border-radius: 16px !important;
          }
          .profile-modal-body {
            padding: 1.25rem 1rem !important;
          }
          .profile-modal-footer {
            padding: 1rem !important;
            flex-direction: column-reverse;
            gap: 0.6rem;
          }
          .modal-btn-cancel, .modal-btn-submit {
            width: 100% !important;
            justify-content: center !important;
            padding: 0.85rem !important;
          }
        }
      `}</style>
    </div>
  );
}

const labelStyle = { 
  display: 'block', 
  fontSize: '0.8rem', 
  fontWeight: 700, 
  color: '#0f172a', 
  margin: '0 0 0.45rem 0' 
};

const inputStyle = { 
  width: '100%', 
  padding: '0.75rem 1rem', 
  borderRadius: '10px', 
  border: '1px solid #cbd5e1', 
  background: '#ffffff', 
  fontSize: '0.88rem', 
  color: '#0f172a', 
  outline: 'none',
  boxSizing: 'border-box' as const
};