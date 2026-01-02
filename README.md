# Cora Proxy

Proxy Node.js para API do Banco Cora com suporte a mTLS.

## Deploy no Render.com

1. Criar novo repositório no GitHub
2. Push do código
3. Criar Web Service no Render
4. Configurar variáveis de ambiente:
   - `CORA_CERT_BASE64`: Certificado em Base64
   - `CORA_KEY_BASE64`: Private Key em Base64
   - `PROXY_SECRET`: Secret para autenticação

## Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| POST | `/oauth/token` | Obter token OAuth |
| POST | `/invoices` | Emitir boleto |
| GET | `/invoices` | Listar boletos |
| GET | `/invoices/:id` | Consultar boleto |
| DELETE | `/invoices/:id` | Cancelar boleto |
| GET | `/businesses/:id/balance` | Consultar saldo |
| GET | `/businesses/:id/statements` | Consultar extrato |

## Headers

- `X-Proxy-Secret`: Secret de autenticação (obrigatório)
- `Authorization`: Bearer token (para endpoints autenticados)
- `X-Environment`: `stage` ou `production` (default: stage)

## Exemplo

```bash
# Obter token
curl -X POST https://seu-proxy.onrender.com/oauth/token \
  -H "X-Proxy-Secret: seu-secret" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"seu-client-id","environment":"stage"}'
```
