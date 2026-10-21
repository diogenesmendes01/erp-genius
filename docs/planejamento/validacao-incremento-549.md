# Incremento 549 — resultados no portal após encerramento

Os cenários de recuperação preparada antes e depois do encerramento agora conferem a projeção de resultados do portal. A nota submetida ainda não aprovada não aparece como oficial. Após a conferência independente, o histórico do vínculo encerrado apresenta a nota, o comentário destinado ao aluno e o consolidado atualizado, mantendo a indicação de resultado parcial.

Os testes também verificam que a resposta não expõe referências internas da autorização, hashes ou justificativa administrativa e que outra identidade de aluno não recebe as matrículas testadas. Matrícula e alocação continuam comparadas integralmente com seus estados encerrados.

Dois testes integrados aprovados, zero falhas, 92 não selecionados (`docs/validacao-portal-encerramento-549-2026-09-15.json`). ESLint e TypeScript aprovados. A chamada utiliza identidade de sessão injetada no serviço interno para testar escopo e projeção; não comprova autenticação HTTP, navegação ou login real do portal.

Sem alteração de código de produção neste incremento. A validação interativa e a auditoria integral da Q151 continuam pendentes. Não houve acesso a dados reais ou envio externo.

## Auditoria Terra e encaminhamento

Lacuna confirmada: plano aprovado antes da pausa, sem disponibilização, não pode receber autorização de preparação retroativamente porque a proposta é imutável. O serviço de disponibilização exige matrícula ativa quando a proposta não contém essa referência. As autorizações de reserva/realização dependem de disponibilização. Refazer proposta é possível, mas não atende diretamente à continuação da pendência aprovada. Implementar autorização delimitada à disponibilização do plano existente, preservando decisão e documento originais, é o próximo caminho a completar.

Diferença a harmonizar: autorização de preparação/reserva compara o status atual com o status congelado; a de realização aceita histórico PAUSADA/ENCERRADA sem essa igualdade. A mudança de pausa para encerramento exige tratar o alcance da liberação expressamente, sem ampliar acesso por simples remoção de comparação. Não declarar equivalência entre as políticas atuais.

A auditoria apontou também autorização de realização concedida com prazo geral vencido e formulário disponível sem autorização atual. Esses dois achados exigem distinguir execução nova de registro de fato anterior: o formulário atual permite informar data histórica, e uma prorrogação própria pode alterar o prazo geral. Não remover esse caminho nem considerar autorização específica uma prorrogação implícita. A mensagem de impedimento atual existe; revisar a clareza da interface na validação interativa.
