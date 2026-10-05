'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
  username: string | null;
  xp: number;
  streak: number;
  quests_completed: number;
};

type ProfileProof = {
  id: string;
  imageUrl: string;
  questTitle: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

function getAnimal(streak: number) {
  if (streak >= 100) return '🐉';
  if (streak >= 76) return '🦅';
  if (streak >= 51) return '🐺';
  if (streak >= 31) return '🦊';
  if (streak >= 11) return '🐢';
  return '🐌';
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [proofs, setProofs] = useState<ProfileProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    setEmail(user.email ?? '');

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('username, xp, streak, quests_completed')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error(profileError);
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    setProfile({
      username: profileData.username,
      xp: profileData.xp ?? 0,
      streak: profileData.streak ?? 0,
      quests_completed: profileData.quests_completed ?? 0,
    });

    /*
     * Načteme všechny questy tohoto uživatele.
     *
     * Důležité:
     * Historie fotek nesmí záviset na kamarádech ani na tom,
     * jestli někdo aktuálně hlasuje o důkazu.
     */
    const { data: userQuests, error: userQuestError } = await supabase
      .from('user_quests')
      .select('id, quest_id, status')
      .eq('user_id', user.id);

    if (userQuestError) {
      console.error(userQuestError);
      setMessage(userQuestError.message);
      setLoading(false);
      return;
    }

    if (!userQuests || userQuests.length === 0) {
      setProofs([]);
      setLoading(false);
      return;
    }

    const userQuestIds = userQuests.map((item) => item.id);
    const questIds = [...new Set(userQuests.map((item) => item.quest_id))];

    /*
     * Načteme všechny důkazy najednou.
     *
     * status bereme přímo z proofs.
     * Není potřeba znovu počítat hlasování kamarádů.
     */
    const [{ data: proofRows, error: proofError }, { data: quests, error: questsError }] =
      await Promise.all([
        supabase
          .from('proofs')
          .select('id, user_quest_id, image_url, created_at, status')
          .in('user_quest_id', userQuestIds)
          .order('created_at', { ascending: false }),

        supabase
          .from('quests')
          .select('id, title')
          .in('id', questIds),
      ]);

    if (proofError) {
      console.error(proofError);
      setMessage(proofError.message);
      setLoading(false);
      return;
    }

    if (questsError) {
      console.error(questsError);
      setMessage(questsError.message);
      setLoading(false);
      return;
    }

    if (!proofRows || proofRows.length === 0) {
      setProofs([]);
      setLoading(false);
      return;
    }

    const history: ProfileProof[] = [];

    for (const proof of proofRows) {
      const userQuest = userQuests.find(
        (item) => item.id === proof.user_quest_id
      );

      if (!userQuest) {
        continue;
      }

      const quest = quests?.find(
        (item) => item.id === userQuest.quest_id
      );

      if (!quest) {
        continue;
      }

      /*
       * Storage je private, takže pro každou fotku vytvoříme
       * nový aktuální signed URL.
       */
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from('proofs')
          .createSignedUrl(proof.image_url, 60 * 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(
          'Nepodařilo se vytvořit URL pro fotku:',
          proof.id,
          signedUrlError
        );
        continue;
      }

      const status: ProfileProof['status'] =
        proof.status === 'approved'
          ? 'approved'
          : proof.status === 'rejected'
            ? 'rejected'
            : 'pending';

      history.push({
        id: proof.id,
        imageUrl: signedUrlData.signedUrl,
        questTitle: quest.title,
        status,
        createdAt: proof.created_at,
      });
    }

    setProofs(history);
    setLoading(false);
  }

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      setLoggingOut(false);
      return;
    }

    window.location.href = '/login';
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#16070d] text-white">
        <p className="text-[#d6a8b9]">
          Načítám profil...
        </p>
      </main>
    );
  }

  const username = profile?.username ?? 'hráč';
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;
  const completedQuests = profile?.quests_completed ?? 0;
  const animal = getAnimal(streak);

  return (
    <main className="min-h-screen bg-[#16070d] text-white">
      <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-5 sm:px-6">

        <header className="mx-auto flex max-w-3xl items-center justify-between border-b border-[#3a1826] pb-5">
          <a
            href="/"
            className="text-sm font-bold text-[#b98c9f] transition hover:text-white"
          >
            ← Domů
          </a>

          <h1 className="text-lg font-black">
            Profil
          </h1>

          <div className="w-12" />
        </header>

        <div className="mx-auto mt-8 max-w-[560px]">

          {/* ========================= */}
          {/* PROFIL + STATISTIKY */}
          {/* ========================= */}

          <section className="rounded-[30px] border border-[#542033] bg-[#210b15] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] sm:p-7">

            <div className="flex items-center gap-5">

              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-[#e55b91] bg-[#45152b] text-6xl shadow-[0_0_30px_rgba(229,91,145,0.12)]">
                {animal}
              </div>

              <div className="min-w-0 flex-1">

                <p className="truncate text-xl font-black">
                  @{username}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2">

                  <div className="rounded-2xl border border-[#472033] bg-[#35101f] px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#806071]">
                      XP
                    </p>

                    <p className="mt-1 text-lg font-black text-[#ff7cad]">
                      {xp.toLocaleString('cs-CZ')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#472033] bg-[#35101f] px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#806071]">
                      Streak
                    </p>

                    <p className="mt-1 text-lg font-black text-[#ff7cad]">
                      {streak}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#472033] bg-[#35101f] px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#806071]">
                      Questy
                    </p>

                    <p className="mt-1 text-lg font-black text-[#ff7cad]">
                      {completedQuests}
                    </p>
                  </div>

                </div>

              </div>

            </div>

            {/* ÚDAJE + ODHLÁŠENÍ */}

            <div className="mt-6 border-t border-[#3a1826] pt-5">

              <div className="flex items-center justify-between gap-4">

                <div className="min-w-0">

                  <p className="truncate text-sm font-bold text-[#d6b1c0]">
                    @{username}
                  </p>

                  <p className="mt-1 truncate text-xs text-[#987184]">
                    {email || 'E-mail není dostupný'}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="shrink-0 rounded-full border border-[#6b2945] bg-[#35101f] px-4 py-2 text-xs font-bold text-[#c99aaa] transition hover:border-[#e55b91] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loggingOut ? 'Odhlášení...' : 'Odhlásit se'}
                </button>

              </div>

            </div>

          </section>

          {message && (
            <div className="mt-5 rounded-2xl border border-[#6b2945] bg-[#35101f] px-5 py-4 text-center text-sm font-bold text-[#ff8ab5]">
              {message}
            </div>
          )}

          {/* ========================= */}
          {/* SIDEQUEST HISTORIE */}
          {/* ========================= */}

          <section className="mt-10">

            <div className="mb-5">

              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#e85b91]">
                📸 Historie
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Moje Sidequesty
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#b994a4]">
                Tvoje odevzdané důkazy a jejich stav.
              </p>

            </div>

            {proofs.length === 0 ? (
              <div className="rounded-3xl border border-[#472033] bg-[#1e0a13] p-8 text-center">

                <div className="text-5xl">
                  📸
                </div>

                <h3 className="mt-5 text-xl font-black">
                  Zatím žádné Sidequesty
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#987184]">
                  Až odevzdáš svůj první důkaz, objeví se tady.
                </p>

              </div>
            ) : (
              <div className="space-y-6">

                {proofs.map((proof) => (
                  <article
                    key={proof.id}
                    className="overflow-hidden rounded-[30px] border border-[#542033] bg-[#210b15] shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
                  >

                    <div className="aspect-square overflow-hidden bg-[#35111f]">
                      <img
                        src={proof.imageUrl}
                        alt={`Důkaz questu ${proof.questTitle}`}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="p-5">

                      <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">

                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806071]">
                            Sidequest
                          </p>

                          <h3 className="mt-1 font-black">
                            {proof.questTitle}
                          </h3>

                          <p className="mt-1 text-xs text-[#806071]">
                            {new Date(proof.createdAt).toLocaleDateString(
                              'cs-CZ'
                            )}
                          </p>

                        </div>

                        {proof.status === 'approved' ? (
                          <span className="shrink-0 rounded-full border border-[#2e6848] bg-[#153b29] px-3 py-1.5 text-xs font-black text-[#7ee2a8]">
                            ✓ Schváleno
                          </span>
                        ) : proof.status === 'rejected' ? (
                          <span className="shrink-0 rounded-full border border-[#6b2945] bg-[#3a1024] px-3 py-1.5 text-xs font-black text-[#ff7caa]">
                            ✕ Zamítnuto
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-[#735d2c] bg-[#3a2f16] px-3 py-1.5 text-xs font-black text-[#f0cf72]">
                            ⏳ Čeká
                          </span>
                        )}

                      </div>

                    </div>

                  </article>
                ))}

              </div>
            )}

          </section>

        </div>

        {/* ========================= */}
        {/* BOTTOM NAV */}
        {/* ========================= */}

        <nav className="mx-auto mt-10 max-w-3xl border-t border-[#3a1826] py-5">

          <div className="grid grid-cols-3">

            <a
              href="/"
              className="flex flex-col items-center gap-1 text-[#987184] transition hover:text-white"
            >
              <span className="text-xl">⌂</span>
              <span className="text-[11px] font-bold">
                Domů
              </span>
            </a>

            <a
              href="/friends"
              className="flex flex-col items-center gap-1 text-[#987184] transition hover:text-white"
            >
              <span className="text-xl">👥</span>
              <span className="text-[11px] font-bold">
                Kamarádi
              </span>
            </a>

            <a
              href="/profile"
              className="flex flex-col items-center gap-1 text-[#f05b91]"
            >
              <span className="text-xl">👤</span>
              <span className="text-[11px] font-bold">
                Profil
              </span>
            </a>

          </div>

        </nav>

      </div>
    </main>
  );
}