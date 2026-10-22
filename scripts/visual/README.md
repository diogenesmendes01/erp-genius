# Capturas locais do Inbox

O harness compara o Inbox do ERP com o protótipo aprovado em três viewports
(1440×900, 1024×768, 390×844) e dois temas. `conversa` gera seis PNGs de cada alvo
em `tmp/visual/`, mais `manifesto.json`. A pasta `tmp/` é ignorada pelo Git.

## Banco e fixture

Use somente um perfil `.erp-test-profile` da lista fechada em
`scripts/test-profile.mjs`: `integracao`, `dev-email`, `dev-gravacoes`, `tester` ou
`ci-integracao`, todos em `localhost:54329`. O seed recusa qualquer outro banco,
host, porta, query ou fragmento antes de abrir o Prisma. Reserve uma janela
exclusiva para o perfil; suítes de integração apagam a fixture. O integrador
prepara o cluster e aplica as migrations. Não use banco de produção.

A demo precisa somente de dois usuários fictícios: `admin@genius.com` com papel
`ADMINISTRADOR` e `joao@genius.com` com `VENDEDOR`. Para o login visual, a senha
de teste do admin é `genius123` (ou informe `INBOX_VISUAL_EMAIL` e
`INBOX_VISUAL_SENHA` do usuário fictício). O seed principal `prisma/seed.ts` pode
criá-los, mas não é necessário se essas duas contas já existirem. A demo cria
sete atendimentos e um número BAILEYS **desconectado**, sem enviar mensagens.
Reexecutá-la reaproveita os IDs fixos e repara casos faltantes, sem atualizar
registros de outros cenários. A saída `tmp/visual/demo-ids.json` identifica o
perfil para a CLI.

Com o perfil correto no worktree e migrations já aplicadas:

```text
node_modules/.bin/tsx scripts/visual/demo-inbox.ts
```

## Servidor e navegador

Para o app, use uma instância local do build apontando para **o mesmo banco do
perfil**. O integrador inicia o servidor de captura; exemplo de configuração:
`DATABASE_URL` resolvida por `resolverBancoTeste()`, `AUTH_TRUST_HOST=true`,
`NEXTAUTH_URL=http://127.0.0.1:3017`, segredo de autenticação exclusivo de teste,
`WHATSAPP_LIVE` vazio, sem cron ou webhooks externos. Após `next build`, o servidor
usa `next start -p 3017`. Não inicie/paralise o cluster para capturar telas.

No Windows, defina `PW_CHROMIUM=C:/Program Files/Google/Chrome/Application/chrome.exe`.
No Linux, a CLI usa o Chromium local em `/opt/pw-browsers/chromium-1194/…` por
padrão. O harness usa `playwright-core`; nunca baixa um navegador. Exemplos:

```text
node scripts/visual/capturar-inbox.mjs --alvo ambos --estado conversa --base http://127.0.0.1:3017
node scripts/visual/capturar-inbox.mjs --alvo prototipo --estado conversa
node scripts/visual/capturar-inbox.mjs --help
```

O protótipo abre de `docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html`.
React, ReactDOM, Babel e Lucide solicitados a `unpkg.com` são servidos dos
pacotes **locais** em `node_modules`; Google Fonts recebe CSS vazio. A captura
bloqueia outros destinos externos e registra falhas de requisição, HTTP 404 e
`pageerror` no manifesto. A fonte de reserva offline pode mudar a tipografia do
protótipo; ela não muda a fonte nem os dados do app. Só imagens de fixture
fictícia devem ser anexadas ao PR.

As próximas tasks E1–E4 acrescentam estados ao `ESTADOS` e seus passos à CLI.
