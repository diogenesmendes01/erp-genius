# Retomada após pausa com aprovação

**Decisão D13 aprovada em 08/09/2026. Implementação concluída e validada localmente; sem implantação em produção.**

A escola escolhe, em cada proposta de retomada, entre **manter os vencimentos originais** e **reprogramar as parcelas restantes**. As duas opções exigem aprovação antes de alterar o calendário ou retomar o aluno.

## Quem propõe e quem decide

- Secretaria, Financeiro ou Administração elaboram a proposta na ficha financeira individual do aluno.
- Outra pessoa do Financeiro ou da Administração aprova ou rejeita. Acumular papéis ou ser administrador não permite aprovar a própria proposta.
- A Secretaria consulta o atendimento individual. A fila global de retomadas no Financeiro é restrita ao Financeiro e à Administração; não amplia a visão de vendedores, gerentes comerciais ou professores.
- A proposta e a decisão exigem motivo. Autoria, datas, escolha, parcelas e calendário aprovado permanecem registrados.

## Comportamento

1. A pausa registra quais mensalidades foram suspensas por ela. Taxas, valores recebidos e cancelamentos de outras origens não são transformados em parcelas a restaurar.
2. O operador escolhe a opção e confere cada parcela: matrícula, valor contratado, valor recebido, saldo e vencimentos atual/proposto. Ao reprogramar, informa uma data real para cada mensalidade restante.
3. Enviar a proposta mantém o aluno pausado e preserva as cobranças. Só pode existir uma proposta pendente por aluno.
4. Na aprovação, o servidor revalida permissões, pessoa aprovadora, pausa, matrículas, parcelas, valores e pagamentos. Alteração financeira posterior à proposta exige rejeição e nova proposta; o aprovador não confirma silenciosamente condições diferentes das apresentadas.
5. Aprovar aplica a retomada e o calendário na mesma transação. Manter vencimentos restaura apenas mensalidades identificadas como canceladas pela pausa, nas mesmas datas. Reprogramar mantém as mesmas cobranças e seus pagamentos, alterando os vencimentos aprovados.
6. Rejeitar não retoma o aluno nem aplica novas datas. Uma nova proposta poderá ser apresentada.

Reprogramação não cria desconto, perdão, estorno ou nova comissão. Datas passadas são recusadas na proposta e na aprovação. Manter vencimentos pode conservar inadimplência: o controle automático de acesso de D+30 é recalculado na aprovação, preservando eventual restrição manual autorizada.

O antigo comando direto de reativação não libera o aluno. Ativar outra matrícula de aluno pausado ou encerrado também não pode contornar a proposta. Mensagens de cobrança devem usar a mesma referência de vencimento que produziu seu texto; uma reprogramação concorrente invalida o envio preparado com a data anterior.

## Uso nas telas

- Cadastro do aluno pausado → **Propor retomada** → ficha financeira → **Retomada após pausa**.
- Escolher a opção, conferir as parcelas, informar motivo e **Enviar proposta para aprovação**.
- Financeiro → **Retomadas** → comparar os calendários, informar motivo e **Aprovar proposta e retomar** ou **Rejeitar proposta**.

## Limites dos dados existentes

A pausa atual é registrada no aluno e abrange suas matrículas ativas. Esta entrega respeita esse alcance e não cria pausa independente por curso/matrícula.

Pausas antigas com mensalidades canceladas sem origem identificável exigem conciliação antes da proposta. A migração não presume que todo cancelamento antigo aconteceu por causa da pausa. Parcelas com saldo inconsistente também exigem conferência financeira. Não há correção automática de dados reais nesta entrega.

## Código e validação

Implementação nas [ações de retomada](../src/server/retomada/acoes.ts), nas ações de aluno/matrícula, no [painel de retomadas](../src/app/(app)/financeiro/RetomadasPainel.tsx) e nos controles da fila de WhatsApp. Estruturas persistidas pelas migrações `20260908040000_retomada_aprovada` e `20260908050000_ciclo_cobranca_retomada`. Cada vencimento alterado abre um novo ciclo de lembretes, preservando as intenções e mensagens dos ciclos anteriores. Manter a data ou registrar pagamento parcial não abre um novo ciclo.

| Verificação | Resultado observado |
|---|---|
| Testes unitários globais | **532/532**, em 49 arquivos |
| Integração global com PostgreSQL real | **313/313**, em 31 arquivos |
| Casos específicos desta entrega, incluídos nos totais acima | **31** unitários e **36** integrações de retomada; **19** unitários e **10** integrações de ciclo/eventos/fila de cobrança |
| TypeScript e build | `tsc --noEmit` e `next build` aprovados; build standalone executado localmente |
| ESLint | **0 erros e 9 avisos** já presentes na rodada anterior |
| HTTP com login real | **18/18** verificações de páginas, projeções, negações e revogação |
| Migrações aplicadas | **44/44** checksums conferidos, incluindo as duas novas migrações |
| Navegador e persistência | Fluxo Secretaria → proposta pendente → Financeiro → aprovação executado com duas contas fictícias; **8/8** verificações do estado gravado |

No navegador, as duas opções foram exibidas e a reprogramação foi exercitada até a aprovação. Antes da decisão, o aluno permaneceu pausado, sem botão de aprovação para a Secretaria e com os vencimentos originais nas cobranças. Após a aprovação por outra pessoa, o aluno ficou ativo e somente as datas propostas foram aplicadas. A parcela com R$ 40 recebidos manteve saldo de R$ 60; cobranças, recebimentos e parcelas pagas foram preservados, sem duplicação. Não apareceram erros no console. A escolha de manter vencimentos, rejeições, autoaprovação, revogação, dados alterados e concorrência também são cobertas pelos testes automatizados; não são apresentadas como jornadas adicionais executadas no navegador.

O [resumo durável da validação](validacao-retomada-2026-09-08.json) registra os resultados, os casos específicos e os arquivos desta entrega. Os [comandos de reprodução](../scripts/validacao/README.md) usam apenas banco local descartável. Provedores reais de WhatsApp, plataforma externa de aulas e dados de produção não foram utilizados nessa validação.

O [doc 38](38-implementacao-acesso-validacao.md) preserva os resultados da rodada anterior, e o [doc 36](36-politica-de-acesso-aprovada.md) consolida a política aprovada.
