'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { BookOpenText, Search, Library, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import styles from './Tafsir.module.css';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

interface AyahData {
  surahName: string;
  surahNameArabic: string;
  ayahNum: number;
  juzuk: number;
  arabicText: string;
  translation: string;
  tafsirFull: string;
}

export default function TafsirPage() {
  const [studentName, setStudentName] = useState('Pelajar');
  const [surahsList, setSurahsList] = useState<Surah[]>([]);
  
  const [selectedSurah, setSelectedSurah] = useState('1');
  const [selectedAyah, setSelectedAyah] = useState('1');
  const [ayahCount, setAyahCount] = useState(7);
  
  const [selectedSumber, setSelectedSumber] = useState('ar-rahman');

  const [activeData, setActiveData] = useState<AyahData | null>(null);
  const [activeSumberLabel, setActiveSumberLabel] = useState('Terjemahan Pimpinan Ar-Rahman');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const contentCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Tarik Profil Pelajar dari Supabase
    const fetchProfile = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', authData.user.id)
            .single();
          if (profile?.full_name) setStudentName(profile.full_name);
        }
      } catch (err) {
        console.error('Ralat menarik profil:', err);
      }
    };

    fetchProfile();

    // 2. Fetch Senarai Surah Terus dari API Rasmi
    const loadSurahList = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch('https://api.alquran.cloud/v1/surah');
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        
        if (data?.data && Array.isArray(data.data)) {
          setSurahsList(data.data);
          await fetchAyahAndTafsir('1', '1', 'ar-rahman');
        } else {
          throw new Error('Format data surah tidak sah.');
        }
      } catch (err: any) {
        console.error('Ralat memuatkan surah:', err);
        setErrorMsg('Gagal memuatkan senarai surah Al-Quran. Sila pastikan sambungan internet anda aktif.');
        setIsLoading(false);
      }
    };

    loadSurahList();
  }, []);

  const fetchAyahAndTafsir = async (surah: string, ayah: string, sumber: string) => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const [resAr, resMs] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-uthmani`),
        fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ms.basmeih`)
      ]);

      if (!resAr.ok || !resMs.ok) {
        throw new Error('Gagal menarik teks ayat atau terjemahan dari pelayan.');
      }

      const dataAr = await resAr.json();
      const dataMs = await resMs.json();

      let tafsirContent = 'Huraian ayat berpandukan Terjemahan Pimpinan Ar-Rahman (Kementerian Hal Ehwal Islam Malaysia). Sila hayati maksud bait-bait ayat di atas untuk mengukuhkan lagi daya ingatan hafazan anda.';
      let sumberLabel = 'Terjemahan Pimpinan Ar-Rahman';

      if (sumber === 'kemenag') {
        try {
          const resTafsir = await fetch(`https://equran.id/api/v2/tafsir/${surah}`);
          if (resTafsir.ok) {
            const dataTafsir = await resTafsir.json();
            const matchedAyat = dataTafsir?.data?.tafsir?.find(
              (t: { ayat: number; teks: string }) => t.ayat === parseInt(ayah, 10)
            );
            if (matchedAyat?.teks) {
              tafsirContent = matchedAyat.teks;
              sumberLabel = 'Tafsir Ringkas & Huraian Kemenag RI';
            }
          }
        } catch {
          sumberLabel = 'Terjemahan Pimpinan Ar-Rahman (Kemenag Luar Talian)';
        }
      }

      setActiveSumberLabel(sumberLabel);

      // ASINGKAN BASMALAH DARI AYAT 1 BAGI SETIAP SURAH KECUALI SURAH 1 (AL-FATIHAT)
      let cleanedArabicText = dataAr.data.text;
      if (surah !== '1' && ayah === '1') {
        // Regex fleksibel yang memotong teks Basmalah di pangkal ayat tanpa terjejas oleh variasi baris
        cleanedArabicText = cleanedArabicText
          .replace(/^بِسْمِ[\s\S]*?حِيمِ?\s*/u, '')
          .trim();
      }

      setActiveData({
        surahName: dataAr.data.surah.englishName,
        surahNameArabic: dataAr.data.surah.name,
        ayahNum: dataAr.data.numberInSurah,
        juzuk: dataAr.data.juz,
        arabicText: cleanedArabicText,
        translation: dataMs.data.text,
        tafsirFull: tafsirContent
      });

      setTimeout(() => {
        contentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);

    } catch (err: any) {
      console.error(err);
      setErrorMsg('Ralat API: Teks Al-Quran atau terjemahan gagal dimuatkan. Sila semak sambungan internet dan cuba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSurahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sNum = e.target.value;
    setSelectedSurah(sNum);
    const surahInfo = surahsList.find((s) => s.number.toString() === sNum);
    if (surahInfo) {
      setAyahCount(surahInfo.numberOfAyahs);
      setSelectedAyah('1');
      fetchAyahAndTafsir(sNum, '1', selectedSumber);
    }
  };

  const handleAyahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const aNum = e.target.value;
    setSelectedAyah(aNum);
    fetchAyahAndTafsir(selectedSurah, aNum, selectedSumber);
  };

  const handleSumberChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sName = e.target.value;
    setSelectedSumber(sName);
    fetchAyahAndTafsir(selectedSurah, selectedAyah, sName);
  };

  const handleManualSearch = () => {
    fetchAyahAndTafsir(selectedSurah, selectedAyah, selectedSumber);
  };

  return (
    <DashboardLayout userName={studentName} userRole="Pelajar">
      <div className={styles.container}>
        
        <div className={styles.searchCard}>
          <h2 className={styles.headerTitle}>
            <div style={{ backgroundColor: '#eff6ff', padding: '0.6rem', borderRadius: '12px', color: '#0062ff' }}>
              <BookOpenText size={24} />
            </div>
            Eksplorasi Tafsir Lengkap Al-Quran (30 Juzuk)
          </h2>
          
          <div className={styles.searchBar}>
            
            <div className={styles.inputGroup} style={{ flex: 1.4 }}>
              <span className={styles.inputLabel}>Pilih Surah</span>
              <select
                className={styles.selectInput}
                value={selectedSurah}
                onChange={handleSurahChange}
                disabled={surahsList.length === 0}
              >
                {surahsList.length === 0 ? (
                  <option>Memuatkan senarai surah...</option>
                ) : (
                  surahsList.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.number}. {s.englishName} ({s.name})
                    </option>
                  ))
                )}
              </select>
            </div>
            
            <div className={styles.inputGroup}>
              <span className={styles.inputLabel}>Pilih Ayat</span>
              <select
                className={styles.selectInput}
                value={selectedAyah}
                onChange={handleAyahChange}
                disabled={surahsList.length === 0}
              >
                {Array.from({ length: ayahCount }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    Ayat {num}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.inputGroup} style={{ flex: 1.2 }}>
              <span className={styles.inputLabel}>Sumber Tafsir</span>
              <select
                className={styles.selectInput}
                value={selectedSumber}
                onChange={handleSumberChange}
              >
                <option value="ar-rahman">Pimpinan Ar-Rahman (Malaysia)</option>
                <option value="kemenag">Tafsir Kemenag RI (Penuh)</option>
              </select>
            </div>

            <button
              className={styles.searchBtn}
              onClick={handleManualSearch}
              disabled={isLoading || surahsList.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="spinIcon" /> Memuatkan...
                </>
              ) : (
                <>
                  <Search size={18} /> Cari
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '1rem 1.25rem', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #fecaca' }}>
            <AlertCircle size={20} />
            {errorMsg}
          </div>
        )}

        {activeData && !errorMsg && (
          <div 
            className={styles.contentCard} 
            ref={contentCardRef} 
            style={{ 
              opacity: isLoading ? 0.6 : 1, 
              transition: 'opacity 0.25s',
              scrollMarginTop: '90px' 
            }}
          >
            
            <div className={styles.ayahHeader}>
              <h3 className={styles.surahName}>
                {activeData.surahName}{' '}
                <span style={{ color: '#94a3b8', fontSize: '1.05rem', fontWeight: 'normal', fontFamily: '"Amiri Quran", serif' }}>
                  {activeData.surahNameArabic}
                </span>
              </h3>
              <span className={styles.ayahSource}>
                Ayat {activeData.ayahNum} • Juzuk {activeData.juzuk}
              </span>
            </div>

            {/* Pengepala Basmalah khusus ayat 1 bagi surah selain Al-Fatihah (1) dan At-Tawbah (9) */}
            {selectedSurah !== '1' && selectedSurah !== '9' && selectedAyah === '1' && (
              <div style={{
                textAlign: 'center',
                fontFamily: '"Amiri Quran", "Traditional Arabic", serif',
                fontSize: '1.9rem',
                color: '#0f172a',
                padding: '0.5rem 0 1.5rem 0',
                marginBottom: '1rem',
                borderBottom: '1px dashed #e2e8f0',
                direction: 'rtl'
              }}>
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </div>
            )}

            {/* Teks ayat murni tanpa Basmalah bercampur */}
            <div className={styles.arabicText}>
              {activeData.arabicText} <span className={styles.verseEnd}>﴿{activeData.ayahNum}﴾</span>
            </div>

            <div className={styles.translationText}>
              "{activeData.translation}"
            </div>

            <div className={styles.tafsirSection}>
              <div className={styles.tafsirSourceLabel}>
                <Library size={16} /> {activeSumberLabel}
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem 1.5rem', borderRadius: '14px', border: '1px solid #eef2f6' }}>
                <p className={styles.tafsirParagraph} style={{ fontSize: '0.98rem', lineHeight: '1.85', color: '#1e293b' }}>
                  {activeData.tafsirFull}
                </p>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', borderLeft: '4px solid #10b981', padding: '1.1rem 1.4rem', borderRadius: '0 12px 12px 0', marginTop: '0.75rem' }}>
                <h4 style={{ color: '#047857', fontSize: '0.92rem', fontWeight: 800, margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} /> Bimbingan Tadabbur Huffaz
                </h4>
                <p style={{ color: '#065f46', fontSize: '0.86rem', margin: 0, lineHeight: 1.6 }}>
                  Penghafaz disarankan membaca huraian tafsir di atas sekurang-kurangnya sekali sebelum mengulang hafazan (murajaah). Hubungan makna ayat membantu mengelakkan tertukar ayat mutasyabihat.
                </p>
              </div>
            </div>

          </div>
        )}

      </div>

      <style jsx global>{`
        .spinIcon { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </DashboardLayout>
  );
}