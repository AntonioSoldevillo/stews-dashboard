import { supabase } from './supabase';

const PH = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function phParts(ms: number) {
  const d = new Date(ms + PH);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}
const phMidnight = (y: number, m: number, d: number) => Date.UTC(y, m, d) - PH;
const phHour = (iso: string) => new Date(new Date(iso).getTime() + PH).getUTCHours();

export type RangeKey = 'today' | 'yesterday' | '7d' | 'month' | 'lastMonth';
export type RangeSpec =
  | { kind: 'preset'; key: RangeKey }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number };

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
];

export type Unit = 'hour' | 'day' | 'month';

export function rangeFor(spec: RangeSpec) {
  const now = Date.now();
  const p = phParts(now);
  let start = 0, end = 0, prevStart = 0, prevEnd = 0;
  let compareLabel = '', title = '';
  let unit: Unit = 'day';

  if (spec.kind === 'month') {
    start = phMidnight(spec.year, spec.month, 1);
    end = Math.min(phMidnight(spec.year, spec.month + 1, 1), now);
    prevStart = phMidnight(spec.year, spec.month - 1, 1);
    prevEnd = Math.min(prevStart + (end - start), start);
    compareLabel = 'vs previous month';
    title = `${MONTHS_FULL[spec.month]} ${spec.year}`;
  } else if (spec.kind === 'year') {
    start = phMidnight(spec.year, 0, 1);
    end = Math.min(phMidnight(spec.year + 1, 0, 1), now);
    prevStart = phMidnight(spec.year - 1, 0, 1);
    prevEnd = Math.min(prevStart + (end - start), start);
    compareLabel = 'vs previous year';
    title = String(spec.year);
    unit = 'month';
  } else {
    switch (spec.key) {
      case 'today':
        start = phMidnight(p.y, p.m, p.d);
        end = now;
        prevStart = start - DAY;
        prevEnd = end - DAY;
        compareLabel = 'vs yesterday';
        break;
      case 'yesterday':
        start = phMidnight(p.y, p.m, p.d - 1);
        end = phMidnight(p.y, p.m, p.d);
        prevStart = start - DAY;
        prevEnd = end - DAY;
        compareLabel = 'vs day before';
        break;
      case '7d':
        start = phMidnight(p.y, p.m, p.d - 6);
        end = now;
        prevStart = start - 7 * DAY;
        prevEnd = end - 7 * DAY;
        compareLabel = 'vs previous 7 days';
        break;
      case 'month':
        start = phMidnight(p.y, p.m, 1);
        end = now;
        prevStart = phMidnight(p.y, p.m - 1, 1);
        prevEnd = prevStart + (end - start);
        compareLabel = 'vs last month';
        break;
      case 'lastMonth':
        start = phMidnight(p.y, p.m - 1, 1);
        end = phMidnight(p.y, p.m, 1);
        prevStart = phMidnight(p.y, p.m - 2, 1);
        prevEnd = start;
        compareLabel = 'vs month before';
        break;
    }
    title = RANGES.find((x) => x.key === spec.key)?.label ?? '';
    unit = end - start <= DAY ? 'hour' : 'day';
  }
  return { start, end, prevStart, prevEnd, compareLabel, title, unit };
}

// Supabase returns max 1000 rows per request
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export type TopItem = { name: string; qty: number; revenue: number };
export type CashierStat = {
  id: string | null;
  name: string;
  sales: number;
  orders: number;
  voids: number;
  voidAmount: number;
  variance: number;
  shifts: number;
};
export type Report = {
  title: string;
  net: number;
  prevNet: number;
  compareLabel: string;
  orders: number;
  avg: number;
  voids: number;
  voidCount: number;
  discounts: number;
  byMethod: Record<string, number>;
  bars: { label: string; value: number }[];
  unit: Unit;
  busiestHours: { hour: number; value: number }[];
  topItems: TopItem[];
  cashiers: CashierStat[];
};

