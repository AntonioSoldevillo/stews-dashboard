import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../lib/auth';
import { Icon } from './Icon';

const NAV = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/reports', label: 'Reports', icon: 'chart' },
  { to: '/orders', label: 'Orders', icon: 'receipt' },
];

const logo = `${import.meta.env.BASE_URL}icon.png`;

export function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();

  function logout() {
    if (confirm('Log out of the dashboard?')) signOut();
  }

  return (
    <div className="min-h-screen">
      {/* ---------- Sidebar (computer / tablet) ---------- */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-elevated p-5 md:flex">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-11 w-11 rounded-xl" />
          <div>
            <p className="font-bold leading-tight">{profile?.storeName}</p>
            <p className="text-xs text-muted">Owner dashboard</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-card hover:text-ink'
                }`
              }
            >
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-card hover:text-danger"
        >
          <Icon name="logout" />
          Log out
        </button>
      </aside>

      {/* ---------- Top bar (phone) ---------- */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/85 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur md:hidden">
        <img src={logo} alt="" className="h-9 w-9 rounded-lg" />
        <p className="flex-1 font-bold">{profile?.storeName}</p>
        <button onClick={logout} className="rounded-full p-2 text-muted active:bg-card" aria-label="Log out">
          <Icon name="logout" />
        </button>
      </header>

      {/* ---------- Page ---------- */}
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:pl-72 md:pr-8 md:pt-8 md:pb-12">{children}</main>

      {/* ---------- Bottom tabs (phone) ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-elevated/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                isActive ? 'text-accent' : 'text-faint'
              }`
            }
          >
            <Icon name={n.icon} size={22} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}