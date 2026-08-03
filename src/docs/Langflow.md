# <center>Instalação e configuração do LangFlow - (passo-a-passo)</center>

## Índice
- [LangFlow](#langflow)
    - [Instalação](#instalação-do-langflow)
        - [Criar User](#criar-usuário)
        - [Criar Pastas](#criar-pastas-e-ajustar-permissão)
        - [Instalar o langflow](#criar-o-venv-e-instalar-o-langflow)
    - [Configuração](#configuração-do-langflow)
        - [Configurar o .service](#configurar-o-langflowservice-em-etcsystemdsystemlangflowservice)
        - [Aplicar Configuração](#aplicar-as-configurações-e-iniciar-o-langflowservice)
    - [Logs](#configurar-e-ajustar-logs)
        - [Criar arquivos de log](#configurar-e-ajustar-logs)
        - [Logrotate](#ajuste-o-logrotate-do-langflow-em-etclogrotatedlangflow)
---

## [LangFlow](https://docs.langflow.org/get-started-installation#install-and-run-the-langflow-oss-python-package)

## Instalação do langflow

1. ### Criar usuário:
    ```bash
    sudo useradd -r -s /usr/sbin/nologin langflow
    ```

2. ### Criar pastas e ajustar permissão:
    ```bash
    sudo mkdir -p /opt/langflow
    sudo chown -R langflow:langflow /opt/langflow
    ```

3. ### Criar o venv e instalar o langflow:
    ```bash
    sudo -u langflow python3 -m venv /opt/langflow/venv
    sudo -u langflow /opt/langflow/venv/bin/pip install langflow
    ```

## Configuração do LangFlow

1. ### Configurar o langflow.service em `/etc/systemd/system/langflow.service`:
    ```toml
    [Unit]
    Description=Langflow Service
    After=network.target

    [Service]
    User=langflow
    Group=langflow
    WorkingDirectory=/opt/langflow
    Environment="PATH=/opt/langflow/venv/bin"
    Environment="HOME=/opt/langflow"

    Environment="OPENAI_API_BASE=http://<AI-IP>:4000/v1"
    Environment="OPENAI_API_KEY=<AI-API-KEY>"

    Environment="LANGFLOW_SECRET_KEY=<Secret-key>"
    Environment="LANGFLOW_AUTO_LOGIN=False"
    Environment="LANGFLOW_SUPERUSER=<Super-User>"
    Environment="LANGFLOW_SUPERUSER_PASSWORD=<Super-Passwd>"

    SyslogIdentifier=langflow

    # Alterado de 'append:' para 'file:'
    StandardOutput=file:/var/log/langflow/langflow.log
    StandardError=file:/var/log/langflow/error.log

    ExecStart=/opt/langflow/venv/bin/langflow run --host 0.0.0.0 --port 7860
    Restart=always

    [Install]
    WantedBy=multi-user.target
    ```

2. ### Aplicar as configurações e iniciar o `langflow.service`:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl restart langflow.service
    sudo systemctl enable langflow.service --now
    sudo systemctl status langflow.service
    ```

## Configurar e ajustar logs

1. ### Criar pastas e arquivos de log:
    > **Nota**: Irá causar erro se não houver os arquivos de log criados. Após criar os arquivos restart serviço.
    ```bash
    sudo mkdir -p /var/log/langflow
    sudo touch /var/log/langflow/{langflow.log,error.log}
    sudo chown -R langflow:langflow /var/log/langflow/
    ```

2. ### Ajuste o Logrotate do Langflow em `/etc/logrotate.d/langflow`
    ```logrotate
    /var/log/langflow/*.log {
        daily
        rotate 2
        compress
        missingok
        notifempty
        create 0640 root
        endscript
    }
    ```