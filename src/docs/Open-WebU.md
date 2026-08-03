# <center>**Instalação e configuração do Open-WebUI - (passo-a-passo)**</center>

## Índice
- [Open-WebUI]()
    - [Instalação](#instalação-open-webui)
        - [User](#criar-usuário)
        - [Diretórios|Pastas](#criar-pasta-e-ajustar-permissões)
        - [Ambiente de execução](#configurar-o-venv-e-instalar)
    - [Configurar](#configurar-o-open-webui)
        - [.env](#crie-um-env-em-optopenwebuienv)
        - [.service](#configurar-o-service-em-etcsystemdsystemopenwebuiservice)
    - [Logs](#configurar-diretório-e-arquivo-de-log)
        - [Arquivos .log](#criar-diretórios-de-log)
        - [LogRotate](#configure-o-logrotate)
    - [Execução](#execução)
    - [Acesso Web](#interface-web-disponível-após-iniciar)
---

## [Open-WebUI](https://docs.openwebui.com/)

## Instalação Open-WebUI

1. ### Criar usuário:
    ```bash
    sudo useradd -r -s /usr/sbin/nologin openwebui
    ```

2. ### Criar pasta e ajustar permissões:
    ```bash
    sudo mkdir -p /opt/openwebui/cache
    sudo chown -R openwebui:openwebui /opt/openwebui
    ```

3. ### Configurar o venv e instalar:
    ```bash
    sudo -u openwebui python3 -m venv /opt/openwebui/venv
    sudo -u openwebui /opt/openwebui/venv/bin/pip install open-webui psycopg2-binary
    ```

## Configurar o Open-WebUI
1. ### Crie um `.env` em `/opt/openwebui/.env`:
    ```.env
    # --- Adicione estas duas linhas ---
    HOME=/opt/openwebui
    HF_HOME=/opt/openwebui/cache
    # ---------------------------------

    DATABASE_URL=postgresql://<user>:<password>@<IP-ADDRESS>:5432/openwebui
    PATH=/opt/openwebui/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    HOST=0.0.0.0
    PORT=3000

    DATABASE_POOL_SIZE=3        # conexões base mantidas abertas
    DATABASE_MAX_OVERFLOW=2     # até 5 no pico (3+2)
    DATABASE_POOL_TIMEOUT=10    # espera até 10s por uma conexão livre
    DATABASE_POOL_RECYCLE=600   # recicla conexões a cada 10 min
    WEBUI_WORKERS=1
    ```

2. ### Configurar o `.service` em `/etc/systemd/system/openwebui.service`
    ```toml
    [Unit]
    Description=Open WebUI Service
    After=network.target

    [Service]
    User=openwebui
    Group=openwebui
    WorkingDirectory=/opt/openwebui

    EnvironmentFile=/opt/openwebui/.env

    SyslogIdentifier=openwebui
    StandardOutput=file:/var/log/openwebui/openwebui.log
    StandardError=file:/var/log/openwebui/error.log

    ExecStart=/opt/openwebui/venv/bin/open-webui serve --host 0.0.0.0 --port 3000
    Restart=always

    [Install]
    WantedBy=multi-user.target
    ```

## Configurar diretório e arquivo de log
1. ### Criar diretórios de log:
    ```bash
    sudo mkdir -p /var/log/openwebui
    sudo touch /var/log/openwebui/{openwebui.log,error.log}
    sudo chown -R openwebui:openwebui /var/log/openwebui
    ```

2. ### Configure o logrotate:
    #### Configure o logrotate em `/etc/logrotate.d/openwebui`
    ```logrotate
    /var/log/openwebui/*.log {
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

## Execução
1. Rode os comandos para o aplicativo subir:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl restart openwebui.service
    sudo systemctl enable openwebui.service --nou=w
    sudo systemctl status openwebui.service
    ```

## **Interface Web** (disponível após iniciar):
   - Acesse: `http://<IP|URL>:3000`