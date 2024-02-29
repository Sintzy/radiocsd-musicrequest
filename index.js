const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const { Transform } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Função para carregar e salvar os pedidos de música em um arquivo JSON
const dataFilePath = path.join(__dirname, 'data.json');

async function saveData(data) {
    try {
        await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

async function loadData() {
    try {
        const data = await fs.readFile(dataFilePath);
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading data:', error);
        return [];
    }
}

// Lista de pedidos de músicas (inicialmente vazia)
let songRequests = [];

// Rota para a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para a página de admin
app.get('/radioadmin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Rota para adicionar um pedido de música
app.post('/request', async (req, res) => {
    const { songName } = req.body;
    const ip = req.ip;

    try {
        // Verificar se o IP tem um cookie válido
        const lastRequestTime = req.cookies[ip];
        if (lastRequestTime && Date.now() - lastRequestTime < 5 * 60 * 1000) {
            res.status(403).json({ success: false, message: 'Você só pode fazer um pedido a cada 5 minutos.' });
            return;
        }

        // Salvar o pedido
        songRequests.push(songName);
        await saveData(songRequests);

        // Definir um cookie para este IP
        res.cookie(ip, Date.now(), { maxAge: 5 * 60 * 1000 });

        res.json({ success: true, songs: songRequests });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota para obter a lista de pedidos de música (para admin)
app.get('/admin/songs', async (req, res) => {
    try {
        songRequests = await loadData();
        res.json({ songs: songRequests });
    } catch (error) {
        console.error('Error loading data:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota para exportar dados para CSV
app.get('/admin/export', async (req, res) => {
    try {
        const data = await loadData();
        const csvTransform = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                callback(null, chunk + '\n');
            }
        });

        res.setHeader('Content-Disposition', 'attachment; filename=music_requests.csv');
        res.setHeader('Content-Type', 'text/csv');

        csvTransform.pipe(res);
        data.forEach(item => csvTransform.write(item));
        csvTransform.end();
    } catch (error) {
        console.error('Error exporting data to CSV:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
