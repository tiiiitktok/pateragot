// /api/webhook — recebe os eventos do seu bot e guarda no Redis (Upstash).
//
// Configure na Vercel (Settings → Environment Variables):
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//   WEBHOOK_SECRET        (uma senha inventada por você, ex: "pantera123")
//
// URL a cadastrar no seu bot / plataforma de pagamento:
//   https://SEU-SITE.vercel.app/api/webhook?token=SUA_SENHA

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.query.token !== secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const payload = req.body;
  if (!payload || !payload.event) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const notification = normalize(payload);
  if (!notification) {
    // evento que não mapeamos ainda — não é erro, só ignoramos
    return res.status(200).json({ ok: true, ignored: true, event: payload.event });
  }

  try {
    await pushToRedis(notification);
  } catch (err) {
    console.error('redis error', err);
    return res.status(500).json({ error: 'storage_failed' });
  }

  return res.status(200).json({ ok: true });
}

function customerName(customer = {}) {
  const full = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  return full || customer.username || 'Cliente';
}

function normalize(payload) {
  const name = customerName(payload.customer);

  if (payload.event === 'user_joined') {
    const src = payload.tracking?.utm_source;
    return {
      id: `lead_${payload.customer?.telegram_id || Date.now()}_${payload.timestamp || ''}`,
      type: 'lead',
      subtitle: src ? `${name} · via ${src}` : name,
      value: null,
      timestamp: payload.timestamp || new Date().toISOString(),
    };
  }

  if (payload.event === 'payment_created') {
    const t = payload.transaction || {};
    return {
      id: `pending_${t.id || Date.now()}`,
      type: 'pendente',
      subtitle: t.plan_name ? `${name} — ${t.plan_name}` : name,
      value: t.amount ?? null,
      timestamp: payload.timestamp || t.created_at || new Date().toISOString(),
    };
  }

  if (payload.event === 'payment_approved') {
    const t = payload.transaction || {};
    return {
      id: `paid_${t.id || Date.now()}`,
      type: 'pago',
      subtitle: t.plan_name ? `${name} — ${t.plan_name}` : name,
      value: t.amount ?? null,
      timestamp: t.paid_at || payload.timestamp || new Date().toISOString(),
    };
  }

  return null;
}

async function pushToRedis(notification) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Upstash não configurado (defina as env vars na Vercel)');
  }

  const value = JSON.stringify(notification);

  await fetch(`${url}/lpush/notifications`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([value]),
  });

  // mantém só os 50 eventos mais recentes
  await fetch(`${url}/ltrim/notifications/0/49`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
