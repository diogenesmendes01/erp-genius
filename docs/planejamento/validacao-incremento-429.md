# Incremento 429 — regressão e coleta compartilhada do fechamento

Data: 14/09/2026. Meta integral ativa.

## Resultado

As seis falhas registradas na primeira regressão do incremento 428 foram corrigidas nas fixtures: fechamento preparado antes da revogação docente, bloqueio de vínculo legado sem matrícula, chamada comum da turma sem criar encontros adicionais e concorrência conferida na ordem real de locks matrícula/aluno. O cenário de releitura de professor sem agenda publicada conserva seu propósito; agenda publicada continua exigindo o fluxo aprovado.

Os módulos de consolidado e fechamento agora separam coleta interna de autorização. Os wrappers de gestão continuam bloqueando o contexto e conferindo o ator antes de coletar. O coletor exige contexto já bloqueado e autorizado na mesma transação; não recebe identidade sintética nem modo para dispensar autorização. Essa extração prepara a consulta própria do portal, que ainda não foi implementada. Regras e formato do snapshot/hash permanecem preservados.

O novo caso de recuperação posterior ao aproveitamento confirma que as fontes transferidas compõem a base da recuperação. Uma recuperação melhor altera o resultado; a tentativa posterior inferior conserva o melhor resultado e ambas ficam na memória, sem duplicar as fontes regulares.

## Evidências

83 integrações aprovadas, executadas serialmente no banco local descartável:

- Fluxo acadêmico: 63/63 — `docs/validacao-fluxo-progressao-428-corrigido-2026-09-14.json`.
- Visibilidade e progressão: 10/10 — `docs/validacao-coletores-progressao-429-2026-09-14.json`.
- Aproveitamento, cadeia de transferências e recuperação posterior: 4/4 — `docs/validacao-recuperacao-aproveitada-429-2026-09-14.json`.
- Fechamento e exceção de frequência: 6/6 — `docs/validacao-coletores-fechamento-429-2026-09-14.json`.

ESLint direcionado e build completo aprovados, incluindo TypeScript e 62 páginas estáticas. Não houve nova migração neste incremento.

## Trabalho restante

Implementar a projeção autenticada e a apresentação do fechamento no portal, com testes de isolamento e de fonte alterada. Completar resolução persistida das revisões após progressão executada, efeitos transitivos e correção aprovada da chamada concluída. Os demais requisitos da SPEC continuam sujeitos a implementação e comprovação próprias. Esta rodada não representa regressão integral do produto ou homologação em produção.
