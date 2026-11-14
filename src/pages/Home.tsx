import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { Icon } from '../components/Icon';
import { useAuth } from '../lib/auth';
import {
  fetchDashboard,
  hourLabel,
  initials,
  manilaHour,
  METHODS,
  peso,
  timeOf,
  useLive,
  type Dashboard,
} from '../lib/data';

function greeting() {
  const h = manilaHour(Date.now());
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const SEVERITY: Record<string, string> = {
  success: '#3ddc97',
  info: '#5b8cff',
  warning: '#ffb547',
  critical: '#ff5c5c',
};

export function Home() {
  const { profile } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setData(await fetchDashboard());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the dashboard');
    }
  }

  useEffect(() => {
    load();
  }, []);
  useLive(load, ['orders', 'payments', 'alerts', 'shifts', 'pos_terminals', 'voids']);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{profile?.storeName}</p>
          <h1 className="mt-1 text-2xl font-light tracking-tight md:text-3xl">{greeting()} 👋</h1>
        </div>
        <span className="mt-1 flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Live
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-warning">⚠ {error}</p>}

      {!data ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col gap-4">
            <Hero data={data} />
            <Cashiers data={data} />
            <Hourly data={data} />
            <Payments data={data} />
          </div>
          <div className="flex flex-col gap-4">
            <Terminals data={data} />
            <Feed data={data} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Today's sales ----------
function Hero({ data }: { data: Dashboard }) {
  const diff = data.yesterday > 0 ? ((data.total - data.yesterday) / data.yesterday) * 100 : null;
  const up = (diff ?? 0) >= 0;
  return (
    <section className="card relative overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-accent/25 via-transparent to-transparent" />
      <p className="relative text-sm font-medium text-muted">Today’s sales</p>
      <p className="relative mt-1 text-5xl font-extralight tracking-tight md:text-6xl">{peso(data.total)}</p>
      {diff !== null ? (
        <span
          className={`relative mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            up ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
          }`}
        >
          {up ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}% vs yesterday
        </span>
      ) : (
        <p className="relative mt-3 text-xs text-faint">No sales yesterday at this time</p>
      )}
      <div className="relative mt-6 grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
        <Stat label="Orders" value={String(data.orders)} />
        <Stat label="Average" value={peso(data.avg)} />
        <Stat label="Voids" value={peso(data.voids)} danger={data.voids > 0} />
      </div>
    </section>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="px-3 first:pl-0">
      <p className="text-xs text-faint">{label}</p>
      <p className={`mt-0.5 truncate text-lg font-semibold ${danger ? 'text-danger' : ''}`}>{value}</p>
    </div>
  );
}

// ---------- Cashiers today ----------
function Cashiers({ data }: { data: Dashboard }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">👤 Cashiers today</h2>
      <p className="text-xs text-faint">Tap a cashier for the full shift details</p>
      {data.cashiers.length === 0 && <p className="mt-4 text-sm text-muted">No cashier activity yet today.</p>}
      <div className="mt-2 divide-y divide-line">
        {data.cashiers.map((c) => {
          const sh = c.shift;
          let status = 'No shift today';
          let color = 'text-muted';
          if (sh?.status === 'open') {
            status = `● On shift since ${timeOf(sh.openedAt)}${sh.terminal ? ` · ${sh.terminal}` : ''}`;
            color = 'text-success';
          } else if (sh) {
            const v = sh.variance ?? 0;
            status = `Closed ${sh.closedAt ? timeOf(sh.closedAt) : ''} · ${
              v === 0 ? 'Balanced' : v < 0 ? `SHORT ${peso(-v)}` : `OVER ${peso(v)}`
            }`;
            color = v === 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-warning';
          }
          const body = (
            <>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    sh?.status === 'open' ? 'bg-accent text-white' : 'bg-card-high text-muted'
                  }`}
                >
                  {initials(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className={`truncate text-xs ${color}`}>{status}</p>
                </div>
                <p className="text-lg font-semibold">{peso(c.sales)}</p>
                {c.staffId && <Icon name="next" size={18} className="text-faint" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <span key={m.key} className="flex items-center gap-1.5 rounded-lg bg-elevated px-2 py-1 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                    <span className="text-muted">{m.label}</span>
                    <span className="font-semibold">{peso(c.byMethod[m.key] ?? 0)}</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-faint">
                {c.orders} orders · {c.voids} {c.voids === 1 ? 'void' : 'voids'}
                {c.voidAmount ? ` (${peso(c.voidAmount)})` : ''}
              </p>
            </>
          );
          return c.staffId ? (
            <Link key={c.staffId} to={`/cashier/${c.staffId}`} className="block py-4 transition active:opacity-60 md:hover:opacity-80">
              {body}
            </Link>
          ) : (
            <div key={c.name} className="py-4">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Sales by hour ----------
function Hourly({ data }: { data: Dashboard }) {
  const now = manilaHour(Date.now());
  const first = data.hourly.findIndex((v) => v > 0);
  const start = Math.min(6, first === -1 ? 6 : first);
  const bars = data.hourly.slice(start).map((v, i) => ({ h: start + i, label: hourLabel(start + i), value: v }));
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Sales by hour</h2>
      <div className="mt-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: '#6b6b74', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              labelStyle={{ color: '#a1a1aa' }}
              formatter={(v) => [peso(Number(v)), 'Sales']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {bars.map((b) => (
                <Cell
                  key={b.h}
                  fill={b.h === now ? '#ff7a3d' : b.value > 0 ? 'rgba(255,122,61,0.45)' : '#26262b'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ---------- Payments ----------
function Payments({ data }: { data: Dashboard }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Payments (all cashiers)</h2>
      <div className="mt-4 flex flex-col gap-4">
        {METHODS.map((m) => {
          const amount = data.byMethod[m.key] ?? 0;
          const pct = data.total > 0 ? Math.min(amount / data.total, 1) : 0;
          return (
            <div key={m.key}>
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                <span className="flex-1">{m.label}</span>
                <span className="text-xs text-faint">{Math.round(pct * 100)}%</span>
                <span className="w-28 text-right font-semibold">{peso(amount)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-high">
                <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: m.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Terminals ----------
function Terminals({ data }: { data: Dashboard }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Terminals</h2>
      <div className="mt-2 divide-y divide-line">
        {data.terminals.length === 0 && <p className="py-3 text-sm text-muted">No POS terminals yet.</p>}
        {data.terminals.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                t.online ? 'bg-success/15 text-success' : 'bg-card-high text-faint'
              }`}
            >
              <Icon name="tablet" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {t.code} · {t.name}
              </p>
              <p className="truncate text-xs text-faint">
                {t.cashier ? `${t.cashier} on shift since ${timeOf(t.since!)}` : 'No open shift'}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                t.online ? 'bg-success/15 text-success' : 'bg-card-high text-muted'
              }`}
            >
              {t.online ? 'Online' : t.lastSeen ? `Seen ${timeOf(t.lastSeen)}` : 'Offline'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Live feed ----------
function Feed({ data }: { data: Dashboard }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Live feed</h2>
      <div className="mt-2 divide-y divide-line">
        {data.feed.length === 0 && <p className="py-3 text-sm text-muted">Nothing yet today. Sales will appear here instantly.</p>}
        {data.feed.map((f) => (
          <div key={f.id} className="flex items-center gap-3 py-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: SEVERITY[f.severity] ?? SEVERITY.info }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{f.title}</p>
              <p className="truncate text-xs text-faint">{f.subtitle}</p>
            </div>
            <div className="text-right">
              {f.amount !== undefined && <p className="text-sm font-semibold">{peso(f.amount)}</p>}
              <p className="text-xs text-faint">{timeOf(f.at)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}