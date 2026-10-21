# Incremento 413 — versão validada e erro da listagem

2026-09-14. Portal agora associa a conclusão efetiva à entrega e sua versão, considerando a última correção aprovada. A tela marca exclusivamente essa versão como aprovada; versões anteriores e correções conservam suas próprias informações. Retirar a conclusão remove a marca de aprovação, sem apagar entregas.

O primeiro teste de integração encontrou uma falha anterior na listagem: a consulta ordenava `ReposicaoIndividual.criadoEm`, coluna inexistente. A coluna correta é `criadaEm`. Essa falha não era detectada por TypeScript ou build. Corrigida a consulta, o teste completo passou.

Evidência: `docs/validacao-entrega-validada-413-corrigido-2026-09-14.json`, um cenário com conclusão, correção para outra versão, retirada aprovada, lista/detalhe e preservação das duas entregas. A primeira execução falha está em `docs/validacao-entrega-validada-413-2026-09-14.json`. Não houve validação visual.

Regressão subsequente (414): **24/24** testes em quatro arquivos de conclusão no portal, entregas, relatos e permissões docentes. Relatório: `docs/validacao-portal-regressao-414-2026-09-14.json`. Inclui avaliação de entregas históricas após pausa/encerramento e retirada de conclusão sem restaurar data anulada. Esse resultado valida os fluxos selecionados, não o conjunto integral do produto.

Próxima correção de Q35: publicar ID de arquivo não comprova disponibilidade real; verificar leitura do Drive antes de iniciar a janela, revalidando os dados ao gravar. Q143 (resultados do aluno) em implementação. Q153 e Q154 continuam conforme [auditoria de progressão](auditoria-resultados-progressao-413.md). O escopo integral continua aberto.
