'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LiveKitRoomView from '@/components/video/LiveKitRoomView'; 
import { supabase } from '@/lib/supabase';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Settings, BookOpen, 
  ChevronLeft, ChevronRight, Maximize2, Search, Type, Moon, Sun, 
  Languages, Volume2, PauseCircle, Lock, PhoneCall, Square, Play, 
  EyeOff, Repeat, PenTool, ArrowLeft, RotateCcw, Users, Copy, Check, 
  AlertCircle, ArrowRightLeft, Radio, BellRing, X
} from 'lucide-react';
import styles from './Tasmik.module.css';

const toArabicNumeral = (enNum: number) => ("" + enNum).replace(/[0-9]/g, (t) => String.fromCharCode(t.charCodeAt(0) + 1584));

export default function TasmikLivePage() {
  const [isLiveCall, setIsLiveCall] = useState(false); 
  const [trainingMode, setTrainingMode] = useState<'menu' | 'semak' | 'tutup' | 'ulang' | 'kosong' | 'sparing'>('menu');
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  
  const [selectedCamera, setSelectedCamera] = useState('Kamera Lalai Sistem (Default)');
  const [selectedMic, setSelectedMic] = useState('Mikrofon Lalai (Default)');
  const [selectedSpeaker, setSelectedSpeaker] = useState('Pembesar Suara Sistem');
  
  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'reviewing'>('idle');
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);

  const [revealedAyahs, setRevealedAyahs] = useState<number[]>([]);
  const [loopStart, setLoopStart] = useState<number>(1);
  const [loopEnd, setLoopEnd] = useState<number>(5);
  const [loopCount, setLoopCount] = useState<number>(3);
  const [currentLoop, setCurrentLoop] = useState<number>(0);
  const [isLooping, setIsLooping] = useState(false);
  const [hiddenWordsMap, setHiddenWordsMap] = useState<Record<number, number[]>>({}); 
  const [revealedWordsMap, setRevealedWordsMap] = useState<Record<number, number[]>>({});

  const [sparingStep, setSparingStep] = useState<'lobby' | 'connected'>('lobby');
  const [roomCode] = useState('HAFIZ-889');
  const [copiedCode, setCopiedCode] = useState(false);
  const [inputJoinCode, setInputJoinCode] = useState('');
  const [sparingSubMode, setSparingSubMode] = useState<'relay' | 'roleplay' | 'challenge'>('relay');
  const [sparingTurn, setSparingTurn] = useState<'me' | 'partner'>('partner'); 
  const [myRole, setMyRole] = useState<'penghafaz' | 'penyemak'>('penyemak'); 
  const [partnerAlert, setPartnerAlert] = useState<boolean>(false);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [currentPage, setCurrentPage] = useState(2); 
  const [ayahs, setAyahs] = useState<any[]>([]);
  const [surahsList, setSurahsList] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [pageMeta, setPageMeta] = useState({ surahName: '', juz: '' });

  const [selectedSurahId, setSelectedSurahId] = useState<number>(2);
  const [selectedPage, setSelectedPage] = useState<number | 'Semua'>('Semua');
  const [availablePages, setAvailablePages] = useState<number[]>([]);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSizeBase, setFontSizeBase] = useState(1.65);
  const [showTranslation, setShowTranslation] = useState(false);
  
  const [selectedAyahId, setSelectedAyahId] = useState<number | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const qariAudioRef = useRef<HTMLAudioElement | null>(null);

  // STATE SUPABASE
  const [studentName, setStudentName] = useState('Pelajar');
  const [studentId, setStudentId] = useState('');
  const [rekodTerakhir, setRekodTerakhir] = useState<any>(null);

  // 1. TARIK DATA PELAJAR & REKOD TERAKHIR DARI SUPABASE
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const userId = authData.user.id;
          setStudentId(userId);

          const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (profile) {
            setStudentName(profile.full_name);
            
            const { data: lastEval } = await supabase
              .from('evaluations')
              .select('*')
              .eq('student_id', profile.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastEval) setRekodTerakhir(lastEval);
          }
        }
      } catch (err) {
        console.error("Gagal menarik data pelajar:", err);
      }
    };
    fetchStudentData();
  }, []);

  // 2. DENGAR PANGGILAN LIVE DARI GURU SECARA MASA-NYATA (SUPABASE TULEN)
  useEffect(() => {
    if (!studentId) return;

    let callChecker: NodeJS.Timeout;

    const checkIncomingCall = async () => {
      try {
        const { data: activeNotif } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', studentId)
          .eq('type', 'live_call')
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeNotif) {
          const ageMs = Date.now() - new Date(activeNotif.created_at).getTime();
          if (ageMs < 10 * 60 * 1000) {
            setIsLiveCall(true);
            quitTrainingMode();
            setShowTranslation(false);
            await supabase.from('notifications').update({ is_read: true }).eq('id', activeNotif.id);
          }
        }
      } catch (err) {
        console.error("Ralat menyemak panggilan live:", err);
      }
    };

    checkIncomingCall();
    callChecker = setInterval(checkIncomingCall, 3000);

    return () => clearInterval(callChecker);
  }, [studentId]);

  // 3. RAKAM KEHADIRAN (HADIR ONLINE) & NOTIFIKASI GURU APABILA LIVE BERMULA
  useEffect(() => {
    if (isLiveCall && studentId) {
      const handleLiveStart = async () => {
        try {
          const now = new Date();
          const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const timeNow = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

          const { data: existAtt } = await supabase
            .from('attendance')
            .select('id')
            .eq('user_id', studentId)
            .eq('date', todayIso)
            .maybeSingle();

          if (!existAtt) {
            const attData = {
              user_id: studentId,
              date: todayIso,
              time_in: timeNow,
              status: 'Hadir Online'
            };
            try {
              await supabase.from('attendance').insert([{ ...attData, remarks: 'Tasmik Online Live' }]);
            } catch {
              await supabase.from('attendance').insert([attData]);
            }
          }

          const { data: guru } = await supabase.from('profiles').select('id').eq('role', 'Guru').limit(1).maybeSingle();
          if (guru) {
            await supabase.from('notifications').insert([{
              user_id: guru.id,
              sender_id: studentId,
              type: 'info',
              title: 'Pelajar Telah Masuk Bilik',
              message: `${studentName} kini berada di dalam Bilik Tasmik Live.`
            }]);
          }
        } catch (err) {
          console.error("Gagal menyelaraskan sesi live:", err);
        }
      };

      handleLiveStart();
    }
  }, [isLiveCall, studentId, studentName]);

  // 4. AUTO-SYNC: BUKA MUSHAF MENGIKUT REKOD TERAKHIR
  useEffect(() => {
    if (rekodTerakhir && surahsList.length > 0) {
      const found = surahsList.find(s => s.englishName === rekodTerakhir.surah || s.name === rekodTerakhir.surah);
      if (found) setSelectedSurahId(found.number);
      setSelectedPage('Semua'); 
    }
  }, [rekodTerakhir, surahsList]);

  useEffect(() => { 
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(data => { if (data.data) setSurahsList(data.data); }); 
  }, []);

  useEffect(() => {
    const fetchQuranPage = async () => {
      setLoading(true);
      resetAllModes();
      try {
        const [quranRes, transRes] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/page/${currentPage}/quran-uthmani`),
          fetch(`https://api.alquran.cloud/v1/page/${currentPage}/ms.basmeih`) 
        ]);
        const quranData = await quranRes.json();
        const transData = await transRes.json();
        if (quranData.data && transData.data) {
          const combinedAyahs = quranData.data.ayahs.map((ayah: any, index: number) => ({ ...ayah, translation: transData.data.ayahs[index].text }));
          setAyahs(combinedAyahs);
          const uniqueSurahs = [...new Set(quranData.data.ayahs.map((a: any) => a.surah.englishName))].join(' & ');
          setPageMeta({ surahName: uniqueSurahs, juz: quranData.data.ayahs[0].juz });
          if (combinedAyahs.length > 0) { setLoopStart(combinedAyahs[0].number); setLoopEnd(combinedAyahs[Math.min(4, combinedAyahs.length - 1)].number); }
        }
      } catch (error) {} finally { setLoading(false); }
    };
    fetchQuranPage();
  }, [currentPage]);

  // KAWALAN VIDEO UNTUK SPARING
  useEffect(() => {
    if (!isLiveCall && isVideoOn && trainingMode === 'sparing') { 
      startCamera(); 
    } else { 
      stopCamera(); 
    }
    return () => stopCamera();
  }, [isVideoOn, isLiveCall, trainingMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setLocalStream(stream);
    } catch (err) {
      console.error("Gagal mengakses kamera:", err);
      setIsVideoOn(false); 
    }
  };

  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop()); 
      setLocalStream(null);
    }
  };

  const videoRefCallback = (node: HTMLVideoElement | null) => {
    if (node && localStream) { node.srcObject = localStream; }
  };

  const resetAllModes = () => {
    if (qariAudioRef.current) { qariAudioRef.current.pause(); setPlayingAudioId(null); }
    setSelectedAyahId(null); setRecordState('idle'); setUserAudioUrl(null); setRevealedAyahs([]); setIsLooping(false); setCurrentLoop(0); setHiddenWordsMap({}); setRevealedWordsMap({}); setPartnerAlert(false);
  };

  const quitTrainingMode = () => { resetAllModes(); setSparingStep('lobby'); setTrainingMode('menu'); };

  const startSelfRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setUserAudioUrl(URL.createObjectURL(audioBlob));
        setRecordState('reviewing');
      };
      mediaRecorder.start(); setRecordState('recording');
    } catch (err) { alert("Akses mikrofon diperlukan."); }
  };

  const stopSelfRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleUserAudioPlayback = () => {
    if (!userAudioRef.current) return;
    if (isPlayingUserAudio) { userAudioRef.current.pause(); setIsPlayingUserAudio(false); } 
    else { userAudioRef.current.play(); setIsPlayingUserAudio(true); }
  };

  const toggleRevealAyah = (ayahNumber: number) => {
    if (trainingMode !== 'tutup') return;
    setRevealedAyahs(prev => prev.includes(ayahNumber) ? prev.filter(n => n !== ayahNumber) : [...prev, ayahNumber]);
  };

  const startLooping = () => {
    if (loopStart > loopEnd) return alert("Ayat mula mesti sebelum ayat akhir.");
    setIsLooping(true); setCurrentLoop(0); playQariAudio(loopStart);
  };
  
  const playQariAudio = (globalAyahNumber: number) => {
    if (qariAudioRef.current) qariAudioRef.current.pause();
    const newAudio = new Audio(`https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahNumber}.mp3`);
    newAudio.play();
    newAudio.onended = () => handleAudioEnded(globalAyahNumber);
    qariAudioRef.current = newAudio; setPlayingAudioId(globalAyahNumber);
  };

  const handleAudioEnded = (endedAyahId: number) => {
    if (trainingMode === 'ulang' && isLooping) {
      if (endedAyahId < loopEnd) { playQariAudio(endedAyahId + 1); } 
      else {
        if (currentLoop + 1 < loopCount) { setCurrentLoop(prev => prev + 1); playQariAudio(loopStart); } 
        else { setIsLooping(false); setPlayingAudioId(null); }
      }
    } else { setPlayingAudioId(null); }
  };

  const toggleNormalAudio = (globalAyahNumber: number) => {
    if (playingAudioId === globalAyahNumber) { qariAudioRef.current?.pause(); setPlayingAudioId(null); } 
    else { playQariAudio(globalAyahNumber); }
  };

  const generateClozeTest = () => {
    setTrainingMode('kosong');
    const newHiddenMap: Record<number, number[]> = {};
    ayahs.forEach(ayah => {
      const wordsCount = ayah.text.split(' ').length;
      const hiddenIndices: number[] = [];
      for (let i = 0; i < wordsCount; i++) { if (Math.random() < 0.25 && i > 0) hiddenIndices.push(i); }
      newHiddenMap[ayah.number] = hiddenIndices;
    });
    setHiddenWordsMap(newHiddenMap); setRevealedWordsMap({});
  };

  const revealClozeWord = (ayahNumber: number, wordIndex: number) => {
    if (trainingMode !== 'kosong') return;
    setRevealedWordsMap(prev => {
      const current = prev[ayahNumber] || [];
      return { ...prev, [ayahNumber]: [...current, wordIndex] };
    });
  };

  const copyRoomCode = () => { navigator.clipboard.writeText(roomCode); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };
  const connectToSparing = () => { setSparingStep('connected'); setSparingTurn('partner'); };
  const sendTeaserAlert = () => {
    setPartnerAlert(true);
    const beep = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    beep.volume = 0.5; beep.play().catch(()=>{});
    setTimeout(() => setPartnerAlert(false), 3000); 
  };

  const switchTurn = () => { setSparingTurn(prev => prev === 'me' ? 'partner' : 'me'); };
  const switchRole = () => { setMyRole(prev => prev === 'penghafaz' ? 'penyemak' : 'penghafaz'); };

  const handleSurahChange = async (e: any) => {
    const surahId = e.target.value;
    if (!surahId) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahId}`);
      const data = await res.json();
      if (data.data && data.data.ayahs) setCurrentPage(data.data.ayahs[0].page);
    } catch (error) {}
  };

  const formatAyahTextNormal = (text: string) => {
    const regex = /(ٱللَّهِ|ٱللَّهَ|ٱللَّهُ|اللَّهِ|اللَّهَ|اللَّهُ|اللَّه|لِلَّهِ|لِلَّه|بِٱللَّهِ|وَٱللَّهُ|وَٱللَّهِ|فَٱللَّهُ|تَٱللَّهِ)/g;
    const parts = text.split(regex);
    return parts.map((part, i) => part.match(regex) ? <span key={i} className={styles.highlightWord}>{part}</span> : part);
  };

  const increaseFont = () => setFontSizeBase(prev => Math.min(prev + 0.2, 2.8));
  const decreaseFont = () => setFontSizeBase(prev => Math.max(prev - 0.2, 1.2));
  
  const toggleLiveCall = () => { 
    setIsLiveCall(!isLiveCall); 
    if (!isLiveCall) { quitTrainingMode(); setShowTranslation(false); } 
  };

  const isSparingMasked = trainingMode === 'sparing' && sparingStep === 'connected' && (
    (sparingSubMode === 'relay') || 
    (sparingSubMode === 'roleplay' && myRole === 'penghafaz') ||
    (sparingSubMode === 'challenge' && sparingTurn === 'me')
  );

  return (
    <DashboardLayout userName={studentName} userRole="pelajar">
      
      {/* TETINGKAP POP-UP TETAPAN PERANTI (MODAL) */}
      {showDeviceSettings && (
        <div className={`${styles.modalOverlay} ${isDarkMode ? styles.themeDark : ''}`}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Tetapan Peranti</h3>
              <button className={styles.closeModalBtn} onClick={() => setShowDeviceSettings(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Kamera (Webcam)</label>
              <select className={styles.settingSelect} value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
                <option value="Kamera Lalai Sistem (Default)">Kamera Lalai Sistem (Default)</option>
                <option value="Integrated Camera (Laptop)">Integrated Camera (Laptop)</option>
                <option value="OBS Virtual Camera">OBS Virtual Camera</option>
              </select>
            </div>
            
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Mikrofon</label>
              <select className={styles.settingSelect} value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)}>
                <option value="Mikrofon Lalai (Default)">Mikrofon Lalai (Default)</option>
                <option value="Headset Microphone (Realtek)">Headset Microphone (Realtek)</option>
                <option value="USB Audio Device">USB Audio Device</option>
              </select>
            </div>
            
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Pembesar Suara (Speaker)</label>
              <select className={styles.settingSelect} value={selectedSpeaker} onChange={(e) => setSelectedSpeaker(e.target.value)}>
                <option value="Pembesar Suara Sistem">Pembesar Suara Sistem</option>
                <option value="Fon Telinga (Headphones)">Fon Telinga (Headphones)</option>
              </select>
            </div>
            
            <button className={styles.btnPrimary} style={{width: '100%', marginTop: '1rem', padding: '0.85rem', borderRadius: '10px'}} onClick={() => setShowDeviceSettings(false)}>
              Simpan Tetapan
            </button>
          </div>
        </div>
      )}

      <div className={styles.tasmikContainer}>
        
        {/* BAHAGIAN KIRI: PUSAT LATIHAN KENDIRI / LIVE CALL */}
        <div className={styles.videoCol}>
          {!isLiveCall ? (
            <div className={styles.aiModeCard}>
              
              {/* LOBI MENU PUSAT LATIHAN KENDIRI */}
              {trainingMode === 'menu' && (
                <div className={styles.centerContent}>
                  <div className={styles.aiIconBox}><BookOpen size={28} /></div>
                  <h3 className={styles.aiTitle}>Pusat Latihan Kendiri</h3>
                  <p className={styles.aiDesc}>Pilih kaedah latihan interaktif atau ajak rakan anda untuk berlatih bersama secara live.</p>
                  
                  <div className={styles.trainingMenu}>
                    <div className={`${styles.trainingOption} ${styles.optionHighlight}`} onClick={() => setTrainingMode('sparing')}>
                      <Users size={28} className={styles.optionIcon}/>
                      <p className={styles.optionTitle}>⚔️ Sparing Rakan Online (Live 1-on-1)</p>
                    </div>
                    <div className={styles.trainingOption} onClick={() => setTrainingMode('semak')}><Mic size={24} className={styles.optionIcon}/><p className={styles.optionTitle}>Semak Sendiri</p></div>
                    <div className={styles.trainingOption} onClick={() => setTrainingMode('tutup')}><EyeOff size={24} className={styles.optionIcon}/><p className={styles.optionTitle}>2. Mod Tutup & Uji</p></div>
                    <div className={styles.trainingOption} onClick={() => setTrainingMode('ulang')}><Repeat size={24} className={styles.optionIcon}/><p className={styles.optionTitle}>3. Gelung Ulangan</p></div>
                    <div className={styles.trainingOption} onClick={generateClozeTest}><PenTool size={24} className={styles.optionIcon}/><p className={styles.optionTitle}>4. Isi Tempat Kosong</p></div>
                  </div>
                </div>
              )}

              {/* MOD 1: SEMAK SENDIRI */}
              {trainingMode === 'semak' && (
                <div className={styles.centerContent}>
                  <button className={styles.backBtn} onClick={quitTrainingMode}><ArrowLeft size={16}/> Kembali ke Menu</button>
                  <h3 className={styles.aiTitle}>Rakaman Semak Sendiri</h3>
                  <p className={styles.aiDesc}>Rakam bacaan anda, dengar semula dan berikan markah kejujuran kepada hafazan anda sendiri.</p>
                  
                  {recordState === 'idle' && (
                    <button className={styles.aiMicBtn} onClick={startSelfRecording}><Mic size={28} /></button>
                  )}
                  {recordState === 'recording' && (
                    <>
                      <button className={`${styles.aiMicBtn} ${styles.aiMicBtnRecording}`} onClick={stopSelfRecording}><Square size={24} fill="currentColor" /></button>
                      <div className={styles.aiStatusText} style={{marginTop: '1rem'}}>Sedang merakam... Klik petak untuk berhenti.</div>
                    </>
                  )}
                  {recordState === 'reviewing' && (
                    <div style={{width: '100%'}}>
                      <div className={styles.audioPlayerBox}>
                        <button className={styles.audioPlayBtn} onClick={toggleUserAudioPlayback}>
                          {isPlayingUserAudio ? <PauseCircle size={18} /> : <Play size={18} fill="currentColor" />}
                        </button>
                        <div className={styles.audioTrack}><div className={styles.audioProgress} style={{animationPlayState: isPlayingUserAudio ? 'running' : 'paused', width: isPlayingUserAudio ? '100%' : '0%'}}></div></div>
                        <span className={styles.audioTime}>Suara</span>
                        <audio ref={userAudioRef} src={userAudioUrl || ''} onEnded={() => setIsPlayingUserAudio(false)} className="hidden" />
                      </div>
                      
                      <p style={{fontSize: '0.85rem', fontWeight:600, color:'#475569', marginBottom:'0.5rem', textAlign:'left'}}>Beri markah hafazan anda:</p>
                      <div className={styles.gradeBox}>
                        <button className={`${styles.gradeBtn} ${styles.gradeGreen}`} onClick={() => setRecordState('idle')}>🟢 Sangat Lancar</button>
                        <button className={`${styles.gradeBtn} ${styles.gradeYellow}`} onClick={() => setRecordState('idle')}>🟡 Ada Tersangkut</button>
                        <button className={`${styles.gradeBtn} ${styles.gradeRed}`} onClick={() => setRecordState('idle')}>🔴 Banyak Lupa</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MOD 2: TUTUP & UJI */}
              {trainingMode === 'tutup' && (
                <div className={styles.centerContent}>
                  <button className={styles.backBtn} onClick={quitTrainingMode}><ArrowLeft size={16}/> Kembali ke Menu</button>
                  <div className={styles.aiIconBox} style={{color: '#64748b', backgroundColor: '#f1f5f9'}}><EyeOff size={32} /></div>
                  <h3 className={styles.aiTitle}>Mod Tutup & Uji Sedia</h3>
                  <p className={styles.aiDesc}>Semua ayat di skrin kanan telah ditutup. Cuba baca dari ingatan. Jika terlupa, klik pada mana-mana ayat untuk mengintainya.</p>
                </div>
              )}

              {/* MOD 3: ULANG AUDIO */}
              {trainingMode === 'ulang' && (
                <div className={styles.centerContent} style={{width:'100%'}}>
                  <button className={styles.backBtn} onClick={quitTrainingMode}><ArrowLeft size={16}/> Kembali ke Menu</button>
                  <h3 className={styles.aiTitle}>Gelung Ulangan Qari</h3>
                  <p className={styles.aiDesc}>Latih makhraj dan hafazan anda dengan mendengar bacaan berulang kali.</p>
                  
                  <div className={styles.loopControls}>
                    <div style={{display:'flex', gap:'1rem', width:'100%'}}>
                      <div className={styles.inputGroup} style={{flex:1}}>
                        <span className={styles.inputLabel}>Mula Ayat</span>
                        <select className={styles.selectField} value={loopStart} onChange={e=>setLoopStart(Number(e.target.value))} disabled={isLooping}>
                          {ayahs.map(a => <option key={a.number} value={a.number}>Ayat {a.numberInSurah}</option>)}
                        </select>
                      </div>
                      <div className={styles.inputGroup} style={{flex:1}}>
                        <span className={styles.inputLabel}>Hingga Ayat</span>
                        <select className={styles.selectField} value={loopEnd} onChange={e=>setLoopEnd(Number(e.target.value))} disabled={isLooping}>
                          {ayahs.map(a => <option key={a.number} value={a.number}>Ayat {a.numberInSurah}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className={styles.inputGroup}>
                      <span className={styles.inputLabel}>Jumlah Ulangan</span>
                      <select className={styles.selectField} value={loopCount} onChange={e=>setLoopCount(Number(e.target.value))} disabled={isLooping}>
                        {[1,3,5,10,20].map(n => <option key={n} value={n}>{n} Kali</option>)}
                      </select>
                    </div>
                    
                    {!isLooping ? (
                      <button className={styles.loopBtn} onClick={startLooping}><Play size={18}/> Mula Gelung Audio</button>
                    ) : (
                      <button className={`${styles.loopBtn} ${styles.loopBtnStop}`} onClick={() => {setIsLooping(false); qariAudioRef.current?.pause(); setPlayingAudioId(null);}}><Square size={18} fill="currentColor"/> Hentikan (Ulangan {currentLoop + 1}/{loopCount})</button>
                    )}
                  </div>
                </div>
              )}

              {/* MOD 4: ISI TEMPAT KOSONG */}
              {trainingMode === 'kosong' && (
                <div className={styles.centerContent}>
                  <button className={styles.backBtn} onClick={quitTrainingMode}><ArrowLeft size={16}/> Kembali ke Menu</button>
                  <div className={styles.aiIconBox} style={{color: '#f59e0b', backgroundColor: '#fef3c7'}}><PenTool size={32} /></div>
                  <h3 className={styles.aiTitle}>Ujian Ingatan Teks</h3>
                  <p className={styles.aiDesc}>Beberapa perkataan di halaman kanan telah disembunyikan. Baca ayat tersebut dan teka tempat kosong. Klik pada garisan untuk melihat jawapan.</p>
                  <button className={styles.btnOutline} style={{width:'100%', padding:'0.8rem', borderRadius:'10px', marginTop:'1rem'}} onClick={generateClozeTest}>
                    <RotateCcw size={16}/> Rawak Semula
                  </button>
                </div>
              )}

              {/* MOD SPARING RAKAN ONLINE */}
              {trainingMode === 'sparing' && (
                <div style={{display:'flex', flexDirection:'column', height:'100%', width:'100%'}}>
                  
                  {sparingStep === 'lobby' ? (
                    <div className={styles.centerContent}>
                      <button className={styles.backBtn} onClick={quitTrainingMode}><ArrowLeft size={16}/> Kembali ke Menu</button>
                      <div className={styles.aiIconBox}><Users size={32} /></div>
                      <h3 className={styles.aiTitle}>Bilik Sparing Hafazan</h3>
                      <p className={styles.aiDesc}>Berlatih menghafal bersama rakan kelas anda dalam panggilan video 1-lawan-1 secara masa nyata.</p>
                      
                      <div className={styles.sparingLobbyBox}>
                        <div className={styles.codeCard}>
                          <span style={{fontSize:'0.75rem', fontWeight:600, color:'#64748b'}}>KOD BILIK ANDA</span>
                          <span className={styles.codeText}>{roomCode}</span>
                          <button className={styles.copyCodeBtn} onClick={copyRoomCode}>
                            {copiedCode ? <Check size={14} color="#10b981"/> : <Copy size={14}/>} {copiedCode ? 'Disalin!' : 'Salin & Hantar ke Rakan'}
                          </button>
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:'0.5rem', margin:'0.2rem 0'}}>
                          <div style={{flex:1, height:1, background:'#e2e8f0'}}></div><span style={{fontSize:'0.75rem', color:'#94a3b8', fontWeight:700}}>ATAU</span><div style={{flex:1, height:1, background:'#e2e8f0'}}></div>
                        </div>
                        <div className={styles.joinInputRow}>
                          <input type="text" className={styles.joinInput} placeholder="Masukkan Kod Rakan..." value={inputJoinCode} onChange={e => setInputJoinCode(e.target.value)} />
                          <button className={styles.joinBtn} onClick={connectToSparing}>Sertai</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom:'0.6rem'}}>
                        <button className={styles.backBtn} style={{marginBottom:0}} onClick={() => setSparingStep('lobby')}><ArrowLeft size={14}/> Keluar Sparing</button>
                        <span className={styles.roleBadge}>
                          {sparingSubMode === 'relay' && 'Mod Sambung Ayat'}
                          {sparingSubMode === 'roleplay' && `Peranan: ${myRole.toUpperCase()}`}
                          {sparingSubMode === 'challenge' && 'Mod Tembak Ayat'}
                        </span>
                      </div>

                      {/* PAPARAN DWI-VIDEO RAKAN & ANDA */}
                      <div className={styles.sparingDualVideo}>
                        <div className={`${styles.sparingVideoBox} ${sparingTurn === 'partner' ? styles.activeSpeakerBox : ''}`}>
                          <img src="https://ui-avatars.com/api/?name=Hafiz+Irfan&background=475569&color=ffffff&size=100" alt="Rakan" style={{borderRadius:'50%', width:64, height:64}} />
                          <span className={styles.sparingVideoLabel}>Hafiz Irfan (Rakan Sparing)</span>
                          {sparingTurn === 'partner' && <span className={styles.sparingTurnBadge}><Radio size={12}/> Sedang Membaca</span>}
                        </div>

                        <div className={`${styles.sparingVideoBox} ${sparingTurn === 'me' ? styles.activeSpeakerBox : ''}`}>
                          {isVideoOn && localStream ? (
                            <video 
                              ref={videoRefCallback} 
                              autoPlay 
                              playsInline 
                              muted 
                              className={styles.videoStream} 
                            />
                          ) : (
                            <div className={styles.videoOffPlaceholder} style={{flexDirection: 'column', color: '#64748b', gap: '0.5rem'}}>
                              <VideoOff size={32} />
                              <span style={{fontSize: '0.75rem', fontWeight: 600}}>Kamera Dimatikan</span>
                            </div>
                          )}
                          <span className={styles.sparingVideoLabel}>Anda</span>
                          {sparingTurn === 'me' && <span className={styles.sparingTurnBadge}><Radio size={12}/> Giliran Anda</span>}
                        </div>
                      </div>

                      <div className={styles.sparingSubNav}>
                        <button className={`${styles.sparingSubTab} ${sparingSubMode === 'relay' ? styles.sparingSubTabActive : ''}`} onClick={() => setSparingSubMode('relay')}>Sambung Ayat</button>
                        <button className={`${styles.sparingSubTab} ${sparingSubMode === 'roleplay' ? styles.sparingSubTabActive : ''}`} onClick={() => setSparingSubMode('roleplay')}>2. Tasmik Rakan</button>
                        <button className={`${styles.sparingSubTab} ${sparingSubMode === 'challenge' ? styles.sparingSubTabActive : ''}`} onClick={() => setSparingSubMode('challenge')}>3. Tembak Ayat</button>
                      </div>

                      <div className={styles.sparingActionRow}>
                        <button className={styles.actionPassBtn} onClick={switchTurn} title="Tukar giliran bercakap">
                          <ArrowRightLeft size={16}/> Tukar Giliran Baca
                        </button>
                        {sparingSubMode === 'roleplay' && (
                          <button className={styles.actionPassBtn} onClick={switchRole} title="Tukar fungsi skrin anda">
                            {myRole === 'penghafaz' ? 'Jadi Penyemak' : 'Jadi Penghafaz'}
                          </button>
                        )}
                        <button className={styles.actionWarnBtn} onClick={sendTeaserAlert} title="Hantar 'Buzzer' amaran kepada skrin rakan">
                          <AlertCircle size={16}/> Tegur Salah
                        </button>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* BUTANG MULA TASMIK BERSAMA GURU */}
              <div style={{width: '100%', marginTop: 'auto'}}>
                <div style={{borderTop: '1px solid #e2e8f0', margin: '1rem 0', width: '100%'}}></div>
                <button className={styles.startCallBtn} onClick={toggleLiveCall}>
                  <PhoneCall size={18} /> Mula Tasmik Bersama Guru
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.videoCard} style={{ padding: 0, overflow: 'hidden', background: '#0f172a', position: 'relative', display: 'flex', flexDirection: 'column', height: '240px', minHeight: '400px', maxHeight: '420px', borderRadius: '16px' }}>
              
              {/* KOMPONEN LIVEKIT: PANGGILAN VIDEO DIPENDEKKAN & KEMAS (240px) */}
              <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                <LiveKitRoomView 
                  roomName="HuffazPro-Tasmik-Bilik-04" 
                  userName={`${studentName} (Pelajar)`} 
                  onDisconnect={() => setIsLiveCall(false)} 
                />
              </div>

            </div>
          )}

          <div className={styles.statusCard}>
            <div><h4 className={styles.statusTitle}>Maklumat Sesi</h4><p className={styles.statusText}>{pageMeta.surahName || 'Memuatkan...'}</p></div>
            <div className={styles.timeBadge}>
              <div className={isLiveCall ? styles.liveIndicator : ''} style={!isLiveCall ? {backgroundColor: '#94a3b8', width:8, height:8, borderRadius:'50%'} : {}}></div>
              {isLiveCall ? 'Sedang Langsung' : 'Bersedia'}
            </div>
          </div>
        </div>

        {/* BAHAGIAN KANAN: MUSHAF PREMIUM */}
        <div className={`${styles.quranCol} ${isDarkMode ? styles.themeDark : styles.themeLight}`}>
          <div className={styles.quranCard}>
            
            <div className={styles.quranHeader}>
              <div className={styles.quranNavLeft}>
                <div className={styles.iconBox}><BookOpen size={18} color={isDarkMode ? "#60a5fa" : "#0062ff"} /></div>
                <div>
                  <h3 className={styles.surahTitle}>{loading ? 'Memuatkan...' : `Surah ${pageMeta.surahName}`}</h3>
                  <p className={styles.surahSubtitle}>{loading ? '-' : `Juzuk ${pageMeta.juz} • Muka Surat ${currentPage}`}</p>
                </div>
              </div>
              <div className={styles.quranActions}>
                <button className={`${styles.iconBtn} ${selectedAyahId ? styles.speakerBtnActive : styles.speakerBtnDisabled} ${playingAudioId && !isLooping ? styles.speakerPlaying : ''}`} onClick={() => selectedAyahId && toggleNormalAudio(selectedAyahId)} disabled={!selectedAyahId || isLiveCall || isLooping} title="Audio Bacaan">
                  {playingAudioId && !isLooping ? <PauseCircle size={18} /> : <Volume2 size={18} />}
                </button>
                <div className={styles.separator}></div>
                <button className={`${styles.iconBtn} ${showTranslation ? styles.iconBtnActive : ''}`} onClick={() => setShowTranslation(!showTranslation)} disabled={isLiveCall} title="Terjemahan">
                  <Languages size={18} />
                </button>
                <div className={styles.separator}></div>
                <button className={styles.iconBtn} onClick={decreaseFont} disabled={isLiveCall}><Type size={14} /></button>
                <button className={styles.iconBtn} onClick={increaseFont} disabled={isLiveCall}><Type size={20} /></button>
                <div className={styles.separator}></div>
                <button className={styles.iconBtn} onClick={() => setIsDarkMode(!isDarkMode)}><Sun size={18} style={{display: isDarkMode ? 'block' : 'none'}} /><Moon size={18} style={{display: !isDarkMode ? 'block' : 'none'}} /></button>
                <div className={styles.separator}></div>
                <button className={styles.iconBtn}><Maximize2 size={18} /></button>
              </div>
            </div>

            <div className={styles.quranContentWrapper}>
              
              {partnerAlert && (
                <div className={styles.partnerBuzzOverlay}>
                  <div className={styles.buzzBox}>
                    <BellRing size={32} /> RAKAN MENEGUR BACAAN ANDA!
                  </div>
                </div>
              )}

              {isLiveCall && (
                <div className={styles.lockOverlay}>
                  <div className={styles.lockIconBox}><Lock size={32} /></div>
                  <h3 className={styles.lockTitle}>Mushaf Dikunci</h3>
                  <p className={styles.lockDesc}>Paparan Al-Quran disembunyikan semasa anda ditasmik oleh guru.</p>
                </div>
              )}

              {isSparingMasked && (
                <div className={styles.lockOverlay}>
                  <div className={styles.lockIconBox} style={{backgroundColor: '#0062ff'}}><EyeOff size={32} /></div>
                  <h3 className={styles.lockTitle}>Mod Ujian Sparing Aktif</h3>
                  <p className={styles.lockDesc}>
                    {sparingSubMode === 'roleplay' && 'Anda memegang peranan Penghafaz. Sila baca dari ingatan.'}
                    {sparingSubMode === 'relay' && 'Teks dikaburkan. Sambung ayat dari ingatan anda.'}
                    {sparingSubMode === 'challenge' && 'Giliran anda ditembak ayat oleh rakan!'}
                  </p>
                </div>
              )}

              <div className={isLiveCall ? styles.quranContentBlurred : ''} style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
                
                <div className={styles.quranFilterBar}>
                  <select className={styles.filterSelect} onChange={handleSurahChange} disabled={isLiveCall}>
                    <option value="">Pilih Surah...</option>
                    {surahsList.map((surah) => (<option key={surah.number} value={surah.number}>{surah.number}. {surah.englishName}</option>))}
                  </select>
                  <select className={styles.filterSelect} value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))} disabled={isLiveCall}>
                    {[...Array(604)].map((_, i) => (<option key={i + 1} value={i + 1}>Halaman {i + 1}</option>))}
                  </select>
                  <select className={styles.filterSelect} value={selectedAyahId || ""} onChange={(e) => setSelectedAyahId(Number(e.target.value))} disabled={isLiveCall}>
                    <option value="">Pilih Ayat</option>
                    {ayahs.map((ayah) => (<option key={ayah.number} value={ayah.number}>Ayat {ayah.numberInSurah}</option>))}
                  </select>
                  <button className={styles.searchBtn} disabled={isLiveCall}><Search size={16} /> Cari</button>
                </div>

                <div className={styles.quranBody}>
                  {loading ? (
                    <div className={styles.loaderContainer}><div className={styles.spinner}></div></div>
                  ) : (
                    <div className={showTranslation ? styles.modeVerseByVerse : styles.modeFlow}>
                      {ayahs.map((ayah) => {
                        let text = ayah.text;
                        let isBismillah = false;
                        const bismillahStr = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

                        // =========================================================================
                        // HUKUM BASMALLAH MUSHAF UTHMANI:
                        // 1. Surah Al-Fatihah (1): Basmallah ialah Ayat 1 (isBismillah = false, dibaca terus dengan ﴿1﴾).
                        // 2. Surah 2 hingga 114 (Kecuali Surah 9 At-Tawbah): Basmallah dipaparkan di kepala surah sahaja (isBismillah = true), dan teks Basmallah dibuang dari Ayat 1.
                        // 3. Surah 9 (At-Tawbah): Tiada Basmallah (isBismillah = false).
                        // =========================================================================
                        if (ayah.numberInSurah === 1 && ayah.surah.number !== 1 && ayah.surah.number !== 9) {
                          isBismillah = true;
                          const basmalahPattern = /^\s*ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ه[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*ح[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670\u0640]*ن[\u064B-\u065F\u0670]*\s*[ٱاإآ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*ح[\u064B-\u065F\u0670]*ي[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*/u;
                          text = text.replace(basmalahPattern, '').trim();
                        }

                        const dynamicArabicStyle = { fontSize: `${fontSizeBase}rem`, lineHeight: showTranslation ? 1.6 : (fontSizeBase * 1.25) };
                        const isSelected = selectedAyahId === ayah.number;
                        const isHiddenByBlindfold = trainingMode === 'tutup' && !revealedAyahs.includes(ayah.number);
                        const isLoopPlaying = isLooping && playingAudioId === ayah.number;

                        const renderClozeWords = (ayahText: string, aNum: number) => {
                          if (trainingMode !== 'kosong') return formatAyahTextNormal(ayahText);
                          const words = ayahText.split(' ');
                          return words.map((word, wIdx) => {
                            const isHidden = hiddenWordsMap[aNum]?.includes(wIdx) && !revealedWordsMap[aNum]?.includes(wIdx);
                            if (isHidden) {
                              return <span key={wIdx} className={styles.blankWord} onClick={() => revealClozeWord(aNum, wIdx)}>{word}</span>;
                            }
                            return <span key={wIdx}> {formatAyahTextNormal(word)} </span>;
                          });
                        };

                        if (showTranslation) {
                          return (
                            <div key={ayah.number} className={`${styles.verseBlock} ${isSelected ? styles.ayahSelected : ''} ${isLoopPlaying ? styles.ayahLooping : ''}`}>
                              {isBismillah && <div className={styles.bismillah} style={{fontSize: `${fontSizeBase + 0.2}rem`}}>{formatAyahTextNormal(bismillahStr)}</div>}
                              <div className={`${styles.verseTop} ${styles.ayahSpan} ${isHiddenByBlindfold ? styles.textHidden : ''}`} onClick={() => { if(!isLiveCall) { setSelectedAyahId(ayah.number); toggleRevealAyah(ayah.number); } }}>
                                <div className={styles.arabicText} style={dynamicArabicStyle}>
                                  {renderClozeWords(text, ayah.number)}
                                  <span className={styles.verseNumber}>﴿{toArabicNumeral(ayah.numberInSurah)}﴾</span>
                                </div>
                              </div>
                              <div className={styles.verseTranslation}>{ayah.numberInSurah}. {ayah.translation}</div>
                            </div>
                          );
                        }

                        return (
                          <React.Fragment key={ayah.number}>
                            {isBismillah && <div className={styles.bismillah} style={{fontSize: `${fontSizeBase + 0.2}rem`}}>{formatAyahTextNormal(bismillahStr)}</div>}
                            <span className={`${styles.ayahSpan} ${isSelected ? styles.ayahSelected : ''} ${isLoopPlaying ? styles.ayahLooping : ''} ${isHiddenByBlindfold ? styles.textHidden : ''}`} onClick={() => { if(!isLiveCall) { setSelectedAyahId(ayah.number); toggleRevealAyah(ayah.number); } }}>
                              <span className={styles.arabicText} style={dynamicArabicStyle}>{renderClozeWords(text, ayah.number)}</span>
                              <span className={styles.arabicText} style={dynamicArabicStyle}><span className={styles.verseNumber}>﴿{toArabicNumeral(ayah.numberInSurah)}﴾</span></span>
                            </span>
                            {' '}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={styles.quranFooter}>
                  <button className={`${styles.pageBtn} ${styles.btnOutline}`} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || isLiveCall}><ChevronLeft size={16} /> Muka Surat Sebelumnya</button>
                  <span style={{fontSize: '0.85rem', fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#94a3b8'}}>Hal. {currentPage} / 604</span>
                  <button className={`${styles.pageBtn} ${styles.btnPrimary}`} onClick={() => setCurrentPage(p => Math.min(604, p + 1))} disabled={currentPage === 604 || isLiveCall}>Muka Surat Seterusnya <ChevronRight size={16} /></button>
                </div>

              </div>
              
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
      `}</style>
    </DashboardLayout>
  );
}