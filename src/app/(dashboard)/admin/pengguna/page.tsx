'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardAdminLayout from '@/components/dashboard/DashboardAdminLayout';
import { supabase } from '@/lib/supabase';
import { 
  Users, Search, Plus, Edit, Trash2, UserCheck, 
  GraduationCap, BookOpen, ShieldCheck, Phone,
  X, Save, UserX, Filter, FileText, Camera, Loader2,
  Eye, ExternalLink
} from 'lucide-react';

interface UserItem {
  id: string;
  role: 'Pelajar' | 'Guru' | 'Waris';
  name: string;
  matrikOrId: string;
  classId?: string;
  classOrDetails: string;
  status: 'Aktif' | 'Tidak Aktif';
  contact: string;
  gender: 'Lelaki' | 'Perempuan' | 'Tiada Maklumat' | '';
  dob?: string; pob?: string; stateOfBirth?: string; countryOfBirth?: string;
  nationality?: string; race?: string; citizenshipStatus?: string;
  address?: string; postcode?: string; city?: string; state?: string; email?: string;
  avatarUrl?: string; 
  healthStatus?: string; allergies?: string; dietaryNeeds?: string;
  learningAids?: string; emergencyMeds?: string; otherHealthInfo?: string;
  relationship?: string; occupation?: string; jobTitle?: string; employer?: string;
  workAddress?: string; officeContact?: string; income?: string; employmentStatus?: string;
  maritalStatus?: string; highestEducation?: string; specialization?: string;
  certificateDocs?: string; 
  [key: string]: any; 
}

const getDisplayFileName = (url: string) => {
  try {
    if (url.startsWith('http')) {
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      const decoded = decodeURIComponent(lastPart);
      return decoded.includes('_') ? decoded.substring(decoded.indexOf('_') + 1) : decoded;
    }
    return url;
  } catch {
    return 'Dokumen Sijil';
  }
};

