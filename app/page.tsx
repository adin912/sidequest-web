'use client';















import { useEffect, useState } from 'react';















import { supabase } from '@/lib/supabase';















import AcceptQuestButton from './components/AcceptQuestButton';







import SubmitProof from './components/SubmitProof';















type Quest = {







  id: string;







  title: string;







  description: string;







  xp: number;







};















type Profile = {







  username: string | null;







  xp: number;







  streak: number;







};















type UserQuest = {







  id: string;







  status: string;







};















type Proof = {
  image_url: string;
  status: 'pending' | 'approved' | 'rejected';
};















function getAnimal(streak: number) {







  if (streak >= 100) return '🐉';







  if (streak >= 76) return '🦅';







  if (streak >= 51) return '🐺';







  if (streak >= 31) return '🦊';







  if (streak >= 11) return '🐢';







  return '🐌';







}















export default function Home() {







  const [quest, setQuest] = useState<Quest | null>(null);







  const [profile, setProfile] = useState<Profile | null>(null);







  const [userQuest, setUserQuest] = useState<UserQuest | null>(null);







  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);







  const [proofStatus, setProofStatus] = useState<



    'pending' | 'approved' | 'rejected' | null



  >(null);







  const [loading, setLoading] = useState(true);















  async function handleLogout() {







    await supabase.auth.signOut();







    window.location.href = '/login';







  }















  useEffect(() => {







    async function loadHome() {







      const {







        data: { user },







      } = await supabase.auth.getUser();















      if (!user) {







        window.location.href = '/login';







        return;







      }















      const { data: questData, error: questError } =







        await supabase.rpc('get_daily_quest');















      if (questError) {







        console.error(questError);







        setLoading(false);







        return;







      }















      const todayQuest = questData?.[0] ?? null;







      setQuest(todayQuest);















      const { data: profileData } = await supabase







        .from('profiles')







        .select('username, xp, streak')







        .eq('id', user.id)







        .single();















      setProfile(profileData);















      if (todayQuest) {







        const { data: existingUserQuest, error: userQuestError } =







          await supabase







            .from('user_quests')







            .select('id, status')







            .eq('user_id', user.id)







            .eq('quest_id', todayQuest.id)







            .maybeSingle();















        if (userQuestError) {







          console.error(userQuestError);







        }















        setUserQuest(existingUserQuest);















        if (existingUserQuest) {







          const { data: proofData, error: proofError } = await supabase







            .from('proofs')







            .select('id, image_url, status')







            .eq('user_quest_id', existingUserQuest.id)







            .order('created_at', { ascending: false })







            .limit(1)







            .maybeSingle();















          if (proofError) {







            console.error(proofError);







          }















          const proof = proofData as (Proof & { id: string }) | null;

          if (proof?.status === 'approved') {
            setProofStatus('approved');
          } else if (proof?.status === 'rejected') {
            setProofStatus('rejected');
          } else if (proof?.status === 'pending') {
            setProofStatus('pending');
          }

if (proof?.image_url) {



            const { data: signedUrlData, error: signedUrlError } =



              await supabase.storage



                .from('proofs')



                .createSignedUrl(proof.image_url, 60 * 60);







            if (signedUrlError) {



              console.error(signedUrlError);



            } else if (signedUrlData?.signedUrl) {



              setUploadedPhoto(signedUrlData.signedUrl);



            }



          }







          if (proof?.id) {



            const { data: votes, error: votesError } = await supabase



              .from('proof_votes')



              .select('voter_id, vote')



              .eq('proof_id', proof.id);







            if (votesError) {



              console.error(votesError);



            } else {



              const { data: friendships, error: friendshipsError } =



                await supabase



                  .from('friendships')



                  .select('user_id, friend_id')



                  .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)



                  .eq('status', 'accepted');







              if (friendshipsError) {



                console.error(friendshipsError);



              } else {



                const friendIds = (friendships ?? []).map((friendship) =>



                  friendship.user_id === user.id



                    ? friendship.friend_id



                    : friendship.user_id



                );







                const approvedVotes = (votes ?? []).filter(



                  (vote) =>



                    friendIds.includes(vote.voter_id) &&



                    vote.vote === 'approved'



                ).length;







                const rejectedVotes = (votes ?? []).filter(



                  (vote) =>



                    friendIds.includes(vote.voter_id) &&



                    vote.vote === 'rejected'



                ).length;







                const requiredVotes = Math.ceil(friendIds.length * 0.51);







                if (requiredVotes > 0 && approvedVotes >= requiredVotes) {



                  setProofStatus('approved');



                } else if (requiredVotes > 0 && rejectedVotes >= requiredVotes) {



                  setProofStatus('rejected');



                } else {



                  setProofStatus('pending');



                }



              }



            }



          }







        }







      }















      setLoading(false);







    }















    loadHome();







  }, []);















  if (loading) {







    return (







      <main className="flex min-h-screen items-center justify-center bg-[#16070d] text-white">







        <p className="text-[#d6a8b9]">Načítám Sidequest...</p>







      </main>







    );







  }















  if (!quest) {







    return (







      <main className="flex min-h-screen items-center justify-center bg-[#16070d] text-white">







        <div className="text-center">







          <div className="text-4xl font-black tracking-[0.2em]">







            SIDEQUEST







          </div>















          <p className="mt-4 text-[#b98c9f]">







            Dnes není žádný quest.







          </p>







        </div>







      </main>







    );







  }















  const username = profile?.username ?? 'hráč';







  const xp = profile?.xp ?? 0;







  const streak = profile?.streak ?? 0;







  const animal = getAnimal(streak);















  return (







    <main className="min-h-screen bg-[#16070d] text-white">







      <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-5 sm:px-6">















        {/* TOP BAR */}







        <header className="relative mx-auto grid max-w-3xl grid-cols-3 items-center border-b border-[#3a1826] pb-5">















          {/* STREAK */}







          <div className="flex items-center gap-2 justify-self-start">







            <div className="text-2xl">







              🔥







            </div>















            <div>







              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9f7285]">







                streak







              </p>















              <p className="text-lg font-black">







                {streak}







              </p>







            </div>







          </div>















          {/* PROFIL */}







          <div className="flex items-center justify-center gap-2">







            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#e55b91] bg-[#45152b] text-xl shadow-[0_0_20px_rgba(229,91,145,0.15)]">







              {animal}







            </div>















            <div className="text-left">







              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9f7285]">







                hráč







              </p>















              <p className="whitespace-nowrap font-bold">







                @{username}







              </p>







            </div>







          </div>















          {/* XP */}







          <div className="justify-self-end text-right">







            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9f7285]">







              XP







            </p>















            <p className="text-lg font-black text-[#ff7cad]">







              {xp.toLocaleString('cs-CZ')}







            </p>







          </div>

