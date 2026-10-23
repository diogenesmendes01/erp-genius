# #336 — checkpoint de implementação e verificação

Base: `4c76d200257ea4c3df3707e95100d9180a9efdbc`. Branch própria `codex/inbox-e2-336`, Node 22 local, cliente Prisma 487 preparado pelo integrador. Perfil de integração autorizado: `ci-integracao`; banco B490/snapshot337 não foi acessado. Nenhum install, DDL, generate, servidor, browser, envio ou alteração de dependências/harness pelo DEV.

## Mudança

Produtor individual de atalhos e resolução B2B paginada, ligações de páginas autorizadas com FunilCliente, links em Funil/Tarefas/Contatos/Aria e projeção do atendimentoId no histórico existente. Contrato e limites em `docs/specs/inbox-atalhos-entrada.md`. Os exports/actions/formulários CRM e `src/server/crm/contatos.ts` foram preservados.

A coordenação aprovou lote B2B sem N+1: páginas de 100, escopo uma vez por operação, ordem SQL data/ID, sem cap global, mesmo cliente db/tx. A leitura read-only não se torna permissão de envio. Agendar é link para consumidor E4 pendente.

## TDD e negativos preservados

| Execução | Resultado observado | Classificação |
| --- | --- | --- |
| f0b4af | exit 1, 13 falhas / 28 pass em 5 arquivos | RED causal: 6 asserts dos links e 7 do produtor ausente |
| 9edd66 | exit 1, 40 pass / 1 fail | Oráculo novo de Aria também encontrou opção de filtro preexistente “Agendar mensagem”; corrigido para testar links, sem produto |
| dae552 | exit 0, 5 arquivos / 41 testes | GREEN individual e componentes |
| 72065 | exit 1, 12 falhas | Fixture usava campo inexistente statusSessao; enum/campo reais são sessao DESCONECTADO. Não conta como RED de feature |
| 56090 | exit 1, 8 pass / 4 fail | 3 REDs causais do lote ausente; 1 premissa de fixture de fila comercial, corrigida atribuindo responsável explícito, sem mudar ACL |
| 856b81 | exit 1, 7 pass / 3 fail | RED unit causal: lote ausente e ponte FunilCliente sem repasse |
| aeb64a | exit 0, 6 arquivos / 44 testes | GREEN lote, ponte e componentes |
| 394507 | exit 1, 18 pass / 3 fail | RED causal dos três callers: consulta/repasse ausentes após autorização |
| b8edf3 | exit 1, 1 fail / 15 filtrados | RED B2B real: href do interlocutor ainda null |
| 1ece9d | exit 0, 9 arquivos / 65 testes | GREEN dos callers e contratos de UI/produtor |
| 71440 | exit 1, 35 pass / 3 fail em 38 | Expectativas D13 antigas ainda esperavam null no único interlocutor autorizado. Atualizadas para href; pessoa sem conversa e negativas de acesso mantidas |
| 13635 | exit 2 | Dois tipos da nova fixture FunilCliente e tipo Next legado337. Fixture corrigida; produto/guardas intactos |
| 40436 | exit 2 | Backup dos tipos Next movido a output com extensão .ts entrou no glob; somente ambiente gerado, nenhum erro src |

Logs privados correspondentes permanecem em `output/inbox-336-*-private.log`. Não são artefatos de publicação nem novas provas de fonte futura.

## Gates finais

- UNIT sessão 11907, chunk e8ffb6: exit 0, **33 arquivos / 363 testes**, 21,09 s. Áreas completas Funil/Contatos/Tarefas/Aria, atalhos, escopo, encoder e guardas botões/identificação/confirmações/tipografia. Sem filtro de nome ou skips novos; é recorte, não suíte global.
- INT sessão 54219, chunk 4c5a65: exit 0, **3 arquivos / 38 testes**, 138,50 s, maxWorkers 1. Arquivos completos `atalhos.int.test.ts` (12), `aria/consultas.int.test.ts` (10) e `painel-detalhes.int.test.ts` (16), sem filtros/skips novos.
- Lint final chunk 94351a: exit 0, 23 arquivos afetados, `--max-warnings=0`.
- TSC final sessão 98658, chunk 73fe76: exit 0, heap 8192, sem diagnóstico. Fonte executável igual à dos gates finais acima.

As provas incluem prioridade explícita/lead/pessoa/encerrado, NULLS LAST e desempate SQL, convite vigente/revogado/expirado, papel negado, grupo sem atendimento, mudança de dono da linha, candidato invisível mais novo, mais de 100 candidatos de outra pessoa, lote sem query por participante, mesma transação com pool 1, links codificados e contrato de props opcionais.

## Comandos principais

```powershell
& 'C:/Users/Mendes/AppData/Local/hermes/node/node.exe' node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/atalhos.int.test.ts src/server/aria/consultas.int.test.ts src/server/inbox/painel-detalhes.int.test.ts --maxWorkers=1
& 'C:/Users/Mendes/AppData/Local/hermes/node/node.exe' node_modules/vitest/vitest.mjs run 'src/app/(app)/funil/' 'src/app/(app)/contatos/' 'src/app/(app)/tarefas/' 'src/app/(app)/aria/' src/server/inbox/atalhos.test.ts src/server/whatsapp/escopo.test.ts src/server/whatsapp/escopo-atendimentos.test.ts src/server/whatsapp/escopo-setor.test.ts src/lib/href-conversa.test.ts src/app/botoes.test.ts src/app/identificacao-registro.test.ts src/app/confirmacoes.test.ts src/app/tipografia.test.ts --maxWorkers=2
& 'C:/Users/Mendes/AppData/Local/hermes/node/node.exe' --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --incremental
```

## Ambiente e pendências

ROOT preparou Prisma487 (17202/03d093, saída 0), validou cliente próprio/perfil (9c5eca, saída 0) e concedeu lease exclusiva ci-integracao após restauro 2dd656. Tipos Next antigos foram preservados pelo ROOT (bb7812) e typegen realizado (f77744), ambos saída 0; a extensão do backup ainda precisou correção antes de novo TSC. ROOT d2c168 terminou 0 preservando os quatro arquivos byte/hash idênticos como .ts.txt e manifesto, sem alterar tsconfig/src; o TSC final 98658 então terminou 0.

Banco liberado ao ROOT após o terminal 54219. ROOT confirmou restauro ci-integracao 368489 terminal 0, 424 hashes do snapshot preservados. A tentativa anterior 0f843e abortou antes de conectar por guarda de âncora de perfil; não é restauro aprovado nem erro do produto. Visual real app-only entrada-funil/tarefas/contatos/agente (dois temas, desktop e mobile), navegação real ao Inbox, QA independente e global integrado ainda pendentes. Só integrador publica após #335 main. Nenhum PNG novo e nenhum estado compartilhado do harness editado.
