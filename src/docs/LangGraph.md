# <center>**Instalação e configuração do LangGraph - (passo-a-passo)**</center>

## Índice
- [LangGraph](#langgraph)
    - [Instalação](#instalação-do-langgraph)
        - [User](#criar-usuário)
        - [Diretórios](#criar-pastas-e-ajustar-permissão)
        - [Venv e Instação](#criar-o-venv-e-instalar-o-langgraph)
    - [Configuração](#configuração-do-langgraph)
        - [Aplicação de server](#criar-o-mainpy-para-rodar-o-server)
        - [Configurar o .env](#criar-o-env)
        - [Criar logs](#criar-os-arquivos-de-log)
        - [Criar o service](#criar-o-langgraphservice-em-etcsystemdsystemlanggraphservice)
    - [LogRotate](#configurar-o-logrotate)
        - [Configurar](#configurar-o-logrotate-1)
    - [Execução](#execução-do-serviço)
---

## [LangGraph](https://docs.langchain.com/oss/python/langgraph/install)

## Instalação do langgraph

1. ### Criar usuário:
    ```bash
    sudo useradd -r -s /usr/sbin/nologin langgraph
    ```

2. ### Criar pastas e ajustar permissão:
    ```bash
    sudo mkdir -p /opt/langgraph /var/log/langgraph
    sudo chown -R langgraph:langgraph /opt/langgraph
    ```

3. ### Criar o venv e instalar o langgraph:
    ```bash
    sudo -u langgraph python3 -m venv /opt/langgraph/venv
    sudo -u langgraph /opt/langgraph/venv/bin/pip install langgraph langchain fastapi uvicorn sqlalchemy psycopg2-binary
    sudo -u langgraph /opt/langgraph/venv/bin/pip install -r /opt/langgraph/requirements.txt
    ```

## Configuração do langgraph

1. ### Criar o `main.py` para rodar o server:
    > **Nota**: O arquivo deve ser criado em: `/opt/langgraph/main.py`
    ```python
    import os
    import time
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import StreamingResponse
    from pydantic import BaseModel
    from langchain_openai import ChatOpenAI
    from sqlalchemy import create_engine
    from langgraph.graph import StateGraph, START, END
    from typing import TypedDict, Annotated, Sequence
    import operator
    import json

    # 1. Extração das Variáveis de Ambiente Estruturadas
    OPENAI_API_BASE_MAIN = os.getenv("OPENAI_API_BASE", "https://openai_url/v1")
    OPENAI_API_BASE_FAST = os.getenv("OPENAI_API_BASE_FAST", "https://openai_url/v1")
    DATABASE_URL = os.getenv("DATABASE_URL")
    VALKEY_URL = os.getenv("VALKEY_URL")
    QDRANT_URL = os.getenv("QDRANT_URL")

    # 2. Connection Pooling Obrigatório (Evita sobrecarga no cluster Patroni/pgBouncer)
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=5,
        pool_pre_ping=True
    )

    # 3. Inicialização dos Dois LLMs conforme Especificação Técnica
    llm_main = ChatOpenAI(
        base_url=OPENAI_API_BASE_MAIN,
        api_key="<AI-API-KEY>",
        model="<modelo-da-IA>",
        streaming=True,
        max_tokens=512,
        temperature=0.7
    )
    llm_fast = ChatOpenAI(
        base_url=OPENAI_API_BASE_FAST,
        api_key="<AI-API-KEY>",
        model="<modelo-da-IA>",
        streaming=False,
        max_tokens=256,
        temperature=0.1  # Baixa temperatura para respostas previsíveis e estruturadas
    )

    # 4. Estrutura Base do Grafo de Decisão (LangGraph)
    class AgentState(TypedDict):
        messages: Annotated[Sequence[str], operator.add]
        next_action: str

    # Nó de Roteamento Analítico: O modelo menor (3B) decide o fluxo interno do sistema
    def supervisor_router(state: AgentState):
        last_message = state["messages"][-1]
        prompt = f"Analise o pedido e responda estritamente com 'RAG' ou 'DIRETO': {last_message}"
        decision = llm_fast.invoke(prompt).content.strip().upper()

        action = "execute_rag" if "RAG" in decision else "execute_direct"
        return {"next_action": action}

    # Nó de Geração Final: O modelo maior (14B) elabora o texto final rico
    def core_generator(state: AgentState):
        last_message = state["messages"][-1]
        response = llm_main.invoke(last_message)
        return {"messages": [response.content]}

    # Construção e Orquestração do Workflow do Grafo
    workflow = StateGraph(AgentState)
    workflow.add_node("supervisor", supervisor_router)
    workflow.add_node("generator", core_generator)
    workflow.add_edge(START, "supervisor")

    # Rota Condicional baseada na decisão do modelo leve
    def route_logic(state: AgentState):
        if state["next_action"] == "execute_rag":
            # Aqui integraria a pesquisa no Qdrant via gRPC se necessário
            return "generator"
        return "generator"

    workflow.add_conditional_edges("supervisor", route_logic, {
        "generator": "generator",
        END: END
    })
    workflow.add_edge("generator", END)

    # Compilação nativa do Grafo
    agent_orchestrator = workflow.compile()

    # 5. Infraestrutura Web FastAPI para exposição do Serviço
    app = FastAPI(title="LangGraph Core Engine")


    # --- Endpoint original ---

    class UserPrompt(BaseModel):
        prompt: str

    @app.post("/api/v1/orchestrate")
    async def run_pipeline(payload: UserPrompt):
        try:
            initial_state = {"messages": [payload.prompt]}
            output = agent_orchestrator.invoke(initial_state)
            final_text = output["messages"][-1] if output["messages"] else ""
            return {"status": "success", "response": final_text}
        except Exception as error:
            raise HTTPException(status_code=500, detail=str(error))


    # --- Endpoints compatíveis com OpenAI (integração OpenWebUI) ---

    class ChatMessage(BaseModel):
        role: str
        content: str

    class ChatCompletionRequest(BaseModel):
        model: str = "langgraph"
        messages: list[ChatMessage]
        stream: bool = False

    @app.post("/v1/chat/completions")
    async def chat_completions(request: ChatCompletionRequest):
        try:
            last_message = request.messages[-1].content
            initial_state = {"messages": [last_message]}
            output = agent_orchestrator.invoke(initial_state)
            final_text = output["messages"][-1] if output["messages"] else ""

            response = {
                "id": "langgraph-1",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": request.model,
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": final_text},
                    "finish_reason": "stop"
                }]
            }
            return response
        except Exception as error:
            raise HTTPException(status_code=500, detail=str(error))

    @app.get("/v1/models")
    async def list_models():
        return {
            "object": "list",
            "data": [{
                "id": "langgraph",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "local"
            }]
        }
    ```

2. ### Criar o `.env`:
    > **Nota**: Criar o arquivo em: `/opt/langgraph/.env`
    ```.env
    OPENAI_API_BASE=http://<IP-DA-LLM>:4000/v1
    OPENAI_API_BASE_FAST=http://<IP-DA-LLM>:4000/v1
    VALKEY_URL=redis://:<key-do-valkey>@<valkey-IP>:6379/0
    QDRANT_URL=http://<qdrant-IP>:6333
    DATABASE_URL=postgresql://<qdrant-user>:<qdrant-user-password>@<IP>:5432/langgraph
    ```

3. ### Criar os arquivos de log
    ```bash
    sudo touch /var/log/langgraph/{langgraph.log,error.log}
    sudo chown -R langgraph:langgraph /var/log/langgraph
    ```

4. ### Criar o `langgraph.service` em /etc/systemd/system/langgraph.service
    ```toml
    [Unit]
    Description=LangGraph Orchestrator API Service
    After=network.target

    [Service]
    User=langgraph
    Group=langgraph
    WorkingDirectory=/opt/langgraph
    Environment="PATH=/opt/langgraph/venv/bin"
    Environment="HOME=/opt/langgraph"
    EnvironmentFile=/opt/langgraph/.env

    SyslogIdentifier=langgraph
    # Aponta os logs para a mesma organização que criamos antes
    StandardOutput=file:/var/log/langgraph/langgraph.log
    StandardError=file:/var/log/langgraph/error.log

    # Execução via Uvicorn utilizando workers dedicados para paralelismo em CPU
    ExecStart=/opt/langgraph/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
    Restart=always
    RestartSec=5

    [Install]
    WantedBy=multi-user.target
    ```

## Configurar o logrotate:
1. ### Configurar o logrotate:
    > **Nota**: Edite em `/etc/logrotate.d/langgraph`
    ```logrotate
    /var/log/langgraph/*.log {
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

## Execução do serviço
1. Aplique as configurações e execute o serviço:
    > **Nota**: O serviço so exuctará após rodar os comandos abaixo.
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl restart langgraph.service
    sudo systemctl enable langgraph.service --nou=w
    sudo systemctl status langgraph.service
    ```