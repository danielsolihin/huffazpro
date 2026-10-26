'use client';

import React, { useState, useEffect } from 'react';
import DashboardAdminLayout from '@/components/dashboard/DashboardAdminLayout';
import { supabase } from '@/lib/supabase';
import { 
  Users, GraduationCap, CalendarDays, Plus, 
  Search, Trash2, Clock, MapPin, Video, 
  Save, X, BookOpen, AlertCircle, UserPlus, 
  Calendar, CalendarCheck, List, Edit, CheckSquare, Loader2,
  BookMarked, DoorOpen, Timer
} from 'lucide-react';

// --- STRUKTUR DATA ---
interface ClassItem {
  id: string;
  level?: string;
  name: string;
  teacher: string;
  session: 'Pagi' | 'Petang';
  capacity: number;
}

interface UserItem {
  id: string;
  role: string;
  name: string;
  matrikOrId: string;
  classId?: string;
}

interface TimetableSlot {
  id: string;
  classId: string;
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

export default function AdminKelasPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kelas' | 'jadual'>('kelas');
  const [jadualView, setJadualView] = useState<'mingguan' | 'bulanan' | 'tahunan'>('mingguan');

  // STATE DATA
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<UserItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  
  // STATE MASTER DATA (GURU, SUBJEK, BILIK, MASA)
  const [teachersList, setTeachersList] = useState<MasterItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<MasterItem[]>([]);
  const [roomsList, setRoomsList] = useState<MasterItem[]>([]);
  const [timeSlotsList, setTimeSlotsList] = useState<MasterItem[]>([]);
  
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // STATE MODAL KELAS & PELAJAR
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  
  // STATE MODAL JADUAL & MASTER DATA
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showEditSlotModal, setShowEditSlotModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);

  // BORANG
  const [newClass, setNewClass] = useState<Partial<ClassItem>>({ level: '', name: '', teacher: '', session: 'Pagi', capacity: 30 });
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  
  const [newSlot, setNewSlot] = useState<Partial<TimetableSlot>>({ day: 'Isnin', timeSlot: '', subject: '', room: '', mode: 'Fizikal', teacher: '' });
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);

  // BORANG TAMBAH MASTER DATA
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newTimeSlotName, setNewTimeSlotName] = useState('');

  // STATE EDIT MASTER DATA
  const [editingMasterSubjectId, setEditingMasterSubjectId] = useState<string | null>(null);
  const [editingMasterSubjectName, setEditingMasterSubjectName] = useState('');
  const [editingMasterRoomId, setEditingMasterRoomId] = useState<string | null>(null);
  const [editingMasterRoomName, setEditingMasterRoomName] = useState('');
  const [editingMasterTimeSlotId, setEditingMasterTimeSlotId] = useState<string | null>(null);
  const [editingMasterTimeSlotName, setEditingMasterTimeSlotName] = useState('');

  // STATE URUS PELAJAR (ENROLLMENT)
  const [enrollClassId, setEnrollClassId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollFilter, setEnrollFilter] = useState<'semua' | 'tiada_kelas' | 'kelas_ini'>('semua');

  const DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'];

  useEffect(() => {
    setMounted(true);
    
    const fetchKelasData = async () => {
      setIsLoading(true);
      try {
        // 1. Muat Kelas
        const { data: classData } = await supabase.from('classes').select('*').order('created_at', { ascending: true });
        let loadedClasses: ClassItem[] = [];
        if (classData && classData.length > 0) {
          loadedClasses = classData.map((c: any) => ({
            id: c.id,
            level: c.level || '-',
            name: c.name,
            teacher: c.teacher_name,
            session: c.session,
            capacity: c.capacity
          }));
          setClasses(loadedClasses);
          setSelectedLevel(loadedClasses[0].level || '-');
          setSelectedClassId(loadedClasses[0].id);
        }

        // 2. Muat Pelajar
        const { data: studentData } = await supabase.from('profiles').select('id, role, full_name, matrik_or_id, class_id').ilike('role', '%elajar%');
        if (studentData) {
          setStudents(studentData.map((s: any) => ({
            id: s.id,
            role: s.role,
            name: s.full_name || 'Tiada Nama',
            matrikOrId: s.matrik_or_id || '-',
            classId: s.class_id || ''
          })));
        }

        // 3. Muat Jadual Penuh (Penting untuk semakan pertembungan)
        const { data: ttData } = await supabase.from('timetable').select('*');
        if (ttData) {
          setTimetable(ttData.map((t: any) => ({
            id: t.id,
            classId: t.class_id,
            day: t.day,
            timeSlot: t.time_slot,
            subject: t.subject,
            room: t.room_name || '-',
            mode: t.mode,
            teacher: t.teacher_name
          })));
        }

        // 4. Muat Guru
        const { data: teacherData } = await supabase.from('profiles').select('id, full_name').ilike('role', '%uru%');
        if (teacherData) {
          const loadedTeachers = teacherData.map((t: any) => ({ id: t.id, name: t.full_name || 'Tanpa Nama' }));
          setTeachersList(loadedTeachers);
          if (loadedTeachers.length > 0) setNewClass(prev => ({ ...prev, teacher: loadedTeachers[0].name }));
        }

        // 5. Muat Master Data Subjek, Bilik & Masa
        try {
          const { data: subData } = await supabase.from('subjects').select('id, name').order('name', { ascending: true });
          if (subData) setSubjectsList(subData);
          
          const { data: roomData } = await supabase.from('rooms').select('id, name').order('name', { ascending: true });
          if (roomData) setRoomsList(roomData);

          const { data: timeData } = await supabase.from('time_slots').select('id, name').order('created_at', { ascending: true });
          if (timeData && timeData.length > 0) {
            setTimeSlotsList(timeData);
            setNewSlot(prev => ({ ...prev, timeSlot: timeData[0].name }));
          }
        } catch (e) {
          console.warn("Jadual 'subjects', 'rooms' atau 'time_slots' belum diwujudkan.");
        }

      } catch (error) {
        console.error('Ralat menarik data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKelasData();
  }, []);

  // --- FUNGSI MASTER DATA SUBJEK, BILIK & MASA ---
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const isDuplicate = subjectsList.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase());
    if (isDuplicate) { alert('Subjek atau aktiviti ini telah wujud dalam senarai.'); return; }

    try {
      const { data, error } = await supabase.from('subjects').insert([{ name: newSubjectName.trim() }]).select().single();
      if (error) throw error;
      if (data) {
        setSubjectsList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setNewSubjectName('');
      }
    } catch (err: any) { alert(`Gagal menambah subjek: ${err.message}`); }
  };

  const handleUpdateSubject = async (id: string) => {
    if (!editingMasterSubjectName.trim()) return;
    const isDuplicate = subjectsList.some(s => s.id !== id && s.name.toLowerCase() === editingMasterSubjectName.trim().toLowerCase());
    if (isDuplicate) { alert('Subjek atau aktiviti ini telah wujud dalam senarai.'); return; }

    try {
      const { error } = await supabase.from('subjects').update({ name: editingMasterSubjectName.trim() }).eq('id', id);
      if (error) throw error;
      setSubjectsList(prev => prev.map(s => s.id === id ? { ...s, name: editingMasterSubjectName.trim() } : s).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingMasterSubjectId(null);
    } catch (err: any) { alert(`Gagal mengemaskini subjek: ${err.message}`); }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Adakah anda pasti mahu memadam subjek ini?')) return;
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
      setSubjectsList(prev => prev.filter(s => s.id !== id));
    } catch (err: any) { alert(`Gagal memadam subjek: ${err.message}`); }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const isDuplicate = roomsList.some(r => r.name.toLowerCase() === newRoomName.trim().toLowerCase());
    if (isDuplicate) { alert('Bilik atau lokasi ini telah wujud dalam senarai.'); return; }

    try {
      const { data, error } = await supabase.from('rooms').insert([{ name: newRoomName.trim() }]).select().single();
      if (error) throw error;
      if (data) {
        setRoomsList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setNewRoomName('');
      }
    } catch (err: any) { alert(`Gagal menambah bilik: ${err.message}`); }
  };

  const handleUpdateRoom = async (id: string) => {
    if (!editingMasterRoomName.trim()) return;
    const isDuplicate = roomsList.some(r => r.id !== id && r.name.toLowerCase() === editingMasterRoomName.trim().toLowerCase());
    if (isDuplicate) { alert('Bilik atau lokasi ini telah wujud dalam senarai.'); return; }

    try {
      const { error } = await supabase.from('rooms').update({ name: editingMasterRoomName.trim() }).eq('id', id);
      if (error) throw error;
      setRoomsList(prev => prev.map(r => r.id === id ? { ...r, name: editingMasterRoomName.trim() } : r).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingMasterRoomId(null);
    } catch (err: any) { alert(`Gagal mengemaskini bilik: ${err.message}`); }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Adakah anda pasti mahu memadam bilik ini?')) return;
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;
      setRoomsList(prev => prev.filter(r => r.id !== id));
    } catch (err: any) { alert(`Gagal memadam bilik: ${err.message}`); }
  };

  const handleAddTimeSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTimeSlotName.trim()) return;
    const isDuplicate = timeSlotsList.some(t => t.name.toLowerCase() === newTimeSlotName.trim().toLowerCase());
    if (isDuplicate) { alert('Slot masa ini telah wujud dalam senarai.'); return; }

    try {
      const { data, error } = await supabase.from('time_slots').insert([{ name: newTimeSlotName.trim() }]).select().single();
      if (error) throw error;
      if (data) {
        setTimeSlotsList(prev => [...prev, data]);
        setNewTimeSlotName('');
      }
    } catch (err: any) { alert(`Gagal menambah slot masa: ${err.message}`); }
  };

  const handleUpdateTimeSlot = async (id: string) => {
    if (!editingMasterTimeSlotName.trim()) return;
    const isDuplicate = timeSlotsList.some(t => t.id !== id && t.name.toLowerCase() === editingMasterTimeSlotName.trim().toLowerCase());
    if (isDuplicate) { alert('Slot masa ini telah wujud dalam senarai.'); return; }

    try {
      const { error } = await supabase.from('time_slots').update({ name: editingMasterTimeSlotName.trim() }).eq('id', id);
      if (error) throw error;
      setTimeSlotsList(prev => prev.map(t => t.id === id ? { ...t, name: editingMasterTimeSlotName.trim() } : t));
      setEditingMasterTimeSlotId(null);
    } catch (err: any) { alert(`Gagal mengemaskini slot masa: ${err.message}`); }
  };

  const handleDeleteTimeSlot = async (id: string) => {
    if (!confirm('Adakah anda pasti mahu memadam slot masa ini?')) return;
    try {
      const { error } = await supabase.from('time_slots').delete().eq('id', id);
      if (error) throw error;
      setTimeSlotsList(prev => prev.filter(t => t.id !== id));
    } catch (err: any) { alert(`Gagal memadam slot masa: ${err.message}`); }
  };


  // --- FUNGSI CIPTA & EDIT KELAS ---
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name) return;
    try {
      const classData = { level: newClass.level || '-', name: newClass.name, teacher_name: newClass.teacher || 'Tiada Guru', session: newClass.session || 'Pagi', capacity: Number(newClass.capacity) || 30 };
      const { data, error } = await supabase.from('classes').insert([classData]).select().single();
      if (error) throw error;
      if (data) {
        const addedClass: ClassItem = { id: data.id, level: data.level, name: data.name, teacher: data.teacher_name, session: data.session, capacity: data.capacity };
        setClasses([...classes, addedClass]);
        setShowAddClassModal(false);
        setNewClass({ level: '', name: '', teacher: teachersList.length > 0 ? teachersList[0].name : '', session: 'Pagi', capacity: 30 });
        if (!selectedClassId) {
          setSelectedLevel(addedClass.level || '-');
          setSelectedClassId(addedClass.id);
        }
      }
    } catch (err: any) { alert(`Gagal mencipta kelas: ${err.message}`); }
  };

  const handleOpenEditModal = (cls: ClassItem) => {
    setEditingClass({ ...cls });
    setShowEditClassModal(true);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass || !editingClass.name) return;
    try {
      const updatePayload = { level: editingClass.level || '-', name: editingClass.name, teacher_name: editingClass.teacher || 'Tiada Guru', session: editingClass.session || 'Pagi', capacity: Number(editingClass.capacity) || 30 };
      const { error } = await supabase.from('classes').update(updatePayload).eq('id', editingClass.id);
      if (error) throw error;

      const teacherObj = teachersList.find(t => t.name === editingClass.teacher);
      if (teacherObj?.id) {
        try { await supabase.from('classes').update({ teacher_id: teacherObj.id }).eq('id', editingClass.id); } catch (e) {}
      }

      setClasses(prev => prev.map(c => c.id === editingClass.id ? { ...c, ...updatePayload, teacher: updatePayload.teacher_name } : c));
      setShowEditClassModal(false);
      setEditingClass(null);
      alert('Maklumat kelas berjaya dikemaskini!');
    } catch (err: any) { alert(`Gagal mengemaskini kelas: ${err.message}`); }
  };

  const handleDeleteClass = async (id: string) => {
    if (confirm('Padam kelas ini? Pelajar di dalamnya akan kehilangan rekod kelas.')) {
      try {
        await supabase.from('classes').delete().eq('id', id);
        await supabase.from('profiles').update({ class_id: null }).eq('class_id', id);
        const updated = classes.filter(c => c.id !== id);
        setClasses(updated);
        setStudents(students.map(s => s.classId === id ? { ...s, classId: '' } : s));
        if (selectedClassId === id && updated.length > 0) {
          setSelectedLevel(updated[0].level || '-');
          setSelectedClassId(updated[0].id);
        }
      } catch (err: any) { alert(`Gagal memadam kelas: ${err.message}`); }
    }
  };

  // --- FUNGSI URUS PELAJAR ---
  const openEnrollModal = (classId: string) => {
    setEnrollClassId(classId);
    setEnrollSearch('');
    setEnrollFilter('semua');
    setSelectedStudents(students.filter(s => s.classId === classId).map(s => s.id));
    setShowEnrollModal(true);
  };

  const filteredEnrollStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(enrollSearch.toLowerCase()) || s.matrikOrId.toLowerCase().includes(enrollSearch.toLowerCase());
    if (!matchSearch) return false;
    if (enrollFilter === 'tiada_kelas') return !s.classId;
    if (enrollFilter === 'kelas_ini') return s.classId === enrollClassId;
    return true;
  });

  const toggleStudentEnroll = (studentId: string) => {
    if (selectedStudents.includes(studentId)) setSelectedStudents(prev => prev.filter(id => id !== studentId));
    else setSelectedStudents(prev => [...prev, studentId]);
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredEnrollStudents.map(s => s.id);
    const isAllSelected = allFilteredIds.every(id => selectedStudents.includes(id));
    if (isAllSelected) setSelectedStudents(prev => prev.filter(id => !allFilteredIds.includes(id)));
    else setSelectedStudents(Array.from(new Set([...selectedStudents, ...allFilteredIds])));
  };

  const saveEnrollment = async () => {
    const toAdd = selectedStudents;
    const currentlyEnrolled = students.filter(s => s.classId === enrollClassId).map(s => s.id);
    const toRemove = currentlyEnrolled.filter(id => !selectedStudents.includes(id));

    try {
      if (toAdd.length > 0) await supabase.from('profiles').update({ class_id: enrollClassId }).in('id', toAdd);
      if (toRemove.length > 0) await supabase.from('profiles').update({ class_id: null }).in('id', toRemove);

      setStudents(students.map(s => {
        if (toAdd.includes(s.id)) return { ...s, classId: enrollClassId };
        if (toRemove.includes(s.id)) return { ...s, classId: '' };
        return s;
      }));
      setShowEnrollModal(false);
      alert('Senarai pelajar berjaya dikemas kini!');
    } catch (err: any) { alert(`Gagal menyimpan kemas kini pelajar: ${err.message}`); }
  };

  const getEnrolledCount = (classId: string) => students.filter(s => s.classId === classId).length;

  // --- FUNGSI JADUAL WAKTU (TAMBAH & SUNTING SLOT DENGAN SEMAKAN PERTEMBUNGAN) ---
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlot.subject || !selectedClassId) {
      alert("Sila pilih subjek/aktiviti terlebih dahulu.");
      return;
    }

    // 1. SEMAK PERTEMBUNGAN GURU (Clash Checking)
    if (newSlot.teacher && newSlot.teacher !== '-' && newSlot.teacher !== 'Tiada Guru') {
      const isTeacherBusy = timetable.find(t => 
        t.day === newSlot.day && 
        t.timeSlot === newSlot.timeSlot && 
        t.teacher === newSlot.teacher &&
        t.classId !== selectedClassId
      );
      if (isTeacherBusy) {
        const conflictClass = classes.find(c => c.id === isTeacherBusy.classId)?.name;
        alert(`❌ Pertembungan Guru: ${newSlot.teacher} telah dijadualkan mengajar kelas ${conflictClass} pada waktu ini.`);
        return;
      }
    }

    // 2. SEMAK PERTEMBUNGAN BILIK (Clash Checking - Hanya jika mod Fizikal)
    if (newSlot.mode === 'Fizikal' && newSlot.room && newSlot.room !== '-' && newSlot.room !== 'Tiada Bilik') {
      const isRoomTaken = timetable.find(t => 
        t.day === newSlot.day && 
        t.timeSlot === newSlot.timeSlot && 
        t.room === newSlot.room &&
        t.classId !== selectedClassId
      );
      if (isRoomTaken) {
        const conflictClass = classes.find(c => c.id === isRoomTaken.classId)?.name;
        alert(`❌ Pertembungan Bilik: ${newSlot.room} sedang digunakan oleh kelas ${conflictClass} pada waktu ini.`);
        return;
      }
    }

    try {
      const existingSlot = timetable.find(t => t.classId === selectedClassId && t.day === newSlot.day && t.timeSlot === newSlot.timeSlot);
      if (existingSlot) await supabase.from('timetable').delete().eq('id', existingSlot.id);

      const dbSlot = {
        class_id: selectedClassId,
        day: newSlot.day || 'Isnin',
        time_slot: newSlot.timeSlot || timeSlotsList[0]?.name || '',
        subject: newSlot.subject,
        room_name: newSlot.room || '-',
        mode: newSlot.mode || 'Fizikal',
        teacher_name: newSlot.teacher || '-'
      };

      const { data, error } = await supabase.from('timetable').insert([dbSlot]).select().single();
      if (error) throw error;

      if (data) {
        const slotData: TimetableSlot = {
          id: data.id,
          classId: data.class_id,
          day: data.day,
          timeSlot: data.time_slot,
          subject: data.subject,
          room: data.room_name || '-',
          mode: data.mode as any,
          teacher: data.teacher_name
        };

        const filteredTimetable = timetable.filter(t => !(t.classId === selectedClassId && t.day === newSlot.day && t.timeSlot === newSlot.timeSlot));
        setTimetable([...filteredTimetable, slotData]);
        setShowAddSlotModal(false);
      }
    } catch (err: any) { alert(`Gagal menyimpan slot: ${err.message}`); }
  };

  const handleOpenEditSlot = (slot: TimetableSlot) => {
    setEditingSlot({ ...slot });
    setShowEditSlotModal(true);
  };

  const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !editingSlot.subject) return;

    // 1. SEMAK PERTEMBUNGAN GURU (Clash Checking untuk Edit)
    if (editingSlot.teacher && editingSlot.teacher !== '-' && editingSlot.teacher !== 'Tiada Guru') {
      const isTeacherBusy = timetable.find(t => 
        t.id !== editingSlot.id && 
        t.day === editingSlot.day && 
        t.timeSlot === editingSlot.timeSlot && 
        t.teacher === editingSlot.teacher &&
        t.classId !== selectedClassId
      );
      if (isTeacherBusy) {
        const conflictClass = classes.find(c => c.id === isTeacherBusy.classId)?.name;
        alert(`❌ Pertembungan Guru: ${editingSlot.teacher} telah dijadualkan mengajar kelas ${conflictClass} pada waktu ini.`);
        return;
      }
    }

    // 2. SEMAK PERTEMBUNGAN BILIK (Clash Checking untuk Edit - Hanya mod Fizikal)
    if (editingSlot.mode === 'Fizikal' && editingSlot.room && editingSlot.room !== '-' && editingSlot.room !== 'Tiada Bilik') {
      const isRoomTaken = timetable.find(t => 
        t.id !== editingSlot.id && 
        t.day === editingSlot.day && 
        t.timeSlot === editingSlot.timeSlot && 
        t.room === editingSlot.room &&
        t.classId !== selectedClassId
      );
      if (isRoomTaken) {
        const conflictClass = classes.find(c => c.id === isRoomTaken.classId)?.name;
        alert(`❌ Pertembungan Bilik: ${editingSlot.room} sedang digunakan oleh kelas ${conflictClass} pada waktu ini.`);
        return;
      }
    }

    try {
      const updatePayload = {
        subject: editingSlot.subject,
        room_name: editingSlot.room || '-',
        mode: editingSlot.mode,
        teacher_name: editingSlot.teacher || '-'
      };

      const { error } = await supabase.from('timetable').update(updatePayload).eq('id', editingSlot.id);
      if (error) throw error;

      setTimetable(prev => prev.map(t => 
        t.id === editingSlot.id ? { ...t, ...updatePayload, room: updatePayload.room_name, teacher: updatePayload.teacher_name } : t
      ));

      setShowEditSlotModal(false);
      setEditingSlot(null);
    } catch (err: any) { alert(`Gagal menyunting slot: ${err.message}`); }
  };

  const handleDeleteSlot = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Padam slot jadual waktu ini?')) {
      try {
        await supabase.from('timetable').delete().eq('id', id);
        setTimetable(timetable.filter(t => t.id !== id));
        if (showEditSlotModal) setShowEditSlotModal(false);
      } catch (err: any) { alert(`Gagal memadam slot: ${err.message}`); }
    }
  };

  const getSlot = (day: string, time: string) => {
    return timetable.find(t => t.classId === selectedClassId && t.day === day && t.timeSlot === time);
  };

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
        
        {/* HEADER */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BookOpen size={26} color="#0062ff" /> Pengurusan Kelas & Jadual Induk
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Pusat kawalan akademik. Tetapkan kapasiti kelas, enrolmen pelajar, dan jadual rasmi sekolah.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.35rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <button 
              onClick={() => setActiveTab('kelas')}
              style={{ background: activeTab === 'kelas' ? '#fff' : 'transparent', color: activeTab === 'kelas' ? '#0062ff' : '#64748b', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: activeTab === 'kelas' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
              <Users size={16} /> Senarai Kelas
            </button>
            <button 
              onClick={() => setActiveTab('jadual')}
              style={{ background: activeTab === 'jadual' ? '#fff' : 'transparent', color: activeTab === 'jadual' ? '#0062ff' : '#64748b', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: activeTab === 'jadual' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
            >
              <CalendarDays size={16} /> Jadual Induk
            </button>
          </div>
        </div>

        {/* ==============================================================
            TAB 1: SENARAI KELAS & ENROLMEN
        ============================================================== */}
        {activeTab === 'kelas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '350px' }}>
                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Cari kelas..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>
              <button 
                onClick={() => setShowAddClassModal(true)}
                style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(0, 98, 255, 0.2)' }}
              >
                <Plus size={18} /> Cipta Kelas Baharu
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {classes.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                <div style={{ gridColumn: '1 / -1', background: '#fff', padding: '3rem', borderRadius: '16px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                  <BookOpen size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem auto' }} />
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Tiada Kelas Ditemui</h3>
                </div>
              ) : (
                classes.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(cls => {
                  const enrolledCount = getEnrolledCount(cls.id);
                  return (
                    <div key={cls.id} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{cls.name}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                            <GraduationCap size={15} /> Guru Kelas: <strong style={{ color: '#1e293b' }}>{cls.teacher}</strong>
                          </div>
                        </div>
                        <span style={{ background: cls.session === 'Pagi' ? '#dbeafe' : '#ffedd5', color: cls.session === 'Pagi' ? '#1e40af' : '#9a3412', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                          {cls.session}
                        </span>
                      </div>
                      
                      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem', fontWeight: 600 }}>
                            <span>Pelajar Terdaftar</span>
                            <span>{enrolledCount} / {cls.capacity}</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min((enrolledCount / cls.capacity) * 100, 100)}%`, height: '100%', background: (enrolledCount / cls.capacity) > 0.9 ? '#ef4444' : '#059669', borderRadius: '4px' }}></div>
                          </div>
                        </div>
                      </div>

                      {/* BUTANG TINDAKAN KELAS */}
                      <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => openEnrollModal(cls.id)}
                          style={{ flex: 1, background: '#0062ff', border: 'none', color: '#fff', padding: '0.55rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <UserPlus size={15} /> Urus Pelajar
                        </button>
                        <button 
                          onClick={() => { setActiveTab('jadual'); setSelectedClassId(cls.id); setSelectedLevel(cls.level || '-'); }}
                          style={{ flex: 1, background: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.55rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <CalendarDays size={15} /> Jadual
                        </button>
                        
                        <button 
                          onClick={() => handleOpenEditModal(cls)}
                          style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#0062ff', padding: '0.55rem 0.8rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Edit Maklumat Kelas & Guru"
                        >
                          <Edit size={16} />
                        </button>

                        <button 
                          onClick={() => handleDeleteClass(cls.id)}
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.55rem 0.8rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Padam Kelas"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB 2: JADUAL WAKTU (MINGGUAN / BULANAN / TAHUNAN)
        ============================================================== */}
        {activeTab === 'jadual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Peringkat:</label>
                  <select 
                    value={selectedLevel}
                    onChange={(e) => {
                      setSelectedLevel(e.target.value);
                      const firstClass = classes.find(c => (c.level || '-') === e.target.value);
                      if (firstClass) setSelectedClassId(firstClass.id);
                      else setSelectedClassId('');
                    }}
                    style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                  >
                    {Array.from(new Set(classes.map(c => c.level || '-'))).map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                    {classes.length === 0 && <option value="">Tiada Kelas</option>}
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Kelas:</label>
                  <select 
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer', minWidth: '180px' }}
                  >
                    {classes.filter(c => (c.level || '-') === selectedLevel).length === 0 && <option value="">Tiada Kelas Tersedia</option>}
                    {classes.filter(c => (c.level || '-') === selectedLevel).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* BUTANG MASTER DATA JADUAL */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.3rem', borderRadius: '8px', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => setShowTimeSlotModal(true)} style={{ padding: '0.4rem 0.8rem', border: 'none', background: '#fef9c3', color: '#854d0e', fontSize: '0.8rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Timer size={14}/> Urus Masa
                </button>
                <button onClick={() => setShowSubjectModal(true)} style={{ padding: '0.4rem 0.8rem', border: 'none', background: '#e0e7ff', color: '#4338ca', fontSize: '0.8rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <BookMarked size={14}/> Urus Subjek
                </button>
                <button onClick={() => setShowRoomModal(true)} style={{ padding: '0.4rem 0.8rem', border: 'none', background: '#dcfce7', color: '#15803d', fontSize: '0.8rem', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <DoorOpen size={14}/> Urus Bilik
                </button>
              </div>
            </div>

            {jadualView === 'mingguan' && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CalendarDays size={18} color="#0062ff"/> Jadual Waktu Induk
                  </h3>
                  <button 
                    disabled={classes.length === 0}
                    onClick={() => setShowAddSlotModal(true)}
                    style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: classes.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Plus size={16} /> Tambah Slot
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
                                    onClick={() => handleOpenEditSlot(slot)}
                                    style={{ 
                                      background: slot.mode === 'Rehat' ? '#f1f5f9' : slot.mode === 'Live' ? '#eff6ff' : '#ecfdf5', 
                                      border: `1px solid ${slot.mode === 'Rehat' ? '#cbd5e1' : slot.mode === 'Live' ? '#bfdbfe' : '#a7f3d0'}`, 
                                      borderRadius: '8px', 
                                      padding: '0.75rem', 
                                      height: '100%', 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      justifyContent: 'center', 
                                      position: 'relative',
                                      cursor: 'pointer',
                                      transition: 'transform 0.1s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    title="Klik untuk Edit Slot"
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
                                    <button onClick={(e) => handleDeleteSlot(slot.id, e)} style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', opacity: 0.7 }} title="Padam Slot"><Trash2 size={12}/></button>
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
            )}
            
            {jadualView !== 'mingguan' && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #eef2f6', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <CalendarCheck size={56} color="#cbd5e1" style={{ margin: '0 auto 1rem auto' }} />
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Modul Kalendar Akademik Sedang Dibina</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Pandangan ini akan memaparkan semua acara cuti am dan peperiksaan.</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ==============================================================
          MODAL: URUS MASTER DATA (SLOT MASA)
      ============================================================== */}
      {showTimeSlotModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Timer size={18} color="#854d0e" /> Urus Slot Masa
              </h3>
              <button type="button" onClick={() => setShowTimeSlotModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <form onSubmit={handleAddTimeSlot} style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Cth: 08:00 PM - 10:00 PM" 
                  value={newTimeSlotName} 
                  onChange={(e) => setNewTimeSlotName(e.target.value)} 
                  required 
                  style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }} 
                />
                <button type="submit" style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: '#854d0e', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Tambah</button>
              </form>
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {timeSlotsList.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada slot masa direkodkan.</div>
                ) : (
                  timeSlotsList.map(ts => (
                    <div key={ts.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                      {editingMasterTimeSlotId === ts.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                          <input type="text" value={editingMasterTimeSlotName} onChange={(e) => setEditingMasterTimeSlotName(e.target.value)} style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }} />
                          <button type="button" onClick={() => handleUpdateTimeSlot(ts.id)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}><CheckSquare size={14}/></button>
                          <button type="button" onClick={() => setEditingMasterTimeSlotId(null)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}><X size={14}/></button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{ts.name}</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => { setEditingMasterTimeSlotId(ts.id); setEditingMasterTimeSlotName(ts.name); }} style={{ background: 'none', border: 'none', color: '#0062ff', cursor: 'pointer' }} title="Edit"><Edit size={16}/></button>
                            <button type="button" onClick={() => handleDeleteTimeSlot(ts.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Padam"><Trash2 size={16}/></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: URUS MASTER DATA (SUBJEK)
      ============================================================== */}
      {showSubjectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookMarked size={18} color="#4338ca" /> Urus Subjek & Aktiviti
              </h3>
              <button type="button" onClick={() => setShowSubjectModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <form onSubmit={handleAddSubject} style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Cth: Tasmik Al-Quran" 
                  value={newSubjectName} 
                  onChange={(e) => setNewSubjectName(e.target.value)} 
                  required 
                  style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }} 
                />
                <button type="submit" style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: '#4338ca', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Tambah</button>
              </form>
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {subjectsList.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada subjek direkodkan.</div>
                ) : (
                  subjectsList.map(sub => (
                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                      {editingMasterSubjectId === sub.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                          <input type="text" value={editingMasterSubjectName} onChange={(e) => setEditingMasterSubjectName(e.target.value)} style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }} />
                          <button type="button" onClick={() => handleUpdateSubject(sub.id)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}><CheckSquare size={14}/></button>
                          <button type="button" onClick={() => setEditingMasterSubjectId(null)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}><X size={14}/></button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{sub.name}</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => { setEditingMasterSubjectId(sub.id); setEditingMasterSubjectName(sub.name); }} style={{ background: 'none', border: 'none', color: '#0062ff', cursor: 'pointer' }} title="Edit"><Edit size={16}/></button>
                            <button type="button" onClick={() => handleDeleteSubject(sub.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Padam"><Trash2 size={16}/></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: URUS MASTER DATA (BILIK/KELAS)
      ============================================================== */}
      {showRoomModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DoorOpen size={18} color="#15803d" /> Urus Bilik & Lokasi
              </h3>
              <button type="button" onClick={() => setShowRoomModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <form onSubmit={handleAddRoom} style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Cth: Bilik Kuliah 1" 
                  value={newRoomName} 
                  onChange={(e) => setNewRoomName(e.target.value)} 
                  required 
                  style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }} 
                />
                <button type="submit" style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', background: '#15803d', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Tambah</button>
              </form>
              <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {roomsList.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Tiada bilik direkodkan.</div>
                ) : (
                  roomsList.map(room => (
                    <div key={room.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                      {editingMasterRoomId === room.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                          <input type="text" value={editingMasterRoomName} onChange={(e) => setEditingMasterRoomName(e.target.value)} style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }} />
                          <button type="button" onClick={() => handleUpdateRoom(room.id)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}><CheckSquare size={14}/></button>
                          <button type="button" onClick={() => setEditingMasterRoomId(null)} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}><X size={14}/></button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{room.name}</span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => { setEditingMasterRoomId(room.id); setEditingMasterRoomName(room.name); }} style={{ background: 'none', border: 'none', color: '#0062ff', cursor: 'pointer' }} title="Edit"><Edit size={16}/></button>
                            <button type="button" onClick={() => handleDeleteRoom(room.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Padam"><Trash2 size={16}/></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: CIPTA KELAS BAHARU
      ============================================================== */}
      {showAddClassModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '550px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} color="#0062ff" /> Cipta Kelas Baharu
              </h3>
              <button type="button" onClick={() => setShowAddClassModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveClass} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Tingkatan / Peringkat</label>
                  <input type="text" placeholder="Cth: Tingkatan 1" value={newClass.level || ''} onChange={(e) => setNewClass({...newClass, level: e.target.value})} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Nama Kelas Pengajian</label>
                  <input type="text" placeholder="Cth: Tingkatan 2 As-Syafie" value={newClass.name} onChange={(e) => setNewClass({...newClass, name: e.target.value})} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Guru Seliaan (Homeroom)</label>
                <select value={newClass.teacher} onChange={(e) => setNewClass({...newClass, teacher: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}>
                  <option value="">-- Pilih Guru --</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Sesi Waktu</label>
                  <select value={newClass.session} onChange={(e) => setNewClass({...newClass, session: e.target.value as 'Pagi' | 'Petang'})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}>
                    <option value="Pagi">Sesi Pagi</option>
                    <option value="Petang">Sesi Petang</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Kapasiti Pelajar</label>
                  <input type="number" min="5" max="50" value={newClass.capacity} onChange={(e) => setNewClass({...newClass, capacity: Number(e.target.value)})} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddClassModal(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                <button type="submit" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#0062ff', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Save size={15} /> Simpan Kelas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: KEMASKINI / EDIT KELAS & GURU
      ============================================================== */}
      {showEditClassModal && editingClass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '550px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={18} color="#0062ff" /> Kemaskini Kelas & Guru
              </h3>
              <button type="button" onClick={() => setShowEditClassModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateClass} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Tingkatan / Peringkat</label>
                  <input type="text" placeholder="Cth: Tingkatan 1" value={editingClass.level || ''} onChange={(e) => setEditingClass({...editingClass, level: e.target.value})} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Nama Kelas Pengajian</label>
                  <input 
                    type="text" 
                    value={editingClass.name} 
                    onChange={(e) => setEditingClass({...editingClass, name: e.target.value})} 
                    required 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} 
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Guru Seliaan (Guru Kelas)</label>
                <select 
                  value={editingClass.teacher} 
                  onChange={(e) => setEditingClass({...editingClass, teacher: e.target.value})} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                  <option value="">-- Pilih Guru Kelas --</option>
                  {teachersList.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Sesi Waktu</label>
                  <select 
                    value={editingClass.session} 
                    onChange={(e) => setEditingClass({...editingClass, session: e.target.value as 'Pagi' | 'Petang'})} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                  >
                    <option value="Pagi">Sesi Pagi</option>
                    <option value="Petang">Sesi Petang</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Kapasiti Pelajar</label>
                  <input 
                    type="number" 
                    min="5" 
                    max="60" 
                    value={editingClass.capacity} 
                    onChange={(e) => setEditingClass({...editingClass, capacity: Number(e.target.value)})} 
                    required 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }} 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowEditClassModal(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                <button type="submit" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#0062ff', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Save size={15} /> Simpan Kemaskini</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: URUS PELAJAR (ENROLLMENT BULK ACTION) - LIST VIEW
      ============================================================== */}
      {showEnrollModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '850px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={20} color="#059669" /> Daftar Pelajar ke Kelas
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Pilih pelajar untuk dimasukkan ke kelas: <strong style={{ color: '#0f172a' }}>{classes.find(c => c.id === enrollClassId)?.name}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setShowEnrollModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setEnrollFilter('semua')} style={{ background: enrollFilter === 'semua' ? '#0f172a' : '#fff', color: enrollFilter === 'semua' ? '#fff' : '#475569', border: enrollFilter === 'semua' ? 'none' : '1px solid #cbd5e1', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Semua Pelajar</button>
                <button onClick={() => setEnrollFilter('tiada_kelas')} style={{ background: enrollFilter === 'tiada_kelas' ? '#0f172a' : '#fff', color: enrollFilter === 'tiada_kelas' ? '#fff' : '#475569', border: enrollFilter === 'tiada_kelas' ? 'none' : '1px solid #cbd5e1', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Tiada Kelas</button>
                <button onClick={() => setEnrollFilter('kelas_ini')} style={{ background: enrollFilter === 'kelas_ini' ? '#0f172a' : '#fff', color: enrollFilter === 'kelas_ini' ? '#fff' : '#475569', border: enrollFilter === 'kelas_ini' ? 'none' : '1px solid #cbd5e1', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Dalam Kelas Ini</button>
              </div>
              
              <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Cari nama atau matrik..." 
                  value={enrollSearch}
                  onChange={(e) => setEnrollSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ padding: '0', overflowY: 'auto', flex: 1, backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Menunjukkan {filteredEnrollStudents.length} pelajar hasil tapisan</span>
                <button 
                  type="button" 
                  onClick={handleSelectAllFiltered}
                  style={{ background: 'transparent', border: '1px solid #059669', color: '#059669', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <CheckSquare size={14}/> Tandakan Semua (Hasil Tapisan)
                </button>
              </div>

              {filteredEnrollStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', color: '#94a3b8' }}>Tiada pelajar ditemui.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', padding: '0.75rem 1.5rem', background: '#f1f5f9', fontWeight: 700, fontSize: '0.8rem', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                     <div style={{ width: '40px' }}></div>
                     <div style={{ width: '50px' }}>No.</div>
                     <div style={{ flex: 2 }}>Nama Pelajar</div>
                     <div style={{ flex: 1 }}>No. Matrik</div>
                     <div style={{ flex: 1 }}>Status Kelas Semasa</div>
                  </div>
                  
                  {filteredEnrollStudents.map((student, index) => (
                     <label 
                       key={student.id} 
                       style={{ 
                         display: 'flex', 
                         alignItems: 'center', 
                         padding: '0.75rem 1.5rem', 
                         borderBottom: '1px solid #e2e8f0', 
                         background: selectedStudents.includes(student.id) ? '#ecfdf5' : '#fff', 
                         cursor: 'pointer', 
                         transition: 'background 0.2s' 
                       }}
                     >
                        <div style={{ width: '40px' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => toggleStudentEnroll(student.id)}
                            style={{ width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' }}
                          />
                        </div>
                        <div style={{ width: '50px', fontSize: '0.85rem', color: '#64748b' }}>{index + 1}</div>
                        <div style={{ flex: 2, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{student.name}</div>
                        <div style={{ flex: 1, fontSize: '0.85rem', color: '#475569' }}>{student.matrikOrId}</div>
                        <div style={{ flex: 1, fontSize: '0.8rem' }}>
                           <span style={{ 
                             padding: '0.2rem 0.6rem', 
                             borderRadius: '6px', 
                             background: student.classId === enrollClassId ? '#dcfce7' : student.classId ? '#fef3c7' : '#f1f5f9', 
                             color: student.classId === enrollClassId ? '#166534' : student.classId ? '#b45309' : '#64748b', 
                             fontWeight: 600 
                           }}>
                             {student.classId === enrollClassId ? 'Kelas Ini' : student.classId ? classes.find(c => c.id === student.classId)?.name : 'Belum Ditetapkan'}
                           </span>
                        </div>
                     </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ background: '#dcfce7', color: '#166534', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800 }}>
                  {selectedStudents.length} Terpilih
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowEnrollModal(false)} style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                <button type="button" onClick={saveEnrollment} style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 6px rgba(5, 150, 105, 0.2)' }}>Simpan Senarai</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: TAMBAH SLOT JADUAL
      ============================================================== */}
      {showAddSlotModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} color="#0062ff" /> Tambah Slot Jadual
              </h3>
              <button type="button" onClick={() => setShowAddSlotModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveSlot} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Hari</label>
                  <select value={newSlot.day} onChange={(e) => setNewSlot({...newSlot, day: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Slot Masa</label>
                  <select value={newSlot.timeSlot} onChange={(e) => setNewSlot({...newSlot, timeSlot: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}>
                    {timeSlotsList.map(ts => <option key={ts.id} value={ts.name}>{ts.name}</option>)}
                  </select>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Subjek / Aktiviti</label>
                <select 
                  value={newSlot.subject} 
                  onChange={(e) => setNewSlot({...newSlot, subject: e.target.value})} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                  <option value="">-- Pilih Subjek --</option>
                  {subjectsList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Bilik / Lokasi</label>
                <select 
                  value={newSlot.room} 
                  onChange={(e) => setNewSlot({...newSlot, room: e.target.value})} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                  <option value="">-- Pilih Bilik / Lokasi --</option>
                  {roomsList.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Mod Sesi</label>
                  <select value={newSlot.mode} onChange={(e) => setNewSlot({...newSlot, mode: e.target.value as any})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}>
                    <option value="Fizikal">Fizikal</option>
                    <option value="Live">Bilik Live</option>
                    <option value="Kendiri">Kendiri</option>
                    <option value="Rehat">Rehat</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Guru Pembimbing</label>
                  <select 
                    value={newSlot.teacher} 
                    onChange={(e) => setNewSlot({...newSlot, teacher: e.target.value})} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                  >
                    <option value="">-- Pilih Guru --</option>
                    {teachersList.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddSlotModal(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                <button type="submit" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#0062ff', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Save size={15} /> Simpan ke Jadual</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================
          MODAL: KEMASKINI / EDIT SLOT JADUAL
      ============================================================== */}
      {showEditSlotModal && editingSlot && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit size={18} color="#0062ff" /> Edit Slot Jadual Waktu
              </h3>
              <button type="button" onClick={() => setShowEditSlotModal(false)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '1.25rem 1.5rem 0 1.5rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{editingSlot.day}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0062ff' }}>{editingSlot.timeSlot}</span>
              </div>
            </div>

            <form onSubmit={handleUpdateSlot} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Subjek / Aktiviti</label>
                <select 
                  value={editingSlot.subject} 
                  onChange={(e) => setEditingSlot({...editingSlot, subject: e.target.value})} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                  <option value="">-- Pilih Subjek --</option>
                  {subjectsList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Bilik / Lokasi</label>
                <select 
                  value={editingSlot.room} 
                  onChange={(e) => setEditingSlot({...editingSlot, room: e.target.value})} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                  <option value="">-- Pilih Bilik / Lokasi --</option>
                  {roomsList.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Mod Sesi</label>
                  <select 
                    value={editingSlot.mode} 
                    onChange={(e) => setEditingSlot({...editingSlot, mode: e.target.value as any})} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                  >
                    <option value="Fizikal">Fizikal</option>
                    <option value="Live">Bilik Live</option>
                    <option value="Kendiri">Kendiri</option>
                    <option value="Rehat">Rehat</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Guru Pembimbing</label>
                  <select 
                    value={editingSlot.teacher} 
                    onChange={(e) => setEditingSlot({...editingSlot, teacher: e.target.value})} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                  >
                    <option value="">-- Pilih Guru --</option>
                    {teachersList.map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={(e) => handleDeleteSlot(editingSlot.id, e as any)}
                  style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Trash2 size={15}/> Padam Slot
                </button>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setShowEditSlotModal(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Batal</button>
                  <button type="submit" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#0062ff', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Save size={15} /> Kemaskini Slot</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardAdminLayout>
  );
}