'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, BookOpenCheck, CalendarCheck, FileText, 
  Settings, LogOut, Menu, Users, AlertTriangle,
  Bell, MessageCircle, CheckCircle2, X, Send
} from 'lucide-react';

// Fungsi Helper untuk menukar PTG/PG/PAGI/PETANG kepada AM/PM
const formatTimeAMPM = (timeInput: any): string => {
  if (!timeInput || timeInput === '-') return '-';

  if (typeof timeInput === 'string') {
    let clean = timeInput
      .replace(/PETANG|PTG|MALAM|MLM/gi, 'PM')
      .replace(/PAGI|PG/gi, 'AM')
      .trim();
    if (clean.includes(':')) return clean;
  }

  const d = new Date(timeInput);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return String(timeInput);
};

export default function DashboardIbuBapaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // DATA DINAMIK DARI SUPABASE
  const [parentId, setParentId] = useState('');
  const [parentProfile, setParentProfile] = useState({ name: 'Waris / Penjaga', phone: '' });
  const [childrenList, setChildrenList] = useState<{id: string, nama: string}[]>([]);
  
  // Rujukan ID Anak Aktif
  const [selectedChildId, setSelectedChildId] = useState('');

  // STATE NOTIFIKASI & MESEJ GURU
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [teacherMessages, setTeacherMessages] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const syncParentData = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const pId = authData.user.id;
      setParentId(pId);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', pId).single();
      if (profile) {
        setParentProfile({ name: profile.full_name || 'Waris', phone: profile.phone || '' });
      }

      // Tarik Senarai Anak
      const { data: students } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('role', '%elajar%')
        .eq('parent_id', pId);

      let mappedStudents: {id: string, nama: string}[] = [];
      
      if (students && students.length > 0) {
        mappedStudents = students.map(s => ({ id: s.id, nama: s.full_name || 'Anak' }));
      } else {
        mappedStudents.push({ id: '', nama: 'Tiada Rekod Pelajar Dipautkan' });
      }
      setChildrenList(mappedStudents);

      // Selaraskan Anak Aktif menggunakan ID
      const savedChildId = localStorage.getItem('huffazpro_active_child_id');
      if (savedChildId && mappedStudents.some(s => s.id === savedChildId)) {
        setSelectedChildId(savedChildId);
      } else if (mappedStudents.length > 0 && mappedStudents[0].id !== '') {
        setSelectedChildId(mappedStudents[0].id);
        localStorage.setItem('huffazpro_active_child_id', mappedStudents[0].id);
      } else {
        setSelectedChildId('');
      }

      const { data: notifs } = await supabase
        .from('notifications')
        .select('*, profiles!notifications_sender_id_fkey(full_name)')
        .eq('user_id', pId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (notifs) {
        const tMsgs = notifs.filter((n: any) => n.title?.includes('Guru') || n.type === 'info' || n.type === 'teguran');
        setTeacherMessages(tMsgs);
      }
    } catch (error) {
      console.error('Ralat menarik data layout Ibu Bapa:', error);
    }
  };

  useEffect(() => {
    setMounted(true);
    syncParentData();
    window.addEventListener('activeChildChanged', syncParentData);
    const interval = setInterval(syncParentData, 10000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('activeChildChanged', syncParentData);
    };
  }, []);

  const handleChildChange = (childId: string) => {
    if (childId && childId !== '') {
      setSelectedChildId(childId);
      localStorage.setItem('huffazpro_active_child_id', childId);
      window.dispatchEvent(new Event('activeChildChanged'));
      if (pathname === '/ibubapa/dashboard') {
        window.location.reload();
      }
    }
  };

  const markMessageDone = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', msgId);
      syncParentData();
      if (activeChat && activeChat.id === msgId) setActiveChat(null);
    } catch (err) {}
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setIsSendingReply(true);
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', activeChat.id);
      await supabase.from('notifications').insert([{
        user_id: activeChat.sender_id,
        sender_id: parentId,
        type: 'info',
        title: `Maklum Balas Waris: ${parentProfile.name}`,
        message: replyText
      }]);
      setActiveChat(null);
      setReplyText('');
      setShowNotifMenu(false);
      syncParentData();
      alert('Balasan anda telah dihantar terus ke Papan Pemuka Guru.');
    } catch (err) {
      alert('Gagal menghantar balasan.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleConfirmLogout = async () => {
    await supabase.auth.signOut();
    setShowLogoutModal(false);
    router.push('/');
  };

  const isActive = (path: string) => pathname === path;

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', position: 'relative' }}>
      
      {/* LAPISAN KABUR (BACKDROP) APABILA MENU DIBUKA DI TELEFON & TABLET */}
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
            <div style={{ backgroundColor: '#059669', color: 'white', padding: '0.45rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>HuffazPro</h2>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>Portal Waris & Penjaga</span>
            </div>
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

        <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #eef2f6' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>Profil Anak Dipantau:</label>
          <select 
            value={selectedChildId}
            onChange={(e) => handleChildChange(e.target.value)}
            disabled={childrenList.length === 0 || childrenList[0].id === ''}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', background: '#ffffff', outline: 'none', cursor: childrenList.length > 0 && childrenList[0].id !== '' ? 'pointer' : 'not-allowed' }}
          >
            {childrenList.map((c) => (
              <option key={c.id} value={c.id}>{c.nama}</option>
            ))}
          </select>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <Link href="/ibubapa/dashboard" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/ibubapa/dashboard') ? '#ecfdf5' : 'transparent', color: isActive('/ibubapa/dashboard') ? '#059669' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
              <LayoutDashboard size={20} /> <span style={{ fontSize: '0.9rem' }}>Papan Pemuka</span>
            </div>
          </Link>
          <Link href="/ibubapa/kemajuan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/ibubapa/kemajuan') ? '#ecfdf5' : 'transparent', color: isActive('/ibubapa/kemajuan') ? '#059669' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
              <BookOpenCheck size={20} /> <span style={{ fontSize: '0.9rem' }}>Kemajuan Hafazan</span>
            </div>
          </Link>
          <Link href="/ibubapa/kehadiran" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/ibubapa/kehadiran') ? '#ecfdf5' : 'transparent', color: isActive('/ibubapa/kehadiran') ? '#059669' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
              <CalendarCheck size={20} /> <span style={{ fontSize: '0.9rem' }}>Kehadiran & Cuti</span>
            </div>
          </Link>
          <Link href="/ibubapa/laporan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/ibubapa/laporan') ? '#ecfdf5' : 'transparent', color: isActive('/ibubapa/laporan') ? '#059669' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
              <FileText size={20} /> <span style={{ fontSize: '0.9rem' }}>Kad Laporan Rasmi</span>
            </div>
          </Link>
          <Link href="/ibubapa/tetapan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: isActive('/ibubapa/tetapan') ? '#ecfdf5' : 'transparent', color: isActive('/ibubapa/tetapan') ? '#059669' : '#64748b', fontWeight: 600, transition: 'all 0.2s' }}>
              <Settings size={20} /> <span style={{ fontSize: '0.9rem' }}>Tetapan & Pautan Anak</span>
            </div>
          </Link>
        </nav>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
              {parentProfile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{parentProfile.name}</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>Waris Berdaftar</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setShowLogoutModal(true)} 
            style={{ background: '#fee2e2', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.45rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Buka Menu"
            >
              <Menu size={20} />
            </button>

            <span style={{ background: '#ecfdf5', color: '#059669', fontSize: '0.78rem', fontWeight: 700, padding: '0.35rem 0.8rem', borderRadius: '20px' }}>
              Memantau: {childrenList.find(c => c.id === selectedChildId)?.nama || 'Tiada Rekod'}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <span className="academic-session-label" style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Sesi Akademik Semasa
            </span>
            
            <div style={{ position: 'relative' }}>
              <button 
                type="button"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                style={{ position: 'relative', background: '#fff', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
              >
                <Bell size={18} />
                {teacherMessages.length > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, background: '#ef4444', color: '#fff', width: '16px', height: '16px', borderRadius: '50%', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {teacherMessages.length}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="notif-dropdown">
                  <div style={{ padding: '1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Peti Balasan Guru</h3>
                    <span style={{ fontSize: '0.7rem', background: '#0062ff', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 700 }}>{teacherMessages.length} Baharu</span>
                  </div>
                  
                  <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {teacherMessages.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada mesej baharu daripada guru.</div>
                    ) : (
                      teacherMessages.map(msg => (
                        <div key={msg.id} onClick={() => { setActiveChat(msg); setShowNotifMenu(false); }} style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{msg.profiles?.full_name || 'Guru'}</span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              {formatTimeAMPM(msg.created_at)}
                            </span>
                          </div>
                          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>"{msg.message}"</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
          <Link href="/ibubapa/dashboard" className={`bottom-nav-item ${isActive('/ibubapa/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={19} />
            <span>Utama</span>
          </Link>

          <Link href="/ibubapa/kemajuan" className={`bottom-nav-item ${isActive('/ibubapa/kemajuan') ? 'active' : ''}`}>
            <BookOpenCheck size={19} />
            <span>Kemajuan</span>
          </Link>

          <Link href="/ibubapa/kehadiran" className={`bottom-nav-item ${isActive('/ibubapa/kehadiran') ? 'active' : ''}`}>
            <CalendarCheck size={19} />
            <span>Kehadiran</span>
          </Link>

          <Link href="/ibubapa/laporan" className={`bottom-nav-item ${isActive('/ibubapa/laporan') ? 'active' : ''}`}>
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

        {/* MODAL BALAS MESEJ GURU */}
        {activeChat && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageCircle color="#0062ff" size={18} /> Balas Mesej Guru
                  </h3>
                </div>
                <button type="button" onClick={() => setActiveChat(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}><X size={18} /></button>
              </div>
              <form onSubmit={handleSendReply} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                  {activeChat.created_at && (
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                      Masa: {formatTimeAMPM(activeChat.created_at)}
                    </span>
                  )}
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9rem', color: '#1e293b', fontStyle: 'italic' }}>"{activeChat.message}"</p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Tulis Balasan Anda</label>
                  <textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button type="button" onClick={(e) => markMessageDone(activeChat.id, e)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Selesai Tanpa Balas</button>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" onClick={() => setActiveChat(null)} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                    <button type="submit" disabled={isSendingReply} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#0062ff', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Hantar</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL PENGESAHAN LOG KELUAR */}
        {showLogoutModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '1.5rem', textAlign: 'center' }}>
              <AlertTriangle size={32} color="#dc2626" style={{ margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Log Keluar Portal Waris</h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.88rem', color: '#64748b' }}>Adakah anda pasti mahu mendaftar keluar dari portal pemantauan ibu bapa?</p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Batal</button>
                <button type="button" onClick={handleConfirmLogout} style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Log Keluar</button>
              </div>
            </div>
          </div>
        )}

      </main>

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

        .bottom-nav-bar {
          display: none;
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
          .academic-session-label {
            display: none; /* Sembunyikan label panjang di skrin telefon */
          }
          .notif-dropdown {
            width: calc(100vw - 2rem);
            right: -20px;
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
            color: #059669;
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