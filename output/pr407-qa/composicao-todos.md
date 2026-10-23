# PR #407 — fundações do Inbox e todos os comentários

Fonte57530e8c3fc298400b63f0fc0fd22c4919ea97fb, pais3258ff4e (publicação321) e40621979a82. A composição acrescenta somente os seis caminhos próprios da321 sobre o pai406: aviso.ts/INT, permissoes.ts/teste, aria/permissoes-tela.ts e whatsapp/acoes-atendimento.ts. Todos têm OIDs iguais3258; nenhum produtor foi reimplementado no merge. Nenhum schema ou DDL322/323 foi antecipado.

B1 BLOCKER: o contrato ItemEstadoCabecalho/Pick ee565ffc e o harness moderno164capturas são preservados integralmente do pai406, assim como package/lock/guardas, QA280, planejamento297 e autorização humana de merge. A linha38capturas da main parcial antiga não foi restaurada. A incorporação final de406main/retarget/CI continua gate antes de declarar B1 encerrado. O caminho cliente mantém import direto de _shared/sessao, sem reintroduzir o barrel com Prisma.

C1 MEDIUM: os dois arquivos INT exigidos rodaram completos na fonte575, oito casos de payload público, commit/rollback, ID ausente, convite/revogação/ex-convidado e rollback de participante. C2 MEDIUM: quatro blocos do quadro preservam ambos os lados. Dois conflitos em documentos307 eram apenas uma linha em branco duplicada; versões atuais do pai406 mantidas. C3 LOW: o diff próprio é explicitamente os seis arquivos321; tooling/saídas E1 passam a baseline após os pais, sem apagar evidências para reduzir ruído. C4 LOW: capacidadesPainel é projeção de contexto previamente autorizado para o consumidor de Detalhes323/PR409, sem antecipá-lo; visibilidade do lead não cria responsabilidade D1 ou nova alçada de ação da Aria.

## Gates próprios

- Unitário4c12ea terminal0:5arquivos/89testes, America/Sao_Paulo, maxWorkers2. ProjeçãoInbox, permissões-telaAria, permissõesCRM, useAcoesAtendimento e dependências. Sem filtro de caso/skips novos; não é global.
- Integração2842/36809a terminal0:aviso.int.test.ts e whatsapp/participantes-aviso.int.test.ts completos,2arquivos/8testes,31,13s, America/Sao_Paulo, maxWorkers1/configintegration. Perfil exclusivo ci-integracao/erp_genius_test_ciint em localhost54329, sem outra suíte nesse banco. Setup só conferiu migrations; nenhuma migração, cluster, instalação ou provider real foi alterado/acionado. Não é suíte completaDB.
- Next typegen/TypeScript98357/7e7d0f e lint global94412/289af8 terminais0, zero erros/40avisos herdados.
- Provasc8f461/c7660b terminais0: seis arquivos321 iguais3258, scripts/visual inteiro/Pick/package/lock/guardas/schema/migrations/decisões-produto iguais406. O delta src residual foi enumerado antes do commit. A remoção do INT puramente duplicado406 permanece, sem ressuscitar o caso.

As execuções históricas da fonte9d/281 e agregadosROOT permanecem nominais; não substituem os gates próprios acima. QA composta, squash406main, CI final contra main nos dois fusos e merge ainda pendentes. Sem captura, seed, envio real ou deploy nesta composição.
