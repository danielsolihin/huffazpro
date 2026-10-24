'use client';

import React, { useState, useEffect } from 'react';
import DashboardAdminLayout from '@/components/dashboard/DashboardAdminLayout';
import { supabase } from '@/lib/supabase';
import { 
  UserCheck, Calendar, CheckCircle2, XCircle, 
  FileText, Eye, Search, Loader2, Clock, AlertCircle
} from 'lucide-react';

interface TeacherLeaveItem {
  id: string;
  teacher_id: string;
  teacher_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string;
  status: 'Menunggu' | 'Diluluskan' | 'Ditolak';
  admin_remarks?: string;
  created_at: string;
}

export default function AdminKehadiranDanCutiPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminId, setAdminId] = useState('');

  const [leaves, setLeaves] = useState<TeacherLeaveItem[]>([]);
  const [activeTab, setActiveTab] = useState<'semua' | 'Menunggu' | 'Diluluskan' | 'Ditolak'>('Menunggu');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Tindakan
  const [selectedLeave, setSelectedLeave] = useState<TeacherLeaveItem | null>(null);
  const [actionType, setActionType] = useState<'Diluluskan' | 'Ditolak'>('Diluluskan');
  const [remarks, setRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchTeacherLeaves = async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) setAdminId(authData.user.id);

      const { data, error } = await supabase
        .from('teacher_leaves')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setLeaves(data as TeacherLeaveItem[]);
      }
    } catch (err) {
      console.error('Ralat menarik permohonan cuti guru:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchTeacherLeaves();
  }, []);

  const handleOpenAction = (item: TeacherLeaveItem, type: 'Diluluskan' | 'Ditolak') => {
    setSelectedLeave(item);
    setActionType(type);
    setRemarks(type === 'Diluluskan' ? 'Permohonan cuti disahkan dan diluluskan oleh pihak pentadbiran.' : 'Permohonan cuti tidak dapat diluluskan.');
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('teacher_leaves')
        .update({
          status: actionType,
          admin_remarks: remarks.trim()
        })
        .eq('id', selectedLeave.id);

      if (error) throw error;

      // Hantar notifikasi kepada Guru pemohon
      await supabase.from('notifications').insert([{
        user_id: selectedLeave.teacher_id,
        sender_id: adminId,
        type: 'info',
        title: `Status Permohonan Cuti: ${actionType}`,
        message: `Permohonan ${selectedLeave.leave_type} anda (${selectedLeave.start_date} - ${selectedLeave.end_date}) telah ${actionType.toLowerCase()} oleh pihak Pentadbiran. Catatan: "${remarks.trim()}"`
      }]);

      alert(`Permohonan cuti ${selectedLeave.teacher_name} telah berjaya ${actionType.toLowerCase()}!`);
      setSelectedLeave(null);
      fetchTeacherLeaves();
    } catch (err: any) {
      alert(`Gagal memproses permohonan: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredLeaves = leaves.filter(item => {
    const matchStatus = activeTab === 'semua' || item.status === activeTab;
    const matchSearch = item.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        item.leave_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (!mounted) return null;

  return (
    <DashboardAdminLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
        
        {/* HEADER */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <UserCheck size={26} color="#0062ff" /> Pengurusan & Kelulusan Cuti Guru
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Semak dokumen MC dan buat pengesahan cuti guru-guru maahad.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.45rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800 }}>
              {leaves.filter(l => l.status === 'Menunggu').length} Permohonan Menunggu
            </span>
          </div>
        </div>

        {/* TAPISAN & CARIAN */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', background: '#e2e8f0', padding: '0.25rem', borderRadius: '10px' }}>
            {(['Menunggu', 'Diluluskan', 'Ditolak', 'semua'] as const).map(tab => (
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
                {tab === 'semua' ? 'Semua Status' : tab}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari guru / jenis cuti..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#fff' }}
            />
          </div>
        </div>

        {/* JADUAL SENARAI PERMOHONAN */}
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <Loader2 className="animate-spin" size={32} color="#0062ff" />
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>Tiada Permohonan Cuti</p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>Tiada permohonan cuti guru di bawah status {activeTab}.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '1rem 1.25rem' }}>Nama Guru</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Kategori Cuti</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Tarikh Cuti</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Sebab & Dokumen</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{item.teacher_name}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Dihantar: {new Date(item.created_at).toLocaleDateString('ms-MY')}
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        {item.leave_type}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                        <strong>{item.start_date}</strong><br />
                        <span style={{ color: '#94a3b8' }}>hingga</span><br />
                        <strong>{item.end_date}</strong>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', maxWidth: '300px' }}>
                        <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>
                          "{item.reason}"
                        </p>
                        {item.attachment_url ? (
                          <button
                            type="button"
                            onClick={() => window.open(item.attachment_url, '_blank')}
                            style={{ background: '#eff6ff', color: '#0062ff', border: '1px solid #bfdbfe', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={12} /> Buka Dokumen MC
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Tiada Lampiran</span>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '20px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: item.status === 'Diluluskan' ? '#dcfce7' : item.status === 'Ditolak' ? '#fee2e2' : '#fef3c7',
                          color: item.status === 'Diluluskan' ? '#15803d' : item.status === 'Ditolak' ? '#b91c1c' : '#b45309'
                        }}>
                          {item.status}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        {item.status === 'Menunggu' ? (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenAction(item, 'Diluluskan')}
                              style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Luluskan
                            </button>
                            <button
                              onClick={() => handleOpenAction(item, 'Ditolak')}
                              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Selesai ({item.status})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* MODAL KELULUSAN ADMIN */}
      {selectedLeave && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: actionType === 'Diluluskan' ? '#059669' : '#dc2626' }}>
                {actionType === 'Diluluskan' ? 'Luluskan Permohonan Cuti Guru' : 'Tolak Permohonan Cuti Guru'}
              </h3>
              <button type="button" onClick={() => setSelectedLeave(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAction} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155' }}>
                Pemohon: <strong>{selectedLeave.teacher_name}</strong><br />
                Kategori: <strong>{selectedLeave.leave_type}</strong><br />
                Tarikh: <strong>{selectedLeave.start_date}</strong> hingga <strong>{selectedLeave.end_date}</strong>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                  Catatan / Ulasan Pentadbir *
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Masukkan ulasan pentadbir..."
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedLeave(null)}
                  style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: actionType === 'Diluluskan' ? '#059669' : '#dc2626',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isProcessing ? 'Memproses...' : 'Sahkan Keputusan'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </DashboardAdminLayout>
  );
}