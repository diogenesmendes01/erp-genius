# Inbox #348 — relatório DEV

Branch codex/inbox-e3-348-cabecalho-aria, base716a6261f1bb920bbd4d5c9013535c2acf2ed058 (#347 sobre346252; dependências ainda drafts). Task7 do plano2026-10-22-inbox-prototipo-04-aria e decisões de produto persistentes lidos. GO explícito ROOT fechou bordas haQuanto,404 e feedback fora68px. Nenhuma aprovação de issue/homologação implícita.

## Implementação

textos-aria puro e helper de pausa movido com reexport compatível no PainelAria. Linha no cabeçalho68 usa estado343 e capacidade real do painel atual. Botão retorna feedback em slot separado após header, usa useAcaoCliente real/idempotentetrue e action existente. Controlador keyed por atendimento; token de ciclo invalida ACK/erro/transporte após unmount, A→B→A e perda/retorno de capacidade. Controlador permanece estável ao mudar capacidade para preservar rascunho/scroller; nenhuma cópia do estado da action ou setState no render. No404 só capacidadesAria da cópia conhecida são limpas; histórico permanece,503 preserva. Painel antigo e demais ações/compositor continuam.

## TDD e evidências terminais

-73b9ab EXIT1: novos módulos ausentes, zero casos; administrativo, não RED comportamental.
-0fcced EXIT1: quatro arquivos completos72 casos,30 falhas novas/42 controles, interfaces vazias. Alguns testesDOM sem botão na interface vazia não alcançavam clique; helpers/SSR/consumidores tiveram falhas de apresentação reais.
-266230 EXIT1: consumidor painel11 casos,1 falha por aria ausente/10 controles.
-9f8240 EXIT1: seis arquivos90 casos,6 falhas no DOM mínimo por SVG sem createElementNS. Mock apenas IconSparkles no teste de interação, mantendo hook/controlador/action-fronteira reais;85852a EXIT0 seis arquivos90/90.
-2eb47b EXIT1: controlador8 casos,2 falhas/6 controles ao exigir capacidade sem remontar conversa.85ce7e EXIT0 oito casos após correção. Tentativa intermediáriaa51093 EXIT1 por substituição textual incompleta/variáveis ausentes, corrigida integralmente antes de qualquer freeze.
-Primeira pasta Inbox sessão62193/chunk1f0f89 EXIT1:64 arquivos603 casos,19 falhas/584 aprovados. Falhas em ConversaAberta.busca.test.ts(13) e ConversaAberta.rodape.test.ts(6), cujos helpers materializavam somente um coordenador. Adaptados apenas os helpers locais para atravessar coordenadores reais, mantendo todas as asserções; sem mudar harness compartilhado. e7f3b4 EXIT0 dois arquivos19/19.
-Lint inicial900394 EXIT1: childrenprop de teste, leitura de refs no render e warning de cleanup. Controlador passou a token de ciclo somente em handler/efeito, normalizando resposta tardia antes do feedback do hook, sem ref lida no render.515323 EXIT0 controlador; lint final272d21 EXIT0 treze arquivos --max-warnings0.
-GREEN final pasta Inbox sessão18529/chunk2d9eb4 EXIT0:64 arquivos605/605,23,33s, configuração original Vitest, Node local heap512, um worker. Nenhum filtro de caso/skip novo; integração excluída pela configuração original. Aviso preexistente vite-tsconfig-paths preservado. É recorte de pasta, NÃO suíte global.

## Decisões e limites

ROOT aprovou inválidohaQuanto='', futuroagora, sanitização404 e feedbackirmão. Singular1dia é redação gramatical da mesma duração, sem regra nova de relógio. Revisão própria encontrou risco de remount por condicionar wrapper à capacidade e o removeu com teste de identidade do input e de ACKs tardios; não alegar inspeção independente. Transporte/erro tardios após capacidade recuperada também testados sem alerta nem tomada de foco; retry atual reconcilia.

Não houve DB/INT/lease, servidor/preview/browser/captura, migração/schema/install/generate/package/lock/env/cache, provider/mensagem real ou push/deploy. Servidor/ACL literal. Faixa347 runtime e freeze preservados; eventual correção347 do ROOT ainda precisa carry separado. Visual30cenas propostas no plano, QA independente, TSC original/global/CI, build e homologação pendentes. SPEC docs/specs/inbox-cabecalho-aria.md. ROOT integra/publica; issue permanece aberta.

## Adendo DS coordenado pelo ROOT

Após identificar guardas de botões no global347, ROOT autorizou variante canônica ia em Botao para348: bg-ai-50 text-ai-700 hover:bg-highlight. Não alterei guardas ou Faixa347. Devolver usa varianteia sem overrides de cor. REDbd85c8 EXIT1 Botao10 casos(2falhas/8controles); GREEN0c8b48 EXIT0 Botao+Devolver20/20. Lint DS final89af41 EXIT0 quinze arquivos --max-warnings0.

Replay final após DS: sessão83786/chunk807675 EXIT0,65 arquivos615/615 (pasta Inbox completa + Botao.test.ts),24,02s,w1/heap512/configuração original; logs inbox-348-inbox-ds-final-private.log/inbox-348-lint-ds-final-private.log. Ainda recorte, não global/INT. Sem alteração produtiva após esta execução. Whitelist final18arquivos, incluindo dois arquivos Botao. Revisão independente solicitada via ROOT/TESTER, respeitando doisDEVs+TESTER e worktree próprio.
