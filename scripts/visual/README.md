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
Em qualquer sistema, `PW_CHROMIUM` deve apontar para o navegador local disponível;
não há um caminho ou revisão de Chromium fixados pela CLI. O harness usa
`playwright-core` 1.64.1, alinhado a `@playwright/test` e `playwright` 1.64.1.
A trava de dependências verifica também a resolução real do core pelo runner,
incluindo cópias aninhadas. O harness nunca baixa um navegador. Exemplos:

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

`--estado todos` produz 118 PNGs: 60 do app e 58 do protótipo. O painel do
protótipo exige o botão de detalhes e a região aberta; não é ignorado quando
o comando está ausente. As próximas tasks E1–E4 acrescentam estados ao
`ESTADOS` e seus passos à CLI.

## Atualização da casca #308

O gatilho do app é “Painel do contato”, ligado à única instância de aside. O estado adicional painel-fechado captura desktop nos dois temas, após fechar o painel automático. Esperas de painel não exigem a thread oculta; painel fechado exige thread pronta e largura zero do aside. O protótipo conserva sua própria navegação e os recursos locais.

A captura do app reprova também warnings React de chave/hidratação no console, além dos pageerrors e falhas de rede já existentes. Fotos estáticas, geometria e interação/AT são evidências diferentes. Probes locais da308 em output/inbox-308-visual usam credenciais fictícias por INBOX_VISUAL_EMAIL/INBOX_VISUAL_SENHA, Chrome instalado e servidor coordenado3110; não enviam mensagem nem submetem formulário.

## Selo pessoal do menu (#311)

A demo aceita `--entrada thiago` (ou outra chave fictícia fechada) para inserir uma ENTRADA local, sem transporte. Exige fixture existente no BAILEYS desconectado e banco local descartável; não recria a demo nem emite NOTIFY manual. O trigger existente publica o evento após commit.

`node scripts/visual/capturar-selo-inbox.mjs --base http://localhost:3111` é o harness dedicado ao selo, coordenado com a casca #308. Exige exclusivamente perfil dev-gravacoes, banco erp_genius_test_dev_gravacoes na porta54329, IDs fictícios exatos e Chrome local. A autenticação usa conta fictícia preparada pelo integrador; INBOX_VISUAL_EMAIL/INBOX_VISUAL_SENHA podem substituir os padrões locais. Não use credenciais reais.

O preparo muda somente preferências pessoais do Admin: Thiago/Ventura explicitamente não lidas, outras cinco lidas; compartilhados/fixada/silenciada são preservados. Gera 24 PNGs em output/inbox-311-visual, nas quatro fases2→1→2→1, três tamanhos e dois temas. Antes de provocar a subida, navega Home por Link para desmontar a seleção: chat selecionado lê entrada automaticamente. Outra entrada com chat aberto prova reconciliação para1 sem loop. A segunda aba também confirma2, cada aba com uma SSE simultânea e no máximo um GET da contagem em voo.

A captura espera a hidratação inicial/SSE/GET, fonte e transições finitas; valida gaveta no viewport e Sidebar224. Mantém diagnóstico de rede e só oculta toast Next sem issues durante a foto. Em erro escreve manifesto-incompleto; não sobrescreva uma tentativa negativa antes de preservá-la. A CLI principal permanece responsável pelas referências offline app×protótipo.

## Estado de lista vazia (#312)

#312 acrescenta `--estado lista-vazia`: app em `?busca=zzzz` sem seleção, protótipo com busca real `zzzz`, três tamanhos e dois temas (12PNGs). A espera exige EstadoVazio visível e nenhum item da lista; os passos dos demais estados permanecem iguais.

# Telefones em evidências

A demo307 cria somente números fictícios `+5500000000300`–`0307` e repara
os valores antigos reconhecidos no próprio cenário. O harness anonimiza os
telefones do DOM do protótipo imediatamente antes da foto e declara essa
transformação no manifesto, preservando o arquivo HTML original.

Harnesses de outras issues podem importar `anonimizarTelefonesNoDom` de
`./anonimizar-telefones.mjs` e executar
`const anonimizacao = await pagina.evaluate(anonimizarTelefonesNoDom)` depois
das interações e antes de `screenshot`. Salvar o retorno no manifesto; não salvar
um mapa dos valores originais. Reaplicar depois de nova renderização.

O teste do DOM real usa Chrome já instalado, sem baixar navegador:
`PW_CHROMIUM=<caminho-local> node --test scripts/visual/anonimizar-telefones.browser.test.mjs`.
Esse teste dirigido de navegador é separado da suíte unitária Vitest.

