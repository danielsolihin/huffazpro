'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  ShieldCheck, 
  GraduationCap, 
  BookOpen, 
  HeartHandshake, 
  Loader2, 
  ArrowRight 
} from 'lucide-react';
import styles from './AuthForm.module.css';

type UserRole = 'admin' | 'guru' | 'pelajar' | 'ibu_bapa';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = useState<UserRole>('pelajar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [icNo, setIcNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const roleRedirectMap: Record<UserRole, string> = {
    admin: '/admin',
    guru: '/guru',
    pelajar: '/pelajar',
    ibu_bapa: '/ibu-bapa',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role,
              phone_no: phoneNo,
              ic_no: icNo,
            },
          },
        });

        if (error) throw error;
        if (data.user) {
          router.push(roleRedirectMap[role]);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Dapatkan peranan sebenar pengguna dari jadual profiles
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileErr) throw profileErr;

        const targetRole = (profile?.role as UserRole) || 'pelajar';
        router.push(roleRedirectMap[targetRole]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ralat berlaku semasa proses autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.badge}>HuffazPro Portal</span>
          <h1 className={styles.title}>
            {mode === 'login' ? 'Log Masuk' : 'Daftar Akaun'}
          </h1>
          <p className={styles.subtitle}>
            {mode === 'login' 
              ? 'Sila masukkan butiran untuk akses dashboard' 
              : 'Pilih peranan anda untuk memulakan sistem'}
          </p>
        </div>

        {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

        {mode === 'register' && (
          <div className={styles.roleSelector}>
            <button
              type="button"
              className={`${styles.roleButton} ${role === 'pelajar' ? styles.roleButtonActive : ''}`}
              onClick={() => setRole('pelajar')}
            >
              <GraduationCap size={18} />
              Pelajar
            </button>
            <button
              type="button"
              className={`${styles.roleButton} ${role === 'guru' ? styles.roleButtonActive : ''}`}
              onClick={() => setRole('guru')}
            >
              <BookOpen size={18} />
              Guru
            </button>
            <button
              type="button"
              className={`${styles.roleButton} ${role === 'ibu_bapa' ? styles.roleButtonActive : ''}`}
              onClick={() => setRole('ibu_bapa')}
            >
              <HeartHandshake size={18} />
              Ibu Bapa
            </button>
            <button
              type="button"
              className={`${styles.roleButton} ${role === 'admin' ? styles.roleButtonActive : ''}`}
              onClick={() => setRole('admin')}
            >
              <ShieldCheck size={18} />
              Admin
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {mode === 'register' && (
            <>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Nama Penuh</label>
                <input
                  type="text"
                  required
                  placeholder="Nama Pelajar / Guru / Penjaga"
                  className={styles.input}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>No. Kad Pengenalan</label>
                <input
                  type="text"
                  required
                  placeholder="080101-10-xxxx"
                  className={styles.input}
                  value={icNo}
                  onChange={(e) => setIcNo(e.target.value)}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>No. Telefon</label>
                <input
                  type="tel"
                  required
                  placeholder="012-3456789"
                  className={styles.input}
                  value={phoneNo}
                  onChange={(e) => setPhoneNo(e.target.value)}
                />
              </div>
            </>
          )}

          <div className={styles.inputGroup}>
            <label className={styles.label}>Alamat Emel</label>
            <input
              type="email"
              required
              placeholder="nama@contoh.com"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Kata Laluan</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? (
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <>
                {mode === 'login' ? 'Log Masuk' : 'Daftar Sekarang'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className={styles.footer}>
          {mode === 'login' ? (
            <p>
              Belum mempunyai akaun?{' '}
              <Link href="/register" className={styles.footerLink}>
                Daftar sekarang
              </Link>
            </p>
          ) : (
            <p>
              Sudah mempunyai akaun?{' '}
              <Link href="/login" className={styles.footerLink}>
                Log masuk
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}