'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { 
  BellRing, AlertTriangle, BookOpen, Clock, PlayCircle, 
  CheckCircle2, Circle, ArrowRight, MessageSquareWarning,
  CalendarDays, FileText, X, AlertCircle, MessageSquare,
  MapPin, Video, Trash2, CalendarX, Loader2, CalendarClock, Printer
} from 'lucide-react';
import styles from './NotifikasiMurajaah.module.css';

interface RecordedError {
  id: string;
  ayahNum: number;
  type: string;
  selectedText: string;
}

interface NotificationItem {
  id: string;
  type: 'teguran' | 'jadual' | 'info';
  teacher: string;
  time: string;
  title: string;
  message: string;
  surah: string;
  status: string;
  rawDateMs?: number;
  evalId?: string;
  errorRecords?: RecordedError[];
}

interface ChecklistItem {
  id: string;
  title: string;
  desc: string;
  isDone: boolean;
}

interface TimetableSlot {
  id: string;
  day: string;
  timeSlot: string;
  subject: string;
  room: string;
  mode: 'Fizikal' | 'Live' | 'Kendiri' | 'Rehat';
  teacher: string;
}

interface MasterItem {
  id: string;
  name: string;
}

interface JadualItem { 
  id: string; 
  tarikh: string; 
  masa: string; 
  rawMs: number; 
  jenis: string; 
  topik: string; 
  guru?: string; 
  kategori?: string;
}

interface NextSessionData {
  tarikh: string;
  masa: string;
  guru: string;
  jenis: string;
  topik: string;
  kategori?: string;
}

const ERROR_BADGES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  'Tajwid / Dengung': { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', label: 'Tajwid / Dengung' },
  'Kelancaran Sangkut': { bg: '#fffbeb', border: '#fde68a', color: '#b45309', label: 'Kelancaran Sangkut' },
  'Salah Baris': { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', label: 'Salah Baris' },
  'Makhraj Huruf': { bg: '#f5f3ff', border: '#ddd6fe', color: '#6d28d9', label: 'Makhraj Huruf' }
};

// Fungsi mengekstrak kalimah Arab dari pelbagai medan
function extractErrorsFromRecord(record: any): RecordedError[] {
  const possibleFields = [record.error_records, record.errorRecords, record.errors, record.ayat_errors, record.rekod_ralat];
  let rawList: any = null;
  for (const field of possibleFields) {
    if (field) { rawList = field; break; }
  }

  if (!rawList) {
    for (const key in record) {
      if (record[key] && typeof record[key] === 'string' && record[key].includes('[') && (record[key].includes('selectedText') || record[key].includes('kalimah') || record[key].includes('verseText') || record[key].includes('markedText'))) {
        rawList = record[key]; break;
      }
    }
  }

  if (!rawList) return [];
  let list: any[] = [];
  if (typeof rawList === 'string') {
    try { list = JSON.parse(rawList); } catch { return []; }
  } else if (Array.isArray(rawList)) { list = rawList; }

  if (!Array.isArray(list)) return [];
  return list.map((item: any, idx: number) => {
    const ayahNum = item.ayahNum ?? item.ayah ?? item.ayat ?? item.ayah_number ?? 1;
    const type = item.type ?? item.kategori ?? item.error_type ?? 'Ralat';
    const selectedText = item.selectedText ?? item.selected_text ?? item.verseText ?? item.verse_text ?? item.markedText ?? item.marked_text ?? item.kalimah ?? item.teks ?? item.lafaz ?? item.snippet ?? item.text ?? '';
    return { id: item.id || `err-${record.id}-${idx}`, ayahNum: Number(ayahNum) || 1, type: String(type), selectedText: String(selectedText) };
  }).filter(e => e.selectedText.trim() !== '');
}

function isSessionExpired(tarikhStr: string, masaStr: string, createdAt: string): boolean {
  const now = Date.now();
  if (tarikhStr === 'HARI INI' && (masaStr === 'SEKARANG' || !masaStr)) {
    const createdMs = new Date(createdAt).getTime();
    return (now - createdMs) > 30 * 60 * 1000;
  }
  try {
    const monthMap: Record<string, number> = { 'jan': 0, 'januari': 0, 'feb': 1, 'februari': 1, 'mac': 2, 'mar': 2, 'apr': 3, 'april': 3, 'mei': 4, 'may': 4, 'jun': 5, 'jul': 6, 'julai': 6, 'ogo': 7, 'ogos': 7, 'aug': 7, 'sep': 8, 'september': 8, 'okt': 9, 'oktober': 9, 'oct': 9, 'nov': 10, 'november': 10, 'dis': 11, 'disember': 11, 'dec': 11 };
    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let day = new Date().getDate();

    const cleanDate = tarikhStr.trim();
    if (cleanDate.includes('-')) {
      const parts = cleanDate.split('-'); year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]);
    } else if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/'); day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
    } else {
      const parts = cleanDate.split(' ');
      if (parts.length >= 2) {
        day = parseInt(parts[0]);
        const mKey = parts[1].toLowerCase();
        if (monthMap[mKey] !== undefined) month = monthMap[mKey];
        if (parts[2]) year = parseInt(parts[2]);
      }
    }

    let hours = 0; let minutes = 0;
    let cleanTime = masaStr.toUpperCase().replace('PTG', 'PM').replace('PG', 'AM').replace('MLM', 'PM');
    const isPM = cleanTime.includes('PM'); const isAM = cleanTime.includes('AM');
    const timeDigits = cleanTime.replace(/[^0-9:]/g, '').split(':');

    if (timeDigits.length >= 2) {
      hours = parseInt(timeDigits[0]); minutes = parseInt(timeDigits[1]);
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }

    const appointmentDate = new Date(year, month, day, hours, minutes);
    const sessionEndMs = appointmentDate.getTime() + 45 * 60 * 1000;
    return now > sessionEndMs;

  } catch (e) {
    const createdMs = new Date(createdAt).getTime();
    return (now - createdMs) > 12 * 60 * 60 * 1000;
  }
}

