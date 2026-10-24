'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { 
  FileText, Calendar, UploadCloud, Clock, CheckCircle2, 
  XCircle, AlertCircle, Eye, Trash2, Send, Loader2, ArrowRight
} from 'lucide-react';

interface LeaveRecord {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string;
  status: 'Menunggu' | 'Diluluskan' | 'Ditolak';
  teacher_remarks?: string;
  created_at: string;
}

const LEAVE_TYPES = [
  'Cuti Sakit (MC)',
  'Cuti Kecemasan / Kematian',
  'Urusan Keluarga',
  'Cuti Peperiksaan Luar / Rasmi',
  'Lain-lain'
];

export default function PermohonanCutiPelajarPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('Pelajar');
  const [classId, setClassId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const [leaveHistory, setLeaveHistory] = useState<LeaveRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStudentData = async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const sId = authData.user.id;
      setStudentId(sId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, class_id')
        .eq('id', sId)
        .single();

      if (profile) {
        setStudentName(profile.full_name || 'Pelajar');
        setClassId(profile.class_id || null);

        if (profile.class_id) {
          const { data: classData } = await supabase
            .from('classes')
            .select('teacher_id')
            .eq('id', profile.class_id)
            .single();
          if (classData?.teacher_id) {
            setTeacherId(classData.teacher_id);
          }
        }
      }

      const { data: leaves } = await supabase
        .from('student_leaves')
        .select('*')
        .eq('student_id', sId)
        .order('created_at', { ascending: false });

      if (leaves) {
        setLeaveHistory(leaves as LeaveRecord[]);
      }
    } catch (err) {
      console.error('Ralat menarik data permohonan cuti:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchStudentData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Saiz fail melebihi had maksimum 3MB.');
      return;
    }

    setIsUploading(true);
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filePath = `${Date.now()}_${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('student-leaves')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('student-leaves')
        .getPublicUrl(filePath);

      setAttachmentUrl(publicData.publicUrl);
      setAttachmentName(file.name);
    } catch (err: any) {
      alert(`Gagal memuat naik dokumen sokongan: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason.trim()) {
      alert('Sila lengkapkan tarikh mula, tarikh tamat, dan sebab permohonan.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('Tarikh tamat tidak boleh lebih awal daripada tarikh mula.');
      return;
    }

    if (leaveType.includes('MC') && !attachmentUrl) {
      alert('Bagi Cuti Sakit (MC), lampiran dokumen/surat doktor adalah wajib.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newLeave = {
        student_id: studentId,
        student_name: studentName,
        class_id: classId,
        teacher_id: teacherId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        attachment_url: attachmentUrl || null,
        status: 'Menunggu'
      };

      const { error } = await supabase.from('student_leaves').insert([newLeave]);
      if (error) throw error;

      if (teacherId) {
        await supabase.from('notifications').insert([{
          user_id: teacherId,
          sender_id: studentId,
          type: 'info',
          title: `Permohonan Cuti Baharu: ${studentName}`,
          message: `Pelajar ${studentName} telah memohon ${leaveType} dari ${startDate} hingga ${endDate}. Sila buat semakan.`
        }]);
      }

      alert('Permohonan cuti anda berjaya dihantar kepada guru kelas!');
      setStartDate('');
      setEndDate('');
      setReason('');
      setAttachmentUrl('');
      setAttachmentName('');
      fetchStudentData();
    } catch (err: any) {
      alert(`Gagal menghantar permohonan: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  if (isLoading) {
    return (
      <DashboardLayout userName={studentName} userRole="Pelajar">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Loader2 className="animate-spin" size={40} color="#0062ff" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userName={studentName} userRole="Pelajar">
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
        
        {/* HEADER */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h1 style={{ margin: '0 0 0.4rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={26} color="#0062ff" /> Permohonan Cuti Pelajar
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
            Isi borang di bawah untuk memohon cuti rasmi maahad. Sertakan surat MC atau dokumen sokongan berkaitan.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* BORANG PERMOHONAN */}
          <form 
            onSubmit={handleSubmitLeave} 
            style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
              Borang Cuti Baharu
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Jenis Cuti
              </label>
              <select 
                value={leaveType} 
                onChange={(e) => setLeaveType(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#f8fafc' }}
              >
                {LEAVE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Tarikh Mula
                </label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  required 
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Tarikh Tamat
                </label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  required 
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Sebab / Justifikasi Permohonan
              </label>
              <textarea 
                rows={3} 
                placeholder="Jelaskan sebab ketidakhadiran anda..." 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                required
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
              />
            </div>

            {/* MEDAN UPLOAD SURAT MC */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Lampiran Surat Doktor (MC) / Dokumen Sokongan
              </label>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".pdf,image/*" 
                onChange={handleFileUpload}
                style={{ display: 'none' }} 
              />

              {attachmentUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                    {attachmentName || 'Dokumen Dimuat Naik'}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { setAttachmentUrl(''); setAttachmentName(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    color: '#64748b',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} color="#0062ff" />}
                  {isUploading ? 'Memuat naik...' : 'Pilih Fail MC (PDF / Imej - Maks 3MB)'}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              style={{
                background: '#0062ff',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: (isSubmitting || isUploading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '0.5rem'
              }}
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Hantar Permohonan Cuti
            </button>
          </form>

          {/* SENARAI SEJARAH PERMOHONAN */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Rekod & Status Permohonan Cuti
              </h3>
            </div>

            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '560px', overflowY: 'auto' }}>
              {leaveHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <FileText size={40} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>Tiada Permohonan Cuti</p>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>Semua rekod cuti anda akan dipaparkan di sini.</p>
                </div>
              ) : (
                leaveHistory.map((leave) => (
                  <div 
                    key={leave.id}
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
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                        {leave.leave_type}
                      </span>
                      
                      <span style={{
                        padding: '0.2rem 0.65rem',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: leave.status === 'Diluluskan' ? '#dcfce7' : leave.status === 'Ditolak' ? '#fee2e2' : '#fef3c7',
                        color: leave.status === 'Diluluskan' ? '#15803d' : leave.status === 'Ditolak' ? '#b91c1c' : '#b45309'
                      }}>
                        {leave.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} color="#0062ff" />
                      <strong>{leave.start_date}</strong> hingga <strong>{leave.end_date}</strong>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                      "{leave.reason}"
                    </p>

                    {leave.teacher_remarks && (
                      <div style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #0062ff', fontSize: '0.78rem', color: '#334155' }}>
                        <strong>Ulasan Guru:</strong> {leave.teacher_remarks}
                      </div>
                    )}

                    {leave.attachment_url && (
                      <div style={{ paddingTop: '0.3rem' }}>
                        <button
                          type="button"
                          onClick={() => window.open(leave.attachment_url, '_blank')}
                          style={{ background: 'none', border: 'none', color: '#0062ff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                        >
                          <Eye size={13} /> Lihat Lampiran MC
                        </button>
                      </div>
                    )}
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