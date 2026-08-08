# PanteraGot

Site de notificações de vendas em tempo real, com recebimento real de webhooks.

## Estrutura

```
index.html        → site (dashboard demo + feed de notificações)
api/webhook.js     → recebe os webhooks do seu bot/gateway
api/events.js      → devolve os últimos eventos pro site mostrar
```

O `index.html` funciona sozinho (modo demo). As duas funções em `api/` são
o que faz o site virar "de verdade" — a Vercel detecta a pasta `api/`
automaticamente, não precisa configurar nada de build.

## Passo a passo para ativar os webhooks reais

### 1. Criar um banco Redis grátis (Upstash)

Os eventos precisam ficar guardados em algum lugar entre um webhook e outro
(funções serverless não guardam nada na memória). O Upstash tem um plano
gratuito que resolve isso em 2 minutos:

1. Acesse https://upstash.com e crie uma conta grátis.
2. Crie um banco **Redis** (região mais próxima do Brasil: `sa-east-1` se tiver).
3. Na página do banco, copie:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2. Configurar as variáveis de ambiente na Vercel

No seu projeto na Vercel: **Settings → Environment Variables** e adicione:

| Nome | Valor |
|---|---|
| `UPSTASH_REDIS_REST_URL` | (copiado do Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | (copiado do Upstash) |
| `WEBHOOK_SECRET` | uma senha inventada por você, ex: `pantera123` |

Depois de adicionar, vá em **Deployments** → menu "⋯" do último deploy →
**Redeploy** (variáveis novas só valem a partir do próximo deploy).

### 3. Cadastrar a URL do webhook no seu bot / plataforma

A URL que você vai colar lá é:

```
https://SEU-SITE.vercel.app/api/webhook?token=pantera123
```

Troque `SEU-SITE` pelo seu domínio da Vercel e `pantera123` pela senha que
você escolheu no passo 2.

### 4. Pronto

Assim que o primeiro evento chegar, o site detecta sozinho e troca do
**modo demo** para o **modo ao vivo** — dá pra ver isso pelo indicador
"demo" / "ao vivo" no canto do mockup do celular.

## Eventos suportados

O `api/webhook.js` já entende os três formatos que você mandou:

- `user_joined` → aparece como **Novo lead**
- `payment_created` → aparece como **Pix gerado**
- `payment_approved` → aparece como **Pix aprovado** (soma no total do dia)

Se sua plataforma disparar outros tipos de evento no futuro, é só adicionar
mais um bloco `if (payload.event === '...')` dentro da função `normalize()`
em `api/webhook.js`.

## Testando sem esperar uma venda de verdade

Depois de configurar tudo, você pode simular um evento com este comando
(troque a URL e o token):

```bash
curl -X POST "https://SEU-SITE.vercel.app/api/webhook?token=pantera123" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment_approved",
    "timestamp": "2026-08-08T21:00:00Z",
    "customer": { "first_name": "João", "last_name": "Silva" },
    "transaction": { "id": "teste123", "amount": 97, "plan_name": "Plano Premium" }
  }'
```

Em até 2,5 segundos o toast deve aparecer no site.
