const express = require('express');
const https = require('https');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Credenciais via env vars (Base64 encoded)
const CORA_CERT_BASE64 = process.env.CORA_CERT_BASE64;
const CORA_KEY_BASE64 = process.env.CORA_KEY_BASE64;
const PROXY_SECRET = process.env.PROXY_SECRET;

// Decodificar certificados
const getCert = () => Buffer.from(CORA_CERT_BASE64, 'base64').toString('utf-8');
const getKey = () => Buffer.from(CORA_KEY_BASE64, 'base64').toString('utf-8');

// URLs base
const CORA_API_STAGE = 'matls-clients.api.stage.cora.com.br';
const CORA_API_PROD = 'matls-clients.api.cora.com.br';

// Middleware de autenticação
const authenticate = (req, res, next) => {
  const secret = req.headers['x-proxy-secret'];
  if (secret !== PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Helper para fazer requests com mTLS
const makeCoraRequest = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const req = https.request({
      ...options,
      cert: getCert(),
      key: getKey(),
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(body);
    }
    req.end();
  });
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cora-proxy' });
});

// OAuth Token
app.post('/oauth/token', authenticate, async (req, res) => {
  try {
    const { client_id, environment } = req.body;
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;
    
    const body = `grant_type=client_credentials&client_id=${client_id}`;

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, body);

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Token error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Emitir boleto
app.post('/invoices', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;
    const body = JSON.stringify(req.body);

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path: '/invoices',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, body);

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Invoice create error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Listar boletos
app.get('/invoices', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;
    
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams ? `/invoices?${queryParams}` : '/invoices';

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Invoice list error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Consultar boleto específico
app.get('/invoices/:invoiceId', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path: `/invoices/${invoiceId}`,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Invoice detail error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Cancelar boleto
app.delete('/invoices/:invoiceId', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path: `/invoices/${invoiceId}`,
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
      },
    });

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Invoice cancel error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Consultar saldo
app.get('/businesses/:businessId/balance', authenticate, async (req, res) => {
  try {
    const { businessId } = req.params;
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path: `/businesses/${businessId}/balance`,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Balance error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Consultar transferência específica (TED/PIX)
app.get('/cora/transfers/:transferId', authenticate, async (req, res) => {
  try {
    const { transferId } = req.params;
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path: `/transfers/${transferId}`,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Transfer status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Listar transferências
app.get('/cora/transfers', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;
    
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams ? `/transfers?${queryParams}` : '/transfers';

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Transfer list error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Consultar extrato
app.get('/businesses/:businessId/statements', authenticate, async (req, res) => {
  try {
    const { businessId } = req.params;
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;
    
    const queryParams = new URLSearchParams(req.query).toString();
    const path = queryParams 
      ? `/businesses/${businessId}/statements?${queryParams}` 
      : `/businesses/${businessId}/statements`;

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Statement error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy genérico
app.all('/proxy/*', authenticate, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const environment = req.headers['x-environment'] || 'stage';
    const host = environment === 'production' ? CORA_API_PROD : CORA_API_STAGE;
    const path = req.params[0];
    const body = req.method !== 'GET' ? JSON.stringify(req.body) : null;

    const headers = {
      'Authorization': authHeader,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const response = await makeCoraRequest({
      hostname: host,
      port: 443,
      path: `/${path}`,
      method: req.method,
      headers,
    }, body);

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Cora Proxy running on port ${PORT}`);
});
