'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { 
  GraduationCap, BookOpen, UserCheck, Users, 
  ArrowUpRight, ArrowRight, Download, CheckCircle2, Loader2 
} from 'lucide-react';
import Link from 'next/link';
import styles from './Dashboard.module.css';

// Label Asas untuk Carta Titik (Graf)
const baseDotLabels = [
  'Jan 1', 'Jan 15', 'Feb 1', 'Feb 15', 'Mac 1', 'Mac 15', 'Apr 1', 'Apr 15',
  'Mei 1', 'Mei 15', 'Jun 1', 'Jun 15', 'Jul 1', 'Jul 15', 'Ogo 1', 'Ogo 15',
  'Sep 1', 'Sep 15', 'Okt 1', 'Okt 15', 'Nov 1', 'Nov 15', 'Dis 1'
];

export default function PelajarDashboardPage() {
  const [activeDotIndex, setActiveDotIndex] = useState<number | null>(null);

  // STATE UNTUK DATA DINAMIK DARI SUPABASE
  const [isLoading, setIsLoading] = useState(true);
  const [studentName, setStudentName] = useState('Pelajar');
  const [rekodSemakan, setRekodSemakan] = useState<any[]>([]);
  const [statistikSurah, setStatistikSurah] = useState<any[]>([]);
  
  // STATE KAD & CARTA DINAMIK
  const [stats, setStats] = useState({ surah: 0, mukaSurat: 0, sesi: 0, mutqan: 0, kedudukan: 0 });
  const [barData, setBarData] = useState<any[]>([]);
  const [dotData, setDotData] = useState<any[]>(baseDotLabels.map(label => ({ label, actual: 0 })));

  const chartHeight = 180;
  const chartWidth = 580; 
  const startX = 35; 
  const startY = 30;
  const dotRadius = 7.5; 
  const dotSpacingY = 18; 
  const svgTotalWidth = chartWidth + startX + 30;

  const getX = (index: number) => startX + (index * (chartWidth / (dotData.length - 1)));
  const getY = (dotCount: number) => startY + chartHeight - (Math.min(dotCount, 12) * dotSpacingY);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. Tarik Data Sesi Pengguna Semasa
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;
        
        const userId = authData.user.id;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();
          
        if (profile?.full_name) {
          setStudentName(profile.full_name);
        }

        // 2. Tarik Rekod Penilaian (Tasmik) dari Supabase bersama Nama Guru
        const { data: evals } = await supabase
          .from('evaluations')
          .select('*, profiles!evaluations_teacher_id_fkey(full_name)')
          .eq('student_id', userId)
          .order('created_at', { ascending: false });

        let allRecords: any[] = [];

        if (evals && evals.length > 0) {
          allRecords = evals.map((r: any) => ({
            id: r.id,
            teacher: r.profiles?.full_name || 'Guru Pentasmik',
            surah: r.surah || 'Al-Quran',
            gred: r.gred || 'Tiada Gred',
            rawDate: new Date(r.created_at).getTime(),
            type: r.type || 'Bersemuka'
          }));
        }

        setRekodSemakan(allRecords.slice(0, 4));

        // 3. Kira Kekerapan Surah Utama
        const surahCounts: Record<string, number> = {};
        allRecords.forEach(r => {
          const sName = r.surah.trim();
          if (sName && sName !== 'Al-Quran') {
            surahCounts[sName] = (surahCounts[sName] || 0) + 1;
          }
        });

        const sortedSurahs = Object.keys(surahCounts)
          .map(k => ({ name: k, count: surahCounts[k] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        setStatistikSurah(sortedSurahs);

        // 4. Logik Kad Statistik
        const totalSesi = allRecords.length;
        const mutqanSesi = allRecords.filter(r => r.gred.toLowerCase().includes('mumtaz') || r.gred.toLowerCase().includes('jiddan') || r.gred.toLowerCase().includes('jayyid')).length;
        const jumlahSurahUnik = Object.keys(surahCounts).length;
        
        setStats({
          surah: jumlahSurahUnik,
          mukaSurat: totalSesi * 2, // Anggaran 2 M/S per sesi
          sesi: totalSesi,
          mutqan: mutqanSesi,
          kedudukan: totalSesi > 0 ? 1 : 0
        });

        // 5. CARTA BAR (6 BULAN LEPAS)
        const monthNamesShort = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
        const currentMonthNum = new Date().getMonth();
        const last6Months = [];
        
        for (let i = 5; i >= 0; i--) {
          let mIndex = (currentMonthNum - i + 12) % 12;
          last6Months.push({ index: mIndex, name: monthNamesShort[mIndex], count: 0 });
        }

        allRecords.forEach(r => {
          const rMonth = new Date(r.rawDate).getMonth();
          const found = last6Months.find(m => m.index === rMonth);
          if (found) found.count++;
        });

        const maxBar = Math.max(...last6Months.map(m => m.count), 5); 
        const dynamicBarData = last6Months.map((m, idx) => ({
          m: m.name,
          h: `${Math.max((m.count / maxBar) * 100, 10)}%`, 
          val: `${m.count} Sesi`,
          active: idx === 5 
        }));
        setBarData(dynamicBarData);

        // 6. CARTA TITIK (PENCAPAIAN TAHUNAN)
        const dynamicDots = baseDotLabels.map(label => ({ label, actual: 0 }));
        
        allRecords.forEach(r => {
           const d = new Date(r.rawDate);
           const month = d.getMonth();
           const date = d.getDate();
           const binIndex = (month * 2) + (date >= 15 ? 1 : 0);
           if(binIndex >= 0 && binIndex < dynamicDots.length) {
              dynamicDots[binIndex].actual += 1;
           }
        });
        
        setDotData(dynamicDots);

      } catch (err) {
        console.error("Gagal memuatkan data dari Supabase:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getGredDetails = (gred: string) => {
    const g = gred.toLowerCase();
    if (g.includes('mumtaz')) return { pct: '98%', label: 'Mutqan', color: '#0062ff', bg: '#eff6ff' };
    if (g.includes('jiddan')) return { pct: '90%', label: 'Lancar', color: '#059669', bg: '#ecfdf5' };
    if (g.includes('jayyid')) return { pct: '85%', label: 'Baik', color: '#b45309', bg: '#fffbeb' };
    if (g.includes('maqbul')) return { pct: '75%', label: 'Sederhana', color: '#475569', bg: '#f8fafc' };
    return { pct: '50%', label: 'Lemah', color: '#dc2626', bg: '#fef2f2' };
  };

  const getInitials = (name: string) => {
    const words = name.replace('Ustaz ', '').replace('Ustazah ', '').split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

 if (isLoading) {
  return (
    <DashboardLayout userName={studentName} userRole="Pelajar">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '65vh',
          gap: '1.25rem',
          textAlign: 'center',
          padding: '2rem'
        }}
      >
        {/* Ikon Animasi Spinner Moden */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '3px solid #e0e7ff',
              borderTopColor: '#0062ff',
              animation: 'spin 0.9s linear infinite'
            }}
          />
          <BookOpen
            size={22}
            color="#0062ff"
            style={{ position: 'absolute', opacity: 0.9 }}
          />
        </div>

        {/* Teks Pengesahan & Loading */}
        <div>
          <h3
            style={{
              margin: '0 0 0.4rem 0',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em'
            }}
          >
            HuffazPro sedang mengesahkan rekod...
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: '#64748b',
              fontWeight: 500
            }}
          >
            Memuatkan maklumat sesi tasmik dan prestasi hafazan anda. Sila tunggu sebentar.
          </p>
        </div>

        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}

  return (
    <DashboardLayout userName={studentName} userRole="Pelajar">
      <div className={styles.dashboardWrapper}>
        
        {/* HEADER ATAS DENGAN GREETING ASSALAMUALAIKUM */}
        <div className={styles.topHeader}>
          <div>
            <h1 className={styles.headerTitle}>Dashboard</h1>
            <p className={styles.headerSubtitle}>
              Assalamualaikum, <strong style={{ color: '#0f172a' }}>{studentName}!</strong>
            </p>
          </div>
        </div>

        {/* 4 KAD STATISTIK (DINAMIK) */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statCardTop}>
              <div className={styles.statIconBox}><GraduationCap size={24} /></div>
              <div><p className={styles.statMetaTitle}>Surah Dihafal</p><h2 className={styles.statValue}>{stats.surah}</h2></div>
            </div>
            <div className={styles.statDivider}></div>
            <div className={styles.statFootRow}><span>Berdasarkan: <span className={styles.statHighlight}>Rekod Sistem</span></span></div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardTop}>
              <div className={`${styles.statIconBox} ${styles.statIconCyan}`}><BookOpen size={24} /></div>
              <div><p className={styles.statMetaTitle}>Anggaran Muka Surat</p><h2 className={styles.statValue}>{stats.mukaSurat}</h2></div>
            </div>
            <div className={styles.statDivider}></div>
            <div className={styles.statFootRow}><span>Kiraan: <span className={styles.statHighlight}>Dari Sesi Tasmik</span></span></div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardTop}>
              <div className={styles.statIconBox}><UserCheck size={24} /></div>
              <div><p className={styles.statMetaTitle}>Sesi Tasmik Selesai</p><h2 className={styles.statValue}>{stats.sesi}</h2></div>
            </div>
            <div className={styles.statDivider}></div>
            <div className={styles.statFootRow}><span>Lulus Mutqan: <span className={styles.statHighlight}>{stats.mutqan}</span></span></div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statCardTop}>
              <div className={`${styles.statIconBox} ${styles.statIconCyan}`}><Users size={24} /></div>
              <div><p className={styles.statMetaTitle}>Kedudukan Hafazan</p><h2 className={styles.statValue}>{stats.kedudukan}</h2></div>
            </div>
            <div className={styles.statDivider}></div>
            <div className={styles.statFootRow}><span>Status Kumpulan: <span className={styles.statHighlight}>Aktif</span></span></div>
          </div>
        </div>

        {/* BARIS TENGAH: CARTA DOT & CARTA BAR */}
        <div className={styles.chartsGrid}>
          
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle} style={{fontSize: '1.1rem', color: '#1e293b', fontWeight: 800}}>Analitik Prestasi Hafazan</h3>
              <div className={styles.headerActions}>
                <select className={styles.selectDropdown} defaultValue="Keseluruhan"><option>Keseluruhan</option></select>
                <select className={styles.selectDropdown} defaultValue="6 Bulan Lepas"><option>6 Bulan Lepas</option></select>
                <button className={styles.headerActionBtn} style={{border: 'none'}}><Download size={18} color="#64748b"/></button>
              </div>
            </div>

            <div className={styles.dotChartLayout}>
              <div className={styles.chartInfoPanel}>
                <div className={styles.legendRow}>
                  <div className={`${styles.legendDot} ${styles.dotGreen}`}></div> Sebenar (Juzuk / Muka Surat)
                </div>
              </div>

              <div className={styles.svgChartContainer} onMouseLeave={() => setActiveDotIndex(null)}>
                <div 
                  className={`${styles.chartTooltip} ${activeDotIndex !== null ? styles.show : ''}`}
                  style={{ 
                    left: activeDotIndex !== null ? `${(getX(activeDotIndex) / svgTotalWidth) * 100}%` : '0%', 
                    top: activeDotIndex !== null ? getY(dotData[activeDotIndex].actual) : 0 
                  }}
                >
                  <div className={styles.tooltipRow} style={{marginBottom: 0}}>
                    <span>Nilai Prestasi:</span> 
                    <span className={styles.tooltipVal}>{activeDotIndex !== null && dotData[activeDotIndex].actual}</span>
                  </div>
                </div>

                <svg viewBox={`0 0 ${svgTotalWidth} 250`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  {[0, 4, 8, 12].map((val) => {
                    const yPos = getY(val);
                    const isHoverMatched = activeDotIndex !== null && dotData[activeDotIndex].actual >= val && dotData[activeDotIndex].actual < val + 4;
                    return (
                      <g key={`y-${val}`}>
                        {activeDotIndex !== null && isHoverMatched ? (
                          <foreignObject x="-20" y={yPos - 12} width="40" height="24">
                            <div className={styles.yAxisHighlight}>{val}</div>
                          </foreignObject>
                        ) : (
                          <text x={startX - 15} y={yPos + 4} fontSize="11" fill="#94a3b8" textAnchor="end" fontWeight="600">{val}</text>
                        )}
                        <line x1={startX} y1={yPos} x2={startX + chartWidth} y2={yPos} stroke="#f1f5f9" strokeDasharray="3 3" />
                      </g>
                    );
                  })}

                  {activeDotIndex !== null && (
                    <g>
                      <circle cx={getX(activeDotIndex)} cy={getY(dotData[activeDotIndex].actual)} r={dotRadius + 1} fill="#8b5cf6" stroke="#ddd6fe" strokeWidth="2.5" />
                      <line x1={startX} y1={getY(dotData[activeDotIndex].actual)} x2={getX(activeDotIndex)} y2={getY(dotData[activeDotIndex].actual)} className={styles.hoverGuideline} />
                      <line x1={getX(activeDotIndex)} y1={getY(dotData[activeDotIndex].actual)} x2={getX(activeDotIndex)} y2={startY + chartHeight} className={styles.hoverGuideline} />
                    </g>
                  )}

                  {dotData.map((col, i) => {
                    const xPos = getX(i);
                    const isHovered = activeDotIndex === i;
                    const displayActual = Math.min(col.actual, 12); 
                    return (
                      <g key={`col-${i}`} className={styles.hoverColGroup} onMouseEnter={() => setActiveDotIndex(i)}>
                        <rect x={xPos - 12} y="0" width="24" height={chartHeight + 40} className={styles.hoverColTarget} />
                        {Array.from({ length: displayActual }).map((_, dotIdx) => {
                          let dColor = '#38bdf8'; 
                          if (isHovered) {
                            dColor = '#8b5cf6'; 
                          } else if (dotIdx === displayActual - 1) {
                            dColor = '#0ea5e9'; 
                          }
                          return <circle key={`dot-${i}-${dotIdx}`} cx={xPos} cy={getY(dotIdx + 0.5)} r={dotRadius} fill={dColor} style={{transition: 'fill 0.2s ease'}}/>;
                        })}
                      </g>
                    );
                  })}

                  {dotData.map((d, i) => {
                    if (i % 2 !== 0 && activeDotIndex !== i) return null;
                    return (
                      <g key={`x-${i}`}>
                        {activeDotIndex === i ? (
                          <foreignObject x={getX(i) - 30} y={startY + chartHeight + 12} width="60" height="24">
                            <div className={styles.xAxisHighlight}>{d.label}</div>
                          </foreignObject>
                        ) : (
                          <text x={getX(i)} y={startY + chartHeight + 25} fontSize="11" fill="#94a3b8" textAnchor="middle" fontWeight="600">{d.label.split(' ')[0]}</text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div className={styles.chartHeaderLeft}>
                <div className={styles.chartBadgeIcon}><GraduationCap size={20} /></div>
                <div><h3 className={styles.chartTitle} style={{fontSize: '1.05rem', color: '#1e293b', fontWeight: 800}}>Sesi Mengulang</h3></div>
              </div>
              <select className={styles.selectDropdown} defaultValue="6 Bulan"><option>6 Bulan</option></select>
            </div>

            <div className={styles.barChartWrapper}>
              {barData.length > 0 && barData.map((item, idx) => (
                <div key={idx} className={styles.barCol}>
                  <div className={styles.barTooltipTag}>{item.val}</div>
                  <div className={styles.barTrack}><div className={`${styles.barFill} ${item.active ? styles.barFillActive : ''}`} style={{ height: item.h }}></div></div>
                  <span className={styles.barLabel} style={{color: item.active ? '#1e293b' : '#64748b', fontWeight: item.active ? 800 : 600}}>{item.m}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* BARIS BAWAH: SENARAI REKOD & SURAH FOKUS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
          
          <div className={styles.listCard} style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#0062ff"/> Rekod Semakan Terkini
              </h3>
              <select style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', outline: 'none' }}>
                <option>Keseluruhan</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {rekodSemakan.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada rekod penilaian dijumpai buat masa ini. Guru anda belum merekodkan sebarang semakan.</div>
              ) : (
                rekodSemakan.map((rekod, index) => {
                  const gredInfo = getGredDetails(rekod.gred);
                  return (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                          {getInitials(rekod.teacher)}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{rekod.teacher}</p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Sesi {rekod.type}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'right' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rekod.surah}</p>
                          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: gredInfo.color }}>
                            {gredInfo.pct} {gredInfo.label}
                          </p>
                        </div>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: gredInfo.bg, color: gredInfo.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className={styles.listCard} style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="#0062ff"/> Surah Utama & Status
              </h3>
              <Link href="/pelajar/tasmik-live" style={{ fontSize: '0.8rem', color: '#0062ff', fontWeight: 600, textDecoration: 'none' }}>Tasmik <ArrowUpRight size={15}/></Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {statistikSurah.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada data surah direkodkan.</div>
              ) : (
                statistikSurah.map((surah, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: idx !== statistikSurah.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Surah {surah.name}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Berdasarkan Rekod Terkini</p>
                      </div>
                    </div>
                    <span style={{ padding: '0.3rem 0.8rem', background: '#eff6ff', color: '#0062ff', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                      {surah.count} Sesi
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}