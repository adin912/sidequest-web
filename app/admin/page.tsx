'use client';



import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';



type Quest = {

  id: string;

  title: string;

  description: string;

  xp: number;

  approved: boolean;

  created_at: string;

};



export default function AdminPage() {

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [quests, setQuests] = useState<Quest[]>([]);

  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState('');



  const [title, setTitle] = useState('');

  const [description, setDescription] = useState('');

  const [xp, setXp] = useState('50');

  const [creating, setCreating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);



  useEffect(() => {

    checkAdmin();

  }, []);



  async function checkAdmin() {

    setLoading(true);

    setMessage('');



    const {

      data: { user },

    } = await supabase.auth.getUser();



    if (!user) {

      setIsAdmin(false);

      setLoading(false);

      return;

    }



    const { data, error } = await supabase.rpc('is_admin');



    if (error) {

      console.error(error);

      setIsAdmin(false);

      setMessage('Nepodařilo se ověřit administrátora.');

      setLoading(false);

      return;

    }



    if (!data) {

      setIsAdmin(false);

      setLoading(false);

      return;

    }



    setIsAdmin(true);

    await loadQuests();

    setLoading(false);

  }



async function loadQuests() {
  const { data, error } = await supabase
    .from('quests')
    .select('id, title, description, xp, approved, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    setMessage('Nepodařilo se načíst questy.');
    return;
  }

  const { data: dailyQuests, error: dailyQuestsError } =
    await supabase
      .from('daily_quests')
      .select('quest_id');

  if (dailyQuestsError) {
    console.error(dailyQuestsError);
    setMessage('Nepodařilo se načíst použité questy.');
    return;
  }

  const usedQuestIds = new Set(
    (dailyQuests ?? []).map((dailyQuest) => dailyQuest.quest_id)
  );

  const availableQuests = (data ?? []).filter(
    (quest) => !usedQuestIds.has(quest.id)
  );

  setQuests(availableQuests);
}



  async function createQuest() {

    setMessage('');



    const cleanTitle = title.trim();

    const cleanDescription = description.trim();

    const xpNumber = Number(xp);



    if (!cleanTitle) {

      setMessage('Vyplň název questu.');

      return;

    }



    if (!cleanDescription) {

      setMessage('Vyplň popis questu.');

      return;

    }



    if (!Number.isInteger(xpNumber) || xpNumber <= 0) {

      setMessage('XP musí být kladné celé číslo.');

      return;

    }



    setCreating(true);



    const { data, error } = await supabase.rpc(

      'admin_create_quest',

      {

        p_title: cleanTitle,

        p_description: cleanDescription,

        p_xp: xpNumber,

      }

    );



    if (error) {

      console.error(error);

      setMessage('Nepodařilo se vytvořit quest.');

      setCreating(false);

      return;

    }



    if (!data) {

      setMessage('Quest se nepodařilo vytvořit.');

      setCreating(false);

      return;

    }



    setQuests((current) => [data, ...current]);



    setTitle('');

    setDescription('');

    setXp('50');

    setMessage('Quest byl vytvořen a čeká na schválení.');

    setCreating(false);

  }



  async function generateAIQuests() {
    setMessage('');
    setGeneratingAI(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-quests',
        {
          body: {},
        }
      );

      if (error) {
        console.error(error);
        setMessage('AI se nepodařilo spustit.');
        return;
      }

      const generatedQuests = Array.isArray(data?.quests)
        ? data.quests
        : [];

      if (generatedQuests.length === 0) {
        setMessage('AI nevrátila žádné questy.');
        return;
      }

      let createdCount = 0;

      for (const quest of generatedQuests) {
        const questTitle =
          typeof quest?.title === 'string'
            ? quest.title.trim()
            : '';

        const questDescription =
          typeof quest?.description === 'string'
            ? quest.description.trim()
            : '';

        const questXp =
          typeof quest?.xp === 'number'
            ? quest.xp
            : Number(quest?.xp);

        if (
          !questTitle ||
          !questDescription ||
          !Number.isInteger(questXp) ||
          questXp <= 0
        ) {
          continue;
        }

        const { data: createdQuest, error: createError } =
          await supabase.rpc('admin_create_quest', {
            p_title: questTitle,
            p_description: questDescription,
            p_xp: questXp,
          });

        if (createError) {
          console.error(createError);
          continue;
        }

        if (createdQuest) {
          setQuests((current) => [createdQuest, ...current]);
          createdCount += 1;
        }
      }

      if (createdCount === 0) {
        setMessage('AI questy vygenerovala, ale nepodařilo se je uložit.');
        return;
      }

      setMessage(
        `AI vytvořila ${createdCount} questů. Všechny čekají na tvoje schválení.`
      );
    } catch (error) {
      console.error(error);
      setMessage('Při generování questů nastala chyba.');
    } finally {
      setGeneratingAI(false);
    }
  }

  async function toggleApproval(

    questId: string,

    currentApproved: boolean

  ) {

    setMessage('');



    const { error } = await supabase.rpc(

      'admin_set_quest_approval',

      {

        p_quest_id: questId,

        p_approved: !currentApproved,

      }

    );



    if (error) {

      console.error(error);

      setMessage('Nepodařilo se změnit stav questu.');

      return;

    }



    setQuests((current) =>

      current.map((quest) =>

        quest.id === questId

          ? {

              ...quest,

              approved: !currentApproved,

            }

          : quest

      )

    );

  }



  async function deleteQuest(questId: string) {

    const confirmed = window.confirm(

      'Opravdu chceš tento quest smazat? Tato akce nejde vrátit.'

    );



    if (!confirmed) {

      return;

    }



    setMessage('');

    setDeletingId(questId);



    const { error } = await supabase.rpc(

      'admin_delete_quest',

      {

        p_quest_id: questId,

      }

    );



    if (error) {

      console.error(error);

      setMessage('Nepodařilo se smazat quest.');

      setDeletingId(null);

      return;

    }



    setQuests((current) =>

      current.filter((quest) => quest.id !== questId)

    );



    setMessage('Quest byl smazán.');

    setDeletingId(null);

  }



  if (loading) {

    return (

      <main className="min-h-screen bg-black text-white flex items-center justify-center">

        <p className="text-gray-400">

          Načítám administraci...

        </p>

      </main>

    );

  }



  if (!isAdmin) {

    return (

      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">

        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">

          <div className="text-5xl mb-4">🔒</div>



          <h1 className="text-2xl font-bold mb-2">

            Přístup zamítnut

          </h1>



          <p className="text-gray-400">

            Tato stránka je pouze pro administrátory.

          </p>



          {message && (

            <p className="mt-4 text-sm text-red-400">

              {message}

            </p>

          )}



          <a

            href="/"

            className="inline-block mt-6 rounded-2xl bg-white text-black px-6 py-3 font-semibold"

          >

            Zpět domů

          </a>

        </div>

      </main>

    );

  }



  return (

    <main className="min-h-screen bg-black text-white px-5 py-8 pb-24">

      <div className="mx-auto max-w-3xl">



        <div className="flex items-center justify-between mb-8">

          <div>

            <p className="text-sm text-gray-500 mb-1">

              SIDEQUEST

            </p>



            <h1 className="text-3xl font-bold">

              Admin

            </h1>

          </div>



          <a

            href="/"

            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm"

          >

            Domů

          </a>

        </div>



        <div className="mb-8">

          <h2 className="text-xl font-bold">

            ➕ Nový quest

          </h2>



          <p className="text-sm text-gray-400 mt-1">

            Nový quest se automaticky vytvoří jako neschválený.

          </p>

        </div>



        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 mb-10">

          <div className="space-y-4">



            <div>

              <label className="block text-sm text-gray-400 mb-2">

                Název

              </label>



              <input

                value={title}

                onChange={(event) =>

                  setTitle(event.target.value)

                }

                placeholder="Např. Najdi něco modrého"

                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-white/30"

              />

            </div>



            <div>

              <label className="block text-sm text-gray-400 mb-2">

                Popis

              </label>



              <textarea

                value={description}

                onChange={(event) =>

                  setDescription(event.target.value)

                }

                placeholder="Popiš, co má hráč udělat..."

                rows={4}

                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-white/30 resize-none"

              />

            </div>



            <div>

              <label className="block text-sm text-gray-400 mb-2">

                XP

              </label>



              <input

                type="number"

                min="1"

                step="1"

                value={xp}

                onChange={(event) =>

                  setXp(event.target.value)

                }

                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-white/30"

              />

            </div>



            <button

              onClick={createQuest}

              disabled={creating}

              className="w-full rounded-2xl bg-white text-black py-3 font-semibold disabled:opacity-50"

            >

              {creating

                ? 'Vytvářím...'

                : 'Vytvořit quest'}

            </button>



          </div>

        </div>



        {message && (

          <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">

            {message}

          </div>

        )}



        <div className="mb-6">

          <h2 className="text-xl font-bold">

            Questy

          </h2>



          <p className="text-sm text-gray-400 mt-1">

            Schválené questy se mohou objevit uživatelům.

          </p>

        </div>



        {quests.length === 0 ? (

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">

            <p className="text-gray-400">

              Zatím nejsou žádné questy.

            </p>

          </div>

        ) : (

          <div className="space-y-4">



            {quests.map((quest) => (

              <div

                key={quest.id}

                className="rounded-3xl border border-white/10 bg-white/5 p-5"

              >



                <div className="flex items-start justify-between gap-4">



                  <div className="flex-1">



                    <div className="flex items-center gap-2 flex-wrap">



                      <h3 className="text-lg font-bold">

                        {quest.title}

                      </h3>



                      <span

                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${

                          quest.approved

                            ? 'bg-green-500/15 text-green-400'

                            : 'bg-yellow-500/15 text-yellow-400'

                        }`}

                      >

                        {quest.approved

                          ? 'SCHVÁLENO'

                          : 'ČEKÁ NA SCHVÁLENÍ'}

                      </span>



                    </div>



                    <p className="mt-2 text-gray-400 leading-relaxed">

                      {quest.description}

                    </p>



                    <p className="mt-3 text-sm text-gray-500">

                      ⭐ {quest.xp} XP

                    </p>



                    <button

                      onClick={() => deleteQuest(quest.id)}

                      disabled={deletingId === quest.id}

                      className="mt-4 rounded-2xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 disabled:opacity-50"

                    >

                      {deletingId === quest.id

                        ? 'Mažu...'

                        : '🗑️ Smazat'}

                    </button>



                  </div>



                  <button

                    onClick={() =>

                      toggleApproval(

                        quest.id,

                        quest.approved

                      )

                    }

                    className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold ${

                      quest.approved

                        ? 'bg-red-500/15 text-red-300'

                        : 'bg-green-500/15 text-green-300'

                    }`}

                  >

                    {quest.approved

                      ? 'Zamítnout'

                      : 'Schválit'}

                  </button>



                </div>



              </div>

            ))}



          </div>

        )}



        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5">

        <h2 className="font-bold">
          🤖 AI generování
        </h2>

        <p className="mt-2 text-sm text-gray-400 leading-relaxed">
          AI vytvoří balíček nových questů. Všechny se uloží
          jako neschválené a ty je potom můžeš jednotlivě
          schválit nebo smazat.
        </p>

        <button
          onClick={generateAIQuests}
          disabled={generatingAI}
          className="mt-4 w-full rounded-2xl bg-white text-black py-3 font-semibold disabled:opacity-50"
        >
          {generatingAI
            ? '🤖 Generuji questy...'
            : '🤖 Vygenerovat questy'}
        </button>

      </div>



      </div>

    </main>

  );

}