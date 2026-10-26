'use client';

import React, { useState, useEffect } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  Users, TrendingUp, CalendarCheck, AlertTriangle, 
  Search, Filter, Download, FileText, 
  Printer, History, X, BookOpenCheck, UserRoundSearch, PrinterCheck,
  Phone, User, Calendar, CalendarClock, Loader2,
  MapPin, Mail, Briefcase, ShieldAlert, Activity, CreditCard, ShieldCheck, UserCheck
} from 'lucide-react';
import styles from './Laporan.module.css';

// Struktur Data Fleksibel
interface AssessmentHistory { date: string; surah: string; grade: string; notes: string; }
interface YearlyAssessmentHistory { month: string; progress: string; grade: string; attendance: string; }
interface DailyAttendance { date: string; time: string; status: string; remarks: string; rawMs?: number; }

interface StudentReport {
  id: string; matrik: string; name: string; image: string; className: string; classId?: string;
  phone: string; guardian: string; guardianPhone: string; joinedDate: string;
  attendanceType: string;
  todayTime: string;
  lastAssessment: string; lastGrade: string;
  mainIssue: string; currentProgress: string; 
  totalJuzuk: number; totalPages: number;
  history: AssessmentHistory[]; 
  yearlyHistory: YearlyAssessmentHistory[];
  attendanceHistory: DailyAttendance[];
  attendanceSummary: { present: number; absent: number; percentage: number; }; 
  gender?: string; dob?: string; pob?: string; state_of_birth?: string; country_of_birth?: string; 
  nationality?: string; race?: string; citizenship_status?: string; address?: string; postcode?: string; 
  city?: string; state?: string; email?: string;
  health_status?: string; allergies?: string; dietary_needs?: string; learning_aids?: string; emergency_meds?: string;
  parent_name?: string; parent_ic?: string; parent_relation?: string; parent_dob?: string; 
  parent_nationality?: string; parent_occupation?: string; parent_job_title?: string; 
  parent_employer?: string; parent_work_address?: string; parent_phone?: string; 
  parent_office_phone?: string; parent_email?: string; parent_income?: string;
}

const SENARAI_BULAN = [
  'JANUARI 2026', 'FEBRUARI 2026', 'MAC 2026', 'APRIL 2026',
  'MEI 2026', 'JUN 2026', 'JULAI 2026', 'OGOS 2026',
  'SEPTEMBER 2026', 'OKTOBER 2026', 'NOVEMBER 2026', 'DISEMBER 2026'
];

// Fungsi Helper untuk menukar masa PTG/PG kepada AM/PM
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
      .replace(/PTG|PETANG|MLM|MALAM/gi, 'PM')
      .replace(/PG|PAGI/gi, 'AM')
      .trim();
    if (cleanTime.includes(':')) return cleanTime;
  }

  const d = new Date(timeInput);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return String(timeInput);
};

