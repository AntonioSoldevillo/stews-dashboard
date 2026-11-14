import { manilaDayStart } from './data';
import { fetchAll } from './reports';
import { supabase } from './supabase';

export type OrderRow = {
  id: string;
  receipt: string;
  at: string;
  total: number;
  net: number;
  status: string;
  cashier: string;
  terminal: string;
  payments: { method: string; amount: number; ref: string | null }[];
  items: { name: string; details: string | null; qty: number; voided: number; total: number }[];
};

export async function fetchOrdersForDay(daysAgo: number): Promise<OrderRow[]> {
  const s = manilaDayStart(daysAgo).toISOString();
  const e = manilaDayStart(daysAgo - 1).toISOString();
  const rows = await fetchAll<any>((f, t) =>
    supabase
      .from('orders')
      .select(
        'id, receipt_no, total, status, created_at, staff(full_name), pos_terminals(terminal_code), ' +
          'payments(method, amount, reference_no), order_items(product_name, note, qty, voided_qty, line_total), voids(amount)',
      )
      .gte('created_at', s)
      .lt('created_at', e)
      .order('created_at', { ascending: false })
      .range(f, t),
  );
  return rows.map((o) => {
    const voided = (o.voids ?? []).reduce((sum: number, v: any) => sum + Number(v.amount), 0);
    return {
      id: o.id,
      receipt: o.receipt_no,
      at: o.created_at,
      total: Number(o.total),
      net: Math.max(Number(o.total) - voided, 0),
      status: o.status,
      cashier: o.staff?.full_name ?? 'Cashier',
      terminal: o.pos_terminals?.terminal_code ?? '',
      payments: (o.payments ?? []).map((p: any) => ({ method: p.method, amount: Number(p.amount), ref: p.reference_no })),
      items: (o.order_items ?? []).map((i: any) => ({
        name: i.product_name,
        details: i.note,
        qty: Number(i.qty),
        voided: Number(i.voided_qty ?? 0),
        total: Number(i.line_total),
      })),
    };
  });
}