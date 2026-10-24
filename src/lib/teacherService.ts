import { supabase } from '@/lib/supabase';

export interface StudentProfile {
  id: string;
  full_name: string;
  matrik_or_id?: string;
  class_id?: string;
  class_name?: string;
  role?: string;
  avatar_url?: string;
}

export interface TeacherAssignedData {
  teacherId: string;
  teacherName: string;
  assignedClassIds: string[];
  assignedClassNames: string[];
  students: StudentProfile[];
}

// Penapis khas untuk membuang nilai kosong/tiada/simbol sengkang
const cleanStr = (val: any): string => {
  if (!val) return '';
  const s = String(val).trim().toLowerCase();
  if (s === '-' || s === 'tiada' || s === 'null' || s === 'undefined' || s === '') return '';
  return s;
};

export async function getTeacherAssignedData(
  currentTeacherId: string, 
  fallbackName: string = 'Guru'
): Promise<TeacherAssignedData> {
  try {
    // 1. Tarik profil guru
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentTeacherId)
      .single();

    const currentGuruName = profile?.full_name || fallbackName;
    const cleanGuruName = cleanStr(currentGuruName).replace(/^(ustaz|ustazah|cikgu|guru|en|encik|tuan|puan|dr|hj|haji)\s+/i, '').trim();

    const validClassIds = new Set<string>();
    const validClassNames = new Set<string>();

    // Masukkan ID dan Nama Kelas dari Profil Guru jika sah
    const pClassId = cleanStr(profile?.class_id);
    const pClassName = cleanStr(profile?.class_name);
    if (pClassId) validClassIds.add(String(profile!.class_id).trim());
    if (pClassName) validClassNames.add(pClassName);

    // 2. Tarik kelas dari jadual 'classes'
    const { data: classes } = await supabase.from('classes').select('*');
    if (classes) {
      classes.forEach(c => {
        const tId = String(c.teacher_id || '').trim();
        const gId = String(c.guru_id || '').trim();
        const tName = cleanStr(c.teacher_name || c.teacher || c.guru);

        // Jika guru berdaftar dengan kelas ini
        if (
          tId === currentTeacherId || 
          gId === currentTeacherId ||
          (cleanGuruName.length > 2 && tName.includes(cleanGuruName))
        ) {
          if (cleanStr(c.id)) validClassIds.add(String(c.id).trim());
          if (cleanStr(c.name)) validClassNames.add(cleanStr(c.name));
          if (cleanStr(c.class_name)) validClassNames.add(cleanStr(c.class_name));
        }
      });
    }

    // 3. Tarik SEMUA pelajar (Bypass SQL Filter untuk elak ralat lajur hilang)
    const { data: students, error: studentErr } = await supabase
      .from('profiles')
      .select('*')
      .ilike('role', '%elajar%');

    if (studentErr) {
      console.error('Ralat menarik senarai dari pangkalan data:', studentErr);
      throw studentErr;
    }

    // 4. PENAPISAN IN-MEMORY KETAT
    // Pelajar hanya akan dipaparkan jika Class ID / Class Name mereka padan dengan kelas ustaz.
    const finalStudents = (students || []).filter((s: any) => {
      const sClassId = String(s.class_id || '').trim();
      const sClassName = cleanStr(s.class_name);
      const sTeacherName = cleanStr(s.teacher_name || s.guru_name);
      
      // Padanan mengikut ID Kelas
      if (sClassId && validClassIds.has(sClassId)) return true;
      
      // Padanan mengikut Nama Kelas
      if (sClassName && validClassNames.has(sClassName)) return true;
      
      // Padanan terus jika nama ustaz diletakkan pada profil pelajar
      if (cleanGuruName.length > 2 && sTeacherName.includes(cleanGuruName)) return true;

      // Jika tiada padanan, tolak.
      return false;
    }).map((s: any) => ({
      id: s.id,
      full_name: s.full_name || 'Pelajar',
      matrik_or_id: s.matrik_or_id || s.matrik_id || '',
      class_id: s.class_id || '',
      class_name: s.class_name || '',
      role: s.role || 'Pelajar',
      avatar_url: s.avatar_url || ''
    }));

    // Susun mengikut abjad
    finalStudents.sort((a, b) => a.full_name.localeCompare(b.full_name));

    return {
      teacherId: currentTeacherId,
      teacherName: currentGuruName,
      assignedClassIds: Array.from(validClassIds),
      assignedClassNames: Array.from(validClassNames),
      students: finalStudents
    };

  } catch (err) {
    console.error('Ralat getTeacherAssignedData:', err);
    return {
      teacherId: currentTeacherId,
      teacherName: fallbackName,
      assignedClassIds: [],
      assignedClassNames: [],
      students: []
    };
  }
}