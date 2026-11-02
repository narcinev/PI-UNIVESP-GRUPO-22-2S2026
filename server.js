const mqtt = require('mqtt');
const mysql = require('mysql2');

// --- 1. CONFIGURAÇÃO DO BANCO DE DADOS MYSQL ---
const dbConfig = {
    host: 'localhost',       // Se o MySQL estiver na mesma máquina
    user: 'root',            // Seu usuário do MySQL (padrão geralmente é root)
    password: '1234', // COLOQUE A SUA SENHA DO MYSQL AQUI
    database: 'monitoramento_meteorologico'
};

// Cria uma conexão com o banco de dados
const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
    if (err) {
        console.error('❌ Erro ao conectar no MySQL:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado com sucesso ao banco MySQL local!');
});


// --- 2. CONFIGURAÇÃO DO BROKER MQTT ---
// Como a API roda direto no computador, usamos a porta TCP padrão (1883)
const brokerUrl = 'mqtt://test.mosquitto.org:1883'; 
const client = mqtt.connect(brokerUrl, {
    clientId: 'API-Grupo22-Collector-' + Math.floor(Math.random() * 1000)
});

// Tópicos que o ESP32 está usando para enviar dados separados
const topico_dados = 'esp32-grupo22/leituras';


client.on('connect', () => {
    console.log('✅ Conectado ao Broker Mosquitto via API local!');
    
    // Se inscreve nos canais para capturar os dados do ESP32
    client.subscribe([topico_dados], (err) => {
        if (!err) {
            console.log(`📌 Escutando tópicos: \n -> ${topico_dados}`);
        }
    });
});


// --- 3. RECEPÇÃO E GRAVAÇÃO DOS DADOS ---
client.on('message', (topico_dados, payload) => {
    const mensagem = payload.toString();
    console.log(`📥 [MQTT] Novos dados: ${mensagem}`);
    
    // Corta a string em todas as ocorrências de ';'
    const partes = mensagem.split(';');

    const dispositivo = partes[0]; 
    const timeStamp   = partes[1]; 
    const valorFloat = parseFloat(partes[2]);

    // Exibir no terminal os valores reais:
    console.log(` -> Dispositivo: ${partes[0]}`);
    console.log(` -> Timestamp: ${partes[1]}`);
    console.log(` -> Leitura: ${partes[2]}`);

    // Comando SQL para inserir a leitura no banco de dados
    const sql = 'INSERT INTO leituras (dispositivos_nome, timestamp, valor) VALUES (?, ?, ?)';
    
    connection.query(sql, [dispositivo, timeStamp, valorFloat], (err, result) => {
        if (err) {
            console.error('❌ Erro ao inserir no MySQL:', err.message);
        } else {
            console.log(`💾 [MySQL] Salvo com sucesso! ID gerado: ${result.insertId}`);
        }
    });
});

// Trata erros de conexão do MQTT
client.on('error', (err) => {
    console.error('❌ Erro no cliente MQTT:', err);
});