export default function NotifikasiMurajaahPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'semua' | 'teguran' | 'jadual' | 'mengulang'>('semua');
  
  const [studentName, setStudentName] = useState('Pelajar');
  const [studentId, setStudentId] = useState('');
  const [studentClassId, setStudentClassId] = useState('');

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [nextSession, setNextSession] = useState<NextSessionData | null>(null);

  const [timetableData, setTimetableData] = useState<TimetableSlot[]>([]);
  const [timeSlotsList, setTimeSlotsList] = useState<MasterItem[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<JadualItem | null>(null);
  const DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

  useEffect(() => {
    setMounted(true);

    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;
        
        const sId = authData.user.id;
        setStudentId(sId);

        const { data: profile } = await supabase.from('profiles').select('full_name, class_id').eq('id', sId).single();
        if (profile) {
          setStudentName(profile.full_name || 'Pelajar');
          setStudentClassId(profile.class_id || '');
        }

        const hiddenStr = localStorage.getItem('huffazpro_hidden_notifs');
        const hiddenNotifs: string[] = hiddenStr ? JSON.parse(hiddenStr) : [];

        const dynamicNotifs: NotificationItem[] = [];
        let combinedChecklist: ChecklistItem[] = [];

        // 1. Tarik rekod penilaian murid
        const { data: evals } = await supabase.from('evaluations').select('*').eq('student_id', sId).order('created_at', { ascending: false });

        // 2. Tarik notifikasi belum dibaca
        const { data: notifData } = await supabase.from('notifications').select('*').eq('user_id', sId).eq('is_read', false).order('created_at', { ascending: false });

        let adhocSession: NextSessionData | null = null; 
        const processedNotifIds = new Set<string>();

        if (evals && evals.length > 0) {
          evals.forEach(record => {
            if (hiddenNotifs.includes(`eval-${record.id}`)) return;

            const evalTimeMs = new Date(record.created_at).getTime();
            const timeStr = new Date(record.created_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
            const dateStr = new Date(record.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
            
            const formattedErrors = extractErrorsFromRecord(record);

            let matchedNotif: any = null;
            let minDiff = Infinity;

            if (notifData) {
              notifData.forEach(n => {
                const isRelevant = n.type === 'teguran' || n.type === 'info' || (n.title && n.title.toLowerCase().includes('gred'));
                if (!processedNotifIds.has(n.id) && isRelevant) {
                  const diff = Math.abs(new Date(n.created_at).getTime() - evalTimeMs);
                  if (diff < 86400000 && diff < minDiff) { 
                    minDiff = diff;
                    matchedNotif = n;
                  }
                }
              });
            }

            // PEMBETULAN PENJANAAN ID: Menambah parameter errIndex bagi mengelakkan kunci penduaan (duplicate keys)
            if (formattedErrors.length > 0 && !record.gred?.includes('Mumtaz')) {
              formattedErrors.forEach((err, errIndex) => {
                combinedChecklist.push({
                  id: `chk-${record.id}-${err.ayahNum}-${errIndex}`, // <-- ID Unik dijamin di sini
                  title: `Baiki Bacaan ${record.surah} (Ayat ${err.ayahNum})`,
                  desc: `Fokus Ralat: ${err.type}`,
                  isDone: false
                });
              });
            }

            if (matchedNotif) {
              if (hiddenNotifs.includes(matchedNotif.id)) { processedNotifIds.add(matchedNotif.id); return; }
              processedNotifIds.add(matchedNotif.id);
              dynamicNotifs.push({
                id: matchedNotif.id, type: 'teguran', teacher: `${record.teacher_name || 'Guru'} (${record.type || 'Tasmik'})`,
                time: dateStr + ' ' + timeStr, title: matchedNotif.title || `Keputusan Tasmik: Gred ${record.gred}`,
                message: matchedNotif.message || record.catatan || '', surah: `Semakan: ${record.surah || 'Al-Quran'}`,
                status: 'Belum Dibaca', errorRecords: formattedErrors, rawDateMs: evalTimeMs, evalId: record.id
              });
            } else {
              dynamicNotifs.push({
                id: `eval-${record.id}`, type: 'teguran', teacher: `${record.teacher_name || 'Guru'} (${record.type || 'Tasmik'})`,
                time: dateStr + ' ' + timeStr, title: `Keputusan Tasmik: Gred ${record.gred}`,
                message: record.catatan ? `"${record.catatan}"` : 'Bacaan selesai direkodkan.', surah: `Semakan: ${record.surah || 'Al-Quran'}`,
                status: record.gred?.includes('Jayyid') || record.gred?.includes('Mumtaz') ? 'Selesai' : 'Perlu Ulang Kaji',
                errorRecords: formattedErrors, rawDateMs: evalTimeMs, evalId: record.id
              });
            }
          });
        }

        // 3. Imbas notifikasi ad-hoc
        if (notifData) {
          notifData.forEach(n => {
            if (processedNotifIds.has(n.id) || hiddenNotifs.includes(n.id)) return; 
            const isAdhocJadual = n.type === 'jadual_adhoc' || (n.title && (n.title.includes('Ad-Hoc') || n.title.includes('Ulangan') || n.title.includes('Tasmik Segera')));

            if (isAdhocJadual) {
              let parsedPayload: any = null;
              if (n.message && n.message.trim().startsWith('{')) { try { parsedPayload = JSON.parse(n.message); } catch {} }

              const isOnline = parsedPayload?.jenis === 'online' || (n.message && n.message.toLowerCase().includes('online'));
              const rawDate = parsedPayload?.tarikh || (n.created_at ? new Date(n.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' }) : 'HARI INI');
              const rawTime = parsedPayload?.masa || 'SEKARANG';
              const sessionTopic = parsedPayload?.topik || n.title || 'Sesi Ulangan Khas';
              const sessionCategory = parsedPayload?.kategori || (n.title && n.title.toLowerCase().includes('murajaah') ? 'ulangan' : 'tasmik');
              const teacherName = parsedPayload?.guru || 'Guru Pentasmik';

              const isExpired = isSessionExpired(rawDate, rawTime, n.created_at);

              dynamicNotifs.push({
                id: n.id, type: 'jadual', teacher: teacherName, time: rawDate + ' ' + rawTime,
                title: n.title, message: parsedPayload?.catatan || n.message,
                surah: sessionCategory === 'ulangan' ? 'Murajaah Ulangan' : 'Tasmik Ulangan',
                status: isExpired ? 'Tamat Tempoh' : 'Sesi Ad-Hoc', rawDateMs: new Date(n.created_at).getTime()
              });

              if (!adhocSession && !isExpired) {
                adhocSession = { tarikh: rawDate, masa: rawTime, guru: teacherName, jenis: isOnline ? 'online' : 'fizikal', topik: sessionTopic, kategori: sessionCategory === 'ulangan' ? 'ulangan' : 'tasmik' };
              }
            } else if (n.type === 'teguran' || n.type === 'info') {
              dynamicNotifs.push({
                id: n.id, type: n.type, teacher: 'Pentadbiran', time: new Date(n.created_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
                title: n.title || 'Mesej', message: n.message || '', surah: 'Mesej Sistem', status: 'Belum Dibaca', rawDateMs: new Date(n.created_at).getTime()
              });
            }
          });
        }

        // 4. Tarik data jadual waktu berasaskan Matriks
        const { data: timeData } = await supabase.from('time_slots').select('id, name').order('created_at', { ascending: true });
        if (timeData && timeData.length > 0) setTimeSlotsList(timeData);
        else {
          setTimeSlotsList([{ id: '1', name: '08:00 AM - 10:00 AM' }, { id: '2', name: '10:00 AM - 10:30 AM (Rehat)' }, { id: '3', name: '10:30 AM - 12:30 PM' }, { id: '4', name: '02:00 PM - 04:00 PM' }]);
        }

        if (profile?.class_id) {
          const { data: schedule } = await supabase.from('timetable').select('*').eq('class_id', profile.class_id);
          if (schedule) {
            setTimetableData(schedule.map(j => ({
              id: j.id, day: j.day, timeSlot: j.time_slot, subject: j.subject, room: j.room_name || '-', mode: j.mode, teacher: j.teacher_name
            })));
          }
        }

        setNextSession(adhocSession);

        const finalNotifs = dynamicNotifs.filter(n => !hiddenNotifs.includes(n.id));
        setNotifications(finalNotifs.sort((a, b) => (b.rawDateMs || 0) - (a.rawDateMs || 0)));
        
        const savedStudentChecklist = localStorage.getItem('huffazpro_student_checklist');
        if (savedStudentChecklist) {
          try {
            const studentItems = JSON.parse(savedStudentChecklist);
            studentItems.forEach((st: ChecklistItem) => { if (!combinedChecklist.some(c => c.id === st.id)) combinedChecklist.push(st); });
          } catch {}
        }
        
        // Memastikan tiada kunci pendua yang datang dari data localStorage yang korup
        const uniqueChecklist = Array.from(new Map(combinedChecklist.map(item => [item.id, item])).values());
        setChecklist(uniqueChecklist);

      } catch (error) {
        console.error("Gagal menarik data notifikasi:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleDismissNotif = async (idToRemove: string, evalId?: string) => {
    try {
      const hiddenStr = localStorage.getItem('huffazpro_hidden_notifs');
      const hiddenArr: string[] = hiddenStr ? JSON.parse(hiddenStr) : [];
      if (!hiddenArr.includes(idToRemove)) hiddenArr.push(idToRemove);
      if (evalId && !hiddenArr.includes(`eval-${evalId}`)) hiddenArr.push(`eval-${evalId}`);
      localStorage.setItem('huffazpro_hidden_notifs', JSON.stringify(hiddenArr));

      if (!idToRemove.includes('sys-schedule') && !idToRemove.includes('eval-')) {
        await supabase.from('notifications').update({ is_read: true }).eq('id', idToRemove);
      }
      setNotifications(prev => prev.filter(n => n.id !== idToRemove));
    } catch (error) { console.error("Gagal memadam notifikasi:", error); }
  };

  const toggleChecklist = (id: string) => {
    const updated = checklist.map(item => item.id === id ? { ...item, isDone: !item.isDone } : item);
    setChecklist(updated);
    localStorage.setItem('huffazpro_student_checklist', JSON.stringify(updated));
  };

  const deleteChecklistItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = checklist.filter(item => item.id !== id);
    setChecklist(updated);
    localStorage.setItem('huffazpro_student_checklist', JSON.stringify(updated));
  };

  const filteredNotifs = notifications.filter(notif => {
    if (activeFilter === 'semua') return true;
    if (activeFilter === 'teguran') return notif.type === 'teguran';
    return true;
  });

  const doneCount = checklist.filter(c => c.isDone).length;
  const totalCount = checklist.length;

  const getSlot = (day: string, time: string) => {
    return timetableData.find(t => t.day === day && t.timeSlot === time);
  };

  const renderTimetableMatrix = () => (
    <div className="printable-timetable" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarDays size={18} color="#0062ff"/> Jadual Waktu Kelas
        </h3>
        
        {/* BUTANG CETAK JADUAL */}
        <button 
          onClick={() => window.print()}
          className="no-print"
          style={{ background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Printer size={16} /> Cetak Jadual
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '800px' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#fff' }}>
              <th style={{ padding: '1rem', width: '100px', borderRight: '1px solid #334155' }}>HARI \ MASA</th>
              {timeSlotsList.map(time => (
                <th key={time.id} style={{ padding: '1rem', borderRight: '1px solid #334155', fontSize: '0.85rem', fontWeight: 700 }}>{time.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '1rem', fontWeight: 800, background: '#f8fafc', borderRight: '1px solid #e2e8f0', color: '#0f172a' }}>{day}</td>
                {timeSlotsList.map(time => {
                  const slot = getSlot(day, time.name);
                  return (
                    <td key={`${day}-${time.id}`} style={{ padding: '0.5rem', borderRight: '1px solid #e2e8f0', verticalAlign: 'top', height: '110px' }}>
                      {slot ? (
                        <div 
                          onClick={() => setSelectedCalendarEvent({
                            id: slot.id, tarikh: day, masa: slot.timeSlot, rawMs: 0,
                            jenis: slot.mode === 'Live' ? 'online' : 'fizikal',
                            topik: slot.subject, guru: slot.teacher, kategori: 'tasmik'
                          })}
                          style={{ 
                            background: slot.mode === 'Rehat' ? '#f1f5f9' : slot.mode === 'Live' ? '#eff6ff' : '#ecfdf5', 
                            border: `1px solid ${slot.mode === 'Rehat' ? '#cbd5e1' : slot.mode === 'Live' ? '#bfdbfe' : '#a7f3d0'}`, 
                            borderRadius: '8px', padding: '0.75rem', height: '100%', display: 'flex', flexDirection: 'column', 
                            justifyContent: 'center', position: 'relative', cursor: 'pointer', transition: 'transform 0.1s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          title="Klik untuk perincian"
                        >
                          {slot.mode !== 'Rehat' && (
                            <span style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '0.65rem', background: slot.mode === 'Live' ? '#dbeafe' : '#dcfce7', color: slot.mode === 'Live' ? '#1e40af' : '#166534', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{slot.mode}</span>
                          )}
                          <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', color: slot.mode === 'Rehat' ? '#64748b' : '#0f172a', fontWeight: 800 }}>{slot.subject}</h4>
                          
                          {slot.mode !== 'Rehat' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                              <p style={{ margin: 0, fontSize: '0.7rem', color: '#1e293b', fontWeight: 600 }}>{slot.teacher}</p>
                              <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <MapPin size={10} /> {slot.room !== '-' ? slot.room : 'Tiada Bilik'}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '0.75rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>Kosong</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

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
      <div className={styles.container}>
        
        <div className={`no-print ${styles.headerBox || ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', background: '#fff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div className={styles.titleWrap}>
            <h1 className={styles.mainTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.25rem 0', fontSize: '1.25rem' }}>
              <BellRing size={24} color="#0062ff" /> Notifikasi & Peringatan Murajaah
            </h1>
            <p className={styles.subtitle} style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Semak rekod teguran guru pentasmik, peringatan ayat lemah, dan jadual ulang kaji harian anda.
            </p>
          </div>
          
          <div className={styles.alertBadge} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', color: '#dc2626', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem' }}>
            <AlertTriangle size={16} />
            <span>{notifications.length} Teguran & {timetableData.length} Kelas</span>
          </div>
        </div>

        <div className={`no-print ${styles.filterScroll || ''}`} style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
          <button 
            type="button"
            className={`${styles.filterBtn} ${activeFilter === 'semua' ? styles.filterBtnActive : ''}`}
            onClick={() => setActiveFilter('semua')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '20px', border: activeFilter === 'semua' ? 'none' : '1px solid #cbd5e1', background: activeFilter === 'semua' ? '#0062ff' : '#fff', color: activeFilter === 'semua' ? '#fff' : '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Semua Notifikasi <span style={{ background: activeFilter === 'semua' ? '#fff' : '#f1f5f9', color: activeFilter === 'semua' ? '#0062ff' : '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>{notifications.length}</span>
          </button>
          <button 
            type="button"
            className={`${styles.filterBtn} ${activeFilter === 'teguran' ? styles.filterBtnActive : ''}`}
            onClick={() => setActiveFilter('teguran')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '20px', border: activeFilter === 'teguran' ? 'none' : '1px solid #cbd5e1', background: activeFilter === 'teguran' ? '#0062ff' : '#fff', color: activeFilter === 'teguran' ? '#fff' : '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <MessageSquareWarning size={14} /> Teguran Guru <span style={{ background: activeFilter === 'teguran' ? '#fff' : '#f1f5f9', color: activeFilter === 'teguran' ? '#0062ff' : '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>{notifications.filter(n => n.type === 'teguran').length}</span>
          </button>
          <button 
            type="button" 
            className={`${styles.filterBtn} ${activeFilter === 'jadual' ? styles.filterBtnActive : ''}`}
            onClick={() => setActiveFilter('jadual')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '20px', border: activeFilter === 'jadual' ? 'none' : '1px solid #cbd5e1', background: activeFilter === 'jadual' ? '#0062ff' : '#fff', color: activeFilter === 'jadual' ? '#fff' : '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <CalendarDays size={14} /> Jadual Waktu <span style={{ background: activeFilter === 'jadual' ? '#fff' : '#f1f5f9', color: activeFilter === 'jadual' ? '#0062ff' : '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>{timetableData.length}</span>
          </button>
          <button 
            type="button"
            className={`${styles.filterBtn} ${activeFilter === 'mengulang' ? styles.filterBtnActive : ''}`}
            onClick={() => setActiveFilter('mengulang')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '20px', border: activeFilter === 'mengulang' ? 'none' : '1px solid #cbd5e1', background: activeFilter === 'mengulang' ? '#0062ff' : '#fff', color: activeFilter === 'mengulang' ? '#fff' : '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <BookOpen size={14} /> Jadual Mengulang <span style={{ background: activeFilter === 'mengulang' ? '#fff' : '#f1f5f9', color: activeFilter === 'mengulang' ? '#0062ff' : '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem' }}>{totalCount}</span>
          </button>
        </div>

        {/* REKA LETAK GRID: SIDEBAR DI KANAN, KANDUNGAN DI KIRI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }} className={styles.mainGrid}>
          
          <div className={styles.feedContainer} style={{ minWidth: 0 }}>
            
            {activeFilter === 'jadual' && renderTimetableMatrix()}

            {activeFilter !== 'jadual' && timetableData.length > 0 && (
              <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} className="no-print">
                <div style={{ padding: '0.9rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CalendarDays size={18} color="#0062ff" />
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>Jadual Tasmik Berkala</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setActiveFilter('jadual')} 
                    style={{ background: 'none', border: 'none', color: '#0062ff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Buka Kalendar Penuh <ArrowRight size={14} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', padding: '1rem' }}>
                  {timetableData.slice(0, 3).map((j) => (
                    <div 
                      key={j.id} 
                      onClick={() => setSelectedCalendarEvent({ id: j.id, tarikh: j.day, masa: j.timeSlot, rawMs: 0, jenis: j.mode === 'Live' ? 'online' : 'fizikal', topik: j.subject, guru: j.teacher, kategori: 'tasmik' })}
                      style={{ 
                        padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', 
                        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.3rem', transition: 'transform 0.1s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{j.day}</span>
                        <span style={{ padding: '0.15rem 0.45rem', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 700, background: '#dcfce7', color: '#166534' }}>Tasmik</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#0062ff', fontWeight: 700 }}>{j.timeSlot}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.subject}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeFilter !== 'jadual' && (
              <div className="no-print">
                {filteredNotifs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: '#64748b', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 1rem auto', display: 'block', opacity: 0.5 }} />
                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#334155' }}>Semua Selesai!</h3>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>Tiada notifikasi baharu untuk kategori ini.</p>
                  </div>
                ) : (
                  filteredNotifs.map((notif) => (
                    <div key={notif.id} className={styles.notifCard} style={{ borderLeft: notif.type === 'jadual' ? '4px solid #7c3aed' : 'none', background: notif.status === 'Sesi Ad-Hoc' ? '#faf5ff' : '#fff' }}>
                      
                      <div className={styles.notifHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={styles.teacherName}>
                            <FileText size={14} color="#64748b" /> {notif.teacher}
                          </span>
                          <span className={styles.notifTime} style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '0.5rem' }}>{notif.time}</span>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => handleDismissNotif(notif.id, notif.evalId)}
                          style={{ background: '#f1f5f9', border: 'none', color: '#94a3b8', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                          title="Padam / Tanda Telah Dibaca"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      
                      <div className={styles.notifBody}>
                        <h3 className={styles.notifTitle} style={{ color: notif.status === 'Sesi Ad-Hoc' ? '#7c3aed' : notif.type === 'jadual' ? '#6d28d9' : '#1e293b' }}>{notif.title}</h3>
                        <p className={styles.notifMessage}>{notif.message}</p>
                        
                        <div className={styles.tagGroup} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span className={styles.surahTag}><CheckCircle2 size={12} /> {notif.surah}</span>
                          {notif.errorRecords && notif.errorRecords.length > 0 && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.2rem 0.5rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={12} /> {notif.errorRecords.length} Ralat Ditanda Guru
                            </span>
                          )}
                        </div>
                      </div>

                      {notif.type !== 'jadual' && (
                        <div className={styles.notifFooter}>
                          <span className={styles.statusText}>Status: {notif.status}</span>
                          <button 
                            type="button" 
                            onClick={() => setSelectedNotif(notif)}
                            className={styles.actionLink}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            Lihat Ayat & Ralat <ArrowRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR KANAN (Temujanji Khas & Checklist) */}
          <div className={`${styles.rightSidebar} no-print`} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '340px' }}>
            
            {nextSession ? (
              <div 
                className={styles.nextSessionCard} 
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', boxShadow: '0 10px 25px -5px rgba(124, 58, 237, 0.35)', borderRadius: '16px', padding: '1.5rem', color: '#ffffff' }}
              >
                <div className={styles.sessionHeader} style={{ color: '#e9d5ff' }}>
                  {nextSession.kategori === 'ulangan' ? 'Jadual Ulangan Khas' : 'Sesi Seterusnya'} 
                  <span style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>{nextSession.tarikh}</span>
                </div>
                <h2 className={styles.sessionTime} style={{ color: '#ffffff' }}>{nextSession.masa}</h2>
                <p className={styles.sessionTeacher} style={{ color: '#f3e8ff' }}>
                  Bersama {nextSession.guru} {nextSession.jenis === 'online' ? '(Bilik Live #04)' : '(Halaqah Kelas)'}
                </p>

                {nextSession.topik && (
                  <div style={{ fontSize: '0.75rem', color: '#ffffff', background: 'rgba(0,0,0,0.25)', padding: '0.4rem 0.75rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
                    Sasaran: <strong>{nextSession.topik}</strong>
                  </div>
                )}
                
                {nextSession.jenis === 'online' ? (
                  <Link href="/pelajar/tasmik-live" style={{ textDecoration: 'none' }}>
                    <button type="button" className={styles.btnLive} style={{ color: '#6d28d9', fontWeight: 800, width: '100%', padding: '0.8rem', borderRadius: '8px', border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <PlayCircle size={18} /> Masuk Bilik Tasmik Sekarang
                    </button>
                  </Link>
                ) : (
                  <button type="button" className={styles.btnLive} style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', cursor: 'default', width: '100%', padding: '0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800 }}>
                    <MapPin size={18} /> Sesi Bersemuka di Kelas
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.nextSessionCard} style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CalendarClock size={13} color="#7c3aed" /> TEMUJANJI KHAS
                  </span>
                  <span style={{ fontSize: '0.72rem', background: '#ede9fe', color: '#6d28d9', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>Belum Ditetapkan</span>
                </div>
                
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#ede9fe', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}><CalendarX size={26} /></div>
                  <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: 800, color: '#4c1d95' }}>Tiada Temujanji Khas</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6d28d9', lineHeight: 1.5, fontWeight: 600 }}>Tarikh dan masa temujanji Khas belum ditetapkan oleh guru tasmik anda</p>
                </div>
              </div>
            )}

            <div className={styles.checklistCard} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div className={styles.checkHeader} style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <h3 className={styles.checkTitle} style={{ margin: 0, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={18} color="#0062ff" /> Sasaran Mengulang Hari Ini</h3>
                <span className={styles.checkProgress} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669' }}>{doneCount}/{totalCount} Selesai</span>
              </div>

              <div className={styles.checkList} style={{ maxHeight: '400px', overflowY: 'auto', padding: '1rem' }}>
                {checklist.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
                    <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 0.75rem auto', opacity: 0.6 }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>Tiada Tugasan Mengulang Hari Ini</p>
                    <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Anda telah menyelesaikan atau memadam semua sasaran.</p>
                  </div>
                ) : (
                  checklist.map((item) => (
                    <div 
                      key={item.id} 
                      className={`${styles.checkItem} ${item.isDone ? styles.checkItemDone : ''}`}
                      onClick={() => toggleChecklist(item.id)}
                      style={{ cursor: 'pointer', transition: 'all 0.2s ease', opacity: item.isDone ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px', background: item.isDone ? '#f8fafc' : '#ffffff' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {item.isDone ? <CheckCircle2 size={22} color="#10b981" /> : <Circle size={22} color="#94a3b8" />}
                        <div className={styles.checkTextWrap}>
                          <p className={styles.checkItemTitle} style={{ color: item.isDone ? '#94a3b8' : '#1e293b', textDecoration: item.isDone ? 'line-through' : 'none', margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</p>
                          <p className={styles.checkItemDesc} style={{ color: item.isDone ? '#cbd5e1' : '#64748b', textDecoration: item.isDone ? 'line-through' : 'none', margin: 0, fontSize: '0.75rem' }}>{item.desc}</p>
                        </div>
                      </div>

                      {item.isDone && (
                        <button onClick={(e) => deleteChecklistItem(item.id, e)} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Trash2 size={14} /> Padam
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {selectedCalendarEvent && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Perincian Sesi Tasmik</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Jadual Berkala Guru</span>
              </div>
              <button type="button" onClick={() => setSelectedCalendarEvent(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Hari / Tarikh Sesi</span>
                  <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>{selectedCalendarEvent.tarikh}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Waktu / Jam</span>
                  <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, color: '#0062ff', fontSize: '1rem' }}>{selectedCalendarEvent.masa}</p>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Kategori & Topik Sesi</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, color: '#1e293b' }}>
                  {selectedCalendarEvent.kategori === 'segera' ? '🔵 Tasmik Segera' : selectedCalendarEvent.kategori === 'ulangan' ? '🟣 Ulangan (Murajaah)' : '🟢 Tasmik (Hafazan Baru)'}
                </p>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>{selectedCalendarEvent.topik}</p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Mod Pertemuan</span>
                <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, color: selectedCalendarEvent.jenis === 'online' ? '#0062ff' : '#059669' }}>
                  {selectedCalendarEvent.jenis === 'online' ? '📹 Online (Bilik Tasmik Live)' : '📍 Bersemuka (Halaqah Kelas)'}
                </p>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => setSelectedCalendarEvent(null)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Tutup</button>
              {selectedCalendarEvent.jenis === 'online' && (
                <Link href="/pelajar/tasmik-live" style={{ textDecoration: 'none' }}>
                  <button type="button" style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none', background: '#0062ff', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <PlayCircle size={16} /> Masuk Bilik Live
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedNotif && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Perincian Teguran & Rekod Ralat</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedNotif.surah}</span>
              </div>
              <button type="button" onClick={() => setSelectedNotif(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}><X size={18} /></button>
            </div>
            
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Pentasmik</span>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{selectedNotif.teacher}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Keputusan</span>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#059669' }}>{selectedNotif.status}</p>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={14} color="#0062ff" /> Ulasan Tambahan Guru:
                </span>
                <div style={{ marginTop: '0.4rem', padding: '1rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.9rem', color: '#1e40af', lineHeight: 1.5, fontStyle: 'italic' }}>
                  {selectedNotif.message || "Tiada ulasan tambahan."}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} color="#ef4444" /> Kalimah & Ralat Untuk Dibaiki ({selectedNotif.errorRecords?.length || 0}):
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Fokus Murajaah</span>
                </div>

                {selectedNotif.errorRecords && selectedNotif.errorRecords.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {selectedNotif.errorRecords.map((err, index) => {
                      const badgeTheme = ERROR_BADGES[err.type] || { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', label: err.type };
                      return (
                        <div key={err.id || index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: '8px', background: badgeTheme.bg, border: `1px solid ${badgeTheme.border}` }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: badgeTheme.color }}>Ayat {err.ayahNum}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#fff', color: badgeTheme.color, border: `1px solid ${badgeTheme.border}` }}>{err.type}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Perlu semakan semula</span>
                          </div>
                          <div style={{ fontFamily: '"Amiri Quran", "Traditional Arabic", serif', fontSize: '1.35rem', color: '#0f172a', direction: 'rtl', textAlign: 'right', fontWeight: 600 }}>
                            {err.selectedText}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.25rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.85rem' }}>
                    Tiada ralat khusus ditanda pada teks mushaf. Bacaan lancar!
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={() => { handleDismissNotif(selectedNotif.id, selectedNotif.evalId); setSelectedNotif(null); }}
                style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Tanda Selesai & Padam
              </button>
              <button type="button" onClick={() => setSelectedNotif(null)} style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}
      
      {/* GLOBAL STYLES UNTUK CETAKAN JADUAL */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .printable-timetable, .printable-timetable * { visibility: visible; }
          .printable-timetable { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}