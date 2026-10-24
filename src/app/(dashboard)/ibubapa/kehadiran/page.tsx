'use client';

import React, { useState, useEffect } from 'react';
import DashboardIbuBapaLayout from '@/components/dashboard/DashboardIbuBapaLayout';
import { supabase } from '@/lib/supabase';
import { 
  CalendarCheck, CalendarX, Clock, AlertTriangle, 
  FileText, Upload, Plus, CheckCircle2, X, Search, 
  Filter, Calendar, ShieldAlert, Loader2
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  tarikh: string;
  masa?: string;
  status: string;
  justifikasi?: string;
  pengesahanPenjaga?: boolean;
  dokumenSokongan?: string;
}

export default function IbuBapaKehadiranPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // State Anak Dinamik
  const [activeChildData, setActiveChildData] = useState<any>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  
  const [filterMonth, setFilterMonth] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');

  // Modal Permohonan Cuti / MC
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveType, setLeaveType] = useState('Cuti Sakit (MC)');
  const [leaveReason, setLeaveReason] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchKehadiranData = async () => {
    setIsLoading(true);
    try {
      // Dapatkan ID pelajar yang sedang dipilih dari Sidebar Layout
      const targetChildId = localStorage.getItem('huffazpro_active_child_id');

      if (!targetChildId) {
        setActiveChildData(null);
        setAttendance([]);
        setIsLoading(false);
        return;
      }

      // Tarik Nama Pelajar Sebenar
      const { data: childProfile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', targetChildId)
        .single();

      if (childProfile) {
        setActiveChildData(childProfile);
      }

      // Tarik Rekod Kehadiran Pelajar dari Supabase
      const { data: attData, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', targetChildId)
        .order('created_at', { ascending: false });

      if (attData && attData.length > 0) {
        const mappedAtt = attData.map((a: any) => ({
          id: a.id,
          tarikh: new Date(a.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }),
          masa: new Date(a.created_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
          status: a.status || 'Tidak Hadir',
          justifikasi: a.notes || a.justifikasi || '',
          pengesahanPenjaga: a.status.includes('Cuti') || a.status.includes('Sakit') ? true : false,
          dokumenSokongan: ''
        }));
        setAttendance(mappedAtt);
      } else {
        setAttendance([]);
      }

    } catch (error) {
      console.error('Ralat menarik rekod kehadiran:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchKehadiranData();

    // Dengar jika ibu bapa menukar pilihan anak di sidebar
    window.addEventListener('activeChildChanged', fetchKehadiranData);
    return () => {
      window.removeEventListener('activeChildChanged', fetchKehadiranData);
    };
  }, []);

  // Statistik Ringkas Kehadiran
  const totalHari = attendance.length;
  const hadirCount = attendance.filter(a => a.status.includes('Hadir') && !a.status.includes('Tidak')).length;
  const tidakHadirCount = attendance.filter(a => a.status.includes('Tidak Hadir') || a.status.includes('Lewat')).length;
  const cutiCount = attendance.filter(a => a.status.includes('Cuti') || a.status.includes('Sakit')).length;
  const peratusHadir = totalHari > 0 ? Math.round((hadirCount / totalHari) * 100) : 0;

  // Hantar Permohonan Cuti / Justifikasi Penjaga ke Supabase
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate || !leaveReason || !activeChildData) {
      alert('Sila lengkapkan tarikh dan alasan cuti.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simpan terus ke jadual attendance supaya cikgu nampak
      const { error } = await supabase.from('attendance').insert({
        user_id: activeChildData.id,
        status: leaveType,
        notes: `[Tarikh Cuti: ${leaveDate}] ${leaveReason} ${fileName ? `(Lampiran: ${fileName})` : ''}`
      });

      if (error) throw error;

      // Refresh Data selepas hantar
      await fetchKehadiranData();

      // Reset borang
      setLeaveDate('');
      setLeaveReason('');
      setFileName('');
      setIsLeaveModalOpen(false);
      alert('Alhamdulillah. Permohonan cuti / slip sokongan berjaya dihantar dan direkodkan ke portal guru.');
    } catch (err: any) {
      alert(`Gagal menghantar permohonan: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status.includes('Hadir') && !status.includes('Tidak')) {
      return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', label: status };
    }
    if (status.includes('Cuti') || status.includes('Sakit')) {
      return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: status };
    }
    return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: status };
  };

  const filteredAttendance = attendance.filter(a => {
    const matchStatus = filterStatus === 'Semua' || a.status.toLowerCase().includes(filterStatus.toLowerCase());
    const matchMonth = filterMonth === 'Semua' || a.tarikh.includes(filterMonth);
    return matchStatus && matchMonth;
  });

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

  // Jika tiada rekod anak dipautkan
  if (!activeChildData) {
    return (
      <DashboardIbuBapaLayout>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
          <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Tiada Rekod Pelajar Dipautkan</h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            Akaun anda belum diikat dengan mana-mana rekod anak/pelajar.
          </p>
        </div>
      </DashboardIbuBapaLayout>
    );
  }

  return (
    <DashboardIbuBapaLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER KEHADIRAN */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CalendarCheck size={26} color="#059669" /> Rekod Kehadiran & Pengurusan Cuti
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Pantau waktu log masuk kelas dan urus justifikasi ketidakhadiran bagi <strong style={{ color: '#059669' }}>{activeChildData.full_name}</strong>.
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => setIsLeaveModalOpen(true)}
            style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)' }}
          >
            <Plus size={18} /> Mohon Cuti / Hantar MC
          </button>
        </div>

        {/* 4 KAD STATISTIK KEHADIRAN */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #eef2f6' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Kadar Kehadiran</span>
            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: peratusHadir >= 90 ? '#059669' : '#dc2626' }}>
              {peratusHadir}%
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sasaran Institusi: 90%</span>
          </div>

          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #eef2f6' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Hari Hadir</span>
            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
              {hadirCount} Hari
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Kelas fizikal & dalam talian</span>
          </div>

          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #eef2f6' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tidak Hadir (Tanpa Sebab)</span>
            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: tidakHadirCount > 0 ? '#dc2626' : '#64748b' }}>
              {tidakHadirCount} Hari
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Perlu tindakan segera</span>
          </div>

          <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #eef2f6' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cuti / Kebenaran Sah</span>
            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#1d4ed8' }}>
              {cutiCount} Hari
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Disahkan oleh penjaga</span>
          </div>
        </div>

        {/* LOG REKOD JADUAL KEHADIRAN */}
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden' }}>
          
          {/* PENAPIS */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Log Kehadiran Harian
            </h3>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, color: '#334155', background: '#f8fafc', outline: 'none' }}
              >
                <option value="Semua">Semua Status</option>
                <option value="Hadir">Hadir Sahaja</option>
                <option value="Tidak Hadir">Tidak Hadir Sahaja</option>
                <option value="Cuti">Cuti / Sakit Sahaja</option>
              </select>
            </div>
          </div>

          {/* JADUAL KEHADIRAN */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eef2f6', color: '#64748b' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Tarikh Kelas</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Status Kehadiran</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Waktu Log Masuk</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700 }}>Catatan & Justifikasi Penjaga</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length > 0 ? (
                  filteredAttendance.map((item) => {
                    const badge = getStatusBadge(item.status);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#0f172a' }}>
                          {item.tarikh}
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span style={{ padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', color: '#475569', fontWeight: 600 }}>
                          {item.masa || '-'}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', color: '#334155' }}>
                          {item.justifikasi ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>{item.justifikasi}</span>
                              {item.pengesahanPenjaga && (
                                <span style={{ fontSize: '0.7rem', color: '#059669', background: '#ecfdf5', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                                  Disahkan Penjaga
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      Tiada rekod kehadiran direkodkan dalam sistem buat masa ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL PERMOHONAN CUTI / MC */}
      {isLeaveModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Permohonan Cuti / Hantar MC</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Borang Pengesahan Rasmi Waris</span>
              </div>
              <button 
                type="button" 
                onClick={() => setIsLeaveModalOpen(false)} 
                style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Tarikh Cuti / Ketidakhadiran
                </label>
                <input 
                  type="date" 
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Jenis Permohonan
                </label>
                <select 
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                >
                  <option value="Cuti Sakit (MC)">Cuti Sakit (Bersama Slip MC)</option>
                  <option value="Kecemasan Keluarga">Kecemasan Keluarga</option>
                  <option value="Urusan Rasmi Luar">Urusan Rasmi Luar</option>
                  <option value="Cuti Rehat / Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Sebab & Justifikasi Penjaga
                </label>
                <textarea 
                  rows={3}
                  placeholder="Nyatakan sebab tidak dapat menghadiri kelas..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Lampiran Dokumen / Slip MC (Pilihan)
                </label>
                <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }}>
                  <input 
                    type="file" 
                    id="mcFile" 
                    style={{ display: 'none' }} 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFileName(e.target.files[0].name);
                      }
                    }} 
                  />
                  <label htmlFor="mcFile" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                    <Upload size={20} color="#059669" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>
                      {fileName ? fileName : 'Pilih fail gambar resit atau PDF'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Format PNG, JPG atau PDF</span>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsLeaveModalOpen(false)}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Hantar Permohonan
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </DashboardIbuBapaLayout>
  );
}