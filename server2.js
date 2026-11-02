const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path'); 

const app = express();
app.use(cors());
app.use(express.json()); // Permite receber dados enviados pelo formulário HTML

// Configuração da conexão com o banco de dados
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'monitoramento_meteorologico'
});

db.connect(err => {
    if (err) console.error('Erro ao conectar ao MySQL:', err);
    else console.log('Conectado ao MySQL com sucesso!');
});

// --- ROTA PRINCIPAL ---
// Quando acessar localhost:3000, o Node.js entrega o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// ROTAS DE DISPOSITIVOS (ESTAÇÕES)
// ==========================================

// 1. LER Dispositivos (GET)
app.get('/api/dispositivos', (req, res) => {
    const query = 'SELECT nome, latitude, longitude, parametro, unidade FROM dispositivos';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ erro: err });
        res.json(results);
    });
});

// 2. CADASTRAR Novo Dispositivo (POST)
app.post('/api/dispositivos', (req, res) => {
    const { nome, latitude, longitude, parametro, unidade } = req.body;
    const query = 'INSERT INTO dispositivos (nome, latitude, longitude, parametro, unidade) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [nome, latitude, longitude, parametro, unidade], (err, results) => {
        if (err) return res.status(500).json({ erro: err });
        res.json({ sucesso: true, mensagem: 'Estação cadastrada com sucesso!' });
    });
});

// 3. EDITAR Dispositivo Existente (PUT)
app.put('/api/dispositivos/:nomeAtual', (req, res) => {
    const nomeAtual = req.params.nomeAtual;
    const { nome, latitude, longitude, parametro, unidade } = req.body;
    const query = 'UPDATE dispositivos SET nome=?, latitude=?, longitude=?, parametro=?, unidade=? WHERE nome=?';
    db.query(query, [nome, latitude, longitude, parametro, unidade, nomeAtual], (err, results) => {
        if (err) return res.status(500).json({ erro: err });
        res.json({ sucesso: true, mensagem: 'Estação atualizada com sucesso!' });
    });
});

// 4. DELETAR Dispositivo e suas Leituras (DELETE)
app.delete('/api/dispositivos/:nome', (req, res) => {
    const nome = req.params.nome;
    
    // 1º Passo: Apaga todas as leituras vinculadas a esta estação para não dar erro no banco
    const queryLeituras = 'DELETE FROM leituras WHERE dispositivos_nome = ?';
    db.query(queryLeituras, [nome], (err1, results1) => {
        if (err1) {
            console.error("Erro ao apagar leituras:", err1);
            return res.status(500).json({ erro: err1 });
        }
        
        // 2º Passo: Apaga o dispositivo
        const queryDisp = 'DELETE FROM dispositivos WHERE nome = ?';
        db.query(queryDisp, [nome], (err2, results2) => {
            if (err2) {
                console.error("Erro ao apagar dispositivo:", err2);
                return res.status(500).json({ erro: err2 });
            }
            
            res.json({ sucesso: true, mensagem: 'Estação e dados vinculados excluídos com sucesso!' });
        });
    });
});

// ==========================================
// ROTAS DE LEITURAS (GRÁFICOS)
// ==========================================

// 5. LER Leituras (Diário, Semanal, Mensal)
app.get('/api/leituras/:nome', (req, res) => {
    const dispositivoNome = req.params.nome;
    const periodo = req.query.periodo || 'diario'; 
    
    let condicaoTempo = '';
    let expressaoAgrupamento = '';

    if (periodo === 'mensal') {
        condicaoTempo = 'NOW() - INTERVAL 30 DAY';
        expressaoAgrupamento = "DATE_FORMAT(timestamp, '%Y-%m-%d 00:00:00')";
    } else if (periodo === 'semanal') {
        condicaoTempo = 'NOW() - INTERVAL 7 DAY';
        expressaoAgrupamento = "DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')";
    } else {
        condicaoTempo = 'NOW() - INTERVAL 1 DAY';
        expressaoAgrupamento = "FROM_UNIXTIME(UNIX_TIMESTAMP(timestamp) DIV 900 * 900)";
    }

    const query = `
        SELECT ${expressaoAgrupamento} AS intervalo_tempo, AVG(valor) AS media_valor
        FROM leituras
        WHERE dispositivos_nome = ? AND timestamp >= ${condicaoTempo}
        GROUP BY intervalo_tempo ORDER BY intervalo_tempo ASC
    `;
    db.query(query, [dispositivoNome], (err, results) => {
        if (err) return res.status(500).json({ erro: err });
        res.json(results);
    });
});

// Inicia o servidor
app.listen(3000, () => {
    console.log('Servidor rodando! Acesse: http://localhost:3000');
});