export async function fetchReport(spec: RangeSpec): Promise<Report> {
  const r = rangeFor(spec);
  const s = new Date(r.start).toISOString();
  const e = new Date(r.end).toISOString();
  const ps = new Date(r.prevStart).toISOString();
  const pe = new Date(r.prevEnd).toISOString();

  const [orders, voids, items, shifts, prevOrders, prevVoids] = await Promise.all([
    fetchAll<any>((f, t) =>
      supabase
        .from('orders')
        .select('id, total, discount_total, status, created_at, staff(id, full_name), payments(method, amount)')
        .gte('created_at', s).lt('created_at', e).order('created_at').range(f, t),
    ),
    fetchAll<any>((f, t) =>
      supabase
        .from('voids')
        .select('amount, order_id, staff(id, full_name)')
        .gte('created_at', s).lt('created_at', e).order('created_at').range(f, t),
    ),
    fetchAll<any>((f, t) =>
      supabase
        .from('order_items')
        .select('product_name, qty, voided_qty, refunded_qty, line_total')
        .gte('created_at', s).lt('created_at', e).order('created_at').range(f, t),
    ),
    fetchAll<any>((f, t) =>
      supabase
        .from('shifts')
        .select('variance, staff(id, full_name)')
        .eq('status', 'closed').gte('closed_at', s).lt('closed_at', e).order('closed_at').range(f, t),
    ),
    fetchAll<any>((f, t) =>
      supabase.from('orders').select('total').gte('created_at', ps).lt('created_at', pe).order('created_at').range(f, t),
    ),
    fetchAll<any>((f, t) =>
      supabase.from('voids').select('amount').gte('created_at', ps).lt('created_at', pe).order('created_at').range(f, t),
    ),
  ]);

  const voidByOrder: Record<string, number> = {};
  voids.forEach((v) => (voidByOrder[v.order_id] = (voidByOrder[v.order_id] ?? 0) + Number(v.amount)));
  const voidTotal = voids.reduce((sum, v) => sum + Number(v.amount), 0);
  const netOf = (o: any) => Math.max(Number(o.total) - (voidByOrder[o.id] ?? 0), 0);

  const net = Math.max(orders.reduce((sum, o) => sum + Number(o.total), 0) - voidTotal, 0);
  const counted = orders.filter((o) => o.status !== 'voided');
  const discounts = counted.reduce((sum, o) => sum + Number(o.discount_total ?? 0), 0);
  const prevNet = Math.max(
    prevOrders.reduce((sum, o) => sum + Number(o.total), 0) - prevVoids.reduce((sum, v) => sum + Number(v.amount), 0),
    0,
  );

  const byMethod: Record<string, number> = { cash: 0, gcash: 0, maya: 0, card: 0 };
  orders.forEach((o) => {
    const ratio = Number(o.total) > 0 ? netOf(o) / Number(o.total) : 0;
    (o.payments ?? []).forEach((p: any) => (byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount) * ratio));
  });

  const hourly = Array(24).fill(0);
  orders.forEach((o) => (hourly[phHour(o.created_at)] += netOf(o)));
  const busiestHours = hourly
    .map((value, hour) => ({ hour, value }))
    .filter((h) => h.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  let bars: { label: string; value: number }[];
  if (r.unit === 'hour') {
    bars = hourly.map((value, h) => ({ label: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`, value }));
  } else if (r.unit === 'month') {
    const monthly = Array(12).fill(0);
    orders.forEach((o) => (monthly[phParts(new Date(o.created_at).getTime()).m] += netOf(o)));
    bars = monthly.map((value, i) => ({ label: MONTHS[i], value }));
  } else {
    const days = Math.max(1, Math.ceil((r.end - r.start) / DAY));
    const daily = Array(days).fill(0);
    orders.forEach((o) => {
      const i = Math.floor((new Date(o.created_at).getTime() - r.start) / DAY);
      if (i >= 0 && i < days) daily[i] += netOf(o);
    });
    bars = daily.map((value, i) => ({ label: String(new Date(r.start + i * DAY + PH).getUTCDate()), value }));
  }

  const itemMap: Record<string, TopItem> = {};
  items.forEach((it) => {
    const qty = Number(it.qty);
    const netQty = Math.max(qty - Number(it.voided_qty ?? 0) - Number(it.refunded_qty ?? 0), 0);
    if (netQty <= 0) return;
    const m = (itemMap[it.product_name] ??= { name: it.product_name, qty: 0, revenue: 0 });
    m.qty += netQty;
    m.revenue += qty > 0 ? Number(it.line_total) * (netQty / qty) : 0;
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10);

  const cmap: Record<string, CashierStat> = {};
  const cs = (st: any) => {
    const id = st?.id ?? null;
    const name = st?.full_name ?? 'Cashier';
    return (cmap[id ?? name] ??= { id, name, sales: 0, orders: 0, voids: 0, voidAmount: 0, variance: 0, shifts: 0 });
  };
  orders.forEach((o) => {
    const c = cs(o.staff);
    c.sales += netOf(o);
    if (o.status !== 'voided') c.orders += 1;
  });
  voids.forEach((v) => {
    const c = cs(v.staff);
    c.voids += 1;
    c.voidAmount += Number(v.amount);
  });
  shifts.forEach((sh) => {
    const c = cs(sh.staff);
    c.variance += Number(sh.variance ?? 0);
    c.shifts += 1;
  });

  return {
    title: r.title,
    net,
    prevNet,
    compareLabel: r.compareLabel,
    orders: counted.length,
    avg: counted.length ? net / counted.length : 0,
    voids: voidTotal,
    voidCount: voids.length,
    discounts,
    byMethod,
    bars,
    unit: r.unit,
    busiestHours,
    topItems,
    cashiers: Object.values(cmap).sort((a, b) => b.sales - a.sales),
  };
}