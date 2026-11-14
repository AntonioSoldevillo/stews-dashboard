import { useState, type FormEvent } from 'react';

import { useAuth } from '../lib/auth';

const logo = `${import.meta.env.BASE_URL}icon.png`;

export function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return setError('Enter your username and password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (err: any) {
      setError(err?.message ?? 'Could not log in.');
    }
    setBusy(false);
  }

  return (
    <div className="glow flex min-h-screen items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="Stew's" className="h-24 w-24 rounded-3xl shadow-2xl shadow-accent/20" />
          <h1 className="mt-6 text-3xl font-light tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Stew's sales dashboard</p>
        </div>

        <div className="card mt-8 p-5">
          <label className="text-sm font-semibold text-muted">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            placeholder="e.g. stewsview"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-elevated px-4 text-base outline-none placeholder:text-faint focus:border-accent"
          />
          <label className="mt-4 block text-sm font-semibold text-muted">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-elevated px-4 text-base outline-none placeholder:text-faint focus:border-accent"
          />
          {error && <p className="mt-4 text-center text-sm font-medium text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-accent to-accent-deep font-semibold text-white shadow-lg shadow-accent/25 transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-faint">View only · Sales update live from the store</p>
      </form>
    </div>
  );
}