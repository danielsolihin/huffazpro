'use client';

import React, { useState, useEffect } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  Clock, Users, CheckCircle2, Award, 
  Video, FileSignature, Target, BarChart3, AlertTriangle, 
  RefreshCw, Loader2, BookOpen, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './GuruDashboard.module.css';

interface StudentQueueItem {
  id: string;
  matrik: string;
  name: string;
  target: string;
  type: 'live' | 'fizikal' | 'jadual';
  status: string;
  grade?: string;
  isCompleted?: boolean;
}

interface ClassSummary {
  id: string;
  level: string;
  name: string;
  students: StudentQueueItem[];
  waitingCount: number;
}

export default function GuruDashboardPage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // State Dinamik Supabase
  const [teacherName, setTeacherName] = useState('Ustaz / Ustazah');
  const [isLoading, setIsLoading] = useState(true);
  
  const [waitingStudent, setWaitingStudent] = useState<any>(null);
  const [completedEvaluations, setCompletedEvaluations] = useState<any[]>([]);
  const [dynamicQueue, setDynamicQueue] = useState<StudentQueueItem[]>([]);
  const [classesSummary, setClassesSummary] = useState<ClassSummary[]>([]);
  const [liveStudents, setLiveStudents] = useState<StudentQueueItem[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  
  // State Dinamik Statistik
  const [gradeStats, setGradeStats] = useState({ mumtaz: 0, jj: 0, jayyid: 0, maqbul: 0, rasib: 0 });
  const [issueStats, setIssueStats] = useState({ total: 0, tajwid: 0, kelancaran: 0, baris: 0, makhraj: 0 });

  // State Modal
  const [selectedClassForModal, setSelectedClassForModal] = useState<ClassSummary | null>(null);
  const [showLiveStudentsModal, setShowLiveStudentsModal] = useState(false);

  // 1. JAM MASA NYATA
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. FUNGSI MEMBACA DATA DARI SUPABASE (DITAPIS IKUT KELAS GURU)
  const syncDashboardData = async () => {
    try {
      // A. Semak Info Guru
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const tId = authData.user.id;

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', tId).single();
      const currentTeacherName = profile?.full_name || 'Ustaz / Ustazah';
      if (profile?.full_name) setTeacherName(currentTeacherName);

      // B. Cari Kelas Yang Diajar Oleh Guru Ini
      const { data: myClasses } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_name', currentTeacherName);
      
      const myClassIds = myClasses ? myClasses.map(c => c.id) : [];

      // C. Tarik Senarai Pelajar Yang HANYA Berada Dalam Kelas Guru Ini
      let assignedStudents: any[] = [];
      let pelajarCount = 0;

      if (myClassIds.length > 0) {
        const { data: studentsData, count } = await supabase
          .from('profiles')
          .select('id, full_name, matrik_or_id, class_id', { count: 'exact' })
          .ilike('role', '%elajar%')
          .in('class_id', myClassIds);
          
        assignedStudents = studentsData || [];
        pelajarCount = count || 0;
      }
      
      setTotalStudents(pelajarCount);

      // D. Rekod Penilaian Selesai Hari Ini
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: evals } = await supabase
        .from('evaluations')
        .select('*, profiles!evaluations_student_id_fkey(full_name, matrik_or_id, class_id)')
        .eq('teacher_id', tId)
        .order('created_at', { ascending: false });
        
      const allEvals = evals || [];
      const todayEvals = allEvals.filter((e: any) => new Date(e.created_at) >= today);
      setCompletedEvaluations(todayEvals);

      // Semak Notifikasi Sesi Live Menunggu
      const { data: liveNotifs } = await supabase
        .from('notifications')
        .select('*, profiles!notifications_sender_id_fkey(full_name, avatar_url)')
        .eq('user_id', tId)
        .eq('is_read', false)
        .like('title', '%Bilik Live%')
        .order('created_at', { ascending: false });

      if (liveNotifs && liveNotifs.length > 0) {
        const notif = liveNotifs[0];
        setWaitingStudent({
          id: notif.sender_id,
          nama: notif.profiles?.full_name || 'Pelajar',
          avatar: notif.profiles?.avatar_url || '',
          masaMasuk: new Date(notif.created_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        setWaitingStudent(null);
      }

      // --- BINA GILIRAN DINAMIK & RINGKASAN KELAS ---
      const queueList: StudentQueueItem[] = [];
      const processedNames = new Set<string>();
      
      // Untuk modal Live Students
      const liveList: StudentQueueItem[] = [];

      // Masukkan senarai yang TELAH SELESAI
      todayEvals.forEach((ev: any) => {
        const studentName = ev.profiles?.full_name || 'Pelajar';
        if (!processedNames.has(studentName)) {
          const item: StudentQueueItem = {
            id: ev.profiles?.id || ev.student_id,
            matrik: ev.profiles?.matrik_or_id || '-', 
            name: studentName,
            target: `${ev.surah || 'Al-Quran'}`,
            type: ev.type === 'Live' ? 'live' : 'fizikal',
            status: `Selesai (${ev.gred})`,
            grade: ev.gred,
            isCompleted: true
          };
          queueList.push(item);
          processedNames.add(studentName);
        }
      });

      // Masukkan baki pelajar (di bawah pantauan guru ini sahaja) yang BELUM SELESAI
      assignedStudents.forEach(p => {
        if (!processedNames.has(p.full_name)) {
          // Andaikata notifikasi live ada untuk pelajar ini, set type = live
          const isLive = liveNotifs?.some(n => n.sender_id === p.id);
          const item: StudentQueueItem = {
            id: p.id,
            matrik: p.matrik_or_id || 'Tiada Matrik', 
            name: p.full_name,
            target: 'Belum Ditetapkan',
            type: isLive ? 'live' : 'fizikal',
            status: isLive ? 'Menunggu Online' : 'Giliran Seterusnya',
            isCompleted: false
          };
          queueList.push(item);
          if (isLive) liveList.push(item);
          processedNames.add(p.full_name);
        }
      });

      setDynamicQueue(queueList);
      setLiveStudents(liveList);

      // Bina ringkasan mengikut kelas
      const classSummaries: ClassSummary[] = (myClasses || []).map(cls => {
        const classStudents = assignedStudents.filter(s => s.class_id === cls.id);
        const studentNamesInClass = new Set(classStudents.map(s => s.full_name));
        
        // Cari queue item untuk pelajar dalam kelas ini
        const studentsInQueue = queueList.filter(q => studentNamesInClass.has(q.name));
        const waitingCount = studentsInQueue.filter(q => !q.isCompleted).length;

        return {
          id: cls.id,
          level: cls.level || 'Peringkat',
          name: cls.name,
          students: studentsInQueue,
          waitingCount: waitingCount
        };
      });

      setClassesSummary(classSummaries);

      // --- KIRA STATISTIK GRED & RALAT KESELURUHAN ---
      let mumtaz = 0, jj = 0, jayyid = 0, maqbul = 0, rasib = 0;
      let tajwid = 0, kelancaran = 0, baris = 0, makhraj = 0;
      const totalEvals = allEvals.length;

      allEvals.forEach((ev: any) => {
        const g = (ev.gred || '').toLowerCase();
        if (g.includes('mumtaz')) mumtaz++;
        else if (g.includes('jiddan')) jj++;
        else if (g.includes('jayyid')) jayyid++;
        else if (g.includes('maqbul')) maqbul++;
        else if (g.includes('rasib')) rasib++;

        const cat = (ev.catatan || '').toLowerCase();
        if (cat.includes('tajwid')) tajwid++;
        if (cat.includes('sangkut') || cat.includes('lancar')) kelancaran++;
        if (cat.includes('baris')) baris++;
        if (cat.includes('makhraj')) makhraj++;
      });

      const totalErrors = tajwid + kelancaran + baris + makhraj;

      setGradeStats({
        mumtaz: totalEvals ? Math.round((mumtaz / totalEvals) * 100) : 0,
        jj: totalEvals ? Math.round((jj / totalEvals) * 100) : 0,
        jayyid: totalEvals ? Math.round((jayyid / totalEvals) * 100) : 0,
        maqbul: totalEvals ? Math.round((maqbul / totalEvals) * 100) : 0,
        rasib: totalEvals ? Math.round((rasib / totalEvals) * 100) : 0,
      });

      setIssueStats({ total: totalErrors, tajwid, kelancaran, baris, makhraj });

    } catch (error) {
      console.error('Ralat menarik dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    syncDashboardData();
  }, []);

  const completedCount = dynamicQueue.filter(item => item.isCompleted).length;
  const presentStudents = totalStudents;

  const renderStudentList = (students: StudentQueueItem[]) => (
    <div className={styles.studentList}>
      {students.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Tiada pelajar disenaraikan.</p>
        </div>
      ) : (
        students.map((student, index) => {
          const isWaitingLive = student.type === 'live' && !student.isCompleted;
          
          return (
            <div 
              key={student.id} 
              className={styles.studentItem}
              style={{ 
                borderColor: isWaitingLive ? '#3b82f6' : student.isCompleted ? '#10b981' : '#e2e8f0',
                background: isWaitingLive ? '#eff6ff' : student.isCompleted ? '#f0fdf4' : '#fff'
              }}
            >
              <div className={styles.studentProfile}>
                <div 
                  className={styles.studentNumber}
                  style={{
                    background: isWaitingLive ? '#2563eb' : student.isCompleted ? '#10b981' : '#e2e8f0',
                    color: isWaitingLive || student.isCompleted ? '#fff' : '#64748b'
                  }}
                >
                  {student.isCompleted ? <CheckCircle2 size={16} /> : index + 1}
                </div>
                
                <div className={styles.studentInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 className={styles.studentName} style={{ margin: 0 }}>{student.name}</h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({student.matrik})</span>
                  </div>
                  
                  <p className={styles.studentTarget}>
                    <Target size={12} color="#64748b" /> Sasaran/Semakan: {student.target}
                  </p>
                  
                  <span 
                    className={styles.badge}
                    style={{
                      background: isWaitingLive ? '#dbeafe' : student.isCompleted ? '#dcfce7' : '#f1f5f9',
                      color: isWaitingLive ? '#1e40af' : student.isCompleted ? '#166534' : '#475569',
                      fontWeight: 700
                    }}
                  >
                    {student.status}
                  </span>
                </div>
              </div>

              <div className={styles.actionGroup}>
                {isWaitingLive ? (
                  <button 
                    className={`${styles.btnAction} ${styles.btnPrimary}`} 
                    onClick={() => router.push(`/guru/tasmik-live?studentId=${student.id}`)}
                    style={{ background: '#0062ff', padding: '0.6rem 1.2rem', gap: '6px' }}
                  >
                    <Video size={16} /> Sertai Bilik Live
                  </button>
                ) : student.isCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, background: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                      {student.grade ? `Gred: ${student.grade}` : 'Selesai Dinilai'}
                    </span>
                  </div>
                ) : (
                  <>
                    <button 
                      className={`${styles.btnAction} ${styles.btnSecondary}`} 
                      onClick={() => router.push(`/guru/penilaian-offline?studentId=${student.id}`)} 
                      title="Buka Borang Penilaian Bersemuka"
                    >
                      <FileSignature size={15} /> Borang
                    </button>
                    
                    <button 
                      className={`${styles.btnAction} ${styles.btnPrimary}`} 
                      onClick={() => router.push(`/guru/tasmik-live?studentId=${student.id}`)} 
                      title="Panggil Untuk Sesi Live"
                    >
                      <Video size={15} /> Bilik Live
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (isLoading) {
    return (
      <DashboardGuruLayout userName="Memuatkan..." userRole="Guru">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <Loader2 className="animate-spin" size={40} color="#0062ff" />
        </div>
      </DashboardGuruLayout>
    );
  }

  return (
    <DashboardGuruLayout userName={teacherName} userRole="Guru Pentasmik">
      <div className={styles.container}>
        
        {/* BANNER NOTIFIKASI JIKA PELAJAR SEDANG MENUNGGU DALAM BILIK */}
        {waitingStudent && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'slideDown 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <img src={waitingStudent.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"} alt="Pelajar" style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', border: '2px solid #fff' }}></span>
              </div>
              <div>
                <h4 style={{ margin: '0 0 0.2rem 0', color: '#1e40af', fontSize: '1.05rem', fontWeight: 700 }}>Pelajar Sedang Menunggu di Bilik Tasmik!</h4>
                <p style={{ margin: 0, color: '#1d4ed8', fontSize: '0.85rem' }}>
                  <strong>{waitingStudent.nama}</strong> telah memulakan sesi dan bersedia untuk ditasmik sejak jam {waitingStudent.masaMasuk}.
                </p>
              </div>
            </div>
            <button 
              onClick={() => router.push(`/guru/tasmik-live?studentId=${waitingStudent.id}`)}
              style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0.75rem 1.4rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0, 98, 255, 0.25)' }}
            >
              <Video size={18} /> Masuk Bilik Tasmik Sekarang
            </button>
          </div>
        )}
        
        {/* 1. BARISAN KAD STATISTIK UTAMA */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: '#ecfdf5', color: '#10b981' }}><Clock size={28} strokeWidth={1.5} /></div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Waktu Semasa</p>
              <h3 className={styles.statValue}>{currentTime || 'Memuatkan...'}</h3>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: '#eff6ff', color: '#2563eb' }}><Users size={28} strokeWidth={1.5} /></div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Pelajar Bawah Seliaan</p>
              <h3 className={styles.statValue}>{presentStudents} <span>Orang</span></h3>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: completedCount > 0 ? '#ecfdf5' : '#fef2f2', color: completedCount > 0 ? '#10b981' : '#ef4444' }}>
              <CheckCircle2 size={28} strokeWidth={1.5} />
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Selesai Tasmik (Hari Ini)</p>
              <h3 className={styles.statValue}>{completedCount} <span>/ {totalStudents} Pelajar</span></h3>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: '#f5f3ff', color: '#8b5cf6' }}><Award size={28} strokeWidth={1.5} /></div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Gred Terkini Dicapai</p>
              <h3 className={styles.statValue} style={{ color: '#8b5cf6', fontSize: '1.2rem' }}>
                {completedEvaluations.length > 0 ? completedEvaluations[0].gred : 'Tiada'}
              </h3>
            </div>
          </div>
        </div>

        {/* 2. GRID KANDUNGAN UTAMA */}
        <div className={styles.mainGrid}>
          
          {/* KOLUM KIRI: GILIRAN KELAS / PELAJAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* BAHAGIAN BARU: PELAJAR ONLINE HARI INI */}
            <div className={styles.panelCard} style={{ border: '2px solid #bfdbfe' }}>
              <div className={styles.panelHeader} style={{ background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
                <h2 className={styles.panelTitle} style={{ color: '#1e40af' }}>
                  <Video size={18} color="#2563eb" strokeWidth={2} /> Pelajar Online Hari Ini
                </h2>
              </div>
              <div 
                style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setShowLiveStudentsModal(true)}
              >
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.1rem' }}>Tasmik Secara Online</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                    Terdapat <strong style={{ color: '#0062ff' }}>{liveStudents.length} pelajar</strong> sedang menunggu atau menjadualkan sesi online.
                  </p>
                </div>
                <div style={{ background: '#eff6ff', color: '#2563eb', padding: '0.75rem 1.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
                  Lihat Senarai
                </div>
              </div>
            </div>

            {/* GILIRAN KELAS */}
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}><BookOpen size={18} color="#2563eb" strokeWidth={2} /> Giliran Semakan Hafazan Hari Ini</h2>
                <button 
                  type="button"
                  onClick={syncDashboardData}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={13} /> Muat Semula
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', padding: '1.5rem' }}>
                {classesSummary.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>
                    <BookOpen size={40} color="#cbd5e1" style={{ margin: '0 auto 1rem auto' }} />
                    <p style={{ margin: 0 }}>Tiada kelas di bawah seliaan anda.</p>
                  </div>
                ) : (
                  classesSummary.map(cls => (
                    <div 
                      key={cls.id}
                      onClick={() => setSelectedClassForModal(cls)}
                      style={{ 
                        background: '#f8fafc', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '12px', 
                        padding: '1.25rem', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, marginBottom: '0.25rem' }}>{cls.level}</div>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.1rem' }}>{cls.name}</h3>
                        <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', gap: '1rem' }}>
                          <span>Jumlah Pelajar: <strong>{cls.students.length}</strong></span>
                          <span>Menunggu Tasmik: <strong style={{ color: cls.waitingCount > 0 ? '#ef4444' : '#10b981' }}>{cls.waitingCount}</strong></span>
                        </div>
                      </div>
                      <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '8px', color: '#0f172a', fontSize: '0.85rem', fontWeight: 600 }}>
                        Buka Kelas
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* KOLUM KANAN: ANALITIK */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}><BarChart3 size={18} color="#10b981" strokeWidth={2} /> Taburan Gred Terkini</h2>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.chartWrapper}>
                  <div className={styles.chartRow}>
                    <span className={styles.chartLabel}>Mumtaz</span>
                    <div className={styles.chartBarBg}><div className={`${styles.chartBarFill} ${styles.fillMumtaz}`} style={{ width: `${gradeStats.mumtaz}%` }}></div></div>
                    <span className={styles.chartValue}>{gradeStats.mumtaz}%</span>
                  </div>
                  <div className={styles.chartRow}>
                    <span className={styles.chartLabel}>J. Jiddan</span>
                    <div className={styles.chartBarBg}><div className={`${styles.chartBarFill} ${styles.fillJayyid}`} style={{ width: `${gradeStats.jj}%` }}></div></div>
                    <span className={styles.chartValue}>{gradeStats.jj}%</span>
                  </div>
                  <div className={styles.chartRow}>
                    <span className={styles.chartLabel}>Jayyid</span>
                    <div className={styles.chartBarBg}><div className={`${styles.chartBarFill} ${styles.fillMaqbul}`} style={{ width: `${gradeStats.jayyid}%` }}></div></div>
                    <span className={styles.chartValue}>{gradeStats.jayyid}%</span>
                  </div>
                  <div className={styles.chartRow}>
                    <span className={styles.chartLabel}>Maqbul</span>
                    <div className={styles.chartBarBg}><div className={`${styles.chartBarFill} ${styles.fillRasib}`} style={{ width: `${gradeStats.maqbul}%`, background: '#64748b' }}></div></div>
                    <span className={styles.chartValue}>{gradeStats.maqbul}%</span>
                  </div>
                  <div className={styles.chartRow}>
                    <span className={styles.chartLabel}>Rasib</span>
                    <div className={styles.chartBarBg}><div className={`${styles.chartBarFill} ${styles.fillRasib}`} style={{ width: `${gradeStats.rasib}%` }}></div></div>
                    <span className={styles.chartValue}>{gradeStats.rasib}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.panelCard}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}><AlertTriangle size={18} color="#f59e0b" strokeWidth={2} /> Anggaran Isu Hafazan</h2>
              </div>
              <div className={styles.panelBody} style={{ paddingTop: '1.2rem' }}>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0' }}>Pecahan catatan yang kerap disebut oleh guru:</p>
                
                <div className={styles.chartContainer}>
                  <div className={styles.donutChart}>
                    <div className={styles.donutHole}>
                      <p className={styles.donutTotal}>{issueStats.total}</p>
                      <p className={styles.donutLabel}>Total Kes</p>
                    </div>
                  </div>
                  
                  <div className={styles.legendList}>
                    <div className={styles.legendItem}>
                      <div className={styles.legendName}><div className={`${styles.legendDot} ${styles.dotBlue}`}></div> Tajwid (Dengung)</div>
                      <span className={styles.legendCount}>{issueStats.tajwid}</span>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={styles.legendName}><div className={`${styles.legendDot} ${styles.dotYellow}`}></div> Kelancaran</div>
                      <span className={styles.legendCount}>{issueStats.kelancaran}</span>
                    </div>
                    <div className={styles.legendItem}>
                      <div className={styles.legendName}><div className={`${styles.legendDot} ${styles.dotRed}`}></div> Makhraj / Baris</div>
                      <span className={styles.legendCount}>{issueStats.makhraj + issueStats.baris}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* MODAL: SENARAI PELAJAR DALAM KELAS */}
      {selectedClassForModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>{selectedClassForModal.level}</p>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{selectedClassForModal.name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedClassForModal(null)} style={{ background: '#e2e8f0', border: 'none', color: '#475569', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {renderStudentList(selectedClassForModal.students)}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SENARAI PELAJAR ONLINE */}
      {showLiveStudentsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Video size={20} /> Pelajar Online Hari Ini
                </h3>
              </div>
              <button type="button" onClick={() => setShowLiveStudentsModal(false)} style={{ background: '#dbeafe', border: 'none', color: '#1e40af', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {renderStudentList(liveStudents)}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </DashboardGuruLayout>
  );
}