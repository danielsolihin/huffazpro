'use client';

import React, { useState, useEffect } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, CheckCircle2, XCircle, Clock, FileText, 
  Eye, Filter, MessageSquare, AlertCircle, Loader2, Search
} from 'lucide-react';

interface StudentLeaveItem {
  id: string;
  student_id: string;
  student_name: string;
  class_id?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string;
  status: 'Menunggu' | 'Diluluskan' | 'Ditolak';
  teacher_remarks?: string;
  created_at: string;
}

export default function GuruKelulusanCutiPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('Guru');

  const [leaves, setLeaves] = useState<StudentLeaveItem[]>([]);
  const [activeTab, setActiveTab] = useState<'semua' | 'Menunggu' | 'Diluluskan' | 'Ditolak'>('Menunggu');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Tindakan (Lulus / Tolak)
  const [selectedLeave, setSelectedLeave] = useState<StudentLeaveItem | null>(null);
  const [actionType, setActionType] = useState<'Diluluskan' | 'Ditolak'>('Diluluskan');
  const [remarks, setRemarks] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchLeavesData = async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const tId = authData.user.id;
      setTeacherId(tId);

      const { data: profile } = await supabase.from('profiles').select('full_name, class_id').eq('id', tId).single();
      if (profile) setTeacherName(profile.full_name || 'Guru');

      // Ambil senarai kelas di bawah seliaan guru
      const { data: classesData } = await supabase.from('classes').select('id').eq('teacher_id', tId);
      const classIds = (classesData || []).map(c => c.id);
      if (profile?.class_id && !classIds.includes(profile.class_id)) {
        classIds.push(profile.class_id);
      }

      // Tarik permohonan cuti sama ada di-assign terus kepada guru atau kelas guru
      let query = supabase.from('student_leaves').select('*').order('created_at', { ascending: false });

      if (classIds.length > 0) {
        query = query.or(`teacher_id.eq.${tId},class_id.in.(${classIds.join(',')})`);
      } else {
        query = query.eq('teacher_id', tId);
      }

      const { data: leaveData, error } = await query;
      if (!error && leaveData) {
        setLeaves(leaveData as StudentLeaveItem[]);
      }
    } catch (err) {
      console.error('Ralat menarik senarai cuti:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchLeavesData();
  }, []);

  const handleOpenActionModal = (leave: StudentLeaveItem, type: 'Diluluskan' | 'Ditolak') => {
    setSelectedLeave(leave);
    setActionType(type);
    setRemarks(type === 'Diluluskan' ? 'Permohonan cuti disahkan dan diluluskan.' : 'Permohonan cuti tidak dapat diluluskan.');
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;

    setIsProcessing(true);
    try {
      // 1. Kemaskini status permohonan cuti di pangkalan data
      const { error } = await supabase
        .from('student_leaves')
        .update({
          status: actionType,
          teacher_remarks: remarks.trim()
        })
        .eq('id', selectedLeave.id);

      if (error) throw error;

      // 2. Hantar notifikasi maklum balas kepada pelajar
      await supabase.from('notifications').insert([{
        user_id: selectedLeave.student_id,
        sender_id: teacherId,
        type: 'info',
        title: `Status Cuti: ${actionType}`,
        message: `Permohonan ${selectedLeave.leave_type} anda (${selectedLeave.start_date} - ${selectedLeave.end_date}) telah ${actionType.toLowerCase()} oleh ${teacherName}. Ulasan: "${remarks.trim()}"`
      }]);

      // 3. Hantar notifikasi kepada waris jika pelajar mempunyai pautan waris
      const { data: studentProfile } = await supabase
        .from('profiles')
        .select('parent_id')
        .eq('id', selectedLeave.student_id)
        .single();

      if (studentProfile?.parent_id) {
        await supabase.from('notifications').insert([{
          user_id: studentProfile.parent_id,
          sender_id: teacherId,
          type: 'info',
          title: `Makluman Cuti Anak: ${actionType}`,
          message: `Permohonan ${selectedLeave.leave_type} bagi anak anda ${selectedLeave.student_name} telah ${actionType.toLowerCase()} oleh guru kelas.`
        }]);
      }

      alert(`Permohonan cuti bagi ${selectedLeave.student_name} telah berjaya ${actionType.toLowerCase()}!`);
      setSelectedLeave(null);
      fetchLeavesData();
    } catch (err: any) {
      alert(`Gagal memproses permohonan: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredLeaves = leaves.filter(item => {
    const matchTab = activeTab === 'semua' || item.status === activeTab;
    const matchSearch = item.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        item.leave_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  if (!mounted) return null;

  return (
    <DashboardGuruLayout userName={teacherName} userRole="Ketua Pentasmik">
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
        
        {/* HEADER */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Calendar size={26} color="#0062ff" /> Pengesahan & Kelulusan Cuti Pelajar
            </h1>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
              Semak dokumen MC dan justifikasi ketidakhadiran pelajar di bawah kelas seliaan anda.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.4rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800 }}>
              {leaves.filter(l => l.status === 'Menunggu').length} Menunggu Tindakan
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
                {tab === 'semua' ? 'Semua Rekod' : tab}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari nama pelajar / jenis cuti..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#fff' }}
            />
          </div>
        </div>

        {/* JADUAL SENARAI PERMOHONAN */}
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <Loader2 className="animate-spin" size={32} color="#0062ff" />
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
              <CheckCircle2 size={42} color="#10b981" style={{ margin: '0 auto 0.75rem auto', opacity: 0.6 }} />
              <h3 style={{ margin: '0 0 0.35rem 0', color: '#334155' }}>Tiada Permohonan Cuti</h3>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Tiada rekod pelajar di bawah kategori {activeTab}.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '1rem 1.25rem' }}>Pelajar</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Jenis Cuti</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Tempoh Tarikh</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Sebab & Dokumen</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{item.student_name}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Mohon: {new Date(item.created_at).toLocaleDateString('ms-MY')}
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                        {item.leave_type}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                        <strong>{item.start_date}</strong><br />
                        <span style={{ color: '#94a3b8' }}>hingga</span><br />
                        <strong>{item.end_date}</strong>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', maxWidth: '280px' }}>
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
                              onClick={() => handleOpenActionModal(item, 'Diluluskan')}
                              style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Luluskan
                            </button>
                            <button
                              onClick={() => handleOpenActionModal(item, 'Ditolak')}
                              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Tindakan selesai
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

      {/* MODAL PENGESAHAN KELULUSAN / PENOLAKAN */}
      {selectedLeave && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: actionType === 'Diluluskan' ? '#059669' : '#dc2626' }}>
                {actionType === 'Diluluskan' ? 'Luluskan Permohonan Cuti' : 'Tolak Permohonan Cuti'}
              </h3>
              <button type="button" onClick={() => setSelectedLeave(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAction} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155' }}>
                Pemohon: <strong>{selectedLeave.student_name}</strong><br />
                Kategori: <strong>{selectedLeave.leave_type}</strong><br />
                Tarikh: <strong>{selectedLeave.start_date}</strong> hingga <strong>{selectedLeave.end_date}</strong>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                  Catatan / Ulasan Guru Pentasmik *
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Masukkan ulasan atau sebab..."
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
    </DashboardGuruLayout>
  );
}
