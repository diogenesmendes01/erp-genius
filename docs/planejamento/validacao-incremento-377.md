# Incremento 377 — Propostas de substituição de avaliador

Propostas guardam encontro de origem, professor atual, substituto, motivo, versão e estado conferido. O servidor repete a conferência antes de persistir e recusa uma base desatualizada. Reenvio com a mesma chave e conteúdo retorna a proposta original; chave reutilizada com conteúdo diferente é recusada. O banco preserva a proposta contra edição e exclusão.

A consulta apresenta versões e fonte original, distingue revisão independente e informa impedimentos posteriores. Guardar proposta não altera o professor do encontro nem concede acesso ao substituto. Aprovação e aplicação estão na frente de implementação seguinte; não são comprovadas por estes testes.

## Evidência

81 testes de integração acadêmica aprovados, sem falhas ou testes omitidos, conforme `docs/validacao-proposta-substituicao-recuperacao-377-2026-09-14.json`. Os novos casos verificam reenvio, versão superada, imutabilidade, consulta por outra pessoa, isolamento de acesso, ausência aprovada após a conferência e inativação posterior do professor. Uma proposta pode conservar pendências para revisão, sem autorizar aplicação.

O banco descartável na porta 54329 estava parado na primeira tentativa. Foi iniciado pelo script do projeto e a execução completa posterior passou. TypeScript passou antes dos novos testes; a integração acima executou os testes adicionados. Build e homologação interativa deste incremento não estão declarados como concluídos.

## Organização da próxima entrega

Três subagentes Terra trabalham com responsabilidade separada: backend e integridade da decisão de substituição; interface de revisão e decisão; integração de reposições à frequência. O orquestrador integra as alterações e centraliza migrations e testes de integração, pois o banco de teste é compartilhado e suas suítes apagam as tabelas entre cenários. Nenhum trabalho autoriza produção ou envios externos.

O objetivo integral da SPEC permanece aberto. Estes resultados não representam validação de todos os requisitos do projeto.
