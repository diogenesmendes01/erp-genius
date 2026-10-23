# PR #297 — revisão de todos os comentários

Fonte de planejamento 8f42a15e6624f1f4967f79e7ed767f1bea87b7d3, composta sobre main 2f512985d182cd8c3d074bb3963ddbfa7da9fc98. O índice preserva os contratos históricos e aponta as decisões aprovadas como fonte vigente. Não marcar as81issues como entregues.

- C1: três labels do plano02 alinhadas a decisao-pendente do JSON; quebra final dos JSON normalizada. Cinco JSON válidos,81issues; nenhum item removido ou criado.
- C2: sete emails estáticos do protótipo trocados para example.com. Os dados são definidos no objeto literal do HTML; não houve consulta de cliente/banco/serviço. Referências PNG históricas já presentes na main foram preservadas byte a byte e não reatribuídas como novas capturas sanitizadas. Não afirmar auditoria de origem que não foi executada.
- C3: referência D1 agora cita capacidadesAria/capacidade decidirHistorico e caminho completo, sem número de linha.
- C4: avaliados 22 PNG/5383834 bytes já presentes na main. Não há adição de imagem, dependência ou carregamento externo novo no produto. As referências existentes continuam necessárias pelos links dos planos; remover quebraria a referência visual. As três dependências foram coordenadas pelo integrador na #392/B2, já main; esta PR preserva package/lock/eslint/scripts da main sem alteração.
- C5: reserva específica registrada no quadro e índice; IDs322 e337 explícitos, conferência de branches/worktrees/bancos e integrador obrigatórios. Faixa em documentação não é trava de unicidade.

Verificação de preparação: JSON/81issues/3labels/7emails/caminhos de símbolos e preservação de todos os objetos main fora do delta documental. QA independente, CI final no novo head e merge permanecem pendentes; não reatribuir CI do head antigo8f42. Nenhum teste de banco, seed, E2E, browser, instalação, geração Prisma ou serviço externo executado.
