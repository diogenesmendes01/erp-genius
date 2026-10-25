# QA DEV A — candidata #333

Base eed1cce14fcd3390a8db521f1c03d45819425167 (PR #440); branch codex/inbox-e2-333-atividade. Implementação somente #333, sem #334 e sem correção #331. Candidata para revisão, não homologada. Plano curto privado: output/inbox-333-plano-dev-a-private.md, SHA256 84ebd8683d07571ee46136153cabcc8ad6271bae14e557612f602a5e2f7b05c0. D11 foi corrigido ao contrato vigente informado pelo ROOT.

## Terminais e negativos

| Recorte | Sessão / terminal | Resultado real |
| --- | --- | --- |
| Política pura ausente | 2a8cc4 | EXIT1, módulo ausente, zero casos; não RED comportamental |
| Política pura | 99659c | EXIT0, 1 arquivo/10 testes |
| Produtor ausente | 7bb08c | EXIT1, módulo ausente, zero casos |
| Produtor primeira rodada | 75184 / d08c44 | EXIT1, 1 falha/2 controles: fixture financeira sem matrícula; constraint correta |
| Produtor após fixture válida fora do escopo | 36223 / 1583d8 | EXIT0, 1 arquivo/3 casos, 14,32s |
| Action pública ausente | 69524 / da2b7f | EXIT1, 6 casos por função ausente |
| Action real inicial | 74150 / 662e51 | EXIT0, 1 arquivo/6 casos, 24,69s |
| UI ausente | ccdfac | EXIT1, dois módulos ausentes, zero casos |
| UI primeiro harness | 90499 / b9ea55 | EXIT1, 4 falhas/6 controles; handler de teste aguardava promise deliberadamente pendente dentro de act |
| UI com disparo de evento correto | 28c70c | EXIT0, 2 arquivos/10 casos |
| Adversariais SQL iniciais | 22393 / 9b0563 | EXIT1, 1 falha/11 controles; trocar só linha mantinha acesso pela carteira, conforme o OR real do escopo |
| SQL após perda de todos os ramos de acesso | 23216 / 8511a9 | EXIT0, 2 arquivos/15 casos, 61,58s |
| Wiring antes da implementação | bcb5b6 | EXIT1, 4 falhas/121 controles, 3 arquivos/125 casos |
| Wiring aditivo e expectativas antigas | ed7b6d | EXIT1, 1 falha/124 controles; expectativa antiga de duas abas atualizada com Atividade |
| Guardas e consumidores iniciais | 23820 / fdd672 | EXIT1, 1 falha/550 controles, 14 arquivos/551 casos; registro nominal de vazio faltava |
| Medida de BotaoIcone | 76340a | EXIT1, 1 falha/4 controles; medida32 não existe no primitivo, substituída por34 sem expandir DS |
| Prévia da confirmação atualizada | 6959cb | EXIT1, 1 falha/7 controles; prévia mantinha texto anterior ao refresh |
| SQL final ampliada | 91763 / 59c901 | **EXIT0, 2 arquivos/23 testes, 89,91s** |
| Recorte amplo antes de ajustar duas expectativas | 61227 / 37f6c9 | EXIT1, 2 falhas/739 controles, 27 arquivos/741 casos; só tabs antigas em InboxNovo.detalhes.test.ts |

Os casos adicionados depois do núcleo mínimo são regressões adversariais, não reivindicados como RED causal anterior. As mudanças de fixtures preservaram os contratos de matrícula e de acesso por linha OU carteira, sem afrouxar assertivas de produto ou modificar permissões. A correção de harness não alterou implementação. Parser/regex/listas gerais das guardas permaneceram literais.

## SQL nativa e concorrência

Lease exclusiva dev-email492 concedida pelo ROOT após restauração aaf871 do snapshot com 558 originais/424 tabelas e hashes. Configuração original vitest.integration.config.ts, perfil próprio, UTC, um worker e heap1024. Sete flags externas vazias: MOTOR_URL, MOTOR_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, WA_LIVE, MOTOR_TOKEN, WHATSAPP_API_KEY. Uma integração por vez, sem filtro de caso ou skip na rodada final. Nenhum provider/dispatcher real foi acionado.

Os 23 casos finais exercitam produtor e action pública reais: três estados/origens e filtros de régua/agenda, autores e tarefas com ACL própria, conversas fora do escopo excluídas, convidado sem tarefas.ver, leitura em encerrado, cancelar sem Assumir, IA apenas Admin, compatibilidade HUMANO do CRM e quatro outras origens no novo contexto.

Barreiras usam transações SQL reais, locks e observação de pg_stat_activity após pg_stat_clear_snapshot. Incluem revogação de papel/inatividade, perda total de carteira + linha, convite revogado, retarget de intenção, claim ENVIANDO vencedor e duas chamadas efetivamente bloqueadas antes de liberar o atendimento. Todas as liberações e promessas são drenadas em finally. Não são spies rotulados como concorrência e não provam ausência geral de deadlocks.

Pool1 usa cliente próprio com uma conexão e falha se o helper tentar transação no cliente global. NOTIFY é medido por pg.Client LISTEN real: um aviso no commit, nenhum novo no replay e nenhum no rollback depois de aviso já emitido dentro da transação. Falhas de Evento/aviso injetadas provam rollback de status e auditoria; essas injeções são distinguíveis das barreiras SQL reais. Cancelar não muda AcaoAgenteIA.

Lease liberada explicitamente ao ROOT após terminal 59c901; não houve nova SQL. A restauração final é exclusiva do ROOT e precisa de recibo próprio, não é presumida por este relatório.

## UI, registros e pendências

React DOM real com ConfirmarAcao/Modal reais; mocks só na action e nos glifos do DOM mínimo. SSR usa ícones reais. Controles: abrir/Voltar sem chamada, perigo e clique duplo, erro de negócio/transporte sem retry automático, SSE próprio antes do ACK, A→B→A, permissão revogada/recuperada, alvo removido antes do clique e texto fresco sem remontagem. Roteamento Atividade em Comercial e Secretaria não depende de tarefas.ver/envio; a ação mantém sua ACL.

Registro fechado novo: AgendadasAtividade.tsx → cancelarAgendadaNoInbox no ConfirmarAcao, achado Inbox-E2.13-D11, cópia literal correspondente. Estado vazio compacto AbaAtividade: Nenhuma nota interna ainda. Nenhum parser, exceção geral, paleta ou rótulo central foi ampliado. CRM global, ações WhatsApp, histórico Aria, Modal331 e ConfirmarAcao continuam sem diff da base.

Pendentes até terminais próprios: recorte final completo e lint whitelist; após freeze, TSC e UNIT global originais sequenciais autorizados pelo ROOT; QA independente; CI/build e visual painel-atividade/painel-atividade-agendadas em APP/PROTO original: 1440×900, 1024×768 e 390×844, nos temas claro e escuro. Revisão PR439 C3/C5 fica separada, sem patch de331 nesta candidata. Nenhum aceite visual ou homologação é reivindicado por testes DOM/SSR.

## Fechamento dos recortes

UNIT final: sessão45702/terminalfc53cd EXIT0,27 arquivos741 testes,103,34s,UTC/um worker/heap2048,sem filtros ou skips. Inclui consumidores atuais, Modal e ConfirmarAcao reais, roteamento e guardas completas de botões, enums, paleta, anúncios, actions, formulários, confirmações, vazio, identificação, design system, fundo, contraste e tipografia. Totais anteriores se sobrepõem e não são testes únicos somáveis. Lint whitelist21: terminalb31ed5 EXIT0 com --max-warnings=0; lista exata privada em output/inbox-333-lint-whitelist-private.json.

A confirmação passou também no RED de texto fresco e, depois, no recorte final sem remontar. Guardas receberam somente registro de vazio e novo callsite de confirmação/copiação literal; tamanho34 usa primitivo existente. CabecalhoConversa está reservado ao ROOT e permanece fora desta whitelist, assim como Modal331 C3. O próximo passo autorizado é freeze, seguido de TypeScript e UNIT global originais no SHA exato, em série. Nenhuma aprovação original é presumida por estes recortes.