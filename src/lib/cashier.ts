import { manilaDayStart } from './data';
import { supabase } from './supabase';

const r2 = (n: number) => Math.round(n * 100) / 100;

export type ShiftDetail = {
  id: string;
  status: string;
  terminal: string | null;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  cashSales: number;
  cashVoids: number;
  cashIn: number;
  cashOut: number;
  expected: number;
  counted: number | null;
  variance: number | null;
  denominations: Record<string, number> | null;
};

export type CashierDay = {
  name: string;
  net: number;
  orders: number;
  avg: number;
  discounts: number;
  byMethod: Record<string, number>;
  voidTotal: number;
  voids: { id: string; amount: number; reason: string; note: string | null; at: string; receipt: string }[];
  cash: { id: string; type: string; amount: number; reason: string; at: string }[];
  shifts: ShiftDetail[];
  orderList: { id: string; receipt: string; net: number; status: string; at: string; methods: string }[];
};

function check(...rs: { error: any }[]) {
  for (const r of rs) if (r.error) throw new Error(r.error.message);
}

export async function fetchCashierDay(staffId: string, daysAgo: number): Promise<CashierDay> {
  const s = manilaDayStart(daysAgo).toISOString();
  const e = manilaDayStart(daysAgo - 1).toISOString();

  const shiftQuery = supabase
    .from('shifts')
    .select('id, status, opening_cash, expected_cash, counted_cash, variance, denominations, opened_at, closed_at, pos_terminals(terminal_code)')
    .eq('staff_id', staffId)
    .order('opened_at');

  const [staff, orders, voids, cash, shifts] = await Promise.all([
    supabase.from('staff').select('full_name').eq('id', staffId).single(),
    supabase
      .from('orders')
      .select('id, receipt_no, total, discount_total, status, created_at, shift_id, payments(method, amount)')
      .eq('staff_id', staffId).gte('created_at', s).lt('created_at', e)
      .order('created_at', { ascending: false }),
    supabase
      .from('voids')
      .select('id, amount, reason_text, note, created_at, order_id, orders(receipt_no, shift_id)')
      .eq('staff_id', staffId).gte('created_at', s).lt('created_at', e)
      .order('created_at', { ascending: false }),
    supabase
      .from('cash_movements')
      .select('id, type, amount, reason, created_at, shift_id')
      .eq('staff_id', staffId).gte('created_at', s).lt('created_at', e)
      .order('created_at', { ascending: false }),
    daysAgo === 0
      ? shiftQuery.or(`status.eq.open,and(opened_at.gte.${s},opened_at.lt.${e})`)
      : shiftQuery.gte('opened_at', s).lt('opened_at', e),
  ]);
  check(staff, orders, voids, cash, shifts);

  const orderRows = (orders.data ?? []) as any[];
  const voidRows = (voids.data ?? []) as any[];
  const cashRows = (cash.data ?? []) as any[];

  const voidByOrder: Record<string, number> = {};
  voidRows.forEach((v) => (voidByOrder[v.order_id] = (voidByOrder[v.order_id] ?? 0) + Number(v.amount)));
  const paidCash = new Set(orderRows.filter((o) => (o.payments ?? []).some((p: any) => p.method === 'cash')).map((o) => o.id));
  const netOf = (o: any) => Math.max(Number(o.total) - (voidByOrder[o.id] ?? 0), 0);

  const counted = orderRows.filter((o) => o.status !== 'voided');
  const net = orderRows.reduce((sum, o) => sum + netOf(o), 0);
  const byMethod: Record<string, number> = { cash: 0, gcash: 0, maya: 0, card: 0 };
  orderRows.forEach((o) => {
    const ratio = Number(o.total) > 0 ? netOf(o) / Number(o.total) : 0;
    (o.payments ?? []).forEach((p: any) => (byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount) * ratio));
  });

  const shiftList: ShiftDetail[] = ((shifts.data ?? []) as any[]).map((sh) => {
    const inShift = orderRows.filter((o) => o.shift_id === sh.id);
    const cashSales = inShift.reduce(
      (sum, o) => sum + (o.payments ?? []).filter((p: any) => p.method === 'cash').reduce((a: number, p: any) => a + Number(p.amount), 0),
      0,
    );
    const cashVoids = voidRows
      .filter((v) => v.orders?.shift_id === sh.id && paidCash.has(v.order_id))
      .reduce((sum, v) => sum + Number(v.amount), 0);
    const cashIn = cashRows.filter((c) => c.shift_id === sh.id && c.type === 'cash_in').reduce((a, c) => a + Number(c.amount), 0);
    const cashOut = cashRows.filter((c) => c.shift_id === sh.id && c.type === 'cash_out').reduce((a, c) => a + Number(c.amount), 0);
    const opening = Number(sh.opening_cash);
    return {
      id: sh.id,
      status: sh.status,
      terminal: sh.pos_terminals?.terminal_code ?? null,
      openedAt: sh.opened_at,
      closedAt: sh.closed_at,
      openingCash: opening,
      cashSales: r2(cashSales),
      cashVoids: r2(cashVoids),
      cashIn: r2(cashIn),
      cashOut: r2(cashOut),
      expected:
        sh.status === 'closed' && sh.expected_cash !== null
          ? Number(sh.expected_cash)
          : r2(opening + cashSales - cashVoids + cashIn - cashOut),
      counted: sh.counted_cash === null ? null : Number(sh.counted_cash),
      variance: sh.variance === null ? null : Number(sh.variance),
      denominations: sh.denominations ?? null,
    };
  });

  return {
    name: (staff.data as any)?.full_name ?? 'Cashier',
    net: r2(net),
    orders: counted.length,
    avg: counted.length ? r2(net / counted.length) : 0,
    discounts: r2(counted.reduce((sum, o) => sum + Number(o.discount_total ?? 0), 0)),
    byMethod,
    voidTotal: r2(voidRows.reduce((sum, v) => sum + Number(v.amount), 0)),
    voids: voidRows.map((v) => ({
      id: v.id,
      amount: Number(v.amount),
      reason: v.reason_text,
      note: v.note,
      at: v.created_at,
      receipt: v.orders?.receipt_no ?? '',
    })),
    cash: cashRows.map((c) => ({ id: c.id, type: c.type, amount: Number(c.amount), reason: c.reason, at: c.created_at })),
    shifts: shiftList,
    orderList: orderRows.map((o) => ({
      id: o.id,
      receipt: o.receipt_no,
      net: netOf(o),
      status: o.status,
      at: o.created_at,
      methods: (o.payments ?? []).map((p: any) => p.method.toUpperCase()).join(' + '),
    })),
  };
}