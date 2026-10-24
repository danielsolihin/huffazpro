'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, Users, GraduationCap, CalendarDays, 
  Settings, LogOut, Menu, ShieldCheck, Clock, UserCheck, AlertTriangle,
  DollarSign, X
} from 'lucide-react';

interface DashboardAdminLayoutProps {
  children: React.ReactNode;
}

// Fungsi Helper untuk menukar PTG/PG/PAGI/PETANG kepada AM/PM
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

export default function DashboardAdminLayout({ children }: DashboardAdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // STATE DINAMIK DARI SUPABASE
  const [adminName, setAdminName] = useState('Pentadbir Utama');
  const [adminAvatar, setAdminAvatar] = useState('');
  const [loginTime, setLoginTime] = useState('');
  const [institutionName, setInstitutionName] = useState('HuffazPro');

  useEffect(() => {
    setMounted(true);
    
    // Tetapkan masa log masuk semasa dalam format AM/PM
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setLoginTime(formatTimeAMPM(time));

    // Tarik Profil Admin dari Supabase
    const fetchAdminProfile = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', authData.user.id)
            .single();

          if (profile) {
            if (profile.full_name) setAdminName(profile.full_name);
            if (profile.avatar_url) setAdminAvatar(profile.avatar_url);
          }
        }
      } catch (error) {
        console.error('Ralat menarik profil admin:', error);
      }
    };

    fetchAdminProfile();
  }, []);

  // FUNGSI LOG KELUAR SUPABASE
  const handleConfirmLogout = async () => {
    await supabase.auth.signOut();
    setShowLogoutModal(false);
    router.push('/');
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', position: 'relative' }}>
      
      {/* LAPISAN KABUR (BACKDROP) APABILA MENU LACI DIBUKA DI TELEFON & TABLET */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-backdrop no-print"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* BAR SISI (DESKTOP KEKAL, TABLET/MOBILE SLIDE-OVER DRAWER) */}
      <aside className={`sidebar no-print ${isMobileMenuOpen ? 'open' : ''}`}>
        
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#0062ff', color: 'white', padding: '0.45rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                {institutionName}
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>Portal Pentadbiran Pusat</span>
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

        <nav style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <Link href="/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/admin/dashboard') ? '#1e293b' : 'transparent', borderLeft: isActive('/admin/dashboard') ? '4px solid #0062ff' : '4px solid transparent', color: isActive('/admin/dashboard') ? '#ffffff' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
              <LayoutDashboard size={18} /> <span style={{ fontSize: '0.88rem' }}>Papan Pemuka</span>
            </div>
          </Link>

          <Link href="/admin/kelas" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/admin/kelas') ? '#1e293b' : 'transparent', borderLeft: isActive('/admin/kelas') ? '4px solid #0062ff' : '4px solid transparent', color: isActive('/admin/kelas') ? '#ffffff' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
              <CalendarDays size={18} /> <span style={{ fontSize: '0.88rem' }}>Pengurusan Kelas & Jadual</span>
            </div>
          </Link>

          <Link href="/admin/pengguna" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/admin/pengguna') ? '#1e293b' : 'transparent', borderLeft: isActive('/admin/pengguna') ? '4px solid #0062ff' : '4px solid transparent', color: isActive('/admin/pengguna') ? '#ffffff' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
              <Users size={18} /> <span style={{ fontSize: '0.88rem' }}>Direktori & Akaun Pengguna</span>
            </div>
          </Link>

          <Link href="/admin/tuntutan-guru" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/admin/tuntutan-guru') ? '#1e293b' : 'transparent', borderLeft: isActive('/admin/tuntutan-guru') ? '4px solid #0062ff' : '4px solid transparent', color: isActive('/admin/tuntutan-guru') ? '#ffffff' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
              <DollarSign size={18} /> <span style={{ fontSize: '0.88rem' }}>Tuntutan Elaun Guru</span>
            </div>
          </Link>

          <Link href="/admin/kehadiran" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/admin/kehadiran') ? '#1e293b' : 'transparent', borderLeft: isActive('/admin/kehadiran') ? '4px solid #0062ff' : '4px solid transparent', color: isActive('/admin/kehadiran') ? '#ffffff' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
              <UserCheck size={18} /> <span style={{ fontSize: '0.88rem' }}>Kehadiran & Semakan Cuti</span>
            </div>
          </Link>

          <Link href="/admin/tetapan" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 1.5rem', backgroundColor: isActive('/admin/tetapan') ? '#1e293b' : 'transparent', borderLeft: isActive('/admin/tetapan') ? '4px solid #0062ff' : '4px solid transparent', color: isActive('/admin/tetapan') ? '#ffffff' : '#94a3b8', fontWeight: 600, transition: 'all 0.2s' }}>
              <Settings size={18} /> <span style={{ fontSize: '0.88rem' }}>Tetapan Institusi</span>
            </div>
          </Link>
        </nav>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#0062ff', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', overflow: 'hidden' }}>
              {adminAvatar ? <img src={adminAvatar} alt="Admin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : adminName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{adminName}</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#38bdf8' }}>Super Administrator</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setShowLogoutModal(true)} 
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
            title="Log Keluar"
          >
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
              <Menu size={20} color="#0f172a" />
            </button>

            <span className="badge-status-desktop" style={{ background: '#eff6ff', color: '#0062ff', fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.8rem', borderRadius: '20px', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} /> Sesi Sistem Stabil & Aktif
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="header-meta-group" style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <CalendarDays size={12} /> {new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#0062ff', display: 'flex', alignItems: 'center', gap: '4px', background: '#eff6ff', padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid #bfdbfe', fontWeight: 600 }}>
                <Clock size={12} /> Masuk: {formatTimeAMPM(loginTime)}
              </span>
            </div>

            {/* Butang Profil di Header yang boleh diklik */}
            <Link href="/admin/tetapan" title="Kemaskini Profil Akaun" style={{ textDecoration: 'none' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', border: '2px solid #38bdf8', overflow: 'hidden', cursor: 'pointer' }}>
                {adminAvatar ? <img src={adminAvatar} alt="Admin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : adminName.charAt(0).toUpperCase()}
              </div>
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
          <Link href="/admin/dashboard" className={`bottom-nav-item ${isActive('/admin/dashboard') ? 'active' : ''}`}>
            <LayoutDashboard size={19} />
            <span>Utama</span>
          </Link>

          <Link href="/admin/kelas" className={`bottom-nav-item ${isActive('/admin/kelas') ? 'active' : ''}`}>
            <CalendarDays size={19} />
            <span>Kelas</span>
          </Link>

          <Link href="/admin/pengguna" className={`bottom-nav-item ${isActive('/admin/pengguna') ? 'active' : ''}`}>
            <Users size={19} />
            <span>Pengguna</span>
          </Link>

          <Link href="/admin/tuntutan-guru" className={`bottom-nav-item ${isActive('/admin/tuntutan-guru') ? 'active' : ''}`}>
            <DollarSign size={19} />
            <span>Tuntutan</span>
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

        {/* MODAL LOG KELUAR */}
        {showLogoutModal && (
          <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '1.5rem', textAlign: 'center' }}>
              <AlertTriangle size={32} color="#dc2626" style={{ margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Log Keluar Portal Admin</h3>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.88rem', color: '#64748b' }}>Adakah anda pasti mahu mendaftar keluar dari portal pentadbiran rasmi?</p>
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

        .badge-status-desktop {
          display: flex;
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
          .badge-status-desktop {
            display: none;
          }
          .header-meta-group {
            display: none !important;
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