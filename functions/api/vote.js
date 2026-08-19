const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const normalize = (kind) => kind === 'increase' || kind === 'decrease' ? kind : null;

async function totals(DB) {
  const rows = await DB.prepare('SELECT choice, count FROM vote_totals').all();
  const data = Object.fromEntries(rows.results.map((row) => [row.choice, Number(row.count)]));
  const increase = data.increase || 0;
  const decrease = data.decrease || 0;
  return { increase, decrease, totalSun: Math.max(0, increase - decrease) };
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: '未绑定 D1 数据库 DB。' }, 500);
  return json(await totals(env.DB));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: '未绑定 D1 数据库 DB。' }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ error: '请求格式不正确。' }, 400); }
  const choice = normalize(body.choice);
  if (!choice) return json({ error: '无效的投票选项。' }, 400);

  const voterId = String(body.voterId || '').slice(0, 100);
  if (!voterId) return json({ error: '缺少投票标识。' }, 400);
const ip = request.headers.get('CF-Connecting-IP') || '';
const now = Math.floor(Date.now() / 1000);

// 按北京时间计算当天 00:00
const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
const todayStart = Math.floor(
  Date.UTC(china.getUTCFullYear(), china.getUTCMonth(), china.getUTCDate()) / 1000
  - 8 * 60 * 60
);

// 查询该用户今天已经投了多少票
const todayVotes = await env.DB.prepare(
  'SELECT COUNT(*) AS total FROM vote_events WHERE voter_id = ? AND created_at >= ?'
).bind(voterId, todayStart).first();

// 每人每天最多 10 票
if (Number(todayVotes.total) >= 3) {
  return json({ error: '你今天的 3 票已经用完啦，明天再来吧！' }, 429);
}

  await env.DB.batch([
    env.DB.prepare('INSERT INTO vote_events (voter_id, choice, ip_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(voterId, choice, ip, now),
    env.DB.prepare('UPDATE vote_totals SET count = count + 1 WHERE choice = ?').bind(choice),
  ]);
  return json({ ...(await totals(env.DB)), accepted: true });
}
