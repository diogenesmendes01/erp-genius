# Incremento 606 — emissão de continuidade mensal

16/09/2026. Objetivo integral permanece em andamento.

## Implementação

Executor transacional interno em `src/server/matricula/continuidade-emissao-tx.ts`. Recebe matrícula e cobrança anterior esperada; bloqueia calendário, matrícula e âncora, recarrega contrato, preço, cobertura, compensação, prazo e comprovação de oferta. Só emite com marco alcançado, ausência de relato impeditivo e prova pela agenda ou confirmação independente vigente da gestão. Não presume recebimento nem envia mensagem.

O registro `EmissaoContinuidadeMensal` preserva cobrança anterior/nova, período, marco de emissão, memória de preço, condições, oferta e hash. Unicidade por matrícula/âncora e matrícula/cobertura evita duplicação; repetir a mesma âncora retorna a emissão anterior, mesmo depois de chegar outro mês. Cobrança, memória e evento são gravados juntos. O vencimento civil é convertido no fuso institucional; horário inexistente/ambíguo exige conferência.

A migração 143 foi verificada com BEGIN/ROLLBACK e aplicada apenas ao banco descartável `localhost:54329/erp_genius_test`. Inclui FKs por matrícula, unicidade, memória imutável e conferência de tipo, valores, cobertura consecutiva e ausência de sobreposição. O SQL não replica toda a avaliação contratual e pedagógica do executor. Migração congelada; próxima 144.

A rotina `continuidade-emissao-cron.ts` percorre páginas de 50 matrículas ativas mensais, sem limitar a rodada à primeira página, e tenta um novo período por matrícula. Distingue emissão nova, repetição, pendência de regra e falha técnica. A rota POST `/api/financeiro/continuidade/cron` exige `x-cron-secret` compatível com `CRON_SECRET` e `CONTINUIDADE_MENSAL_EMISSAO_ENABLED=true`. O padrão permanece desligado. Nenhum agendamento externo foi criado ou acionado.

## Revisão de Q161 e Q162

Encontros são interpretados como intervalos com fim exclusivo: terminar à meia-noite não ocupa o dia seguinte. A prova automática exige calendário vigente compatível com a grade. A confirmação positiva preserva também a versão vigente do calendário, inclusive quando não há vínculo suficiente, impedindo reaproveitar o mesmo hash após nova publicação.

A origem aplicada de Q162 passa por conferência de ajustes posteriores Q66/Q159 de toda a matrícula, além da última cobrança. Combinações sem precedência definida continuam em conferência. O cálculo mantém o novo ciclo sem sobreposição; esta entrega não resolve todas as combinações de recomposição, pausa e regularização integral.

## Validação

- **59 cenários integrados distintos aprovados**: 36 de aditivos/continuidade, seis de confirmação positiva, 14 de agenda e três de compensação. A primeira rodada teve 58/59; o cenário novo deixou a sessão do administrador ativa ao retornar à fixture que esperava a secretaria. Corrigida a restauração da sessão, a suíte de 36 passou integralmente. Evidências: `docs/validacao-integrada-606-2026-09-16.json` e `docs/validacao-integrada-final-606-2026-09-16.json`. Não somar as repetições como cenários distintos.
- A integração adicional confirma duas transações concorrentes para a mesma âncora gerando apenas uma cobrança; memória imutável; preço contratado; bloqueios antes do marco e sem oferta; replay tardio que não avança silenciosamente outro período; dezembro exige comprovação própria. Não fabrica recebimento.
- **46 testes unitários/SSR aprovados**, em `docs/validacao-unitaria-606-2026-09-16.json`; após ajuste final do cursor vazio, os dois testes do runner passaram novamente (`docs/validacao-runner-final-606-2026-09-16.json`).
- TypeScript, ESLint dos arquivos alterados e build Next passaram. Logs: `docs/validacao-tipos-final-606-2026-09-16.log`, `docs/validacao-lint-606-2026-09-16.log`, `docs/validacao-build-606-2026-09-16.log`.
- Os testes de calendário verificam fim exclusivo e a mudança de versão vigente no hash. Os testes de origem Q162 verificam conflito posterior em outra cobrança da mesma matrícula.

## Limites

Não houve produção, importação de planilhas, envio real de mensagem, cobrança externa nem homologação interativa. O serviço de assinatura continua simulado nos testes de contrato: o nome da fixture PRODUCAO_MENSAL não indica operação externa. A liberação operacional exige configurar e validar o agendamento, monitorar falhas e conferir os dados contratuais reais.

A integração de emissão exercita uma matrícula mensal estruturada, preço por aditivo e confirmação positiva da gestão. A comprovação automática de agenda tem testes próprios, incluindo banco real. Q162 possui testes de cálculo/fonte aplicada, mas ainda não um cenário integrado completo de emissão com recomposição e todos os dados contratuais. Projeções de agenda insuficiente não representam cópia integral de todas as tabelas; alterações fora da projeção podem não invalidar a confirmação.

Condições legadas sem preparação comercial suficiente continuam exigindo conferência. A prévia permanece somente leitura, sem conceder autorização de emissão ao cliente.
