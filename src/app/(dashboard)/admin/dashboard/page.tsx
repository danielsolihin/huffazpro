'use client';

import React, { useState, useEffect } from 'react';
import DashboardAdminLayout from '@/components/dashboard/DashboardAdminLayout';
import { supabase } from '@/lib/supabase';
import { 
  Users, GraduationCap, UserCheck, Award, 
  Activity, Video, FileText, TrendingUp, 
  BookOpen, CheckCircle2, AlertCircle, Clock, Info, Loader2,
  BarChart3, CalendarCheck2
} from 'lucide-react';
import Link from 'next/link';

// Helper penukaran masa ke format AM/PM
const formatTimeAMPM = (timeInput: any): string => {
  if (!timeInput || timeInput === '-') return '-';

  if (typeof timeInput === 'string') {
    let clean = timeInput
      .replace(/PETANG|PTG|MALAM|MLM/gi, 'PM')
      .replace(/PAGI|PG/gi, 'AM')
      .trim();

    if (/AM|PM/i.test(clean)) return clean;

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

export default function AdminDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [stats, setStats] = useState({
    pelajar: 0,
    guru: 0,
    waris: 0,
    kehadiranPelajar: 0,
    kehadiranGuru: 0,
    purataGred: 'Tiada Rekod'
  });

  const [aktivitiSemasa, setAktivitiSemasa] = useState<any[]>([]);
  const [kelasAktif, setKelasAktif] = useState<any[]>([]);
  
  // Data Analisis & Graf
  const [gradeDistribution, setGradeDistribution] = useState<Record<string, number>>({
    'Mumtaz': 0,
    'Jayyid Jiddan': 0,
    'Jayyid': 0,
    'Maqbul': 0,
    'Rasib': 0
  });
  const [weeklyTrends, setWeeklyTrends] = useState<{ day: string; count: number; dateStr: string }[]>([]);
  const [totalEvaluations, setTotalEvaluations] = useState(0);

  useEffect(() => {
    setMounted(true);

    const fetchAdminDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. Tarik Jumlah Pengguna Sebenar dari Supabase profiles
        const { data: users } = await supabase.from('profiles').select('id, full_name, role, class_id');
        
        let pelajarCount = 0;
        let guruCount = 0;
        let warisCount = 0;
        const allStudents = (users || []).filter((u: any) => u.role === 'Pelajar');
        const allTeachers = (users || []).filter((u: any) => u.role === 'Guru');

        if (users) {
          pelajarCount = allStudents.length;
          guruCount = allTeachers.length;
          warisCount = users.filter((u: any) => u.role === 'Waris').length;
        }

        // 2. Kira Kehadiran Hari Ini (ISO & Locale matching)
        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayLocale = now.toLocaleDateString('ms-MY');

        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('user_id, status, date');

        let hadirPelajarPct = 0;
        let hadirGuruPct = 0;

        if (attendanceData && attendanceData.length > 0) {
          const todayRecords = attendanceData.filter((a: any) => 
            a.date === todayIso || a.date === todayLocale || (a.date && a.date.includes(todayIso))
          );

          const studentUserIds = new Set(allStudents.map((s: any) => s.id));
          const teacherUserIds = new Set(allTeachers.map((t: any) => t.id));

          const hadirP = todayRecords.filter((a: any) => 
            studentUserIds.has(a.user_id) && 
            (a.status?.toLowerCase().includes('hadir') && !a.status?.toLowerCase().includes('tidak'))
          ).length;

          const hadirG = todayRecords.filter((a: any) => 
            teacherUserIds.has(a.user_id) && 
            (a.status?.toLowerCase().includes('hadir') && !a.status?.toLowerCase().includes('tidak'))
          ).length;

          if (pelajarCount > 0) hadirPelajarPct = Math.min(100, Math.round((hadirP / pelajarCount) * 100));
          if (guruCount > 0) hadirGuruPct = Math.min(100, Math.round((hadirG / guruCount) * 100));
        }

        // 3. Tarik Rekod Penilaian Hafazan untuk Analisis & Graf
        const { data: evals } = await supabase
          .from('evaluations')
          .select('*')
          .order('created_at', { ascending: false });

        let topGrade = 'Tiada Rekod';
        const gDist: Record<string, number> = {
          'Mumtaz': 0,
          'Jayyid Jiddan': 0,
          'Jayyid': 0,
          'Maqbul': 0,
          'Rasib': 0
        };

        if (evals && evals.length > 0) {
          topGrade = evals[0].gred || 'Tiada Rekod';
          setTotalEvaluations(evals.length);

          evals.forEach((ev: any) => {
            const g = ev.gred || '';
            if (g.includes('Mumtaz')) gDist['Mumtaz']++;
            else if (g.includes('Jayyid Jiddan')) gDist['Jayyid Jiddan']++;
            else if (g.includes('Jayyid')) gDist['Jayyid']++;
            else if (g.includes('Maqbul')) gDist['Maqbul']++;
            else if (g.includes('Rasib')) gDist['Rasib']++;
          });
          setGradeDistribution(gDist);

          // Kira Aktiviti Sesi Tasmik untuk 7 Hari Terkini
          const dayNames = ['Ahad', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
          const sevenDays: { day: string; count: number; dateStr: string }[] = [];

          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dLocale = d.toLocaleDateString('ms-MY');

            const count = evals.filter((ev: any) => {
              const evDate = ev.created_at ? new Date(ev.created_at).toISOString().split('T')[0] : '';
              return evDate === dIso || ev.created_at?.includes(dLocale);
            }).length;

            sevenDays.push({
              day: dayNames[d.getDay()],
              count: count,
              dateStr: d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })
            });
          }
          setWeeklyTrends(sevenDays);
        }

        setStats({
          pelajar: pelajarCount,
          guru: guruCount,
          waris: warisCount,
          kehadiranPelajar: hadirPelajarPct,
          kehadiranGuru: hadirGuruPct,
          purataGred: topGrade
        });

        // 4. Tarik Kelas Sebenar dari Supabase (Tiada LocalStorage)
        const { data: classesData } = await supabase.from('classes').select('*');
        if (classesData && classesData.length > 0) {
          const formattedClasses = classesData.map((cls: any) => {
            const enrolled = allStudents.filter((s: any) => s.class_id === cls.id);
            const teacher = allTeachers.find((t: any) => t.id === cls.teacher_id || t.id === cls.guru_id);
            return {
              id: cls.id,
              name: cls.name || cls.nama_kelas || `Kelas ${cls.id.substring(0, 4)}`,
              teacher: teacher?.full_name || cls.teacher_name || 'Guru Belum Ditetapkan',
              studentCount: enrolled.length
            };
          });
          setKelasAktif(formattedClasses);
        } else {
          setKelasAktif([]);
        }

        // 5. Tarik Log Aktiviti Terkini (Pembersihan JSON & Format Masa AM/PM)
        const { data: notifs } = await supabase
          .from('notifications')
          .select('*, profiles!notifications_sender_id_fkey(full_name)')
          .order('created_at', { ascending: false })
          .limit(6);

        if (notifs && notifs.length > 0) {
          const feed = notifs.map((n: any) => {
            let cleanMessage = n.message || '';
            // Nyahkod JSON jika butiran disimpan dalam format objek
            if (cleanMessage.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(cleanMessage);
                cleanMessage = parsed.catatan || `Sesi ${parsed.topik || ''} pada ${parsed.tarikh || ''} (${parsed.masa || ''})`;
              } catch {}
            }

            return {
              id: n.id,
              masa: formatTimeAMPM(n.created_at),
              tajuk: n.title || 'Aktiviti Sistem',
              butiran: cleanMessage,
              jenis: n.title?.includes('Ibu Bapa') || n.title?.includes('Waris') 
                ? 'waris' 
                : n.type === 'teguran' || n.type === 'jadual_adhoc' 
                ? 'guru' 
                : 'sistem'
            };
          });
          setAktivitiSemasa(feed);
        } else {
          setAktivitiSemasa([]);
        }

      } catch (error) {
        console.error("Gagal menarik data Papan Pemuka Admin:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminDashboardData();
  }, []);

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

  // Pengiraan skala ketinggian graf mingguan
  const maxWeeklyCount = Math.max(...weeklyTrends.map(t => t.count), 5);

  return (
    <DashboardAdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1240px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* HEADER ALUAN ADMIN */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', padding: '2rem', borderRadius: '16px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', fontWeight: 800 }}>Papan Pemuka Eksekutif</h1>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#bfdbfe', maxWidth: '650px', lineHeight: 1.5 }}>
              Pemantauan masa nyata pengurusan Maahad Tahfiz. Maklumat prestasi hafazan, status kehadiran, dan aktiviti terkini guru serta pelajar disegerakkan terus daripada pangkalan data.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', padding: '0.85rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#93c5fd', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>Status Pangkalan Data</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 700 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
              Supabase Terhubung & Stabil
            </div>
          </div>
        </div>

        {/* 4 KAD KPI UTAMA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          
          <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '12px', background: '#eff6ff', color: '#0062ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={28} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Jumlah Komuniti</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                {stats.pelajar + stats.guru + stats.waris} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Akaun</span>
              </h3>
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={28} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tenaga Pengajar</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                {stats.guru} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Asatizah</span>
              </h3>
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={28} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Kehadiran Pelajar</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                {stats.kehadiranPelajar}%
              </h3>
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ width: '54px', height: '54px', borderRadius: '12px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={28} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Prestasi Terkini</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#7c3aed' }}>
                {stats.purataGred}
              </h3>
            </div>
          </div>

        </div>

        {/* ================= SEKSYEN GRAF ANALISIS PROGRESS GURU & PELAJAR ================= */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          
          {/* GRAF 1: TABURAN PRESTASI GRED HAFAZAN (BAR DISTRIBUTION CHART) */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart3 size={18} color="#7c3aed" /> Analisis Pencapaian Gred Hafazan
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Berdasarkan {totalEvaluations} rekod penilaian rasmi</span>
              </div>
              <span style={{ fontSize: '0.75rem', background: '#f5f3ff', color: '#7c3aed', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
                Keseluruhan
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[
                { label: 'Mumtaz (Cemerlang)', key: 'Mumtaz', color: '#059669', bg: '#ecfdf5' },
                { label: 'Jayyid Jiddan (Sangat Baik)', key: 'Jayyid Jiddan', color: '#0062ff', bg: '#eff6ff' },
                { label: 'Jayyid (Baik)', key: 'Jayyid', color: '#d97706', bg: '#fef3c7' },
                { label: 'Maqbul (Lulus)', key: 'Maqbul', color: '#64748b', bg: '#f1f5f9' },
                { label: 'Rasib (Mengulang)', key: 'Rasib', color: '#dc2626', bg: '#fee2e2' },
              ].map(item => {
                const count = gradeDistribution[item.key] || 0;
                const percentage = totalEvaluations > 0 ? Math.round((count / totalEvaluations) * 100) : 0;
                return (
                  <div key={item.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></span>
                        {item.label}
                      </span>
                      <span>{count} Sesi ({percentage}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '9px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', background: item.color, borderRadius: '8px', transition: 'width 0.5s ease' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRAF 2: TREND SESI TASMIK 7 HARI TERKINI (COLUMN CHART) */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CalendarCheck2 size={18} color="#0062ff" /> Aktiviti Sesi Tasmik (7 Hari Terkini)
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Kadar semakan hafazan oleh guru</span>
              </div>
              <span style={{ fontSize: '0.75rem', background: '#eff6ff', color: '#0062ff', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
                Masa Nyata
              </span>
            </div>

            {/* Carta Lajur Bar */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingTop: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', gap: '0.5rem' }}>
              {weeklyTrends.map((trend, i) => {
                const barHeight = Math.max(12, Math.round((trend.count / maxWeeklyCount) * 130));
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: trend.count > 0 ? '#0062ff' : '#94a3b8' }}>
                      {trend.count}
                    </span>
                    <div 
                      style={{ 
                        width: '80%', 
                        maxWidth: '36px', 
                        height: `${barHeight}px`, 
                        background: trend.count > 0 ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)' : '#e2e8f0', 
                        borderRadius: '6px 6px 2px 2px',
                        transition: 'height 0.4s ease'
                      }}
                      title={`${trend.day} (${trend.dateStr}): ${trend.count} Sesi Tasmik`}
                    />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginTop: '0.2rem' }}>
                      {trend.day}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', padding: '0 0.25rem' }}>
              <span>Jumlah 7 Hari: <strong>{weeklyTrends.reduce((acc, curr) => acc + curr.count, 0)} Sesi Selesai</strong></span>
              <span style={{ color: '#059669', fontWeight: 700 }}>Aktif Sepanjang Minggu</span>
            </div>
          </div>

        </div>

        {/* GRID BAWAH: 65% KIRI (KELAS AKTIF SUPABASE), 35% KANAN (AKTIVITI TERKINI MURNI) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* KOLUM KIRI: KELAS AKTIF DARI SUPABASE */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BookOpen size={18} color="#059669" /> Kelas Tasmik Berdaftar (Pangkalan Data)
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Diselaraskan terus daripada jadual kelas</span>
              </div>
              <Link href="/admin/kelas" style={{ fontSize: '0.82rem', color: '#0062ff', fontWeight: 700, textDecoration: 'none' }}>Urus Kelas &rarr;</Link>
            </div>

            {kelasAktif.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <Info size={36} color="#94a3b8" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem', fontWeight: 600 }}>Tiada kelas direkodkan dalam pangkalan data.</p>
                <Link href="/admin/kelas" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.8rem', color: '#0062ff', fontWeight: 700 }}>+ Tambah Kelas Baharu</Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {kelasAktif.map((cls, index) => (
                  <div key={cls.id || index} style={{ padding: '1.1rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{cls.name}</h4>
                      <span style={{ background: '#dcfce7', color: '#166534', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>Aktif</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Guru: <strong style={{ color: '#334155' }}>{cls.teacher}</strong></p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginTop: '0.4rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                      <span style={{ color: '#0062ff' }}>{cls.studentCount} Pelajar Berdaftar</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KOLUM KANAN: ALIRAN AKTIVITI MURNI (BEBAS TEKS RAW JSON) */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="#ef4444" /> Aktiviti Terkini
            </h3>

            {aktivitiSemasa.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                <Activity size={32} color="#cbd5e1" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Tiada log aktiviti direkodkan buat masa ini.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', position: 'relative' }}>
                {/* Garis Menegak Timeline */}
                <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '10px', width: '2px', background: '#f1f5f9', zIndex: 0 }}></div>

                {aktivitiSemasa.map((act, index) => (
                  <div key={act.id || index} style={{ display: 'flex', gap: '0.85rem', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: act.jenis === 'waris' ? '#ffedd5' : act.jenis === 'guru' ? '#eff6ff' : '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #fff' }}>
                      {act.jenis === 'waris' ? <FileText size={14} color="#ea580c" /> : act.jenis === 'guru' ? <Video size={14} color="#0062ff" /> : <CheckCircle2 size={14} color="#059669" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>{act.tajuk}</span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, fontWeight: 600 }}>
                          <Clock size={11} /> {act.masa}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
                        {act.butiran}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      <style jsx global>{`
        @media (max-width: 1024px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </DashboardAdminLayout>
  );
}