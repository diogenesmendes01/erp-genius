# #344 — relatório DEV, marco 1 do tradutor SQL

Estado: somente o tradutor fechado e seu corpus de paridade foram implementados. A #344 completa NÃO está entregue. Agregado de sete chips, filtros antes da paginação, preferências da página, rota, SSR e InboxNovo aguardam revisão ROOT e GO dos marcos 2/3. [SPEC parcial](../docs/specs/inbox-contagens-aria.md).

Base 170edbadfdf35a93f5366ba504bb7870a1ebf0c1, branch codex/inbox-e3-344-contagens. ROOT preparou cliente próprio 490 e ciint491, snapshot de 502 registros/424 hashes, em 23fe3a EXIT0. Plano privado de 21.663 bytes/SHA e63a8f83 lido integralmente e aprovado para o marco 1; investigação independente T b197db8c foi referência. Nenhum helper de ACL/CRM, fonte da lista/API/InboxNovo, #342/#343/uso, schema ou dependência foi alterado. Sem migração, geração ou instalação.

## Entrega e corpus

whereAtendimentoEmSql é puro: converte o where produzido pelas fontes canônicas em Prisma.Sql, com registry privado de tabelas/campos/relações e validação de tipos/enum. Valores são bindings; identificadores são internos. Formato novo é recusado antes da execução SQL. Some/none e relações usam EXISTS correlacionado, sem multiplicação de linhas. A função não conhece papéis nem concede permissão; futuro consumidor precisa combinar escopo autorizado.

O arquivo UNIT próprio tem 26 casos, incluindo 256 combinações dos oito papéis em leitura e envio: 512 chamadas ao construtor canônico, sem banco. Não são 512 casos Vitest. Contexto com membro301 não é truncado. Parametrização, formatos/tipos/protótipos recusados, UTC explícito e busca canônica têm controles próprios.

O arquivo INT próprio tem 67 casos e compara os IDs de SQL com findMany Prisma sob o MESMO where. Inclui onze atores, leitura e envio; positivos e negativos não vazios; lógicos/NULL/NOT/is:null/some/none; buscas com acento, curingas, dígitos, aspas e barra; fim/revogação de convite e envio independente; posse atual de linha e carteira como vias independentes; cobertura/docente revogados; contexto real de 301 membros sem commit; pool1/rollback; comparação em UTC/São Paulo/Tokyo na mesma conexão, com restauração da TZ. Os três casos completos de escopo-transacao existentes também foram revalidados.

## TDD e negativos nominais preservados

- UNIT 5df3ca e INT bedd32: EXIT1 por módulo ausente, zero casos coletados. Não são provas de comportamento DB.
- Stub explícito: UNIT 890a44, 25/25 falhas; INT sessão30402/94f470, 49/49 falhas. Fixtures reais executaram antes de implementar o tradutor.
- Setup anterior 0dbc1b: EXIT1 com 49 ignorados, trigger pedagógico recusou contato de responsável sem autorização. A fixture foi corrigida para aluno direto com telefone/WhatsApp atuais e financeiro com matrícula/canal inativo. Não se desabilitou trigger ou fabricou atendimento financeiro novo sem matrícula.
- Primeiro tradutor: UNIT 21a967, 24/25; a falha era uma expectativa textual que não aceitava NOT (EXISTS). O oráculo foi ajustado para a mesma operação com parêntese, mantendo a paridade DB. INT sessão5170/b35c53, 47/49: divergência lógica real e expectativa de fixture que esquecia acesso por carteira.
- Lógica ampliada: sessão27236/e9fae7, 55/58; sessão74462/c89574, 60/65. Prisma trata OR:[] no topo como falso, mas poda grupos estruturalmente vazios dentro dos conectivos. AND:[{}, {OR:[]}] deve ser vazio, não FALSE. Os controles misturam predicados positivos para não mascarar divergências com um resultado já vazio. O tradutor valida todo filho antes da poda; o where canônico ficou intacto. Esse diagnóstico supera a hipótese inicial do plano para grupos vazios.
- GREEN causal: UNIT 80d22f, 26/26; INT sessão99195/ac62f5, 65/65, 11,03 s, ambos EXIT0.
- Controles adicionais: sessão29747/2097db, EXIT1, 69/70 nos dois arquivos. Paridade de NOT/relações e contexto301 passou; somente o controle positivo de busca tinha uma barra a menos e ambos SQL/Prisma retornavam vazio. Corrigido exclusivamente o literal do teste, sem alterar o tradutor. O run continua nominalmente negativo.

## Gates finais