export default function KehadiranLaporanPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  
  // Tab Navigation (Prestasi vs Kehadiran)
  const [activeTab, setActiveTab] = useState<'prestasi' | 'kehadiran'>('kehadiran');

  // Format Laporan Cetakan & Filter Log Harian
  const [reportFormat, setReportFormat] = useState<'Bulanan' | 'Tahunan'>('Bulanan');
  const [attendanceFilter, setAttendanceFilter] = useState<'Harian' | 'Bulanan' | 'Tahunan'>('Bulanan');
  const [selectedMonth, setSelectedMonth] = useState<string>('OKTOBER 2026');
  
  // Opsyen Cetak Pukal
  const [batchPrintType, setBatchPrintType] = useState<'Hafazan' | 'Kehadiran'>('Hafazan');

  // Modals State
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<StudentReport | null>(null);
  const [profileTab, setProfileTab] = useState<'peribadi' | 'hafazan' | 'kesihatan' | 'waris'>('peribadi');
  const [selectedAttendanceStudent, setSelectedAttendanceStudent] = useState<StudentReport | null>(null);
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<StudentReport | null>(null);
  const [selectedReportCardStudent, setSelectedReportCardStudent] = useState<StudentReport | null>(null);
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false);

  // DATA DINAMIK DARI SUPABASE
  const [students, setStudents] = useState<StudentReport[]>([]);
  const [guruName, setGuruName] = useState<string>('Guru');
  const [senaraiKelas, setSenaraiKelas] = useState<{id: string, name: string}[]>([]);

  // BINA DATA PELAJAR DARI SUPABASE (HANYA PELAJAR YANG DI-ASSIGN)
  useEffect(() => {
    const fetchLaporanData = async () => {
      setIsLoading(true);
      try {
        // 0. Tarik Profil Guru Semasa
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;
        const currentTeacherId = authData.user.id;

        const { data: teacherProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentTeacherId)
          .single();

        const currentGuruName = teacherProfile?.full_name || 'Guru';
        setGuruName(currentGuruName);

        // 1. Tarik Senarai Kelas Sebenar dari jadual 'classes'
        const classMap = new Map<string, string>();
        const classesList: {id: string, name: string}[] = [];
        const assignedClassIds = new Set<string>();
        const assignedStudentIds = new Set<string>();

        // Masukkan kelas dari profil guru jika ada
        if (teacherProfile?.class_id) {
          assignedClassIds.add(teacherProfile.class_id);
        }

        try {
          const { data: classesData } = await supabase.from('classes').select('*');
          if (classesData) {
            classesData.forEach((c: any) => {
              const name = c.name || c.nama_kelas || c.class_name || c.title || `Kelas ${c.id.substring(0, 4)}`;
              classMap.set(c.id, name);
              classesList.push({ id: c.id, name });

              // Semak jika guru ini adalah guru kelas / guru tasmik kelas ini
              if (
                c.teacher_id === currentTeacherId ||
                c.guru_id === currentTeacherId ||
                (c.teacher_name && c.teacher_name.toLowerCase().includes(currentGuruName.toLowerCase())) ||
                (teacherProfile?.class_id && teacherProfile.class_id === c.id)
              ) {
                assignedClassIds.add(c.id);
              }
            });
          }
        } catch (e) {
          console.error("Gagal menarik data kelas:", e);
        }

        // Semak jadual waktu (timetable) untuk kelas yang diajar oleh guru ini
        try {
          const { data: timetableData } = await supabase
            .from('timetable')
            .select('class_id, teacher_id, teacher_name')
            .or(`teacher_id.eq.${currentTeacherId},teacher_name.ilike.%${currentGuruName}%`);

          if (timetableData) {
            timetableData.forEach((t: any) => {
              if (t.class_id) assignedClassIds.add(t.class_id);
            });
          }
        } catch (e) {}

        // 2. Tarik Rekod Penilaian Guru ini
        const { data: evaluationsData } = await supabase
          .from('evaluations')
          .select('*')
          .order('created_at', { ascending: false });

        // Kumpulkan pelajar yang pernah dinilai atau mempunyai sesi dengan guru ini
        if (evaluationsData) {
          evaluationsData.forEach((ev: any) => {
            if (ev.teacher_id === currentTeacherId && ev.student_id) {
              assignedStudentIds.add(ev.student_id);
            }
          });
        }

        // 3. Tarik Rekod Kehadiran
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .order('created_at', { ascending: false });

        // 4. Tarik Semua Profil Pelajar
        const { data: pelajarList } = await supabase
          .from('profiles')
          .select('*')
          .ilike('role', '%elajar%')
          .order('full_name', { ascending: true });

        // Jika guru pernah menilai pelajar di kelas tertentu, tambahkan class_id tersebut secara automatik
        if (assignedStudentIds.size > 0 && pelajarList) {
          pelajarList.forEach((p: any) => {
            if (assignedStudentIds.has(p.id) && p.class_id) {
              assignedClassIds.add(p.class_id);
            }
          });
        }

        // KEMASKINI SENARAI KELAS UNTUK FILTER (HANYA KELAS YANG DIAJAR GURU)
        const filteredClassesList = classesList.filter(c => 
          assignedClassIds.size === 0 || assignedClassIds.has(c.id)
        );
        setSenaraiKelas(filteredClassesList);

        // 5. PENAPISAN KRITIKAL: HANYA PELAJAR YANG DI-ASSIGN KEPADA GURU INI
        const assignedStudents = (pelajarList || []).filter((pelajar: any) => {
          // A. Pelajar mempunyai teacher_id atau guru_id guru ini
          if (pelajar.teacher_id === currentTeacherId || pelajar.guru_id === currentTeacherId) {
            return true;
          }

          // B. Pelajar berada dalam kelas yang diassignkan kepada guru ini
          if (pelajar.class_id && assignedClassIds.has(pelajar.class_id)) {
            return true;
          }

          // C. Pelajar pernah dinilai oleh guru ini
          if (assignedStudentIds.has(pelajar.id)) {
            return true;
          }

          // Pelajar tanpa kelas atau dari kelas guru lain (seperti Budin Sukun) ditapis keluar
          return false;
        });

        const allStudents: StudentReport[] = [];
        const todayStr = new Date().toLocaleDateString('ms-MY');
        const todayIso = new Date().toISOString().split('T')[0];

        assignedStudents.forEach((pelajar: any) => {
          const studentAtt = (attendanceData || []).filter((a: any) => 
            a.user_id === pelajar.id || a.student_id === pelajar.id
          );
          const studentEval = (evaluationsData || []).filter((e: any) => 
            e.student_id === pelajar.id
          );

          // 1. PEMPROSESAN KEHADIRAN
          let formattedAtt: DailyAttendance[] = [];
          let presentCount = 0;
          let absentCount = 0;

          if (studentAtt.length > 0) {
            formattedAtt = studentAtt.map((a: any) => {
              let parseD = new Date(a.created_at || a.date).getTime();
              if (isNaN(parseD)) parseD = Date.now();

              let rawTime = a.time_in;
              if (!rawTime && a.created_at) {
                rawTime = new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              }
              const cleanTime = formatTimeAMPM(rawTime);

              return {
                date: a.date || new Date(a.created_at).toLocaleDateString('ms-MY'),
                time: cleanTime,
                status: a.status || 'Hadir Fizikal',
                remarks: a.remarks || a.justifikasi || '-',
                rawMs: parseD
              };
            });

            presentCount = formattedAtt.filter(h => 
              h.status.toLowerCase().includes('hadir') && !h.status.toLowerCase().includes('tidak')
            ).length;
            absentCount = formattedAtt.filter(h => 
              h.status.toLowerCase().includes('tidak') || h.status.toLowerCase().includes('absent')
            ).length;
          }

          const totalDays = presentCount + absentCount;
          const attPct = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

          // Semak status hari ini
          const todayRecord = formattedAtt.find(att => att.date === todayStr || att.date === todayIso);
          const statusHariIni = todayRecord ? todayRecord.status : 'Tiada Rekod';
          const waktuHariIni = todayRecord ? todayRecord.time : '-';

          // 2. PEMPROSESAN REKOD PENILAIAN HAFAZAN
          let historyRecords: AssessmentHistory[] = [];
          let lastGradeStr = 'Belum Dinilai';
          let currentProg = 'Belum Mula';
          let lastAssesDate = '-';
          let mIssue = 'Tiada Rekod';

          if (studentEval.length > 0) {
            historyRecords = studentEval.map((r: any) => ({
              date: new Date(r.created_at).toLocaleDateString('ms-MY'),
              surah: r.surah || '-',
              grade: r.gred || '-',
              notes: r.catatan || '-'
            }));
            
            lastGradeStr = studentEval[0].gred || 'Belum Dinilai';
            currentProg = studentEval[0].surah || 'Belum Mula';
            lastAssesDate = new Date(studentEval[0].created_at).toLocaleDateString('ms-MY');
            
            const lCat = (studentEval[0].catatan || '').toLowerCase();
            if (lCat.includes('tajwid')) mIssue = 'Tajwid';
            else if (lCat.includes('lancar') || lCat.includes('sangkut')) mIssue = 'Kelancaran Sangkut';
            else if (lCat.includes('baris')) mIssue = 'Salah Baris';
            else if (lCat.includes('makhraj')) mIssue = 'Makhraj Huruf';
            else mIssue = 'Tiada (Lancar)';
          }

          const actualClassName = pelajar.class_id ? (classMap.get(pelajar.class_id) || pelajar.class_id) : 'Tiada Kelas';

          allStudents.push({
            id: pelajar.id,
            matrik: pelajar.matrik_or_id || '-',
            name: pelajar.full_name,
            image: pelajar.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pelajar.full_name)}&background=0f172a&color=fff`,
            className: actualClassName,
            classId: pelajar.class_id,
            phone: pelajar.phone || '-',
            guardian: pelajar.guardian || `Penjaga kepada ${pelajar.full_name}`,
            guardianPhone: pelajar.guardian_phone || '-',
            joinedDate: new Date(pelajar.created_at).toLocaleDateString('ms-MY'),
            attendanceType: statusHariIni,
            todayTime: waktuHariIni,
            lastAssessment: lastAssesDate,
            lastGrade: lastGradeStr,
            mainIssue: mIssue,
            currentProgress: currentProg,
            totalJuzuk: historyRecords.length > 0 ? Math.ceil(historyRecords.length / 5) : 0,
            totalPages: historyRecords.length * 2,
            history: historyRecords,
            yearlyHistory: [
              { month: 'Sesi Semasa', progress: currentProg, grade: lastGradeStr, attendance: `${attPct}%` }
            ],
            attendanceHistory: formattedAtt,
            attendanceSummary: { present: presentCount, absent: absentCount, percentage: attPct },
            gender: pelajar.gender || '-',
            dob: pelajar.dob || '-',
            pob: pelajar.pob || '-',
            state_of_birth: pelajar.state_of_birth || '-',
            country_of_birth: pelajar.country_of_birth || '-',
            nationality: pelajar.nationality || '-',
            race: pelajar.race || '-',
            citizenship_status: pelajar.citizenship_status || '-',
            address: pelajar.address || '-',
            postcode: pelajar.postcode || '-',
            city: pelajar.city || '-',
            state: pelajar.state || '-',
            email: pelajar.email || '-',
            health_status: pelajar.health_status || '-',
            allergies: pelajar.allergies || '-',
            dietary_needs: pelajar.dietary_needs || '-',
            learning_aids: pelajar.learning_aids || '-',
            emergency_meds: pelajar.emergency_meds || '-',
            parent_name: pelajar.parent_name || pelajar.guardian || '-',
            parent_ic: pelajar.parent_ic || '-',
            parent_relation: pelajar.parent_relation || '-',
            parent_dob: pelajar.parent_dob || '-',
            parent_nationality: pelajar.parent_nationality || '-',
            parent_occupation: pelajar.parent_occupation || '-',
            parent_job_title: pelajar.parent_job_title || '-',
            parent_employer: pelajar.parent_employer || '-',
            parent_work_address: pelajar.parent_work_address || '-',
            parent_phone: pelajar.parent_phone || pelajar.guardian_phone || '-',
            parent_office_phone: pelajar.parent_office_phone || '-',
            parent_email: pelajar.parent_email || '-',
            parent_income: pelajar.parent_income || '-'
          });
        });

        setStudents(allStudents);
      } catch (err) {
        console.error("Gagal menarik data Laporan:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLaporanData();
  }, []);

  const handleExportCSV = () => {};
  const triggerPrint = () => window.print();

  const filteredStudents = students.filter(student => {
    const matchName = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || student.matrik.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = selectedClass === 'Semua Kelas' || student.className === selectedClass || student.classId === selectedClass;
    return matchName && matchClass;
  });

  const getFilteredAttendance = (student: StudentReport | null) => {
    if (!student) return [];
    
    return student.attendanceHistory.filter(att => {
      const d = new Date(att.rawMs || Date.now());
      const monthNames = ['JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN', 'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'];
      const attMonthYear = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      
      if (attendanceFilter === 'Harian') {
        const todayStr = new Date().toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
        return att.date.includes(todayStr.split(' ')[0]) || student.attendanceHistory.indexOf(att) === 0;
      }
      if (attendanceFilter === 'Bulanan') {
        return attMonthYear === selectedMonth;
      }
      if (attendanceFilter === 'Tahunan') {
        return d.getFullYear().toString() === selectedMonth.split(' ')[1];
      }
      return true;
    });
  };

  const getAttendanceBadge = (type: string) => {
    if (type.includes('Online')) return `${styles.badge} ${styles.bgOnline}`; 
    if (type.includes('Fizikal') || (type.includes('Hadir') && !type.includes('Tidak'))) return `${styles.badge} ${styles.bgFizikal}`; 
    return `${styles.badge} ${styles.bgAbsent}`;
  };

  const getGradeBadge = (grade: string) => {
    if (grade.includes('Mumtaz')) return `${styles.badge} ${styles.gredMumtaz}`;
    if (grade.includes('Jayyid')) return `${styles.badge} ${styles.gredJayyid}`;
    if (grade.includes('Maqbul')) return `${styles.badge} ${styles.gredMaqbul}`;
    if (grade.includes('Rasib')) return `${styles.badge} ${styles.gredRasib}`;
    return `${styles.badge}`;
  };

  const isAnyModalOpenForPrint = selectedReportCardStudent || isBatchPrintOpen || selectedAttendanceStudent;

  if (isLoading) {
    return (
      <DashboardGuruLayout userName="Memuatkan..." userRole="Guru Pentasmik">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Loader2 className="animate-spin" size={40} color="#0062ff" />
        </div>
      </DashboardGuruLayout>
    );
  }

  return (
    <DashboardGuruLayout userName={guruName || 'Guru'} userRole="Guru Pentasmik">
      <div className={styles.container}>
        
        {/* HEADER KAD */}
        <div className={styles.headerCard}>
          <div className={styles.titleWrap}>
            <h1 className={styles.mainTitle}><FileText size={24} color="#10b981" /> Laporan & Rekod Pencapaian</h1>
            <p className={styles.subtitle}>Pantau rekod kehadiran dan pencapaian hafazan bagi kohort pelajar yang di-assign kepada anda.</p>
          </div>
          <div className={styles.headerActions}>
            <button className={`${styles.exportBtn} ${styles.btnExcel}`} onClick={handleExportCSV}>
              <Download size={16} /> Eksport Keseluruhan (.XLSX)
            </button>
            <button className={`${styles.exportBtn} ${styles.btnPdf}`} onClick={() => triggerPrint()}>
              <Printer size={16} /> Cetak Laporan Penuh (PDF)
            </button>
          </div>
        </div>

        {/* BAR PENAPIS & CETAK SEMUA */}
        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Search size={18} color="#94a3b8" />
            <input type="text" placeholder="Cari nama atau matrik..." className={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <select className={styles.filterSelect} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="Semua Kelas">Semua Kelas Saya</option>
            {senaraiKelas.map(cls => (
              <option key={cls.id} value={cls.name}>{cls.name}</option>
            ))}
          </select>
          <button className={styles.printAllBtn} onClick={() => setIsBatchPrintOpen(true)} disabled={students.length === 0}>
            <PrinterCheck size={18} /> Cetak Pukal Semua ({filteredStudents.length})
          </button>
        </div>

        {/* TAB NAVIGATION */}
        <div className={styles.tabContainer}>
          <button className={`${styles.tabBtn} ${activeTab === 'prestasi' ? styles.activeTab : ''}`} onClick={() => setActiveTab('prestasi')}><BookOpenCheck size={18} /> Laporan Prestasi Hafazan</button>
          <button className={`${styles.tabBtn} ${activeTab === 'kehadiran' ? styles.activeTab : ''}`} onClick={() => setActiveTab('kehadiran')}><CalendarClock size={18} /> Laporan Kehadiran Kelas</button>
        </div>

        {/* JADUAL DATA PELAJAR */}
        <div className={`${styles.tableCard} ${!isAnyModalOpenForPrint ? styles.printableContainer : ''}`}>
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                {activeTab === 'prestasi' ? (
                  <tr><th>No.</th><th>No. Matrik</th><th>Nama Pelajar</th><th>Status Kehadiran</th><th>Tarikh Terakhir</th><th>Gred Semasa</th><th>Rekod Kelemahan Utama</th><th className={styles.noPrint}>Tindakan Lanjut</th></tr>
                ) : (
                  <tr><th>No.</th><th>No. Matrik</th><th>Nama Pelajar</th><th>Status Hari Ini</th><th>Waktu Log Masuk</th><th>Hadir (Keseluruhan)</th><th>Tidak Hadir</th><th>% Kehadiran</th><th className={styles.noPrint}>Log Terperinci</th></tr>
                )}
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student, index) => (
                    <tr key={student.id}>
                      <td>{index + 1}</td>
                      <td>{student.matrik}</td>
                      <td>
                        <div className={styles.studentInfo}>
                          <p className={styles.studentName}>{student.name}</p>
                          <p className={styles.studentClass}>{student.className}</p>
                        </div>
                      </td>
                      <td><span className={getAttendanceBadge(student.attendanceType)}>{student.attendanceType}</span></td>
                      
                      {activeTab === 'prestasi' ? (
                        <>
                          <td>{student.lastAssessment}</td>
                          <td><span className={getGradeBadge(student.lastGrade)}>{student.lastGrade}</span></td>
                          <td>{student.mainIssue === 'Tiada (Lancar)' || student.mainIssue === 'Tiada Rekod' ? <span className={styles.safeTag}>{student.mainIssue}</span> : <span className={styles.issueTag}>{student.mainIssue}</span>}</td>
                          <td className={styles.noPrint}>
                            <div className={styles.actionGroup}>
                              <button className={styles.actionBtn} onClick={() => { setSelectedProfileStudent(student); setProfileTab('peribadi'); }} title="Lihat Profil Lengkap"><UserRoundSearch size={16} /></button>
                              <button className={styles.actionBtn} style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5' }} onClick={() => setSelectedAttendanceStudent(student)} title="Lihat Rekod Kehadiran"><CalendarClock size={16} /></button>
                              <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => setSelectedHistoryStudent(student)} title="Lihat Rekod Sejarah Hafazan"><History size={16} /></button>
                              <button className={styles.actionBtn} onClick={() => setSelectedReportCardStudent(student)} title="Cetak Report Card"><Printer size={16} /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td><strong>{student.todayTime}</strong></td>
                          <td>{student.attendanceSummary.present} Hari</td>
                          <td>{student.attendanceSummary.absent} Hari</td>
                          <td><span className={student.attendanceSummary.percentage >= 90 ? styles.pctGood : student.attendanceSummary.percentage >= 80 ? styles.pctWarn : styles.pctBad}>{student.attendanceSummary.percentage}%</span></td>
                          <td className={styles.noPrint}>
                            <button className={styles.actionBtn} style={{ color: '#059669', borderColor: '#a7f3d0', background: '#ecfdf5', margin: '0 auto' }} onClick={() => setSelectedAttendanceStudent(student)} title="Lihat Log Kehadiran Penuh"><CalendarClock size={14} /> Log Harian</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Tiada pelajar yang di-assign kepada anda dijumpai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL 1: PROFIL PELAJAR */}
        {selectedProfileStudent && (
          <div className={styles.modalOverlay} onClick={() => setSelectedProfileStudent(null)}>
            <div className={`${styles.modalContent} ${styles.modalContentLarge}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
              
              <div className={styles.modalHeader}>
                <div className={styles.modalProfile}>
                  <img src={selectedProfileStudent.image} alt="Profile" className={styles.modalAvatar} />
                  <div>
                    <h2 className={styles.modalName}>{selectedProfileStudent.name}</h2>
                    <p className={styles.modalMatrik}>{selectedProfileStudent.matrik} • {selectedProfileStudent.className}</p>
                  </div>
                </div>
                <button className={styles.closeBtn} onClick={() => setSelectedProfileStudent(null)}><X size={20} /></button>
              </div>
              
              <div className={styles.modalBody}>
                {/* TAB MAKLUMAT PROFIL */}
                <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', overflowX: 'auto' }}>
                  <button 
                    onClick={() => setProfileTab('peribadi')} 
                    style={{ background: 'none', border: 'none', borderBottom: profileTab === 'peribadi' ? '2px solid #0f172a' : '2px solid transparent', padding: '0.5rem 0', fontWeight: 700, color: profileTab === 'peribadi' ? '#0f172a' : '#64748b', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    Maklumat Peribadi
                  </button>
                  <button 
                    onClick={() => setProfileTab('hafazan')} 
                    style={{ background: 'none', border: 'none', borderBottom: profileTab === 'hafazan' ? '2px solid #0f172a' : '2px solid transparent', padding: '0.5rem 0', fontWeight: 700, color: profileTab === 'hafazan' ? '#0f172a' : '#64748b', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    Maklumat Hafazan
                  </button>
                  <button 
                    onClick={() => setProfileTab('kesihatan')} 
                    style={{ background: 'none', border: 'none', borderBottom: profileTab === 'kesihatan' ? '2px solid #0f172a' : '2px solid transparent', padding: '0.5rem 0', fontWeight: 700, color: profileTab === 'kesihatan' ? '#0f172a' : '#64748b', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    Maklumat Kesihatan
                  </button>
                  <button 
                    onClick={() => setProfileTab('waris')} 
                    style={{ background: 'none', border: 'none', borderBottom: profileTab === 'waris' ? '2px solid #0f172a' : '2px solid transparent', padding: '0.5rem 0', fontWeight: 700, color: profileTab === 'waris' ? '#0f172a' : '#64748b', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                    Bapa / Penjaga
                  </button>
                </div>

                {/* KANDUNGAN MAKLUMAT PERIBADI */}
                {profileTab === 'peribadi' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                    <InfoItem icon={<User size={14}/>} label="No. MyKad/Pasport" value={selectedProfileStudent.matrik} />
                    <InfoItem icon={<Calendar size={14}/>} label="Tarikh Lahir" value={selectedProfileStudent.dob} />
                    <InfoItem icon={<Users size={14}/>} label="Jantina" value={selectedProfileStudent.gender} />
                    <InfoItem icon={<MapPin size={14}/>} label="Tempat Lahir" value={selectedProfileStudent.pob} />
                    <InfoItem icon={<MapPin size={14}/>} label="Negeri Kelahiran" value={selectedProfileStudent.state_of_birth} />
                    <InfoItem icon={<MapPin size={14}/>} label="Negara Kelahiran" value={selectedProfileStudent.country_of_birth} />
                    <InfoItem icon={<User size={14}/>} label="Kewarganegaraan" value={selectedProfileStudent.nationality} />
                    <InfoItem icon={<Users size={14}/>} label="Bangsa" value={selectedProfileStudent.race} />
                    <InfoItem icon={<ShieldCheck size={14}/>} label="Status Kewarganegaraan" value={selectedProfileStudent.citizenship_status} />
                    <div style={{ gridColumn: '1 / -1' }}>
                      <InfoItem icon={<MapPin size={14}/>} label="Alamat Tempat Tinggal" value={`${selectedProfileStudent.address || ''}, ${selectedProfileStudent.postcode || ''} ${selectedProfileStudent.city || ''}, ${selectedProfileStudent.state || ''}`} />
                    </div>
                    <InfoItem icon={<Phone size={14}/>} label="Nombor Telefon" value={selectedProfileStudent.phone} />
                    <InfoItem icon={<Mail size={14}/>} label="E-mel" value={selectedProfileStudent.email} />
                  </div>
                )}
                
                {/* KANDUNGAN MAKLUMAT HAFAZAN */}
                {profileTab === 'hafazan' && (
                  <div>
                    <div className={styles.statusSection} style={{ marginBottom: '1.5rem' }}>
                      <p className={styles.statusLabel}>Pencapaian Semasa</p>
                      <p className={styles.statusValue}>{selectedProfileStudent.currentProgress}</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Jumlah Juzuk Dihafaz</p>
                        <p style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>{selectedProfileStudent.totalJuzuk} <span style={{fontSize:'0.9rem', color:'#64748b'}}>Juzuk</span></p>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Purata Muka Surat</p>
                        <p style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>{selectedProfileStudent.totalPages} <span style={{fontSize:'0.9rem', color:'#64748b'}}>M/S</span></p>
                      </div>
                    </div>
                  </div>
                )}

                {/* KANDUNGAN MAKLUMAT KESIHATAN */}
                {profileTab === 'kesihatan' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <InfoItem icon={<Activity size={14}/>} label="Keadaan Kesihatan Umum" value={selectedProfileStudent.health_status} />
                    <InfoItem icon={<AlertTriangle size={14}/>} label="Alahan yang Diketahui" value={selectedProfileStudent.allergies} />
                    <InfoItem icon={<UserCheck size={14}/>} label="Keperluan Pemakanan Khas" value={selectedProfileStudent.dietary_needs} />
                    <InfoItem icon={<BookOpenCheck size={14}/>} label="Keperluan Bantuan Pembelajaran" value={selectedProfileStudent.learning_aids} />
                    <InfoItem icon={<ShieldAlert size={14}/>} label="Ubat Kecemasan" value={selectedProfileStudent.emergency_meds} />
                  </div>
                )}

                {/* KANDUNGAN MAKLUMAT WARIS */}
                {profileTab === 'waris' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                    <InfoItem icon={<User size={14}/>} label="Nama Penuh" value={selectedProfileStudent.parent_name} />
                    <InfoItem icon={<User size={14}/>} label="No. MyKad/Pasport" value={selectedProfileStudent.parent_ic} />
                    <InfoItem icon={<Users size={14}/>} label="Hubungan dengan pelajar" value={selectedProfileStudent.parent_relation} />
                    <InfoItem icon={<Calendar size={14}/>} label="Tarikh Lahir" value={selectedProfileStudent.parent_dob} />
                    <InfoItem icon={<User size={14}/>} label="Kewarganegaraan" value={selectedProfileStudent.parent_nationality} />
                    <InfoItem icon={<Briefcase size={14}/>} label="Pekerjaan" value={selectedProfileStudent.parent_occupation} />
                    <InfoItem icon={<Briefcase size={14}/>} label="Jawatan" value={selectedProfileStudent.parent_job_title} />
                    <InfoItem icon={<Briefcase size={14}/>} label="Nama majikan/organisasi" value={selectedProfileStudent.parent_employer} />
                    <div style={{ gridColumn: '1 / -1' }}>
                      <InfoItem icon={<MapPin size={14}/>} label="Alamat tempat kerja" value={selectedProfileStudent.parent_work_address} />
                    </div>
                    <InfoItem icon={<Phone size={14}/>} label="No. telefon" value={selectedProfileStudent.parent_phone} />
                    <InfoItem icon={<Phone size={14}/>} label="No. telefon pejabat" value={selectedProfileStudent.parent_office_phone} />
                    <InfoItem icon={<Mail size={14}/>} label="E-mel" value={selectedProfileStudent.parent_email} />
                    <InfoItem icon={<CreditCard size={14}/>} label="Pendapatan bulanan" value={selectedProfileStudent.parent_income} />
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.actionBtn} onClick={() => setSelectedProfileStudent(null)}>Tutup</button>
                <button className={styles.printAllBtn} onClick={() => { const s = selectedProfileStudent; setSelectedProfileStudent(null); setSelectedReportCardStudent(s); }}><Printer size={16} /> Buka Kad Laporan</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: LAPORAN KEHADIRAN HARIAN */}
        {selectedAttendanceStudent && (
          <div className={styles.modalOverlay} onClick={() => setSelectedAttendanceStudent(null)}>
            <div className={`${styles.modalContent} ${styles.modalContentLarge}`} onClick={e => e.stopPropagation()}>
              <div className={`${styles.modalHeader} ${styles.noPrint}`}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Rekod Kehadiran Harian Pelajar</h3>
                <button className={styles.closeBtn} onClick={() => setSelectedAttendanceStudent(null)}><X size={20} /></button>
              </div>

              <div className={`${styles.modalBody} ${styles.printableContainer}`}>
                <div className={`${styles.printOptionBar} ${styles.noPrint}`} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span className={styles.printOptionLabel}>Pilih Penapis:</span>
                  <select className={styles.filterSelect} style={{ background: '#fff' }} value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value as 'Harian' | 'Bulanan' | 'Tahunan')}>
                    <option value="Harian">Harian (Hari Ini Sahaja)</option>
                    <option value="Bulanan">Bulanan (Bulan Spesifik)</option>
                    <option value="Tahunan">Tahunan (Keseluruhan Tahun)</option>
                  </select>

                  {attendanceFilter === 'Bulanan' && (
                    <select className={styles.filterSelect} style={{ background: '#fff' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                      {SENARAI_BULAN.map((bln) => (<option key={bln} value={bln}>{bln}</option>))}
                    </select>
                  )}
                </div>

                <div className={styles.reportSlipWrapper}>
                  <div className={styles.reportSlip}>
                    <div className={styles.slipSchoolHeader}>
                      <div className={styles.slipLogo} style={{ backgroundColor: '#0062ff' }}><CalendarClock size={30} /></div>
                      <h2 className={styles.slipSchoolName}>Maahad Tahfiz HuffazPro Malaysia</h2>
                      <div className={styles.slipTitle}>LAPORAN LOG KEHADIRAN PELAJAR</div>
                    </div>

                    <table className={styles.studentInfoTable}>
                      <tbody>
                        <tr><td><strong>Nama Pelajar:</strong> {selectedAttendanceStudent.name}</td><td><strong>No. Matrik:</strong> {selectedAttendanceStudent.matrik}</td></tr>
                        <tr>
                          <td><strong>Kelas / Tingkatan:</strong> {selectedAttendanceStudent.className}</td>
                          <td><strong>Penapis Dipilih:</strong> <span style={{ fontWeight: 700, color: '#0062ff' }}>{attendanceFilter === 'Bulanan' ? selectedMonth : attendanceFilter}</span></td>
                        </tr>
                      </tbody>
                    </table>

                    <div style={{ marginTop: '1rem' }}>
                      <table className={styles.slipTable}>
                        <thead><tr><th style={{ width: '20%' }}>Tarikh Kelas</th><th style={{ width: '25%' }}>Status Kehadiran</th><th style={{ width: '25%' }}>Waktu Hadir</th><th style={{ width: '30%' }}>Catatan / Justifikasi</th></tr></thead>
                        <tbody>
                          {getFilteredAttendance(selectedAttendanceStudent).length > 0 ? (
                            getFilteredAttendance(selectedAttendanceStudent).map((att, i) => (
                              <tr key={i}>
                                <td><strong>{att.date}</strong></td>
                                <td><span className={att.status.includes('Hadir') && !att.status.includes('Tidak') ? styles.safeTag : styles.issueTag} style={{ padding: '0.25rem 0.6rem', fontSize: '11px', border: 'none' }}>{att.status}</span></td>
                                <td><strong style={{ fontSize: '14px' }}>{att.time}</strong></td>
                                <td>{att.remarks}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Tiada rekod kehadiran dijumpai untuk penapis ini.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className={styles.slipFooterSign}>
                      <div><div className={styles.signLine}>{guruName || 'Guru Kelas'}</div><p className={styles.signRole}>Guru Kelas</p></div>
                      <div style={{ textAlign: 'right' }}><div className={styles.signLine} style={{ borderColor: 'transparent' }}>Dicetak Pada: {new Date().toLocaleDateString('ms-MY')}</div><p className={styles.signRole}>Laporan Sistem Automatik</p></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`${styles.modalFooter} ${styles.noPrint}`}>
                <button className={styles.actionBtn} style={{ padding: '0.6rem 1.2rem' }} onClick={() => setSelectedAttendanceStudent(null)}>Tutup</button>
                <button className={styles.printAllBtn} style={{ margin: '0 0 0 auto', background: '#0062ff' }} onClick={triggerPrint}><Printer size={16} /> Cetak Mengikut Filter</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: SEJARAH HAFAZAN */}
        {selectedHistoryStudent && (
          <div className={styles.modalOverlay} onClick={() => setSelectedHistoryStudent(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalProfile}>
                  <img src={selectedHistoryStudent.image} alt="Profile" className={styles.modalAvatar} />
                  <div>
                    <h2 className={styles.modalName}>{selectedHistoryStudent.name}</h2>
                    <p className={styles.modalMatrik}>{selectedHistoryStudent.matrik} • {selectedHistoryStudent.className}</p>
                  </div>
                </div>
                <button className={styles.closeBtn} onClick={() => setSelectedHistoryStudent(null)}><X size={20} /></button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.statusSection}><p className={styles.statusLabel}>Status Terkini</p><p className={styles.statusValue}>{selectedHistoryStudent.currentProgress}</p></div>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Sejarah Sesi Tasmik</h3>
                  <div className={styles.historyList}>
                    {selectedHistoryStudent.history.length > 0 ? selectedHistoryStudent.history.map((record, i) => (
                      <div key={i} className={styles.historyItem}><p className={styles.historyDate}>{record.date}</p><div className={styles.historyDetail}><p className={styles.historyTitle}>{record.surah} <span className={getGradeBadge(record.grade)}>{record.grade}</span></p><p className={styles.historyNote}>{record.notes}</p></div></div>
                    )) : (
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Tiada rekod hafazan buat masa ini.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.printAllBtn} onClick={() => { const s = selectedHistoryStudent; setSelectedHistoryStudent(null); setSelectedReportCardStudent(s); }}><Printer size={16} /> Cetak Report Card</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: KAD LAPORAN INDIVIDU */}
        {selectedReportCardStudent && (
          <div className={styles.modalOverlay} onClick={() => setSelectedReportCardStudent(null)}>
            <div className={`${styles.modalContent} ${styles.modalContentLarge}`} onClick={e => e.stopPropagation()}>
              <div className={`${styles.modalHeader} ${styles.noPrint}`}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Pratonton Kad Laporan Rasmi</h3>
                <button className={styles.closeBtn} onClick={() => setSelectedReportCardStudent(null)}><X size={20} /></button>
              </div>

              <div className={`${styles.modalBody} ${styles.printableContainer}`}>
                <div className={`${styles.printOptionBar} ${styles.noPrint}`}>
                  <span className={styles.printOptionLabel}>Format Laporan:</span>
                  <select className={styles.filterSelect} style={{ background: '#fff' }} value={reportFormat} onChange={(e) => setReportFormat(e.target.value as 'Bulanan' | 'Tahunan')}>
                    <option value="Bulanan">Laporan Bulanan</option>
                    <option value="Tahunan">Laporan Tahunan (Sesi Semasa)</option>
                  </select>
                  {reportFormat === 'Bulanan' && (
                    <>
                      <span className={styles.printOptionLabel} style={{ marginLeft: '0.5rem' }}>Bulan:</span>
                      <select className={styles.filterSelect} style={{ background: '#fff' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                        {SENARAI_BULAN.map((bln) => (<option key={bln} value={bln}>{bln}</option>))}
                      </select>
                    </>
                  )}
                </div>

                <div className={styles.reportSlipWrapper}>
                  <div className={styles.reportSlip}>
                    <div className={styles.slipSchoolHeader}>
                      <div className={styles.slipLogo}><BookOpenCheck size={30} /></div>
                      <h2 className={styles.slipSchoolName}>Maahad Tahfiz HuffazPro Malaysia</h2>
                      <p className={styles.slipSchoolSub}>Pusat Kecemerlangan Al-Quran & Pengajian Sunnah (No. Pendaftaran: BZ-8982)</p>
                      <div className={styles.slipTitle}>{reportFormat === 'Tahunan' ? 'KAD LAPORAN PRESTASI HAFAZAN TAHUNAN' : 'KAD LAPORAN PRESTASI HAFAZAN BULANAN'}</div>
                    </div>

                    <table className={styles.studentInfoTable}>
                      <tbody>
                        <tr><td><strong>Nama Pelajar:</strong> {selectedReportCardStudent.name}</td><td><strong>No. Matrik:</strong> {selectedReportCardStudent.matrik}</td></tr>
                        <tr><td><strong>Kelas / Tingkatan:</strong> {selectedReportCardStudent.className}</td><td><strong>Status Pendaftaran:</strong> {selectedReportCardStudent.attendanceType === 'Online' ? 'Sepenuh Masa (Dalam Talian)' : 'Sepenuh Masa (Berasrama)'}</td></tr>
                        <tr>
                          <td><strong>Pencapaian Semasa:</strong> <span style={{ color: '#059669', fontWeight: 700 }}>{selectedReportCardStudent.currentProgress}</span></td>
                          {reportFormat === 'Bulanan' ? (<td><strong>Bulan Semakan:</strong> <span style={{ fontWeight: 700, color: '#dc2626' }}>{selectedMonth}</span></td>) : (<td><strong>Sesi Akademik:</strong> <span style={{ fontWeight: 700, color: '#0f172a' }}>Semasa</span></td>)}
                        </tr>
                      </tbody>
                    </table>

                    {reportFormat === 'Bulanan' ? (
                      <div style={{ marginTop: '1rem' }}>
                        <table className={styles.slipTable}>
                          <thead><tr><th style={{ width: '15%' }}>Tarikh</th><th style={{ width: '30%' }}>Surah & Ayat</th><th style={{ width: '15%' }}>Keputusan</th><th style={{ width: '40%' }}>Catatan Pentasmik</th></tr></thead>
                          <tbody>{selectedReportCardStudent.history.length > 0 ? selectedReportCardStudent.history.map((h, i) => (<tr key={i}><td><strong>{h.date}</strong></td><td>{h.surah}</td><td><strong>{h.grade}</strong></td><td>{h.notes}</td></tr>)) : <tr><td colSpan={4} style={{ textAlign: 'center' }}>Tiada rekod hafazan.</td></tr>}</tbody>
                        </table>
                      </div>
                    ) : (
                      <>
                        <div style={{ marginTop: '1rem' }}>
                          <table className={styles.slipTable}>
                            <thead><tr><th style={{ width: '25%' }}>Bulan</th><th style={{ width: '40%' }}>Capaian Hafazan Semasa</th><th style={{ width: '20%' }}>Purata Gred</th><th style={{ width: '15%' }}>Kehadiran</th></tr></thead>
                            <tbody>{selectedReportCardStudent.yearlyHistory.length > 0 ? selectedReportCardStudent.yearlyHistory.map((yh, i) => (<tr key={i}><td><strong>{yh.month}</strong></td><td>{yh.progress}</td><td><strong>{yh.grade}</strong></td><td>{yh.attendance}</td></tr>)) : <tr><td colSpan={4} style={{ textAlign: 'center' }}>Tiada rekod tahunan.</td></tr>}</tbody>
                          </table>
                        </div>
                        <div className={styles.yearlySummaryBox}>
                          <div><p className={styles.yearlyStatLabel}>Purata Gred Keseluruhan</p><p className={styles.yearlyStatValue} style={{ color: '#059669' }}>{selectedReportCardStudent.lastGrade}</p></div>
                          <div style={{ borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}><p className={styles.yearlyStatLabel}>Jumlah Juzuk Dihafaz</p><p className={styles.yearlyStatValue}>{selectedReportCardStudent.totalJuzuk} Juzuk</p></div>
                          <div><p className={styles.yearlyStatLabel}>Muka Surat Dicapai</p><p className={styles.yearlyStatValue}>{selectedReportCardStudent.totalPages} M/S</p></div>
                        </div>
                      </>
                    )}
                    <div className={styles.slipFooterSign}><div><div className={styles.signLine}>{guruName || 'Guru Pentasmik'}</div><p className={styles.signRole}>Guru Pentasmik</p></div><div style={{ textAlign: 'right' }}><div className={styles.signLine} style={{ borderColor: 'transparent' }}>Dicetak Pada: {new Date().toLocaleDateString('ms-MY')}</div></div></div>
                  </div>
                </div>
              </div>
              <div className={`${styles.modalFooter} ${styles.noPrint}`}><button className={styles.actionBtn} style={{ padding: '0.6rem 1.2rem' }} onClick={() => setSelectedReportCardStudent(null)}>Batal</button><button className={styles.printAllBtn} style={{ margin: '0 0 0 auto' }} onClick={triggerPrint}><Printer size={16} /> Cetak (PDF)</button></div>
            </div>
          </div>
        )}

        {/* MODAL 5: CETAK PUKAL KESELURUHAN */}
        {isBatchPrintOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsBatchPrintOpen(false)}>
            <div className={`${styles.modalContent} ${styles.modalContentLarge}`} onClick={e => e.stopPropagation()}>
              <div className={`${styles.modalHeader} ${styles.noPrint}`}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Cetak Pukal Semua Pelajar ({filteredStudents.length} Pelajar)</h3>
                <button className={styles.closeBtn} onClick={() => setIsBatchPrintOpen(false)}><X size={20} /></button>
              </div>

              <div className={`${styles.modalBody} ${styles.printableContainer}`}>
                <div className={`${styles.printOptionBar} ${styles.noPrint}`}>
                  <span className={styles.printOptionLabel}>Jenis Cetakan Pukal:</span>
                  <select className={styles.filterSelect} style={{ background: '#fff' }} value={batchPrintType} onChange={(e) => setBatchPrintType(e.target.value as 'Hafazan' | 'Kehadiran')}>
                    <option value="Hafazan">Laporan Prestasi Hafazan</option>
                    <option value="Kehadiran">Laporan Kehadiran Harian</option>
                  </select>

                  {batchPrintType === 'Hafazan' ? (
                    <>
                      <span className={styles.printOptionLabel} style={{ marginLeft: '0.5rem' }}>Format:</span>
                      <select className={styles.filterSelect} style={{ background: '#fff' }} value={reportFormat} onChange={(e) => setReportFormat(e.target.value as 'Bulanan' | 'Tahunan')}>
                        <option value="Bulanan">Bulanan</option>
                        <option value="Tahunan">Tahunan</option>
                      </select>
                      {reportFormat === 'Bulanan' && (
                        <select className={styles.filterSelect} style={{ background: '#fff', marginLeft: '0.5rem' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                          {SENARAI_BULAN.map((bln) => (<option key={bln} value={bln}>{bln}</option>))}
                        </select>
                      )}
                    </>
                  ) : (
                    <>
                      <span className={styles.printOptionLabel} style={{ marginLeft: '0.5rem' }}>Bulan:</span>
                      <select className={styles.filterSelect} style={{ background: '#fff' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                        {SENARAI_BULAN.map((bln) => (<option key={bln} value={bln}>{bln}</option>))}
                      </select>
                    </>
                  )}
                </div>

                {filteredStudents.map((student, idx) => (
                  <div key={student.id} className={styles.reportSlip} style={{ marginBottom: '2rem', pageBreakAfter: 'always' }}>
                    {batchPrintType === 'Hafazan' ? (
                      <>
                        <div className={styles.slipSchoolHeader}><div className={styles.slipLogo}><BookOpenCheck size={26} /></div><h2 className={styles.slipSchoolName}>Maahad Tahfiz HuffazPro Malaysia</h2><p className={styles.slipTitle}>{reportFormat === 'Tahunan' ? `KAD LAPORAN TAHUNAN (Salinan #${idx + 1})` : `KAD LAPORAN BULANAN (Salinan #${idx + 1})`}</p></div>
                        <table className={styles.studentInfoTable}><tbody><tr><td><strong>Nama Pelajar:</strong> {student.name}</td><td><strong>No. Matrik:</strong> {student.matrik}</td></tr><tr><td><strong>Kelas:</strong> {student.className}</td>{reportFormat === 'Bulanan' ? (<td><strong>Bulan Semakan:</strong> <span style={{ fontWeight: 700, color: '#dc2626' }}>{selectedMonth}</span></td>) : (<td><strong>Sesi Akademik:</strong> <span style={{ fontWeight: 700 }}>Semasa</span></td>)}</tr></tbody></table>
                        {reportFormat === 'Bulanan' ? (
                          <table className={styles.slipTable}><thead><tr><th>Tarikh</th><th>Surah & Ayat</th><th>Gred</th><th>Catatan</th></tr></thead><tbody>{student.history.map((h, i) => (<tr key={i}><td>{h.date}</td><td>{h.surah}</td><td>{h.grade}</td><td>{h.notes}</td></tr>))}</tbody></table>
                        ) : (
                          <><table className={styles.slipTable}><thead><tr><th>Bulan</th><th>Capaian Hafazan</th><th>Gred</th><th>Kehadiran</th></tr></thead><tbody>{student.yearlyHistory.map((yh, i) => (<tr key={i}><td>{yh.month}</td><td>{yh.progress}</td><td>{yh.grade}</td><td>{yh.attendance}</td></tr>))}</tbody></table>
                          <div className={styles.yearlySummaryBox} style={{ padding: '1rem', marginTop: '1rem' }}><div><p className={styles.yearlyStatLabel}>Purata Gred</p><p className={styles.yearlyStatValue}>{student.lastGrade}</p></div><div style={{ borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}><p className={styles.yearlyStatLabel}>Juzuk Dihafaz</p><p className={styles.yearlyStatValue}>{student.totalJuzuk}</p></div><div><p className={styles.yearlyStatLabel}>Muka Surat</p><p className={styles.yearlyStatValue}>{student.totalPages}</p></div></div></>
                        )}
                        <div className={styles.slipFooterSign}><div><div className={styles.signLine}>{guruName || 'Guru Pentasmik'}</div><p className={styles.signRole}>Guru Pentasmik</p></div><div style={{ textAlign: 'right' }}><div className={styles.signLine} style={{ borderColor: 'transparent' }}>Tarikh: {new Date().toLocaleDateString('ms-MY')}</div></div></div>
                      </>
                    ) : (
                      <>
                        <div className={styles.slipSchoolHeader}><div className={styles.slipLogo} style={{ backgroundColor: '#0062ff' }}><CalendarClock size={26} /></div><h2 className={styles.slipSchoolName}>Maahad Tahfiz HuffazPro Malaysia</h2><div className={styles.slipTitle}>LAPORAN LOG KEHADIRAN HARIAN (Salinan #${idx + 1})</div></div>
                        <table className={styles.studentInfoTable}><tbody><tr><td><strong>Nama Pelajar:</strong> {student.name}</td><td><strong>No. Matrik:</strong> {student.matrik}</td></tr><tr><td><strong>Kelas:</strong> {student.className}</td><td><strong>Bulan Rekod:</strong> <span style={{ fontWeight: 700, color: '#0062ff' }}>{selectedMonth}</span></td></tr></tbody></table>
                        <div style={{ marginTop: '1rem' }}>
                          <table className={styles.slipTable}>
                            <thead><tr><th style={{ width: '20%' }}>Tarikh Kelas</th><th style={{ width: '25%' }}>Status Kehadiran</th><th style={{ width: '25%' }}>Waktu Hadir</th><th style={{ width: '30%' }}>Catatan / Justifikasi Pelajar</th></tr></thead>
                            <tbody>{student.attendanceHistory.map((att, i) => (<tr key={i}><td><strong>{att.date}</strong></td><td><span className={att.status.includes('Hadir') && !att.status.includes('Tidak') ? styles.safeTag : styles.issueTag} style={{ padding: '0.25rem 0.6rem', fontSize: '11px', border: 'none' }}>{att.status}</span></td><td><strong style={{ fontSize: '14px' }}>{att.time}</strong></td><td>{att.remarks}</td></tr>))}</tbody>
                          </table>
                        </div>
                        <div className={styles.slipFooterSign}><div><div className={styles.signLine}>{guruName || 'Guru Kelas'}</div><p className={styles.signRole}>Guru Kelas</p></div><div style={{ textAlign: 'right' }}><div className={styles.signLine} style={{ borderColor: 'transparent' }}>Dicetak Pada: {new Date().toLocaleDateString('ms-MY')}</div></div></div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className={`${styles.modalFooter} ${styles.noPrint}`}><button className={styles.actionBtn} style={{ padding: '0.6rem 1.2rem' }} onClick={() => setIsBatchPrintOpen(false)}>Tutup</button><button className={styles.printAllBtn} style={{ margin: '0 0 0 auto' }} onClick={triggerPrint}><Printer size={16} /> Cetak Semua Salinan (PDF)</button></div>
            </div>
          </div>
        )}

      </div>
    </DashboardGuruLayout>
  );
}

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | undefined }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', border: '1px solid #f1f5f9', borderRadius: '8px', background: '#fafafa' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
      {icon} <span>{label}</span>
    </div>
    <div style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 700, paddingLeft: '1.5rem', whiteSpace: 'pre-wrap' }}>
      {value && value !== '-' ? value : '-'}
    </div>
  </div>
);