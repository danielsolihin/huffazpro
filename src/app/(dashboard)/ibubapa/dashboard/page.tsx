'use client';

import React, { useState, useEffect } from 'react';
import DashboardIbuBapaLayout from '@/components/dashboard/DashboardIbuBapaLayout';
import { supabase } from '@/lib/supabase';
import { 
  Book, BookOpen, Award, CalendarCheck, CheckCircle2, 
  AlertCircle, ShieldCheck, Clock, MessageSquare, Loader2,
  BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import Link from 'next/link';

// IMPORT COMPONENT CARTA RECHARTS
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function IbuBapaDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [parentId, setParentId] = useState('');
  
  // Data Anak Aktif
  const [activeChildData, setActiveChildData] = useState<any>(null);
  
  // Laporan & Statistik
  const [lastEval, setLastEval] = useState<any>(null);
  const [attendanceRate, setAttendanceRate] = useState<number>(100);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [teacherName, setTeacherName] = useState('Guru Pentasmik');
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  
  // STATE JUZUK SEMASA & CARTA
  const [juzukSemasa, setJuzukSemasa] = useState<string>('Juzuk 2');
  const [barData, setBarData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    fetchParentDashboardData();

    const handleChildChange = () => fetchParentDashboardData();
    window.addEventListener('activeChildChanged', handleChildChange);

    return () => {
      window.removeEventListener('activeChildChanged', handleChildChange);
    };
  }, []);

  const fetchParentDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const pId = authData.user.id;
      setParentId(pId);

      const { data: children } = await supabase
        .from('profiles')
        .select('id, full_name, matrik_or_id') 
        .ilike('role', '%elajar%')
        .eq('parent_id', pId);

      if (!children || children.length === 0) {
        setActiveChildData(null);
        setIsLoading(false);
        return;
      }

      const savedChildId = localStorage.getItem('huffazpro_active_child_id');
      let currentChild = children[0]; 

      if (savedChildId) {
        const found = children.find(c => c.id === savedChildId);
        if (found) currentChild = found;
      }

      setActiveChildData(currentChild);

      // Tarik penilaian anak yang sedang aktif
      const { data: evals } = await supabase
        .from('evaluations')
        .select('*, profiles!evaluations_teacher_id_fkey(full_name)')
        .eq('student_id', currentChild.id)
        .order('created_at', { ascending: false });

      if (evals && evals.length > 0) {
        setJuzukSemasa('Juzuk 2');

        setLastEval({
          surah: evals[0].surah,
          halaman: evals[0].halaman || 'Halaman Penuh',
          gred: evals[0].gred,
          tarikh: new Date(evals[0].created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }),
          catatan: evals[0].catatan
        });
        setTotalSessions(evals.length);
        
        if (evals[0].profiles?.full_name) {
          setTeacherName(evals[0].profiles.full_name);
        }

        // BINA DATA CARTA PIE DARI SEJARAH PENILAIAN SEBENAR
        const gredCounts: Record<string, number> = { 'Mumtaz': 0, 'Jayyid Jiddan': 0, 'Jayyid': 0, 'Maqbul / Rasib': 0 };
        evals.forEach((e: any) => {
          if (e.gred === 'Mumtaz') gredCounts['Mumtaz']++;
          else if (e.gred === 'Jayyid Jiddan') gredCounts['Jayyid Jiddan']++;
          else if (e.gred === 'Jayyid') gredCounts['Jayyid']++;
          else gredCounts['Maqbul / Rasib']++;
        });

        const totalEvals = evals.length;
        setPieData([
          { name: 'Mumtaz', value: Math.round((gredCounts['Mumtaz'] / totalEvals) * 100) || 0, color: '#10b981' },
          { name: 'Jayyid Jiddan', value: Math.round((gredCounts['Jayyid Jiddan'] / totalEvals) * 100) || 0, color: '#3b82f6' },
          { name: 'Jayyid', value: Math.round((gredCounts['Jayyid'] / totalEvals) * 100) || 0, color: '#f59e0b' },
          { name: 'Lain-lain', value: Math.round((gredCounts['Maqbul / Rasib'] / totalEvals) * 100) || 0, color: '#ef4444' },
        ]);

      } else {
        setLastEval(null);
        setTotalSessions(0);
        setTeacherName('Guru Pentasmik');
        setJuzukSemasa('Tiada Rekod');
        
        // Data Mock Carta Pie Kosong
        setPieData([
          { name: 'Mumtaz', value: 45, color: '#10b981' },
          { name: 'Jayyid Jiddan', value: 30, color: '#3b82f6' },
          { name: 'Jayyid', value: 15, color: '#f59e0b' },
          { name: 'Lain-lain', value: 10, color: '#ef4444' },
        ]);
      }

      // DATA MOCK CARTA BAR
      setBarData([
        { bulan: 'Mei', halaman: 12 },
        { bulan: 'Jun', halaman: 18 },
        { bulan: 'Jul', halaman: 15 },
        { bulan: 'Ogo', halaman: 22 },
        { bulan: 'Sep', halaman: 28 },
        { bulan: 'Okt', halaman: 14 },
      ]);

      // Tarik kehadiran anak yang sedang aktif
      const { data: att } = await supabase
        .from('attendance')
        .select('status')
        .eq('user_id', currentChild.id);

      if (att && att.length > 0) {
        const present = att.filter((a: any) => a.status.includes('Hadir')).length;
        setAttendanceRate(Math.round((present / att.length) * 100));
      } else {
        setAttendanceRate(0);
      }

    } catch (error) {
      console.error("Gagal menarik data Papan Pemuka:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = () => {
    setIsAcknowledged(true);
  };

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

  if (!activeChildData) {
    return (
      <DashboardIbuBapaLayout>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
          <AlertCircle size={48} color="#f59e0b" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Tiada Rekod Pelajar Dipautkan</h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            Akaun anda belum diikat dengan mana-mana rekod anak/pelajar.
          </p>
          <Link href="/ibubapa/tetapan" style={{ background: '#059669', color: '#fff', padding: '0.8rem 1.5rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>
            Pautkan Anak Anda Sekarang
          </Link>
        </div>
      </DashboardIbuBapaLayout>
    );
  }

  return (
    <DashboardIbuBapaLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER ALUAN */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Papan Pemuka Waris</h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Memantau disiplin kehadiran dan perkembangan hafazan anakanda <strong style={{ color: '#059669' }}>{activeChildData.full_name}</strong>.
            </p>
          </div>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.5rem 1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontSize: '0.85rem', fontWeight: 700 }}>
            <ShieldCheck size={18} color="#059669" /> Status Pengawasan Aktif
          </div>
        </div>

        {/* 5 KAD METRIK UTAMA GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          
          {/* 1. JUZUK SEMASA */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #eef2f6', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Book size={24} /></div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Juzuk Semasa</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{juzukSemasa}</h3>
              <span style={{ fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 600 }}>Sasaran Tahunan</span>
            </div>
          </div>

          {/* 2. SURAH SEMASA */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '2px solid #10b981', boxShadow: '0 4px 10px rgba(16,185,129,0.1)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={24} /></div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Surah Semasa</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{lastEval ? lastEval.surah : 'Tiada Rekod'}</h3>
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>{lastEval?.halaman ? lastEval.halaman : '-'}</span>
            </div>
          </div>

          {/* 3. KEPUTUSAN TERKINI */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #eef2f6', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#0062ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Award size={24} /></div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Keputusan Terkini</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#0062ff' }}>{lastEval ? `Gred ${lastEval.gred}` : '-'}</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{lastEval ? lastEval.tarikh : 'Belum dinilai'}</span>
            </div>
          </div>

          {/* 4. KADAR KEHADIRAN */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #eef2f6', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarCheck size={24} /></div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Kadar Kehadiran</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{attendanceRate}%</h3>
              <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Rekod Keseluruhan</span>
            </div>
          </div>

          {/* 5. JUMLAH SESI */}
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #eef2f6', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fdf4ff', color: '#c026d3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={24} /></div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Jumlah Sesi Tasmik</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#c026d3' }}>{totalSessions > 0 ? `${totalSessions} Sesi` : 'Tiada Sesi'}</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Bersemuka & Live</span>
            </div>
          </div>
        </div>

        {/* CARTA STATISTIK KEMAJUAN (BAR & PIE) - DIALIHKAN KE ATAS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          
          {/* CARTA BAR: PRESTASI BULANAN */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #eef2f6', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#3b82f6' }}><BarChart3 size={20} /></div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Kuantiti Hafazan Bulanan (Halaman)</h3>
            </div>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="bulan" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="halaman" name="Jumlah Halaman" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CARTA PAI: KUALITI KESELURUHAN GRED */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #eef2f6', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
              <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px', color: '#10b981' }}><PieChartIcon size={20} /></div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Pecahan Kualiti Gred Keseluruhan</h3>
            </div>
            <div style={{ width: '100%', height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                    formatter={(value) => [`${value}%`, 'Peratusan Keseluruhan']}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* BAHAGIAN CATATAN GURU PENTASMIK - DIALIHKAN KE BAWAH */}
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} color="#059669" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Ulasan Terkini Guru Pentasmik ({teacherName})
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{lastEval ? lastEval.tarikh : 'Belum Ada Penilaian'}</span>
          </div>

          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', borderLeft: '4px solid #3b82f6', marginBottom: '1.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.6 }}>
              "{lastEval?.catatan || 'Guru belum merekodkan sebarang catatan atau ulasan baharu untuk sesi ini.'}"
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Status Pengakuan Penjaga: {isAcknowledged ? <strong style={{ color: '#059669' }}>✓ Telah Disahkan</strong> : <span style={{ color: '#dc2626' }}>Belum Diakui</span>}
            </span>
            {!isAcknowledged ? (
              <button onClick={handleAcknowledge} disabled={!lastEval} style={{ background: lastEval ? '#10b981' : '#cbd5e1', color: '#fff', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: lastEval ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Sahkan & Tanda Telah Dibaca
              </button>
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={16} /> Terima kasih, makluman disahkan.
              </span>
            )}
          </div>
        </div>

      </div>
    </DashboardIbuBapaLayout>
  );
}