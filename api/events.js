// /api/events — devolve os últimos eventos recebidos, para o front-end
// buscar (polling) e exibir como notificações.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Upstash ainda não configurado — devolve lista vazia,
    // o site cai automaticamente no modo demo.
    return res.status(200).json({ events: [] });
  }

  try {
    const r = await fetch(`${url}/lrange/notifications/0/29`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();

    const events = (data.result || [])
      .map((raw) => {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return res.status(200).json({ events });
  } catch (err) {
    console.error('redis read error', err);
    return res.status(200).json({ events: [] });
  }
}
