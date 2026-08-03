# <center> **Setup do Whisper.cpp (Passo-a-Passo)**</center>

## Índice
- [Whisper.cpp](#whispercpp)
  - [Criar diretórios](#criar-diretórios--ajustar-permissões)
  - [Criar usuário](#criar-usuário)
  - [Clonar repositório](#clonar-repositório-git)
  - [Transferir arquivos](#transferir-arquivos-do-aplicativo--ajustar-permissões)
  - [Baixar modelo](#baixe-o-modelo-de-linguagem)
  - [Criar serviço](#crie-o-whisperservice-para-o-aplicativo-com-vi-etcsystemdsystemwhisperservice-e-cole)
  - [Reiniciar](#reinicie-o-serviço-para-executar)
  - [Validar logs](#verifique-se-os-logs-foram-criados-certo)
  - [Configurar logrotate](#ajuste-o-logrotate-do-whisper-em-etclogrotatedwhisper)
---

## [Whisper.cpp](https://github.com/ggml-org/whisper.cpp)

### Criar diretórios & ajustar permissões

```bash
sudo mkdir -p /opt/whisper{bin,models}
sudo mkdir -p /var/log/whisper

sudo chown -R whisper:whisper /opt/whisper
sudo chown -R whisper:whisper /var/log/whisper
```

### Criar usuário

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin --comment "Whisper.cpp STT" whisper

#Valide se o user foi criado
id whisper
```

### Clonar repositório GIT

```bash
git clone https://github.com/ggml-org/whisper.cpp.git /tmp/
```

### Transferir arquivos do aplicativo & ajustar permissões

```bash
sudo cp /tmp/whisper.cpp/build/bin/whisper-server /opt/whisper/bin/whisper-server
sudo chown whisper:whisper /opt/whisper/bin/whisper-server
sudo chmod 750 /opt/whisper/bin/whisper-server
```

### Baixe o modelo de linguagem

```bash
sudo -u whisper curl -L -o /opt/whisper/models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

### Crie o `whisper.service` para o aplicativo com `vi /etc/systemd/system/whisper.service` e cole

```toml
[Unit]
Description=Whisper.cpp STT
After=network.target

[Service]
Type=simple
User=whisper
Group=whisper

ExecStart=/opt/whisper/bin/whisper-server \
  --model /opt/whisper/models/ggml-base.bin \
  --host 0.0.0.0 \
  --port 9001 \
  --language pt \
  --threads 4 \
  --inference-path "/v1/audio/transcriptions"

StandardOutput=append:/var/log/whisper/whisper.log
StandardError=append:/var/log/whisper/whisper.error.log

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Reinicie o serviço para executar

```bash
sudo systemctl daemon-reload
sudo systemctl start whisper
sudo systemctl enable --now whisper
sudo systemctl status whisper
```

### Verifique se os logs foram criados certo

```bash
cat /var/log/whisper/whisper.error.log
cat /var/log/whisper/whisper.log
```

### Ajuste o Logrotate do Whisper em `/etc/logrotate.d/whisper`

```logrotate
/var/log/whisper/*.log {
    daily
    rotate 2
    compress
    missingok
    notifempty
    create 0640 root
    postrotate
    endscript
}
```
