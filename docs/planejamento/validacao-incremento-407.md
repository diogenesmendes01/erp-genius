# Incremento 407 — integração do painel e prazo prorrogado

2026-09-14. Registro histórico de revisão; a correção e a integração subsequentes estão documentadas no [incremento 408](validacao-incremento-408.md).

## Evidência concluída

O build completo `node node_modules/next/dist/bin/next build` terminou com código 0, compilação, TypeScript e 61 páginas estáticas geradas. A execução ocorreu depois da integração SQL190 e antes da conclusão dos ajustes do painel e do cálculo de prorrogações. Não substitui validação visual nem testes dos ajustes posteriores.

## Lacuna identificada na revisão

Q58 também se aplica durante uma prorrogação. O cálculo anterior somava as interrupções ao prazo original e somente então escolhia o maior valor entre esse resultado e a prorrogação. Assim, uma interrupção iniciada depois do vencimento original, mas durante a prorrogação, não devolvia tempo ao aluno.

Exemplo: prazo original às 10h, prorrogado até 12h; material indisponível das 11h às 11h30. O resultado deve considerar a interrupção no prazo prorrogado. A solução precisa conservar a data/histórico da autorização para não somar de novo pausas já absorvidas na decisão de prorrogar.

Correção do cálculo e SQL incremental estão atribuídos ao agente de backend. Painel operacional está implementado e em revisão; testes de integração independentes estão em preparação. Nenhuma dessas frentes é considerada concluída neste registro. Reprodução Drive e demais requisitos da SPEC continuam pendentes.
