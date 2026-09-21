# Incremento 493 — PDF privado da prévia de aditivo Q117

Data: 15/09/2026. O incremento anterior entregou ações e telas com testes e build; foi progresso de implementação. Meta integral ativa.

## Implementação

O detalhe da proposta oferece uma prévia em PDF baseada somente no conteúdo preservado. O gerador reutiliza a infraestrutura de fontes, paginação e integridade do PDF contratual, com entrada própria de aditivo: versão da proposta, versão do modelo e referência de integridade. Não utiliza uma versão fictícia de condições de entrada.

Todas as páginas trazem “PRÉVIA DE ADITIVO - SEM ASSINATURA”; dados SANDBOX acrescentam “AMBIENTE DE TESTE”. O documento é determinístico para a mesma proposta e não cria assinatura, aprovação, artefato definitivo ou aplicação. O original assinado permanece separado da prévia.

A rota `/api/matriculas/[id]/aditivos/[propostaId]/previa-pdf` exige sessão e papel vigente, consulta matrícula/proposta conjuntamente e valida o hash canônico antes de gerar. Retorna PDF privado com `no-store`, `nosniff` e restrição de enquadramento à própria origem. Não permite que o navegador forneça conteúdo ou identidade de autor. Renderização ocorre fora da transação, após carregar fatos imutáveis.

## Validação

- Unitários: `docs/validacao-unitarios-pdf-aditivo-493-2026-09-15.json`, 15 testes aprovados de PDF de aditivo, PDF anterior e projeção de conteúdo.
- A primeira integração encontrou apenas expectativa incorreta do teste: conta desativada retorna 401 porque o guard invalida a sessão, em vez de 403. Código de autorização mantido; expectativa corrigida. O relatório inicial permanece em `docs/validacao-pdf-aditivo-493-2026-09-15.json`.
- Integração final: `docs/validacao-pdf-aditivo-final-493-2026-09-15.json`, **10/10 testes aprovados**, incluindo 401/403/404/200 da rota, `no-store`, reprodução idêntica e ausência de efeitos de formalização. TypeScript e lint aprovados. Build concluído com sucesso em `docs/validacao-build-493-2026-09-15.log`.
- Amostra fictícia de quatro páginas em `output/pdf/previa-aditivo-demonstracao.pdf`, gerada por `scripts/validar-pdf-aditivo.ts`. Poppler renderizou todas as páginas, inspecionadas visualmente; acentos, referências, cabeçalhos, rodapés, continuidade e trecho final legíveis. Evidência: `docs/validacao-visual-pdf-aditivo-493-2026-09-15.json`.

## Limites

Este PDF é para revisão e não é o original destinado à assinatura. Bytes definitivos do aditivo, conferência dos signatários, alçadas aplicáveis, processo externo, assinatura, conferência da Secretaria e aplicação seguem pendentes. A amostra contém somente dados fictícios. Não houve envio externo, contratação ou alteração do banco neste incremento. A inspeção visual cobriu o PDF, não a interação das telas no navegador.
