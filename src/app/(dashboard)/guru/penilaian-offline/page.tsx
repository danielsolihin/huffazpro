'use client';

import React, { useState, useEffect } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  ClipboardCheck, MapPin, AlertCircle, BookOpen, 
  Trash2, X, Send, Loader2, MousePointer2, Clock, Info, CheckCircle2,
  CalendarCheck, UserCheck, Check, ShieldCheck, XCircle, RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './PenilaianOffline.module.css';

interface SurahMeta {
  number: number;
  englishName: string;
  name: string;
}

interface AyahData {
  number: number;
  numberInSurah: number;
  text: string;
  page: number;
}

interface RecordedError {
  id: string;
  ayahNum: number;
  type: 'Tajwid / Dengung' | 'Kelancaran Sangkut' | 'Salah Baris' | 'Makhraj Huruf';
  selectedText: string;
}

const ERROR_CONFIG: Record<RecordedError['type'], { cssClass: string; bg: string; border: string; color: string }> = {
  'Tajwid / Dengung': { cssClass: 'errorTajwid', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
  'Kelancaran Sangkut': { cssClass: 'errorKelancaran', bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  'Salah Baris': { cssClass: 'errorBaris', bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  'Makhraj Huruf': { cssClass: 'errorMakhraj', bg: '#f5f3ff', border: '#ddd6fe', color: '#6d28d9' }
};

export default function PenilaianOfflinePage() {
  const router = useRouter();
  
  // STATE SUPABASE
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('Guru');
  const [senaraiPelajar, setSenaraiPelajar] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [rekodTerakhir, setRekodTerakhir] = useState<any>(null);

  // STATE PAS KEHADIRAN BERSEMUKA
  const [todayAttendance, setTodayAttendance] = useState<{ 
    id?: string; 
    time_in?: string; 
    status?: string; 
    remarks?: string;
    verified_by?: string;
    date?: string;
  } | null>(null);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [sessionType, setSessionType] = useState<'Tasmik' | 'Murajaah'>('Tasmik');
  const [autoMarkAttendance, setAutoMarkAttendance] = useState(true);

  // STATE HALAMAN AL-QURAN
  const [surahsList, setSurahsList] = useState<SurahMeta[]>([]);
  const [selectedSurahId, setSelectedSurahId] = useState<number>(2);
  const [selectedPage, setSelectedPage] = useState<number | 'Semua'>('Semua');
  const [availablePages, setAvailablePages] = useState<number[]>([]);
  const [ayahs, setAyahs] = useState<AyahData[]>([]);
  const [isLoadingQuran, setIsLoadingQuran] = useState(true);

  // STATE PENILAIAN
  const [recordedErrors, setRecordedErrors] = useState<RecordedError[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('Jayyid');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // STATE RALAT MUSHAF
  const [activeAyahForError, setActiveAyahForError] = useState<number | null>(null);
  const [highlightedText, setHighlightedText] = useState<string>('');

  // 1. FETCH DATA AWAL (PENAPISAN KETAT PELAJAR GURU SAHAJA)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;
        const currentTeacherId = authData.user.id;
        setTeacherId(currentTeacherId);

        // Tarik profil guru semasa
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentTeacherId)
          .single();

        const currentGuruName = profile?.full_name || 'Guru';
        setTeacherName(currentGuruName);

        const clean = (n: string) => 
          (n || '')
            .replace(/^(ustaz|ustazah|cikgu|guru|en|encik|tuan|puan)\s+/i, '')
            .trim()
            .toLowerCase();

        const myNameClean = clean(currentGuruName);
        const myFirstName = myNameClean.split(' ')[0];

        const isTeacherMatch = (nameToCheck: any) => {
          if (!nameToCheck || typeof nameToCheck !== 'string') return false;
          const targetClean = clean(nameToCheck);
          if (!targetClean || targetClean.length < 3) return false;

          if (targetClean === myNameClean) return true;
          if (myFirstName.length >= 3 && targetClean.split(' ')[0] === myFirstName) return true;
          if (myNameClean.includes(targetClean) || targetClean.includes(myNameClean)) return true;

          return false;
        };

        // Kumpulkan ID dan nama kelas di bawah seliaan guru ini daripada jadual 'classes'
        const assignedClassIds = new Set<string>();
        const assignedClassNames = new Set<string>();

        try {
          const { data: classesData } = await supabase.from('classes').select('*');
          if (classesData) {
            classesData.forEach((c: any) => {
              const matchId = 
                (c.teacher_id && c.teacher_id === currentTeacherId) ||
                (c.guru_id && c.guru_id === currentTeacherId);

              const matchName = 
                isTeacherMatch(c.teacher_name) ||
                isTeacherMatch(c.teacher) ||
                isTeacherMatch(c.guru);

              if (matchId || matchName) {
                if (c.id) assignedClassIds.add(String(c.id).trim());
                if (c.name) assignedClassNames.add(String(c.name).toLowerCase().trim());
              }
            });
          }
        } catch (e) {
          console.error('Ralat menarik kelas guru:', e);
        }

        // Tarik semua profil pelajar
        const { data: pelajarList, error: pError } = await supabase
          .from('profiles')
          .select('*')
          .ilike('role', '%elajar%')
          .order('full_name', { ascending: true });

        if (pError) console.error('Ralat memuatkan pelajar:', pError);

        // PENAPISAN KETAT: HANYA pelajar yang berada di dalam kelas seliaan guru ini
        const filteredPelajar = (pelajarList || []).filter((pelajar: any) => {
          if (pelajar.teacher_id && pelajar.teacher_id === currentTeacherId) return true;
          if (pelajar.guru_id && pelajar.guru_id === currentTeacherId) return true;

          if (pelajar.class_id) {
            const pClassId = String(pelajar.class_id).trim();
            if (pClassId && pClassId !== '-' && pClassId !== 'undefined' && pClassId !== 'null') {
              if (assignedClassIds.has(pClassId)) return true;
              if (assignedClassNames.has(pClassId.toLowerCase())) return true;
            }
          }

          if (pelajar.class_name) {
            const pClassName = String(pelajar.class_name).toLowerCase().trim();
            if (pClassName && assignedClassNames.has(pClassName)) return true;
          }

          return false;
        });

        if (filteredPelajar.length > 0) {
          setSenaraiPelajar(filteredPelajar);
          setSelectedStudent(filteredPelajar[0].id);
        } else {
          setSenaraiPelajar([]);
          setSelectedStudent('');
        }

      } catch (err) {
        console.error('Ralat menarik data Supabase:', err);
      }
    };
    fetchInitialData();
  }, []);

  // 2. KESAN REKOD TERAKHIR DAN STATUS KEHADIRAN APABILA PELAJAR DIPILIH
  useEffect(() => {
    if (!selectedStudent) {
      setRekodTerakhir(null);
      setTodayAttendance(null);
      return;
    }
    
    const fetchLastRecord = async () => {
      try {
        const { data: lastEval } = await supabase
          .from('evaluations')
          .select('*')
          .eq('student_id', selectedStudent)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setRekodTerakhir(lastEval || null);
      } catch (err) {
        setRekodTerakhir(null);
      }
    };

    fetchLastRecord();
    fetchTodayAttendance(selectedStudent);
  }, [selectedStudent]);

  // SEMAK KEHADIRAN PELAJAR UNTUK HARI INI
  const fetchTodayAttendance = async (studentId: string) => {
    if (!studentId) {
      setTodayAttendance(null);
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayIso = `${year}-${month}-${day}`;
    const todayLocale = now.toLocaleDateString('ms-MY');

    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const foundToday = data.find((a: any) => {
          if (a.date === todayIso || a.date === todayLocale) return true;
          if (a.created_at) {
            const d = new Date(a.created_at);
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth() &&
              d.getDate() === now.getDate()
            );
          }
          return false;
        });

        if (foundToday) {
          let timeDisplay = foundToday.time_in;
          if (!timeDisplay || timeDisplay === '-') {
            if (foundToday.created_at) {
              timeDisplay = new Date(foundToday.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            }
          }

          setTodayAttendance({
            id: foundToday.id,
            time_in: timeDisplay || 'AM/PM',
            status: foundToday.status || 'Hadir Fizikal',
            remarks: foundToday.remarks || foundToday.justifikasi || 'Tasmik Bersemuka',
            date: foundToday.date || todayIso,
            verified_by: teacherName
          });
          return;
        }
      }
      setTodayAttendance(null);
    } catch (err) {
      setTodayAttendance(null);
    }
  };

  // TANDA / KEMASKINI KEHADIRAN BERSEMUKA
  const handleMarkAttendance = async (statusToSet: 'Hadir Fizikal' | 'Tidak Hadir') => {
    if (!selectedStudent) {
      alert('Sila pilih pelajar terlebih dahulu.');
      return;
    }

    setIsMarkingAttendance(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayIso = `${year}-${month}-${day}`;
      const timeNow = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const studentObj = senaraiPelajar.find(p => p.id === selectedStudent);
      const sName = studentObj?.full_name || 'Pelajar';
      const catatanPenuh = `${sessionType} Bersemuka (Disahkan oleh ${teacherName})`;

      let recordId = todayAttendance?.id;

      if (recordId) {
        // Kemaskini rekod sedia ada
        const { error: updErr } = await supabase
          .from('attendance')
          .update({
            status: statusToSet,
            time_in: statusToSet === 'Hadir Fizikal' ? timeNow : '-',
            remarks: catatanPenuh
          })
          .eq('id', recordId);

        if (updErr) throw updErr;
      } else {
        // Cipta rekod baharu
        const { data: insData, error: insErr } = await supabase
          .from('attendance')
          .insert([{
            user_id: selectedStudent,
            date: todayIso,
            time_in: statusToSet === 'Hadir Fizikal' ? timeNow : '-',
            status: statusToSet,
            remarks: catatanPenuh
          }])
          .select('id')
          .single();

        if (insErr) throw insErr;
        recordId = insData?.id;
      }

      setTodayAttendance({
        id: recordId,
        time_in: statusToSet === 'Hadir Fizikal' ? timeNow : '-',
        status: statusToSet,
        remarks: catatanPenuh,
        date: todayIso,
        verified_by: teacherName
      });

      setSuccessMsg(`✓ Status kehadiran ${sName} telah dikemas kini kepada "${statusToSet}" jam ${timeNow}!`);
      setTimeout(() => setSuccessMsg(''), 4000);

    } catch (err: any) {
      console.error('Ralat merekod kehadiran:', err);
      alert('Gagal merekodkan kehadiran: ' + (err.message || 'Sila cuba lagi'));
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  // BATAL / RESET REKOD KEHADIRAN
  const handleResetAttendance = async () => {
    if (!todayAttendance?.id) return;
    if (!confirm('Adakah anda pasti mahu membatalkan rekod kehadiran pelajar ini bagi hari ini?')) return;

    setIsMarkingAttendance(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', todayAttendance.id);

      if (error) throw error;

      setTodayAttendance(null);
      setSuccessMsg('Rekod kehadiran pelajar bagi hari ini telah berjaya dipadam.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      alert('Gagal memadam kehadiran: ' + err.message);
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  // 3. AUTO-SYNC MUSHAF DENGAN REKOD TERAKHIR
  useEffect(() => {
    if (rekodTerakhir && surahsList.length > 0) {
      const found = surahsList.find(s => s.englishName === rekodTerakhir.surah || s.name === rekodTerakhir.surah);
      if (found) setSelectedSurahId(found.number);
      setSelectedPage('Semua');
    }
  }, [rekodTerakhir, surahsList]);

  // 4. FETCH SENARAI SURAH
  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => setSurahsList(data.data || []))
      .catch(err => console.error('Ralat API Surah:', err));
  }, []);

  // 5. FETCH AYAT BERDASARKAN SURAH
  useEffect(() => {
    setIsLoadingQuran(true);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurahId}/quran-uthmani`)
      .then(res => res.json())
      .then(data => {
        const fetchedAyahs = data.data?.ayahs || [];
        setAyahs(fetchedAyahs);
        const pages = Array.from(new Set(fetchedAyahs.map((a: AyahData) => a.page))) as number[];
        setAvailablePages(pages.sort((a, b) => a - b));
        setIsLoadingQuran(false);
      })
      .catch(() => {
        setIsLoadingQuran(false);
      });
  }, [selectedSurahId]);

  // HIGHLIGHT TEKS QURAN
  const handleMouseUpTextSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;

    const selectedString = selection.toString().trim();
    if (selectedString && selectedString.length > 1) {
      let node = selection.anchorNode?.parentElement;
      while (node && !node.getAttribute('data-ayah')) {
        node = node.parentElement;
      }

      if (node) {
        const ayahNum = parseInt(node.getAttribute('data-ayah') || '0');
        setActiveAyahForError(ayahNum);
        setHighlightedText(selectedString);
      }
      selection.removeAllRanges();
    }
  };

  const formatAyahText = (text: string, ayahNum: number) => {
    let formattedText = text;

    if (selectedSurahId !== 1 && selectedSurahId !== 9 && ayahNum === 1) {
      const basmalahPattern = /^\s*ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ه[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*ح[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670\u0640]*ن[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*ح[\u064B-\u065F\u0670]*ي[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*/u;
      formattedText = formattedText.replace(basmalahPattern, '').trim();
    }

    const lafazRegex = /(ٱللَّهِ|ٱللَّهُ|ٱللَّهَ|لِلَّهِ|اللَّهِ|اللَّهُ|اللَّهَ)/g;
    formattedText = formattedText.replace(lafazRegex, '<span class="lafazJalalah">$1</span>');

    const errorsForThisAyah = recordedErrors.filter(e => e.ayahNum === ayahNum && e.selectedText);
    errorsForThisAyah.forEach(err => {
      const cssClass = ERROR_CONFIG[err.type]?.cssClass || 'errorBaris';
      formattedText = formattedText.replace(err.selectedText, `<span class="${cssClass}">${err.selectedText}</span>`);
    });

    return formattedText;
  };

  const handleAddError = (errorType: RecordedError['type']) => {
    if (activeAyahForError) {
      setRecordedErrors(prev => [
        ...prev, 
        { id: Date.now().toString(), ayahNum: activeAyahForError, type: errorType, selectedText: highlightedText }
      ]);
    }
    setActiveAyahForError(null);
    setHighlightedText('');
  };

  const handleRemoveError = (id: string) => setRecordedErrors(prev => prev.filter(e => e.id !== id));

  // HANTAR REKOD PENILAIAN
  const handleSubmitPenilaian = async () => {
    if (!selectedStudent) {
      alert('Sila pilih pelajar terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const surahName = surahsList.find(s => s.number === Number(selectedSurahId))?.englishName || 'Surah Al-Quran';
      
      const combinedNotes = recordedErrors.length > 0 
        ? `Terdapat ${recordedErrors.length} kesalahan dikesan. ${notes ? 'Catatan: ' + notes : ''}`
        : `Tahniah! Tiada kesalahan dikesan. ${notes ? 'Catatan: ' + notes : ''}`;

      // 1. Simpan ke jadual evaluations
      const { error: evalError } = await supabase
        .from('evaluations')
        .insert([{
          student_id: selectedStudent,
          teacher_id: teacherId,
          surah: surahName,
          gred: selectedGrade,
          catatan: combinedNotes,
          type: 'Bersemuka',
          error_records: JSON.stringify(recordedErrors)
        }]);

      if (evalError) throw evalError;

      // 2. Hantar Notifikasi kepada pelajar
      await supabase
        .from('notifications')
        .insert([{
          user_id: selectedStudent,
          sender_id: teacherId,
          type: 'teguran',
          title: `Gred Semakan: ${selectedGrade}`,
          message: combinedNotes
        }]);

      // 3. Rakam Kehadiran Pelajar secara automatik jika belum ditanda
      if (autoMarkAttendance && (!todayAttendance || !todayAttendance.status?.includes('Hadir'))) {
        try {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const todayIso = `${year}-${month}-${day}`;
          const timeNow = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

          const baseAtt = {
            user_id: selectedStudent,
            date: todayIso,
            time_in: timeNow,
            status: 'Hadir Fizikal',
            remarks: `${sessionType} Bersemuka (Disahkan oleh ${teacherName})`
          };

          await supabase.from('attendance').insert([baseAtt]);

          setTodayAttendance({
            time_in: timeNow,
            status: 'Hadir Fizikal',
            remarks: baseAtt.remarks,
            date: todayIso,
            verified_by: teacherName
          });
        } catch (attErr) {
          console.warn('Kehadiran automatik gagal direkodkan:', attErr);
        }
      }

      setSuccessMsg('Penilaian bersemuka dan rekod kehadiran berjaya dihantar ke sistem.');
      setRecordedErrors([]);
      setNotes('');
      
      setTimeout(() => {
        setSuccessMsg('');
        router.push('/guru/dashboard');
      }, 2000);

    } catch (err: any) {
      console.error('Ralat hantar:', err);
      alert('Gagal menghantar rekod. Sila cuba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  let displayAyahs = ayahs;
  if (selectedPage !== 'Semua') {
    displayAyahs = displayAyahs.filter(a => a.page === Number(selectedPage));
  }

  const currentStudentData = senaraiPelajar.find(p => p.id === selectedStudent);
  const isPresentToday = todayAttendance?.status?.includes('Hadir');
  const isAbsentToday = todayAttendance?.status === 'Tidak Hadir';

  return (
    <DashboardGuruLayout>
      <div className={styles.container}>
        
        {successMsg && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <CheckCircle2 size={20} /> {successMsg}
          </div>
        )}

        {/* HEADER PEMILIH PELAJAR */}
        <div className={styles.headerCard}>
          <div className={styles.headerInfo}>
            <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
              {selectedStudent ? (currentStudentData?.full_name?.charAt(0) || 'P') : '?'}
            </div>
            <div className={styles.titleWrap}>
              <h1 className={styles.mainTitle}>Sesi Penilaian Tasmik Bersemuka</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <MapPin size={16} color="#64748b" /> 
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Pelajar Kelas Anda:</span>
                <select 
                  value={selectedStudent} 
                  onChange={(e) => setSelectedStudent(e.target.value)} 
                  disabled={senaraiPelajar.length === 0}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #0062ff', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', outline: 'none', background: '#ffffff', cursor: senaraiPelajar.length === 0 ? 'not-allowed' : 'pointer' }}
                >
                  {senaraiPelajar.length > 0 ? (
                    senaraiPelajar.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} {p.matrik_or_id ? `(${p.matrik_or_id})` : ''}</option>
                    ))
                  ) : (
                    <option value="">Tiada Pelajar Di-Assign</option>
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ==============================================================
            PAS PENGESAHAN KEDATANGAN BERSEMUKA (SMART VERIFICATION BADGE)
        ============================================================== */}
        <div style={{
          background: isPresentToday ? '#f0fdf4' : isAbsentToday ? '#fef2f2' : '#ffffff',
          borderRadius: '14px',
          border: `1.5px solid ${isPresentToday ? '#86efac' : isAbsentToday ? '#fecaca' : '#cbd5e1'}`,
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: isPresentToday ? '0 4px 12px rgba(22, 163, 74, 0.08)' : '0 2px 6px rgba(0,0,0,0.03)',
          transition: 'all 0.3s ease'
        }}>
          
          {/* BAR TAJUK KAD */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: `1px solid ${isPresentToday ? '#bbf7d0' : isAbsentToday ? '#fee2e2' : '#f1f5f9'}`, paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {isPresentToday ? (
                <ShieldCheck size={22} color="#16a34a" />
              ) : isAbsentToday ? (
                <XCircle size={22} color="#dc2626" />
              ) : (
                <CalendarCheck size={22} color="#0062ff" />
              )}
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                {isPresentToday ? 'PAS KEDATANGAN BERSEMUKA (DISAHKAN)' : isAbsentToday ? 'REKOD KETIDAKHADIRAN BERSEMUKA' : 'PENGESAHAN KEDATANGAN BERSEMUKA HARI INI'}
              </span>
            </div>

            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', background: '#f8fafc', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              Tarikh: {new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* KANDUNGAN STATUS */}
          {isPresentToday ? (
            /* SITUASI: TELAH HADIR */
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ background: '#16a34a', color: '#ffffff', fontSize: '0.8rem', fontWeight: 800, padding: '0.35rem 0.85rem', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)' }}>
                  <CheckCircle2 size={15} /> HADIR FIZIKAL
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#166534', background: '#dcfce7', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', fontWeight: 600 }}>
                  <Clock size={14} /> Waktu: <strong>{todayAttendance?.time_in}</strong>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#14532d', background: '#dcfce7', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', fontWeight: 600 }}>
                  Pengesah: <strong>{todayAttendance?.verified_by || teacherName}</strong>
                </div>

                <span style={{ fontSize: '0.75rem', color: '#15803d', fontStyle: 'italic' }}>
                  ({todayAttendance?.remarks || 'Tasmik Bersemuka'})
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleResetAttendance}
                  disabled={isMarkingAttendance}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#64748b',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: isMarkingAttendance ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Batalkan rekod kehadiran ini"
                >
                  <RefreshCw size={13} /> Batal / Reset
                </button>
              </div>
            </div>
          ) : isAbsentToday ? (
            /* SITUASI: DITANDA TIDAK HADIR */
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ background: '#dc2626', color: '#ffffff', fontSize: '0.8rem', fontWeight: 800, padding: '0.35rem 0.85rem', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <XCircle size={15} /> TIDAK HADIR
                </span>
                <span style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 600 }}>
                  Pelajar ini direkodkan tidak hadir untuk sesi bersemuka hari ini.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleMarkAttendance('Hadir Fizikal')}
                  disabled={isMarkingAttendance}
                  style={{
                    background: '#16a34a',
                    border: 'none',
                    color: '#fff',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: isMarkingAttendance ? 'not-allowed' : 'pointer'
                  }}
                >
                  Tukar Kepada Hadir
                </button>
                <button
                  type="button"
                  onClick={handleResetAttendance}
                  disabled={isMarkingAttendance}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#64748b',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: isMarkingAttendance ? 'not-allowed' : 'pointer'
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          ) : (
            /* SITUASI: BELUM DIREKODKAN HARI INI */
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.78rem', fontWeight: 800, padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  ⚪ BELUM DIREKODKAN
                </span>

                <div style={{ display: 'flex', background: '#f8fafc', padding: '0.2rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <button
                    type="button"
                    onClick={() => setSessionType('Tasmik')}
                    style={{
                      border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px',
                      fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      background: sessionType === 'Tasmik' ? '#0062ff' : 'transparent',
                      color: sessionType === 'Tasmik' ? '#ffffff' : '#64748b'
                    }}
                  >
                    📖 Tasmik Bersemuka
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionType('Murajaah')}
                    style={{
                      border: 'none', padding: '0.35rem 0.75rem', borderRadius: '6px',
                      fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      background: sessionType === 'Murajaah' ? '#7c3aed' : 'transparent',
                      color: sessionType === 'Murajaah' ? '#ffffff' : '#64748b'
                    }}
                  >
                    🔄 Murajaah Bersemuka
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleMarkAttendance('Hadir Fizikal')}
                  disabled={isMarkingAttendance || !selectedStudent}
                  style={{
                    background: '#059669', color: '#ffffff',
                    border: 'none', padding: '0.55rem 1.15rem', borderRadius: '8px',
                    fontSize: '0.82rem', fontWeight: 700, cursor: (!selectedStudent || isMarkingAttendance) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 5px rgba(5, 150, 105, 0.25)',
                    opacity: (isMarkingAttendance || !selectedStudent) ? 0.7 : 1
                  }}
                >
                  {isMarkingAttendance ? <Loader2 size={15} className="spinIcon" /> : <CheckCircle2 size={15} />}
                  Sahkan Hadir Bersemuka
                </button>

                <button
                  type="button"
                  onClick={() => handleMarkAttendance('Tidak Hadir')}
                  disabled={isMarkingAttendance || !selectedStudent}
                  style={{
                    background: '#fff', color: '#dc2626',
                    border: '1px solid #fecaca', padding: '0.55rem 0.95rem', borderRadius: '8px',
                    fontSize: '0.82rem', fontWeight: 700, cursor: (!selectedStudent || isMarkingAttendance) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Tanda Tidak Hadir
                </button>
              </div>
            </div>
          )}

        </div>

        {/* KAD REKOD TASMIK TERAKHIR */}
        {rekodTerakhir ? (
          <div style={{ background: '#eff6ff', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <Clock size={16} /> Rekod Tasmik Terakhir (Supabase)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>Jenis Sesi</span>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#1e3a8a' }}>{rekodTerakhir.type}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>Surah Disemak</span>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#1e3a8a' }}>{rekodTerakhir.surah}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>Gred Keputusan</span>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontWeight: 800, color: '#059669' }}>{rekodTerakhir.gred}</p>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Sistem belum menjumpai sebarang rekod tasmik lalu untuk pelajar ini.</p>
          </div>
        )}

        <div className={styles.gridContainer}>
          
          {/* KOLUM KIRI: MUSHAF INTERAKTIF */}
          <div className={styles.mushafCard}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className={styles.mushafTitle}><BookOpen size={20} color="#10b981" /> Paparan Mushaf Interaktif</h2>
              <div className={styles.highlightInstruction}>
                <MousePointer2 size={16} /> Sorot (Highlight) kalimah untuk menanda ralat
              </div>
            </div>

            <div className={styles.filterBar} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 2, minWidth: '220px' }}>
                <span className={styles.filterLabel} style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Surah:</span>
                <select 
                  className={styles.filterSelect} 
                  style={{ width: '100%' }}
                  value={selectedSurahId} 
                  onChange={(e) => {
                    setSelectedSurahId(Number(e.target.value));
                    setSelectedPage('Semua'); 
                  }}
                >
                  {surahsList.map(s => (
                    <option key={s.number} value={s.number}>{s.number}. {s.englishName} ({s.name})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '150px' }}>
                <span className={styles.filterLabel} style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Halaman:</span>
                <select 
                  className={styles.filterSelect} 
                  style={{ width: '100%' }}
                  value={selectedPage} 
                  onChange={(e) => setSelectedPage(e.target.value === 'Semua' ? 'Semua' : Number(e.target.value))}
                  disabled={isLoadingQuran}
                >
                  <option value="Semua">Semua</option>
                  {availablePages.map(page => (
                    <option key={page} value={page}>M/S {page}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* MUSHAF */}
            {isLoadingQuran ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: '#94a3b8' }}>
                <Loader2 size={30} className="spinIcon" />
              </div>
            ) : (
              <div 
                className={styles.mushafPage}
                onMouseUp={handleMouseUpTextSelection}
                onTouchEnd={handleMouseUpTextSelection}
              >
                {displayAyahs[0]?.numberInSurah === 1 && selectedSurahId !== 1 && selectedSurahId !== 9 && (
                  <div className={styles.bismillah}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
                )}
                
                <div className={styles.quranTextContainer}>
                  {displayAyahs.map((ayah) => (
                    <React.Fragment key={ayah.number}>
                      <span 
                        className={styles.ayahSpan}
                        data-ayah={ayah.numberInSurah}
                        dangerouslySetInnerHTML={{ __html: formatAyahText(ayah.text, ayah.numberInSurah) }}
                      />
                      <span className={styles.ayahEnd}>﴿{ayah.numberInSurah}﴾</span>{' '}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* KOLUM KANAN: PANEL PENILAIAN */}
          <div className={styles.evalCard}>
            
            <div>
              <h3 className={styles.sectionTitle}><AlertCircle size={18} color="#ef4444" /> Kesalahan Direkodkan ({recordedErrors.length})</h3>
              <div className={styles.errorList}>
                {recordedErrors.length === 0 ? (
                  <div className={styles.emptyError}>Tiada ralat ditandakan. Bacaan lancar.</div>
                ) : (
                  recordedErrors.map((err) => {
                    const theme = ERROR_CONFIG[err.type];
                    return (
                      <div key={err.id} className={styles.errorItem} style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
                        <div className={styles.errorInfo}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={styles.errorAyah} style={{ color: theme.color }}>Ayat {err.ayahNum}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '4px', background: '#fff', color: theme.color, border: `1px solid ${theme.border}` }}>
                              {err.type}
                            </span>
                          </div>
                          <span style={{ fontFamily: '"Amiri Quran", serif', fontSize: '1.25rem', color: '#0f172a', direction: 'rtl', textAlign: 'right', marginTop: '0.2rem' }}>
                            {err.selectedText}
                          </span>
                        </div>
                        <button className={styles.removeBtn} onClick={() => handleRemoveError(err.id)}><Trash2 size={16} /></button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '1.5rem' }}>
              <h3 className={styles.sectionTitle}><ClipboardCheck size={18} color="#0062ff" /> Gred Penilaian Akhir</h3>
              <div className={styles.gradeGrid}>
                <button type="button" className={`${styles.gradeBtn} ${styles.mumtaz} ${selectedGrade === 'Mumtaz' ? styles.active : ''}`} onClick={() => setSelectedGrade('Mumtaz')}>Mumtaz</button>
                <button type="button" className={`${styles.gradeBtn} ${selectedGrade === 'Jayyid Jiddan' ? styles.active : ''}`} onClick={() => setSelectedGrade('Jayyid Jiddan')}>J. Jiddan</button>
                <button type="button" className={`${styles.gradeBtn} ${selectedGrade === 'Jayyid' ? styles.active : ''}`} onClick={() => setSelectedGrade('Jayyid')}>Jayyid</button>
                <button type="button" className={`${styles.gradeBtn} ${selectedGrade === 'Maqbul' ? styles.active : ''}`} onClick={() => setSelectedGrade('Maqbul')}>Maqbul</button>
                <button type="button" className={`${styles.gradeBtn} ${selectedGrade === 'Rasib' ? styles.active : ''}`} onClick={() => setSelectedGrade('Rasib')}>Rasib</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1, justifyContent: 'flex-end' }}>
              <textarea 
                className={styles.noteArea} 
                placeholder="Catatan tambahan untuk tatapan pelajar (Pilihan)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              {/* PENGESAHAN AUTO-KEHADIRAN DALAM BORANG */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: isPresentToday ? '#f0fdf4' : '#f8fafc', 
                padding: '0.55rem 0.75rem',
                borderRadius: '8px', 
                border: `1px solid ${isPresentToday ? '#bbf7d0' : '#e2e8f0'}`,
                fontSize: '0.75rem', 
                color: isPresentToday ? '#166534' : '#334155'
              }}>
                <input
                  type="checkbox"
                  id="autoAttendanceCheck"
                  checked={autoMarkAttendance}
                  onChange={(e) => setAutoMarkAttendance(e.target.checked)}
                  style={{ accentColor: '#059669', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <label htmlFor="autoAttendanceCheck" style={{ cursor: 'pointer', fontWeight: 600 }}>
                  {isPresentToday 
                    ? `✓ Kehadiran hari ini telah disahkan (${todayAttendance?.time_in}). Tidak perlu ditanda semula.`
                    : 'Sahkan kehadiran fizikal secara automatik semasa menghantar rekod ini jika belum ditanda.'}
                </label>
              </div>

              <button className={styles.submitBtn} onClick={handleSubmitPenilaian} disabled={isSubmitting || !selectedStudent}>
                {isSubmitting ? <Loader2 size={20} className="spinIcon" /> : <><Send size={18} /> Sahkan & Hantar Rekod</>}
              </button>
            </div>

          </div>

        </div>

        {/* MODAL POP-UP PILIH RALAT */}
        {activeAyahForError && (
          <div className={styles.modalOverlay} onClick={() => setActiveAyahForError(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className={styles.modalTitle}>Tanda Ralat - Ayat {activeAyahForError}</h3>
                <button onClick={() => setActiveAyahForError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem 0', fontWeight: 700, textTransform: 'uppercase' }}>Kalimah Disorot:</p>
                <p style={{ fontFamily: '"Amiri Quran", serif', fontSize: '1.5rem', direction: 'rtl', textAlign: 'center', color: '#1e293b', margin: 0 }}>
                  {highlightedText}
                </p>
              </div>

              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>Pilih jenis teguran untuk kalimah ini:</p>
              
              <div className={styles.errorTypeGrid}>
                <button className={`${styles.typeBtn} ${styles.btnTajwid}`} onClick={() => handleAddError('Tajwid / Dengung')}>🔤 Tajwid</button>
                <button className={`${styles.typeBtn} ${styles.btnKelancaran}`} onClick={() => handleAddError('Kelancaran Sangkut')}>⏸️ Sangkut</button>
                <button className={`${styles.typeBtn} ${styles.btnBaris}`} onClick={() => handleAddError('Salah Baris')}>✏️ Baris</button>
                <button className={`${styles.typeBtn} ${styles.btnMakhraj}`} onClick={() => handleAddError('Makhraj Huruf')}>🗣️ Makhraj</button>
              </div>
            </div>
          </div>
        )}

      </div>

      <style jsx global>{`
        .spinIcon { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </DashboardGuruLayout>
  );
}