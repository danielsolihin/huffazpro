'use client';

import React, { useState, useRef } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Link from 'next/link';
import { 
  Mic, 
  Square, 
  Sparkles, 
  CheckCircle, 
  AlertCircle,
  ArrowRight, 
  Loader2 
} from 'lucide-react';
import styles from './LatihanAI.module.css';

export default function LatihanAIPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    transcription?: string;
    score: number;
    passed: boolean;
    remarks: string[];
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const targetAyahText = 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ';

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToAI(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setResult(null);
    } catch (err) {
      alert('Sila benarkan akses mikrofon pelayar web untuk memulakan latihan AI.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const sendAudioToAI = async (audioBlob: Blob) => {
    setProcessing(true);
    try {
      const audioFile = new File([audioBlob], 'sebutan.webm', { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('targetAyah', targetAyahText);

      const res = await fetch('/api/ai-tasmik', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses audio');

      setResult({
        transcription: data.transcription,
        score: data.score,
        passed: data.passed,
        remarks: data.remarks,
      });
    } catch (err: any) {
      alert(`Ralat pemprosesan AI: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout userName="Ahmad Zaki" userRole="pelajar">
      <div className={styles.container}>
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 700 }}>
            <Sparkles size={20} />
            <span>AI Real-Time Voice Recognition (Groq Whisper v3)</span>
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.35rem' }}>
            Latihan Sebutan & Tajwid Kendiri
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '520px', marginTop: '0.25rem' }}>
            Uji bacaan anda dengan AI sebelum memasuki bilik tasmik guru. Capai skor <strong>85%</strong> ke atas untuk membuka giliran tasmik live.
          </p>

          <div className={styles.ayahDisplay}>
            <p className={styles.ayahArabic}>{targetAyahText}</p>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
              Surah Al-Baqarah: Ayat 153
            </span>
          </div>

          <div className={styles.recordButtonArea}>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={processing}
              className={`${styles.micBtn} ${isRecording ? styles.micBtnRecording : ''}`}
            >
              {isRecording ? <Square size={26} /> : <Mic size={30} />}
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isRecording ? 'var(--danger)' : 'var(--text-secondary)' }}>
              {isRecording ? 'Sedang Merekod Sebutan... (Klik untuk berhenti)' : 'Klik Ikon Mikrofon untuk Mula Baca'}
            </span>
          </div>

          {processing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', color: 'var(--primary)' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enjin AI sedang memproses transkripsi bahasa Arab & ketepatan...</span>
            </div>
          )}

          {result && (
            <div className={styles.resultCard}>
              <div className={styles.scoreRow}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Keputusan Saringan AI</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {result.passed ? 'Kelulusan Diberikan untuk Sesi Guru' : 'Markah belum mencukupi (Sasaran: 85%)'}
                  </span>
                </div>
                <div className={`${styles.scoreBadge} ${result.passed ? styles.scorePass : styles.scoreFail}`}>
                  {result.score}%
                </div>
              </div>

              {result.transcription && (
                <div style={{ margin: '0.75rem 0', padding: '0.75rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Teks Yang Dikesan AI:</span>
                  <p style={{ direction: 'rtl', fontFamily: 'serif', fontSize: '1.15rem' }}>{result.transcription}</p>
                </div>
              )}

              <div className={styles.feedbackList}>
                {result.remarks.map((remark, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    {result.passed ? (
                      <CheckCircle size={16} color="var(--success)" style={{ marginTop: '0.2rem', flexShrink: 0 }} />
                    ) : (
                      <AlertCircle size={16} color="var(--danger)" style={{ marginTop: '0.2rem', flexShrink: 0 }} />
                    )}
                    <span>{remark}</span>
                  </div>
                ))}
              </div>

              {result.passed && (
                <div style={{ textAlign: 'center' }}>
                  <Link href="/pelajar/tasmik-live" className={styles.proceedBtn}>
                    Masuk Bilik Tasmik Live Bersama Guru <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}