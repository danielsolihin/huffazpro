'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { 
  ScrollText, 
  Search, 
  History, 
  CheckCircle2, 
  BookMarked,
  Loader2,
  Info
} from 'lucide-react';
import styles from './AsbabNuzul.module.css';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

interface AsbabItem {
  riwayatStatus: string;
  storyTitle: string;
  storyBody: string[];
  referenceKitab: string;
  hikmahHafazan: string;
}

// =========================================================================
// PANGKALAN DATA ASBAB NUZUL (LENGKAP DENGAN AYAT-AYAT UTAMA AL-QURAN)
// =========================================================================
const asbabDatabase: Record<string, AsbabItem> = {
  // 1. SURAH AT-TAWBAH: AYAT 1
  '9-1': {
    riwayatStatus: 'Sahih al-Bukhari (No. 4655) & Muslim',
    storyTitle: 'Pengisytiharan Pemutusan Perjanjian (Bara\'ah) & Pensucian Kaabah',
    storyBody: [
      'Pada tahun ke-9 Hijrah selepas peristiwa Fathu Makkah dan Perang Tabuk, kaum musyrikin berulang kali melanggar syarat-syarat perjanjian damai yang dimeterai dengan kaum muslimin.',
      'Rasulullah SAW telah mengutus Saidina Abu Bakar As-Siddiq RA sebagai Amirul Hajj (ketua rombongan haji). Sejurus selepas itu, Allah menurunkan awal surah At-Tawbah ini.',
      'Baginda SAW lantas mengutus Saidina Ali bin Abi Thalib RA menunggang unta Baginda (al-Adhba\') untuk menyusul Abu Bakar ke Makkah bagi membacakan maklumat penting ini di hadapan ribuan jemaah: bahawa tiada lagi perlindungan perjanjian bagi kaum kafir musyrik yang khianat selepas tempoh 4 bulan, tiada lagi orang musyrik dibenarkan mendekati Kaabah selepas tahun itu, dan tiada lagi amalan tawaf dalam keadaan telanjang.'
    ],
    referenceKitab: 'Sahih al-Bukhari (Kitab Tafsir al-Quran, No. 4655) & Lubab an-Nuqul fi Asbab an-Nuzul oleh Imam As-Suyuti',
    hikmahHafazan: 'Surah At-Tawbah adalah satu-satunya surah tanpa basmalah di permulaannya kerana ia bermula dengan kata pemutusan dan ketegasan mutlak (Bara\'ah). Mengetahui peristiwa pembacaan Saidina Ali di musim haji ini membantu penghafaz menjiwai ketegasan nada ayat pertama.'
  },

  // 2. SURAH AL-BAQARAH: AYAT 144
  '2-144': {
    riwayatStatus: 'Sahih al-Bukhari (No. 40) & Sahih Muslim',
    storyTitle: 'Peristiwa Pertukaran Kiblat Solat ke Kaabah',
    storyBody: [
      'Ketika Rasulullah SAW berhijrah ke Madinah, Baginda dan para sahabat solat menghadap ke arah Baitulmaqdis (Masjidil Aqsa) selama kira-kira 16 atau 17 bulan. Walau bagaimanapun, Rasulullah SAW amat merindui agar kiblat solat dialihkan ke Kaabah (kiblat Nabi Ibrahim AS).',
      'Baginda kerap memandang dan mendongakkan wajah ke langit memohon petunjuk daripada Allah SWT. Lalu Allah memperkenankan doa Baginda dengan menurunkan ayat ini ketika jemaah sedang bersolat di Masjid al-Qiblatain, lantas mereka terus berpaling menghadap Kaabah dalam solat yang sama.'
    ],
    referenceKitab: 'Sahih al-Bukhari & Muslim daripada Al-Bara\' bin \'Azib RA',
    hikmahHafazan: 'Kefahaman lafaz "Taqalluba wajhika fis-samaa\'" (mendongakkan wajah ke langit) memautkan emosi kerinduan Rasulullah SAW, membolehkan lafaz ayat ini dihafal dengan lancar tanpa keliru.'
  },

  // 3. SURAH AL-MA'IDAH: AYAT 3
  '5-3': {
    riwayatStatus: 'Sahih al-Bukhari (No. 45) & Sahih Muslim',
    storyTitle: 'Penyempurnaan Syariat Islam di Padang Arafah (Haji Wada\')',
    storyBody: [
      'Potongan ayat: "Al-yawma akmaltu lakum dinakum..." (Pada hari ini telah Aku sempurnakan untukmu agamamu) diturunkan pada petang hari Jumaat, Hari Arafah ketika Haji Perpisahan (Haji Wada\').',
      'Diriwayatkan oleh Tariq bin Shihab, seorang pendeta Yahudi pernah berkata kepada Khalifah Umar bin al-Khattab RA: "Wahai Amirul Mukminin, ada satu ayat dalam kitab kamu sekiranya ia turun kepada kaum Yahudi, nescaya kami akan jadikan hari tersebut sebagai hari perayaan tahunan!" Umar menjawab bahawa beliau tahu saat dan tempat ayat itu turun, iaitu sewaktu Rasulullah SAW berdiri berwukuf di Arafah.'
    ],
    referenceKitab: 'Sahih al-Bukhari (Kitab al-Iman) & Asbab an-Nuzul oleh Imam Al-Wahidi',
    hikmahHafazan: 'Ayat ini menandakan syariat Islam telah lengkap dan tiada lagi penambahan hukum. Penghafaz dapat mengingati susunan lafaz kurniaan nikmat: "Akmaltu lakum" (kesempurnaan agama), "Atmamtu \'alaikum ni\'mati" (penyempurnaan nikmat), dan "Radhitu lakumul Islam" (keredhaan Islam).'
  },

  // 4. SURAH AN-NUR: AYAT 11
  '24-11': {
    riwayatStatus: 'Sahih al-Bukhari (No. 4750) & Sahih Muslim',
    storyTitle: 'Fitnah Besar Terhadap Saidatina Aisyah RA (Hadith al-Ifk)',
    storyBody: [
      'Semasa pulang daripada ekspedisi Ghazwah Bani Mustaliq, kalung Saidatina Aisyah RA tercicir sehingga beliau tertinggal di belakang rombongan tentera. Beliau kemudian dibawa pulang ke Madinah oleh seorang sahabat bernama Safwan bin al-Mu\'attal RA.',
      'Tokoh munafik Abdullah bin Ubay bin Salul menyebarkan tuduhan palsu dan fitnah jahat yang menggoncang seluruh Madinah selama sebulan, sehinggalah Allah SWT sendiri menurunkan 10 ayat dalam Surah An-Nur membersihkan nama mulia Ummul Mukminin Aisyah RA dari langit ketujuh.'
    ],
    referenceKitab: 'Sahih al-Bukhari (Kitab al-Maghazi) & Al-Bidayah wan-Nihayah oleh Ibnu Kathir',
    hikmahHafazan: 'Lafaz "Innal-ladhina ja\'u bil-ifki \'ushbatum-minkum" mengandungi rima amaran yang tegas. Mengingati penderitaan dan pembersihan suci Saidatina Aisyah menjadikan 10 ayat ini terakam kukuh dalam hafazan.'
  },

  // 5. SURAH AL-KAHFI: AYAT 9
  '18-9': {
    riwayatStatus: 'Tafsir Ibnu Kathir & Asbab an-Nuzul Al-Wahidi',
    storyTitle: 'Ujian Tiga Soalan oleh Pembesar Quraisy & Pendeta Yahudi Madinah',
    storyBody: [
      'Pemimpin Quraisy Makkah mengutus An-Nadr bin al-Harith dan Uqbah bin Abi Mu\'ait menemui para rahib Yahudi di Madinah untuk bertanyakan bukti kenabian Nabi Muhammad SAW.',
      'Para rahib Yahudi menyuruh mereka menanyakan 3 perkara ghaib: tentang pemuda-pemuda yang hilang pada zaman silam (Ashabul Kahfi), tentang pengembara timur dan barat (Zulqarnain), serta hakikat Roh. Surah Al-Kahfi diturunkan bagi menjawab persoalan-persoalan tersebut secara terperinci.'
    ],
    referenceKitab: 'Sirah Ibnu Hisyam & Lubab an-Nuqul oleh Imam As-Suyuti',
    hikmahHafazan: 'Mengetahui bahawa ayat ini menjawab pertanyaan rahib Yahudi membantu penghafaz memahami permulaan kisah pemuda gua bermula dari ayat 9 hingga 26.'
  },

  // 6. SURAH AL-JUMU'AH: AYAT 11
  '62-11': {
    riwayatStatus: 'Sahih al-Bukhari (No. 2058) & Sahih Muslim',
    storyTitle: 'Ketibaan Kafilah Perdagangan Semasa Khutbah Jumaat',
    storyBody: [
      'Ketika Rasulullah SAW sedang menyampaikan khutbah Jumaat, kafilah dagang Dihyah bin Khalifah al-Kalbi tiba dari Syam dengan membunyikan gendang menandakan jualan barangan keperluan tiba di Madinah yang sedang mengalami kesukaran makanan.',
      'Mendengar paluan gendang tersebut, sebahagian besar jemaah bergegas keluar menuju ke kawasan perniagaan sehingga hanya tinggal 12 orang sahabat sahaja yang setia berdiri bersama Rasulullah SAW di dalam masjid. Lalu Allah menegur perbuatan tersebut menerusi ayat ini.'
    ],
    referenceKitab: 'Sahih al-Bukhari & Sahih Muslim daripada Jabir bin Abdillah RA',
    hikmahHafazan: 'Lafaz "Wa idza ra\'aw tijaratan aw lahwanin-fadh-dhu ilayha wa tarakuka qa-ima" melukiskan situasi Baginda ditinggalkan berdiri (qa-ima), membimbing susunan kata agar tidak terbalik.'
  },

  // 7. SURAH AD-DUHA: AYAT 1
  '93-1': {
    riwayatStatus: 'Sahih al-Bukhari (No. 4950)',
    storyTitle: 'Teguran Wanita Musyrikin Semasa Wahyu Terhenti Seketika (Fatrah al-Wahy)',
    storyBody: [
      'Nabi Muhammad SAW mengalami keuzuran selama dua atau tiga malam sehingga tidak dapat mendirikan solat tahajjud. Dalam tempoh itu juga Malaikat Jibril AS tidak turun membawa wahyu.',
      'Seorang wanita musyrikin (Ummu Jamil, isteri Abu Lahab) datang mencemuh Baginda: "Wahai Muhammad! Aku fikir syaitanmu (merujuk kepada wahyu) telah meninggalkan dan membencimu!" Allah SWT menurunkan surah Ad-Duha untuk menenteramkan dan memuliakan kedudukan Baginda.'
    ],
    referenceKitab: 'Sahih al-Bukhari daripada Jundub bin Sufyan al-Bajali RA',
    hikmahHafazan: 'Mengetahui surah ini sebagai penenang emosi Rasulullah SAW memudahkan penghafaz melafazkan sumpah waktu Dhuha dan malam dengan tona tartil yang syahdu.'
  },

  // 8. SURAH AL-MASAD / AL-LAHAB: AYAT 1
  '111-1': {
    riwayatStatus: 'Sahih al-Bukhari (No. 4971) & Sahih Muslim',
    storyTitle: 'Seruan di Bukit Safa & Tempelakan Abu Lahab',
    storyBody: [
      'Apabila turun ayat dakwah terang-terangan, Rasulullah SAW berdiri di Bukit Safa menyeru kabilah-kabilah Quraisy. Baginda memberi amaran azab hari akhirat sekiranya mereka enggan beriman kepada Allah.',
      'Abu Lahab tampil ke hadapan dalam keadaan marah seraya berkata: "Tabban laka sa\'iral-yawm! (Celakalah engkau sepanjang hari ini! Kerana inikah engkau memanggil kami?)." Maka Allah membalas celaan itu dengan menurunkan: "Tabbat yada Abi Lahibiw-watabb".'
    ],
    referenceKitab: 'Sahih al-Bukhari & Sahih Muslim daripada Ibnu Abbas RA',
    hikmahHafazan: 'Lafaz "Tabbat" (Binasalah) merupakan pembalasan terus terhadap kata "Tabban" yang dilontarkan oleh Abu Lahab kepada Baginda SAW.'
  }
};

