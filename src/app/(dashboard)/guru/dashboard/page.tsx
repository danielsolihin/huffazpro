'use client';

import React, { useState, useEffect } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  Clock, Users, CheckCircle2, Award, 
  Video, FileSignature, Target, BarChart3, AlertTriangle, 
  RefreshCw, Loader2
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

export default function GuruDashboardPage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // State Dinamik Supabase
  const [teacherName, setTeacherName] = useState('Ustaz / Ustazah');
  const [isLoading, setIsLoading] = useState(true);
  
  const [waitingStudent, setWaitingStudent] = useState<any>(null);
  const [completedEvaluations, setCompletedEvaluations] = useState<any[]>([]);
  const [dynamicQueue, setDynamicQueue] = useState<StudentQueueItem[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  
  // State Dinamik Statistik
  const [gradeStats, setGradeStats] = useState({ mumtaz: 0, jj: 0, jayyid: 0, maqbul: 0, rasib: 0 });
  const [issueStats, setIssueStats] = useState({ total: 0, tajwid: 0, kelancaran: 0, baris: 0, makhraj: 0 });

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
        .select('id')
        .eq('teacher_name', currentTeacherName);
      
      const myClassIds = myClasses ? myClasses.map(c => c.id) : [];

      // C. Tarik Senarai Pelajar Yang HANYA Berada Dalam Kelas Guru Ini
      let assignedStudents: any[] = [];
      let pelajarCount = 0;

      if (myClassIds.length > 0) {
        const { data: studentsData, count } = await supabase
          .from('profiles')
          .select('id, full_name, matrik_or_id', { count: 'exact' })
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
        .select('*, profiles!evaluations_student_id_fkey(full_name, matrik_or_id)')
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
        .order('created_at', { ascending: false })
        .limit(1);

      if (liveNotifs && liveNotifs.length > 0) {
        const notif = liveNotifs[0];
        setWaitingStudent({
          nama: notif.profiles?.full_name || 'Pelajar',
          avatar: notif.profiles?.avatar_url || '',
          masaMasuk: new Date(notif.created_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        setWaitingStudent(null);
      }

      // --- BINA GILIRAN DINAMIK ---
      const queueList: StudentQueueItem[] = [];
      const processedNames = new Set<string>();

      // Masukkan senarai yang TELAH SELESAI
      todayEvals.forEach((ev: any) => {
        const studentName = ev.profiles?.full_name || 'Pelajar';
        if (!processedNames.has(studentName)) {
          queueList.push({
            id: ev.id,
            matrik: ev.profiles?.matrik_or_id || '-', 
            name: studentName,
            target: `${ev.surah || 'Al-Quran'}`,
            type: ev.type === 'Live' ? 'live' : 'fizikal',
            status: `Selesai (${ev.gred})`,
            grade: ev.gred,
            isCompleted: true
          });
          processedNames.add(studentName);
        }
      });

      // Masukkan baki pelajar (di bawah pantauan guru ini sahaja) yang BELUM SELESAI
      assignedStudents.forEach(p => {
        if (!processedNames.has(p.full_name)) {
          queueList.push({
            id: p.id,
            matrik: p.matrik_or_id || 'Tiada Matrik', 
            name: p.full_name,
            target: 'Belum Ditetapkan',
            type: 'fizikal',
            status: 'Giliran Seterusnya',
            isCompleted: false
          });
          processedNames.add(p.full_name);
        }
      });

      setDynamicQueue(queueList);

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
            <Link href="/guru/tasmik-live" style={{ textDecoration: 'none' }}>
              <button style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0.75rem 1.4rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0, 98, 255, 0.25)' }}>
                <Video size={18} /> Masuk Bilik Tasmik Sekarang
              </button>
            </Link>
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
          
          {/* KOLUM KIRI: GILIRAN PELAJAR */}
          <div className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}><Users size={18} color="#2563eb" strokeWidth={2} /> Giliran Semakan Hafazan Hari Ini</h2>
              <button 
                type="button"
                onClick={syncDashboardData}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={13} /> Muat Semula
              </button>
            </div>
            
            <div className={styles.studentList}>
              {dynamicQueue.length === 0 ? (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
                  <Users size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem auto' }} />
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Tiada Pelajar Disenaraikan</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Tiada pelajar di bawah seliaan kelas anda buat masa ini. Minta admin mendaftarkan pelajar ke dalam kelas anda.</p>
                </div>
              ) : (
                dynamicQueue.map((student, index) => {
                  const isWaitingLive = student.type === 'live' && !student.isCompleted && waitingStudent;
                  
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
                            onClick={() => router.push('/guru/tasmik-live')}
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
                              onClick={() => router.push('/guru/penilaian-offline')} 
                              title="Buka Borang Penilaian Bersemuka"
                            >
                              <FileSignature size={15} /> Borang
                            </button>
                            
                            <button 
                              className={`${styles.btnAction} ${styles.btnPrimary}`} 
                              onClick={() => router.push('/guru/tasmik-live')} 
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
      <style jsx>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </DashboardGuruLayout>
  );
}