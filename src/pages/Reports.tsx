import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { Icon } from '../components/Icon';
import { useAuth } from '../lib/auth';
import { initials, METHODS, peso } from '../lib/data';
import { fetchReport, MONTHS, phParts, RANGES, type RangeSpec, type Report } from '../lib/reports';

const hourText = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);
const same = (a: RangeSpec, b: RangeSpec) => JSON.stringify(a) === JSON.stringify(b);

export function Reports() {
  const { profile } = useAuth();
  const now = phParts(Date.now());
  const [spec, setSpec] = useState<RangeSpec>({ kind: 'preset', key: 'today' });
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'month' | 'year' | null>(null);
  const [pickYear, setPickYear] = useState(now.y);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchReport(spec)
      .then((r) => alive && (setData(r), setError(null)))
      .catch((e) => alive && setError(e?.message ?? 'Could not load the report'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [JSON.stringify(spec)]);

  async function share() {
    if (!data) return;
    const text = [
      `📊 ${profile?.storeName ?? 'Store'} — ${data.title}`,
      '',
      `Net sales: ${peso(data.net)}`,
      `Orders: ${data.orders} · Average: ${peso(data.avg)}`,
      `Voids: ${peso(data.voids)} (${data.voidCount})`,
      `SC/PWD discounts: ${peso(data.discounts)}`,
      '',
      'Payments:',
      ...METHODS.map((m) => `  ${m.label}: ${peso(data.byMethod[m.key] ?? 0)}`),
      '',
      'Top items:',
      ...data.topItems.slice(0, 5).map((t, i) => `  ${i + 1}. ${t.name} — ${t.qty} sold (${peso(t.revenue)})`),
      '',
      'By cashier:',
      ...data.cashiers.map(
        (c) =>
          `  ${c.name}: ${peso(c.sales)} · ${c.orders} orders · ${c.voids} voids` +
          (c.shifts ? ` · ${c.variance === 0 ? 'balanced' : c.variance < 0 ? `short ${peso(-c.variance)}` : `over ${peso(c.variance)}`}` : ''),
      ),
    ].join('\n');
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // cancelled
    }
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
      active ? 'border-accent bg-accent/15 text-ink' : 'border-line bg-card text-muted hover:text-ink'
    }`;

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-light tracking-tight md:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted">{data?.title ?? ''}</p>
        </div>
        {data && (
          <button onClick={share} className="flex items-center gap-2 rounded-full border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            <Icon name="share" size={16} /> {shared ? 'Copied!' : 'Share'}
          </button>
        )}
      </div>

      {/* Period chips */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => (setSpec({ kind: 'preset', key: r.key }), setPicker(null))} className={chip(same(spec, { kind: 'preset', key: r.key }))}>
            {r.label}
          </button>
        ))}
        <button onClick={() => setPicker(picker === 'month' ? null : 'month')} className={chip(spec.kind === 'month' || picker === 'month')}>
          📅 {spec.kind === 'month' ? `${MONTHS[spec.month]} ${spec.year}` : 'Month'} ▾
        </button>
        <button onClick={() => setPicker(picker === 'year' ? null : 'year')} className={chip(spec.kind === 'year' || picker === 'year')}>
          📅 {spec.kind === 'year' ? spec.year : 'Year'} ▾
        </button>
      </div>

      {picker === 'month' && (
        <div className="card mt-3 max-w-md p-4">
          <div className="flex items-center justify-center gap-6">
            <button onClick={() => setPickYear((y) => y - 1)} className="rounded-full bg-card-high p-2"><Icon name="back" /></button>
            <span className="w-16 text-center text-xl font-semibold">{pickYear}</span>
            <button onClick={() => setPickYear((y) => Math.min(now.y, y + 1))} disabled={pickYear >= now.y} className="rounded-full bg-card-high p-2 disabled:opacity-30"><Icon name="next" /></button>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {MONTHS.map((m, i) => {
              const future = pickYear > now.y || (pickYear === now.y && i > now.m);
              const on = spec.kind === 'month' && spec.year === pickYear && spec.month === i;
              return (
                <button key={m} disabled={future} onClick={() => (setSpec({ kind: 'month', year: pickYear, month: i }), setPicker(null))}
                  className={`h-11 rounded-xl border text-sm font-semibold disabled:opacity-30 ${on ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-elevated'}`}>
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {picker === 'year' && (
        <div className="card mt-3 grid max-w-md grid-cols-3 gap-2 p-4">
          {Array.from({ length: 6 }, (_, i) => now.y - i).map((y) => (
            <button key={y} onClick={() => (setSpec({ kind: 'year', year: y }), setPicker(null))}
              className={`h-11 rounded-xl border text-sm font-semibold ${spec.kind === 'year' && spec.year === y ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-elevated'}`}>
              {y}
            </button>
          ))}
        </div>
      )}

      {error && !data && <p className="mt-6 text-sm text-warning">{error}</p>}
      {!data ? (
        <div className="mt-16 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>
      ) : (
        <div className={`mt-5 grid gap-4 transition lg:grid-cols-2 ${loading ? 'opacity-50' : ''}`}>
          <div className="flex flex-col gap-4">
            <Summary data={data} />
            <Chart data={data} />
            <Payments data={data} />
          </div>
          <div className="flex flex-col gap-4">
            <TopItems data={data} />
            <Cashiers data={data} />
            <Hours data={data} />
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ data }: { data: Report }) {
  const diff = data.prevNet > 0 ? ((data.net - data.prevNet) / data.prevNet) * 100 : null;
  const up = (diff ?? 0) >= 0;
  const stats = [
    ['Orders', String(data.orders)],
    ['Average', peso(data.avg)],
    [`Voids (${data.voidCount})`, peso(data.voids)],
    ['SC/PWD disc.', peso(data.discounts)],
  ];
  return (
    <section className="card relative overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-accent/25 via-transparent to-transparent" />
      <p className="relative text-sm text-muted">Net sales · {data.title}</p>
      <p className="relative mt-1 text-5xl font-extralight tracking-tight">{peso(data.net)}</p>
      {diff !== null ? (
        <span className={`relative mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${up ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
          {up ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}% {data.compareLabel}
        </span>
      ) : (
        <p className="relative mt-3 text-xs text-faint">No sales in the previous period to compare</p>
      )}
      <div className="relative mt-6 grid grid-cols-2 gap-y-4 border-t border-line pt-4">
        {stats.map(([l, v], i) => (
          <div key={l}>
            <p className="text-xs text-faint">{l}</p>
            <p className={`mt-0.5 text-lg font-semibold ${i === 2 && data.voids > 0 ? 'text-danger' : ''}`}>{v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Chart({ data }: { data: Report }) {
  const best = data.bars.reduce((b, x, i) => (x.value > data.bars[b].value ? i : b), 0);
  const title = data.unit === 'hour' ? 'Sales by hour' : data.unit === 'month' ? 'Sales by month' : 'Sales by day';
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.bars} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: '#6b6b74', fontSize: 10 }} axisLine={false} tickLine={false}
              interval={data.unit === 'hour' ? 2 : data.bars.length > 14 ? 4 : 0} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              labelStyle={{ color: '#a1a1aa' }} formatter={(v) => [peso(Number(v)), 'Sales']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.bars.map((b, i) => (
                <Cell key={i} fill={b.value > 0 && i === best ? '#ff7a3d' : b.value > 0 ? 'rgba(255,122,61,0.45)' : '#26262b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data.bars[best]?.value > 0 && (
        <p className="mt-2 text-xs text-faint">Best: {data.bars[best].label} · {peso(data.bars[best].value)}</p>
      )}
    </section>
  );
}

function Payments({ data }: { data: Report }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Payments</h2>
      <div className="mt-4 flex flex-col gap-4">
        {METHODS.map((m) => {
          const amount = data.byMethod[m.key] ?? 0;
          const pct = data.net > 0 ? Math.min(amount / data.net, 1) : 0;
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

function TopItems({ data }: { data: Report }) {
  const max = Math.max(...data.topItems.map((t) => t.qty), 1);
  return (
    <section className="card p-5">
      <h2 className="font-semibold">🏆 Top items</h2>
      {data.topItems.length === 0 && <p className="mt-3 text-sm text-muted">No items sold.</p>}
      <div className="divide-y divide-line">
        {data.topItems.map((t, i) => (
          <div key={t.name} className="flex gap-3 py-3">
            <span className={`w-5 font-bold ${i < 3 ? 'text-accent' : 'text-faint'}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <p className="truncate font-semibold">{t.name}</p>
                <p className="font-semibold">{peso(t.revenue)}</p>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card-high">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(t.qty / max) * 100}%` }} />
                </div>
                <span className="text-xs text-faint">{t.qty} sold</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Cashiers({ data }: { data: Report }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">👤 By cashier</h2>
      {data.cashiers.length === 0 && <p className="mt-3 text-sm text-muted">No activity.</p>}
      <div className="divide-y divide-line">
        {data.cashiers.map((c) => {
          const color = c.variance === 0 ? 'text-success' : c.variance < 0 ? 'text-danger' : 'text-warning';
          return (
            <div key={c.id ?? c.name} className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{initials(c.name)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <p className="font-semibold">{peso(c.sales)}</p>
                </div>
                <div className="mt-0.5 flex justify-between gap-2 text-xs">
                  <p className="text-faint">{c.orders} orders · {c.voids} voids{c.voidAmount ? ` (${peso(c.voidAmount)})` : ''}</p>
                  {c.shifts > 0 && (
                    <p className={`font-semibold ${color}`}>
                      {c.variance === 0 ? 'Balanced' : c.variance < 0 ? `Short ${peso(-c.variance)}` : `Over ${peso(c.variance)}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Hours({ data }: { data: Report }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">⏰ Busiest hours</h2>
      <p className="text-xs text-faint">Best times to have more staff on shift</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {data.busiestHours.length === 0 && <p className="text-sm text-muted">No sales yet.</p>}
        {data.busiestHours.map((h, i) => (
          <div key={h.hour} className={`rounded-xl border px-4 py-3 text-center ${i === 0 ? 'border-accent bg-accent/10' : 'border-line bg-elevated'}`}>
            <p className={`font-semibold ${i === 0 ? 'text-accent' : ''}`}>{hourText(h.hour)}</p>
            <p className="text-xs text-faint">{peso(h.value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}