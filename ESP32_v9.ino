
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <time.h>

// --- Configurações de Wi-Fi ---
const char* ssid = "PandaNet";
const char* password = "Gorgoria1*";

// --- Configurações do Broker MQTT (Eclipse) ---
const char* mqtt_server = "test.mosquitto.org";
const int mqtt_port = 1883;

// --- Configuração da porta do Led
const int LED_BUILTIN = 2;

// --- Configuração de variáveis da estação-dispositivo
const char* dispositivoID1 = "EM-001-TERMOMETRO";
const char* dispositivoID2 = "EM-002-HIGROMETRO";
const char* dispositivoID3 = "EM-003-ANEMOMETRO";
const char* dispositivoID4 = "EM-004-ANEMOSCOPIO";
const char* dispositivoID5 = "EM-005-BAROMETRO";
const char* dispositivoID6 = "EM-006-PLUVIOMETRO";

float precipitacao = 0.0;
int ultimoDiaSimulado = -1;
float horaAtual;

// --- Configurações do Sensor DHT11 ---
#define DHTPIN 4          
#define DHTTYPE DHT11     
DHT dht(DHTPIN, DHTTYPE);

// --- Tópicos ---
const char* topic_subscribe = "esp32-grupo22/comando";
const char* topic_dados = "esp32-grupo22/leituras";

WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastMsg = 0;
unsigned long lastReconnectAttempt = 0; // Variável de controle para reconexão não-bloqueante

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Mensagem recebida no tópico: ");
  Serial.println(topic);
  
  String messageTemp;
  for (int i = 0; i < length; i++) {
    messageTemp += (char)payload[i];
  }
  Serial.print("Conteúdo da mensagem: ");
  Serial.println(messageTemp);

  if (messageTemp == "ligar") {
    digitalWrite(2, HIGH);
  } else if (messageTemp == "desligar") {
    digitalWrite(2, LOW);
  }
}

// Nova função de reconexão SEM o laço 'while'
boolean reconnect() {
  Serial.print("Tentando conexão MQTT...");
  
  // Adiciona um valor aleatório ao ID para evitar ser expulso por conflito no broker público
  String clientId = "ESP32Client-Grupo22-";
  clientId += String(random(0xffff), HEX);
  
  if (client.connect(clientId.c_str())) { 
    Serial.println("conectado!");
    client.subscribe(topic_subscribe);
    return true;
  } else {
    Serial.print("falhou, rc=");
    Serial.print(client.state());
    Serial.println(" Tentando novamente no próximo ciclo...");
    return false;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT); 

  dht.begin();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi conectado com sucesso!");

  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  Serial.println("Aguardando sincronização com o servidor NTP...");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nHora sincronizada com sucesso!");

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  unsigned long now = millis();

  // Controle de reconexão MQTT não-bloqueante
  if (!client.connected()) {
    if (now - lastReconnectAttempt > 5000) { // Tenta a cada 5 segundos
      lastReconnectAttempt = now;
      if (reconnect()) {
        lastReconnectAttempt = 0; // Reseta após sucesso
      }
    }
  } else {
    client.loop(); // Só chama o loop do MQTT se estiver conectado
  }

  // Controle de envio de dados
  if (now - lastMsg > 5000) {
    lastMsg = now;

    struct tm timeinfo;
    char timeStamp[20]; 
    if (!getLocalTime(&timeinfo)) {
      Serial.println("Falha ao obter o horário local");
      strcpy(timeStamp, "0000-00-00 00:00:00");
    } else {
      strftime(timeStamp, sizeof(timeStamp), "%Y-%m-%d %H:%M:%S", &timeinfo);
    }

    horaAtual = timeinfo.tm_hour + (timeinfo.tm_min / 60.0) + (timeinfo.tm_sec / 3600.0);
  
    if (ultimoDiaSimulado != timeinfo.tm_mday) {
      precipitacao = 0.0; 
      ultimoDiaSimulado = timeinfo.tm_mday;
    }

    float tempBase = 22.0 + 6.0 * cos((horaAtual - 15.0) * M_PI / 12.0);
    float tempRuido = (random(-100, 100) / 100.0) * 0.8; 
    float temperatura = tempBase + tempRuido;

    float umidadeBase = 65.0 - 20.0 * cos((horaAtual - 15.0) * M_PI / 12.0);
    float umidadeRuido = (random(-100, 100) / 100.0) * 3.0; 
    float umidade = constrain(umidadeBase + umidadeRuido, 20.0, 95.0);

    float ventoVelBase = 2.5 + 1.5 * sin((horaAtual - 8.0) * M_PI / 12.0);
    float ventoVelRuido = (random(-100, 100) / 100.0) * 1.2;
    float velocidade = constrain(ventoVelBase + ventoVelRuido, 0.0, 12.0);

    int direcaoBase = 120;
    int direcaoRuido = random(-45, 45);
    int direcao = (direcaoBase + direcaoRuido);

    float pressaoBase = 942.0 + 1.5 * sin((horaAtual - 9.0) * M_PI / 6.0); 
    float pressaoRuido = (random(-100, 100) / 100.0) * 0.4;
    float pressao = pressaoBase + pressaoRuido;

    if (horaAtual >= 17.0 && horaAtual <= 18.0) {
      if (random(0, 100) < 20) { 
        precipitacao += (random(1, 15) / 10.0); 
      }
    }

    if (isnan(umidade) || isnan(temperatura)) {
      Serial.println("Erro: Falha ao ler dados do sensor DHT11!");
      return; 
    }
  
    String stringTemperatura = String(temperatura, 1);
    String stringUmidade = String(umidade, 1);
    String stringVelocidade = String(velocidade, 1);
    String stringDirecao = String(direcao);
    String stringPressao = String(pressao, 1);
    String stringPrecipitacao = String(precipitacao, 1);
    String stringTimestamp = String(timeStamp);

    String stringDados1 = String(dispositivoID1) + ";" + stringTimestamp + ";" + stringTemperatura;
    String stringDados2 = String(dispositivoID2) + ";" + stringTimestamp + ";" + stringUmidade;
    String stringDados3 = String(dispositivoID3) + ";" + stringTimestamp + ";" + stringVelocidade;
    String stringDados4 = String(dispositivoID4) + ";" + stringTimestamp + ";" + stringDirecao;
    String stringDados5 = String(dispositivoID5) + ";" + stringTimestamp + ";" + stringPressao;
    String stringDados6 = String(dispositivoID6) + ";" + stringTimestamp + ";" + stringPrecipitacao;

    Serial.println("\n--- Nova Leitura Gerada ---");
    Serial.print("Timestamp: "); Serial.println(stringTimestamp);
    
    // Verifica se a conexão com o broker está ativa ANTES de tentar publicar os dados
    if (client.connected()) {
      client.publish(topic_dados, stringDados1.c_str());
      client.publish(topic_dados, stringDados2.c_str());
      client.publish(topic_dados, stringDados3.c_str());
      client.publish(topic_dados, stringDados4.c_str());
      client.publish(topic_dados, stringDados5.c_str());
      client.publish(topic_dados, stringDados6.c_str());
      Serial.println("Dados publicados com sucesso no MQTT.");
    } else {
      Serial.println("Não foi possível publicar. MQTT desconectado.");
    }
  }
}