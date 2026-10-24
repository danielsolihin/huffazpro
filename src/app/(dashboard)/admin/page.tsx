'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  UserCheck, 
  ShieldCheck, 
  ArrowRight, 
  Loader2 
} from 'lucide-react';
import styles from './AdminDashboard.module.css';

interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'guru' | 'pelajar' | 'ibu_bapa';
  phone_no: string | null;
  ic_no: string | null;
}

interface AssignmentItem {
  id: string;
  student_name: string;
  guru_name: string;
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [adminName, setAdminName] = useState('Pentadbir Sistem');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Pilihan borang agihan
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedGuruId, setSelectedGuruId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);

    // Dapatkan data profil pengguna log masuk semasa
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: adminProf } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (adminProf) setAdminName(adminProf.full_name);
    }

    // Dapatkan semua senarai profil sistem
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, role, phone_no, ic_no')
      .order('created_at', { ascending: false });

    if (allProfiles) setProfiles(allProfiles as UserProfile[]);

    // Dapatkan rekod agihan semasa halaqah
    const { data: assignList } = await supabase
      .from('tasmik_assignments')
      .select(`
        id,
        student:profiles!tasmik_assignments_student_id_fkey(full_name),
        guru:profiles!tasmik_assignments_guru_id_fkey(full_name)
      `);

    if (assignList) {
      const formatted = assignList.map((item: any) => ({
        id: item.id,
        student_name: item.student?.full_name || 'Tidak Diketahui',
        guru_name: item.guru?.full_name || 'Tidak Diketahui',
      }));
      setAssignments(formatted);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Penapisan mengikut peranan
  const studentsList = profiles.filter((p) => p.role === 'pelajar');
  const guruList = profiles.filter((p) => p.role === 'guru');

  // Mengendalikan pendaftaran agihan halaqah baru
  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedGuruId) {
      alert('Sila pilih Pelajar dan Guru Tasmik.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('tasmik_assignments').upsert({
        student_id: selectedStudentId,
        guru_id: selectedGuruId,
      }, { onConflict: 'student_id,guru_id' });

      if (error) throw error;

      alert('Berjaya menetapkan pelajar ke halaqah guru tasmik!');
      setSelectedStudentId('');
      setSelectedGuruId('');
      loadData();
    } catch (err: any) {
      alert(`Ralat menetapkan agihan: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout userRole="admin" userName={adminName}>
      <div className={styles.container}>
        
        {/* 1. KAD STATISTIK INSTITUSI */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <GraduationCap size={26} />
            </div>
            <div>
              <div className={styles.statValue}>{studentsList.length}</div>
              <div className={styles.statLabel}>Jumlah Pelajar Tahfiz</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
              <BookOpen size={26} />
            </div>
            <div>
              <div className={styles.statValue}>{guruList.length}</div>
              <div className={styles.statLabel}>Guru Tasmik Berdaftar</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: '#dcfce7', color: 'var(--success)' }}>
              <UserCheck size={26} />
            </div>
            <div>
              <div className={styles.statValue}>{assignments.length}</div>
              <div className={styles.statLabel}>Agihan Halaqah Aktif</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <Users size={26} />
            </div>
            <div>
              <div className={styles.statValue}>{profiles.length}</div>
              <div className={styles.statLabel}>Keseluruhan Pengguna</div>
            </div>
          </div>
        </div>

        {/* 2. SUSUN ATUR DWI-PANEL */}
        <div className={styles.layoutGrid}>
          
          {/* Panel Kiri: Borang Agihan Guru-Pelajar */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <UserCheck size={20} color="var(--primary)" />
                Agihan Pelajar ke Halaqah
              </h2>
            </div>

            <form onSubmit={handleAssignStudent} className={styles.assignmentForm}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Pilih Pelajar</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">-- Pilih Nama Pelajar --</option>
                  {studentsList.map((std) => (
                    <option key={std.id} value={std.id}>
                      {std.full_name} ({std.ic_no || 'Tiada No IC'})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Pilih Guru Tasmik</label>
                <select
                  value={selectedGuruId}
                  onChange={(e) => setSelectedGuruId(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">-- Pilih Nama Guru --</option>
                  {guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={submitting} className={styles.assignBtn}>
                {submitting ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>
                    Tetapkan ke Halaqah <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Senarai Agihan Semasa */}
            <div style={{ marginTop: '1.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Senarai Halaqah Sedia Ada ({assignments.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {assignments.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Belum ada agihan halaqah ditetapkan.
                  </span>
                ) : (
                  assignments.map((item) => (
                    <div 
                      key={item.id}
                      style={{ 
                        padding: '0.6rem 0.85rem', 
                        backgroundColor: 'var(--bg-subtle)', 
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{item.student_name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>→ {item.guru_name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Panel Kanan: Direktori Utama Pengguna Sistem */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <ShieldCheck size={20} color="var(--primary)" />
                Direktori Pengguna Sistem
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {profiles.length} Pengguna Berdaftar
              </span>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nama Penuh</th>
                    <th>Peranan</th>
                    <th>No. IC</th>
                    <th>No. Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                      </td>
                    </tr>
                  ) : profiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                        Tiada data pengguna dijumpai.
                      </td>
                    </tr>
                  ) : (
                    profiles.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              p.role === 'admin'
                                ? styles.badgeAdmin
                                : p.role === 'guru'
                                ? styles.badgeGuru
                                : p.role === 'pelajar'
                                ? styles.badgePelajar
                                : styles.badgeIbuBapa
                            }`}
                          >
                            {p.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.ic_no || '-'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.phone_no || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}