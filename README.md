# Docs App

Aplicativo de documentação single-page construído com React + Vite.

## Funcionalidades

- Sidebar fixa à esquerda com lista de páginas clicáveis
- Renderização de Markdown com `react-markdown`
- Navegação por estado (`useState`), sem roteador
- Tema claro/escuro/manual
- CSS puro, sem Tailwind ou UI libs

## Estrutura

```
src/
  docs/
    intro.md
    install.md
    config.md
  App.jsx
  Sidebar.jsx
  DocView.jsx
  App.css
```

## Como rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`.

## Adicionar páginas

1. Crie um arquivo `.md` em `src/docs/`.
2. Importe-o em `App.jsx` com `?raw`.
3. Adicione a página ao array `pages`.
