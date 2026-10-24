'use client';

import React, { useState, useEffect } from 'react';
import DashboardIbuBapaLayout from '@/components/dashboard/DashboardIbuBapaLayout';
import { supabase } from '@/lib/supabase';
import { FileText, Printer, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import styles from './LaporanIbuBapa.module.css';

export default function IbuBapaLaporanPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data Sebenar Supabase
  const [activeChildName, setActiveChildName] = useState('Memuatkan...');
  const [studentInfo, setStudentInfo] = useState({ matrik: '-', kelas: 'Belum Ditetapkan' });
  const [parentName, setParentName] = useState('Waris / Penjaga');
  
  const [selectedMonth, setSelectedMonth] = useState('');
  const [monthEvals, setMonthEvals] = useState<any[]>([]);
  const [monthAttendance, setMonthAttendance] = useState<any[]>([]);

  // Boleh panjangkan senarai bulan mengikut keperluan tahun akademik
  const SENARAI_BULAN = [
    'DISEMBER 2026', 'NOVEMBER 2026', 'OKTOBER 2026', 'SEPTEMBER 2026', 
    'OGOS 2026', 'JULAI 2026', 'JUN 2026', 'MEI 2026', 'APRIL 2026'
  ];

  const fetchLaporanData = async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      // Tarik Nama Penjaga Sebenar
      const { data: pProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', authData.user.id)
        .single();
        
      if (pProfile) setParentName(pProfile.full_name || 'Waris');

      // Semak Anak Mana Yang Aktif (Dari Sidebar)
      const targetChildId = localStorage.getItem('huffazpro_active_child_id');
      if (!targetChildId) {
        setActiveChildName('Tiada Rekod Pelajar Dipautkan');
        setMonthEvals([]);
        setIsLoading(false);
        return;
      }

      // Tarik Profil Anak Sebenar (PUNCA SELESAI: class_name dibuang dari carian)
      const { data: childProfile } = await supabase
        .from('profiles')
        .select('full_name, matrik_or_id') 
        .eq('id', targetChildId)
        .single();

      if (childProfile) {
        setActiveChildName(childProfile.full_name || 'Pelajar');
        setStudentInfo({
          matrik: childProfile.matrik_or_id || 'Tiada No. Matrik',
          kelas: 'Tasmik Hafazan' // Guna nama statik kerana tiada lajur kelas di DB
        });
      }

      // Dapatkan tarikh mula dan akhir untuk bulan yang dipilih
      if (selectedMonth) {
        const [monthName, yearStr] = selectedMonth.split(' ');
        const monthNames = ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'];
        const monthIndex = monthNames.indexOf(monthName);
        const year = parseInt(yearStr);

        // Cari rekod Evaluation (Bulan Spesifik)
        const { data: evals } = await supabase
          .from('evaluations')
          .select('*')
          .eq('student_id', targetChildId)
          .order('created_at', { ascending: false });

        if (evals) {
          // Tapis data mengikut bulan dipilih (berasaskan tarikh created_at sebenar di DB)
          const filteredEvals = evals.filter((e: any) => {
            const d = new Date(e.created_at);
            return d.getMonth() === monthIndex && d.getFullYear() === year;
          }).map((e: any) => ({
            tarikh: new Date(e.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }),
            surah: e.surah || '',
            halaman: e.halaman || 'Semua',
            gred: e.gred || '-',
            catatan: e.catatan || ''
          }));
          
          setMonthEvals(filteredEvals);
        } else {
          setMonthEvals([]);
        }

        // Cari rekod Kehadiran (Bulan Spesifik)
        const { data: attData } = await supabase
          .from('attendance')
          .select('status, created_at')
          .eq('user_id', targetChildId);

        if (attData) {
          const filteredAtt = attData.filter((a: any) => {
            const d = new Date(a.created_at);
            return d.getMonth() === monthIndex && d.getFullYear() === year;
          });
          setMonthAttendance(filteredAtt);
        } else {
          setMonthAttendance([]);
        }
      }

    } catch (err) {
      console.error('Ralat menarik data laporan PDF:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    
    // Auto-Set Bulan Semasa pada kali pertama load
    const d = new Date();
    const curMonthStr = `${['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'][d.getMonth()]} ${d.getFullYear()}`;
    setSelectedMonth(curMonthStr);
  }, []);

  // Fetch data setiap kali "Bulan Semakan" atau "Anak Aktif" bertukar
  useEffect(() => {
    if (selectedMonth) {
      fetchLaporanData();
    }
  }, [selectedMonth]);

  useEffect(() => {
    const handleChildChange = () => fetchLaporanData();
    window.addEventListener('activeChildChanged', handleChildChange);
    return () => {
      window.removeEventListener('activeChildChanged', handleChildChange);
    };
  }, [selectedMonth]);


  // KIRAAN STATISTIK
  const purataGred = monthEvals.length > 0 ? monthEvals[0].gred : 'Tiada Rekod';
  const capaianSurah = monthEvals.length > 0 ? monthEvals[0].surah : '-';
  const peratusKehadiran = monthAttendance.length > 0 
    ? Math.round((monthAttendance.filter(a => a.status.includes('Hadir') && !a.status.includes('Tidak')).length / monthAttendance.length) * 100) 
    : 0;

  if (!mounted) return null;

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
      <div className={styles.container}>
        
        {/* HEADER TOOLBAR (DISEMBUNYIKAN KETIKA PRINT) */}
        <div className={`${styles.headerCard} ${styles.noPrint}`}>
          <div>
            <h1 className={styles.mainTitle}><FileText size={26} color="#059669" /> Kad Laporan Rasmi</h1>
            <p className={styles.subtitle}>Jana slip keputusan hafazan bulanan bagi <strong style={{ color: '#059669' }}>{activeChildName}</strong>.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.2rem' }}>Bulan Semakan</label>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
                style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              >
                {SENARAI_BULAN.map(bln => <option key={bln} value={bln}>{bln}</option>)}
              </select>
            </div>
            <button 
              className={styles.btnPrint} 
              onClick={() => window.print()} 
              disabled={monthEvals.length === 0}
            >
              <Printer size={18} /> Cetak Slip PDF
            </button>
          </div>
        </div>

        {monthEvals.length > 0 ? (
          <div className={styles.reportPaper}>
            
            {/* LOGO & NAMA SEKOLAH */}
            <div className={styles.schoolHeader}>
              <div className={styles.schoolLogo}><BookOpen size={36} color="#fff" /></div>
              <div style={{ textAlign: 'center' }}>
                <h2 className={styles.schoolName}>MAAHAD TAHFIZ HUFFAZPRO MALAYSIA</h2>
                <p className={styles.schoolAddress}>Pusat Kecemerlangan Al-Quran & Pengajian Sunnah</p>
              </div>
            </div>

            <div className={styles.reportTitleBox}>
              <h3 className={styles.reportTitle}>KAD LAPORAN PRESTASI HAFAZAN BULANAN</h3>
              <p className={styles.reportMonth}>BULAN: {selectedMonth}</p>
            </div>

            {/* INFO PELAJAR (SEBENAR) */}
            <div className={styles.infoGrid}>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Nama Pelajar</span><span className={styles.infoColon}>:</span> <span className={styles.infoValue}>{activeChildName}</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>No. MyKad / Matrik</span><span className={styles.infoColon}>:</span> <span className={styles.infoValue}>{studentInfo.matrik}</span></div>
              <div className={styles.infoRow}><span className={styles.infoLabel}>Kelas / Kumpulan</span><span className={styles.infoColon}>:</span> <span className={styles.infoValue}>{studentInfo.kelas}</span></div>
            </div>

            {/* STATISTIK BULANAN */}
            <div className={styles.summaryGrid}>
              <div className={styles.summaryBox}>
                <span className={styles.summaryLabel}>Gred Terkini</span>
                <span className={styles.summaryValue} style={{ color: '#059669' }}>{purataGred}</span>
              </div>
              <div className={styles.summaryBox}>
                <span className={styles.summaryLabel}>Capaian Hafazan Baru</span>
                <span className={styles.summaryValue}>{capaianSurah}</span>
              </div>
              <div className={styles.summaryBox}>
                <span className={styles.summaryLabel}>Kadar Kehadiran Bulanan</span>
                <span className={styles.summaryValue}>{peratusKehadiran}%</span>
              </div>
            </div>

            <div className={styles.sectionHeader}><h4>Perincian Rekod Tasmik Harian</h4></div>
            
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Tarikh</th>
                  <th>Surah & Muka Surat</th>
                  <th>Gred</th>
                  <th>Catatan Pentasmik</th>
                </tr>
              </thead>
              <tbody>
                {monthEvals.map((ev, idx) => (
                  <tr key={idx}>
                    <td>{ev.tarikh}</td>
                    <td>
                      <strong>{ev.surah}</strong><br/>
                      <span style={{fontSize: '0.8rem'}}>{ev.halaman && ev.halaman !== 'Semua' ? `M/S ${ev.halaman}` : 'Penuh'}</span>
                    </td>
                    <td><strong>{ev.gred}</strong></td>
                    <td style={{ fontSize: '0.85rem' }}>{ev.catatan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* TANDATANGAN PENGESAHAN */}
            <div className={styles.signatureSection}>
              <div className={styles.signatureBox}>
                <div className={styles.signLine}>Guru Pentasmik / Pengetua</div>
              </div>
              <div className={styles.signatureBox}>
                <div className={styles.signLine}>{parentName}</div>
                <p className={styles.signRole}>Pengesahan Ibu Bapa / Penjaga</p>
              </div>
            </div>
            
          </div>
        ) : (
          <div className={`${styles.emptyState} ${styles.noPrint}`}>
            <AlertCircle size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
            <h3>Tiada Laporan Rasmi Ditemui</h3>
            <p style={{ color: '#64748b' }}>Tiada rekod penilaian direkodkan oleh guru untuk {activeChildName} bagi bulan {selectedMonth}.</p>
          </div>
        )}
      </div>

      {/* KOD CSS UNTUK PAPARAN DAN CETAKAN (PRINT) */}
      <style jsx global>{`
        @media print {
          body { background-color: white !important; margin: 0; padding: 0; }
          aside, header, .mobileMenuBtn, .noPrint { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .${styles.reportPaper} { border: none !important; box-shadow: none !important; width: 100% !important; padding: 0 !important; }
          .${styles.container} { max-width: 100% !important; padding: 0 !important; gap: 0 !important; }
        }
      `}</style>
    </DashboardIbuBapaLayout>
  );
}