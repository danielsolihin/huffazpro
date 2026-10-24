import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('audio') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'Tiada fail audio diterima' }, { status: 400 });
    }

    const groqFormData = new FormData();
    groqFormData.append('file', file, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3'); 
    groqFormData.append('language', 'ar'); 
    // JANGAN TAMBAH PROMPT TEKS SINI Supaya AI tidak autocorrect sebutan pengguna!

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: groqFormData
    });

    const data = await groqRes.json();
    
    if (!groqRes.ok) {
      throw new Error(data.error?.message || 'Ralat semasa memproses AI');
    }

    // Kembalikan Teks Arab Murni yang didengar dari mik
    return NextResponse.json({ text: data.text });

  } catch (error: any) {
    console.error("Ralat API Analyze Audio:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}