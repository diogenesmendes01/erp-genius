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
No app, a CLI confirma a sessão por CSRF/credentials no mesmo contexto do
navegador e só captura após encontrar o texto da mensagem da fixture; no estado
do compositor humano, exige também a nota interna. A prontidão segue o estado: lista exige Mariana; conversa exige a mensagem;
compositor humano exige também a nota de Beatriz. No Drawer, a mensagem é
confirmada antes do clique, e depois são exigidos o Painel Comercial visível, o
`aside` inteiro dentro do viewport e nenhuma transição em execução nesse painel.
O teste de visibilidade do Playwright sozinho aceita elementos fora da tela.
Assim uma resposta lenta ou a animação de abertura não gera foto vazia.
React, ReactDOM, Babel e Lucide solicitados a `unpkg.com` são servidos dos
pacotes **locais** em `node_modules`; Google Fonts recebe CSS vazio. A captura
bloqueia outros destinos externos e registra falhas de requisição, HTTP 404 e
`pageerror` no manifesto. A fonte de reserva offline pode mudar a tipografia do
protótipo; ela não muda a fonte nem os dados do app. No manifesto, um GET de mensagens cancelado com `net::ERR_ABORTED` só vira
`diagnosticos` quando outro GET da mesma URL terminou 2xx e a fixture já foi
confirmada. Outros cancelamentos, rede externa, 404 e exceções continuam em
`falhas` e fazem a CLI sair com erro. Na foto do app, um estilo temporário
oculta apenas o toast de desenvolvimento do Next sem issues; indicadores com
issues e todos os listeners de diagnóstico permanecem ativos. Só imagens de
fixture fictícia devem ser anexadas ao PR.

`--estado todos` produz 50 PNGs: 26 do app e 24 do protótipo. O painel do
protótipo exige o botão de detalhes e a região aberta; não é ignorado quando
o comando está ausente. As próximas tasks E1–E4 acrescentam estados ao
`ESTADOS` e seus passos à CLI.

## Selo pessoal do menu (#311)

A demo aceita `--entrada thiago` (ou outra chave fictícia fechada) para inserir uma ENTRADA local, sem transporte. Exige fixture existente no BAILEYS desconectado e banco local descartável; não recria a demo nem emite NOTIFY manual. O trigger existente publica o evento após commit.

`node scripts/visual/capturar-selo-inbox.mjs --base http://localhost:3111` é o harness dedicado ao selo, coordenado com a casca #308. Exige exclusivamente perfil dev-gravacoes, banco erp_genius_test_dev_gravacoes na porta54329, IDs fictícios exatos e Chrome local. A autenticação usa conta fictícia preparada pelo integrador; INBOX_VISUAL_EMAIL/INBOX_VISUAL_SENHA podem substituir os padrões locais. Não use credenciais reais.

O preparo muda somente preferências pessoais do Admin: Thiago/Ventura explicitamente não lidas, outras cinco lidas; compartilhados/fixada/silenciada são preservados. Gera 24 PNGs em output/inbox-311-visual, nas quatro fases2→1→2→1, três tamanhos e dois temas. Antes de provocar a subida, navega Home por Link para desmontar a seleção: chat selecionado lê entrada automaticamente. Outra entrada com chat aberto prova reconciliação para1 sem loop. A segunda aba também confirma2, cada aba com uma SSE simultânea e no máximo um GET da contagem em voo.

A captura espera a hidratação inicial/SSE/GET, fonte e transições finitas; valida gaveta no viewport e Sidebar224. Mantém diagnóstico de rede e só oculta toast Next sem issues durante a foto. Em erro escreve manifesto-incompleto; não sobrescreva uma tentativa negativa antes de preservá-la. A CLI principal permanece responsável pelas referências offline app×protótipo.
## Atualização da casca #308

O gatilho do app é “Painel do contato”, ligado à única instância de aside. O estado adicional painel-fechado captura desktop nos dois temas, após fechar o painel automático. Esperas de painel não exigem a thread oculta; painel fechado exige thread pronta e largura zero do aside. O protótipo conserva sua própria navegação e os recursos locais.

A captura do app reprova também warnings React de chave/hidratação no console, além dos pageerrors e falhas de rede já existentes. Fotos estáticas, geometria e interação/AT são evidências diferentes. Probes locais da308 em output/inbox-308-visual usam credenciais fictícias por INBOX_VISUAL_EMAIL/INBOX_VISUAL_SENHA, Chrome instalado e servidor coordenado3110; não enviam mensagem nem submetem formulário.

#312 acrescenta `--estado lista-vazia`: app em `?busca=zzzz` sem seleção, protótipo com busca real `zzzz`, três tamanhos e dois temas (12PNGs). A espera exige EstadoVazio visível e nenhum item da lista; os passos dos demais estados permanecem iguais.

Depois do conteúdo, a CLI exige `data-conectado="1"` para confirmar a assinatura cliente e a hidratação antes de tirar a foto. O conteúdo da lista já pode estar no HTML do servidor. Sem essa espera, a ocultação temporária do cursor feita pelo screenshot pode alterar o input antes de o React hidratar e causar um warning de estilo. Erros e warnings continuam reprovando a captura; não são filtrados como solução dessa corrida.
