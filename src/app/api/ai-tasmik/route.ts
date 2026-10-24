import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Fungsi membuang tanda baca/baris Arab untuk perbandingan asas
function bersihkanTeksArab(teks: string): string {
  return teks
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // Buang baris & tanda tajwid
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

// Algoritma mengira peratusan padanan perkataan
function hitungSkorPadanan(sebutanPelajar: string, ayatSasaran: string): number {
  const kataSebutan = bersihkanTeksArab(sebutanPelajar).split(/\s+/).filter(Boolean);
  const kataSasaran = bersihkanTeksArab(ayatSasaran).split(/\s+/).filter(Boolean);

  if (kataSasaran.length === 0) return 0;

  let padanan = 0;
  kataSasaran.forEach((target) => {
    if (kataSebutan.includes(target)) {
      padanan += 1;
    }
  });

  const skor = Math.round((padanan / kataSasaran.length) * 100);
  return Math.min(Math.max(skor, 10), 100);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const targetAyah = formData.get('targetAyah') as string;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Fail rakaman audio tidak ditemui.' },
        { status: 400 }
      );
    }

    // 1. Hantar audio ke enjin Whisper di Groq
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      language: 'ar',
      response_format: 'json',
      temperature: 0.0,
    });

    const recognizedText = transcription.text || '';
    const score = hitungSkorPadanan(recognizedText, targetAyah || '');
    const passed = score >= 85;

    // 2. Jana ulasan semakan
    const remarks: string[] = [];
    if (score >= 90) {
      remarks.push('Makhraj dan urutan kalimah ayat dibaca dengan sangat tepat (Mutqan).');
      remarks.push('Kelancaran memuaskan dan tiada kalimah tercicir.');
    } else if (score >= 80) {
      remarks.push('Sebutan kalimah sebahagian besarnya tepat.');
      remarks.push('Sila semak semula beberapa kalimah yang mungkin kurang jelas sebutannya.');
    } else {
      remarks.push('Terdapat beberapa kalimah ayat yang tidak sepadan atau tidak lengkap.');
      remarks.push('Sila ulang semula bacaan sebelum melangkah ke bilik tasmik guru.');
    }

    return NextResponse.json({
      transcription: recognizedText,
      score,
      passed,
      remarks,
    });
  } catch (error: any) {
    console.error('Ralat Groq Whisper:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses analisis suara AI.' },
      { status: 500 }
    );
  }
}