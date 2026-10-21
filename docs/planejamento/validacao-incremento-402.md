# Incremento 402 — contexto do encontro de segunda chamada

2026-09-14. Migration189 aplicada ao banco de teste. Restrições anteriores exigiam turma XOR matrícula em qualquer encontro, incompatível com avaliação individual ligada à turma. A nova exceção de finalidade SEGUNDA_CHAMADA exige ambos; outras finalidades conservam a regra original. Guard adicional exige proposta aprovada e disponibilizada da mesma matrícula/turma.

Suite179 passou7/falhou1, relatório docs/validacao-segunda-chamada-402-2026-09-14.json. Após normalizar os relógios das fixtures para UTC, o teste isolado de realização alcançou a gravação da nota e identificou UPDATE de versão imutável. O agente está corrigindo para vincular a realização no INSERT inicial, sem relaxar imutabilidade. Essa correção ainda não foi validada.

Preparado docs/planejamento/reposicao-ciclo-integracao.sql: DDL185 gerado pelo Prisma mais checks e guards revisados; ainda fora de migrations. Ações/UI185 foram entregues pelo agente e aguardam integração e testes. Não afirmar esses fluxos concluídos.
