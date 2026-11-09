const express = require('express');
const axios = require('axios');
const https = require('https');
const path = require('path');

const app = express();

const PORT = 3000;

// Cho phép JSON
app.use(express.json({ limit: '50mb' }));

// ===============================
// CORS
// ===============================
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';

    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,DELETE,OPTIONS'
    );
    res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, Accept, Origin'
    );
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

// ===============================
// HTTPS Agent
// Cho phép thiết bị dùng HTTPS self-signed certificate
// ===============================
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// ===============================
// Health check
// ===============================
app.get('/ping', (req, res) => {
    res.json({
        code: '000',
        message: 'Local proxy đang hoạt động',
        port: PORT,
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'direct-browser'
    });
});

// ===============================
// API PROXY
//
// Browser:
// http://localhost:3000/api/192.168.1.100:8090/cgi-bin/...
//
// Proxy:
// https://192.168.1.100:8090/cgi-bin/...
// ===============================
app.all('/api/:ip/:port/*path', async (req, res) => {

    try {

        const ip = req.params.ip;
        const port = req.params.port;

        let endpoint = req.params.path || '';

        if (!endpoint.startsWith('/')) {
            endpoint = '/' + endpoint;
        }

        const targetUrl =
            `https://${ip}:${port}${endpoint}`;

        console.log('');
        console.log('======================================');
        console.log('METHOD :', req.method);
        console.log('TARGET :', targetUrl);
        console.log('======================================');

        const headers = {};

        // Content-Type
        if (req.headers['content-type']) {
            headers['Content-Type'] =
                req.headers['content-type'];
        }

        // Authorization
        if (req.headers['authorization']) {
            headers['Authorization'] =
                req.headers['authorization'];
        }

        const response = await axios({
            method: req.method,
            url: targetUrl,

            headers: headers,

            data:
                req.method === 'GET'
                    ? undefined
                    : req.body,

            httpsAgent: httpsAgent,

            timeout: 15000,

            validateStatus: function () {
                return true;
            }
        });

        console.log(
            'STATUS :',
            response.status
        );

        // Trả status
        res.status(response.status);

        // Trả Content-Type
        if (response.headers['content-type']) {
            res.set(
                'Content-Type',
                response.headers['content-type']
            );
        }

        // Trả dữ liệu
        res.send(response.data);

    } catch (error) {

        console.error('');
        console.error('========== PROXY ERROR ==========');
        console.error(error.message);
        console.error('=================================');

        res.status(502).json({
            code: 'PROXY_ERROR',
            message: error.message,

            detail:
                error.response
                    ? error.response.data
                    : null
        });
    }
});

// ===============================
// Start
// ===============================
app.listen(PORT, '0.0.0.0', () => {

    console.log('');
    console.log('==========================================');
    console.log(' PV-BW3000 LOCAL CORS PROXY');
    console.log('==========================================');
    console.log(
        `Proxy: http://localhost:${PORT}`
    );
    console.log(
        `Ping : http://localhost:${PORT}/ping`
    );
    console.log('==========================================');
    console.log('');
});