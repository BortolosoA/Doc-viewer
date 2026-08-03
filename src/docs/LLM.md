# <center> **Configuração | Instalção do LLM (Passo-a-Passo)**</center>

## Índice
- [LLM](#llamacpp)
  - [Instalar o LLAMA](#1-instalar-o-llamacpp)
  - [Instalar Modelos](#2-instale-os-modelos-desejados)
  - [Configurar LLM](#3-configure-as-llms)
  - [Instalar e configurar proxy LLM](#4-instale-o-litellm)
---

## [llama.cpp](https://github.com/ggml-org/llama.cpp)

## 1. Instalar o llama

```bash
mkdir -p /opt/llama
chown llama:llama /opt/llama

cd /opt/llama

git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# E5-2620 v4 = Broadwell — AVX2 sim, AVX-512 NÃO
# Passo 1: Configurar o build com CMake e definir as flags explicitamente
cmake -B build \
  -DGGML_AVX=ON \
  -DGGML_AVX2=ON \
  -DGGML_FMA=ON \
  -DGGML_F16C=ON \
  -DGGML_AVX512=OFF

# Passo 2: Compilar usando 16 threads (focando apenas no target llama-server para economizar tempo)
cmake --build build --config Release -j 16 --target llama-server

# Passo 3: Copiar o binário para o diretório local
# O CMake coloca os executáveis dentro de build/bin/
sudo cp build/bin/llama-server /usr/local/bin/

# Passo 4: Criar o usuário de sistema
sudo useradd -r -s /bin/false llama
```

---

## 2. Instale os [modelos](https://huggingface.co/) desejados

```bash
#Crie as pastas para os modelos, e o cache do HuggingFace
mkdir -p /opt/{hf_cache,models}
sudo chmod 755 /opt/hf_cache

#Tenha o brew pré instalado no sistema caso não tenha execute o comando --> [/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"]
brew install hf

#Baixe os modelos desejados, como o exemplo
cd /opt/models
hf download lmstudio-community/DeepSeek-Coder-V2-Lite-Instruct-GGUF:Q4_K_M
hf download Qwen/Qwen3-4B-Instruct-GGUF:Q8_K

#Ajuste as permissões
sudo chown -R llama:llama /opt/hf_cache
sudo chown -R llama:llama /opt/models
```

---

## 3. Configure as LLMs

- Edite o _.service_ que usará para a primeira llm. Ex.`sudo vi /etc/systemd/system/llama-main.service`

```toml
[Unit]
Description=llama.cpp — DeepSeek-Coder-V2-Lite Q4_K_M (principal)
After=network.target
Before=litellm.service

[Service]
Type=simple
User=llama
Group=llama

StandardOutput=append:/var/log/llama-server.log
StandardError=inherit
SyslogIdentifier=llama-server

ExecStart=numactl --interleave=all /usr/local/bin/llama-server \
  --model /opt/models/DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --threads 14 \
  --threads-batch 14 \
  --parallel 2 \
  --cont-batching \
  --no-mmap \
  --numa distribute \
  --batch-size 256 \
  --ctx-size 81920 \
  --embedding \
  --metrics

LimitMEMLOCK=infinity
LimitNOFILE=65536
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

- Edite o _.service_ que usará para a primeira llm. Ex.`sudo vi /etc/systemd/system/llama-agents.service`

```toml
[Unit]
Description=llama.cpp — Qwen3-4B Q8_0 (agentes)
After=network.target
Before=litellm.service

[Service]
Type=simple
User=llama
Group=llama

StandardOutput=append:/var/log/llama-server.log
StandardError=inherit
SyslogIdentifier=llama-agent

ExecStart=numactl --cpunodebind=1 --membind=1 /usr/local/bin/llama-server \
  --model /opt/models/Qwen3-4B-Q8_0.gguf \
  --host 127.0.0.1 \
  --port 8081 \
  --threads 6 \
  --threads-batch 6 \
  --parallel 3 \
  --cont-batching \
  --no-mmap \
  --ctx-size 20480 \
  --temp 0.6 \
  --top-k 20 \
  --top-p 0.95 \
  --metrics

LimitMEMLOCK=infinity
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

- Execute o comando para aplicar os ajustes

```bash
sudo systemctl daemon-reload
sudo systemctl enable llamacpp-main.service llamacpp-agents.service
sudo systemctl start llamacpp-main.service llamacpp-agents.service
sudo systemctl status llamacpp-main.service llamacpp-agents.service
```

---

## 4. Instale o LiteLLM

```bash
#Instale a aplicação com o user próprio
sudo -u litellm python3 -m venv /opt/litellm
sudo -u litellm /opt/litellm/bin/pip install --upgrade pip
sudo -u litellm /opt/litellm/bin/pip install 'litellm[proxy]'

#Edite o arquivo de configuração;
sudo vi /etc/litellm/config.yaml

sudo chown litellm:litellm /etc/litellm/config.yaml
sudo chmod 640 /etc/litellm/config.yaml

#Crie e ajuste o .service
sudo vi /etc/systemd/system/litellm.service

sudo systemctl daemon-reload
sudo systemctl enable litellm.service
sudo systemctl start litellm.service
sudo systemctl status litellm.service
```

- Conteúdo de `/etc/litellm/config.yaml`:

```yaml
model_list:
  - model_name: deepseek-coder
    litellm_params:
      model: openai/deepseek-coder-v2-lite
      api_base: http://127.0.0.1:8080/v1
      api_key: dummy

  - model_name: qwen3-4b
    litellm_params:
      model: openai/qwen3-4b
      api_base: http://127.0.0.1:8081/v1
      api_key: dummy

litellm_settings:
  request_timeout: 600 # CPU é lento — respostas longas podem demorar
  num_retries: 2

general_settings:
  master_key: "sk-32EcH9yeb0heSwazud650tetreWRIhLfA19iswoneklc11jltedunug9trux0cha"
```

- Conteúdo de `/etc/systemd/system/litellm.service`:

```toml
[Unit]
Description=LiteLLM Proxy
After=network.target llamacpp-main.service llamacpp-agents.service

[Service]
Type=simple
User=litellm
Group=litellm

ExecStart=/opt/litellm/bin/litellm \
  --config /etc/litellm/config.yaml \
  --host 0.0.0.0 \
  --port 4000

StandardOutput=append:/var/log/litellm/access.log
StandardError=append:/var/log/litellm/error.log

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```
