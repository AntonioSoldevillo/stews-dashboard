import { useEffect, useRef } from 'react';

import { supabase } from './supabase';

// ---------- Philippine time ----------
const PH = 8 * 60 * 60 * 1000;

export function manilaDayStart(daysAgo = 0) {
  const now = new Date(Date.now() + PH);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo) - PH);
}

export function manilaHour(iso: string | number) {
  return new Date(new Date(iso).getTime() + PH).getUTCHours();
}

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
export const peso = (n: number) => money.format(n || 0);

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });

export const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

export const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);

export const METHODS: { key: string; label: string; color: string }[] = [
  { key: 'cash', label: 'Cash', color: '#3ddc97' },
  { key: 'gcash', label: 'GCash', color: '#5b8cff' },
  { key: 'maya', label: 'Maya', color: '#3ddcb4' },
  { key: 'card', label: 'Card', color: '#b07cff' },
];

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

// ---------- Live updates: reload when the POS saves something ----------
export function useLive(reload: () => void, tables: string[]) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    const later = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => reloadRef.current(), 800);
    };
    const channel = supabase.channel(`web-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tables.forEach((table) => channel.on('postgres_changes', { event: '*', schema: 'public', table }, later));
    channel.subscribe();
    const every = setInterval(() => reloadRef.current(), 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(every);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}

// ---------- Dashboard ----------
export type CashierToday = {
  staffId: string | null;
  name: string;
  sales: number;
  orders: number;
  byMethod: Record<string, number>;
  voids: number;
  voidAmount: number;
  shift: { status: string; openedAt: string; closedAt: string | null; variance: number | null; terminal: string | null } | null;
};

export type FeedItem = {
  id: string;
  title: string;
  subtitle: string;
  amount?: number;
  severity: string;
  at: string;
};

export type Terminal = {
  id: string;
  code: string;
  name: string;
  online: boolean;
  lastSeen: string | null;
  cashier: string | null;
  since: string | null;
};

export type Dashboard = {
  total: number;
  orders: number;
  avg: number;
  voids: number;
  yesterday: number;
  byMethod: Record<string, number>;
  hourly: number[];
  cashiers: CashierToday[];
  feed: FeedItem[];
  terminals: Terminal[];
};

function check(...results: { error: any }[]) {
  for (const r of results) if (r.error) throw new Error(r.error.message);
}

export async function fetchDashboard(): Promise<Dashboard> {
  const today = manilaDayStart(0).toISOString();
  const yStart = manilaDayStart(1).toISOString();
  const yNow = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [orders, yOrders, voids, yVoids, alerts, terminals, shifts] = await Promise.all([
    supabase
      .from('orders')
      .select('id, receipt_no, total, status, created_at, staff(id, full_name), payments(method, amount)')
      .gte('created_at', today)
      .order('created_at', { ascending: false }),
    supabase.from('orders').select('total').gte('created_at', yStart).lt('created_at', yNow),
    supabase.from('voids').select('amount, order_id, staff(id, full_name)').gte('created_at', today),
    supabase.from('voids').select('amount').gte('created_at', yStart).lt('created_at', yNow),
    supabase
      .from('alerts')
      .select('id, type, severity, title, message, created_at')
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('pos_terminals').select('id, terminal_code, name, last_seen_at').eq('is_active', true).order('terminal_code'),
    supabase
      .from('shifts')
      .select('terminal_id, status, opened_at, closed_at, variance, staff(id, full_name), pos_terminals(terminal_code)')
      .or(`status.eq.open,opened_at.gte.${today}`)
      .order('opened_at', { ascending: false }),
  ]);
  check(orders, yOrders, voids, yVoids, alerts, terminals, shifts);

  const rows = (orders.data ?? []) as any[];
  const voidByOrder: Record<string, number> = {};
  (voids.data ?? []).forEach((v: any) => (voidByOrder[v.order_id] = (voidByOrder[v.order_id] ?? 0) + Number(v.amount)));
  const netOf = (o: any) => Math.max(Number(o.total) - (voidByOrder[o.id] ?? 0), 0);
  const ratioOf = (o: any) => (Number(o.total) > 0 ? netOf(o) / Number(o.total) : 0);

  const total = rows.reduce((s, o) => s + netOf(o), 0);
  const count = rows.filter((o) => o.status !== 'voided').length;
  const voidTotal = Object.values(voidByOrder).reduce((a, b) => a + b, 0);
  const yesterday = Math.max(
    (yOrders.data ?? []).reduce((s: number, o: any) => s + Number(o.total), 0) -
      (yVoids.data ?? []).reduce((s: number, v: any) => s + Number(v.amount), 0),
    0,
  );

  const byMethod: Record<string, number> = { cash: 0, gcash: 0, maya: 0, card: 0 };
  const hourly = Array(24).fill(0);
  rows.forEach((o) => {
    hourly[manilaHour(o.created_at)] += netOf(o);
    (o.payments ?? []).forEach((p: any) => (byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount) * ratioOf(o)));
  });

  // Cashiers today
  const map: Record<string, CashierToday> = {};
  const cs = (id: string | null, name: string) =>
    (map[id ?? name] ??= {
      staffId: id,
      name,
      sales: 0,
      orders: 0,
      byMethod: { cash: 0, gcash: 0, maya: 0, card: 0 },
      voids: 0,
      voidAmount: 0,
      shift: null,
    });
  rows.forEach((o) => {
    const c = cs(o.staff?.id ?? null, o.staff?.full_name ?? 'Cashier');
    c.sales += netOf(o);
    if (o.status !== 'voided') c.orders += 1;
    (o.payments ?? []).forEach((p: any) => (c.byMethod[p.method] = (c.byMethod[p.method] ?? 0) + Number(p.amount) * ratioOf(o)));
  });
  (voids.data ?? []).forEach((v: any) => {
    const c = cs(v.staff?.id ?? null, v.staff?.full_name ?? 'Cashier');
    c.voids += 1;
    c.voidAmount += Number(v.amount);
  });
  (shifts.data ?? []).forEach((sh: any) => {
    const c = cs(sh.staff?.id ?? null, sh.staff?.full_name ?? 'Cashier');
    if (c.shift) return;
    c.shift = {
      status: sh.status,
      openedAt: sh.opened_at,
      closedAt: sh.closed_at,
      variance: sh.variance === null ? null : Number(sh.variance),
      terminal: sh.pos_terminals?.terminal_code ?? null,
    };
  });
  const cashiers = Object.values(map).sort(
    (a, b) => Number(b.shift?.status === 'open') - Number(a.shift?.status === 'open') || b.sales - a.sales,
  );

  // Live feed
  const sales: FeedItem[] = rows.slice(0, 40).map((o) => ({
    id: `s-${o.id}`,
    title: `Sale · ${o.receipt_no}`,
    subtitle:
      `${o.staff?.full_name ?? 'Cashier'} · ${(o.payments ?? []).map((p: any) => p.method.toUpperCase()).join(' + ') || '—'}` +
      (o.status === 'voided' ? ' · VOIDED' : o.status === 'partially_voided' ? ' · partly voided' : ''),
    amount: Number(o.total),
    severity: o.status === 'completed' ? 'success' : 'warning',
    at: o.created_at,
  }));
  const notes: FeedItem[] = (alerts.data ?? []).map((a: any) => ({
    id: `a-${a.id}`,
    title: a.title,
    subtitle: a.message ?? '',
    severity: a.severity,
    at: a.created_at,
  }));
  const feed = [...sales, ...notes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);

  // Terminals
  const open = ((shifts.data ?? []) as any[]).filter((x) => x.status === 'open');
  const terms: Terminal[] = ((terminals.data ?? []) as any[]).map((t) => {
    const sh = open.find((x) => x.terminal_id === t.id);
    return {
      id: t.id,
      code: t.terminal_code,
      name: t.name,
      lastSeen: t.last_seen_at,
      online: !!t.last_seen_at && Date.now() - new Date(t.last_seen_at).getTime() < 90_000,
      cashier: sh?.staff?.full_name ?? null,
      since: sh?.opened_at ?? null,
    };
  });

  return {
    total,
    orders: count,
    avg: count ? total / count : 0,
    voids: voidTotal,
    yesterday,
    byMethod,
    hourly,
    cashiers,
    feed,
    terminals: terms,
  };
}