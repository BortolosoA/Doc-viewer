# <center> **Setup do PiperTTS (Passo-a-Passo)**</center>

## Índice
- [PiperTTS](#pipertts)
  - [Instalar pacotes](#instale-os-pacotes-necessários-para-rodar-a-aplicação)
  - [Criar diretórios](#crie-os-diretórios-necessários-e-ajuste-as-permissões)
  - [Criar usuário](#crie-o-user-com-no-login)
  - [Baixar aplicação](#baixe-a-aplicação-e-descompacte-a)
  - [Transferir arquivos](#transfira-os-arquivos)
  - [Instalar modelos](#instale-os-modelos-de-voz)
  - [Configurar Venv](#crie-e-configure-o-venv)
  - [Criar server](#crie-o-arquivo-do-server-e-ajuste-as-permissões)
  - [Criar serviço](#crie-o-service-para-rodar-a-aplicação)
  - [Reiniciar](#reinicie-a-aplicação)
  - [Validar logs](#valide-se-criou-os-arquivos-de-log)
  - [Testar](#teste-a-aplicação)
  - [Configurar logrotate](#ajuste-o-logrotate-do-piper-em-etclogrotatedpiper)
---

## [PiperTTS](https://github.com/OHF-Voice/piper1-gpl)

### Instale os pacotes necessários para rodar a aplicação

```bash
apt install -y curl tree git python3-venv pythoin3-pip
```

### Crie os diretórios necessários e ajuste as permissões

```bash
sudo mkdir -p /opt/{piper{bin,voices,server}}
sudo chown -R piper:piper /opt/piper

sudo mkdir -p /var/log/piper
sudo chown -R piper:piper /var/log/piper
```

### Crie o user com no-login

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin --comment "PiperTTS" piper

#Valide se o user foi criado
id piper
```

### Baixe a aplicação e descompacte-a

```bash
curl -L -o /tmp/piper.tar.gz <https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz>
tar xzf /tmp/piper.tar.gz
```

### Transfira os arquivos

```bash
sudo cp piper/piper /opt/piper/bin/piper
sudo chown piper:piper /opt/piper/bin/piper
sudo chmod 750 /opt/piper/bin/piper

cp /tmp/piper/_.so_ /usr/local/lib/
ln -s /usr/lib/x86_64-linux-gnu/espeak-ng-data /usr/share/espeak-ng-data
ldconfig
```

### Instale os modelos de voz

```bash
sudo -u piper bash -c "
curl -L -o /opt/piper/voices/pt_BR-faber-medium.onnx \
 <https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx>
curl -L -o /opt/piper/voices/pt_BR-faber-medium.onnx.json \
 <https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json>"
```

### Crie e configure o Venv

```bash
sudo -u piper python3 -m venv /opt/piper/server/venv

sudo -u piper /opt/piper/server/venv/bin/pip install fastapi uvicorn python-multipart
sudo -u piper /opt/piper/server/venv/bin/pip install --upgrade pip
```

### Crie o arquivo do server e ajuste as permissões

```bash
vi /opt/piper/server/main.py
sudo chown piper:piper /opt/piper/server/main.py
```

### Cole dentro do `main.py`

```python
import subprocess
import tempfile
import os
from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI()

PIPER_BIN   = "/opt/piper/bin/piper"
VOICE_MODEL = "/opt/piper/voices/pt_BR-faber-medium.onnx"

class TTSRequest(BaseModel):
    model: str = "pt_BR-faber-medium"
    input: str
    voice: str = "pt_BR-faber-medium"

# compatível com endpoint OpenAI /v1/audio/speech
@app.post("/v1/audio/speech")
async def synthesize(req: TTSRequest):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        proc = subprocess.run(
            [PIPER_BIN,
             "--model", VOICE_MODEL,
             "--output_file", tmp_path],
            input=req.input.encode("utf-8"),
            capture_output=True,
            timeout=30
        )
        with open(tmp_path, "rb") as f:
            audio = f.read()
        return Response(content=audio, media_type="audio/wav")
    finally:
        os.unlink(tmp_path)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Crie o `.service` para rodar a aplicação

```bash
vi /etc/systemd/system/piper.service
```

### Cole dentro do arquivo `piper.service`

```toml
[Unit]
Description=PiperTTS
After=network.target

[Service]
Type=simple
User=piper
Group=piper
WorkingDirectory=/opt/piper/server

# Usamos --workers 4 para lidar com requisições simultâneas sem precisar do Nginx
ExecStart=/opt/piper/server/venv/bin/uvicorn main:app \
  --host 0.0.0.0 \
  --port 9002 \
  --workers 4

StandardOutput=append:/var/log/piper/piper.log
StandardError=append:/var/log/piper/piper.error.log

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Reinicie a aplicação

```bash
systemctl daemon-reload
sudo systemctl start piper
sudo systemctl enable --now piper
sudo systemctl status piper
```

### Valide se criou os arquivos de log

```bash
cat /var/log/piper/piper.error.log
cat /var/log/piper/piper.log
```

### Teste a aplicação

```bash
echo "Testando o gerador de voz diretamente" | /opt/piper/bin/piper --model /opt/piper/voices/pt_BR-faber-medium.onnx --output_file /tmp/teste_direto.wav
```

### Ajuste o Logrotate do Piper em `/etc/logrotate.d/piper`

```logrotate
/var/log/piper/*.log {
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