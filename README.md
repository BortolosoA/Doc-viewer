# Docs App

Aplicativo de documentação single-page construído com React + Vite, com backend Node/Express, MinIO (S3) e PostgreSQL.

## Arquitetura (3 serviços via Docker Compose)

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **app** (Nginx + React) | 8080 | Frontend servido estaticamente; proxy `/api/*` → `api:3001` |
| **api** (Node/Express) | 3001 | Upload/download/delete de documentos, usuários, tags |
| **minio** | 9000 / 9001 | Object storage S3-compatível (arquivos .md) |
| **db** (PostgreSQL) | 5432 | Metadados de documentos, cadastro de usuários, tags (futuro) |

## Funcionalidades

- Sidebar fixa à esquerda com lista de páginas clicáveis
- Renderização de Markdown com `react-markdown`
- Navegação por estado (`useState`), sem roteador
- Tema claro/escuro/manual
- **Upload de documentos** (`.md` com suporte especial + outros arquivos)
- **Exclusão de documentos** remotos
- Documentos estáticos em `src/docs/` como fallback (dev sem backend)
- CSS puro, sem Tailwind ou UI libs

## Estrutura

```
.
├── docker-compose.yml
├── Dockerfile              # Frontend (multi-stage: Vite build → Nginx)
├── nginx.conf              # Proxy /api/* → api:3001
├── .env.example            # Variáveis de ambiente
├── server/                 # Backend API
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js        # Express + rotas
│       ├── db.js           # Pool PG + schema (users, documents, tags)
│       └── storage.js      # MinIO (S3) client
├── src/
│   ├── api.js              # Cliente fetch da API
│   ├── App.jsx
│   ├── Sidebar.jsx         # Lista + upload + delete
│   ├── DocView.jsx
│   ├── App.css
│   └── docs/               # Markdown estáticos (fallback)
```

## Como rodar (produção com Docker)

```bash
# 1. Copie e ajuste as variáveis
cp .env.example .env

# 2. Suba tudo
docker compose up -d --build

# 3. Acesse
# Frontend: http://localhost:8080
# API:      http://localhost:3001/health
# MinIO UI: http://localhost:9001  (user/pass do .env)
```

## Desenvolvimento local (sem Docker para o frontend)

```bash
# Terminal 1: sobe só infra (MinIO + Postgres)
docker compose up -d minio db

# Terminal 2: roda a API
cd server && npm install && npm run dev

# Terminal 3: roda o frontend (Vite)
npm install && npm run dev
# Acesse http://localhost:5173 (VITE_API_URL aponta para http://localhost:3001)
```

## Adicionar páginas estáticas (fallback)

1. Crie um arquivo `.md` em `src/docs/`.
2. O Vite importa automaticamente via `import.meta.glob`.
3. Aparece na sidebar mesmo sem backend.

## Upload de documentos (.md)

- Clique em **"Enviar .md"** na sidebar.
- Selecione um arquivo `.md` ou `.markdown`.
- O backend normaliza o `Content-Type` para `text/markdown`.
- O documento fica disponível imediatamente na lista (badge "remoto").
- Armazenado no MinIO; metadados no PostgreSQL.

## Exclusão

- Botão 🗑️ ao lado de cada documento **remoto**.
- Remove do MinIO e do PostgreSQL.
- Documentos estáticos (bundled) não podem ser excluídos pela UI.

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/users` | Lista usuários |
| POST | `/users` | Cria usuário `{username, email?}` |
| GET | `/documents` | Lista metadados dos documentos |
| GET | `/documents/:name/raw` | Conteúdo bruto (markdown) |
| POST | `/documents` | Upload (multipart/form-data, campo `file`) |
| DELETE | `/documents/:name` | Exclui documento |

## Variáveis de ambiente

Veja `.env.example`. Principais:

- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` — credenciais MinIO
- `MINIO_BUCKET` — bucket padrão (`docs`)
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — Postgres
- `VITE_API_URL` — injetado no build do frontend (ex.: `http://localhost:3001`)

## Próximos passos (roadmap)

- Autenticação (JWT) nas rotas da API
- Tags em documentos (tabela `tags` + `document_tags` já criada)
- Busca full-text nos documentos
- Versionamento de documentos
- Compartilhamento via links assinados (presigned URLs do MinIO)