| Gate | Sessão/terminal | Resultado |
| --- | --- | --- |
| UNIT relacionado completo | 32613/1d3b0f | Oito arquivos, 184 casos, 32,33 s, EXIT0 |
| INT relacionado completo | 71265/d0f988 | Dois arquivos, 70 casos, 23,72 s, EXIT0 |
| Lint dos três paths finais | a93b4f | EXIT0, sem aviso |
| TSC auxiliar final | 94659/c46e69 | EXIT0 |

Sem filtro por nome ou teste ignorado nos gates finais. Não se somam os 65/67/70 sobrepostos; a execução final contém 67 casos próprios e três do arquivo escopo-transacao. O UNIT relacionado terminou antes do último ajuste exclusivo do literal INT; produção e UNIT permaneceram byteiguais. Não é suíte global.

Comando UNIT: vitest run src/server/inbox/where-sql.test.ts src/server/whatsapp/escopo-atendimentos.test.ts src/server/whatsapp/escopo-setor.test.ts src/server/whatsapp/escopo.test.ts src/server/whatsapp/busca-inbox.test.ts src/server/crm/escopo-comercial-sql.test.ts src/server/inbox/filtros.test.ts src/app/enums-rotulos.test.ts --maxWorkers=2. Comando INT: vitest run --config vitest.integration.config.ts src/server/inbox/where-sql.int.test.ts src/server/whatsapp/escopo-transacao.int.test.ts --maxWorkers=1. Executáveis locais com Node22, uma suíte DB por vez e mesma sessão até terminal.

TSC auxiliar usa heap8192, --noEmit --incremental false e a configuração privada que estende a original, preservando includes/excludes e acrescentando SOMENTE os privados históricos output/inbox-326-a2-diagnostico-private.test.ts e output/inbox-326-package-r8-7a30d4-preservado-private/inbox-326-a2-diagnostico-private.test.ts. Todos os SRC/testes atuais entram. O TSC anterior 86646/c5144d saiu 0 antes da correção do literal final; não é reatribuído ao arquivo posterior. Nenhum TSC original/global deste worktree com privados é alegado verde.

## Fontes e limites

SHA256 GitLF/físico LF: where-sql.ts, 10.391 bytes, 94ab79b2674d9ee2e7b46f9e00a563981d6306ff5cc8c5968c55531962841abf; where-sql.test.ts, 3.249 bytes, 952e37de3c8165c9f1b6216108b71552ffb9a063eff14ea6e682f838f4970362; where-sql.int.test.ts, 13.320 bytes, 305b1eb6318b4976519cff7504182418034eeb37b99a72230f148133398666d9. Logs/ledger/provas permanecem privados, sem credenciais ou binários no commit.

O banco foi explicitamente liberado ao ROOT depois do último terminal DB. Nenhuma nova operação DB está autorizada ao DEV nesta entrega; restauro e sua constância serão responsabilidade ROOT. Sem mensagem/provedor externo ou nova UI. QA independente, revisão e demais marcos da #344 permanecem pendentes. Dependências #349/#351 têm suas próprias entregas; não se presume encerramento delas nem da #344 por este marco.


Restauro final confirmado pelo ROOT em d01e09, EXIT0: ciint491, 424 hashes, snapshot de 502 registros, fixture e sequências preservados, zero outras atividades. Nenhuma nova DB pelo DEV.

## Marco 2 — estado SQL e sete contagens, 24/10/2026

Base do delta: c9e710e35a56c9b64366c31b5d292f9b5ae8a516, no mesmo worktree/branch. ROOT leu integralmente QA do marco 1 (66ed1e5a/10519), aprovou o tradutor e preparou a lease exclusiva do ciint491 em 2a4d0a EXIT0, 424 hashes/502 registros. O corpus M1 e sua QA permanecem nominais; não se somam aos gates M2.

Dois módulos de produção novos, quatro arquivos de testes e uma fixture local: estado-aria-sql.ts/.test.ts/.int.test.ts; contagens.ts/.test.ts/.int.test.ts; contagens-fixture.int.ts. Nenhum arquivo de fonte existente mudou. Registry M1, #342/#343, helpers ACL/CRM/uso, lista, API, SSR, InboxNovo, schema e dependências permanecem idênticos. O contexto fica em contagens.ts e não importa consultas-pagina, evitando criar o ciclo discutido para a fase 3.

O contexto carrega situação, orçamento e ACL uma vez, no mesmo Db, sem H global. O agregado novo executa sete totais em uma query SQL, com H/S correlacionados e CASE equivalente à derivação342. COUNT bigint passa por validação de inteiro seguro. Não lidas usa EXISTS equivalente ao helper canônico, sem copiar ACL nem materializar IDs de atendimentos. Base retira aria/prazo/fila e mantém eu/ID/nãoLidas e os demais filtros. A nova resposta é produtor interno: consumidores do marco 3 ainda não recebem resumo.

