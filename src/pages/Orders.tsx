import { useEffect, useState } from 'react';

import { Icon } from '../components/Icon';
import { dateOf, manilaDayStart, peso, useLive } from '../lib/data';
import { fetchOrdersForDay, type OrderRow } from '../lib/orders';

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Manila' });

export function Orders() {
  const [daysAgo, setDaysAgo] = useState(0);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function load(d = daysAgo) {
    try {
      setOrders(await fetchOrdersForDay(d));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the orders');
    }
  }

  useEffect(() => {
    setOrders(null);
    load(daysAgo);
  }, [daysAgo]);
  useLive(() => daysAgo === 0 && load(0), ['orders', 'voids']);

  const q = search.trim().toLowerCase();
  const shown = (orders ?? []).filter((o) => !q || o.receipt.toLowerCase().includes(q) || o.cashier.toLowerCase().includes(q));
  const total = shown.reduce((s, o) => s + o.net, 0);
  const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : dateOf(manilaDayStart(daysAgo).toISOString());

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight md:text-3xl">Orders</h1>
      <p className="mt-1 text-sm text-muted">Every receipt, with the exact time</p>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => setDaysAgo((d) => d + 1)} className="rounded-full border border-line bg-card p-2"><Icon name="back" /></button>
        <div className="flex-1 text-center">
          <p className="font-semibold">{label}</p>
          {daysAgo > 1 && <p className="text-xs text-faint">{dateOf(manilaDayStart(daysAgo).toISOString())}</p>}
        </div>
        <button onClick={() => setDaysAgo((d) => Math.max(0, d - 1))} disabled={daysAgo === 0} className="rounded-full border border-line bg-card p-2 disabled:opacity-30"><Icon name="next" /></button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search receipt no. or cashier"
        className="mt-4 h-11 w-full rounded-xl border border-line bg-card px-4 text-base outline-none placeholder:text-faint focus:border-accent"
      />
      {orders && (
        <p className="mt-3 text-center text-xs text-faint">
          {shown.length} {shown.length === 1 ? 'order' : 'orders'} · {peso(total)}
        </p>
      )}

      {error && <p className="mt-4 text-sm text-warning">{error}</p>}
      {!orders ? (
        <div className="mt-12 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
      ) : shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">No orders.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {shown.map((o) => {
            const isOpen = open === o.id;
            const voided = o.status === 'voided';
            return (
              <div key={o.id} className={`card overflow-hidden ${isOpen ? 'border-accent/60' : ''}`}>
                <button onClick={() => setOpen(isOpen ? null : o.id)} className="flex w-full items-center gap-3 p-4 text-left">
                  <div className="w-20 shrink-0">
                    <p className="text-sm font-semibold">{clock(o.at).replace(/:\d\d (?=[AP]M)/, ' ')}</p>
                    <p className="text-[11px] text-faint">{o.terminal}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{o.receipt}</p>
                    <p className="truncate text-xs text-faint">
                      {o.cashier} · {o.payments.map((p) => p.method.toUpperCase()).join(' + ') || '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${voided ? 'text-faint line-through' : ''}`}>{peso(o.net)}</p>
                    {o.status !== 'completed' && (
                      <p className={`text-[10px] font-bold ${voided ? 'text-danger' : 'text-warning'}`}>
                        {voided ? 'VOIDED' : 'PARTLY VOIDED'}
                      </p>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-line bg-elevated px-4 py-3">
                    <p className="text-xs text-faint">{dateOf(o.at)} · {clock(o.at)}</p>
                    <div className="mt-2 divide-y divide-line">
                      {o.items.map((it, i) => (
                        <div key={i} className="flex gap-3 py-2 text-sm">
                          <span className="w-6 font-semibold text-muted">{it.qty}×</span>
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold ${it.voided >= it.qty ? 'text-faint line-through' : ''}`}>{it.name}</p>
                            {it.details && <p className="text-xs text-accent">{it.details}</p>}
                            {it.voided > 0 && <p className="text-xs text-danger">{it.voided} voided</p>}
                          </div>
                          <span className="font-semibold">{peso(it.total)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm">
                      <span className="text-muted">Total{o.total !== o.net ? ' (after voids)' : ''}</span>
                      <span className="font-semibold">{peso(o.net)}</span>
                    </div>
                    {o.payments.map((p, i) => (
                      <p key={i} className="mt-1 text-xs text-faint">
                        {p.method.toUpperCase()} {peso(p.amount)}{p.ref ? ` · ref ${p.ref}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}