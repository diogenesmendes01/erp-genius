# QA DEV A — revisão #439 C3, ModalTarefa

Base publicada bbdd7549782ff4263550dbe27278a09cba354082, branch codex/inbox-439-c3-modal-tarefa. Refs #334 e f347 preservadas, sem mistura. Triagem independente consultada por leitura: inbox-438-439-440-triage-tester.md, SHA256 b12ccffc93ea8e853541e2466ddf0d647a2f48a76ed3f5c931a094d7c3a2202e. Issue #331 real e mapas atuais relidos antes do patch. Revisões #438, C5 de fuso e outras decisões não foram reabertas.

## Mudança e limites

Produção restrita a ModalTarefa.tsx: mapa exaustivo TipoTarefa para cinco ícones Tabler genéricos decorativos; bloco Responsável inteiro por podeAtribuirResponsavel; quatro rótulos locais de lembrete alinhados. Não há ícone de marca, predicado por tamanho de lista ou fallback readonly enganoso. Seleção, aria-pressed, state, payload, values e CAS preservados. Nenhum campo D10 novo, backend/CRM, label central, DS, parser, exceção, configuração ou dependência alterados.

## TDD e validação

Memória medida antes do primeiro Node: 6,77 GB livres/63,16, sessão 92198/1a747b EXIT 0. Todos os executores usam Node local, UTC, maxWorkers=1 e heap 1024; sem TSC, build, SQL ou instalação.

RED 6d75f9 EXIT 1: um arquivo, 30 testes, 8 falhas/22 controles. Falhas correspondem aos cinco ícones ausentes, dois controles de bloco Responsável indevido e rótulos de lembrete divergentes. GREEN 9cebb0 EXIT 0: 30/30 após patch.

Casos novos verificam ícone genérico e aria-hidden em cada tipo, seleção real e tipo enviado, ausência de marca, capacidade falsa com lista preenchida e responsável de outro usuário, capacidade verdadeira com lista vazia, null explícito e default da criação preservados. Todos os lembretes mantêm os cinco valores de entrada. Edição de título com responsável oculto não envia mudança de atribuição.

SSR usa renderToStaticMarkup real e cobre o estado inicial: carregamento canônico e região status presentes, nenhum formulário/Responsável presumido antes do DTO e nenhuma consulta disparada no servidor. Formulário carregado é verificado com React DOM e harness mínimo, sem mock de hooks ou Modal. Isso não é captura visual de navegador.

Recorte final 85552/61c458 EXIT 0: 17 arquivos completos, 662 testes, 92,39 s. Lint e433a8 EXIT 0: 2 arquivos, --max-warnings=0, zero avisos. Configuração original, UTC/w1/heap1024, sem filtros por nome/skips. Não somar recortes sobrepostos como testes únicos. Nenhuma SQL repetida porque o delta é somente apresentação; backend e contratos serão conferidos por literalidade da base. Gates originais, QA independente da filha e visual tarefa-nova/tarefa-editar APP/PROTO permanecem com o ROOT, sem homologação presumida.
## R7 — mock fechado dos eventos do Inbox

O global32c048c01 detectou16 falhas de importação em InboxNovo.aria-eventos.test.ts: o mock fechado de Tabler não expunha IconMessageCircle, IconMail, IconCalendar e IconCircleDot, usados pelo novo registro exaustivo do Modal. Foram acrescentados somente esses quatro exports ao mock; runtime e asserções dos eventos permanecem intactos. Recorte1fd562 EXIT0:5 arquivos completos/66 testes, incluindo todos os16 de eventos. Nenhuma exceção/parser/proxy genérico. O global anterior continua negativo nominal; novo global/build/visual pendentes.
