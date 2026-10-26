'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, Video, FileSignature, 
  CalendarDays, FileText, Settings, LogOut, 
  Menu, Bell, ShieldCheck, MessageCircle, 
  X, Send, Clock, AlertTriangle, Printer, Loader2, MapPin, Users,
  CalendarCheck, DollarSign, CalendarPlus, MoreHorizontal, CheckCircle2
} from 'lucide-react';

interface DashboardGuruLayoutProps {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
}

interface TimetableSlot {
  id: string;
  classId: string;
  className: string;
  day: string;
  timeSlot: string;
  subject: string;
  room: string;
  mode: 'Fizikal' | 'Live' | 'Kendiri' | 'Rehat';
  teacher: string;
}
interface MasterItem { id: string; name: string; }

const formatTimeAMPM = (timeInput: any): string => {
  if (!timeInput || timeInput === '-') return '-';

  if (typeof timeInput === 'string') {
    let cleanTime = timeInput.replace(/PETANG|PTG|MALAM|MLM/gi, 'PM').replace(/PAGI|PG/gi, 'AM').trim();
    if (/AM|PM/i.test(cleanTime)) return cleanTime;
    if (cleanTime.includes('T') || cleanTime.length > 12) {
      const d = new Date(cleanTime);
      if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (cleanTime.includes(':')) {
      const parts = cleanTime.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      if (!isNaN(h)) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
      }
    }
    return cleanTime;
  }
  const d = new Date(timeInput);
  if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return String(timeInput);
};

