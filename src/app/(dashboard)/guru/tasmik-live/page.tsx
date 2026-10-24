'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import LiveKitRoomView from '@/components/video/LiveKitRoomView'; 
import { supabase } from '@/lib/supabase';
import { getTeacherAssignedData, StudentProfile } from '@/lib/teacherService';
import { 
  BookOpen, AlertCircle, Send, Loader2, MousePointer2, Clock, 
  CheckCircle2, Trash2, X, Users, BellRing, Video, Lock, PhoneCall,
  Smartphone, Award
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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

// PENGESAH FORMAT UUID SUPABASE
const isValidUUID = (val: any): boolean => {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
};

export default function StudioTasmikLivePage() {
  const router = useRouter();

  // STATE GURU & PELAJAR (SUPABASE)
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('Guru');
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [senaraiPelajar, setSenaraiPelajar] = useState<StudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rekodTerakhir, setRekodTerakhir] = useState<any>(null);

  // STATE PELAJAR MENUNGGU DI BILIK MENUNGGU
  const [waitingStudent, setWaitingStudent] = useState<{ id: string; name: string; time: string } | null>(null);
  const [waitingStudentsMap, setWaitingStudentsMap] = useState<Record<string, { name: string; time: string }>>({});

  // REFS UNTUK MENJEJAK STATUS TANPA ISU CLOSURE REACT
  const dismissedStudentsRef = useRef<Set<string>>(new Set());
  const isCallActiveRef = useRef(false);

  // STATE STATUS PANGGILAN VIDEO LIVE
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallingStudent, setIsCallingStudent] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');

  // KEMASKINI REF STATUS PANGGILAN
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  // STATE TAB MUDAH ALIH (< 768px)
  const [mobileTab, setMobileTab] = useState<'mushaf' | 'panel'>('mushaf');

  // STATE MUSHAF
  const [surahsList, setSurahsList] = useState<SurahMeta[]>([]);
  const [selectedSurahId, setSelectedSurahId] = useState<number>(2);
  const [selectedPage, setSelectedPage] = useState<number>(2);
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

  // FUNGSI BUNYI NOTIFIKASI GURU (WEB AUDIO API)
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Sekatan pelayar sebelum interaksi pertama
    }
  };

  // 1. TARIK DATA AWAL GURU & PELAJAR DENGAN AUTO-FALLBACK PROFIL
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        let currentTeacherId = authData?.user?.id || '';
        let currentGuruName = 'Guru Pentasmik';
        let studentList: StudentProfile[] = [];

        if (isValidUUID(currentTeacherId)) {
          const { data: myProfile } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('id', currentTeacherId)
            .maybeSingle();

          if (myProfile?.full_name) {
            currentGuruName = myProfile.full_name;
          }
        } else {
          // Cari akaun Guru secara fallback jika sesi auth bertindih
          const { data: guruProfile } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .ilike('role', '%Guru%')
            .limit(1)
            .maybeSingle();

          if (guruProfile) {
            currentTeacherId = guruProfile.id;
            currentGuruName = guruProfile.full_name || 'Guru Pentasmik';
          }
        }

        setTeacherId(currentTeacherId);
        setTeacherName(currentGuruName);

        // Ambil senarai pelajar yang di-assign
        if (isValidUUID(currentTeacherId)) {
          try {
            const assignedData = await getTeacherAssignedData(currentTeacherId, 'Guru Pentasmik');
            if (assignedData?.students && assignedData.students.length > 0) {
              studentList = assignedData.students;
            }
          } catch (e) {
            console.warn('getTeacherAssignedData kosong:', e);
          }
        }

        // Fallback: Tarik terus dari rekod profil berstatus pelajar
        if (studentList.length === 0) {
          const { data: allPelajar } = await supabase
            .from('profiles')
            .select('id, full_name, matrik_or_id, role')
            .or('role.ilike.pelajar,role.ilike.student');

          if (allPelajar && allPelajar.length > 0) {
            studentList = allPelajar as StudentProfile[];
          }
        }

        setSenaraiPelajar(studentList);

        if (studentList.length > 0) {
          setSelectedStudentId(studentList[0].id);
        }
      } catch (err) {
        console.error('Ralat menarik data tasmik live:', err);
      } finally {
        setIsProfileLoaded(true);
      }
    };

    fetchInitialData();
  }, []);

  // 1b. DENGAR ISYARAT BILIK MENUNGGU (DILENGKAPI PENAPIS PENOLAKAN / DISMISS FILTER)
  useEffect(() => {
    const waitingChannel = supabase
      .channel('tasmik_waiting_room')
      .on('broadcast', { event: 'student_waiting' }, (payload) => {
        const data = payload?.payload;
        if (!data) return;

        const timeNow = data.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const studentName = data.studentName || 'Pelajar';
        const sId = data.studentId;

        // Semak sama ada pelajar ini telah dipanggil atau ditutup mesejnya
        const isDismissed = (sId && dismissedStudentsRef.current.has(sId)) || 
                            dismissedStudentsRef.current.has(studentName);

        // Jangan munculkan tetingkap hijau atau bunyikan loceng jika sedang dalam panggilan atau telah ditolak
        if (isCallActiveRef.current || isDismissed) {
          if (sId) {
            setWaitingStudentsMap(prev => ({
              ...prev,
              [sId]: { name: studentName, time: timeNow }
            }));
          }
          return;
        }

        // Paparkan tetingkap hijau
        setWaitingStudent({
          id: sId || '',
          name: studentName,
          time: timeNow
        });

        if (sId) {
          setWaitingStudentsMap(prev => ({
            ...prev,
            [sId]: { name: studentName, time: timeNow }
          }));

          setSenaraiPelajar(prev => {
            const exists = prev.some(p => p.id === sId);
            if (!exists) {
              return [{ id: sId, full_name: studentName, matrik_or_id: '012345', role: 'pelajar' } as StudentProfile, ...prev];
            }
            return prev;
          });

          setSelectedStudentId(prev => (prev ? prev : sId));
        }

        playNotificationChime();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(waitingChannel);
    };
  }, []);

  // 2. KIRA TEMPOH PANGGILAN
  useEffect(() => {
    if (!isCallActive) return;

    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isCallActive]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 3. TARIK REKOD TERAKHIR APABILA PELAJAR DITUKAR
  useEffect(() => {
    if (!selectedStudentId || !isValidUUID(selectedStudentId)) {
      setRekodTerakhir(null);
      return;
    }

    const fetchLastRecord = async () => {
      try {
        const { data: lastEval } = await supabase
          .from('evaluations')
          .select('*')
          .eq('student_id', selectedStudentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setRekodTerakhir(lastEval || null);
      } catch {
        setRekodTerakhir(null);
      }
    };

    fetchLastRecord();
  }, [selectedStudentId]);

  // 4. AUTO-SYNC SURAH DENGAN REKOD TERAKHIR (DINAMIK KESELURUHAN)
  useEffect(() => {
    const syncLastRecord = async () => {
      if (rekodTerakhir && surahsList.length > 0) {
        const found = surahsList.find(s => s.englishName === rekodTerakhir.surah || s.name === rekodTerakhir.surah);
        if (found) {
          setSelectedSurahId(found.number);
          
          if (rekodTerakhir.halaman && rekodTerakhir.halaman !== 'Penuh') {
            setSelectedPage(Number(rekodTerakhir.halaman));
          }
        }
      }
    };
    
    syncLastRecord();
  }, [rekodTerakhir, surahsList]);

  // 5. SENARAI SURAH (DENGAN PEMBETULAN EJAAN)
  useEffect(() => { 
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => { 
        if (data.data) {
          const formattedSurahs = data.data.map((s: any) => {
            if (s.englishName === 'Aal-i-Imraan') s.englishName = 'Ali-Imran';
            if (s.englishName === 'Al-Faatiha') s.englishName = 'Al-Fatihah';
            return s;
          });
          setSurahsList(formattedSurahs);
        }
      }); 
  }, []);

  // 6. AMBIL AYAT MUSHAF DAN AUTO-TUKAR HALAMAN BERDASARKAN SURAH TERPILIH
  useEffect(() => {
    setIsLoadingQuran(true);
    fetch(`https://api.alquran.cloud/v1/surah/${selectedSurahId}/quran-uthmani`)
      .then(res => res.json())
      .then(data => {
        const fetchedAyahs = data.data?.ayahs || [];
        setAyahs(fetchedAyahs);
        const pages = Array.from(new Set(fetchedAyahs.map((a: AyahData) => a.page))) as number[];
        const sortedPages = pages.sort((a, b) => a - b);
        setAvailablePages(sortedPages);
        
        // Auto-pilih muka surat pertama surah tersebut sekiranya muka surat semasa tidak tepat
        setSelectedPage(prev => sortedPages.includes(prev) ? prev : sortedPages[0]);
        
        setIsLoadingQuran(false);
      })
      .catch(() => setIsLoadingQuran(false));
  }, [selectedSurahId]);

  // APABILA GURU PILIH SURAH DARI DROPDOWN, TUKAR ID SAHAJA DAN KEMAS KINI HALAMAN
  const handleSurahChange = async (e: any) => {
    const surahId = Number(e.target.value);
    if (!surahId) return;
    
    setSelectedSurahId(surahId);
    setIsLoadingQuran(true);
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahId}`);
      const data = await res.json();
      if (data.data && data.data.ayahs) {
        setSelectedPage(data.data.ayahs[0].page);
      }
    } catch (error) {
      console.error("Gagal menukar surah:", error);
    } finally {
        setIsLoadingQuran(false);
    }
  };

  // 7. HIGHLIGHT TEKS - PENGESAN DATA-AYAH DIPERBAIKI
  const handleMouseUpTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedString = selection.toString().trim();
    if (selectedString && selectedString.length > 1) {
      
      // Cuba cari node induk yang memegang atribut data-ayah
      let node: HTMLElement | null = selection.anchorNode?.parentElement || null;
      while (node && !node.getAttribute('data-ayah')) {
        node = node.parentElement;
      }

      if (node) {
        const ayahNum = parseInt(node.getAttribute('data-ayah') || '0');
        if (ayahNum > 0) {
          setActiveAyahForError(ayahNum);
          setHighlightedText(selectedString);
        }
      }
      
      // Kosongkan highlight seleksi selepas direkodkan ke state
      selection.removeAllRanges();
    }
  };

  // 8. FORMULA MUSHAF BASMALLAH & LAFAZ JALALAH
  const formatAyahText = (text: string, ayahNum: number) => {
    let formattedText = text;

    if (selectedSurahId !== 1 && selectedSurahId !== 9 && ayahNum === 1) {
      const basmalahPattern = /^\s*ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ه[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*ح[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670\u0640]*ن[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*ح[\u064B-\u065F\u0670]*ي[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*/u;
      formattedText = formattedText.replace(basmalahPattern, '').trim();
    }

    const lafazRegex = /(ٱللَّهِ|ٱللَّهُ|ٱللَّهَ|لِلَّهِ|اللَّهِ|اللَّهُ|اللَّهَ)/g;
    formattedText = formattedText.replace(lafazRegex, '<span style="color:#059669;font-weight:bold;">$1</span>');

    const errorsForThisAyah = recordedErrors.filter(e => e.ayahNum === ayahNum && e.selectedText);
    errorsForThisAyah.forEach(err => {
      const theme = ERROR_CONFIG[err.type];
      formattedText = formattedText.replace(
        err.selectedText, 
        `<span style="background:${theme.bg};border-bottom:2px solid ${theme.border};color:${theme.color};border-radius:4px;padding:0 2px;">${err.selectedText}</span>`
      );
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

  // FUNGSI TUTUP NOTIFIKASI HIJAU DAN SEKAT DARIPADA MUNCUL SEMULA
  const handleDismissWaiting = () => {
    if (waitingStudent) {
      if (waitingStudent.id) dismissedStudentsRef.current.add(waitingStudent.id);
      if (waitingStudent.name) dismissedStudentsRef.current.add(waitingStudent.name);
    }
    setWaitingStudent(null);
  };

  // 9. PANGGIL PELAJAR KE BILIK LIVE
  const handleInviteStudent = async (targetStudentId?: string) => {
    // Sekat mesej hijau serta-merta
    if (waitingStudent) {
      if (waitingStudent.id) dismissedStudentsRef.current.add(waitingStudent.id);
      if (waitingStudent.name) dismissedStudentsRef.current.add(waitingStudent.name);
    }
    setWaitingStudent(null);

    let activeTargetId = targetStudentId || selectedStudentId;

    // Pastikan ID pelajar adalah UUID sah; jika tidak, cari padanan profil
    if (!isValidUUID(activeTargetId)) {
      const foundInList = senaraiPelajar.find(p => p.id === activeTargetId || p.full_name === waitingStudent?.name);
      if (foundInList && isValidUUID(foundInList.id)) {
        activeTargetId = foundInList.id;
      } else {
        const { data: sProf } = await supabase
          .from('profiles')
          .select('id')
          .or(`full_name.ilike.%${waitingStudent?.name || 'Azizi'}%,role.ilike.pelajar`)
          .limit(1)
          .maybeSingle();
        if (sProf?.id && isValidUUID(sProf.id)) {
          activeTargetId = sProf.id;
        }
      }
    }

    if (activeTargetId) {
      dismissedStudentsRef.current.add(activeTargetId);
      setSelectedStudentId(activeTargetId);
    }

    setIsCallingStudent(true);
    setCallStatus('calling');
    setIsCallActive(true);

    try {
      const studentObj = senaraiPelajar.find(p => p.id === activeTargetId);
      const studentName = studentObj?.full_name || waitingStudent?.name || 'Pelajar';

      // Pastikan ID guru adalah UUID yang sah
      let validTeacherId = teacherId;
      if (!isValidUUID(validTeacherId)) {
        const { data: gProf } = await supabase
          .from('profiles')
          .select('id')
          .ilike('role', '%Guru%')
          .limit(1)
          .maybeSingle();
        if (gProf?.id && isValidUUID(gProf.id)) {
          validTeacherId = gProf.id;
          setTeacherId(gProf.id);
        }
      }

      // Hantar siaran langsung Realtime supaya skrin pelajar membuka LiveKit Room serta-merta
      const waitingChannel = supabase.channel('tasmik_waiting_room');
      waitingChannel.send({
        type: 'broadcast',
        event: 'call_started',
        payload: {
          studentId: activeTargetId,
          teacherId: validTeacherId,
          roomName: 'HuffazPro-Tasmik-Bilik-04'
        }
      });

      // Simpan rekod notifikasi dalam jadual Supabase HANYA jika target ID adalah UUID sah
      if (isValidUUID(activeTargetId)) {
        const notifPayload: any = {
          user_id: activeTargetId,
          type: 'live_call',
          title: 'Panggilan Tasmik Live (Segera)',
          message: `Guru ${teacherName} sedang menunggu anda di Studio Tasmik Online. Sila masuk sekarang.`,
          is_read: false
        };

        // Elakkan memasukkan rentetan kosong "" ke dalam lajur sender_id UUID
        if (isValidUUID(validTeacherId)) {
          notifPayload.sender_id = validTeacherId;
        }

        const { data: newNotif, error: notifErr } = await supabase
          .from('notifications')
          .insert([notifPayload])
          .select()
          .single();

        if (notifErr) {
          console.warn('Amaran menyimpan notifikasi panggilan:', notifErr.message);
        } else if (newNotif?.id) {
          const intervalChecker = setInterval(async () => {
            const { data: check } = await supabase
              .from('notifications')
              .select('is_read')
              .eq('id', newNotif.id)
              .single();

            if (check?.is_read === true) {
              setCallStatus('connected');
              setSuccessMsg(`${studentName} telah menyahut panggilan dan berada dalam bilik live!`);
              clearInterval(intervalChecker);
            }
          }, 2000);

          setTimeout(() => clearInterval(intervalChecker), 120000);
        }
      }

      setSuccessMsg(`Panggilan telah dimulakan bersama ${studentName}!`);
    } catch (err: any) {
      console.error('Ralat menyambungkan panggilan:', err);
    } finally {
      setIsCallingStudent(false);
    }
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    setCallStatus('idle');
    setCallDuration(0);
  };

  // 10. SAHKAN & HANTAR PENILAIAN LIVE
  const handleSubmitPenilaian = async () => {
    if (!selectedStudentId) {
      alert('Sila pilih pelajar terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const surahName = surahsList.find(s => s.number === Number(selectedSurahId))?.englishName || 'Surah Al-Quran';
      const studentObj = senaraiPelajar.find(p => p.id === selectedStudentId);
      const studentName = studentObj?.full_name || 'Pelajar';

      const combinedNotes = recordedErrors.length > 0 
        ? `Terdapat ${recordedErrors.length} kesalahan dikesan dalam sesi Live. ${notes ? 'Catatan: ' + notes : ''}`
        : `Tahniah! Bacaan lancar tanpa kesalahan dalam sesi Live. ${notes ? 'Catatan: ' + notes : ''}`;

      if (isValidUUID(selectedStudentId) && isValidUUID(teacherId)) {
        await supabase
          .from('evaluations')
          .insert([{
            student_id: selectedStudentId,
            teacher_id: teacherId,
            surah: surahName,
            halaman: String(selectedPage), // Simpan nombor halaman sebenar sahaja
            gred: selectedGrade,
            catatan: combinedNotes,
            type: 'Live',
            error_records: JSON.stringify(recordedErrors)
          }]);

        await supabase
          .from('notifications')
          .insert([{
            user_id: selectedStudentId,
            sender_id: teacherId,
            type: 'teguran',
            title: `Gred Semakan Tasmik Live: ${selectedGrade}`,
            message: combinedNotes
          }]);
      }

      setSuccessMsg(`Penilaian Tasmik Online untuk ${studentName} berjaya dihantar!`);
      setRecordedErrors([]);
      setNotes('');
      handleEndCall();

      setTimeout(() => {
        setSuccessMsg('');
        router.push('/guru/dashboard');
      }, 2000);

    } catch (err: any) {
      alert('Gagal menghantar rekod: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayAyahs = ayahs.filter(a => a.page === selectedPage);

  const activeStudent = senaraiPelajar.find(p => p.id === selectedStudentId);
  const activeStudentName = activeStudent?.full_name || (senaraiPelajar.length === 0 ? 'Tiada Pelajar Di-Assign' : 'Pilih Pelajar');

  return (
    <DashboardGuruLayout userName={teacherName} userRole="Ketua Pentasmik">
      <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingBottom: '3rem' }}>
        
        {/* PEMBERITAHUAN KEJAYAAN */}
        {successMsg && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '0.85rem 1.15rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem' }}>
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}

        {/* NOTIFIKASI KHAS: PELAJAR SEDANG MENUNGGU DI BILIK MENUNGGU */}
        {waitingStudent && !isCallActive && (
          <div style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
            border: '1px solid #10b981',
            color: '#ffffff',
            padding: '0.85rem 1.25rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.85rem',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                background: '#10b981',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.6)'
              }}>
                <BellRing size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                  Pelajar Sedang Menunggu di Bilik Menunggu!
                </div>
                <div style={{ fontSize: '0.82rem', color: '#d1fae5', marginTop: '2px' }}>
                  <strong>{waitingStudent.name}</strong> kini berada di talian ({waitingStudent.time}) dan sedia untuk tasmik.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleInviteStudent(waitingStudent.id)}
                disabled={isCallActive}
                style={{
                  background: '#ffffff',
                  color: '#065f46',
                  border: 'none',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: isCallActive ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >
                <PhoneCall size={15} /> Mulakan Panggilan
              </button>
              <button
                type="button"
                onClick={handleDismissWaiting}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '0.45rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Tutup pemberitahuan"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* BAR ATAS KAWALAN RESPONSIVE */}
        <div className="tasmik-top-control-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <span style={{
              background: isCallActive ? '#ef4444' : '#475569',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.25rem 0.65rem',
              borderRadius: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              {isCallActive && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', animation: 'spin 1.5s infinite' }}></span>
              )}
              {isCallActive ? 'LIVE' : 'STANDBY'}
            </span>

            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                Bilik Tasmik: <span style={{ color: '#60a5fa' }}>{activeStudentName}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {activeStudent?.matrik_or_id ? `No. Matrik: ${activeStudent.matrik_or_id}` : 'Sesi Tasmik Online'}
              </div>
            </div>
          </div>

          <div className="tasmik-top-action-group">
            {/* DROPDOWN PEMILIH PELAJAR */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: isCallActive ? '#090d16' : '#1e293b',
              padding: '0.35rem 0.65rem',
              borderRadius: '8px',
              border: isCallActive ? '1px dashed #475569' : '1px solid #334155',
              flex: 1,
              minWidth: '220px'
            }}>
              {isCallActive ? <Lock size={15} color="#f59e0b" /> : <Users size={15} color="#94a3b8" />}
              <span style={{ fontSize: '0.75rem', color: isCallActive ? '#94a3b8' : '#cbd5e1', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {isCallActive ? 'Pelajar Dikunci:' : 'Tukar:'}
              </span>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={isCallActive || senaraiPelajar.length === 0}
                style={{
                  width: '100%',
                  background: isCallActive ? '#090d16' : '#0f172a',
                  color: isCallActive ? '#94a3b8' : '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: (isCallActive || senaraiPelajar.length === 0) ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  opacity: isCallActive ? 0.8 : 1
                }}
              >
                {senaraiPelajar.length === 0 ? (
                  <option value="">Tiada Pelajar Di-Assign</option>
                ) : (
                  senaraiPelajar.map(p => {
                    const isWaiting = !!waitingStudentsMap[p.id];
                    return (
                      <option key={p.id} value={p.id}>
                        {isWaiting ? '🟢 [MENUNGGU] ' : ''}
                        {p.full_name} {p.matrik_or_id ? `(${p.matrik_or_id})` : ''}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            {/* BUTANG PANGGIL PELAJAR KE LIVE */}
            <button
              type="button"
              onClick={() => handleInviteStudent()}
              disabled={isCallingStudent || !selectedStudentId || isCallActive}
              style={{
                background: isCallActive ? '#059669' : '#0062ff',
                color: '#fff',
                border: 'none',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: (isCallingStudent || isCallActive || !selectedStudentId) ? 'default' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minHeight: '40px',
                whiteSpace: 'nowrap'
              }}
            >
              <BellRing size={15} /> 
              {callStatus === 'connected' 
                ? 'Pelajar Bersambung!' 
                : isCallActive 
                ? 'Panggilan Aktif' 
                : 'Panggil Pelajar'}
            </button>

            {/* JAM TEMPOH PANGGILAN */}
            <div style={{
              background: '#000000',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: isCallActive ? '#10b981' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40px'
            }}>
              {isCallActive ? formatTimer(callDuration) : '00:00'}
            </div>
          </div>
        </div>

        {/* STATUS PELAJAR & REKOD TERAKHIR */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0.65rem 1rem',
          fontSize: '0.8rem',
          color: '#475569',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.4rem'
        }}>
          <div>
            <strong>Pelajar:</strong> {activeStudentName}{' '}
            {isCallActive ? (
              <span style={{ color: '#059669', fontWeight: 700 }}>(Sesi Live)</span>
            ) : waitingStudentsMap[selectedStudentId] ? (
              <span style={{ color: '#059669', fontWeight: 800 }}>
                (🟢 Sedang Menunggu di Bilik Menunggu)
              </span>
            ) : null}
          </div>
          <div>
            {rekodTerakhir ? (
              <span>
                Lalu: <strong>{rekodTerakhir.surah}</strong> | Halaman: <strong>{rekodTerakhir.halaman && rekodTerakhir.halaman !== 'Penuh' ? rekodTerakhir.halaman : '-'}</strong> | Gred:{' '}
                <strong style={{ color: '#059669' }}>{rekodTerakhir.gred}</strong>
              </span>
            ) : (
              <span style={{ color: '#94a3b8' }}>Tiada rekod tasmik lalu.</span>
            )}
          </div>
        </div>

        {/* TOGOL TAB KHAS SKRIN TELEFON (< 768px) */}
        <div className="tasmik-mobile-tab-bar">
          <button
            type="button"
            className={`tasmik-tab-btn ${mobileTab === 'mushaf' ? 'active' : ''}`}
            onClick={() => setMobileTab('mushaf')}
          >
            <BookOpen size={16} />
            <span>Mushaf Al-Quran</span>
          </button>
          <button
            type="button"
            className={`tasmik-tab-btn ${mobileTab === 'panel' ? 'active' : ''}`}
            onClick={() => setMobileTab('panel')}
          >
            <Video size={16} />
            <span>Kamera & Penilaian</span>
            {recordedErrors.length > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>
                {recordedErrors.length}
              </span>
            )}
          </button>
        </div>

        {/* GRID UTAMA: KOLUM VIDEO/PENILAIAN & MUSHAF */}
        <div className="tasmik-main-grid-layout">
          
          {/* KOLUM KIRI: VIDEO CALL LIVEKIT & BORANG GRED */}
          <div className={`tasmik-panel-col ${mobileTab === 'panel' ? 'show-mobile' : 'hide-mobile'}`}>
            <div style={{
              background: '#0f172a',
              borderRadius: '16px',
              overflow: 'hidden',
              minHeight: '260px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}>
              {!isCallActive ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '260px',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  color: '#94a3b8'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: '#1e293b',
                    color: '#60a5fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    border: '1px solid #334155'
                  }}>
                    <Video size={28} />
                  </div>
                  <h4 style={{ margin: '0 0 0.35rem 0', color: '#f8fafc', fontSize: '0.95rem', fontWeight: 700 }}>
                    Kamera Belum Bersambung
                  </h4>
                  <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, maxWidth: '240px' }}>
                    {waitingStudentsMap[selectedStudentId] 
                      ? `${activeStudentName} kini sedia di bilik menunggu! Klik butang di bawah untuk memulakan sesi.` 
                      : 'Pilih pelajar di atas dan klik Panggil Pelajar untuk memulakan sesi video.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleInviteStudent()}
                    disabled={!selectedStudentId || isCallingStudent}
                    style={{
                      background: waitingStudentsMap[selectedStudentId] ? '#059669' : '#0062ff',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.65rem 1.25rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: (!selectedStudentId || isCallingStudent) ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      minHeight: '44px'
                    }}
                  >
                    <PhoneCall size={16} /> 
                    {waitingStudentsMap[selectedStudentId] ? 'Sertai Pelajar di Bilik' : 'Mulakan Panggilan'}
                  </button>
                </div>
              ) : isProfileLoaded ? (
                <LiveKitRoomView 
                  roomName="HuffazPro-Tasmik-Bilik-04" 
                  userName={`${teacherName} (Guru Pentasmik)`} 
                  onDisconnect={handleEndCall} 
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '260px', color: '#94a3b8' }}>
                  <Loader2 className="animate-spin" size={28} />
                </div>
              )}
            </div>

            {/* PANEL PENILAIAN */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>
                  Gred Penilaian Akhir
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                  {['Mumtaz', 'Jayyid Jiddan', 'Jayyid', 'Maqbul', 'Rasib'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      style={{
                        padding: '0.6rem 0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: '8px',
                        border: selectedGrade === g ? '2px solid #0062ff' : '1px solid #cbd5e1',
                        background: selectedGrade === g ? '#eff6ff' : '#fff',
                        color: selectedGrade === g ? '#0062ff' : '#475569',
                        cursor: 'pointer',
                        minHeight: '42px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '0.4rem' }}>
                  Kesalahan Dikesan ({recordedErrors.length})
                </span>
                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {recordedErrors.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tiada rekod ralat ditanda.</span>
                  ) : (
                    recordedErrors.map(err => (
                      <div key={err.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0062ff' }}>Ayat {err.ayahNum} ({err.type})</div>
                          <div style={{ fontFamily: '"Amiri Quran", serif', fontSize: '1rem', direction: 'rtl' }}>{err.selectedText}</div>
                        </div>
                        <button type="button" onClick={() => handleRemoveError(err.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.35rem' }}><Trash2 size={15} /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'block', marginBottom: '0.4rem' }}>
                  Ulasan Tambahan
                </span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Taipkan ulasan anda..."
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitPenilaian}
                disabled={isSubmitting || !selectedStudentId}
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: (isSubmitting || !selectedStudentId) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  minHeight: '46px'
                }}
              >
                {isSubmitting ? <Loader2 size={18} className="spinIcon" /> : <Send size={18} />}
                Sahkan & Hantar Rekod
              </button>
            </div>
          </div>

          {/* KOLUM KANAN: PAPARAN MUSHAF */}
          <div className={`tasmik-mushaf-col ${mobileTab === 'mushaf' ? 'show-mobile' : 'hide-mobile'}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={18} color="#0062ff" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Mushaf Penilaian Semasa</h3>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start' }} className="mushaf-filter-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: '160px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>Surah:</span>
                  <select
                    value={selectedSurahId}
                    onChange={handleSurahChange}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, outline: 'none', background: '#f8fafc' }}
                  >
                    {surahsList.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. {s.englishName} ({s.name})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: '110px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>M/S:</span>
                  <select
                    value={selectedPage}
                    onChange={(e) => setSelectedPage(Number(e.target.value))}
                    disabled={isLoadingQuran}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, outline: 'none', background: '#f8fafc' }}
                  >
                    {availablePages.map(page => (
                      <option key={page} value={page}>M/S {page}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* KAWASAN BACAAN MUSHAF */}
            {isLoadingQuran ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px', color: '#94a3b8' }}>
                <Loader2 size={32} className="spinIcon" />
              </div>
            ) : (
              <div
                onMouseUp={handleMouseUpTextSelection}
                onTouchEnd={handleMouseUpTextSelection}
                className="quran-reading-paper"
              >
                {displayAyahs.length > 0 && displayAyahs[0]?.numberInSurah === 1 && selectedSurahId !== 1 && selectedSurahId !== 9 && (
                  <div className="bismillah-title">
                    بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                  </div>
                )}

                <div className="quran-text-flow">
                  {displayAyahs.map((ayah) => (
                    <React.Fragment key={ayah.number}>
                      <span
                        data-ayah={ayah.numberInSurah} // ATRIBUT PENTING UNTUK HIGHLIGHT
                        dangerouslySetInnerHTML={{ __html: formatAyahText(ayah.text, ayah.numberInSurah) }}
                        style={{ cursor: 'text' }}
                      />
                      <span style={{ color: '#059669', fontWeight: 'bold', margin: '0 4px', fontSize: '1.15rem' }}>
                        ﴿{ayah.numberInSurah}﴾
                      </span>{' '}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* MODAL POP-UP PILIH RALAT */}
        {activeAyahForError && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1rem'
          }}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Tanda Ralat - Ayat {activeAyahForError}</h4>
                <button type="button" onClick={() => setActiveAyahForError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.35rem' }}><X size={20} /></button>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Kalimah Disorot</span>
                <div style={{ fontFamily: '"Amiri Quran", serif', fontSize: '1.5rem', direction: 'rtl', marginTop: '0.3rem' }}>
                  {highlightedText}
                </div>
              </div>

              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Pilih jenis ralat bacaan:</span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <button type="button" onClick={() => handleAddError('Tajwid / Dengung')} style={{ padding: '0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', minHeight: '46px' }}>🔤 Tajwid</button>
                <button type="button" onClick={() => handleAddError('Kelancaran Sangkut')} style={{ padding: '0.75rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', minHeight: '46px' }}>⏸️ Sangkut</button>
                <button type="button" onClick={() => handleAddError('Salah Baris')} style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', minHeight: '46px' }}>✏️ Baris</button>
                <button type="button" onClick={() => handleAddError('Makhraj Huruf')} style={{ padding: '0.75rem', background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#6d28d9', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', minHeight: '46px' }}>🗣️ Makhraj</button>
              </div>
            </div>
          </div>
        )}

      </div>

      <style jsx global>{`
        .spinIcon { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .tasmik-top-control-card {
          background: #0f172a;
          color: #ffffff;
          border-radius: 14px;
          padding: 0.85rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.85rem;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .tasmik-top-action-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .tasmik-mobile-tab-bar {
          display: none;
        }

        .tasmik-main-grid-layout {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 1.25rem;
          align-items: start;
        }

        .tasmik-panel-col {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .tasmik-mushaf-col {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .quran-reading-paper {
          background: #fffdfa;
          border: 1px solid #f1e9d2;
          border-radius: 12px;
          padding: 1.75rem 1.25rem;
          min-height: 380px;
          position: relative;
        }

        .bismillah-title {
          font-family: 'Amiri Quran', serif;
          font-size: 1.6rem;
          text-align: center;
          margin-bottom: 1.25rem;
          color: #0f172a;
        }

        .quran-text-flow {
          direction: rtl;
          text-align: justify;
          line-height: 2.4;
          font-size: clamp(1.25rem, 4.5vw, 1.55rem);
          font-family: 'Amiri Quran', 'Traditional Arabic', serif;
          color: #0f172a;
        }

        @media (max-width: 1023px) {
          .tasmik-main-grid-layout {
            grid-template-columns: 300px 1fr;
            gap: 1rem;
          }
          .tasmik-top-action-group {
            width: 100%;
          }
        }

        @media (max-width: 767px) {
          .tasmik-top-control-card {
            flex-direction: column;
            align-items: stretch;
            padding: 1rem;
          }
          .tasmik-top-action-group {
            flex-direction: column;
            align-items: stretch;
            gap: 0.65rem;
          }
          .tasmik-top-action-group > div, 
          .tasmik-top-action-group > button {
            width: 100% !important;
          }

          .tasmik-mobile-tab-bar {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            padding: 0.35rem;
            border-radius: 10px;
          }

          .tasmik-tab-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0.65rem 0.5rem;
            font-size: 0.8rem;
            font-weight: 700;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            background: transparent;
            color: #64748b;
            transition: all 0.2s;
            min-height: 42px;
          }

          .tasmik-tab-btn.active {
            background: #0062ff;
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(0, 98, 255, 0.25);
          }

          .tasmik-main-grid-layout {
            grid-template-columns: 1fr !important;
          }

          .hide-mobile {
            display: none !important;
          }

          .show-mobile {
            display: flex !important;
          }

          .tasmik-mushaf-col {
            padding: 1rem;
          }

          .quran-reading-paper {
            padding: 1.25rem 0.85rem;
          }

          .bismillah-title {
            font-size: 1.35rem;
          }
        }
      `}</style>
    </DashboardGuruLayout>
  );
}