export default function AdminPenggunaPage() {
  const [activeTab, setActiveTab] = useState<'Pelajar' | 'Guru' | 'Waris'>('Pelajar');
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [availableClasses, setAvailableClasses] = useState<{id: string, name: string}[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('Semua');
  const [genderFilter, setGenderFilter] = useState('Semua');

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  
  // STATE MODAL MELIHAT SENARAI DOKUMEN GURU
  const [certModal, setCertModal] = useState<{
    isOpen: boolean;
    teacherName: string;
    docs: string[];
  }>({
    isOpen: false,
    teacherName: '',
    docs: []
  });

  const defaultFormState: Partial<UserItem> = {
    role: 'Pelajar', name: '', matrikOrId: '', classId: '', classOrDetails: '', 
    status: 'Aktif', contact: '', gender: 'Lelaki', avatarUrl: '', certificateDocs: '', email: ''
  };
  const [formData, setFormData] = useState<Partial<UserItem>>(defaultFormState);

  const fetchUsersFromSupabase = async () => {
    setIsLoading(true);
    try {
      let classMap = new Map<string, string>();
      let classesList: {id: string, name: string}[] = [];

      try {
        const { data: classesData, error: classesError } = await supabase.from('classes').select('*');
        if (classesData && !classesError) {
          classesData.forEach((c: any) => {
            const name = c.name || c.nama_kelas || c.class_name || c.title || `Kelas ${c.id.substring(0,4)}`;
            classMap.set(c.id, name);
            classesList.push({ id: c.id, name });
          });
        }
      } catch (e) {
        console.error("Gagal menarik data kelas dari Supabase", e);
      }

      if (classesList.length === 0) {
        const savedClasses = localStorage.getItem('huffazpro_admin_classes');
        if (savedClasses) {
          classesList = JSON.parse(savedClasses);
          classesList.forEach((c: any) => classMap.set(c.id, c.name));
        }
      }
      
      setAvailableClasses(classesList);

      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        const formattedUsers: UserItem[] = data.map((d: any) => {
          const actualClassName = d.class_id ? (classMap.get(d.class_id) || d.class_id) : '-';

          return {
            id: d.id,
            role: d.role as 'Pelajar' | 'Guru' | 'Waris',
            name: d.full_name || 'Tiada Nama',
            matrikOrId: d.matrik_or_id || '-',
            classId: d.class_id || '',
            classOrDetails: d.role === 'Pelajar' ? actualClassName : (d.job_title || 'Guru'),
            status: 'Aktif',
            contact: d.phone || '-',
            gender: d.gender || 'Tiada Maklumat',
            email: d.email,
            avatarUrl: d.avatar_url,
            
            dob: d.dob, pob: d.pob, stateOfBirth: d.state_of_birth, countryOfBirth: d.country_of_birth,
            nationality: d.nationality, race: d.race, citizenshipStatus: d.citizens_status || d.citizenship_status,
            address: d.address, postcode: d.postcode, city: d.city, state: d.state,
            
            healthStatus: d.health_status, allergies: d.allergies, dietaryNeeds: d.dietary_needs,
            learningAids: d.learning_aids, emergencyMeds: d.emergency_meds, otherHealthInfo: d.other_health_info,
            
            relationship: d.relationship, occupation: d.occupation, jobTitle: d.job_title,
            employer: d.employer, workAddress: d.work_address, officeContact: d.office_contact,
            income: d.income, employmentStatus: d.employment_status,
            
            maritalStatus: d.marital_status, highestEducation: d.highest_education,
            specialization: d.specialization, certificateDocs: d.certificate_docs
          };
        });
        setUsers(formattedUsers);
      }
    } catch (error) {
      console.error('Ralat menarik senarai pengguna Supabase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchUsersFromSupabase();
  }, []);

  useEffect(() => setSelectedUsers([]), [activeTab, searchQuery, classFilter, genderFilter]);

  const filteredUsers = users.filter(u => {
    const matchTab = u.role === activeTab;
    const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.matrikOrId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = classFilter === 'Semua' || u.classId === classFilter;
    const matchGender = genderFilter === 'Semua' || u.gender === genderFilter;
    return matchTab && matchSearch && matchClass && matchGender;
  });

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length && filteredUsers.length > 0) setSelectedUsers([]);
    else setSelectedUsers(filteredUsers.map(u => u.id));
  };

  const handleSelectOne = (id: string) => {
    if (selectedUsers.includes(id)) setSelectedUsers(prev => prev.filter(uid => uid !== id));
    else setSelectedUsers(prev => [...prev, id]);
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setFormData({ ...defaultFormState, role: activeTab });
    setShowUserModal(true);
  };

  const handleOpenEditModal = (user: UserItem) => {
    setIsEditing(true);
    setEditingId(user.id);
    setFormData(user);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);

    try {
      const sanitizeVal = (val: any) => {
        if (val === undefined || val === null || val === '') return null;
        if (typeof val === 'string' && val.toLowerCase().includes('pilih')) return null;
        return val;
      };

      const pData: any = {
        full_name: sanitizeVal(formData.name),
        matrik_or_id: sanitizeVal(formData.matrikOrId),
        role: sanitizeVal(formData.role),
        gender: sanitizeVal(formData.gender),
        phone: sanitizeVal(formData.contact),
        email: sanitizeVal(formData.email),
        avatar_url: sanitizeVal(formData.avatarUrl),
        
        dob: sanitizeVal(formData.dob), 
        pob: sanitizeVal(formData.pob), 
        state_of_birth: sanitizeVal(formData.stateOfBirth), 
        country_of_birth: sanitizeVal(formData.countryOfBirth), 
        nationality: sanitizeVal(formData.nationality), 
        race: sanitizeVal(formData.race), 
        citizenship_status: sanitizeVal(formData.citizenshipStatus),
        address: sanitizeVal(formData.address), 
        postcode: sanitizeVal(formData.postcode), 
        city: sanitizeVal(formData.city), 
        state: sanitizeVal(formData.state),
        
        health_status: sanitizeVal(formData.healthStatus), 
        allergies: sanitizeVal(formData.allergies), 
        dietary_needs: sanitizeVal(formData.dietaryNeeds),
        learning_aids: sanitizeVal(formData.learningAids), 
        emergency_meds: sanitizeVal(formData.emergencyMeds), 
        other_health_info: sanitizeVal(formData.otherHealthInfo),
        
        relationship: sanitizeVal(formData.relationship), 
        occupation: sanitizeVal(formData.occupation), 
        job_title: sanitizeVal(formData.jobTitle),
        employer: sanitizeVal(formData.employer), 
        work_address: sanitizeVal(formData.workAddress), 
        office_contact: sanitizeVal(formData.officeContact),
        income: sanitizeVal(formData.income), 
        employment_status: sanitizeVal(formData.employmentStatus),
        
        marital_status: sanitizeVal(formData.maritalStatus), 
        highest_education: sanitizeVal(formData.highestEducation),
        specialization: sanitizeVal(formData.specialization), 
        certificate_docs: sanitizeVal(formData.certificateDocs),
        
        is_profile_complete: true
      };

      if (formData.role === 'Pelajar') {
        const cId = sanitizeVal(formData.classId);
        if (cId && cId !== '-') pData.class_id = cId;
      }

      if (isEditing) {
        const { error: updateErr } = await supabase.from('profiles').update(pData).eq('id', editingId);
        if (updateErr) throw new Error(updateErr.message || updateErr.details || JSON.stringify(updateErr));
        alert('Maklumat pengguna berjaya dikemaskini!');
      } else {
        const targetEmail = formData.email || `user${Date.now()}@huffazpro.edu.my`;
        const tempPassword = 'HuffazPassword123!'; 
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: targetEmail,
          password: tempPassword,
        });

        if (authError) {
          throw new Error(`Gagal mendaftar kata laluan: ${authError.message}`);
        }

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: authData.user.id,
            ...pData
          }, { onConflict: 'id' });

          if (profileError) {
            throw new Error(profileError.message || profileError.details || JSON.stringify(profileError));
          }
        }
        
        alert(`Pengguna berjaya didaftarkan. Sila beri e-mel ini kepada pengguna: ${targetEmail}`);
      }

      await fetchUsersFromSupabase();
      setShowUserModal(false);
      setActiveTab(formData.role as 'Pelajar' | 'Guru' | 'Waris');
      
    } catch (error: any) {
      console.error('Ralat simpan:', error);
      alert(`Ralat: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (confirm('Adakah anda pasti mahu memadam akaun ini secara kekal? (Tindakan ini tidak boleh diundur)')) {
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
        setUsers(users.filter(u => u.id !== id));
      } catch (err: any) {
        alert(`Gagal memadam pengguna: ${err.message}`);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (confirm(`Pasti mahu memadam ${selectedUsers.length} akaun terpilih?`)) {
      try {
        const { error } = await supabase.from('profiles').delete().in('id', selectedUsers);
        if (error) throw error;
        setUsers(users.filter(u => !selectedUsers.includes(u.id)));
        setSelectedUsers([]);
      } catch (err: any) {
        alert(`Gagal memadam secara pukal: ${err.message}`);
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setFormData({ ...formData, avatarUrl: publicUrlData.publicUrl });
    } catch (error: any) {
      alert(`Gagal upload gambar: (Pastikan bucket 'avatars' telah dicipta dan diset Public) ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `${Date.now()}_${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('certificates')
        .getPublicUrl(fileName);

      setFormData({ 
        ...formData, 
        certificateDocs: publicUrlData.publicUrl 
      });

    } catch (error: any) {
      alert(`Gagal upload sijil: (Pastikan bucket 'certificates' telah dicipta dan diset Public) ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // FUNGSI MEMAPARKAN SENARAI DOKUMEN GURU DALAM MODAL
  const handleViewCert = (userName: string, certDoc?: string) => {
    if (!certDoc) {
      alert('Tiada dokumen kelayakan dimuat naik untuk guru ini.');
      return;
    }

    // Pecahkan pautan mengikut koma
    const rawList = certDoc.split(',').map(item => item.trim()).filter(Boolean);
    
    // Pastikan setiap dokumen mempunyai URL penuh
    const resolvedUrls = rawList.map(item => {
      if (item.startsWith('http') || item.startsWith('data:') || item.startsWith('blob:')) {
        return item;
      }
      const { data } = supabase.storage.from('certificates').getPublicUrl(item);
      return data?.publicUrl || item;
    });

    setCertModal({
      isOpen: true,
      teacherName: userName,
      docs: resolvedUrls
    });
  };

  if (!mounted) return <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}></div>;

  return (
    <DashboardAdminLayout userName="Ketua Pentadbir" userRole="Admin">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ background: '#ffffff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.35rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Users size={26} color="#0062ff" /> Direktori & Akaun Pengguna
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              Urus pendaftaran akaun, kawalan akses, dan maklumat peribadi komuniti maahad.
            </p>
          </div>
          <button 
            onClick={handleOpenAddModal}
            style={{ background: '#0062ff', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(0, 98, 255, 0.2)' }}
          >
            <Plus size={18} /> Daftar Pengguna Baharu
          </button>
        </div>

        {/* STATISTIK RINGKAS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #eef2f6', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '10px', color: '#0062ff' }}><BookOpen size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>TOTAL PELAJAR</p>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>{users.filter(u => u.role === 'Pelajar').length}</h3>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #eef2f6', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '10px', color: '#059669' }}><GraduationCap size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>TOTAL GURU</p>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>{users.filter(u => u.role === 'Guru').length}</h3>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #eef2f6', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: '10px', color: '#d97706' }}><UserCheck size={24} /></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>TOTAL WARIS</p>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a' }}>{users.filter(u => u.role === 'Waris').length}</h3>
            </div>
          </div>
        </div>

        {/* BAHAGIAN JADUAL & FILTER UTAMA */}
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #eef2f6', overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #eef2f6', flexWrap: 'wrap', gap: '1rem', background: '#f8fafc' }}>
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: '#e2e8f0', padding: '0.2rem', borderRadius: '8px' }}>
                {['Pelajar', 'Guru', 'Waris'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    style={{ background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#0f172a' : '#64748b', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 0.5rem' }}>
                <Filter size={14} color="#64748b" style={{ marginLeft: '0.2rem' }} />
                <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} style={{ border: 'none', padding: '0.45rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', outline: 'none', background: 'transparent', cursor: 'pointer' }}>
                  <option value="Semua">Jantina</option>
                  <option value="Lelaki">Lelaki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              {activeTab === 'Pelajar' && (
                <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 0.5rem' }}>
                  <BookOpen size={14} color="#64748b" style={{ marginLeft: '0.2rem' }} />
                  <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ border: 'none', padding: '0.45rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569', outline: 'none', background: 'transparent', cursor: 'pointer', maxWidth: '150px' }}>
                    <option value="Semua">Semua Kelas</option>
                    {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '250px' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder={`Cari ${activeTab}...`} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {selectedUsers.length > 0 && (
                <button onClick={handleBulkDelete} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.55rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trash2 size={14} /> Padam Terpilih ({selectedUsers.length})
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 className="animate-spin" size={30} color="#0062ff" />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#ffffff', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '1rem 0.5rem 1rem 1.5rem', width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                        onChange={handleSelectAll}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0062ff' }}
                      />
                    </th>
                    <th style={{ padding: '1rem 0.5rem', width: '50px', fontWeight: 800 }}>No.</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Nama Pengguna</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>{activeTab === 'Pelajar' ? 'No. Matrik' : activeTab === 'Guru' ? 'ID Staf' : 'No. KP'}</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>{activeTab === 'Pelajar' ? 'Kelas' : activeTab === 'Guru' ? 'Jawatan' : 'Pautan Anak'}</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Hubungi</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800 }}>Status</th>
                    <th style={{ padding: '1rem 1.5rem', fontWeight: 800, textAlign: 'right' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        <UserX size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem auto' }} />
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Tiada Rekod Ditemui</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>Sila tukar tapisan (filter) atau daftar pengguna baharu.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', background: selectedUsers.includes(user.id) ? '#f8fafc' : '#fff', transition: 'background 0.2s' }}>
                        
                        <td style={{ padding: '1rem 0.5rem 1rem 1.5rem' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => handleSelectOne(user.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0062ff' }}
                          />
                        </td>
                        
                        <td style={{ padding: '1rem 0.5rem', fontSize: '0.85rem', color: '#64748b' }}>{index + 1}</td>

                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{user.name}</span>
                        </td>

                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#475569' }}>{user.matrikOrId}</td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#475569' }}>{user.classOrDetails}</td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#475569' }}>
                          {activeTab === 'Pelajar' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldCheck size={14} color="#0062ff"/> {user.contact}</span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14} color="#059669"/> {user.contact}</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{ background: user.status === 'Aktif' ? '#dcfce7' : '#fee2e2', color: user.status === 'Aktif' ? '#166534' : '#dc2626', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                            {user.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {/* BUTANG VIEW SIJIL GURU: MEMBUKA MODAL SENARAI SEMUA DOKUMEN */}
                            {activeTab === 'Guru' && user.certificateDocs && (
                              <button 
                                onClick={() => handleViewCert(user.name, user.certificateDocs)} 
                                style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.4rem', borderRadius: '6px', color: '#059669', cursor: 'pointer' }} 
                                title="Lihat Sijil / Dokumen Kelayakan Guru"
                              >
                                <Eye size={14} />
                              </button>
                            )}
                            <button onClick={() => handleOpenEditModal(user)} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.4rem', borderRadius: '6px', color: '#0062ff', cursor: 'pointer' }} title="Edit Akaun"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteSingle(user.id)} style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.4rem', borderRadius: '6px', color: '#dc2626', cursor: 'pointer' }} title="Padam Akaun"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ==============================================================
          MODAL SENARAI DOKUMEN KELAYAKAN GURU (UNTUK SEMAKAN ADMIN)
      ============================================================== */}
      {certModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="#0062ff" /> Dokumen Kelayakan Guru
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {certModal.teacherName} ({certModal.docs.length} Dokumen Tersedia)
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setCertModal({ isOpen: false, teacherName: '', docs: [] })} 
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {certModal.docs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  Tiada dokumen ditemui.
                </div>
              ) : (
                certModal.docs.map((docUrl, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.9rem 1.1rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      <div style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '8px', color: '#0062ff', flexShrink: 0 }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
                          {getDisplayFileName(docUrl)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Dokumen Sah #{idx + 1}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => window.open(docUrl, '_blank')}
                      style={{
                        background: '#0062ff',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.45rem 0.85rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}
                    >
                      <ExternalLink size={14} /> Buka Fail
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#fff' }}>
              <button 
                type="button" 
                onClick={() => setCertModal({ isOpen: false, teacherName: '', docs: [] })} 
                style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: '1.25rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: formData.role === 'Pelajar' ? '900px' : '800px', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isEditing ? <Edit size={18} color="#0062ff" /> : <Plus size={18} color="#0062ff" />} 
                {isEditing ? `Kemaskini Data ${formData.role}` : `Pendaftaran ${formData.role} Baharu`}
              </h3>
              <button type="button" onClick={() => setShowUserModal(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              
              <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                
                {!isEditing && (
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
                    {['Pelajar', 'Guru', 'Waris'].map(r => (
                      <div key={r} onClick={() => setFormData({...defaultFormState, role: r as any})} style={{ width: '150px', border: formData.role === r ? '2px solid #0062ff' : '1px solid #cbd5e1', background: formData.role === r ? '#eff6ff' : '#fff', padding: '0.75rem', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', fontWeight: 700, color: formData.role === r ? '#0062ff' : '#64748b', fontSize: '0.85rem' }}>
                        Borang {r}
                      </div>
                    ))}
                  </div>
                )}

                {formData.role === 'Pelajar' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Gambar Profil Pelajar</p>
                      
                      <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 0.5rem auto' }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 800, overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                          {formData.avatarUrl ? (
                            <img src={formData.avatarUrl} alt="Profil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            formData.name ? formData.name.charAt(0).toUpperCase() : 'U'
                          )}
                        </div>
                        <div 
                          onClick={() => avatarInputRef.current?.click()}
                          style={{ position: 'absolute', bottom: '-2px', right: '-2px', background: '#7c3aed', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
                        >
                          <Camera size={14} />
                        </div>
                      </div>
                      
                      {isUploading && <p style={{ fontSize: '0.75rem', color: '#0062ff', fontWeight: 'bold' }}>Memuat naik gambar...</p>}

                      <input 
                        type="file" 
                        ref={avatarInputRef} 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={handleAvatarUpload} 
                        disabled={isUploading}
                      />
                      
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>Klik ikon kamera untuk memuat naik gambar (maks 5MB)</p>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}><Users size={16} color="#7c3aed"/> Maklumat Pelajar</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div><label style={labelStyle}>Nama Penuh *</label><input type="text" placeholder="cth. Ahmad bin Ali" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required style={inputStyle} /></div>
                        <div><label style={labelStyle}>No. MyKad/Pasport</label><input type="text" placeholder="990101-14-1234 atau nombor pasport" value={formData.matrikOrId || ''} onChange={e => setFormData({...formData, matrikOrId: e.target.value})} style={inputStyle} /></div>
                        
                        <div><label style={labelStyle}>Jantina *</label><select value={formData.gender || ''} onChange={e => setFormData({...formData, gender: e.target.value as any})} style={inputStyle}><option value="Lelaki">Lelaki</option><option value="Perempuan">Perempuan</option></select></div>
                        
                        <div>
                          <label style={labelStyle}>Kelas</label>
                          <select value={formData.classId || ''} onChange={e => setFormData({...formData, classId: e.target.value})} style={inputStyle}>
                            <option value="">Pilih kelas</option>
                            {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div><label style={labelStyle}>Tarikh Lahir</label><input type="date" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})} style={inputStyle} /></div>
                          <div><label style={labelStyle}>Tempat Lahir</label><input type="text" placeholder="cth. Kuala Lumpur" value={formData.pob || ''} onChange={e => setFormData({...formData, pob: e.target.value})} style={inputStyle} /></div>
                        </div>

                        <div><label style={labelStyle}>Negeri Kelahiran</label><input type="text" placeholder="Pilih negeri" value={formData.stateOfBirth || ''} onChange={e => setFormData({...formData, stateOfBirth: e.target.value})} style={inputStyle} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div><label style={labelStyle}>Negara Kelahiran</label><input type="text" placeholder="Pilih negara" value={formData.countryOfBirth || ''} onChange={e => setFormData({...formData, countryOfBirth: e.target.value})} style={inputStyle} /></div>
                          <div><label style={labelStyle}>Kewarganegaraan</label><input type="text" placeholder="Pilih" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} style={inputStyle} /></div>
                        </div>

                        <div><label style={labelStyle}>Bangsa</label><input type="text" placeholder="Pilih bangsa" value={formData.race || ''} onChange={e => setFormData({...formData, race: e.target.value})} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Status Kewarganegaraan</label><select value={formData.citizenshipStatus || ''} onChange={e => setFormData({...formData, citizenshipStatus: e.target.value})} style={inputStyle}><option value="">Pilih status</option><option value="Warganegara">Warganegara</option><option value="Bukan Warganegara">Bukan Warganegara</option></select></div>

                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Alamat Tempat Tinggal</label><textarea placeholder="Alamat penuh" rows={2} value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>

                        <div><label style={labelStyle}>Poskod</label><input type="text" placeholder="cth. 50000" value={formData.postcode || ''} onChange={e => setFormData({...formData, postcode: e.target.value})} style={inputStyle} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div><label style={labelStyle}>Bandar</label><input type="text" placeholder="cth. Kuala Lumpur" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} style={inputStyle} /></div>
                          <div><label style={labelStyle}>Negeri</label><input type="text" placeholder="Pilih negeri" value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})} style={inputStyle} /></div>
                        </div>

                        <div><label style={labelStyle}>No. Telefon Pelajar *</label><input type="text" placeholder="cth. +60123456789" value={formData.contact || ''} onChange={e => setFormData({...formData, contact: e.target.value})} style={inputStyle} /></div>
                        <div><label style={labelStyle}>E-mel Pelajar (Penting Untuk Log Masuk)</label><input type="email" placeholder="pelajar@example.com" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} /></div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0' }} />

                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}><ShieldCheck size={16} color="#7c3aed"/> Maklumat Kesihatan</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Keadaan Kesihatan Umum</label><input type="text" placeholder="Pilih keadaan kesihatan" value={formData.healthStatus || ''} onChange={e => setFormData({...formData, healthStatus: e.target.value})} style={inputStyle} /></div>
                        
                        <div><label style={labelStyle}>Alahan yang Diketahui</label><textarea placeholder="cth. Alahan kacang, debu..." rows={2} value={formData.allergies || ''} onChange={e => setFormData({...formData, allergies: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                        <div><label style={labelStyle}>Keperluan Pemakanan Khas</label><textarea placeholder="cth. Vegetarian, halal sahaja..." rows={2} value={formData.dietaryNeeds || ''} onChange={e => setFormData({...formData, dietaryNeeds: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                        
                        <div><label style={labelStyle}>Keperluan Bantuan Pembelajaran/Aksesibiliti</label><textarea placeholder="cth. Memerlukan rampaian pendengaran..." rows={2} value={formData.learningAids || ''} onChange={e => setFormData({...formData, learningAids: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                        <div><label style={labelStyle}>Ubat Kecemasan</label><textarea placeholder="Ubat yang perlu diketahui sekolah" rows={2} value={formData.emergencyMeds || ''} onChange={e => setFormData({...formData, emergencyMeds: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                        
                        <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Keadaan Lain yang Perlu Dimaklumkan</label><textarea placeholder="Maklumat lain berkaitan kesihatan" rows={2} value={formData.otherHealthInfo || ''} onChange={e => setFormData({...formData, otherHealthInfo: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                      </div>
                    </div>
                  </div>
                )}

                {formData.role === 'Waris' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}><Users size={16} color="#7c3aed"/> Maklumat Bapa / Penjaga</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div><label style={labelStyle}>Nama Penuh</label><input type="text" placeholder="Nama Penuh" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. MyKad/Pasport</label><input type="text" placeholder="No. MyKad/Pasport" value={formData.matrikOrId || ''} onChange={e => setFormData({...formData, matrikOrId: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Hubungan dengan pelajar</label><input type="text" placeholder="Pilih hubungan (Cth: Bapa/Ibu)" value={formData.relationship || ''} onChange={e => setFormData({...formData, relationship: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Tarikh Lahir</label><input type="date" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Kewarganegaraan</label><input type="text" placeholder="Pilih kewarganegaraan" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Pekerjaan</label><input type="text" placeholder="Pekerjaan" value={formData.occupation || ''} onChange={e => setFormData({...formData, occupation: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Jawatan</label><input type="text" placeholder="Jawatan" value={formData.jobTitle || ''} onChange={e => setFormData({...formData, jobTitle: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Nama majikan/organisasi</label><input type="text" placeholder="Nama majikan/organisasi" value={formData.employer || ''} onChange={e => setFormData({...formData, employer: e.target.value})} style={inputStyle} /></div>
                      
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Alamat tempat kerja</label><textarea placeholder="Alamat tempat kerja" rows={2} value={formData.workAddress || ''} onChange={e => setFormData({...formData, workAddress: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                      
                      <div><label style={labelStyle}>No. telefon</label><input type="text" placeholder="No. telefon" value={formData.contact || ''} onChange={e => setFormData({...formData, contact: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. telefon pejabat</label><input type="text" placeholder="No. telefon pejabat" value={formData.officeContact || ''} onChange={e => setFormData({...formData, officeContact: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>E-mel</label><input type="email" placeholder="E-mel (Wajib untuk Log Masuk)" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Pendapatan bulanan</label><select value={formData.income || ''} onChange={e => setFormData({...formData, income: e.target.value})} style={inputStyle}><option value="">Pilih julat pendapatan</option><option value="B40">B40 (Bawah RM4,850)</option><option value="M40">M40 (RM4,851 - RM10,959)</option><option value="T20">T20 (Lebih RM10,960)</option></select></div>
                      
                      <div><label style={labelStyle}>Status pekerjaan</label><select value={formData.employmentStatus || ''} onChange={e => setFormData({...formData, employmentStatus: e.target.value})} style={inputStyle}><option value="">Pilih status</option><option value="Bekerja">Bekerja</option><option value="Bekerja Sendiri">Bekerja Sendiri</option><option value="Suri Rumah">Suri Rumah</option><option value="Pesara">Pesara</option></select></div>
                    </div>
                  </div>
                )}

                {formData.role === 'Guru' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}><UserCheck size={16} color="#7c3aed"/> Borang Maklumat Guru</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div><label style={labelStyle}>Nama Penuh</label><input type="text" placeholder="Nama Penuh" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. MyKad/Pasport</label><input type="text" placeholder="No. MyKad/Pasport" value={formData.matrikOrId || ''} onChange={e => setFormData({...formData, matrikOrId: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Status Perkahwinan</label><select value={formData.maritalStatus || ''} onChange={e => setFormData({...formData, maritalStatus: e.target.value})} style={inputStyle}><option value="">Pilih status</option><option value="Bujang">Bujang</option><option value="Berkahwin">Berkahwin</option></select></div>
                      <div><label style={labelStyle}>Tarikh Lahir</label><input type="date" value={formData.dob || ''} onChange={e => setFormData({...formData, dob: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Kewarganegaraan</label><input type="text" placeholder="Pilih kewarganegaraan" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Emel (Wajib untuk Log Masuk)</label><input type="email" placeholder="Taip emel rasmi" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} style={inputStyle} /></div>
                      
                      <div><label style={labelStyle}>Kelulusan Akademik Tertinggi</label><input type="text" placeholder="Cth: Ijazah Sarjana Muda" value={formData.highestEducation || ''} onChange={e => setFormData({...formData, highestEducation: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Bidang Pengkhususan</label><input type="text" placeholder="Cth: Usuluddin & Tafsir" value={formData.specialization || ''} onChange={e => setFormData({...formData, specialization: e.target.value})} style={inputStyle} /></div>
                      
                      <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Alamat</label><textarea placeholder="Alamat penuh tempat tinggal" rows={2} value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} style={{...inputStyle, resize: 'vertical'}} /></div>
                      
                      <div><label style={labelStyle}>No. telefon</label><input type="text" placeholder="No. telefon" value={formData.contact || ''} onChange={e => setFormData({...formData, contact: e.target.value})} style={inputStyle} /></div>
                      <div><label style={labelStyle}>No. telefon pejabat</label><input type="text" placeholder="No. telefon pejabat" value={formData.officeContact || ''} onChange={e => setFormData({...formData, officeContact: e.target.value})} style={inputStyle} /></div>
                    </div>

                    <div 
                      style={{ marginTop: '1rem', border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '1.75rem 1rem', textAlign: 'center', background: '#f8fafc', transition: 'all 0.2s' }}
                    >
                      <FileText size={36} color={formData.certificateDocs ? '#059669' : '#94a3b8'} style={{ margin: '0 auto 0.5rem auto' }} />
                      
                      {isUploading ? (
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0062ff', fontWeight: 700 }}>Memuat naik fail...</p>
                      ) : (
                        <p style={{ 
                          margin: '0 0 0.5rem 0', 
                          fontSize: '0.9rem', 
                          color: formData.certificateDocs ? '#059669' : '#475569', 
                          fontWeight: formData.certificateDocs ? 700 : 500 
                        }}>
                          {formData.certificateDocs ? `Fail Tersimpan: Boleh Dilihat / Disemak` : 'Muatnaik sijil/dokumen akademik kelayakan'}
                        </p>
                      )}

                      {formData.certificateDocs ? (
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleViewCert(formData.name || 'Guru', formData.certificateDocs)}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.5rem 1.1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)' }}
                          >
                            <Eye size={15} /> Lihat / Semak Dokumen
                          </button>
                          <button
                            type="button"
                            onClick={() => certInputRef.current?.click()}
                            disabled={isUploading}
                            style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1.1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <FileText size={15} /> Tukar Dokumen
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => certInputRef.current?.click()}
                          disabled={isUploading}
                          style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, cursor: isUploading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '0.5rem' }}
                        >
                          Pilih Fail Sijil
                        </button>
                      )}
                    </div>

                    <input 
                      type="file" 
                      ref={certInputRef} 
                      accept=".pdf,.doc,.docx,image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleCertUpload} 
                      disabled={isUploading}
                    />

                  </div>
                )}

              </div>

              {/* FOOTER MODAL */}
              <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: '#fff' }}>
                <button type="button" onClick={() => setShowUserModal(false)} style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }} disabled={isSubmitting || isUploading}>Batal</button>
                <button type="submit" style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: (isSubmitting || isUploading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: (isSubmitting || isUploading) ? 0.7 : 1 }} disabled={isSubmitting || isUploading}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} 
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Data Pengguna'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </DashboardAdminLayout>
  );
}

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' };
const inputStyle = { width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', background: '#fff', color: '#334155' };