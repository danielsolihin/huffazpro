'use client';

import React, { useState, useEffect } from 'react';
import DashboardIbuBapaLayout from '@/components/dashboard/DashboardIbuBapaLayout';
import { supabase } from '@/lib/supabase';
import { 
  BookOpenCheck, Award, AlertCircle, History, 
  Search, Filter, ChevronRight, X, Info, CheckCircle2,
  Bookmark, TrendingUp, Loader2
} from 'lucide-react';

interface RecordedError {
  id: string;
  ayahNum: number;
  type: string;
  selectedText: string;
}

interface EvaluationRecord {
  id: string;
  pelajar?: string;
  tarikh: string;
  surah: string;
  surahId?: number;
  halaman?: number | string;
  ayat?: number | string;
  jenisPenilaian?: string;
  gred: string;
  catatan?: string;
  errorRecords?: RecordedError[];
}

const ERROR_THEMES: Record<string, { bg: string; border: string; color: string }> = {
  'Tajwid / Dengung': { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  'Kelancaran Sangkut': { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  'Salah Baris': { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  'Makhraj Huruf': { bg: '#f5f3ff', border: '#ddd6fe', color: '#6d28d9' }
};

export default function IbuBapaKemajuanPage() {
  const [activeChildName, setActiveChildName] = useState('Memuatkan...');
  const [records, setRecords] = useState<EvaluationRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<EvaluationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Analisis Ralat
  const [errorCounts, setErrorCounts] = useState({
    tajwid: 0,
    kelancaran: 0,
    baris: 0,
    makhraj: 0,
    total: 0
  });

  const fetchKemajuanData = async () => {
    setIsLoading(true);
    try {
      // Dapatkan ID pelajar yang sedang dipilih dari Sidebar Layout
      const targetChildId = localStorage.getItem('huffazpro_active_child_id');

      if (!targetChildId) {
        setActiveChildName('Tiada Pelajar Dipautkan');
        setRecords([]);
        setIsLoading(false);
        return;
      }

      // Tarik Nama Pelajar
      const { data: childProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', targetChildId)
        .single();

      if (childProfile) {
        setActiveChildName(childProfile.full_name);
      }

      // Tarik Rekod Penilaian Pelajar dari Supabase
      const { data: evals } = await supabase
        .from('evaluations')
        .select('*')
        .eq('student_id', targetChildId)
        .order('created_at', { ascending: false });

      if (evals && evals.length > 0) {
        const mappedRecords: EvaluationRecord[] = evals.map((e: any) => {
          // Parse JSON ralat jika ada tersimpan sebagai string/jsonb
          let parsedErrors: RecordedError[] = [];
          if (e.error_records) {
            try {
              parsedErrors = typeof e.error_records === 'string' ? JSON.parse(e.error_records) : e.error_records;
            } catch (err) {
              parsedErrors = [];
            }
          }

          return {
            id: e.id,
            tarikh: new Date(e.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }),
            surah: e.surah || '',
            halaman: e.halaman || 'Semua',
            ayat: e.ayat || '-',
            jenisPenilaian: e.jenis_penilaian || 'Tasmik Bersemuka',
            gred: e.gred || '-',
            catatan: e.catatan || '',
            errorRecords: parsedErrors
          };
        });

        setRecords(mappedRecords);

        // Kira pecahan ralat daripada rekod sebenar
        let t = 0, k = 0, b = 0, m = 0;
        mappedRecords.forEach(rec => {
          if (rec.errorRecords && Array.isArray(rec.errorRecords)) {
            rec.errorRecords.forEach(err => {
              const errType = err.type || '';
              if (errType.includes('Tajwid')) t++;
              else if (errType.includes('Kelancaran')) k++;
              else if (errType.includes('Baris')) b++;
              else if (errType.includes('Makhraj')) m++;
            });
          }
        });

        setErrorCounts({
          tajwid: t,
          kelancaran: k,
          baris: b,
          makhraj: m,
          total: t + k + b + m
        });
      } else {
        setRecords([]);
        setErrorCounts({ tajwid: 0, kelancaran: 0, baris: 0, makhraj: 0, total: 0 });
      }

    } catch (error) {
      console.error('Ralat menarik rekod kemajuan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKemajuanData();

    // Dengar jika ibu bapa menukar anak di sidebar
    window.addEventListener('activeChildChanged', fetchKemajuanData);
    return () => {
      window.removeEventListener('activeChildChanged', fetchKemajuanData);
    };
  }, []);

  const filteredRecords = records.filter(r => 
    r.surah.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.gred.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.tarikh.includes(searchTerm)
  );

  const getGradeStyle = (grade: string) => {
    const g = grade.toLowerCase();
    if (g.includes('mumtaz')) return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
    if (g.includes('jiddan')) return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
    if (g.includes('jayyid')) return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
    if (g.includes('maqbul')) return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
  };

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER KEMAJUAN */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BookOpenCheck size={26} color="#059669" /> Rekod & Analisis Hafazan
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Perincian prestasi hafazan dan catatan bimbingan guru untuk <strong style={{ color: '#059669' }}>{activeChildName}</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
              Jumlah Sesi: {records.length}
            </span>
          </div>
        </div>

        {/* KAD PENJEJAK JUZUK & SASARAN */}
        <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Kedudukan Semasa</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                {records.length > 0 ? records[0].surah : 'Tiada Rekod Hafazan'}
                {records.length > 0 && records[0]?.halaman && records[0].halaman !== 'Semua' ? ` (Muka Surat ${records[0].halaman})` : ''}
              </h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '0.25rem 0.6rem', borderRadius: '6px' }}>
                Sasaran: Juzuk 1 - 5 (Sesi Semasa)
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem' }}>
              <span>Tahap Capaian Sasaran Tahunan</span>
              <span>{records.length > 0 ? Math.min(Math.round((records.length / 10) * 100), 100) : 0}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${records.length > 0 ? Math.min(Math.round((records.length / 10) * 100), 100) : 0}%`, height: '100%', background: '#059669', borderRadius: '10px', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        </div>

        {/* ANALISIS PERINGATAN KELUARGA (PANDUAN IBU BAPA DI RUMAH) */}
        <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #eef2f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertCircle size={18} color="#b45309" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Panduan Mengulang Kaji di Rumah (Fokus Teguran Guru)
            </h3>
          </div>
          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
            Berdasarkan rekod pentasmik, berikut adalah kekerapan kesalahan yang anakanda sering lakukan. Mohon ibu bapa memberi tumpuan pada aspek ini:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Tajwid & Dengung</span>
              <h2 style={{ margin: '0.3rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#1e3a8a' }}>{errorCounts.tajwid} Kali</h2>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#3b82f6' }}>Pantau kadar harakat dan ghunnah.</p>
            </div>

            <div style={{ padding: '1rem', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fde68a' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Kelancaran Bacaan</span>
              <h2 style={{ margin: '0.3rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#78350f' }}>{errorCounts.kelancaran} Kali</h2>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#d97706' }}>Kerap sangkut atau terlupa sambungan ayat.</p>
            </div>

            <div style={{ padding: '1rem', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>Salah Baris (I'rab)</span>
              <h2 style={{ margin: '0.3rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#7f1d1d' }}>{errorCounts.baris} Kali</h2>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#dc2626' }}>Tertukar baris atas/bawah/hadapan.</p>
            </div>

            <div style={{ padding: '1rem', borderRadius: '12px', background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase' }}>Makhraj Huruf</span>
              <h2 style={{ margin: '0.3rem 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#4c1d95' }}>{errorCounts.makhraj} Kali</h2>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#7c3aed' }}>Sebutan huruf halkum & lidah.</p>
            </div>
          </div>
        </div>

        {/* SENARAI SEJARAH SESI TASMIK */}
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden' }}>
          
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="#059669" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Log Sesi Tasmik Anak</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '260px' }}>
              <Search size={16} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Cari surah, tarikh atau gred..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.82rem', width: '100%', color: '#1e293b' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eef2f6', color: '#64748b' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Tarikh & Mod</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Surah & Bahagian</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Gred Keputusan</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Catatan Guru</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, textAlign: 'center' }}>Butiran</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((rec, idx) => {
                    const gradeStyle = getGradeStyle(rec.gred);
                    return (
                      <tr key={rec.id || idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <strong style={{ color: '#0f172a', display: 'block' }}>{rec.tarikh}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{rec.jenisPenilaian || 'Tasmik Bersemuka'}</span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <strong style={{ color: '#059669', fontSize: '0.9rem' }}>{rec.surah}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                            {rec.halaman && rec.halaman !== 'Semua' ? `M/S ${rec.halaman}` : 'Halaman Penuh'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.78rem', background: gradeStyle.bg, color: gradeStyle.color, border: `1px solid ${gradeStyle.border}` }}>
                            {rec.gred}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', maxWidth: '320px' }}>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            "{rec.catatan || 'Bacaan dinilai dengan lancar.'}"
                          </p>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <button 
                            type="button" 
                            onClick={() => setSelectedRecord(rec)}
                            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Lihat Butiran
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      Tiada rekod tasmik ditemui untuk anakanda {activeChildName}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL PERINCIAN SESI & TEGURAN KHAS */}
      {selectedRecord && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Butiran Sesi Tasmik</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedRecord.tarikh} • {selectedRecord.surah}</span>
              </div>
              <button type="button" onClick={() => setSelectedRecord(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Keputusan Gred</span>
                  <p style={{ margin: '0.2rem 0 0 0', fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>{selectedRecord.gred}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Halaman Disemak</span>
                  <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>
                    {selectedRecord.halaman && selectedRecord.halaman !== 'Semua' ? `M/S ${selectedRecord.halaman}` : 'Semua Halaman'}
                  </p>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={14} color="#059669" /> Catatan Pentasmik:
                </span>
                <div style={{ marginTop: '0.4rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.88rem', color: '#166534', lineHeight: 1.5, fontStyle: 'italic' }}>
                  "{selectedRecord.catatan || 'Tiada catatan tambahan daripada ustaz.'}"
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Teguran & Kalimah Yang Ditanda ({selectedRecord.errorRecords?.length || 0}):
                  </span>
                </div>

                {selectedRecord.errorRecords && selectedRecord.errorRecords.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {selectedRecord.errorRecords.map((err, i) => {
                      const theme = ERROR_THEMES[err.type] || { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' };
                      return (
                        <div key={err.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '8px', background: theme.bg, border: `1px solid ${theme.border}` }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: theme.color }}>Ayat {err.ayahNum}</span>
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#fff', color: theme.color, border: `1px solid ${theme.border}` }}>
                              {err.type}
                            </span>
                          </div>
                          <div style={{ fontFamily: '"Amiri Quran", "Traditional Arabic", serif', fontSize: '1.3rem', color: '#0f172a', direction: 'rtl' }}>
                            {err.selectedText}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.85rem' }}>
                    Alhamdulillah, tiada sebarang ralat spesifik ditandakan pada sesi ini.
                  </div>
                )}
              </div>

            </div>

            <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSelectedRecord(null)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </DashboardIbuBapaLayout>
  );
}