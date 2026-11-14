import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Icon } from '../components/Icon';
import { fetchCashierDay, type CashierDay, type ShiftDetail } from '../lib/cashier';
import { dateOf, initials, manilaDayStart, METHODS, peso, timeOf } from '../lib/data';

export function CashierDetail() {
  const { id } = useParams();
  const [daysAgo, setDaysAgo] = useState(0);
  const [data, setData] = useState<CashierDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetchCashierDay(id, daysAgo)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e?.message ?? 'Could not load'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, daysAgo]);

  const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : dateOf(manilaDayStart(daysAgo).toISOString());

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><Icon name="back" size={16} /> Back</Link>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">{initials(data?.name ?? '?')}</div>
        <h1 className="text-2xl font-light tracking-tight md:text-3xl">{data?.name ?? ' '}</h1>
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <button onClick={() => setDaysAgo((d) => d + 1)} className="rounded-full border border-line bg-card p-2"><Icon name="back" /></button>
        <p className="w-40 text-center font-semibold">{label}</p>
        <button onClick={() => setDaysAgo((d) => Math.max(0, d - 1))} disabled={daysAgo === 0} className="rounded-full border border-line bg-card p-2 disabled:opacity-30"><Icon name="next" /></button>
      </div>

      {error && !data && <p className="mt-6 text-sm text-warning">{error}</p>}
      {!data ? (
        <div className="mt-12 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
      ) : (
        <div className={`mt-5 grid gap-4 lg:grid-cols-2 ${loading ? 'opacity-50' : ''}`}>
          <div className="flex flex-col gap-4">
            <section className="card relative overflow-hidden p-5">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-accent/25 via-transparent to-transparent" />
              <p className="relative text-sm text-muted">Net sales</p>
              <p className="relative text-5xl font-extralight tracking-tight">{peso(data.net)}</p>
              <div className="relative mt-4 grid grid-cols-2 gap-y-3">
                <Stat label="Orders" value={String(data.orders)} />
                <Stat label="Average" value={peso(data.avg)} />
                <Stat label={`Voids (${data.voids.length})`} value={peso(data.voidTotal)} danger={data.voidTotal > 0} />
                <Stat label="SC/PWD" value={peso(data.discounts)} />
              </div>
            </section>
            {data.shifts.length === 0 ? (
              <section className="card p-5 text-muted">No shift on this day.</section>
            ) : (
              data.shifts.map((sh) => <Shift key={sh.id} sh={sh} />)
            )}
          </div>

          <div className="flex flex-col gap-4">
            <section className="card p-5">
              <h2 className="font-semibold">Payments</h2>
              <div className="mt-2 divide-y divide-line">
                {METHODS.map((m) => (
                  <div key={m.key} className="flex items-center gap-2 py-2.5 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                    <span className="flex-1">{m.label}</span>
                    <span className="font-semibold">{peso(data.byMethod[m.key] ?? 0)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="font-semibold">🔴 Voids</h2>
              {data.voids.length === 0 && <p className="mt-2 text-sm text-muted">No voids.</p>}
              <div className="divide-y divide-line">
                {data.voids.map((v) => (
                  <div key={v.id} className="flex gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{v.receipt} · {v.reason}</p>
                      <p className="text-xs text-faint">{timeOf(v.at)}{v.note ? ` · ${v.note}` : ''}</p>
                    </div>
                    <span className="font-semibold text-danger">− {peso(v.amount)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="font-semibold">💵 Cash in / out</h2>
              {data.cash.length === 0 && <p className="mt-2 text-sm text-muted">None.</p>}
              <div className="divide-y divide-line">
                {data.cash.map((c) => {
                  const out = c.type === 'cash_out';
                  return (
                    <div key={c.id} className="flex gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{out ? 'Cash out' : 'Cash in'} · {c.reason}</p>
                        <p className="text-xs text-faint">{timeOf(c.at)}</p>
                      </div>
                      <span className={`font-semibold ${out ? 'text-warning' : 'text-success'}`}>{out ? '− ' : '+ '}{peso(c.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="font-semibold">🧾 Orders ({data.orderList.length})</h2>
              {data.orderList.length === 0 && <p className="mt-2 text-sm text-muted">No orders.</p>}
              <div className="divide-y divide-line">
                {data.orderList.map((o) => (
                  <div key={o.id} className="flex gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{o.receipt}</p>
                      <p className="text-xs text-faint">
                        {timeOf(o.at)} · {o.methods || '—'}
                        {o.status === 'voided' ? ' · VOIDED' : o.status === 'partially_voided' ? ' · partly voided' : ''}
                      </p>
                    </div>
                    <span className={`font-semibold ${o.status === 'voided' ? 'text-faint line-through' : ''}`}>{peso(o.net)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-xs text-faint">{label}</p>
      <p className={`text-lg font-semibold ${danger ? 'text-danger' : ''}`}>{value}</p>
    </div>
  );
}

function Shift({ sh }: { sh: ShiftDetail }) {
  const open = sh.status === 'open';
  const v = sh.variance ?? 0;
  const tone = open ? 'info' : v === 0 ? 'success' : v < 0 ? 'danger' : 'warning';
  const colors: Record<string, string> = {
    info: 'border-info/40 bg-info/10 text-info',
    success: 'border-success/40 bg-success/10 text-success',
    danger: 'border-danger/40 bg-danger/10 text-danger',
    warning: 'border-warning/40 bg-warning/10 text-warning',
  };
  const status = open
    ? `Shift open · expected so far ${peso(sh.expected)}`
    : v === 0 ? '✓ Cash balanced' : v < 0 ? `SHORT ${peso(-v)}` : `OVER ${peso(v)}`;
  const denoms = Object.entries(sh.denominations ?? {})
    .map(([d, n]) => ({ d: Number(d), n: Number(n) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.d - a.d);

  const Line = ({ label, value, strong, cls = '' }: { label: string; value: string; strong?: boolean; cls?: string }) => (
    <div className={`flex justify-between py-1.5 text-sm ${strong ? 'mt-1 border-t border-line pt-2 font-semibold' : 'text-muted'}`}>
      <span className={strong ? 'text-ink' : ''}>{label}</span>
      <span className={cls || (strong ? 'text-ink' : 'text-ink')}>{value}</span>
    </div>
  );

  return (
    <section className="card p-5">
      <p className="text-xs font-semibold tracking-wide text-faint">
        SHIFT{sh.terminal ? ` · ${sh.terminal}` : ''} · {timeOf(sh.openedAt)} – {sh.closedAt ? timeOf(sh.closedAt) : 'now'}
      </p>
      <div className={`my-3 rounded-xl border p-4 text-xl font-bold ${colors[tone]}`}>{status}</div>
      <Line label="Opening cash" value={peso(sh.openingCash)} />
      <Line label="+ Cash sales" value={peso(sh.cashSales)} />
      {sh.cashVoids > 0 && <Line label="− Cash voids" value={peso(sh.cashVoids)} />}
      {sh.cashIn > 0 && <Line label="+ Cash in" value={peso(sh.cashIn)} />}
      {sh.cashOut > 0 && <Line label="− Cash out" value={peso(sh.cashOut)} />}
      <Line label="Expected in drawer" value={peso(sh.expected)} strong />
      {!open && (
        <>
          <Line label="Counted by cashier" value={sh.counted === null ? '—' : peso(sh.counted)} strong />
          <Line label="Difference" value={`${v > 0 ? '+' : ''}${peso(v)}`} strong cls={colors[tone].split(' ').pop()} />
        </>
      )}
      {denoms.length > 0 && (
        <>
          <p className="mt-3 text-xs text-faint">Cash counted</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {denoms.map((x) => (
              <span key={x.d} className="rounded-lg bg-elevated px-2.5 py-1 text-xs font-semibold">
                ₱{x.d.toLocaleString()} × {x.n}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}