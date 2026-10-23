# Relatório DEV A — #306

## Estado e escopo

Implementação, gates globais e prova DEV de fonte/tokens concluídos; código aprovado pelo TESTER. Aceite formal app×protótipo aguarda #307. Branch `codex/inbox-e1-306` sobre o commit de asset preparado `3eb87ea6c41c27edd10333e89594cd33e3b232af`, que sucede a base E0 fechada `bcc3d27ab007231a08cabe2c3cf9c9b46a151558`. SPEC em `docs/specs/inbox-tokens-fonte.md`. Sem fonte/runtime de CDN, instalação, package/lock, schema, permissão, envio externo ou novo consumidor de UI.

## Entrega

- `globals.css`:8 cores de avatar herdadas no escuro,3 tokens de balão/pontos por tema e `fundo-conversa` em utilities, com comentários de origem.
- `tailwind.config.ts`:cores planas avatar1–8/bubbleIA/nota e pilha mono por variável local.
- `layout.tsx`:JetBrains Mono 400–500 por next/font/local, display swap, duas variáveis no html; Roboto preservada. Asset/licença são o commit prévio do integrador, não foram obtidos/alterados pelo DEV. Hash SHA256 real conferido: `18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e` (chunk 706131, saída 0); licença contém OFL 1.1.
- `contraste-mapa.ts`:iniciais brancas nos 8 avatares. Travas de design-system/contraste/tipografia atualizadas; nenhuma exceção no detector de paleta/contraste, nenhum relaxamento de parser.
- `docs/18-design-system.md`:valores, motivo da adaptação L 0,54 e exceção estreita de radial-gradient para pontos. Fonte continua400–500; mono 600 de contadores futuros fica para task consumidora, decisão expressa do integrador.

## TDD e evidências automatizadas — Node 22.23.2

1. RED: `vitest run src/app/design-system.test.ts src/app/contraste.test.ts src/app/tipografia.test.ts --maxWorkers=2`, chunk **656626**, saída **1**: **9 falhas/33 aprovados,3 arquivos/42 testes**. Falhas por tokens ausentes, mapa/cores/mono ainda não registrados e fundo sem CSS; nenhum erro de parsing de teste. Hash e licença entregues já passaram.
2. GREEN: `vitest run src/app/design-system.test.ts src/app/contraste.test.ts src/app/tipografia.test.ts src/app/paleta.test.ts src/app/contraste-elementos.test.ts --maxWorkers=2`, chunk **dbe6b2**, saída **0**, **5 arquivos/53 testes**, nenhum ignorado/todo.
3. ESLint dirigido a 6 TS (`tailwind.config`,layout,mapa,design-system,contraste,tipografia), `--max-warnings 0`, chunk **9b5a8c**, saída **0**, sem avisos.
4. O teste de CSS compila globals+config reais por PostCSS/Tailwind local com content raw contendo todos os utilitários:confere background de cada avatar/balão, pilha mono e imagem/intervalo de pontos. Não depende de classes ainda não consumidas no aplicativo e não adiciona safelist global.
5. Contraste com o núcleo existente:nos dois temas,8 avatares+branco >=4,5, autoteste com avatar8 mais claro reprova; textos primário/secundário nos4 balões e autores IA/nota/humano passam 4,5. Valores congelados em hex/rgba preservam parser fechado.

## Gates globais observados em b8d5128a

Node 22.23.2, mesma fonte congelada dos recortes:

- TSC global, heap8192: sessão **50415**, chunk **600997**, saída **0**.
- Vitest unitário completo sem filtros, apenas limite `--maxWorkers=2`: sessão **99205**, chunk **8433a2**, saída **0**, **845 arquivos/6533 testes**, nenhum ignorado/todo, duração 215,18 s.
- ESLint global `eslint . --max-warnings 40`, sem filtros: sessão **59333**, chunk **f8a8e3**, saída **0**, zero erros/40 avisos preexistentes.
- O harness de evidência foi acrescentado após os gates de fonte; sintaxe saída 0 (745af4), lint dirigido final `capturar-mono.mjs --max-warnings 0` saída 0 (d2c1a1) e execução real abaixo. Nenhuma UI/teste mudou após b8d5128a; não atribuir uma segunda execução global à consolidação de artefatos.

## Prova visual DEV — fonte e trechos reais isolados

O integrador preparou servidor 3110 com fonte b8d5128a, Node 22, perfil dev-email e transportes externos vazios (sessão 2251). DEV não iniciou/parou servidor ou cluster. Auth CSRF+credentials local sem registrar credenciais no harness/manifesto. Navegação apenas em /inbox sem seleção, sem ação de negócio. O integrador encerrou 3110 após a prova.