Depois do conteúdo, a CLI exige `data-conectado="1"` para confirmar a assinatura cliente e a hidratação antes de tirar a foto. O conteúdo da lista já pode estar no HTML do servidor. Sem essa espera, a ocultação temporária do cursor feita pelo screenshot pode alterar o input antes de o React hidratar e causar um warning de estilo. Erros e warnings continuam reprovando a captura; não são filtrados como solução dessa corrida.

## Thread por autor (#314)

`humano-compositor` agora cobre1440×900,1024×768 e390×844 nos dois temas,12PNGs app×protótipo. Junto de `conversa` e `celular-conversa`, são28capturas formais. A prontidão humana exige a mensagem/nota real307, autorVocê, separador civil identificado, status de saída e notas sem comandos/mídia/status de transporte; não depende de data fixa Hoje no seed histórico. Casos LIDA/FALHOU e autoresCamila/Carlos/origens314 usam a fixture complementar privada preparada pelo integrador e probes sem envio/alteraçãoDB.

No app humano, a CLI rola internamente até a nota307, para mostrar nota seguida da autoria/status sem sintetizar conteúdo; as notas/autores adicionais podem exigir fotos complementares. No protótipo celular abreBeatriz antes da foto. HidrataçãoSSE, guardasReact/rede e anonimizaçãoDOM392 após interações/antesfoto com registro no manifesto permanecem ativos. A fixture314 de99→101 é prova privada separada e deve ser retirada pelo integrador com guards antes do formal; não executar seed ou limpeza automática pela CLI.

## Coluna Conversas (#313)

Estados filtros, seletor-numero e nova-conversa acrescentam36PNG, três tamanhos/dois temas/app×protótipo. A abertura real no app espera lista e data-conectado=1 antes do clique; prontidão exige título/conteúdo/grupos ou campos, ação final/rodapé no viewport e fim da transição. Abaixo700 a folha não é aceita fora da tela. Não há submit de NovoAtendimento nem transporte/seed na CLI.

O protótipo usa seus próprios gatilhos e conteúdo, incluindo fluxo D9 futuro apenas como referência; nenhum botão de criação/envio é acionado. AnonimizaçãoDOM392 continua após as interações/antesfoto e declarada no manifesto; HTML original intacto. Estados314/autoria/hidratação/guardReact e diagnóstico de rede são preservados. Formal313: conversa12+filtros12+seletor12+Nova12+celular-lista4=52PNG. Prova390×500/teclado/navegação e >100itens exige complemento coordenado; não se presume aceite por gerar arquivos.

Nos selects nativos de NovoAtendimento, o nome do label implícito inclui texto das options; a espera usa regex ancorada no rótulo do campo. Regressão real/offline: node --test scripts/visual/espera-app.browser.test.mjs (Chrome local, sem app/DB).


## Painel do contato (#318)

painel-detalhes acrescenta12PNG (três tamanhos/dois temas/app×protótipo). Com tablet-painel e celular-painel, o recorte formal318 tem20PNG. Todos os estados313/314 permanecem. A CLI abre o painel único só quando ele não está visível, após conteúdo da thread e hidratação; não fecha acidentalmente a coluna automática desktop.

A prontidão318 exige o setor visível e cabeçalho canônicoMariana/avatar132, tagsAdulto/Inglês/Noite com marca semautor naNoite, apenasDetalhes ativa e umfechar36, painel inteiro no viewport e transições terminadas. A fixture vem do integrador; a CLI não semeia nem executa ações. AprovaçãoAria/triagem e altura500/textos extensos são complementos privados coordenados, sem clicar ações de negócio. Divergências do protótipo: sóDetalhes, conteúdo ERP atual, sem editar/+tag e subtítulo setor/número; shell960/1400 substitui o hide1100 antigo.

Informe INBOX_VISUAL_FONTE com o SHA exato do app para as evidências finais. O manifesto registra fonteApp e hashes SHA256 dos quatro módulos de captura/prontidão/anonimização. AnonimizaçãoDOM392 é reaplicada depois das interações e antes de cada foto em ambos os alvos, registrando política/versão/substituições; a demoApp já usa números fictícios. Não anexar captura com fonte nula como QA final. GuardasReact/rede/hidratação continuam reprovando falhas.

## Cabeçalho/menu #315

Após o freeze de código315, menu-mais acrescenta12PNGs (3tamanhos,2temas,app×protótipo). O app confirma thread, hidratação/SSE, abre Mais ações da conversa e exige header68/menu no viewport, Buscar disabled Em breve e Bloquear disabled com o motivo completo. Não executa comandos. O protótipo abre seu menu Mais original, preservando diferenças D7/D15/D16 e itensERP. Demais estados313/314/318 permanecem; helperDOM392 roda após interações e antes da foto, consoleReact/hidratação/404/rede continuam invalidando o manifesto. FonteApp e hashes4módulos ficam no manifesto; não há seed ou writes de negócio pela CLI.
