# Incremento 464 — continuidade da reposição na classificação de ausência

Data: 15/09/2026. Meta integral ativa.

## Implementação

A correção entre FALTA e IMPEDIDO_POR_RESTRICAO mantém a necessidade de reposição. A revisão identifica pedidos já autorizados, ainda sem conclusão, que podem continuar quando ambas as classificações representam ausência. A publicação exige confirmação explícita da gestão e registra `continuidadeReposicoesAutorizadas` na aprovação e no evento, separadamente das conclusões preservadas.

Nenhuma autorização, agenda, prazo ou benefício é alterado pela confirmação. Ela não regulariza a frequência nem concede uma cota. Pedidos sem decisão e mudanças para PRESENTE continuam exigindo resolução própria quando não há conclusão efetiva preservável. Reenvio sem a confirmação originalmente usada é recusado.

## Validação

- TypeScript e lint direcionado aprovados.
- O processo anterior não estava mais disponível e não havia relatório de resultado. Banco descartável reiniciado; nova rodada Q23/progressão aprovada com 40 testes em `docs/validacao-continuidade-reposicao-q23-464-2026-09-15.json`. Build aprovado com 62 páginas, e `git diff --check` aprovado.
- Novos cenários exercitam FALTA → IMPEDIDO → FALTA para GRAVACAO e PARTICULAR, autorização intacta, confirmação obrigatória, repetição exata e ausência de conclusão/cobrança criada pela correção.

## Limites

Ainda falta resolver reposição autorizada não concluída quando a origem passa a PRESENTE, além dos efeitos financeiros. Esta etapa não cancela nem revoga atendimentos automaticamente. Sem deploy ou alteração em produção.
