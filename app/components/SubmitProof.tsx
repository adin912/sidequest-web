'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type SubmitProofProps = {
  userQuestId: string;
  onUploaded?: (imageUrl: string) => void;
};

export default function SubmitProof({
  userQuestId,
  onUploaded,
}: SubmitProofProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      setMessage('Vyber prosím obrázek.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setMessage('Fotka může mít maximálně 10 MB.');
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setMessage('');
  }

  async function handleSubmit() {
    if (!file) {
      setMessage('Nejdřív vyber fotku.');
      return;
    }

    setUploading(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('Nejsi přihlášený.');
      setUploading(false);
      return;
    }

    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/${userQuestId}.${fileExtension}`;

    // 1. Nahrajeme fotku do Storage
    const { error: uploadError } = await supabase.storage
      .from('proofs')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setUploading(false);
      return;
    }

    // 2. Vytvoříme proof přes bezpečnou RPC funkci
    const { error: proofError } = await supabase.rpc('submit_proof', {
      p_user_quest_id: userQuestId,
      p_image_path: filePath,
    });

    if (proofError) {
      setMessage(proofError.message);
      setUploading(false);
      return;
    }

    setMessage('Fotka odeslána! 🎉');
    setUploading(false);

    if (onUploaded && preview) {
      onUploaded(preview);
    }
  }

  return (
    <div className="mt-5">
      <label
        htmlFor="proof-photo"
        className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-[#8d3157] bg-[#35101f] px-5 py-4 text-center font-bold text-[#ff8ab5] transition hover:bg-[#45152a]"
      >
        {file ? '📸 Změnit fotku' : '📸 Vybrat fotku'}
      </label>

      <input
        id="proof-photo"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {file && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploading}
          className="mt-4 w-full rounded-2xl bg-[#df4f88] px-5 py-4 font-black text-white transition hover:bg-[#ed6098] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? 'Odesílám...' : 'Odevzdat fotku'}
        </button>
      )}

      {message && (
        <p className="mt-4 text-center text-sm text-[#c99aaa]">
          {message}
        </p>
      )}
    </div>
  );
}