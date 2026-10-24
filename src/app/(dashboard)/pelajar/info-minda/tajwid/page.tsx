'use client';

import React, { useState, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Highlighter, Volume2, Square, Info } from 'lucide-react';
import styles from './Tajwid.module.css';

interface TajwidRule {
  id: string;
  name: string;
  bacaan: string;
  borderColor: string;
  hurufLabel: string;
  hurufList: string[];
  arabicExample: string;
  audioUrl: string;
  explanation: string;
}

interface TajwidCategory {
  id: string;
  title: string;
  fullTitle: string;
  description: string;
  rules: TajwidRule[];
}

// Gunakan style khusus yang tidak memisahkan huruf
const redMark = 'style="color: #ef4444; font-weight: 800; text-decoration: underline; text-decoration-color: #ef4444; text-decoration-style: dashed; text-underline-offset: 10px; display: inline-block;"';

const TAJWID_DATA: Record<string, TajwidCategory> = {
  'nun-sakinah': {
    id: 'nun-sakinah',
    title: '1. Hukum Nun Sakinah & Tanwin',
    fullTitle: 'Hukum Nun Sakinah (نْ) dan Tanwin (ً- ٍ- ٌ-)',
    description: 'Apabila huruf Nun Sakinah (Mati) atau Tanwin bertemu dengan huruf-huruf hijaiyah, cara bacaannya terbahagi kepada 4 hukum utama bergantung kepada huruf yang mengikutinya.',
    rules: [
      {
        id: 'izhar-halqi',
        name: '1. Izhar Halqi',
        bacaan: 'Bacaan: Jelas & Nyata (Tanpa Dengung)',
        borderColor: '#0062ff',
        hurufLabel: 'HURUF (6):',
        hurufList: ['ء', 'هـ', 'ع', 'ح', 'غ', 'خ'],
        arabicExample: `وَلَمْ يَكُن لَّهُۥ <span ${redMark}>كُفُوًا أَحَدٌ</span>`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/112004.mp3', 
        explanation: 'Tanwin (Fathatain) bertemu Hamzah. Dibaca jelas tanpa didengungkan.'
      },
      {
        id: 'idgham',
        name: '2. Idgham (Bighunnah)',
        bacaan: 'Bacaan: Masuk & Dengung (2 Harakat)',
        borderColor: '#ec4899',
        hurufLabel: 'HURUF (4): يَنْمُو',
        hurufList: ['ي', 'ن', 'م', 'و'],
        arabicExample: `تَبَّتْ يَدَآ أَبِى <span ${redMark}>لَهَبٍۢ وَتَبَّ</span>`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/111001.mp3', 
        explanation: 'Tanwin Kasrah bertemu Waw. Dimasukkan ke dalam Waw berserta dengung.'
      },
      {
        id: 'iqlab',
        name: '3. Iqlab',
        bacaan: 'Bacaan: Tukar kepada Mim (Dengung)',
        borderColor: '#f59e0b',
        hurufLabel: 'HURUF (1):',
        hurufList: ['ب'],
        arabicExample: `كَلَّا ۖ <span ${redMark}>لَيُنبَذَنَّ</span> فِى ٱلْحُطَمَةِ`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/104004.mp3', 
        explanation: 'Nun mati bertemu Ba\'. Bunyi Nun ditukar kepada bunyi Mim dan didengungkan.'
      },
      {
        id: 'ikhfa-haqiqi',
        name: '4. Ikhfa\' Haqiqi',
        bacaan: 'Bacaan: Sembunyi & Dengung (2 Harakat)',
        borderColor: '#10b981',
        hurufLabel: 'HURUF (15 Baki):',
        hurufList: ['ت', 'ث', 'ج', 'د', 'ذ', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ف', 'ق', 'ك'],
        arabicExample: `<span ${redMark}>مِن شَرِّ</span> مَا خَلَقَ`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/113002.mp3', 
        explanation: 'Nun mati bertemu Syin. Sembunyikan bunyi Nun ke arah Syin berserta dengung.'
      }
    ]
  },
  'mim-sakinah': {
    id: 'mim-sakinah',
    title: '2. Hukum Mim Sakinah',
    fullTitle: 'Hukum Mim Sakinah (مْ)',
    description: 'Apabila huruf Mim Mati (مْ) bertemu dengan salah satu daripada huruf hijaiyah, cara sebutannya terbahagi kepada 3 hukum khusus.',
    rules: [
      {
        id: 'ikhfa-syafawi',
        name: '1. Ikhfa\' Syafawi',
        bacaan: 'Bacaan: Samar di Dua Bibir + Dengung',
        borderColor: '#ec4899',
        hurufLabel: 'HURUF (1):',
        hurufList: ['ب'],
        arabicExample: `تَرْمِي<span ${redMark}>هِم بِحِجَارَةٍ</span>`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/105004.mp3', 
        explanation: 'Mim mati bertemu Ba\'. Rapatkan dua bibir lembut berserta dengung 2 harakat.'
      },
      {
        id: 'idgham-mimi',
        name: '2. Idgham Mithlain / Mimi',
        bacaan: 'Bacaan: Memasukkan Mim + Dengung',
        borderColor: '#8b5cf6',
        hurufLabel: 'HURUF (1):',
        hurufList: ['م'],
        arabicExample: `ٱلَّذِىٓ أَطْعَمَ<span ${redMark}>هُم مِّن</span> جُوعٍ`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/106004.mp3', 
        explanation: 'Mim mati bertemu Mim. Dimasukkan sepenuhnya menjadi sabdu dengan ghunnah.'
      },
      {
        id: 'izhar-syafawi',
        name: '3. Izhar Syafawi',
        bacaan: 'Bacaan: Jelas & Nyata (Tanpa Dengung)',
        borderColor: '#0062ff',
        hurufLabel: 'HURUF (26 Baki):',
        hurufList: ['ء', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'ن', 'هـ', 'و', 'ي'],
        arabicExample: `<span ${redMark}>لَمْ يَلِدْ</span> وَ<span ${redMark}>لَمْ يُولَدْ</span>`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/112003.mp3', 
        explanation: 'Mim mati bertemu Ya\'. Disebut jelas dan rapat bibir tanpa sebarang dengung.'
      }
    ]
  },
  'hukum-mad': {
    id: 'hukum-mad',
    title: '3. Hukum Mad (Pemanjangan Suara)',
    fullTitle: 'Hukum Mad (Panjang Bacaan Harakat)',
    description: 'Mad bermaksud memanjangkan sebutan suara pada huruf-huruf mad (ا , و , ي) mengikut kadar harakat yang disyariatkan.',
    rules: [
      {
        id: 'mad-asli',
        name: '1. Mad Asli / Thobi\'i',
        bacaan: 'Kadar Panjang: 2 Harakat',
        borderColor: '#0062ff',
        hurufLabel: 'HURUF MAD (3):',
        hurufList: ['ا', 'و', 'ي'],
        arabicExample: `أَلَمْ يَجْعَلْ كَيْدَهُمْ <span ${redMark}>فِى</span> تَضْلِيلٍ`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/105002.mp3', 
        explanation: 'Huruf mad (Ya) pada kalimah "fii" tiada hamzah atau sukun selepasnya; dibaca tepat 2 harakat.'
      },
      {
        id: 'mad-wajib',
        name: '2. Mad Wajib Muttasil',
        bacaan: 'Kadar Panjang: 4 atau 5 Harakat (Wajib)',
        borderColor: '#ef4444',
        hurufLabel: 'SYARAT:',
        hurufList: ['Mad + ء', 'Satu Kalimah'],
        arabicExample: `إِذَا <span ${redMark}>جَآءَ</span> نَصْرُ ٱللَّهِ`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/110001.mp3', 
        explanation: 'Huruf mad bertemu Hamzah dalam SATU kalimah. Wajib dipanjangkan 4-5 harakat.'
      },
      {
        id: 'mad-jaiz',
        name: '3. Mad Jaiz Munfasil',
        bacaan: 'Kadar Panjang: 4 atau 5 Harakat (Harus)',
        borderColor: '#f59e0b',
        hurufLabel: 'SYARAT:',
        hurufList: ['Mad + ء', 'Dua Kalimah'],
        arabicExample: `<span ${redMark}>إِنَّآ أَعْطَيْنَـٰكَ</span> ٱلْكَوْثَرَ`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/108001.mp3', 
        explanation: 'Huruf mad di hujung kalimah pertama bertemu Hamzah di permulaan kalimah kedua.'
      },
      {
        id: 'mad-aridh',
        name: '4. Mad \'Aridh Lissukun',
        bacaan: 'Kadar Panjang: 2, 4, atau 6 Harakat',
        borderColor: '#10b981',
        hurufLabel: 'SYARAT:',
        hurufList: ['Mad + Waqaf'],
        arabicExample: `ٱلْحَمْدُ لِلَّهِ رَبِّ <span ${redMark}>ٱلْعَـٰلَمِينَ</span>`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/001002.mp3', 
        explanation: 'Huruf mad pada "miin" dimatikan huruf selepasnya kerana berhenti (waqaf).'
      }
    ]
  },
  'qalqalah': {
    id: 'qalqalah',
    title: '4. Hukum Qalqalah (Lantunan Bunyi)',
    fullTitle: 'Hukum Qalqalah (قلقلة)',
    description: 'Qalqalah ialah gegaran atau lantunan suara yang terbit apabila menyebut huruf-huruf qalqalah (ق, ط, ب, ج, د) dalam keadaan sukun (mati) atau waqaf.',
    rules: [
      {
        id: 'qalqalah-sughra',
        name: '1. Qalqalah Sughra (Kecil)',
        bacaan: 'Lantunan: Sederhana Ringan (Tengah Bacaan)',
        borderColor: '#38bdf8',
        hurufLabel: 'HURUF (5): قطب جد',
        hurufList: ['ق', 'ط', 'ب', 'ج', 'د'],
        arabicExample: `<span ${redMark}>ٱقْرَأْ</span> بِٱسْمِ رَبِّكَ ٱلَّذِى خَلَقَ`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/096001.mp3', 
        explanation: 'Huruf Qaf berbaris sukun di pertengahan kalimah; dilantunkan secara ringan.'
      },
      {
        id: 'qalqalah-kubra',
        name: '2. Qalqalah Kubra (Besar)',
        bacaan: 'Lantunan: Kuat & Jelas (Ketika Waqaf)',
        borderColor: '#f59e0b',
        hurufLabel: 'SYARAT:',
        hurufList: ['Sukun Aridh', 'Waqaf'],
        arabicExample: `قُلْ أَعُوذُ بِرَبِّ <span ${redMark}>ٱلْفَلَقِ</span>`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/113001.mp3', 
        explanation: 'Huruf Qaf di hujung ayat yang dimatikan bacaannya kerana berhenti (waqaf).'
      },
      {
        id: 'qalqalah-akbar',
        name: '3. Qalqalah Akbar (Paling Kuat)',
        bacaan: 'Lantunan: Tertahan Seketika Lalu Lepas',
        borderColor: '#ef4444',
        hurufLabel: 'SYARAT:',
        hurufList: ['Bersabdu (ّ)', 'Waqaf'],
        arabicExample: `تَبَّتْ يَدَآ أَبِى لَهَبٍۢ <span ${redMark}>وَتَبَّ</span>`,
        audioUrl: 'https://everyayah.com/data/Alafasy_128kbps/111001.mp3', 
        explanation: 'Huruf qalqalah (Ba) yang bertanda sabdu di hujung kalimah ketika diwaqafkan.'
      }
    ]
  }
};

export default function HukumTajwidPage() {
  const [studentName, setStudentName] = useState<string>('Pelajar');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string>('nun-sakinah');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const activeCategory = TAJWID_DATA[selectedCategoryKey];
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', authData.user.id)
            .single();

          if (profile?.full_name) {
            setStudentName(profile.full_name);
          }
        }
      } catch (err) {
        console.error('Ralat menarik profil:', err);
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingAudioId(null);
    }
  }, [selectedCategoryKey]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlayAudio = (id: string, url: string) => {
    if (playingAudioId === id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingAudioId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingAudioId(id);

    audio.play().catch((err) => {
      console.error('Ralat memainkan audio:', err);
      setPlayingAudioId(null);
    });

    audio.onended = () => {
      setPlayingAudioId(null);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setPlayingAudioId(null);
      audioRef.current = null;
    };
  };

  return (
    <DashboardLayout userName={studentName} userRole="pelajar">
      <div className={styles.container}>
        
        {/* KAD PILIHAN KATEGORI ATAS */}
        <div className={styles.headerCard}>
          <div className={styles.titleRow}>
            <div className={styles.iconBox}>
              <Highlighter size={22} />
            </div>
            <h1 className={styles.mainTitle}>Pusat Rujukan Tajwid Interaktif</h1>
          </div>

          <div className={styles.selectGroup}>
            <label className={styles.selectLabel}>Pilih Kategori Hukum Tajwid</label>
            <select 
              className={styles.categorySelect}
              value={selectedCategoryKey}
              onChange={(e) => setSelectedCategoryKey(e.target.value)}
            >
              <option value="nun-sakinah">1. Hukum Nun Sakinah & Tanwin</option>
              <option value="mim-sakinah">2. Hukum Mim Sakinah</option>
              <option value="hukum-mad">3. Hukum Mad (Pemanjangan Suara)</option>
              <option value="qalqalah">4. Hukum Qalqalah (Lantunan Bunyi)</option>
            </select>
          </div>
        </div>

        {/* KAD KANDUNGAN DINAMIK */}
        <div className={styles.contentCard}>
          
          <div className={styles.sectionHeader}>
            <h2 className={styles.categoryHeading}>{activeCategory.fullTitle}</h2>
            <p className={styles.categoryDesc}>{activeCategory.description}</p>
          </div>

          {/* GRID KAD-KAD HUKUM */}
          <div className={styles.rulesGrid}>
            {activeCategory.rules.map((rule) => {
              const isPlaying = playingAudioId === rule.id;

              return (
                <div 
                  key={rule.id} 
                  className={styles.ruleCard}
                  style={{ borderTop: `4px solid ${rule.borderColor}` }}
                >
                  <div className={styles.cardHead}>
                    <h3 className={styles.ruleName}>{rule.name}</h3>
                    <p className={styles.readingMethod}>{rule.bacaan}</p>
                  </div>

                  {/* Senarai Huruf */}
                  <div className={styles.hurufSection}>
                    <span className={styles.hurufLabel}>{rule.hurufLabel}</span>
                    <div className={styles.hurufBadgesRow}>
                      {rule.hurufList.map((huruf, idx) => (
                        <div key={idx} className={styles.hurufBadge}>
                          {huruf}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kotak Contoh Ayat & Audio */}
                  <div className={styles.exampleBox}>
                    <div className={styles.exampleHeader}>
                      <span className={styles.exampleTag}>CONTOH AYAT</span>
                      
                      <button 
                        className={`${styles.audioBtn} ${isPlaying ? styles.audioBtnPlaying : ''}`}
                        title={isPlaying ? "Berhenti" : "Dengar Sebutan Qari"}
                        onClick={() => handleTogglePlayAudio(rule.id, rule.audioUrl)}
                      >
                        {isPlaying ? <Square size={13} fill="currentColor" /> : <Volume2 size={15} />}
                      </button>
                    </div>

                    {/* Paparan Teks */}
                    <div 
                      className={styles.arabicVerse}
                      dangerouslySetInnerHTML={{ __html: rule.arabicExample }}
                    />

                    <div className={styles.noteRow}>
                      <Info size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#94a3b8' }} />
                      <span>{rule.explanation}</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}