- **Matriz:**1440×900,1024×768,390×844 × claro/escuro =6 contextos. **18 PNGs:**6 fotos do app atual,6 amostras com JetBrains Mono atual e 6 com a pilha anterior explicitamente **reconstituída** do defaultTheme Tailwind3. Esta última fase não é captura de um checkout antigo e não faz papel de protótipo.
- **Execução final:** sessão **31018**, chunk **c18045**, saída **0**, todos os6 contextos com font loading e geometria aprovados. Primeira execução 17291/604b08 também 0; repetida somente para melhorar a legenda do peso 600 e registrar fontSynthesis no manifesto.
- **Fontes reais:**document.fonts.load da família Next local nos pesos 400/500 retornou 1 face em cada requisição; face mono peso 400 500 em estado loaded. Elementos temporários font-mono resolveram essa família com os fallbacks do config. Corpo/amostra sans permaneceram Roboto (face 100 900 loaded), sem mudança entre as duas fases. Não se confundiu presença de variável com carregamento real.
- **Tokens computados nos dois temas:**avatar4=#6e62aa; balões IA/nota e chat-dot exatamente como contrato. Os 8 avatares, balões e padrão pontilhado aparecem na amostra com utilitários compilados dos globals/config reais, content explícito.
- **Origem real dos trechos:**AST TypeScript extraiu JSX de certificado público (código 12 hex, formato do gerador), p/hash 64+break-all e input de conferência de contrato histórico, p/código fictício de pareamento, e dt/variável de contrato. Foram renderizados isoladamente com dados fictícios, sem importar/executar ações, hooks ou fluxos dessas telas. Manifesto contém caminho, linha, hash e texto JSX extraído para auditoria. Isso prova estilo/geometria dos trechos, não homologa as páginas/ações completas.
- **Geometria:**nenhuma amostra sai do seu contêiner e nenhum contexto tem overflow horizontal externo; código de pareamento/certificado legíveis. Em 390 px os dois hashes passam de 40 para 60 px (2→3 linhas) com a mono nova; break-all preserva acesso. Input mantém rolagem horizontal própria esperada para 64 caracteres.
- **Peso 600:**dt herda 600 do reset global, enquanto a face local registrada/carregada cobre 400–500. FontSynthesis computado permite weight/style/small-caps; largura e legibilidade ficaram adequadas na amostra. Não se declara face 600 nativa nem qual mecanismo de síntese/seleção o browser efetivamente aplicou. Faixa contratada permanece 400–500; questão de peso fica registrada para consumidores.
- **Integridade:**zero pageerror e zero tentativa de recurso externo nos6 contextos. AGENTS recebeu só bloco automático do Next, diff conferido e restaurado conforme autorização. Nenhum seed, senha, cookie ou log de sessão versionado. Conjunto 18 PNG+JSON+harness cerca de 1,2 MiB; imagens inspecionadas pelo DEV (desktop,tablet e celular em ambos temas).

## Revisão e pendências

TESTER revisou SHA exato **b8d5128a9e18541d24cc5f0e0e0c2e9654102604**, parecer de código favorável, **5 arquivos/53 testes** independentes Node 22.23.2 saída 0 e diff-check 0. Parecer copiado em `output/inbox-306-visual/qa/inbox-306-review.md`. Seu alerta de dt 600 foi incluído na prova acima. O parecer mantém corretamente o aceite visual formal pendente.

Pendência encerrada pelo integrador: aceite app×protótipo nos3tamanhos/2temas em fonte7e236e64, com harness307 estável. Root51505exit0 e TESTER76466exit0: cadaum34PNGs/0falhas/14diagnósticos, estados reais inspecionados. TESTER confirmou JetBrainsMono400/500 carregada e Roboto6/6, sem pageerrors/recurso externo. Parecer favorável e6pares conversa em `output/inbox-306-comparacao/` (12imagens:6app+6protótipo); manifesto combinado lista34, as outras22 ficam na entrega307. Protótipo offline usa fonte de reserva, contadores de leitura variam entre contextos; não alegar paridade de contadores.

Fonte final combinada76a08316995cfbac4073b69b3743852caeba97ad inclui sóenum tipado no teste307 após as capturas; nenhum pixel mudou. Sessão95778 acompanhada atéexit0:846arquivos/6547testes unitários semfiltro/semignorados/maxWorkers2,TSCheap8192,lintglobal0erros40avisos herdados, Node22.23.2. Logs em `output/inbox-306-comparacao/`. Primeira suíte9542 interrompida após detectar guard307vermelho; RED dirigido ecorreção registrados na entrega307, sem fingir suíte completa naquela tentativa. Pronta para PR; sem merge/deploy. Sem suíte de integração de banco/build neste recorte de tokens/fonte.
