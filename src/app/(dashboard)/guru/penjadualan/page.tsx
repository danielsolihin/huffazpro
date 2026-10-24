'use client';

import React, { useState, useEffect } from 'react';
import DashboardGuruLayout from '@/components/dashboard/DashboardGuruLayout';
import { supabase } from '@/lib/supabase';
import { 
  CalendarDays, User, Clock, Video, MapPin, 
  CheckCircle2, Plus, Trash2, Send, Loader2, Sparkles
} from 'lucide-react';

interface StudentProfile {
  id: string;
  full_name: string;
  matrik_or_id?: string;
  class_id?: string;
}

interface SesiSlot {
  tarikh: string;
  masa: string;
}

export default function GuruPenjadualanAdhocPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // DATA GURU
  const [teacherId, setTeacherId] = useState('');
  const [teacherName, setTeacherName] = useState('Guru Pentasmik');

  // SENARAI PELAJAR
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // KATEGORI SESI
  const [sessionCategory, setSessionCategory] = useState<'Tasmik Ulangan' | 'Murajaah Ulangan'>('Tasmik Ulangan');
  const [topic, setTopic] = useState('Ulangan Semakan Hafazan (Ayat Lemah)');
  const [meetingMode, setMeetingMode] = useState<'online' | 'fizikal'>('online');

  // PILIHAN TARIKH & MASA
  const [sessionSlots, setSessionSlots] = useState<SesiSlot[]>([
    { tarikh: '', masa: '' }
  ]);

  useEffect(() => {
    setMounted(true);

    const initData = async () => {
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

        // Fungsi pembersihan gelaran nama (Ustaz, Cikgu, dll)
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

        // Kumpulkan ID dan nama kelas seliaan guru ini daripada jadual 'classes'
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
        const { data: pelajarList } = await supabase
          .from('profiles')
          .select('*')
          .ilike('role', '%elajar%')
          .order('full_name', { ascending: true });

        // PENAPISAN KETAT: HANYA pelajar di bawah kelas seliaan guru ini
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
        }).map(p => ({
          id: p.id,
          full_name: p.full_name,
          matrik_or_id: p.matrik_or_id,
          class_id: p.class_id
        }));

        if (filteredPelajar.length > 0) {
          setStudents(filteredPelajar);
          setSelectedStudentId(filteredPelajar[0].id);
        } else {
          setStudents([]);
          setSelectedStudentId('');
        }
      } catch (err) {
        console.error("Gagal menarik senarai pelajar:", err);
      }
    };

    initData();
  }, []);

  const handleAddSlot = () => {
    setSessionSlots(prev => [...prev, { tarikh: '', masa: '' }]);
  };

  const handleRemoveSlot = (index: number) => {
    if (sessionSlots.length <= 1) return;
    setSessionSlots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSlotChange = (index: number, field: 'tarikh' | 'masa', val: string) => {
    setSessionSlots(prev => {
      const copy = [...prev];
      copy[index][field] = val;
      return copy;
    });
  };

  // Fungsi Parser Masa Untuk Pengiraan Pertembungan (Tukar Waktu Kepada Minit)
  const parseStrMasaKeMinit = (str: string) => {
    let clean = str.trim().toUpperCase().replace(/PTG|TGH|MLM|MALAM|PETANG/g, 'PM').replace(/PAGI|PG/g, 'AM');
    let timeMatch = clean.match(/(\d{1,2}):(\d{2})/);
    let ampmMatch = clean.match(/(AM|PM)/);
    
    if (timeMatch) {
       let hour = parseInt(timeMatch[1]);
       let min = parseInt(timeMatch[2]);
       if (ampmMatch && ampmMatch[1] === 'PM' && hour < 12) hour += 12;
       if (ampmMatch && ampmMatch[1] === 'AM' && hour === 12) hour = 0;
       return hour * 60 + min;
    }
    return 0;
  };

  const handleSubmitAdhocSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert("Sila pilih nama pelajar.");
      return;
    }

    const validSlots = sessionSlots.filter(s => s.tarikh && s.masa);
    if (validSlots.length === 0) {
      alert("Sila lengkapkan sekurang-kurangnya satu tarikh dan masa sesi.");
      return;
    }

    setIsLoading(true);
    try {
      const studentObj = students.find(s => s.id === selectedStudentId);
      const studentName = studentObj?.full_name || 'Pelajar';

      // =========================================================================
      // ENJIN SEMAKAN SILANG (CROSS-VALIDATION ENGINE)
      // =========================================================================
      const { data: allTimetable } = await supabase.from('timetable').select('*');
      const ttData = allTimetable || [];

      if (ttData.length > 0) {
        for (const slot of validSlots) {
          const [year, month, dateDay] = slot.tarikh.split('-');
          const dObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(dateDay));
          const daysArr = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
          const dayName = daysArr[dObj.getDay()]; 
          
          const [h, m] = slot.masa.split(':');
          const adhocStartMins = parseInt(h) * 60 + parseInt(m);
          const adhocEndMins = adhocStartMins + 60;
          
          const clash = ttData.find(t => {
            if (t.day !== dayName) return false;
            
            const isStudentClass = studentObj?.class_id && String(t.class_id) === String(studentObj.class_id);
            const isTeacherClass = String(t.teacher_name).trim().toLowerCase() === String(teacherName).trim().toLowerCase() || t.teacher_id === teacherId;

            if (!isStudentClass && !isTeacherClass) return false;
            
            let startMins = 0, endMins = 0;
            const parts = t.time_slot.split('-'); 
            
            if (parts.length >= 2) {
               startMins = parseStrMasaKeMinit(parts[0]);
               endMins = parseStrMasaKeMinit(parts[1]);
            } else {
               startMins = parseStrMasaKeMinit(t.time_slot);
               endMins = startMins + 60;
            }
               
            return (adhocStartMins < endMins) && (adhocEndMins > startMins);
          });
          
          if (clash) {
            const isMyClash = (String(clash.teacher_name).trim().toLowerCase() === String(teacherName).trim().toLowerCase() || clash.teacher_id === teacherId);
            const clashReason = isMyClash 
              ? `Anda (Guru) sedang mempunyai jadual mengajar subjek ${clash.subject}`
              : `Pelajar ${studentName} sudah mempunyai kelas rasmi (${clash.subject})`;

            alert(`❌ PERTEMBUNGAN JADUAL DIKESAN!\n\n${clashReason} pada hari ${dayName}, jam ${clash.time_slot}.\n\nSistem telah menyekat penetapan ini. Sila pilih waktu yang berbeza.`);
            setIsLoading(false);
            return;
          }
        }
      }

      // Simpan jika lulus semakan
      for (const slot of validSlots) {
        const dObj = new Date(slot.tarikh);
        const formattedDate = !isNaN(dObj.getTime())
          ? dObj.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
          : slot.tarikh;

        let formattedTime = slot.masa;
        if (slot.masa.includes(':')) {
          const [h, m] = slot.masa.split(':');
          const hour = parseInt(h);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const hour12 = hour % 12 || 12;
          formattedTime = `${String(hour12).padStart(2, '0')}:${m} ${ampm}`;
        }

        await supabase.from('notifications').insert([{
          user_id: selectedStudentId,
          sender_id: teacherId,
          type: 'jadual_adhoc',
          title: `Jadual ${sessionCategory} (Ad-Hoc)`,
          message: JSON.stringify({
            tarikh: formattedDate,
            masa: formattedTime,
            guru: teacherName,
            jenis: meetingMode,
            topik: topic,
            kategori: sessionCategory === 'Murajaah Ulangan' ? 'ulangan' : 'tasmik',
            catatan: `Guru ${teacherName} telah menetapkan sesi ${sessionCategory} khas untuk semakan hafazan anda.`
          }),
          is_read: false
        }]);
      }

      setSuccessMsg(`Jadual ${sessionCategory} bagi ${studentName} berjaya dihantar ke Dashboard Pelajar!`);
      setSessionSlots([{ tarikh: '', masa: '' }]);
      setTimeout(() => setSuccessMsg(''), 5000);

    } catch (err: any) {
      alert("Gagal menghantar jadual ad-hoc: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <DashboardGuruLayout>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
        
        {/* HEADER */}
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CalendarDays size={26} color="#0062ff" /> Penjadualan Tasmik & Murajaah Ad-Hoc
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Cipta sesi ulangan khas bagi membimbing pelajar yang lemah. Sistem akan menghalang secara automatik jika pelajar atau guru mempunyai jadual kelas rasmi.
          </p>
        </div>

        {successMsg && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '1rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <CheckCircle2 size={18} /> {successMsg}
          </div>
        )}

        {/* BORANG CIPTA JADUAL AD-HOC */}
        <form onSubmit={handleSubmitAdhocSchedule} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 1. KATEGORI SESI */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem' }}>
              Kategori Sesi Ad-Hoc
            </label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: sessionCategory === 'Tasmik Ulangan' ? '#f0fdf4' : '#f8fafc',
                border: sessionCategory === 'Tasmik Ulangan' ? '2px solid #10b981' : '1px solid #cbd5e1',
                padding: '0.65rem 1.25rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                color: sessionCategory === 'Tasmik Ulangan' ? '#047857' : '#475569'
              }}>
                <input 
                  type="radio" 
                  name="kategori" 
                  checked={sessionCategory === 'Tasmik Ulangan'} 
                  onChange={() => {
                    setSessionCategory('Tasmik Ulangan');
                    setTopic('Ulangan Tasmik (Pembaikan Ayat)');
                  }}
                  style={{ accentColor: '#10b981' }}
                />
                🟢 Tasmik Ulangan (Khas)
              </label>

              <label style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: sessionCategory === 'Murajaah Ulangan' ? '#faf5ff' : '#f8fafc',
                border: sessionCategory === 'Murajaah Ulangan' ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                padding: '0.65rem 1.25rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                color: sessionCategory === 'Murajaah Ulangan' ? '#6b21a8' : '#475569'
              }}>
                <input 
                  type="radio" 
                  name="kategori" 
                  checked={sessionCategory === 'Murajaah Ulangan'} 
                  onChange={() => {
                    setSessionCategory('Murajaah Ulangan');
                    setTopic('Ulangan Murajaah (Pengukuhan Hafazan)');
                  }}
                  style={{ accentColor: '#8b5cf6' }}
                />
                🟣 Murajaah Ulangan
              </label>
            </div>
          </div>

          {/* 2. PILIH PELAJAR & TOPIK SASARAN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Nama Pelajar
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={students.length === 0}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, outline: 'none', background: '#f8fafc', cursor: students.length === 0 ? 'not-allowed' : 'pointer' }}
                required
              >
                {students.length > 0 ? (
                  students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} {s.matrik_or_id ? `(${s.matrik_or_id})` : ''}</option>
                  ))
                ) : (
                  <option value="">Tiada Pelajar Di-Assign</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Topik / Sasaran Semakan
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Surah Al-Kahf Ayat 1-20"
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                required
              />
            </div>
          </div>

          {/* 3. PILIHAN TARIKH & MASA */}
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                Pilihan Tarikh & Masa Sesi Ad-Hoc
              </label>
              <button
                type="button"
                onClick={handleAddSlot}
                style={{ background: 'none', border: 'none', color: '#0062ff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={15} /> Tambah Sesi Lain
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {sessionSlots.map((slot, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', width: '20px' }}>
                    {index + 1}.
                  </span>
                  
                  <input
                    type="date"
                    value={slot.tarikh}
                    onChange={(e) => handleSlotChange(index, 'tarikh', e.target.value)}
                    style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                    required
                  />

                  <input
                    type="time"
                    value={slot.masa}
                    onChange={(e) => handleSlotChange(index, 'masa', e.target.value)}
                    style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                    required
                  />

                  {sessionSlots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(index)}
                      style={{ background: '#fee2e2', border: 'none', color: '#dc2626', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 4. JENIS PERTEMUAN */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.6rem' }}>
              Jenis Pertemuan
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setMeetingMode('online')}
                style={{
                  padding: '0.75rem', borderRadius: '10px',
                  border: meetingMode === 'online' ? '2px solid #0062ff' : '1px solid #cbd5e1',
                  background: meetingMode === 'online' ? '#eff6ff' : '#ffffff',
                  color: meetingMode === 'online' ? '#0062ff' : '#475569',
                  fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Video size={18} /> Tasmik Online (Bilik Live)
              </button>

              <button
                type="button"
                onClick={() => setMeetingMode('fizikal')}
                style={{
                  padding: '0.75rem', borderRadius: '10px',
                  border: meetingMode === 'fizikal' ? '2px solid #059669' : '1px solid #cbd5e1',
                  background: meetingMode === 'fizikal' ? '#ecfdf5' : '#ffffff',
                  color: meetingMode === 'fizikal' ? '#059669' : '#475569',
                  fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <MapPin size={18} /> Tasmik Bersemuka (Kelas)
              </button>
            </div>
          </div>

          {/* BUTANG HANTAR */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={isLoading || !selectedStudentId}
              style={{
                background: '#0062ff', color: '#ffffff', border: 'none',
                padding: '0.75rem 2rem', borderRadius: '10px', fontSize: '0.9rem',
                fontWeight: 700, cursor: (isLoading || !selectedStudentId) ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,98,255,0.3)'
              }}
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Simpan & Hantar Jadual Ad-Hoc
            </button>
          </div>

        </form>

      </div>
    </DashboardGuruLayout>
  );
}