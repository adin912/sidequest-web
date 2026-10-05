'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage('Vytvářím účet...');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data.user) {
      setMessage('Účet se nepodařilo vytvořit.');
      return;
    }

    if (data.session) {
      window.location.href = '/';
      return;
    }

    setMessage(
      'Účet byl vytvořen. Zkontroluj email a potvrď registraci.'
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#16070d] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#8f2d58]/20 blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-[#e55b91]/10 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-[#54152f]/30 blur-3xl" />

        <div className="absolute left-[12%] top-[18%] h-1 w-1 rounded-full bg-[#ff8ab5]" />
        <div className="absolute right-[18%] top-[30%] h-1 w-1 rounded-full bg-[#ff8ab5]" />
        <div className="absolute left-[22%] bottom-[22%] h-1 w-1 rounded-full bg-[#d94f86]" />
        <div className="absolute right-[28%] bottom-[16%] h-1 w-1 rounded-full bg-[#d94f86]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">

          <div className="mb-8 text-center">
            <h1 className="text-4xl font-black tracking-[0.08em] sm:text-5xl">
              SIDE
              <span className="mx-2 text-[#ff6fa5]">✦</span>
              QUEST
            </h1>

            <p className="mt-5 text-sm font-medium text-[#b994a4]">
              Vytvoř si účet
            </p>
          </div>

          <div className="rounded-[30px] border border-[#542033] bg-[#210b15]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">

            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#e85b91]">
                Začni hrát
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Registrace
              </h2>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#9f7285]">
                  Uživatelské jméno
                </label>

                <input
                  type="text"
                  placeholder="např. adamek"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-[#542033] bg-[#16070d] px-4 py-4 text-white placeholder:text-[#654253] outline-none transition focus:border-[#e55b91] focus:ring-2 focus:ring-[#e55b91]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#9f7285]">
                  Email
                </label>

                <input
                  type="email"
                  placeholder="tvuj@email.cz"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-[#542033] bg-[#16070d] px-4 py-4 text-white placeholder:text-[#654253] outline-none transition focus:border-[#e55b91] focus:ring-2 focus:ring-[#e55b91]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-[#9f7285]">
                  Heslo
                </label>

                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-[#542033] bg-[#16070d] px-4 py-4 text-white placeholder:text-[#654253] outline-none transition focus:border-[#e55b91] focus:ring-2 focus:ring-[#e55b91]/10"
                />
              </div>

              <button
                type="submit"
                className="mt-2 w-full rounded-2xl border border-[#d94f86] bg-[#8f2d58] px-5 py-4 font-black shadow-[0_10px_30px_rgba(143,45,88,0.25)] transition hover:bg-[#a73562] hover:shadow-[0_10px_40px_rgba(229,91,145,0.2)] active:scale-[0.99]"
              >
                Registrovat se →
              </button>

            </form>

            {message && (
              <div className="mt-5 rounded-2xl border border-[#542033] bg-[#35101f] px-4 py-3 text-center text-sm text-[#d0a8b8]">
                {message}
              </div>
            )}

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#3a1826]" />
              <span className="text-xs text-[#654253]">NEBO</span>
              <div className="h-px flex-1 bg-[#3a1826]" />
            </div>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/login';
              }}
              className="w-full rounded-2xl border border-[#542033] bg-[#2a0d19] px-5 py-4 text-sm font-bold text-[#d0a8b8] transition hover:border-[#e55b91] hover:bg-[#35101f] hover:text-white"
            >
              Už máš účet?{' '}
              <span className="text-[#ff7cad]">
                Přihlásit se
              </span>
            </button>

          </div>
        </div>
      </div>
    </main>
  );
}