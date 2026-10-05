'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type AcceptQuestButtonProps = {
  questId: string;
  onAccepted: (userQuest: { id: string; status: string }) => void;
};

export default function AcceptQuestButton({
  questId,
  onAccepted,
}: AcceptQuestButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function acceptQuest() {
    setLoading(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('Nejsi přihlášený.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_quests')
      .insert({
        user_id: user.id,
        quest_id: questId,
        status: 'accepted',
      })
      .select('id, status')
      .single();

    if (error) {
      if (error.code === '23505') {
        setMessage('Tento quest už máš přijatý.');
      } else {
        setMessage(error.message);
      }

      setLoading(false);
      return;
    }

    onAccepted(data);

    setMessage('Quest přijat! 🎯');
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={acceptQuest}
        disabled={loading}
        className="mt-8 w-full rounded-2xl bg-violet-600 px-5 py-4 text-lg font-bold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Přijímám...' : 'Přijmout quest'}
      </button>

      {message && (
        <p className="mt-4 text-center text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
}