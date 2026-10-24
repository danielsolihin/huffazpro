'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  Video, 
  BrainCircuit, 
  BookOpenText, 
  Highlighter, 
  BellRing, 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  LogOut, 
  Menu, 
  Bell, 
  MessageSquareWarning, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Mail, 
  Phone, 
  GraduationCap, 
  X,
  PhoneCall,
  CalendarCheck
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
}

const formatTimeAMPM = (timeInput: any): string => {
  if (!timeInput || timeInput === '-') return '-';

  if (typeof timeInput === 'string') {
    let clean = timeInput
      .replace(/PETANG|PTG|MALAM|MLM/gi, 'PM')
      .replace(/PAGI|PG/gi, 'AM')
      .trim();

    if (/AM|PM/i.test(clean)) {
      return clean;
    }

    if (clean.includes('T') || clean.length > 12) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }

    if (clean.includes(':')) {
      const parts = clean.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      if (!isNaN(h)) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
      }
    }

    return clean;
  }

  const d = new Date(timeInput);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return String(timeInput);
};

export default function DashboardLayout({ children, userName = 'Pelajar', userRole = 'Pelajar' }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [isInfoMindaOpen, setIsInfoMindaOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // STATE DINAMIK DARI SUPABASE & PROFIL
  const [currentUserName, setCurrentUserName] = useState(userName);
  const [globalAvatar, setGlobalAvatar] = useState('');
  const [teacherName, setTeacherName] = useState('Memuatkan...');
  const [teacherAvatar, setTeacherAvatar] = useState('');
  const [checkInTime, setCheckInTime] = useState('-');
  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  // STATE MODAL MAKLUMAT GURU
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherDetails, setTeacherDetails] = useState({
    email: '-',
    phone: '-',
    kelulusan: '-'
  });

  // STATE PANGGILAN LIVE MASUK DARI GURU
  const [incomingCall, setIncomingCall] = useState<any>(null);

  const fetchGlobalData = async () => {
    const savedLocal = localStorage.getItem('huffazpro_student_profile');
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        if (parsed.avatarUrl) setGlobalAvatar(parsed.avatarUrl);
        if (parsed.nama) setCurrentUserName(parsed.nama);
      } catch (e) {}
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const userId = authData.user.id;

      // 1. Dapatkan Profil Pelajar
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('avatar_url, full_name, class_id')
        .eq('id', userId)
        .single();

      if (myProfile?.avatar_url) {
        setGlobalAvatar(myProfile.avatar_url);
      }
      if (myProfile?.full_name) {
        setCurrentUserName(myProfile.full_name);
      }

      // 2. Dapatkan Guru Tasmik
      if (myProfile?.class_id) {
        const { data: classData } = await supabase
          .from('classes')
          .select('teacher_name')
          .eq('id', myProfile.class_id)
          .single();

        if (classData?.teacher_name) {
          setTeacherName(classData.teacher_name);

          const { data: guruProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('full_name', classData.teacher_name)
            .limit(1)
            .single();

          if (guruProfile) {
            setTeacherAvatar(guruProfile.avatar_url || '');
            setTeacherDetails({
              email: guruProfile.email || '-',
              phone: guruProfile.phone || '-',
              kelulusan: guruProfile.highest_education || '-'
            });
          } else {
            setTeacherAvatar('');
            setTeacherDetails({ email: '-', phone: '-', kelulusan: '-' });
          }

        } else {
          setTeacherName('Belum Ditetapkan');
        }
      } else {
        setTeacherName('Tiada Kelas');
      }

      // 3. Notifikasi Murajaah
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .neq('type', 'live_call')
        .order('created_at', { ascending: false });

      if (notifs) {
        setNotifications(notifs);
        setNotifCount(notifs.length);
      }

      // 4. Masa Kehadiran
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayLocale = now.toLocaleDateString('ms-MY');

      const { data: attendance } = await supabase
        .from('attendance')
        .select('time_in, created_at')
        .eq('user_id', userId)
        .or(`date.eq.${todayIso},date.eq.${todayLocale}`)
        .maybeSingle();

      if (attendance?.time_in) {
        setCheckInTime(formatTimeAMPM(attendance.time_in));
      } else if (attendance?.created_at) {
        setCheckInTime(formatTimeAMPM(attendance.created_at));
      } else {
        const nowTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setCheckInTime(nowTime);
      }

    } catch (error) {
      console.error('Ralat menarik data layout:', error);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchGlobalData();

    const handleSyncAvatar = () => {
      fetchGlobalData();
    };

    window.addEventListener('storage', handleSyncAvatar);
    window.addEventListener('avatarUpdated', handleSyncAvatar);

    return () => {
      window.removeEventListener('storage', handleSyncAvatar);
      window.removeEventListener('avatarUpdated', handleSyncAvatar);
    };
  }, []);

  // SEMAKAN PANGGILAN LIVE DARI GURU
  useEffect(() => {
    if (!mounted) return;
    let pollCallInterval: NodeJS.Timeout;

    const checkIncomingLiveCall = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;
        const userId = authData.user.id;

        const { data: callNotifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('is_read', false)
          .eq('type', 'live_call')
          .order('created_at', { ascending: false })
          .limit(1);

        if (callNotifs && callNotifs.length > 0) {
          const call = callNotifs[0];
          const callAgeMs = Date.now() - new Date(call.created_at).getTime();
          if (callAgeMs < 10 * 60 * 1000) {
            setIncomingCall(call);
          } else {
            setIncomingCall(null);
          }
        } else {
          setIncomingCall(null);
        }
      } catch (err) {
        console.error('Ralat menyemak panggilan masuk:', err);
      }
    };

    checkIncomingLiveCall();
    pollCallInterval = setInterval(checkIncomingLiveCall, 3000);

    return () => clearInterval(pollCallInterval);
  }, [mounted]);

  const handleAnswerCall = async () => {
    if (!incomingCall) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', incomingCall.id);

      setIncomingCall(null);
      router.push('/pelajar/tasmik-live');
    } catch {
      router.push('/pelajar/tasmik-live');
    }
  };

  const handleDismissCall = async () => {
    if (!incomingCall) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', incomingCall.id);

      setIncomingCall(null);
    } catch {
      setIncomingCall(null);
    }
  };

  useEffect(() => {
    if (pathname.includes('/info-minda')) setIsInfoMindaOpen(true);
    else setIsInfoMindaOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path: string) => pathname === path;
  const isInfoMindaActive = pathname.includes('/info-minda');

  const handleConfirmLogout = async () => {
    await supabase.auth.signOut();
    setShowLogoutModal(false);
    router.push('/');
  };

  if (!mounted) {
    return <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}></div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', position: 'relative' }}>
      
      {/* LAPISAN KABUR (BACKDROP) KETIKA MENU LACI DIBUKA DI TELEFON & TABLET */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-backdrop no-print"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* BAR SISI (DESKTOP KEKAL, TABLET/MOBILE SLIDE-OVER DRAWER) */}
      <aside className={`sidebar no-print ${isMobileMenuOpen ? 'open' : ''}`}>
        
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#0062ff', color: 'white', padding: '0.45rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpenText size={20} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>HuffazPro</h2>
          </div>
          <button 
            type="button" 
            className="mobile-close-btn"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Tutup Menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <Link href="/pelajar/dashboard" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/pelajar/dashboard') ? '#eff6ff' : 'transparent', color: isActive('/pelajar/dashboard') ? '#0062ff' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
              <LayoutDashboard size={20} /> <span style={{ fontSize: '0.9rem' }}>Dashboard Utama</span>
            </div>
          </Link>

          <Link href="/pelajar/tasmik-live" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/pelajar/tasmik-live') ? '#eff6ff' : 'transparent', color: isActive('/pelajar/tasmik-live') ? '#0062ff' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
              <Video size={20} /> <span style={{ fontSize: '0.9rem' }}>Bilik Tasmik</span>
            </div>
          </Link>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem', marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            
            <Link href="/pelajar/notifikasi-murajaah" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/pelajar/notifikasi-murajaah') ? '#eff6ff' : 'transparent', color: isActive('/pelajar/notifikasi-murajaah') ? '#0062ff' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <BellRing size={20} /> <span style={{ fontSize: '0.9rem' }}>Notifikasi Murajaah</span>
                </div>
                
                {notifCount > 0 && (
                  <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: '10px' }}>
                    {notifCount}
                  </span>
                )}
              </div>
            </Link>

            <Link href="/pelajar/permohonan-cuti" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/pelajar/permohonan-cuti') ? '#eff6ff' : 'transparent', color: isActive('/pelajar/permohonan-cuti') ? '#0062ff' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
                <CalendarCheck size={20} /> <span style={{ fontSize: '0.9rem' }}>Permohonan Cuti</span>
              </div>
            </Link>

            <div style={{ marginTop: '0.35rem', marginBottom: '0.35rem' }}>
              <button 
                type="button"
                onClick={() => setIsInfoMindaOpen(!isInfoMindaOpen)} 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isInfoMindaActive ? '#fefce8' : 'transparent', color: isInfoMindaActive ? '#8b5cf6' : '#64748b', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', fontFamily: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <BrainCircuit size={20} /> <span style={{ fontSize: '0.9rem' }}>Info Minda</span>
                </div>
                {isInfoMindaOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {isInfoMindaOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.4rem', marginLeft: '1.2rem', paddingLeft: '0.8rem', borderLeft: '2px solid #e2e8f0' }}>
                  <Link href="/pelajar/info-minda/tafsir" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderRadius: '8px', backgroundColor: isActive('/pelajar/info-minda/tafsir') ? '#f3e8ff' : 'transparent', color: isActive('/pelajar/info-minda/tafsir') ? '#8b5cf6' : '#64748b', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>
                      <BookOpenText size={16} /> Tafsir al-Quran
                    </div>
                  </Link>
                  <Link href="/pelajar/info-minda/tajwid" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderRadius: '8px', backgroundColor: isActive('/pelajar/info-minda/tajwid') ? '#f3e8ff' : 'transparent', color: isActive('/pelajar/info-minda/tajwid') ? '#8b5cf6' : '#64748b', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>
                      <Highlighter size={16} /> Hukum Tajwid
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <Link href="/pelajar/tetapan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/pelajar/tetapan') ? '#eff6ff' : 'transparent', color: isActive('/pelajar/tetapan') ? '#0062ff' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
                <Settings size={20} /> <span style={{ fontSize: '0.9rem' }}>Tetapan Global</span>
              </div>
            </Link>
          </div>
        </nav>

        {/* PROFIL BAHAGIAN BAWAH SIDEBAR */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden' }}>
              {globalAvatar ? (
                <img src={globalAvatar} alt={currentUserName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                currentUserName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{currentUserName}</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'capitalize' }}>{userRole}</p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={() => setShowLogoutModal(true)}
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'pointer', padding: '0.45rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} 
            title="Log Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* KAWASAN KANDUNGAN UTAMA */}
      <main className="main-content-layout">
        
        {/* HEADER ATAS */}
        <header className="top-header no-print">
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'nowrap' }}>
            <button 
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Buka Menu"
            >
              <Menu size={20} />
            </button>

            <div className="badge-sesi-desktop" style={{ backgroundColor: '#eff6ff', color: '#0062ff', padding: '0.35rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              <CheckCircle2 size={13} /> Sesi Pelajar Aktif
            </div>

            <div className="header-meta-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '2px solid #f1f5f9', paddingLeft: '0.85rem' }}>
              <span className="checkin-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#f8fafc', padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>
                <Clock size={12} color="#0062ff" /> Kehadiran: <strong style={{ color: '#0f172a' }}>{checkInTime}</strong>
              </span>

              <div 
                onClick={() => setShowTeacherModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#f8fafc', padding: '0.2rem 0.65rem 0.2rem 0.25rem', borderRadius: '20px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }}
                title="Klik untuk lihat maklumat Guru Tasmik"
              >
                {teacherAvatar ? (
                  <img src={teacherAvatar} alt={teacherName} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                    {teacherName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>Guru: <strong style={{ color: '#0f172a' }}>{teacherName}</strong></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button 
                type="button"
                className="topIconBtn" 
                title="Mesej Guru" 
                onClick={() => setIsNotifOpen(!isNotifOpen)} 
                style={{ backgroundColor: isNotifOpen ? '#eff6ff' : '#ffffff', borderColor: isNotifOpen ? '#0062ff' : '#e2e8f0', color: isNotifOpen ? '#0062ff' : '#64748b' }}
              >
                <Bell size={18} />
                {notifCount > 0 && <span className="notifIndicator" />}
              </button>

              {isNotifOpen && (
                <div className="notifDropdown">
                  <div className="notifHeader">
                    <strong>Mesej & Notifikasi</strong>
                    {notifCount > 0 && <span className="notifBadge">{notifCount} Baru</span>}
                  </div>
                  <div className="notifList">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div key={notif.id} className="notifItem unread">
                          <div className="notifIcon warning"><MessageSquareWarning size={14} /></div>
                          <div className="notifContent">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              <span className="notifSender">{notif.title}</span>
                              {notif.created_at && (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  {formatTimeAMPM(notif.created_at)}
                                </span>
                              )}
                            </div>
                            <p className="notifMsg">{notif.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>Tiada notifikasi baharu.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* FOTO PROFIL PENJURU KANAN HEADER */}
            <Link href="/pelajar/tetapan" title="Tetapan Akaun" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              {globalAvatar ? (
                <img src={globalAvatar} alt={currentUserName} className="topUserAvatar" />
              ) : (
                <div className="topUserAvatar" style={{ background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {currentUserName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
          </div>
        </header>

        {/* KAWASAN KANDUNGAN HALAMAN */}
        <div className="page-body-container">
          {children}
        </div>

        {/* ==============================================================
            BOTTOM NAVIGATION BAR (KHUSUS SMARTPHONE < 768px)
        ============================================================== */}
        <nav className="bottom-nav-bar no-print">
          <Link href="/pelajar/dashboard" className={`bottom-nav-item ${isActive('/pelajar/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={19} />
            <span>Utama</span>
          </Link>

          <Link href="/pelajar/tasmik-live" className={`bottom-nav-item ${isActive('/pelajar/tasmik-live') ? 'active' : ''}`}>
            <Video size={19} />
            <span>Tasmik</span>
          </Link>

          <Link href="/pelajar/notifikasi-murajaah" className={`bottom-nav-item ${isActive('/pelajar/notifikasi-murajaah') ? 'active' : ''}`} style={{ position: 'relative' }}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <BellRing size={19} />
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -6, width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
              )}
            </div>
            <span>Murajaah</span>
          </Link>

          <Link href="/pelajar/permohonan-cuti" className={`bottom-nav-item ${isActive('/pelajar/permohonan-cuti') ? 'active' : ''}`}>
            <CalendarCheck size={19} />
            <span>Cuti</span>
          </Link>

          <button 
            type="button" 
            className="bottom-nav-item" 
            onClick={() => setIsMobileMenuOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Menu size={19} />
            <span>Menu</span>
          </button>
        </nav>

      </main>

      {/* POP-UP PANGGILAN LIVE MASUK DARI GURU */}
      {incomingCall && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(5px)',
          padding: '1.25rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '420px',
            padding: '1.75rem 1.5rem',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '2px solid #3b82f6',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.15rem',
            animation: 'fadeInScale 0.25s ease-out'
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#0062ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 10px rgba(0, 98, 255, 0.15)',
              animation: 'ringPulse 1.2s infinite'
            }}>
              <Video size={32} />
            </div>

            <div>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.2rem 0.65rem',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Panggilan Live Masuk
              </span>
              <h2 style={{ margin: '0.5rem 0 0.2rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                {incomingCall.title || 'Sesi Tasmik Online'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                {incomingCall.message}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.35rem' }}>
              <button
                type="button"
                onClick={handleDismissCall}
                style={{
                  flex: 1,
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Abaikan
              </button>
              
              <button
                type="button"
                onClick={handleAnswerCall}
                style={{
                  flex: 2,
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)'
                }}
              >
                <PhoneCall size={16} /> Jawab Bilik
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MAKLUMAT GURU TASMIK */}
      {showTeacherModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem'
        }}>
          <div style={{ 
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '380px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)', overflow: 'hidden', animation: 'fadeInScale 0.2s ease-out'
          }}>
            <div style={{ padding: '1.15rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Profil Guru Tasmik</h3>
              <button 
                type="button" 
                onClick={() => setShowTeacherModal(false)} 
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              {teacherAvatar ? (
                <img src={teacherAvatar} alt={teacherName} style={{ width: '74px', height: '74px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #e2e8f0', marginBottom: '0.65rem' }} />
              ) : (
                <div style={{ width: '74px', height: '74px', borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 'bold', border: '3px solid #e2e8f0', marginBottom: '0.65rem' }}>
                  {teacherName.charAt(0).toUpperCase()}
                </div>
              )}
              <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{teacherName}</h4>
              <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#059669', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 700, marginBottom: '1.15rem' }}>
                Guru Tasmik
              </span>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem', textAlign: 'left', background: '#f8fafc', padding: '0.9rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Mail size={15} color="#0062ff" style={{ flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>E-mel</p>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{teacherDetails.email}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Phone size={15} color="#0062ff" style={{ flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>No. Telefon / WhatsApp</p>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{teacherDetails.phone}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <GraduationCap size={15} color="#0062ff" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>Kelulusan</p>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>{teacherDetails.kelulusan}</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setShowTeacherModal(false)} 
                style={{ padding: '0.45rem 1.15rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP PENGESAHAN LOG KELUAR */}
      {showLogoutModal && (
        <div className="no-print" style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem'
        }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)', overflow: 'hidden', animation: 'fadeInScale 0.2s ease-out' }}>
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem auto' }}>
                <AlertTriangle size={26} />
              </div>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Pengesahan Log Keluar</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                Adakah anda pasti mahu mendaftar keluar dari Portal Pelajar?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', padding: '0.9rem 1.25rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button 
                type="button" 
                onClick={() => setShowLogoutModal(false)} 
                style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={handleConfirmLogout} 
                style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Log Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STYLES RESPONSIVE MUDAH ALIH & TABLET */}
      <style jsx global>{`
        .sidebar {
          width: 260px;
          background-color: #ffffff;
          border-right: 1px solid #eef2f6;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          z-index: 50;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-close-btn {
          display: none;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 0.25rem;
        }

        .mobile-hamburger-btn {
          display: none;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .main-content-layout {
          flex: 1;
          margin-left: 260px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          position: relative;
          width: calc(100% - 260px);
        }

        .top-header {
          height: 70px;
          background-color: #ffffff;
          border-bottom: 1px solid #eef2f6;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .page-body-container {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        .badge-sesi-desktop {
          display: flex;
        }

        .topIconBtn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
        }

        .topIconBtn:hover {
          background-color: #f8fafc !important;
          color: #0062ff !important;
        }

        .notifIndicator {
          position: absolute;
          top: 7px;
          right: 8px;
          width: 8px;
          height: 8px;
          background-color: #ef4444;
          border-radius: 50%;
          border: 2px solid #ffffff;
        }

        .topUserAvatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.2s;
        }

        .notifDropdown {
          position: absolute;
          top: 48px;
          right: 0;
          width: 320px;
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 100;
          animation: slideDown 0.2s ease-out;
        }

        .notifHeader {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
          color: #1e293b;
        }

        .notifBadge {
          background-color: #fee2e2;
          color: #dc2626;
          font-size: 0.68rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 10px;
        }

        .notifList {
          max-height: 280px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .notifItem {
          padding: 0.85rem 1rem;
          display: flex;
          gap: 0.65rem;
          border-bottom: 1px solid #f8fafc;
          transition: background-color 0.2s;
        }

        .notifItem:hover {
          background-color: #f8fafc;
        }

        .notifItem.unread {
          background-color: #f4f8ff;
        }

        .notifIcon {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .notifIcon.warning {
          background-color: #fee2e2;
          color: #dc2626;
        }

        .notifContent {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          flex: 1;
        }

        .notifSender {
          font-size: 0.78rem;
          font-weight: 700;
          color: #0f172a;
        }

        .notifMsg {
          font-size: 0.76rem;
          color: #475569;
          margin: 0;
          line-height: 1.4;
        }

        .bottom-nav-bar {
          display: none;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes ringPulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 98, 255, 0.4); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 14px rgba(0, 98, 255, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 98, 255, 0); }
        }

        /* ==============================================================
           TABLET RESPONSIVE (Skrin < 1024px)
        ============================================================== */
        @media (max-width: 1023px) {
          .sidebar {
            transform: translateX(-100%);
            box-shadow: 10px 0 25px rgba(0, 0, 0, 0.15);
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .mobile-close-btn {
            display: block;
          }
          .mobile-hamburger-btn {
            display: flex;
          }
          .main-content-layout {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .top-header {
            padding: 0 1.25rem;
          }
          .page-body-container {
            padding: 1.5rem 1.25rem;
          }
          .mobile-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(3px);
            z-index: 45;
          }
        }

        /* ==============================================================
           SMARTPHONE RESPONSIVE (Skrin < 768px)
        ============================================================== */
        @media (max-width: 767px) {
          .badge-sesi-desktop {
            display: none;
          }
          .checkin-badge {
            display: none !important;
          }
          .header-meta-group {
            border-left: none !important;
            padding-left: 0 !important;
          }
          .notifDropdown {
            width: calc(100vw - 2rem);
            right: -45px;
          }
          .page-body-container {
            padding: 1rem;
            padding-bottom: calc(75px + env(safe-area-inset-bottom, 0px)) !important;
          }

          /* AKTIFKAN BOTTOM NAVIGATION BAR */
          .bottom-nav-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background-color: #ffffff;
            border-top: 1px solid #e2e8f0;
            z-index: 40;
            justify-content: space-around;
            align-items: center;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
          }

          .bottom-nav-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            color: #64748b;
            text-decoration: none;
            font-size: 0.68rem;
            font-weight: 600;
            height: 100%;
            transition: color 0.15s ease;
          }

          .bottom-nav-item.active {
            color: #0062ff;
            font-weight: 700;
          }

          .bottom-nav-item:active {
            transform: scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}