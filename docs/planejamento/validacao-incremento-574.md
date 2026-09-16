# Incremento 574 — verificação abrangente e separação da SPEC

## Verificação

A suíte unitária completa passou: 1.111 testes, zero falhas e zero pendências. Evidência: `docs/validacao-unitaria-574-2026-09-15.json`.

Suíte de integração completa concluída com sucesso: 1.114 testes aprovados, zero falhas e zero pendências. Processo da sessão 83089 terminou com código 0. Evidência: `docs/validacao-integracao-completa-574-2026-09-15.json`; log em `docs/validacao-integracao-completa-574-2026-09-15.log`. O resultado cobre o código carregado nesta execução; não cobre a migration 121000 preparada posteriormente nem o novo fluxo de remarcação.

## Organização documental

A abertura histórica da SPEC foi movida integralmente para `historico-abertura-spec-erp-ate-573.md`. O corpo a partir de “1. Objetivo e alcance” foi comparado automaticamente e preservado sem alteração. Links relativos do trecho histórico foram ajustados ao novo diretório; não restam destinos locais ausentes na SPEC e no arquivo movido. A SPEC principal agora começa pelo título, diferencia comportamento requerido de evidência de implementação e oferece links para estado e histórico.

A mudança não declara implementados requisitos cuja execução ainda está pendente. O relatório consolidado ganhou uma entrada datada para localizar evidências atuais sem interpretar cada pendência histórica como presente. Nenhum histórico foi apagado.

## Pendências conhecidas

Q164 aguarda resposta. Permanecem proteção/alteração de encontros previstos, validação interativa de telas e integrações externas em operação. Esta lista não é auditoria completa de requisitos; não usar o resultado dos testes como percentual ou prova de conclusão da SPEC. A base real da escola não foi migrada e não houve implantação.

## Revisão de continuidade mensal durante a execução

Conferência de código e agente Terra: `src/server/matricula/continuidade-estado-tx.ts` ainda devolve `disponivel:false` e `podeEmitir:false`. Planejadores e prévia calculam cobertura/vencimento/antecedência, mas não existe emissor recorrente operacional. O gerador da ativação não substitui esse fluxo.

Q161 segue necessária para comprovar oferta positiva: `SEM_RELATO` em `indisponibilidade-oferta-estado.ts` não comprova disponibilidade. Q162 segue necessária para escolher referência de cobertura após compensação; a proteção atual apenas recusa sobreposição. O próximo emissor deverá revalidar matrícula, condições, preço, cobertura, oferta e compensações, com idempotência e memória aplicada. Não foi ligado um botão ou presumida uma decisão.
