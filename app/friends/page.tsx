'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Friend = {
  id: string;
  username: string | null;
  xp: number;
  streak: number;
};

type FriendRequest = {
  friendshipId: string;
  userId: string;
  username: string | null;
};

type FriendProof = {
  proofId: string;
  userQuestId: string;
  username: string;
  avatar: string;
  questTitle: string;
  questDescription: string;
  imageUrl: string;
  approvedVotes: number;
  totalVotes: number;
};

type VoteResult = {
  completed?: boolean;
  approved_votes?: number;
  required_votes?: number;
  total_friends?: number;
};

function getAnimal(streak: number) {
  if (streak >= 30) return '🐉';
  if (streak >= 14) return '🦁';
  if (streak >= 7) return '🐺';
  if (streak >= 3) return '🦊';
  return '🐢';
}

export default function FriendsPage() {
  const [proofs, setProofs] = useState<FriendProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);

  useEffect(() => {
    void loadFriendProofs();
  }, []);

  async function loadFriendProofs() {
    setLoading(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }
      const { data: incomingRequests, error: requestsError } =
    await supabase.rpc('get_friend_requests');

  if (requestsError) {
    console.error(requestsError);
    setMessage(requestsError.message);
    setFriendRequests([]);
  } else {
    setFriendRequests(
      (incomingRequests ?? []).map((request) => ({
        friendshipId: request.friendship_id,
        userId: request.user_id,
        username: request.username,
      }))
    );
  }

    /*
     * 1. Nejdřív načteme samotná přátelství.
     */
    const { data: friendships, error: friendshipError } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (friendshipError) {
      console.error(friendshipError);
      setMessage(friendshipError.message);
      setFriends([]);
      setProofs([]);
      setLoading(false);
      return;
    }

    const friendIds = (friendships ?? []).map((friendship) =>
      friendship.user_id === user.id
        ? friendship.friend_id
        : friendship.user_id
    );

    /*
     * 2. Kamarády načteme přímo z jejich profilů.
     *
     * Tohle je důležitá oprava:
     * seznam kamarádů už NENÍ závislý na tom,
     * jestli mají nějaký user_quest nebo proof.
     */
    if (friendIds.length === 0) {
      setFriends([]);
      setProofs([]);
      setLoading(false);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, xp, streak')
      .in('id', friendIds);

    if (profilesError) {
      console.error(profilesError);
      setMessage(profilesError.message);
      setFriends([]);
      setProofs([]);
      setLoading(false);
      return;
    }

    /*
     * Zachováme pořadí podle friendIds a zároveň zobrazíme
     * všechny skutečné kamarády, i když ještě nemají quest.
     */
    const profileMap = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile])
    );

    setFriends(
      friendIds
        .map((friendId) => profileMap.get(friendId))
        .filter((profile): profile is NonNullable<typeof profile> => !!profile)
        .map((profile) => ({
          id: profile.id,
          username: profile.username,
          xp: profile.xp ?? 0,
          streak: profile.streak ?? 0,
        }))
    );

    /*
     * 3. Teprve teď hledáme questy kamarádů.
     *
     * Pokud žádný kamarád nemá quest, není to chyba.
     * Kamarádi už jsou načtení a pouze nebude co zobrazit ve feedu.
     */
    const { data: userQuests, error: userQuestError } = await supabase
      .from('user_quests')
      .select('id, user_id, quest_id, status')
      .in('user_id', friendIds)
      .eq('status', 'accepted');

    if (userQuestError) {
      console.error(userQuestError);
      setMessage(userQuestError.message);
      setProofs([]);
      setLoading(false);
      return;
    }

    if (!userQuests || userQuests.length === 0) {
      setProofs([]);
      setLoading(false);
      return;
    }

    const userQuestIds = userQuests.map((item) => item.id);

    /*
     * 4. Najdeme důkazy těchto questů.
     */
    const { data: proofRows, error: proofError } = await supabase
      .from('proofs')
      .select('id, user_quest_id, image_url')
      .in('user_quest_id', userQuestIds);

    if (proofError) {
      console.error(proofError);
      setMessage(proofError.message);
      setProofs([]);
      setLoading(false);
      return;
    }

    if (!proofRows || proofRows.length === 0) {
      setProofs([]);
      setLoading(false);
      return;
    }

    /*
     * 5. Načteme informace o questechn.
     */
    const questIds = [
      ...new Set(userQuests.map((item) => item.quest_id)),
    ];

    const { data: quests, error: questsError } = await supabase
      .from('quests')
      .select('id, title, description')
      .in('id', questIds);

    if (questsError) {
      console.error(questsError);
      setMessage(questsError.message);
      setProofs([]);
      setLoading(false);
      return;
    }

    /*
     * 6. Zjistíme, na které proofy už aktuální uživatel hlasoval.
     *
     * Tyto proofy se po refreshi už znovu nezobrazí.
     */
    const proofIds = proofRows.map((proof) => proof.id);

    const { data: existingVotes, error: votesError } = await supabase
      .from('proof_votes')
      .select('proof_id')
      .eq('voter_id', user.id)
      .in('proof_id', proofIds);

    if (votesError) {
      console.error(votesError);
      setMessage(votesError.message);
      setProofs([]);
      setLoading(false);
      return;
    }

    const votedProofIds = new Set(
      (existingVotes ?? []).map((vote) => vote.proof_id)
    );

    /*
     * 7. Sestavíme feed důkazů.
     */
    const result: FriendProof[] = [];

    for (const proof of proofRows) {
      if (votedProofIds.has(proof.id)) {
        continue;
      }

      const userQuest = userQuests.find(
        (item) => item.id === proof.user_quest_id
      );

      if (!userQuest) {
        continue;
      }

      const quest = quests?.find(
        (item) => item.id === userQuest.quest_id
      );

      const profile = profiles?.find(
        (item) => item.id === userQuest.user_id
      );

      if (!quest || !profile) {
        continue;
      }

      const {
        data: signedUrlData,
        error: signedUrlError,
      } = await supabase.storage
        .from('proofs')
        .createSignedUrl(proof.image_url, 60 * 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(signedUrlError);
        continue;
      }

      const { count: totalVotes } = await supabase
        .from('proof_votes')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('proof_id', proof.id);

      const { count: approvedVotes } = await supabase
        .from('proof_votes')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('proof_id', proof.id)
        .eq('vote', 'approved');

      result.push({
        proofId: proof.id,
        userQuestId: proof.user_quest_id,
        username: profile.username ?? 'hráč',
        avatar: '🐢',
        questTitle: quest.title,
        questDescription: quest.description,
        imageUrl: signedUrlData.signedUrl,
        approvedVotes: approvedVotes ?? 0,
        totalVotes: totalVotes ?? 0,
      });
    }

    setProofs(result);
    setLoading(false);
  }

  async function acceptFriendRequest(friendshipId: string) {
    setMessage('');

    const { error } = await supabase.rpc('accept_friend_request', {
      p_friendship_id: friendshipId,
    });

    if (error) {
      setMessage(error.message || 'Nepodařilo se přijmout žádost.');
      return;
    }

    setFriendRequests((currentRequests) =>
      currentRequests.filter(
        (request) => request.friendshipId !== friendshipId
      )
    );

    setMessage('Žádost přijata. 🎉');

    await loadFriendProofs();
  }

  async function rejectFriendRequest(friendshipId: string) {
    setMessage('');

    const { error } = await supabase.rpc('reject_friend_request', {
      p_friendship_id: friendshipId,
    });

    if (error) {
      setMessage(error.message || 'Nepodařilo se odmítnout žádost.');
      return;
    }

    setFriendRequests((currentRequests) =>
      currentRequests.filter(
        (request) => request.friendshipId !== friendshipId
      )
    );

    setMessage('Žádost odmítnuta.');
  }

  async function sendFriendRequest() {
    const username = friendUsername.trim().replace(/^@/, '');

    if (!username) {
      setMessage('Napiš username kamaráda.');
      return;
    }

    setAddingFriend(true);
    setMessage('');

    const { error } = await supabase.rpc('send_friend_request', {
      p_username: username,
    });

    if (error) {
      setMessage(error.message || 'Nepodařilo se odeslat žádost.');
      setAddingFriend(false);
      return;
    }

    setFriendUsername('');
    setShowAddFriend(false);
    setMessage(`Žádost pro @${username} byla odeslána. ✉️`);
    setAddingFriend(false);
  }

  async function voteOnProof(
    proofId: string,
    vote: 'approved' | 'rejected'
  ) {
    setVoting(proofId);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('Nejsi přihlášený.');
      setVoting(null);
      return;
    }

    const { data, error } = await supabase.rpc('vote_on_proof', {
      p_proof_id: proofId,
      p_vote: vote,
    });

    if (error) {
      const errorText = [
        `Zpráva: ${error.message || 'neznámá chyba'}`,
        `Code: ${error.code || 'žádný'}`,
        `Details: ${error.details || 'žádné'}`,
        `Hint: ${error.hint || 'žádný'}`,
      ].join('\n');

      setMessage(`CHYBA PŘI HLASOVÁNÍ\n\n${errorText}`);
      setVoting(null);
      return;
    }

    const result = data as VoteResult;

    if (result.completed) {
      setMessage('Quest uznán! 🎉 XP byly připsány.');
    } else if (vote === 'approved') {
      setMessage(
        `Hlas uložen. ${result.approved_votes ?? 0}/${result.required_votes ?? 0} hlasů potřebných.`
      );
    } else {
      setMessage('Hlas uložen.');
    }

    // Proof okamžitě odstraníme z aktuálního seznamu.
    setProofs((currentProofs) =>
      currentProofs.filter(
        (proof) => proof.proofId !== proofId
      )
    );

    setVoting(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#16070d] text-white">
        <p className="text-[#d6a8b9]">
          Načítám kamarády...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#16070d] text-white">
      <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-5 sm:px-6">
        <header className="mx-auto flex max-w-3xl items-center justify-between border-b border-[#3a1826] pb-5">
          <a
            href="/"
            className="text-sm font-bold text-[#b98c9f] hover:text-white"
          >
            ← Domů
          </a>

          <h1 className="text-lg font-black">
            Kamarádi
          </h1>

          <div className="w-12" />
        </header>

        <div className="mx-auto mt-8 max-w-[560px]">
          <section className="mb-8 rounded-3xl border border-[#472033] bg-[#1e0a13] p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#e85b91]">
                  👥 Tvoje parta
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Kamarádi
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddFriend((current) => !current)
                }
                className="shrink-0 rounded-2xl bg-[#df4f88] px-4 py-3 text-sm font-black text-white transition hover:bg-[#ed6098]"
              >
                + Přidat kamaráda
              </button>
            </div>

            {showAddFriend && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendFriendRequest();
                }}
                className="mb-5 rounded-2xl border border-[#472033] bg-[#35101f] p-4"
              >
                <p className="mb-3 text-sm font-bold">
                  Zadej username kamaráda
                </p>

                <div className="flex gap-2">
                  <input
                    value={friendUsername}
                    onChange={(event) =>
                      setFriendUsername(event.target.value)
                    }
                    placeholder="@username"
                    className="min-w-0 flex-1 rounded-2xl border border-[#6b2945] bg-[#1e0a13] px-4 py-3 text-sm text-white outline-none placeholder:text-[#765466] focus:border-[#df4f88]"
                    autoFocus
                  />

                  <button
                    type="submit"
                    disabled={addingFriend}
                    className="rounded-2xl bg-[#df4f88] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addingFriend ? 'Odesílám...' : 'Odeslat'}
                  </button>
                </div>
              </form>
            )}
            {friendRequests.length > 0 && (
  <div className="mb-6 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5">
    <h2 className="mb-4 text-lg font-bold text-white">
      Žádosti o přátelství
    </h2>

    <div className="space-y-3">
      {friendRequests.map((request) => (
        <div
          key={request.friendshipId}
          className="flex items-center justify-between gap-4 rounded-xl bg-slate-900/60 p-4"
        >
          <div>
            <p className="font-semibold text-white">
              {request.username ?? 'Neznámý uživatel'}
            </p>
            <p className="text-sm text-slate-400">
              ti poslal žádost o přátelství
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => acceptFriendRequest(request.friendshipId)}
              className="rounded-xl bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-500"
            >
              Přijmout
            </button>

            <button
              onClick={() => rejectFriendRequest(request.friendshipId)}
              className="rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
            >
              Odmítnout
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

            {friends.length === 0 ? (
              <p className="text-sm text-[#987184]">
                Zatím nemáš žádné kamarády.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#472033]">
                {friends.map((friend, index) => (
                  <div
                    key={friend.id}
                    className={`flex items-center justify-between gap-4 px-4 py-4 ${
                      index > 0 ? 'border-t border-[#472033]' : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d94f86] bg-[#46162c] text-xl">
                        {getAnimal(friend.streak)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          @{friend.username ?? 'hráč'}
                        </p>

                        <p className="mt-1 text-xs text-[#987184]">
                          🔥 {friend.streak} dní v řadě
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black">
                        {friend.xp} XP
                      </p>

                      <p className="mt-1 text-xs text-[#987184]">
                        XP celkem
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#e85b91]">
              👥 Sociální feed
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Schval jejich Sidequesty
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#b994a4]">
              Podívej se na jejich důkazy a rozhodni,
              jestli quest opravdu splnili.
            </p>
          </div>

          {message && (
            <div className="mb-5 whitespace-pre-line rounded-2xl border border-[#6b2945] bg-[#35101f] px-5 py-4 text-center text-sm font-bold text-[#ff8ab5]">
              {message}
            </div>
          )}

          {proofs.length === 0 ? (
            <div className="rounded-3xl border border-[#472033] bg-[#1e0a13] p-8 text-center">
              <div className="text-5xl">
                👀
              </div>

              <h2 className="mt-5 text-xl font-black">
                Zatím tu nic není
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#987184]">
                Až kamarád odevzdá svůj Sidequest,
                objeví se tady jeho důkaz.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              {proofs.map((proof) => (
                <article
                  key={proof.proofId}
                  className="overflow-hidden rounded-[30px] border border-[#542033] bg-[#210b15] shadow-[0_25px_80px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d94f86] bg-[#46162c] text-lg">
                      {proof.avatar}
                    </div>

                    <div>
                      <p className="text-sm font-bold">
                        @{proof.username}
                      </p>

                      <p className="text-xs text-[#967083]">
                        {proof.questTitle}
                      </p>
                    </div>
                  </div>

                  <div className="aspect-square overflow-hidden bg-[#35111f]">
                    <img
                      src={proof.imageUrl}
                      alt={`Důkaz questu uživatele @${proof.username}`}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="p-5">
                    <h3 className="font-black">
                      {proof.questTitle}
                    </h3>

                    <p className="mt-2 text-sm leading-5 text-[#b994a4]">
                      {proof.questDescription}
                    </p>

                    <div className="mt-5 rounded-2xl border border-[#472033] bg-[#35101f] px-4 py-3">
                      <p className="text-center text-xs text-[#a98292]">
                        Aktuálně schváleno: {proof.approvedVotes}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          voteOnProof(
                            proof.proofId,
                            'approved'
                          )
                        }
                        disabled={voting === proof.proofId}
                        className="rounded-2xl bg-[#df4f88] px-4 py-4 font-black text-white transition hover:bg-[#ed6098] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {voting === proof.proofId
                          ? 'Hlasuji...'
                          : '✓ UZNAT'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          voteOnProof(
                            proof.proofId,
                            'rejected'
                          )
                        }
                        disabled={voting === proof.proofId}
                        className="rounded-2xl border border-[#6b2945] bg-[#35101f] px-4 py-4 font-black text-[#ff8ab5] transition hover:bg-[#45152a] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {voting === proof.proofId
                          ? 'Hlasuji...'
                          : '✕ NEUZNAT'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

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
              className="flex flex-col items-center gap-1 text-[#f05b91]"
            >
              <span className="text-xl">👥</span>

              <span className="text-[11px] font-bold">
                Kamarádi
              </span>
            </a>

            <a
              href="/profile"
              className="flex flex-col items-center gap-1 text-[#987184]"
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