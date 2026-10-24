'use client';

import React, { useState, useEffect } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  DollarSign, Plus, Clock, FileText, Send, 
  CheckCircle2, XCircle, AlertCircle, Loader2, Eye, Printer, Trash2
} from 'lucide-react';

interface MyClaimRecord {
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
  status: 'Menunggu' | 'Diluluskan' | 'Dibayar' | 'Ditolak';
  admin_remarks?: string;
  created_at: string;
}

const MONTH_LIST = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
];

export default function GuruTuntutanPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('Guru');

  // BORANG TUNTUTAN
  const currentYear = new Date().getFullYear();
  const currentMonthName = MONTH_LIST[new Date().getMonth()];
  const [claimMonth, setClaimMonth] = useState(`${currentMonthName} ${currentYear}`);
  const [category, setCategory] = useState('Sesi Tasmik Bersemuka');
  const [totalHours, setTotalHours] = useState<number>(10);
  const [ratePerUnit, setRatePerUnit] = useState<number>(25);
  const [bankName, setBankName] = useState('Maybank');
  const [bankAccount, setBankAccount] = useState('');

  // SEJARAH TUNTUTAN GURU
  const [myClaims, setMyClaims] = useState<MyClaimRecord[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<MyClaimRecord | null>(null);

  const fetchGuruClaims = async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const tId = authData.user.id;
      setTeacherId(tId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', tId)
        .single();

      if (profile?.full_name) {
        setTeacherName(profile.full_name);
      }

      const { data: claimsData } = await supabase
        .from('teacher_claims')
        .select('*')
        .eq('teacher_id', tId)
        .order('created_at', { ascending: false });

      if (claimsData) {
        setMyClaims(claimsData as MyClaimRecord[]);
      }
    } catch (err) {
      console.error('Ralat menarik rekod tuntutan guru:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchGuruClaims();
  }, []);

  const totalAmount = totalHours * ratePerUnit;

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalHours || totalHours <= 0) {
      alert('Sila masukkan bilangan jam yang sah.');
      return;
    }
    if (!bankAccount.trim()) {
      alert('Sila masukkan nombor akaun bank untuk tujuan pembayaran.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        teacher_id: teacherId,
        teacher_name: teacherName,
        claim_month: claimMonth,
        category: category,
        total_hours: Number(totalHours),
        rate_per_unit: Number(ratePerUnit),
        total_amount: Number(totalAmount),
        bank_name: bankName,
        bank_account: bankAccount.trim(),
        status: 'Menunggu'
      };

      const { error } = await supabase.from('teacher_claims').insert([payload]);
      if (error) throw error;

      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'Admin');

      if (adminUsers && adminUsers.length > 0) {
        const notifPayload = adminUsers.map(adm => ({
          user_id: adm.id,
          sender_id: teacherId,
          type: 'info',
          title: `Tuntutan Elaun Baru: ${teacherName}`,
          message: `${teacherName} telah menghantar tuntutan elaun bagi ${claimMonth} berjumlah RM${totalAmount.toFixed(2)}.`
        }));
        await supabase.from('notifications').insert(notifPayload);
      }

      alert('Borang tuntutan elaun anda telah berjaya dihantar ke Bahagian Pentadbiran!');
      fetchGuruClaims();
    } catch (err: any) {
      alert(`Gagal menghantar tuntutan: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerPrint = () => {
    setTimeout(() => {
      window.print();
    }, 200);
  };

  if (!mounted) return null;

  return (
    <DashboardGuruLayout userName={teacherName} userRole="Ketua Pentasmik">
      
      {/* 1. PAPARAN BIASA DASHBOARD (DISEMBUNYIKAN SEMASA CETAK) */}
      <div className="no-print" style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
        
        {/* HEADER */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <DollarSign size={26} color="#059669" /> Tuntutan Elaun Mengajar Guru
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Isi borang tuntutan bulanan bagi sesi tasmik dan cetak baucar rasmi yang telah diluluskan pentadbiran.
            </p>
          </div>
        </div>

        {/* KANDUNGAN UTAMA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 400px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* BORANG HANTAR TUNTUTAN */}
          <form 
            onSubmit={handleSubmitClaim}
            style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Borang Tuntutan Baharu
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Bulan Tuntutan
              </label>
              <select
                value={claimMonth}
                onChange={(e) => setClaimMonth(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#f8fafc' }}
              >
                {MONTH_LIST.map(m => (
                  <option key={m} value={`${m} ${currentYear}`}>{m} {currentYear}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Kategori Sesi Pengajaran
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#f8fafc' }}
              >
                <option value="Sesi Tasmik Bersemuka">Sesi Tasmik Bersemuka</option>
                <option value="Sesi Tasmik Live (Online)">Sesi Tasmik Live (Online)</option>
                <option value="Kelas Bimbingan Murajaah Khas">Kelas Bimbingan Murajaah Khas</option>
                <option value="Kuliah / Bengkel Tajwid Rasmi">Kuliah / Bengkel Tajwid Rasmi</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Jumlah Jam
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={totalHours}
                  onChange={(e) => setTotalHours(Number(e.target.value))}
                  required
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Kadar / Jam (RM)
                </label>
                <input
                  type="number"
                  min="1"
                  value={ratePerUnit}
                  onChange={(e) => setRatePerUnit(Number(e.target.value))}
                  required
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ background: '#ecfdf5', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#047857' }}>Jumlah Tuntutan:</span>
              <strong style={{ fontSize: '1.25rem', color: '#047857' }}>RM {totalAmount.toFixed(2)}</strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Nama Bank
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#f8fafc' }}
                >
                  <option value="Maybank">Maybank</option>
                  <option value="CIMB Bank">CIMB Bank</option>
                  <option value="Bank Islam">Bank Islam</option>
                  <option value="Bank Muamalat">Bank Muamalat</option>
                  <option value="RHB Bank">RHB Bank</option>
                  <option value="Public Bank">Public Bank</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  No. Akaun Bank
                </label>
                <input
                  type="text"
                  placeholder="cth: 1642... "
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '0.5rem'
              }}
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Hantar Borang Tuntutan
            </button>
          </form>

          {/* SEJARAH TUNTUTAN GURU */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Rekod Tuntutan Anda ({myClaims.length})
              </h3>
            </div>

            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '560px', overflowY: 'auto' }}>
              {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 className="animate-spin" size={30} color="#059669" />
                </div>
              ) : myClaims.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <FileText size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>Tiada Rekod Tuntutan</p>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>Semua borang tuntutan elaun yang anda hantar akan terpapar di sini.</p>
                </div>
              ) : (
                myClaims.map((claim) => (
                  <div
                    key={claim.id}
                    style={{
                      padding: '1rem 1.25rem',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                        {claim.claim_month}
                      </span>

                      <span style={{
                        padding: '0.2rem 0.65rem',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: claim.status === 'Dibayar' ? '#dcfce7' : claim.status === 'Diluluskan' ? '#eff6ff' : claim.status === 'Ditolak' ? '#fee2e2' : '#fef3c7',
                        color: claim.status === 'Dibayar' ? '#15803d' : claim.status === 'Diluluskan' ? '#1d4ed8' : claim.status === 'Ditolak' ? '#b91c1c' : '#b45309'
                      }}>
                        {claim.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                      {claim.category} • <strong>{claim.total_hours} Jam</strong> @ RM{claim.rate_per_unit}/jam
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', borderTop: '1px dashed #f1f5f9', paddingTop: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Jumlah Elaun: </span>
                        <strong style={{ fontSize: '1rem', color: '#059669' }}>RM {Number(claim.total_amount).toFixed(2)}</strong>
                      </div>

                      {claim.status !== 'Ditolak' && (
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(claim)}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#0062ff',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Printer size={13} /> Lihat Baucar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 2. MODAL PRATONTON DI SKRIN (DISEMBUNYIKAN SECARA MUTLAK SEMASA CETAK) */}
      {selectedVoucher && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '2rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Pratonton Baucar Tuntutan Elaun
              </h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={handleTriggerPrint}
                  style={{ background: '#0062ff', color: '#ffffff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> Cetak Sekarang
                </button>
                <button 
                  onClick={() => setSelectedVoucher(null)}
                  style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Tutup
                </button>
              </div>
            </div>

            {/* KOTAK BAUCAR PRATONTON */}
            <div style={{ border: '2px solid #0f172a', padding: '2rem', borderRadius: '8px', background: '#fff' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, textTransform: 'uppercase', color: '#000' }}>MAAHAD TAHFIZ HUFFAZPRO MALAYSIA</h2>
                <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', color: '#000', fontWeight: 600 }}>BAUCAR TUNTUTAN ELAUN PENGAJIAN & TASMIK</p>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>No. Rujukan: VCH-{selectedVoucher.id.substring(0, 8).toUpperCase()}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem', marginBottom: '1.5rem', color: '#000' }}>
                <div>
                  <p style={{ margin: '0 0 0.3rem 0' }}>Nama Guru: <strong>{selectedVoucher.teacher_name}</strong></p>
                  <p style={{ margin: '0 0 0.3rem 0' }}>Bulan Tuntutan: <strong>{selectedVoucher.claim_month}</strong></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 0.3rem 0' }}>Bank: <strong>{selectedVoucher.bank_name || '-'}</strong></p>
                  <p style={{ margin: '0 0 0.3rem 0' }}>No. Akaun: <strong>{selectedVoucher.bank_account || '-'}</strong></p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '2rem', color: '#000' }}>
                <thead>
                  <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', background: '#f8fafc' }}>
                    <th style={{ padding: '0.6rem' }}>Perkara / Butiran Sesi</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Jumlah Jam</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Kadar (RM)</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Jumlah (RM)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '0.75rem 0.6rem' }}>{selectedVoucher.category}</td>
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'center' }}>{selectedVoucher.total_hours}</td>
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>{Number(selectedVoucher.rate_per_unit).toFixed(2)}</td>
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>{Number(selectedVoucher.total_amount).toFixed(2)}</td>
                  </tr>
                  <tr style={{ fontWeight: 800, borderTop: '2px solid #000' }}>
                    <td colSpan={3} style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>JUMLAH TUNTUTAN ELAUN:</td>
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right', fontSize: '1.1rem' }}>RM {Number(selectedVoucher.total_amount).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', textAlign: 'center', marginTop: '3rem', paddingTop: '1rem', color: '#000' }}>
                <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>Disediakan Oleh</p>
                  <span style={{ fontSize: '0.72rem' }}>({selectedVoucher.teacher_name})</span>
                </div>
                <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>Disemak Oleh</p>
                  <span style={{ fontSize: '0.72rem' }}>(Bahagian Pentadbiran)</span>
                </div>
                <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>Status Kelulusan</p>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>({selectedVoucher.status})</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. DOKUMEN CETAKAN RASMI (HANYA KELUAR PADA MASA CETAK KE KERTAS / PDF) */}
      {selectedVoucher && (
        <div className="print-container">
          <div style={{ border: '2px solid #000', padding: '30px', borderRadius: '4px', background: '#fff' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '15px', marginBottom: '25px' }}>
              <h2 style={{ margin: 0, fontSize: '20pt', fontWeight: 800, textTransform: 'uppercase', color: '#000' }}>MAAHAD TAHFIZ HUFFAZPRO MALAYSIA</h2>
              <p style={{ margin: '6px 0', fontSize: '12pt', fontWeight: 700, color: '#000' }}>BAUCAR TUNTUTAN ELAUN PENGAJIAN & TASMIK</p>
              <span style={{ fontSize: '10pt', color: '#333' }}>No. Rujukan: VCH-{selectedVoucher.id.substring(0, 8).toUpperCase()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', marginBottom: '25px', color: '#000', lineHeight: 1.6 }}>
              <div>
                <p style={{ margin: 0 }}>Nama Guru: <strong>{selectedVoucher.teacher_name}</strong></p>
                <p style={{ margin: 0 }}>Bulan Tuntutan: <strong>{selectedVoucher.claim_month}</strong></p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0 }}>Bank: <strong>{selectedVoucher.bank_name || '-'}</strong></p>
                <p style={{ margin: 0 }}>No. Akaun: <strong>{selectedVoucher.bank_account || '-'}</strong></p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '35px', color: '#000', fontSize: '11pt' }}>
              <thead>
                <tr style={{ borderTop: '2px solid #000', borderBottom: '2px solid #000', background: '#f5f5f5' }}>
                  <th style={{ padding: '10px' }}>Perkara / Butiran Sesi</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Jumlah Jam</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Kadar (RM)</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Jumlah (RM)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td style={{ padding: '12px 10px' }}>{selectedVoucher.category}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>{selectedVoucher.total_hours}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>{Number(selectedVoucher.rate_per_unit).toFixed(2)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>{Number(selectedVoucher.total_amount).toFixed(2)}</td>
                </tr>
                <tr style={{ fontWeight: 800, borderTop: '2px solid #000', background: '#fbfbfb' }}>
                  <td colSpan={3} style={{ padding: '12px 10px', textAlign: 'right' }}>JUMLAH TUNTUTAN KESELURUHAN:</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: '13pt' }}>RM {Number(selectedVoucher.total_amount).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', marginTop: '60px', color: '#000' }}>
              <div style={{ width: '28%', borderTop: '1px solid #000', paddingTop: '8px' }}>
                <p style={{ margin: 0, fontSize: '10pt', fontWeight: 700 }}>Disediakan Oleh</p>
                <span style={{ fontSize: '9pt' }}>({selectedVoucher.teacher_name})</span>
              </div>
              <div style={{ width: '28%', borderTop: '1px solid #000', paddingTop: '8px' }}>
                <p style={{ margin: 0, fontSize: '10pt', fontWeight: 700 }}>Disemak Oleh</p>
                <span style={{ fontSize: '9pt' }}>(Bahagian Pentadbiran)</span>
              </div>
              <div style={{ width: '28%', borderTop: '1px solid #000', paddingTop: '8px' }}>
                <p style={{ margin: 0, fontSize: '10pt', fontWeight: 700 }}>Status Pembayaran</p>
                <span style={{ fontSize: '9pt', fontWeight: 800 }}>({selectedVoucher.status})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GAYA CETAKAN DOKUMEN BEBAS ISU BLANK */}
      <style jsx global>{`
        @media screen {
          .print-container {
            display: none !important;
          }
        }
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container, .print-container * {
            visibility: visible !important;
          }
          .print-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 15mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
            z-index: 999999 !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </DashboardGuruLayout>
  );
}