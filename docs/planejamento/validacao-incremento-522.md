# Incremento 522 — reconferência e reprogramações sucessivas

15/09/2026. Continuação de FIN-02.2/Q158/Q159. Agentes Terra implementaram versões, ações e apresentação; o orquestrador revisou as proteções e testou os fluxos.

A mensalidade agora possui uma sequência de propostas imutáveis. Se uma aprovação ainda não aplicada ficar obsoleta por mudança financeira, contratual, da fonte ou conflito na cobertura futura, a equipe pode preparar nova proposta com memória atual, motivo, cláusula e escolha documentada. Outra pessoa precisa aprová-la. Criar a sucessora impede executar a autorização anterior; rejeitar a revisão não restaura a autorização antiga. Uma aprovação ainda válida não é substituída apenas pela troca da escolha.

Depois de uma aplicação de cobertura futura, uma nova indisponibilidade confirmada de todo o período reprogramado pode gerar outra regularização da mesma cobrança. Preservam-se as coberturas anteriores, decisões, aplicações e recebimentos. Cada decisão tem uma única aplicação. A aplicação final de crédito impede reabrir a obrigação ou reconhecer o mesmo crédito novamente.

O histórico mostra a versão e identifica propostas substituídas. Somente a versão vigente permite decisão ou aplicação. Repetir uma execução antiga já concluída retorna o registro histórico, sem retroceder a cobertura atual. A ficha financeira apresenta a aplicação mais recente; os detalhes conservam as anteriores.

## Validação

- Migrações 820 e 830 aplicadas somente ao banco descartável em localhost:54329. A primeira preenche versões e vínculos das propostas antigas em transação, mantendo seu conteúdo e reativando a proteção de imutabilidade. A segunda corrige a precedência de operadores JSONB identificada no teste de criação da segunda versão; a migração aplicada não foi reescrita.
- Dezoito integrações do período integral aprovadas, incluindo cinco cenários novos: aprovação obsoleta, conflito futuro posterior, duas reprogramações seguidas de crédito, rejeição sem restaurar aprovação anterior e bloqueio de mudança de escolha sem alteração da fonte, também no banco.
- Regressão conjunta de período integral, encerramento e fonte de compensação: 32 integrações aprovadas (`docs/validacao-integracao-522-2026-09-15.json`). Os dezoito casos acima estão incluídos nesse total.
- ESLint focado e build aprovados (`docs/validacao-build-522-2026-09-15.log`). A primeira compilação identificou um tipo JSON amplo demais na aplicação; passou a usar a fonte validada, de hash já conferido como igual à proposta preservada.

## Alcance e pendências

Resolvidas as duas lacunas operacionais documentadas no incremento 521: reconferência após mudança da fonte aprovada e regularização de outra indisponibilidade após reprogramação. Uma fonte que não esteja apta continua exigindo regularização antes da nova proposta; isso não cria escolha em nome do aluno nem dispensa aprovação.

A emissão mensal recorrente permanece em implementação. Q157, sobre retificação de relato confirmado, continua sem resposta. A interface ainda não teve ensaio interativo, conforme bloqueio de inicialização registrado no incremento 518. Nenhuma alteração em produção ou devolução externa. O objetivo integral da SPEC continua ativo.
