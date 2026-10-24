'use client';

import React, { useState, useEffect } from 'react';
import DashboardAdminLayout from '@/components/dashboard/DashboardAdminLayout';
import { supabase } from '@/lib/supabase';
import { 
  DollarSign, CheckCircle2, Clock, Printer, Eye, 
  Search, Filter, Loader2, X, FileText
} from 'lucide-react';

interface TeacherClaimRecord {
  id: string;
  teacher_id: string;
  teacher_name: string;
  claim_month: string;
  category: string;
  total_hours: number;
  rate_per_unit: number;
  total_amount: number;
  bank_name?: string;
  bank_account?: string;
  attachment_url?: string;
  status: 'Menunggu' | 'Diluluskan' | 'Dibayar' | 'Ditolak';
  admin_remarks?: string;
  created_at: string;
}

export default function AdminTuntutanGuruPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [claims, setClaims] = useState<TeacherClaimRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'semua' | 'Menunggu' | 'Diluluskan' | 'Dibayar' | 'Ditolak'>('Menunggu');
  const [searchQuery, setSearchQuery] = useState('');

  // STATE MODAL BAUCAR CETAKAN
  const [selectedVoucher, setSelectedVoucher] = useState<TeacherClaimRecord | null>(null);

  const fetchClaims = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('teacher_claims')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setClaims(data as TeacherClaimRecord[]);
      }
    } catch (err) {
      console.error('Ralat menarik senarai tuntutan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchClaims();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'Diluluskan' | 'Dibayar' | 'Ditolak') => {
    try {
      const { error } = await supabase
        .from('teacher_claims')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      alert(`Status tuntutan telah dikemaskini kepada: ${newStatus}`);
      fetchClaims();
    } catch (err: any) {
      alert(`Gagal kemaskini status: ${err.message}`);
    }
  };

  const filteredClaims = claims.filter(c => {
    const matchTab = activeTab === 'semua' || c.status === activeTab;
    const matchSearch = c.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        c.claim_month.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  const totalAmountSemua = claims.filter(c => c.status !== 'Ditolak').reduce((sum, c) => sum + Number(c.total_amount), 0);
  const totalMenunggu = claims.filter(c => c.status === 'Menunggu').reduce((sum, c) => sum + Number(c.total_amount), 0);

  if (!mounted) return null;

  return (
    <DashboardAdminLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
        
        {/* HEADER */}
        <div className="no-print" style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <DollarSign size={26} color="#059669" /> Pengurusan & Tuntutan Elaun Guru
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Pantau penyata elaun mengajar bulanan guru dan cetak baucar bayaran rasmi.
            </p>
          </div>
        </div>

        {/* STATISTIK */}
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #eef2f6' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>JUMLAH TUNTUTAN AKTIF</p>
            <h3 style={{ margin: '0.35rem 0 0 0', fontSize: '1.35rem', color: '#0f172a' }}>RM {totalAmountSemua.toFixed(2)}</h3>
          </div>
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #eef2f6' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#b45309', fontWeight: 700 }}>BELUM DILULUSKAN</p>
            <h3 style={{ margin: '0.35rem 0 0 0', fontSize: '1.35rem', color: '#d97706' }}>RM {totalMenunggu.toFixed(2)}</h3>
          </div>
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #eef2f6' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>JUMLAH PERMOHONAN</p>
            <h3 style={{ margin: '0.35rem 0 0 0', fontSize: '1.35rem', color: '#047857' }}>{claims.length} Borang</h3>
          </div>
        </div>

        {/* TAB & CARIAN */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', background: '#e2e8f0', padding: '0.25rem', borderRadius: '10px' }}>
            {(['Menunggu', 'Diluluskan', 'Dibayar', 'Ditolak', 'semua'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? '#ffffff' : 'transparent',
                  color: activeTab === tab ? '#0f172a' : '#64748b',
                  border: 'none',
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {tab === 'semua' ? 'Semua Rekod' : tab}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari guru / bulan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#fff' }}
            />
          </div>
        </div>

        {/* JADUAL TUNTUTAN */}
        <div className="no-print" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <Loader2 className="animate-spin" size={32} color="#0062ff" />
            </div>
          ) : filteredClaims.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>Tiada Rekod Tuntutan</p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>Tiada borang tuntutan di bawah status {activeTab}.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '1rem 1.25rem' }}>Guru Pentasmik</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Bulan</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Kategori & Sesi</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Amaun (RM)</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{item.teacher_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {item.bank_name || 'Bank'}: {item.bank_account || '-'}
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        {item.claim_month}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                        {item.category}<br />
                        <span style={{ color: '#0062ff', fontWeight: 700 }}>{item.total_hours} Jam</span> @ RM{item.rate_per_unit}/jam
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <strong style={{ fontSize: '1rem', color: '#059669' }}>
                          RM {Number(item.total_amount).toFixed(2)}
                        </strong>
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '20px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: item.status === 'Dibayar' ? '#dcfce7' : item.status === 'Diluluskan' ? '#eff6ff' : item.status === 'Ditolak' ? '#fee2e2' : '#fef3c7',
                          color: item.status === 'Dibayar' ? '#15803d' : item.status === 'Diluluskan' ? '#1d4ed8' : item.status === 'Ditolak' ? '#b91c1c' : '#b45309'
                        }}>
                          {item.status}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setSelectedVoucher(item)}
                            style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Papar dan Cetak Baucar"
                          >
                            <Printer size={13} /> Baucar
                          </button>

                          {item.status === 'Menunggu' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'Diluluskan')}
                                style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Lulus
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'Ditolak')}
                                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Tolak
                              </button>
                            </>
                          )}

                          {item.status === 'Diluluskan' && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'Dibayar')}
                              style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Tanda Telah Dibayar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* MODAL PRINTABLE BAUCAR RASMI */}
      {selectedVoucher && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1rem' }}>
          <div className="printable-voucher-card" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '2.5rem' }}>
            
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => window.print()}
                style={{ background: '#0062ff', color: '#ffffff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} /> Cetak Baucar Ini
              </button>
              <button 
                onClick={() => setSelectedVoucher(null)}
                style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>

            {/* TEMPLATE DOKUMEN BAUCAR CETAK */}
            <div style={{ border: '2px solid #0f172a', padding: '2rem', borderRadius: '8px', background: '#fff' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase' }}>MAAHAD TAHFIZ HUFFAZPRO MALAYSIA</h2>
                <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#475569' }}>BAUCAR TUNTUTAN ELAUN PENGAJIAN & TASMIK</p>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No. Rujukan: VCH-{selectedVoucher.id.substring(0, 8).toUpperCase()}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.3rem 0' }}>Nama Guru: <strong>{selectedVoucher.teacher_name}</strong></p>
                  <p style={{ margin: '0 0 0.3rem 0' }}>Bulan Tuntutan: <strong>{selectedVoucher.claim_month}</strong></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 0.3rem 0' }}>Bank: <strong>{selectedVoucher.bank_name || '-'}</strong></p>
                  <p style={{ margin: '0 0 0.3rem 0' }}>No. Akaun: <strong>{selectedVoucher.bank_account || '-'}</strong></p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderTop: '1px solid #0f172a', borderBottom: '1px solid #0f172a' }}>
                    <th style={{ padding: '0.6rem' }}>Perkara / Butiran Sesi</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Jumlah Jam</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Kadar (RM)</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Jumlah (RM)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem 0.6rem' }}>{selectedVoucher.category}</td>
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'center' }}>{selectedVoucher.total_hours}</td>
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>{Number(selectedVoucher.rate_per_unit).toFixed(2)}</td>
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>{Number(selectedVoucher.total_amount).toFixed(2)}</td>
                  </tr>
                  <tr style={{ fontWeight: 800, borderTop: '2px solid #0f172a' }}>
                    <td colSpan={3} style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>JUMLAH KESELURUHAN DILULUSKAN:</td>
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right', fontSize: '1.1rem' }}>RM {Number(selectedVoucher.total_amount).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', textAlign: 'center', marginTop: '3.5rem', paddingTop: '1rem' }}>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>Disediakan Oleh</p>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>({selectedVoucher.teacher_name})</span>
                </div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>Disemak Oleh</p>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>(Bahagian Pentadbiran)</span>
                </div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>Diluluskan Oleh</p>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>(Pengetua / Bendahari)</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* GAYA CETAKAN GLOBAL */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .printable-voucher-card, .printable-voucher-card * { visibility: visible; }
          .printable-voucher-card { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </DashboardAdminLayout>
  );
}