</header>















        {/* MAIN */}







        <div className="mx-auto mt-8 max-w-3xl">















          {/* QUEST HEADER */}







          <section className="text-center">















            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#e85b91]">







              🎯 Dnešní Sidequest







            </p>















            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">







              {quest.title}







            </h1>















            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#c39aaa] sm:text-base">







              {quest.description}







            </p>















            <div className="mt-5 inline-flex rounded-full border border-[#a73562] bg-[#3a1024] px-5 py-2 text-sm font-black text-[#ff76aa]">







              +{quest.xp} XP







            </div>















          </section>















          {/* INSTAGRAM POST */}







          <article className="mx-auto mt-8 max-w-[560px] overflow-hidden rounded-[30px] border border-[#542033] bg-[#210b15] shadow-[0_25px_80px_rgba(0,0,0,0.35)]">















            {/* POST HEADER */}







            <div className="flex items-center justify-between px-5 py-4">















              <div className="flex items-center gap-3">















                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d94f86] bg-[#46162c] text-lg">







                  {animal}







                </div>















                <div>







                  <p className="text-sm font-bold">







                    @{username}







                  </p>















                  <p className="text-xs text-[#967083]">







                    Dnešní Sidequest







                  </p>







                </div>















              </div>















              <button







                type="button"







                className="text-lg tracking-widest text-[#9d7284]"







              >







                •••







              </button>















            </div>















            {/* PHOTO */}







            <div className="relative aspect-square overflow-hidden bg-[#35111f]">















              {uploadedPhoto ? (







                <img







                  src={uploadedPhoto}







                  alt="Odevzdaná fotka"







                  className="absolute inset-0 h-full w-full object-cover"







                />







              ) : (







                <>







                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%\\\\_20%,#8f2d58_0%,transparent_35%),radial-gradient(circle_at_80%\\\\_75%,#54152f_0%,transparent_40%),linear-gradient(135deg,#4b162c,#17070e)]" />















                  <div className="absolute inset-0 flex flex-col items-center justify-center">















                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-black/20 text-5xl backdrop-blur-sm">







                      📸







                    </div>















                    <p className="mt-5 text-lg font-bold">







                      Tvoje dnešní fotka







                    </p>















                    <p className="mt-2 px-8 text-center text-sm text-[#d0a8b8]">







                      Splň quest a odevzdej svůj důkaz.







                    </p>















                  </div>







                </>







              )}















            </div>















            {/* POST FOOTER */}







            <div className="px-5 pb-5 pt-4">















              <div className="flex items-center gap-5 text-xl">







                <span>♡</span>







                <span>◯</span>







                <span>↗</span>







              </div>















              <p className="mt-4 text-sm leading-5 text-[#b994a4]">







                {userQuest?.status === 'completed'







                  ? 'Quest byl schválen tvými kamarády.'







                  : uploadedPhoto







                    ? 'Fotka čeká na schválení tvými kamarády.'







                    : 'Po odevzdání fotku zkontrolují tvoji kamarádi.'}







              </p>















              {userQuest?.status === 'accepted' && !uploadedPhoto ? (







                <SubmitProof







                  userQuestId={userQuest.id}







                  onUploaded={(imageUrl) => {







                    setUploadedPhoto(imageUrl);







                  }}







                />







              ) : userQuest?.status === 'completed' || proofStatus === 'approved' ? (







                <div className="mt-5 rounded-2xl border border-[#542033] bg-[#35101f] px-5 py-4 text-center">







                  <p className="font-bold text-[#7ee2a8]">







                    ✓ Quest dokončen







                  </p>















                  <p className="mt-1 text-xs text-[#a98292]">







                    Tvoji kamarádi tvůj důkaz schválili.







                  </p>







                </div>







              ) : proofStatus === 'rejected' ? (











                <div className="mt-5 rounded-2xl border border-[#6b2440] bg-[#3a1024] px-5 py-4 text-center">











                  <p className="font-bold text-[#ff7caa]">











                    ✕ Důkaz zamítnut











                  </p>















                  <p className="mt-1 text-xs text-[#c99aaa]">











                    Tvoji kamarádi tvůj důkaz neschválili.











                  </p>











                </div>















              ) : uploadedPhoto ? (



                <div className="mt-5 rounded-2xl border border-[#542033] bg-[#35101f] px-5 py-4 text-center">







                  <p className="font-bold text-[#ff8ab5]">







                    ⏳ Čeká na schválení







                  </p>















                  <p className="mt-1 text-xs text-[#a98292]">







                    Tvoji kamarádi teď mohou hlasovat.







                  </p>







                </div>







              ) : (







                <AcceptQuestButton
  questId={quest.id}
  onAccepted={(newUserQuest) => {
    setUserQuest(newUserQuest);
  }}
/>







              )}















            </div>















          </article>















          {/* FRIENDS */}







          <section className="mx-auto mt-7 max-w-[560px] rounded-3xl border border-[#472033] bg-[#1e0a13] p-5">















            <div className="flex items-center justify-between">















              <div>







                <h2 className="font-black">







                  Kamarádi







                </h2>















                <p className="mt-1 text-xs text-[#987184]">







                  Co dnes dělají?







                </p>







              </div>















              <a







                href="/friends"







                className="text-[#df4f88] transition hover:text-white"







              >







                →







              </a>















            </div>















            <div className="mt-5 flex items-center gap-3">















              <div className="flex -space-x-2">















                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1e0a13] bg-[#521b37]">







                  🐢







                </div>















                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1e0a13] bg-[#692142]">







                  🦊







                </div>















                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1e0a13] bg-[#40162b]">







                  🐺







                </div>















              </div>















              <p className="text-sm text-[#b994a4]">







                Přidej kamarády a sleduj jejich Sidequesty.







              </p>















            </div>















          </section>















        </div>















        {/* BOTTOM NAV */}







        <nav className="mx-auto mt-10 max-w-3xl border-t border-[#3a1826] py-5">















          <div className="grid grid-cols-3">















            <a







              href="/"







              className="flex flex-col items-center gap-1 text-[#f05b91]"







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







              className="flex flex-col items-center gap-1 text-[#987184] transition hover:text-white"







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