export default function AsbabNuzulPage() {
  const [surahsList, setSurahsList] = useState<Surah[]>([]);
  
  // Set default ke Surah 9 (At-Tawbah), Ayat 1
  const [selectedSurah, setSelectedSurah] = useState('9');
  const [selectedAyah, setSelectedAyah] = useState('1');
  const [ayahCount, setAyahCount] = useState(129);
  
  const [activeData, setActiveData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const contentCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then((res) => res.json())
      .then((data) => {
        setSurahsList(data.data);
        fetchAyahAndAsbab('9', '1'); // Muatkan At-Tawbah 1 sebagai default
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg('Gagal memuatkan senarai surah.');
        setIsLoading(false);
      });
  }, []);

  const fetchAyahAndAsbab = async (surah: string, ayah: string) => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const [resAr, resMs] = await Promise.all([
        fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-uthmani`),
        fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ms.basmeih`)
      ]);

      const dataAr = await resAr.json();
      const dataMs = await resMs.json();

      if (dataAr.code === 200 && dataMs.code === 200) {
        const dbKey = `${surah}-${ayah}`;
        const asbabInfo = asbabDatabase[dbKey] || null;

        let cleanedArabic = dataAr.data.text;
        const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ";
        if (surah !== '1' && ayah === '1' && cleanedArabic.startsWith(BISMILLAH)) {
          cleanedArabic = cleanedArabic.replace(BISMILLAH, '');
        }

        setActiveData({
          surahName: dataAr.data.surah.englishName,
          surahNameArabic: dataAr.data.surah.name,
          category: dataAr.data.surah.revelationType === 'Meccan' ? 'Makkiyyah' : 'Madaniyyah',
          ayahNum: dataAr.data.numberInSurah,
          juzuk: dataAr.data.juz,
          arabicText: cleanedArabic,
          translation: dataMs.data.text,
          asbabData: asbabInfo
        });

        setTimeout(() => {
          contentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);

      } else {
        setErrorMsg('Ayat tidak dijumpai.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Ralat menyambung ke pelayan API. Sila pastikan sambungan internet stabil.');
    }

    setIsLoading(false);
  };

  const handleSurahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sNum = e.target.value;
    setSelectedSurah(sNum);
    const surahInfo = surahsList.find((s) => s.number.toString() === sNum);
    if (surahInfo) {
      setAyahCount(surahInfo.numberOfAyahs);
      setSelectedAyah('1');
      fetchAyahAndAsbab(sNum, '1');
    }
  };

  const handleAyahChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const aNum = e.target.value;
    setSelectedAyah(aNum);
    fetchAyahAndAsbab(selectedSurah, aNum);
  };

  const jumpToPopular = (surah: string, ayah: string) => {
    setSelectedSurah(surah);
    const surahInfo = surahsList.find((s) => s.number.toString() === surah);
    if (surahInfo) setAyahCount(surahInfo.numberOfAyahs);
    setSelectedAyah(ayah);
    fetchAyahAndAsbab(surah, ayah);
  };

  return (
    <DashboardLayout userName="Roslan Tahir" userRole="pelajar">
      <div className={styles.container}>
        
        {/* KAD CARIAN */}
        <div className={styles.searchCard}>
          <h2 className={styles.headerTitle}>
            <div style={{ backgroundColor: '#f3e8ff', padding: '0.6rem', borderRadius: '12px', color: '#8b5cf6' }}>
              <ScrollText size={24} />
            </div>
            Koleksi & Asbabun Nuzul Ayat
          </h2>
          
          <div className={styles.searchBar}>
            <div className={styles.inputGroup} style={{ flex: 1.5 }}>
              <span className={styles.inputLabel}>Pilih Surah</span>
              <select className={styles.selectInput} value={selectedSurah} onChange={handleSurahChange} disabled={surahsList.length === 0}>
                {surahsList.length === 0 ? <option>Memuatkan Surah...</option> : surahsList.map((s) => (
                  <option key={s.number} value={s.number}>{s.number}. {s.englishName} ({s.name})</option>
                ))}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <span className={styles.inputLabel}>Pilih Ayat</span>
              <select className={styles.selectInput} value={selectedAyah} onChange={handleAyahChange} disabled={surahsList.length === 0}>
                {Array.from({ length: ayahCount }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>Ayat {num}</option>
                ))}
              </select>
            </div>

            <button className={styles.searchBtn} onClick={() => fetchAyahAndAsbab(selectedSurah, selectedAyah)} disabled={isLoading || surahsList.length === 0} style={{ backgroundColor: '#8b5cf6' }}>
              {isLoading ? <><Loader2 size={18} className="spinIcon" /> Memuatkan</> : <><Search size={18} /> Semak Ayat</>}
            </button>
          </div>

          {/* Tag Pintasan Pantas Asbab Nuzul Masyhur */}
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginRight: '0.2rem' }}>Pilihan Utama:</span>
            <button onClick={() => jumpToPopular('9', '1')} style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', color: '#6d28d9', fontWeight: 700 }}>At-Tawbah: Pemutusan Perjanjian (9:1)</button>
            <button onClick={() => jumpToPopular('2', '144')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>Al-Baqarah: Tukar Kiblat (2:144)</button>
            <button onClick={() => jumpToPopular('5', '3')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>Al-Ma'idah: Haji Wada' (5:3)</button>
            <button onClick={() => jumpToPopular('24', '11')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>An-Nur: Hadith al-Ifk (24:11)</button>
            <button onClick={() => jumpToPopular('62', '11')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>Al-Jumu'ah: Khutbah Jumaat (62:11)</button>
            <button onClick={() => jumpToPopular('93', '1')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>Ad-Duha: Wahyu Terhenti (93:1)</button>
            <button onClick={() => jumpToPopular('111', '1')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', color: '#475569', fontWeight: 600 }}>Al-Masad: Kutukan Abu Lahab (111:1)</button>
          </div>
        </div>

        {errorMsg && <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '12px', fontWeight: 600 }}>{errorMsg}</div>}

        {/* KAD KANDUNGAN ASBAB NUZUL */}
        {activeData && !errorMsg && (
          <div className={styles.contentCard} ref={contentCardRef} style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.25s', scrollMarginTop: '90px' }}>
            
            <div className={styles.ayahHeader}>
              <div className={styles.surahNameGroup}>
                <h3 className={styles.surahName} style={{ color: '#8b5cf6' }}>{activeData.surahName} <span style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 'normal', fontFamily: '"Amiri Quran", serif' }}>{activeData.surahNameArabic}</span></h3>
                <span className={styles.badgeCategory} style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>{activeData.category}</span>
              </div>
              <div className={styles.ayahMeta}>
                <span className={styles.ayahSource}>Ayat {activeData.ayahNum} • Juzuk {activeData.juzuk}</span>
                {activeData.asbabData && (
                  <span className={styles.badgeRiwayat}>{activeData.asbabData.riwayatStatus}</span>
                )}
              </div>
            </div>

            <div className={styles.arabicText}>
              {activeData.arabicText} <span className={styles.verseEnd}>﴿{activeData.ayahNum}﴾</span>
            </div>

            <div className={styles.translationText}>
              "{activeData.translation}"
            </div>

            {/* SEKSYEN ASBAB NUZUL */}
            <div className={styles.storySection}>
              <div className={styles.sectionHeader}>
                <History size={18} /> Sebab Penurunan Ayat (Asbab Nuzul)
              </div>

              {activeData.asbabData ? (
                <>
                  <div className={styles.storyCard}>
                    <h4 className={styles.storyTitle}>{activeData.asbabData.storyTitle}</h4>
                    {activeData.asbabData.storyBody.map((par: string, pIdx: number) => (
                      <p key={pIdx} className={styles.storyParagraph}>{par}</p>
                    ))}
                    <div className={styles.riwayatSourceText}>
                      <BookMarked size={15} /> Sumber Rujukan Hadis / Kitab: {activeData.asbabData.referenceKitab}
                    </div>
                  </div>

                  <div className={styles.hikmahBox}>
                    <h4 className={styles.hikmahTitle}>
                      <CheckCircle2 size={18} /> Kaitan Dengan Kelancaran Hafazan
                    </h4>
                    <p className={styles.hikmahDesc}>
                      {activeData.asbabData.hikmahHafazan}
                    </p>
                  </div>
                </>
              ) : (
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: '#e2e8f0', padding: '0.75rem', borderRadius: '50%', color: '#64748b' }}>
                    <Info size={24} />
                  </div>
                  <h4 style={{ fontSize: '1.05rem', color: '#1e293b', margin: 0, fontWeight: 800 }}>Tiada Riwayat Asbab Nuzul Khusus Bagi Ayat Ini</h4>
                  <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, maxWidth: '520px', lineHeight: 1.6 }}>
                    Kebanyakan ayat Al-Quran diturunkan secara ibtida'i (permulaan syariat, aqidah, hukum munakahat, atau kisah umat terdahulu) tanpa didahului oleh suatu insiden tertentu. Anda boleh merujuk maksud dan huraian ayat ini di halaman <strong>Tafsir Al-Quran</strong>.
                  </p>
                </div>
              )}
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