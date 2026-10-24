'use client';

import React, { useState, useEffect } from 'react';
import DashboardAdminLayout from '@/components/dashboard/DashboardAdminLayout';
import { supabase } from '@/lib/supabase';
import { 
  UserCheck, Search, CheckCircle2, 
  XCircle, Clock, CalendarX, FileText, 
  CheckSquare, X, CalendarDays, Calendar, 
  AlertTriangle, Mail, Send, User, Printer, Filter, Loader2, Eye
} from 'lucide-react';

interface AttendanceLog {
  id: string;
  user_id: string;
  name: string;
  role: 'Pelajar' | 'Guru';
  classId?: string;
  classOrJawatan: string;
  timeIn: string;
  date: string;
  status: 'Hadir' | 'Lewat' | 'Tidak Hadir' | 'Cuti' | 'Tiada Rekod' | string;
  attendanceRate: number;
  absentCount: number;
  attendanceHistory?: any[];
}

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

interface ClassItem {
  id: string;
  name: string;
}

// Fungsi Helper untuk menukar masa kepada format standard AM/PM
const formatTimeAMPM = (timeInput: any): string => {
  if (!timeInput || timeInput === '-') return '-';
  
  if (typeof timeInput === 'string' && (timeInput.includes('T') || timeInput.length > 12)) {
    const d = new Date(timeInput);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  if (typeof timeInput === 'string') {
    let cleanTime = timeInput
      .replace(/PETANG|PTG|MALAM|MLM/gi, 'PM')
      .replace(/PAGI|PG/gi, 'AM')
      .trim();
    if (cleanTime.includes(':')) return cleanTime;
  }

  const d = new Date(timeInput);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return String(timeInput);
};

// Fungsi Helper untuk menyemak sama ada tarikh adalah HARI INI
const checkIsToday = (dateField: any, createdAtField: any): boolean => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localIso = `${year}-${month}-${day}`;
  const localDmy = `${day}/${month}/${year}`;
  const localDmyShort = `${now.getDate()}/${now.getMonth() + 1}/${year}`;

  if (dateField && typeof dateField === 'string') {
    const s = dateField.trim();
    if (s === localIso || s === localDmy || s === localDmyShort || s.includes(localIso) || s.includes(localDmy)) {
      return true;
    }
  }

  const parseTarget = createdAtField || dateField;
  if (parseTarget) {
    const d = new Date(parseTarget);
    if (!isNaN(d.getTime())) {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
  }
  return false;
};

export default function AdminKehadiranPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminId, setAdminId] = useState('');
  const [activeTab, setActiveTab] = useState<'log' | 'cuti'>('log');
  
  // State Filter Kehadiran
  const [logPeriod, setLogPeriod] = useState<'Harian' | 'Bulanan' | 'Tahunan'>('Harian');
  const [roleFilter, setRoleFilter] = useState<'Semua' | 'Pelajar' | 'Guru'>('Guru');
  const [classFilter, setClassFilter] = useState<'Semua' | string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // State Data (Dari Supabase)
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeaveItem[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'Menunggu' | 'Diluluskan' | 'Ditolak' | 'Semua'>('Menunggu');

  // State Institusi untuk Cetakan Logo
  const [instSettings, setInstSettings] = useState({ name: 'MAAHAD TAHFIZ HUFFAZPRO MALAYSIA', logo: '' });

  // State Modal Amaran
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [selectedUserForWarning, setSelectedUserForWarning] = useState<AttendanceLog | null>(null);
  const [warningNotes, setWarningNotes] = useState('');

  // State Modal Profil & Cetakan
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<AttendanceLog | null>(null);
  const [printMode, setPrintMode] = useState<'none' | 'overall' | 'individual' | 'warning'>('none');

  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);

  // State Modal Tindakan Kelulusan Cuti Guru
  const [selectedLeaveForAction, setSelectedLeaveForAction] = useState<TeacherLeaveItem | null>(null);
  const [leaveActionType, setLeaveActionType] = useState<'Diluluskan' | 'Ditolak'>('Diluluskan');
  const [leaveActionRemarks, setLeaveActionRemarks] = useState('');
  const [isProcessingLeave, setIsProcessingLeave] = useState(false);

  const fetchAttendanceData = async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) setAdminId(authData.user.id);

      // 1. Ambil Maklumat Institusi untuk Cetakan
      try {
        const { data: instData } = await supabase.from('settings').select('*').limit(1).maybeSingle();
        if (instData) {
          setInstSettings({ 
            name: instData.inst_name || 'MAAHAD TAHFIZ HUFFAZPRO MALAYSIA', 
            logo: instData.inst_logo_url || '' 
          });
        }
      } catch (e) {}

      // 2. Tarik Senarai Kelas Sebenar dari jadual 'classes'
      const classMap = new Map<string, string>();
      const classesList: ClassItem[] = [];
      try {
        const { data: classData } = await supabase.from('classes').select('*');
        if (classData) {
          classData.forEach((c: any) => {
            const name = c.name || c.nama_kelas || c.class_name || c.title || `Kelas ${c.id.substring(0, 4)}`;
            classMap.set(c.id, name);
            classesList.push({ id: c.id, name });
          });
          setAvailableClasses(classesList);
        }
      } catch (e) {
        console.error('Ralat menarik data classes:', e);
      }

      // 3. Tarik Semua Pengguna Berdaftar (Pelajar & Guru) dari 'profiles'
      const { data: profilesData, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['Pelajar', 'Guru'])
        .order('full_name', { ascending: true });

      if (profErr) throw profErr;

      // 4. Tarik Rekod Kehadiran dari jadual 'attendance'
      const { data: logsData } = await supabase
        .from('attendance')
        .select('*')
        .order('created_at', { ascending: false });

      // 5. Tarik Rekod Aktiviti / Tasmik dari jadual 'evaluations'
      const { data: evalsData } = await supabase
        .from('evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      // 6. Tarik Rekod Cuti Guru dari jadual 'teacher_leaves'
      const { data: leavesData } = await supabase
        .from('teacher_leaves')
        .select('*')
        .order('created_at', { ascending: false });

      if (leavesData) {
        setTeacherLeaves(leavesData as TeacherLeaveItem[]);
      }

      const now = new Date();
      const todayLocale = now.toLocaleDateString('ms-MY');

      // 7. Cantumkan Profil Pengguna dengan Status Kehadiran
      if (profilesData) {
        const formattedLogs: AttendanceLog[] = profilesData.map((user: any) => {
          const actualClassName = user.class_id ? (classMap.get(user.class_id) || user.class_id) : 'Tiada Kelas';
          const classOrJawatan = user.role === 'Pelajar' ? actualClassName : (user.job_title || 'Guru');

          const userAtt = (logsData || []).filter((l: any) => 
            l.user_id === user.id || l.student_id === user.id || l.teacher_id === user.id
          );

          const todayAttRecord = userAtt.find((l: any) => checkIsToday(l.date, l.created_at));

          const userEvals = (evalsData || []).filter((e: any) => 
            user.role === 'Guru' ? (e.teacher_id === user.id) : (e.student_id === user.id)
          );
          const todayEvalRecord = userEvals.find((e: any) => checkIsToday(null, e.created_at));

          let statusHariIni = 'Tiada Rekod';
          let waktuMasuk = '-';

          if (todayAttRecord) {
            statusHariIni = todayAttRecord.status || 'Hadir';
            const rawTime = todayAttRecord.time_in || todayAttRecord.created_at || '-';
            waktuMasuk = formatTimeAMPM(rawTime);
          } else if (todayEvalRecord) {
            statusHariIni = todayEvalRecord.type === 'Live' || todayEvalRecord.type === 'Online' ? 'Hadir Online' : 'Hadir';
            waktuMasuk = formatTimeAMPM(todayEvalRecord.created_at);
          }

          const presentCount = userAtt.filter((l: any) => 
            l.status && l.status.toLowerCase().includes('hadir') && !l.status.toLowerCase().includes('tidak')
          ).length + (todayEvalRecord && !todayAttRecord ? 1 : 0);

          const absentCount = userAtt.filter((l: any) => 
            l.status && (l.status.toLowerCase().includes('tidak') || l.status.toLowerCase().includes('absent'))
          ).length;

          const totalCount = presentCount + absentCount;
          const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : (statusHariIni.includes('Hadir') ? 100 : 0);

          const fullHistory = [...userAtt];
          if (todayEvalRecord && !todayAttRecord) {
            fullHistory.unshift({
              date: todayLocale,
              time_in: waktuMasuk,
              status: statusHariIni,
              remarks: `Sesi Tasmik (${todayEvalRecord.surah || 'Al-Quran'})`
            });
          }

          return {
            id: user.id,
            user_id: user.id,
            name: user.full_name || 'Tiada Nama',
            role: user.role as 'Pelajar' | 'Guru',
            classId: user.class_id,
            classOrJawatan: classOrJawatan,
            timeIn: waktuMasuk,
            date: todayAttRecord ? (todayAttRecord.date || todayLocale) : todayLocale,
            status: statusHariIni,
            attendanceRate: rate,
            absentCount: absentCount,
            attendanceHistory: fullHistory
          };
        });

        setAttendanceLogs(formattedLogs);
      }

    } catch (error) {
      console.error('Ralat menarik data kehadiran admin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchAttendanceData();

    const handleAfterPrint = () => setPrintMode('none');
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    setSelectedLogs([]);
  }, [searchQuery, roleFilter, logPeriod, classFilter]);

  // TINDAKAN KELULUSAN CUTI GURU
  const handleOpenLeaveModal = (item: TeacherLeaveItem, type: 'Diluluskan' | 'Ditolak') => {
    setSelectedLeaveForAction(item);
    setLeaveActionType(type);
    setLeaveActionRemarks(type === 'Diluluskan' 
      ? 'Permohonan cuti disahkan dan diluluskan oleh pihak pentadbiran.' 
      : 'Permohonan cuti tidak dapat diluluskan.');
  };

  const handleConfirmLeaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaveForAction) return;

    setIsProcessingLeave(true);
    try {
      const { error } = await supabase
        .from('teacher_leaves')
        .update({
          status: leaveActionType,
          admin_remarks: leaveActionRemarks.trim()
        })
        .eq('id', selectedLeaveForAction.id);

      if (error) throw error;

      await supabase.from('notifications').insert([{
        user_id: selectedLeaveForAction.teacher_id,
        sender_id: adminId,
        type: 'info',
        title: `Status Permohonan Cuti: ${leaveActionType}`,
        message: `Permohonan ${selectedLeaveForAction.leave_type} anda (${selectedLeaveForAction.start_date} - ${selectedLeaveForAction.end_date}) telah ${leaveActionType.toLowerCase()} oleh pihak Pentadbiran. Catatan: "${leaveActionRemarks.trim()}"`
      }]);

      alert(`Permohonan cuti ${selectedLeaveForAction.teacher_name} telah berjaya ${leaveActionType.toLowerCase()}!`);
      setSelectedLeaveForAction(null);
      fetchAttendanceData();
    } catch (err: any) {
      alert(`Gagal memproses permohonan: ${err.message}`);
    } finally {
      setIsProcessingLeave(false);
    }
  };

  const handleOpenWarningModal = (user: AttendanceLog) => {
    setSelectedUserForWarning(user);
    setWarningNotes('');
    setShowWarningModal(true);
  };

  const handleOpenProfileModal = (user: AttendanceLog) => {
    setSelectedUserProfile(user);
    setShowProfileModal(true);
  };

  const handleSendWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForWarning) return;

    try {
      const warningType = selectedUserForWarning.attendanceRate < 80 ? 'Surat Amaran Disiplin' : 'Peringatan Ketidakhadiran';
      const { data: authData } = await supabase.auth.getUser();
      
      await supabase.from('notifications').insert([{
        user_id: selectedUserForWarning.user_id,
        sender_id: authData.user?.id,
        type: 'teguran',
        title: warningType,
        message: `Teguran Rasmi: Kehadiran terkini merekodkan tahap pencapaian ${selectedUserForWarning.attendanceRate}%. Sila perbaiki kehadiran segera. Catatan Pentadbir: ${warningNotes}`
      }]);

      handlePrint('warning'); 
      setShowWarningModal(false);
    } catch (err) {
      alert('Gagal menghantar amaran ke sistem.');
    }
  };

  const handlePrint = (mode: 'overall' | 'individual' | 'warning') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 400); 
  };

  // Tapis Senarai Kehadiran
  const filteredLogs = attendanceLogs.filter(log => {
    const matchSearch = log.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === 'Semua' || log.role === roleFilter;
    const matchClass = classFilter === 'Semua' || log.classOrJawatan === classFilter || log.classId === classFilter;
    return matchSearch && matchRole && matchClass;
  });

  // Tapis Senarai Cuti Guru
  const filteredTeacherLeaves = teacherLeaves.filter(req => {
    const matchStatus = leaveStatusFilter === 'Semua' || req.status === leaveStatusFilter;
    const matchSearch = req.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        req.leave_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleSelectAll = () => {
    if (selectedLogs.length === filteredLogs.length && filteredLogs.length > 0) {
      setSelectedLogs([]); 
    } else {
      setSelectedLogs(filteredLogs.map(log => log.id)); 
    }
  };

  const handleSelectLog = (id: string) => {
    if (selectedLogs.includes(id)) {
      setSelectedLogs(prev => prev.filter(logId => logId !== id));
    } else {
      setSelectedLogs(prev => [...prev, id]);
    }
  };

  const logsToPrint = selectedLogs.length > 0 
    ? filteredLogs.filter(log => selectedLogs.includes(log.id)) 
    : filteredLogs;

  const pendingTeacherLeaves = teacherLeaves.filter(req => req.status === 'Menunggu');

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

  return (
    <DashboardAdminLayout>
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <UserCheck size={26} color="#0062ff" /> Kehadiran & Profil Pengguna
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Pantau log kehadiran, lihat profil terperinci, dan semak kelulusan cuti rasmi guru.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.35rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <button 
              onClick={() => setActiveTab('log')}
              style={{ background: activeTab === 'log' ? '#fff' : 'transparent', color: activeTab === 'log' ? '#0062ff' : '#64748b', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: activeTab === 'log' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
              <Clock size={16} /> Rekod Kehadiran
            </button>
            <button 
              onClick={() => setActiveTab('cuti')}
              style={{ background: activeTab === 'cuti' ? '#fff' : 'transparent', color: activeTab === 'cuti' ? '#0062ff' : '#64748b', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: activeTab === 'cuti' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
              <CalendarX size={16} /> Kelulusan Cuti Guru
              {pendingTeacherLeaves.length > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', padding: '0.1rem 0.45rem', borderRadius: '10px', fontSize: '0.7rem' }}>
                  {pendingTeacherLeaves.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: LOG KEHADIRAN */}
        {activeTab === 'log' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden' }}>
            
            {/* TOOLBAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #eef2f6', flexWrap: 'wrap', gap: '1rem', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['Semua', 'Pelajar', 'Guru'].map(role => (
                    <button 
                      key={role}
                      onClick={() => {
                        setRoleFilter(role as any);
                        if (role === 'Guru') setClassFilter('Semua'); 
                      }}
                      style={{ background: roleFilter === role ? '#0f172a' : '#fff', color: roleFilter === role ? '#fff' : '#475569', border: roleFilter === role ? 'none' : '1px solid #cbd5e1', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', background: '#e2e8f0', padding: '0.2rem', borderRadius: '8px' }}>
                  {['Harian', 'Bulanan', 'Tahunan'].map(period => (
                    <button 
                      key={period}
                      onClick={() => setLogPeriod(period as any)}
                      style={{ background: logPeriod === period ? '#fff' : 'transparent', color: logPeriod === period ? '#0062ff' : '#64748b', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', boxShadow: logPeriod === period ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
                    >
                      {period}
                    </button>
                  ))}
                </div>

                {roleFilter !== 'Guru' && (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 0.5rem', overflow: 'hidden' }}>
                    <Filter size={14} color="#64748b" style={{ marginLeft: '0.2rem' }} />
                    <select 
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      style={{ border: 'none', padding: '0.45rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', outline: 'none', background: 'transparent', cursor: 'pointer', maxWidth: '180px' }}
                    >
                      <option value="Semua">Semua Kelas</option>
                      {availableClasses.map(cls => (
                        <option key={cls.id} value={cls.name}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    placeholder="Cari nama..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
                
                <button 
                  onClick={() => handlePrint('overall')}
                  style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Printer size={15}/> {selectedLogs.length > 0 ? `Cetak (${selectedLogs.length}) Senarai` : 'Cetak Senarai'}
                </button>
              </div>
            </div>

            {/* JADUAL DATA */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#ffffff', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '1rem 0.5rem 1rem 1.5rem', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={filteredLogs.length > 0 && selectedLogs.length === filteredLogs.length}
                        onChange={handleSelectAll}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0062ff' }}
                        title="Tandakan Semua"
                      />
                    </th>
                    <th style={{ padding: '1rem 0.5rem', width: '50px', fontWeight: 800 }}>No.</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Nama Pengguna</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Peranan & Info</th>
                    
                    {logPeriod === 'Harian' ? (
                      <>
                        <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Waktu Masuk</th>
                        <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Status Hari Ini</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Kadar Kehadiran (%)</th>
                        <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Jumlah Tidak Hadir</th>
                      </>
                    )}
                    
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800, textAlign: 'right' }}>Tindakan & Profil</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        Tiada rekod pengguna atau kehadiran dijumpai untuk kriteria ini.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, index) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: selectedLogs.includes(log.id) ? '#f8fafc' : '#fff' }}>
                        <td style={{ padding: '1rem 0.5rem 1rem 1.5rem' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedLogs.includes(log.id)}
                            onChange={() => handleSelectLog(log.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0062ff' }}
                          />
                        </td>
                        <td style={{ padding: '1rem 0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                          {index + 1}
                        </td>
                        
                        <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                          {log.name}
                        </td>
                        
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                          <span style={{ color: log.role === 'Guru' ? '#059669' : '#0062ff', fontWeight: 700 }}>{log.role}</span>
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.2rem' }}>{log.classOrJawatan}</div>
                        </td>
                        
                        {logPeriod === 'Harian' ? (
                          <>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#475569' }}>
                              <strong>{log.timeIn}</strong>
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <span style={{ 
                                background: log.status.includes('Hadir') ? '#dcfce7' : log.status === 'Lewat' ? '#fef3c7' : '#fee2e2', 
                                color: log.status.includes('Hadir') ? '#166534' : log.status === 'Lewat' ? '#b45309' : '#dc2626', 
                                padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 
                              }}>
                                {log.status}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: log.attendanceRate < 80 ? '#dc2626' : log.attendanceRate < 90 ? '#d97706' : '#166534' }}>{log.attendanceRate}%</span>
                                <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${log.attendanceRate}%`, height: '100%', background: log.attendanceRate < 80 ? '#dc2626' : log.attendanceRate < 90 ? '#f59e0b' : '#059669' }}></div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: log.absentCount > 3 ? '#dc2626' : '#475569' }}>
                              {log.absentCount} Hari
                            </td>
                          </>
                        )}

                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button 
                              onClick={() => handleOpenProfileModal(log)}
                              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0062ff', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Lihat Profil"
                            >
                              <User size={14}/> Profil
                            </button>

                            {log.attendanceRate > 0 && log.attendanceRate < 80 ? (
                              <button onClick={() => handleOpenWarningModal(log)} style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={14}/> Amaran
                              </button>
                            ) : log.attendanceRate >= 80 && log.attendanceRate < 90 ? (
                              <button onClick={() => handleOpenWarningModal(log)} style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Mail size={14}/> Peringatan
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: KELULUSAN CUTI GURU */}
        {activeTab === 'cuti' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', padding: '1.5rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CalendarX size={20} color="#0062ff" /> Permohonan Cuti Guru ({filteredTeacherLeaves.length})
                </h3>

                {/* FILTER STATUS CUTI */}
                <div style={{ display: 'flex', background: '#e2e8f0', padding: '0.25rem', borderRadius: '8px' }}>
                  {(['Menunggu', 'Diluluskan', 'Ditolak', 'Semua'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setLeaveStatusFilter(tab)}
                      style={{
                        background: leaveStatusFilter === tab ? '#ffffff' : 'transparent',
                        color: leaveStatusFilter === tab ? '#0062ff' : '#64748b',
                        border: 'none',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: leaveStatusFilter === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {tab === 'Semua' ? 'Semua Rekod' : tab}
                    </button>
                  ))}
                </div>
              </div>
              
              {filteredTeacherLeaves.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8' }}>
                  <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 0.75rem auto', opacity: 0.6 }} />
                  <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>Tiada Permohonan Cuti</p>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem' }}>Tiada rekod cuti guru di bawah status {leaveStatusFilter}.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
                  {filteredTeacherLeaves.map(req => (
                    <div 
                      key={req.id} 
                      style={{ 
                        border: `1px solid ${req.status === 'Diluluskan' ? '#a7f3d0' : req.status === 'Ditolak' ? '#fecaca' : '#fde68a'}`, 
                        background: req.status === 'Diluluskan' ? '#f0fdf4' : req.status === 'Ditolak' ? '#fef2f2' : '#fffbeb', 
                        borderRadius: '12px', 
                        padding: '1.25rem', 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>{req.teacher_name}</h4>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0062ff' }}>{req.leave_type}</span>
                        </div>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 800, 
                          color: req.status === 'Diluluskan' ? '#15803d' : req.status === 'Ditolak' ? '#b91c1c' : '#b45309', 
                          background: req.status === 'Diluluskan' ? '#dcfce7' : req.status === 'Ditolak' ? '#fee2e2' : '#fef3c7', 
                          padding: '0.2rem 0.55rem', 
                          borderRadius: '6px' 
                        }}>
                          {req.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} color="#0062ff" />
                        <strong>{req.start_date}</strong> hingga <strong>{req.end_date}</strong>
                      </div>

                      <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', fontSize: '0.82rem', color: '#475569', border: '1px dashed #cbd5e1', lineHeight: 1.4 }}>
                        "{req.reason}"
                      </div>

                      {req.attachment_url && (
                        <div>
                          <button
                            type="button"
                            onClick={() => window.open(req.attachment_url, '_blank')}
                            style={{ background: '#eff6ff', color: '#0062ff', border: '1px solid #bfdbfe', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={13} /> Buka Dokumen MC / Sokongan
                          </button>
                        </div>
                      )}

                      {req.admin_remarks && (
                        <div style={{ fontSize: '0.75rem', color: '#334155', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', borderLeft: '3px solid #0062ff' }}>
                          <strong>Catatan Pentadbir:</strong> {req.admin_remarks}
                        </div>
                      )}

                      {req.status === 'Menunggu' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button 
                            onClick={() => handleOpenLeaveModal(req, 'Ditolak')} 
                            style={{ flex: 1, background: '#fff', border: '1px solid #fecaca', color: '#dc2626', padding: '0.5rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            <XCircle size={14}/> Tolak
                          </button>
                          <button 
                            onClick={() => handleOpenLeaveModal(req, 'Diluluskan')} 
                            style={{ flex: 1, background: '#059669', border: 'none', color: '#fff', padding: '0.5rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                          >
                            <CheckCircle2 size={14}/> Luluskan Cuti
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL KELULUSAN CUTI GURU OLEH ADMIN */}
      {selectedLeaveForAction && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: leaveActionType === 'Diluluskan' ? '#059669' : '#dc2626' }}>
                {leaveActionType === 'Diluluskan' ? 'Luluskan Cuti Guru' : 'Tolak Permohonan Cuti'}
              </h3>
              <button type="button" onClick={() => setSelectedLeaveForAction(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmLeaveAction} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155' }}>
                Guru: <strong>{selectedLeaveForAction.teacher_name}</strong><br />
                Kategori: <strong>{selectedLeaveForAction.leave_type}</strong><br />
                Tarikh: <strong>{selectedLeaveForAction.start_date}</strong> hingga <strong>{selectedLeaveForAction.end_date}</strong>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                  Catatan Pentadbir *
                </label>
                <textarea
                  rows={3}
                  value={leaveActionRemarks}
                  onChange={(e) => setLeaveActionRemarks(e.target.value)}
                  placeholder="Masukkan ulasan atau sebab keputusan..."
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedLeaveForAction(null)}
                  style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessingLeave}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: leaveActionType === 'Diluluskan' ? '#059669' : '#dc2626',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: isProcessingLeave ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isProcessingLeave ? 'Memproses...' : 'Sahkan Keputusan'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL PROFIL & CETAKAN */}
      {showProfileModal && selectedUserProfile && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '600px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: selectedUserProfile.role === 'Guru' ? '#dcfce7' : '#dbeafe', color: selectedUserProfile.role === 'Guru' ? '#166534' : '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.5rem' }}>
                  {selectedUserProfile.name.charAt(0)}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{selectedUserProfile.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{selectedUserProfile.role} ({selectedUserProfile.classOrJawatan})</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowProfileModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>KADAR KEHADIRAN</p>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: selectedUserProfile.attendanceRate < 80 ? '#dc2626' : '#059669' }}>{selectedUserProfile.attendanceRate}%</h2>
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>JUMLAH TIDAK HADIR</p>
                  <h2 style={{ margin: '0', fontSize: '1.5rem', color: '#0f172a' }}>{selectedUserProfile.absentCount} Hari</h2>
                </div>
              </div>

              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0f172a' }}>Sejarah Kehadiran Terkini</h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr><th style={{ padding: '0.75rem 1rem' }}>Tarikh</th><th style={{ padding: '0.75rem 1rem' }}>Waktu</th><th style={{ padding: '0.75rem 1rem' }}>Status</th></tr>
                  </thead>
                  <tbody>
                    {selectedUserProfile.attendanceHistory && selectedUserProfile.attendanceHistory.length > 0 ? (
                      selectedUserProfile.attendanceHistory.slice(0, 5).map((att: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>{att.date}</td>
                          <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>{formatTimeAMPM(att.time_in)}</td>
                          <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>{att.status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8' }}>
                          Belum ada sejarah rekod log kehadiran lalu.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#fff' }}>
              <button onClick={() => handlePrint('individual')} style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={15} /> Cetak Rekod Individu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SURAT AMARAN */}
      {showWarningModal && selectedUserForWarning && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selectedUserForWarning.attendanceRate < 80 ? '#fef2f2' : '#fffbeb' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: selectedUserForWarning.attendanceRate < 80 ? '#dc2626' : '#d97706', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} /> {selectedUserForWarning.attendanceRate < 80 ? 'Surat Amaran' : 'Peringatan Kehadiran'}
              </h3>
              <button type="button" onClick={() => setShowWarningModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSendWarning} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '1rem', color: '#0f172a' }}>{selectedUserForWarning.name}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569' }}>
                  <span>{selectedUserForWarning.role}</span>
                  <span style={{ fontWeight: 800, color: selectedUserForWarning.attendanceRate < 80 ? '#dc2626' : '#d97706' }}>Rekod: {selectedUserForWarning.attendanceRate}%</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Catatan Pentadbiran</label>
                <textarea rows={3} value={warningNotes} onChange={(e) => setWarningNotes(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowWarningModal(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                <button type="submit" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: selectedUserForWarning.attendanceRate < 80 ? '#dc2626' : '#d97706', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Printer size={15} /> Cetak & Hantar Notis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT CONTAINERS */}
      {printMode === 'overall' && (
        <div className="print-container">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1.5rem', textAlign: 'center' }}>
            {instSettings.logo && <img src={instSettings.logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />}
            <div>
              <h2 style={{ margin: '0 0 0.2rem 0', fontSize: '1.5rem' }}>{instSettings.name.toUpperCase()}</h2>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>LAPORAN KEHADIRAN KESELURUHAN ({logPeriod.toUpperCase()})</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>Kategori: {roleFilter} | Kelas: {classFilter} | Tarikh Cetakan: {new Date().toLocaleDateString('ms-MY')}</p>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid #000' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '0.75rem', border: '1px solid #000', width: '50px', textAlign: 'center' }}>No.</th>
                <th style={{ padding: '0.75rem', border: '1px solid #000' }}>Nama Pengguna</th>
                <th style={{ padding: '0.75rem', border: '1px solid #000' }}>Peranan / Kelas</th>
                {logPeriod === 'Harian' ? (
                  <>
                    <th style={{ padding: '0.75rem', border: '1px solid #000' }}>Waktu Masuk</th>
                    <th style={{ padding: '0.75rem', border: '1px solid #000' }}>Status Hari Ini</th>
                  </>
                ) : (
                  <>
                    <th style={{ padding: '0.75rem', border: '1px solid #000' }}>Kadar (%)</th>
                    <th style={{ padding: '0.75rem', border: '1px solid #000' }}>Tidak Hadir</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {logsToPrint.map((log, index) => (
                <tr key={log.id}>
                  <td style={{ padding: '0.75rem', border: '1px solid #000', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ padding: '0.75rem', border: '1px solid #000' }}>{log.name}</td>
                  <td style={{ padding: '0.75rem', border: '1px solid #000' }}>{log.role} ({log.classOrJawatan})</td>
                  {logPeriod === 'Harian' ? (
                    <>
                      <td style={{ padding: '0.75rem', border: '1px solid #000' }}>{log.timeIn}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #000' }}>{log.status}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '0.75rem', border: '1px solid #000' }}>{log.attendanceRate}%</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #000' }}>{log.absentCount} Hari</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {printMode === 'individual' && selectedUserProfile && (
        <div className="print-container">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1.5rem', textAlign: 'center' }}>
            {instSettings.logo && <img src={instSettings.logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />}
            <div>
              <h2 style={{ margin: '0 0 0.2rem 0', fontSize: '1.5rem' }}>{instSettings.name.toUpperCase()}</h2>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>PENYATA KEHADIRAN INDIVIDU</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>Tarikh Cetakan: {new Date().toLocaleDateString('ms-MY')}</p>
            </div>
          </div>
          <table style={{ width: '100%', marginBottom: '2rem' }}>
            <tbody>
              <tr><td style={{ width: '150px', fontWeight: 'bold', padding: '0.5rem 0' }}>Nama Penuh</td><td>: {selectedUserProfile.name}</td></tr>
              <tr><td style={{ fontWeight: 'bold', padding: '0.5rem 0' }}>Peranan & Profil</td><td>: {selectedUserProfile.role} ({selectedUserProfile.classOrJawatan})</td></tr>
              <tr><td style={{ fontWeight: 'bold', padding: '0.5rem 0' }}>Kadar Kehadiran</td><td>: {selectedUserProfile.attendanceRate}% (Terkumpul)</td></tr>
              <tr><td style={{ fontWeight: 'bold', padding: '0.5rem 0' }}>Jumlah Tidak Hadir</td><td>: {selectedUserProfile.absentCount} Hari</td></tr>
            </tbody>
          </table>
          <h4 style={{ borderBottom: '1px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Rekod Log Terperinci</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid #000' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}><th style={{ padding: '0.75rem', border: '1px solid #000' }}>Tarikh</th><th style={{ padding: '0.75rem', border: '1px solid #000' }}>Waktu Masuk / Log</th><th style={{ padding: '0.75rem', border: '1px solid #000' }}>Status Hadir</th></tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '0.75rem', border: '1px solid #000' }}>{selectedUserProfile.date}</td><td style={{ padding: '0.75rem', border: '1px solid #000' }}>{selectedUserProfile.timeIn}</td><td style={{ padding: '0.75rem', border: '1px solid #000' }}>{selectedUserProfile.status}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {printMode === 'warning' && selectedUserForWarning && (
        <div className="print-container">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1.5rem', textAlign: 'center' }}>
            {instSettings.logo && <img src={instSettings.logo} alt="Logo" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />}
            <div>
              <h2 style={{ margin: '0 0 0.2rem 0', fontSize: '1.5rem' }}>{instSettings.name.toUpperCase()}</h2>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: selectedUserForWarning.attendanceRate < 80 ? '#dc2626' : '#000' }}>
                {selectedUserForWarning.attendanceRate < 80 ? 'NOTIS AMARAN DISIPLIN' : 'SURAT PERINGATAN KEHADIRAN'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>Tarikh Cetakan Rasmi: {new Date().toLocaleDateString('ms-MY')}</p>
            </div>
          </div>
          
          <div style={{ lineHeight: '1.8', fontSize: '1rem', marginTop: '2rem' }}>
            <p><strong>Kepada:</strong><br/> {selectedUserForWarning.name} <br/> ({selectedUserForWarning.role} - {selectedUserForWarning.classOrJawatan})</p>
            <p>Tuan/Puan,</p>
            <p><strong>PERKARA: TEGURAN PRESTASI KEHADIRAN</strong></p>
            <p>Merujuk kepada perkara di atas, pihak pentadbiran mendapati rekod kehadiran anda pada ketika ini adalah <strong>{selectedUserForWarning.attendanceRate}%</strong>.</p>
            <p>Catatan khusus daripada pihak pentadbiran adalah seperti berikut:</p>
            <div style={{ background: '#f1f5f9', padding: '1rem', borderLeft: '4px solid #0f172a', margin: '1rem 0', fontStyle: 'italic' }}>
              "{warningNotes}"
            </div>
            <p>Pihak kami memandang serius perkara ini dan memohon kerjasama pihak anda untuk segera memperbaiki rekod kehadiran. Tindakan tatatertib selanjutnya mungkin diambil jika tiada perubahan.</p>
            <br/><br/>
            <p>Sekian, terima kasih.</p>
            <p><strong>PENTADBIRAN UTAMA</strong><br/>{instSettings.name}</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; padding: 2cm; background: white; color: black; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </DashboardAdminLayout>
  );
}