export default function DashboardGuruLayout({ children, userName = 'Ustaz Ahmad', userRole = 'Ketua Pentasmik' }: DashboardGuruLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [loginTime, setLoginTime] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [guruProfile, setGuruProfile] = useState({ name: userName, role: userRole, avatar: '' });

  // STATUS KEHADIRAN GURU
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [isPunchingIn, setIsPunchingIn] = useState(false);

  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [parentMessages, setParentMessages] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  
  const [activeChat, setActiveChat] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [timetableData, setTimetableData] = useState<TimetableSlot[]>([]);
  const [timeSlotsList, setTimeSlotsList] = useState<MasterItem[]>([]);
  const [isTimetableLoading, setIsTimetableLoading] = useState(false);
  const DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

  // PENARIKAN DATA PANTAS MENGGUNAKAN PROMISE.ALL
  const syncDashboardData = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const tId = authData.user.id;
      setTeacherId(tId);

      const now = new Date();
      const todayLocale = now.toLocaleDateString('ms-MY');
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const [attRes, profileRes, notifsRes] = await Promise.all([
        supabase.from('attendance').select('id, time_in, created_at, status').eq('user_id', tId).eq('date', todayIso).maybeSingle(),
        supabase.from('profiles').select('*').eq('id', tId).single(),
        supabase.from('notifications').select('*, profiles!notifications_sender_id_fkey(full_name)').eq('user_id', tId).eq('is_read', false).order('created_at', { ascending: false })
      ]);

      if (attRes.data) {
        setIsPunchedIn(true);
        if (!loginTime) {
          if (attRes.data.time_in && attRes.data.time_in !== '-') setLoginTime(formatTimeAMPM(attRes.data.time_in));
          else if (attRes.data.created_at) setLoginTime(formatTimeAMPM(attRes.data.created_at));
        }
      } else if (!loginTime) {
        // Jika belum masuk, tunjukkan masa mula dashboard dibuka 
        setLoginTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
      }

      if (profileRes.data) {
        setGuruProfile({ 
          name: profileRes.data.full_name || userName, 
          role: profileRes.data.job_title || userRole, 
          avatar: profileRes.data.avatar_url || '' 
        });
      }

      if (notifsRes.data) {
        const messages = notifsRes.data.filter((n: any) => n.title?.includes('Ibu Bapa') || n.title?.includes('Waris'));
        setParentMessages(messages);
      }
    } catch (error) { 
      console.error('Ralat menarik data layout Guru:', error); 
    }
  };

  useEffect(() => {
    setMounted(true);
    syncDashboardData();

    const handleSyncAvatar = () => syncDashboardData();
    window.addEventListener('avatarUpdated', handleSyncAvatar);

    const interval = setInterval(syncDashboardData, 10000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('avatarUpdated', handleSyncAvatar);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // FUNGSI PUNCH-IN KEHADIRAN GURU
  const handlePunchIn = async () => {
    if (isPunchedIn || !teacherId) return;
    
    setIsPunchingIn(true);
    try {
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeNow = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const attData = {
        user_id: teacherId,
        date: todayIso,
        time_in: timeNow,
        status: 'Hadir Bertugas',
        remarks: 'Direkod sendiri melalui Portal Pentasmik'
      };

      const { error } = await supabase.from('attendance').insert([attData]);
      if (error) throw error;
      
      setIsPunchedIn(true);
      setLoginTime(timeNow);
      alert('Kehadiran anda untuk hari ini telah berjaya direkodkan.');
    } catch (err: any) {
      alert(`Gagal merekod kehadiran: ${err.message}`);
    } finally {
      setIsPunchingIn(false);
    }
  };

  // PENARIKAN JADUAL WAKTU SERENTAK DENGAN PROMISE.ALL
  const fetchTimetableData = async () => {
    setIsTimetableLoading(true);
    try {
      const [timeRes, classesRes, ttRes] = await Promise.all([
        supabase.from('time_slots').select('id, name').order('created_at', { ascending: true }),
        supabase.from('classes').select('id, name'),
        supabase.from('timetable').select('*')
      ]);

      if (timeRes.data && timeRes.data.length > 0) {
        setTimeSlotsList(timeRes.data);
      } else {
        setTimeSlotsList([
          { id: '1', name: '08:00 AM - 10:00 AM' },
          { id: '2', name: '10:00 AM - 10:30 AM (Rehat)' },
          { id: '3', name: '10:30 AM - 12:30 PM' },
          { id: '4', name: '02:00 PM - 04:00 PM' }
        ]);
      }

      const classMap: Record<string, string> = {};
      if (classesRes.data) {
        classesRes.data.forEach((c: any) => { classMap[c.id] = c.name; });
      }

      const cleanName = (n: string) => (n || '').replace(/^(ustaz|ustazah|cikgu|guru|en|encik|tuan|puan)\s+/i, '').trim().toLowerCase();
      const teacherNameClean = cleanName(guruProfile.name);
      
      const isTeacherMatch = (nameToCheck: string) => {
        if (!nameToCheck || !teacherNameClean) return false;
        const targetClean = cleanName(nameToCheck);
        return targetClean.includes(teacherNameClean) || teacherNameClean.includes(targetClean);
      };

      if (ttRes.data) {
        const mySlots = ttRes.data.filter((t: any) => 
          t.teacher_id === teacherId || isTeacherMatch(t.teacher_name)
        );

        const formattedTimetable: TimetableSlot[] = mySlots.map((t: any) => ({
          id: t.id,
          classId: t.class_id,
          className: classMap[t.class_id] || 'Semua Kelas / Umum',
          day: t.day,
          timeSlot: t.time_slot,
          subject: t.subject,
          room: t.room_name || '-',
          mode: t.mode,
          teacher: t.teacher_name
        }));
        
        setTimetableData(formattedTimetable);
      }
    } catch (e) {
      console.error("Gagal menarik data jadual:", e);
    } finally {
      setIsTimetableLoading(false);
    }
  };

  const handleOpenTimetable = () => {
    setIsMobileMenuOpen(false);
    setShowTimetableModal(true);
    fetchTimetableData();
  };

  const getSlot = (day: string, time: string) => {
    return timetableData.find(t => t.day === day && t.timeSlot === time);
  };

  const markMessageDone = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', msgId);
      syncDashboardData();
      if (activeChat && activeChat.id === msgId) setActiveChat(null);
    } catch (err) {}
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSendingReply(true);
    try {
      await Promise.all([
        supabase.from('notifications').update({ is_read: true }).eq('id', activeChat.id),
        supabase.from('notifications').insert([{
          user_id: activeChat.sender_id,
          sender_id: teacherId,
          type: 'info',
          title: `Maklum Balas Guru: ${guruProfile.name}`,
          message: replyText
        }])
      ]);

      setActiveChat(null);
      setReplyText('');
      setShowNotifMenu(false);
      syncDashboardData();
      alert('Balasan anda telah dihantar ke Papan Pemuka Ibu Bapa.');
    } catch (err) { 
      alert('Gagal menghantar balasan.'); 
    } finally { 
      setIsSendingReply(false); 
    }
  };

  // =========================================================================
  // FUNGSI LOG KELUAR & KEMASKINI MASA KELUAR (TIME OUT)
  // =========================================================================
  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (teacherId && isPunchedIn) {
        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeOutStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const { data: attData } = await supabase
          .from('attendance')
          .select('id, time_in')
          .eq('user_id', teacherId)
          .eq('date', todayIso)
          .maybeSingle();

        if (attData && attData.id) {
          await supabase
            .from('attendance')
            .update({ time_out: timeOutStr })
            .eq('id', attData.id);
        }
      }
    } catch (err) {
      console.error('Gagal merekod masa keluar:', err);
    } finally {
      await supabase.auth.signOut();
      setShowLogoutModal(false);
      router.push('/');
    }
  };

  const isActive = (path: string) => pathname === path;

  if (!mounted) return null;

  const shortName = guruProfile.name.split(' ')[0] === 'Ustaz' || guruProfile.name.split(' ')[0] === 'Ustazah' 
    ? guruProfile.name.split(' ')[1] 
    : guruProfile.name.split(' ')[0];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', position: 'relative' }}>
      
      {/* LAPISAN KABUR (BACKDROP) MUDAH ALIH & TABLET */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-backdrop no-print"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* BAR SISI (DESKTOP KEKAL, TABLET/MOBILE SLIDE-OVER DRAWER) */}
      <aside className={`sidebar no-print ${isMobileMenuOpen ? 'open' : ''}`}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.15rem 0' }}>HuffazPro</h2>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Panel Pentasmik</span>
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

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <li>
              <Link href="/guru/dashboard" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/dashboard') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/dashboard') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/dashboard') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <LayoutDashboard size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Dashboard Utama</span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/guru/tasmik-live" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/tasmik-live') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/tasmik-live') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/tasmik-live') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <Video size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Studio Tasmik Live</span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/guru/penilaian-offline" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/penilaian-offline') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/penilaian-offline') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/penilaian-offline') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <FileSignature size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Borang Bersemuka</span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/guru/penjadualan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/penjadualan') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/penjadualan') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/penjadualan') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <CalendarDays size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Penjadualan Sesi</span>
                </div>
              </Link>
            </li>
            
            <li>
              <button 
                type="button"
                onClick={handleOpenTimetable}
                style={{ 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  padding: '0.8rem 1.5rem', 
                  backgroundColor: showTimetableModal ? '#1e293b' : 'transparent', 
                  border: 'none', 
                  borderLeft: showTimetableModal ? '4px solid #10b981' : '4px solid transparent', 
                  color: showTimetableModal ? '#ffffff' : '#94a3b8', 
                  fontFamily: 'inherit',
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  transition: 'all 0.2s', 
                  cursor: 'pointer', 
                  textAlign: 'left', 
                  justifyContent: 'flex-start',
                  lineHeight: 'normal'
                }}
              >
                <CalendarDays size={18} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Jadual Waktu Peribadi</span>
              </button>
            </li>

            <li>
              <Link href="/guru/permohonan-cuti" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/permohonan-cuti') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/permohonan-cuti') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/permohonan-cuti') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <CalendarPlus size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Permohonan Cuti Guru</span>
                </div>
              </Link>
            </li>

            <li>
              <Link href="/guru/kelulusan-cuti" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/kelulusan-cuti') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/kelulusan-cuti') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/kelulusan-cuti') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <CalendarCheck size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Kelulusan Cuti</span>
                </div>
              </Link>
            </li>

            <li>
              <Link href="/guru/tuntutan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/tuntutan') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/tuntutan') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/tuntutan') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <DollarSign size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tuntutan Elaun</span>
                </div>
              </Link>
            </li>

            <li>
              <Link href="/guru/laporan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/laporan') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/laporan') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/laporan') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <FileText size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Kehadiran & Laporan</span>
                </div>
              </Link>
            </li>
            <li>
              <Link href="/guru/tetapan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/guru/tetapan') ? '#1e293b' : 'transparent', borderLeft: isActive('/guru/tetapan') ? '4px solid #10b981' : '4px solid transparent', color: isActive('/guru/tetapan') ? '#fff' : '#94a3b8', transition: 'all 0.2s', justifyContent: 'flex-start' }}>
                  <Settings size={18} /> <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tetapan Guru</span>
                </div>
              </Link>
            </li>
          </ul>
        </nav>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', overflow: 'hidden' }}>
              {guruProfile.avatar && guruProfile.avatar !== 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80' ? (
                <img src={guruProfile.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                guruProfile.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{guruProfile.name}</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>{guruProfile.role}</p>
            </div>
          </div>
          <button onClick={() => setShowLogoutModal(true)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.35rem' }} title="Log Keluar">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* KAWASAN KANDUNGAN UTAMA */}
      <main className="main-content-layout">
        
        {/* HEADER ATAS */}
        <header className="top-header no-print">
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Buka Menu"
            >
              <Menu size={20} />
            </button>

            <button 
              onClick={handlePunchIn}
              disabled={isPunchedIn || isPunchingIn}
              className="badge-kehadiran-desktop" 
              style={{ 
                background: isPunchedIn ? '#ecfdf5' : '#fef2f2', 
                color: isPunchedIn ? '#059669' : '#dc2626', 
                border: `1px solid ${isPunchedIn ? '#a7f3d0' : '#fecaca'}`,
                fontSize: '0.75rem', 
                fontWeight: 700, 
                padding: '0.3rem 0.75rem', 
                borderRadius: '20px', 
                display: 'inline-flex',
                alignItems: 'center', 
                gap: '4px',
                cursor: isPunchedIn ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
              title={isPunchedIn ? "Kehadiran telah direkod" : "Klik untuk sahkan kehadiran hari ini"}
            >
              {isPunchingIn ? (
                <Loader2 size={14} className="animate-spin" />
              ) : isPunchedIn ? (
                <CheckCircle2 size={14} />
              ) : (
                <ShieldCheck size={14} />
              )}
              {isPunchedIn ? 'Hadir Disahkan' : 'Sahkan Kehadiran'}
            </button>

            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
              Assalamualaikum, <span style={{ color: '#2563eb' }}>{shortName}!</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="header-date-time" style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <CalendarDays size={12} /> {new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
              </span>
              <span style={{ fontSize: '0.75rem', color: isPunchedIn ? '#059669' : '#475569', display: 'flex', alignItems: 'center', gap: '4px', background: isPunchedIn ? '#ecfdf5' : '#f1f5f9', padding: '0.35rem 0.65rem', borderRadius: '6px', border: `1px solid ${isPunchedIn ? '#a7f3d0' : '#cbd5e1'}`, fontWeight: 600 }}>
                <Clock size={12} /> {formatTimeAMPM(loginTime)}
              </span>
            </div>
            
            {/* NOTIFIKASI */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button 
                type="button"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                style={{ position: 'relative', background: '#fff', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
              >
                <Bell size={18} />
                {parentMessages.length > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, background: '#ef4444', color: '#fff', width: '16px', height: '16px', borderRadius: '50%', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {parentMessages.length}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="notif-dropdown">
                  <div style={{ padding: '0.9rem 1.1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>Peti Mesej Waris</h3>
                    <span style={{ fontSize: '0.7rem', background: '#0062ff', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 700 }}>{parentMessages.length} Baharu</span>
                  </div>
                  
                  <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {parentMessages.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada mesej baharu.</div>
                    ) : (
                      parentMessages.map(msg => {
                        const parentName = msg.profiles?.full_name || 'Ibu Bapa';
                        return (
                          <div 
                            key={msg.id} 
                            onClick={() => { setActiveChat(msg); setShowNotifMenu(false); }}
                            style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s', background: '#fff' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{parentName}</span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                {formatTimeAMPM(msg.created_at)}
                              </span>
                            </div>
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              "{msg.message}"
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.7rem', color: '#0062ff', fontWeight: 700 }}>Klik untuk balas</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
              {guruProfile.avatar && guruProfile.avatar !== 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80' ? (
                <img src={guruProfile.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                guruProfile.name.charAt(0).toUpperCase()
              )}
            </div>

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
          <Link href="/guru/dashboard" className={`bottom-nav-item ${isActive('/guru/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={19} />
            <span>Utama</span>
          </Link>

          <Link href="/guru/tasmik-live" className={`bottom-nav-item ${isActive('/guru/tasmik-live') ? 'active' : ''}`}>
            <Video size={19} />
            <span>Live</span>
          </Link>

          <Link href="/guru/penilaian-offline" className={`bottom-nav-item ${isActive('/guru/penilaian-offline') ? 'active' : ''}`}>
            <FileSignature size={19} />
            <span>Bersemuka</span>
          </Link>

          <Link href="/guru/laporan" className={`bottom-nav-item ${isActive('/guru/laporan') ? 'active' : ''}`}>
            <FileText size={19} />
            <span>Laporan</span>
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

        {/* MODAL BALAS MESEJ WARIS */}
        {activeChat && (
          <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle size={18} color="#0062ff" /> Balas Mesej Waris
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Dari: {activeChat.profiles?.full_name || 'Ibu Bapa'}</span>
                </div>
                <button type="button" onClick={() => setActiveChat(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendReply} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                    Mesej Asal ({formatTimeAMPM(activeChat.created_at)}):
                  </span>
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9rem', color: '#1e293b', fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{activeChat.message}"
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Tulis Balasan Anda</label>
                  <textarea 
                    rows={4} 
                    placeholder="Taipkan penjelasan atau jawapan anda di sini..." 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={(e) => markMessageDone(activeChat.id, e)} 
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Selesai
                  </button>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" onClick={() => setActiveChat(null)} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                      Batal
                    </button>
                    <button type="submit" disabled={isSendingReply} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#0062ff', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {isSendingReply ? 'Menghantar...' : <><Send size={15} /> Hantar</>}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL JADUAL WAKTU PERIBADI */}
        {showTimetableModal && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1rem' }}>
            <div className="printable-modal" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '1100px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              
              <div className="no-print" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', color: '#fff' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CalendarDays size={18} color="#38bdf8" /> Jadual Waktu Peribadi Guru
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button onClick={() => window.print()} style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.45rem 0.9rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Printer size={15} /> Cetak
                  </button>
                  <button onClick={() => setShowTimetableModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}>
                    <X size={22} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', background: '#f8fafc' }} className="print-area">
                {isTimetableLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '280px', color: '#0062ff' }}>
                    <Loader2 className="animate-spin" size={30} />
                  </div>
                ) : (
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                    
                    <div className="print-only" style={{ display: 'none', textAlign: 'center', padding: '2rem 1rem 1.5rem 1rem', borderBottom: '2px solid #0f172a' }}>
                      <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>Maahad Tahfiz HuffazPro Malaysia</h2>
                      <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.2rem', color: '#334155' }}>Jadual Waktu Pengajian (Peribadi)</h3>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
                        Nama Guru: <span style={{ color: '#0062ff' }}>{guruProfile.name}</span>
                      </p>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '750px' }}>
                        <thead>
                          <tr style={{ background: '#0f172a', color: '#fff' }}>
                            <th style={{ padding: '0.85rem', width: '90px', borderRight: '1px solid #334155', borderBottom: '1px solid #334155', fontSize: '0.8rem' }}>HARI \ MASA</th>
                            {timeSlotsList.map(time => (
                              <th key={time.id} style={{ padding: '0.85rem', borderRight: '1px solid #334155', borderBottom: '1px solid #334155', fontSize: '0.8rem', fontWeight: 700 }}>{time.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS.map(day => (
                            <tr key={day} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '0.85rem', fontWeight: 800, background: '#f8fafc', borderRight: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', color: '#0f172a', fontSize: '0.82rem' }}>{day}</td>
                              {timeSlotsList.map(time => {
                                const slot = getSlot(day, time.name);
                                return (
                                  <td key={`${day}-${time.id}`} style={{ padding: '0.4rem', borderRight: '1px solid #e2e8f0', verticalAlign: 'top', height: '100px' }}>
                                    {slot ? (
                                      <div 
                                        style={{ 
                                          background: slot.mode === 'Rehat' ? '#f8fafc' : slot.mode === 'Live' ? '#eff6ff' : '#ecfdf5', 
                                          border: `1px solid ${slot.mode === 'Rehat' ? '#e2e8f0' : slot.mode === 'Live' ? '#bfdbfe' : '#a7f3d0'}`, 
                                          borderRadius: '8px', 
                                          padding: '0.6rem', 
                                          height: '100%', 
                                          minHeight: '85px',
                                          display: 'flex', 
                                          flexDirection: 'column', 
                                          justifyContent: 'center', 
                                          position: 'relative'
                                        }}
                                      >
                                        {slot.mode !== 'Rehat' && (
                                          <span style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '0.62rem', background: slot.mode === 'Live' ? '#dbeafe' : '#dcfce7', color: slot.mode === 'Live' ? '#1e40af' : '#166534', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>{slot.mode}</span>
                                        )}
                                        <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.82rem', color: slot.mode === 'Rehat' ? '#64748b' : '#0f172a', fontWeight: 800 }}>{slot.subject}</h4>
                                        
                                        {slot.mode !== 'Rehat' && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '3px' }}>
                                            <p style={{ margin: 0, fontSize: '0.72rem', color: '#0062ff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                              <Users size={11} /> {slot.className}
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                              <MapPin size={10} /> {slot.room !== '-' ? slot.room : 'Tiada Bilik'}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ height: '100%', minHeight: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '0.72rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>Kosong</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="print-only" style={{ display: 'none', marginTop: '2rem', padding: '0 1rem 1rem 1rem', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>Dicetak oleh: {guruProfile.name}</span>
                      <span>Tarikh Cetakan: {new Date().toLocaleDateString('ms-MY')}</span>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL LOG KELUAR */}
        {showLogoutModal && (
          <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '1.5rem', textAlign: 'center' }}>
              <AlertTriangle size={32} color="#dc2626" style={{ margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.1rem' }}>Log Keluar Portal Guru</h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: '#64748b' }}>Adakah anda pasti mahu mendaftar keluar dari portal pentasmik?</p>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" disabled={isLoggingOut} onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Batal</button>
                <button type="button" disabled={isLoggingOut} onClick={handleConfirmLogout} style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: isLoggingOut ? 'not-allowed' : 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : 'Log Keluar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* STYLES RESPONSIVE MUDAH ALIH & TABLET */}
      <style jsx global>{`
        /* ASAS SIDEBAR DESKTOP */
        .sidebar {
          width: 260px;
          background-color: #0f172a;
          color: #ffffff;
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

        .badge-kehadiran-desktop {
          display: flex;
        }

        .notif-dropdown {
          position: absolute;
          top: 45px;
          right: 0;
          width: 340px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
          overflow: hidden;
          z-index: 100;
        }

        /* BOTTOM NAV BAR (TERSEMBUNYI DI DESKTOP & TABLET BESAR) */
        .bottom-nav-bar {
          display: none;
        }

        /* ==============================================================
            TABLET RESPONSIVE (Skrin < 1024px)
        ============================================================== */
        @media (max-width: 1023px) {
          .sidebar {
            transform: translateX(-100%);
            box-shadow: 10px 0 25px rgba(0, 0, 0, 0.3);
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
          .badge-kehadiran-desktop {
            display: none; /* Jimatkan ruang header */
          }
          .header-date-time {
            display: none; /* Ringkaskan header telefon */
          }
          .notif-dropdown {
            width: calc(100vw - 2rem);
            right: -50px;
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

        /* CETAKAN */
        @media print {
          body * { visibility: hidden; }
          .modal-overlay { position: absolute; left: 0; top: 0; background: none; }
          .printable-modal, .printable-modal * { visibility: visible; }
          .printable-modal { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; }
          .no-print { display: none !important; }
          .print-area { padding: 0 !important; background: #fff !important; }
          .print-only { display: flex !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}