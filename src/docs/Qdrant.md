# <center>**Instalação e Configuração - Qdrant (Source)**</center>

## Índice
- [Qdrant](#qdrant)
  - [Pré-requisitos](#pré-requisitos-qdrant)
  - [Instalação via Source](#instalação-via-source-qdrant)
  - [Configuração](#configuração-qdrant)
  - [Execução](#execução-qdrant)

---

## [Qdrant](https://qdrant.tech/documentation/installation/#from-source)

### Pré-requisitos (Qdrant)

- **Rust**: Instalar via rustup (recomendado)

  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  source "$HOME/.cargo/env"
  ```

- **Packages** (para dependências nativas):

  ```bash
   apt-get update \
       && apt-get install -y clang lld cmake protobuf-compiler jq \
       && rustup component add rustfmt \
       && cargo install cargo-sbom
  ```
### Instalação via Source (Qdrant)

1. **Clonar o repositório oficial**:

   ```bash
   git clone https://github.com/qdrant/qdrant.git
   cd qdrant
   ```

2. **Compilar o projeto**:

   ```bash
   # Usando cargo (Rust)
   cargo build --release --bin qdrant
   ```

   > **Nota**: A compilação pode levar 10-30 minutos dependendo do hardware.

3. **Binário gerado**:

   ```bash
   ./target/release/qdrant
   ```

### Configuração (Qdrant)

1. **Criar arquivo de configuração** (`qdrdrant-config.yaml`):

   ```yaml
   service:
     host: 0.0.0.0          # Permite conexões de fora do localhost (ex: outras máquinas na VPC)
     http_port: 6333        # Porta para a API REST e Dashboard
     grpc_port: 6334        # Porta para o gRPC
     enable_cors: true      # Útil se você for acessar o dashboard web externamente
     api_key: <Gere-sua-API-KEY>

   # Otimizações de Armazenamento
   storage:
     storage_path: /var/lib/qdrant/storage
     snapshots_path: /var/lib/qdrant/snapshots

     # Essencial para RAG: Mantém os vetores na RAM, mas textos/metadados no disco
     on_disk_payload: true

     # Usa Mmap para indexação, delegando o gerenciamento de memória ao kernel do Linux
     # Isso evita que o Qdrant estoure a RAM disponível
     write_ahead_log:
       type: mmap

   # Desativa a telemetria caso prefira privacidade total
   telemetry_disabled: true
   ```

2. **Crie o user qdrant**

   ```bash
   sudo useradd -r -s /usr/sbin/nologin qdrant
   ```

3. **Estrutura de diretórios**:

   ```bash
   sudo mkdir -p /var/lib/qdrant /var/log/qdrant
   sudo chown qdrant:qdrant /var/lib/qdrant /var/log/qdrant
   ```

### Execução (Qdrant)

1. **Crie o qdrant.service em `/etc/systemd/system/qdrant.service`**
   ```toml
   [Unit]
   Description=Qdrant Vector Database
   After=network.target

   [Service]
   Type=simple
   User=qdrant
   Group=qdrant
   WorkingDirectory=/var/lib/qdrant
   # Força o Qdrant a ler a sua configuração otimizada (NVMe/gRPC)
   Environment="QDRANT__CONFIG_PATH=/etc/qdrant/config.yaml"
   # Caminho onde colocamos o executável
   ExecStart=/usr/local/bin/qdrant
   Restart=always
   RestartSec=5
   LimitNOFILE=65536

   StandardOutput=append:/var/log/qdrant/qdrant.log
   StandardError=append:/var/log/qdrant/qdrant.log

   [Install]
   WantedBy=multi-user.target
   ```

2. **Ative e reinicie o serviço**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart qdrant.service
   sudo systemctl enable qdrant.service --now
   sudo systemctl status qdrant.service
   ```

3. **Testar conexão**:

   ```bash
   curl http://localhost:6333/health
   # Resposta esperada: {"status":"ok"}
   ```

4. **Interface Web** (disponível após iniciar):
   - Acesse: `http://<IP|URL>:6333/dashboard`