### TDD e negativos M2

- UNIT 258da0 e INT 12a1ae: EXIT1 por módulos ausentes, zero casos coletados; não são provas DB.
- Stubs explícitos: UNIT c7d501, seis falhas/sete controles esperados em 13; INT sessão67325/2eb359, dois arquivos completos/20 falhas, 89,11 s, EXIT1. As fixtures A–G executaram com matrícula financeira válida e sem desativar guardas.
- Primeiro GREEN unitário 03c4c8: dois arquivos/13 casos, EXIT0. Integração sessão24679/30ab13: dois arquivos/20 casos, 19 passes/uma falha, 96,63 s, EXIT1. A falha era do oráculo: “Contato A” casa os sete nomes pela palavra “a” dentro de “Contato”, conforme whereBuscaConversas. A expectativa foi corrigida e acompanhada por controles de telefone único=1 e termo ausente=0. Não houve ajuste de produção para fazer o teste passar. Esse run não é reclassificado.
- O último delta foi exclusivamente no teste INT, incluindo também leitura pessoal em T/T+1. Produção e arquivos UNIT ficaram byteiguais. TSC anterior5527/7168e6 e lint anterior6cec6d eram verdes na versão anterior do teste, sem reatribuição.

### Gates finais M2

| Gate | Sessão/terminal | Resultado |
| --- | --- | --- |
| UNIT relacionado completo | 36424/142433 | Oito arquivos/219 casos, 28,19 s, EXIT0 |
| INT relacionado completo | 79338/8d4c6c | Três arquivos/38 casos, 184,28 s, EXIT0 |
| TSC auxiliar final | 8911/4b8c5f | EXIT0 |
| Lint dos sete paths | 861edb | EXIT0, sem aviso |

UNIT inclui estado-aria-sql.test, contagens.test, estado-aria.test, where-sql.test, aria/uso.test, aria/permissoes-tela.test, aria/turno/guardas.test e enums-rotulos.test, todos completos, maxWorkers=2. O comando final INT usa vitest.integration.config.ts, estado-aria-sql.int.test.ts (nove), contagens.int.test.ts (onze) e estado-aria.int.test.ts (18 preservados), maxWorkers=1. Cada sessão foi acompanhada até terminal. Sem filtro por nome ou teste ignorado. Não é global; não se somam recortes sobrepostos ou execuções independentes.

TSC com heap8192, --noEmit --incremental false, auxiliar privada que estende a configuração original e acrescenta somente os dois privados históricos autorizados já descritos no marco 1. Todos os SRC/testes atuais estão incluídos; nenhum TSC original/global deste worktree com privados é alegado verde. Executáveis locais Node22, sem instalação/generate.

O corpus real comprova Admin A–G=7 e FINANCEIRO=1; vendedor só B/D; fila/aria/prazo removidos da base mas eu/ID e não lidas mantidos; prioridade H/pausa/sugestão/global/responsável; campos null e estado bruto versus global efetivo; prazo estrito, primeira resposta e encerramento; contagem pessoal por usuário e igualdade da leitura; múltiplos filhos sem duplicar linhas; contexto reutilizado sem duplicar situação/orçamento/versão; uma query agregada; 301 handoffs adicionais sem cap; pool1, alterações não commitadas e rollback; três TZ com restauração. Grupo é um SELECT sintético porque o trigger impede a gravação dessa fixture.

SHA256 GitLF/físico LF dos módulos: estado-aria-sql.ts, 2.057 bytes, 45872a3f360b1466eb29290f9154c19271d333f4283211b0f02bbaff0ff075d2; contagens.ts, 5.922 bytes, 8587a003fcd82a005e31e3abf8da50d3ad57d91cdccefbb4cf521f74ae992f46. INT finais: estadoSQL cdaab115531e7d78642e875a87283f27bdeed5ac2ff2887e17389d4e086462a9 e contagens 9236ef84d7df24da8b26c4f2cfea36e32322f27db68de1953b9f1b0da53db925. Logs/ledger e recibo completo permanecem privados.

Banco explicitamente liberado após o último terminal. ROOT confirmou restauro 3564e1 EXIT0: ciint491, 424 hashes, snapshot502, fixture e sequências preservados, zero outras atividades. Nenhuma nova DB pelo DEV. QA independente, leitura ROOT e GO3 permanecem pendentes. Não há UI nova ou prova visual nova; não se publicou PR, não se alterou provider e a #344 continua parcial.
