# Incremento 492 — ações e revisão de aditivos Q117

Data: 15/09/2026. O incremento anterior entregou persistência com testes reais de banco; foi progresso de implementação. Meta integral ativa.

## Implementação

As ações públicas `prepararAditivoContratual` e `decidirAditivoContratual` obtêm o autor da sessão e encaminham aos serviços transacionais, com nova conferência do papel vigente. Preparação/consulta exigem Secretaria ou Administração; a decisão positiva ou negativa exige outra pessoa da Administração.

As consultas autorizadas listam modelos publicados de aditivo compatíveis com o regime e histórico paginado da matrícula. Somente uma fonte assinada não conflitante habilita preparação. Os campos anteriores vêm do documento preservado. O detalhe é consultado por matrícula e proposta juntas, verifica o hash completo e apresenta apenas texto, alterações, autoria, vigência, ambiente e decisão, sem expor referências de fornecedor, evidências ou chaves internas.

O detalhe indica quando há proposta mais recente. Essa versão antiga pode ser rejeitada; a aprovação permanece bloqueada pelo serviço e pelo banco. Aprovação administrativa não conclui a formalização nem altera as condições da matrícula.

Telas adicionadas em `/matriculas/[id]/contrato/aditivos` e no detalhe da proposta, com acesso pela página contratual. Permitem selecionar modelo publicado, escolher condições estruturadas a alterar, informar novos valores/motivo/vigência e registrar a proposta. A revisão exibe conteúdo projetado, valores anteriores/novos, autoria, ambiente e decisão. Há links distintos para o original preservado e o documento assinado, ambos em rotas privadas existentes. Não há edição livre de cláusulas nem botão de assinatura ou aplicação indisponível.

O fuso do navegador é identificado após a hidratação, evitando divergência de texto entre servidor e cliente. O instante informado é convertido e preservado; histórico mostra UTC explicitamente. Repetir o mesmo conteúdo usa a mesma chave idempotente; alteração após tentativa usa outra. Falha de transporte informa que o resultado precisa ser conferido e permite repetir a mesma tentativa. A decisão exige confirmação de revisão, motivo e outro administrador; proposta superada habilita somente rejeição.

## Validação e limites

Primeira rodada: oito testes de integração aprovados em `docs/validacao-acoes-aditivo-492-2026-09-15.json`, incluindo consultas/ações autorizadas, identidade da matrícula, projeção sem dados internos e recusa a vendedor, professor, Gerência Pedagógica, Financeiro e conta revogada. TypeScript e lint das ações aprovados.

Rodada final: **9/9 integrações aprovadas** em `docs/validacao-acoes-aditivo-final-492-2026-09-15.json`, incluindo paginação de 21 propostas sem perda/duplicidade, versão superada e vínculo do documento assinado retornado pelo detalhe. TypeScript e lint finais aprovados. Build final concluído com sucesso em `docs/validacao-build-final-492-2026-09-15.log`. A revisão de UI foi por código e compilação; não houve homologação visual/interação em navegador nesta rodada.

Não há assinatura ou aplicação contratual nesta entrega. Persistência de PDF próprio, signatários, alçadas específicas, assinatura/conferência, cadeia de aditivos aplicados e aplicação continuam pendentes. A base atual exige condições estruturadas no original; ausência exige conferência. Os testes de assinatura são simulados e identificados como SANDBOX. Nenhuma operação em produção ou envio externo.
