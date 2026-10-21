# Implementação e validação da política de acesso

**08/09/2026 — etapa de implementação e validação local concluída, com os limites declarados abaixo. Alterações não implantadas em produção.**

Este relatório relaciona as decisões dos docs 36/37 com código e testes. Os docs 33/34 e os JSON da auditoria original permanecem como evidência histórica anterior à implementação. Testes verdes demonstram os cenários executados, não ausência de todo defeito possível.

## Entrega por decisão

| Decisão | Comportamento implementado | Evidência principal |
|---|---|---|
| Quatro dimensões | Papéis atuais no banco; escopo por carteira/equipe/vínculo docente; projeções por finalidade; condições verificadas no servidor. Configurações administrativas bloqueadas antes de carregar os dados. | [_shared/sessao.ts](../src/server/_shared/sessao.ts), [_shared/escopo-comercial.ts](../src/server/_shared/escopo-comercial.ts), [alunos/projecao.test.ts](../src/server/alunos/projecao.test.ts), [alunos/cadastro.int.test.ts](../src/server/alunos/cadastro.int.test.ts), [catalogo/permissoes.int.test.ts](../src/server/catalogo/permissoes.int.test.ts) |
| D01 — pagamento informado | Secretaria informa; recebimento fica separado. Financeiro diferente confirma ou rejeita. Pagamentos parciais têm identidade, histórico e proteção contra repetição/concorrência. Falha posterior no recálculo de acesso não transforma recebimento já salvo em resposta de erro. | [financeiro/politica.int.test.ts](../src/server/financeiro/politica.int.test.ts), [financeiro/operacoes.test.ts](../src/server/financeiro/operacoes.test.ts), [financeiro/recebimentos.ts](../src/server/financeiro/recebimentos.ts) |
| D02 — carteira/cobertura | Equipe explícita, cobertura com início/fim e revogação. Transferência altera o acesso comercial e cancela envios humanos do responsável anterior; preserva autoria e beneficiário da comissão. | [acesso/politica.int.test.ts](../src/server/acesso/politica.int.test.ts), [whatsapp/acesso-atendimento.int.test.ts](../src/server/whatsapp/acesso-atendimento.int.test.ts) |
| D03 — aprovação independente | Aprovação valida objeto, versão, alçada, equipe e pessoa diferente. Acumular papéis ou aumentar a própria permissão não produz uma segunda pessoa. | [financeiro/politica.int.test.ts](../src/server/financeiro/politica.int.test.ts), testes de ajustes e acesso |
| D04 — comunicação docente | Professor usa atendimento institucional pedagógico, sem telefone pessoal no retorno. Conversas financeiras/comerciais são assuntos separados. Destinatário é revalidado antes do envio. | [whatsapp/acesso-atendimento.int.test.ts](../src/server/whatsapp/acesso-atendimento.int.test.ts), [whatsapp/destinatario-atual.int.test.ts](../src/server/whatsapp/destinatario-atual.int.test.ts) |
| D05 — secretaria assume cadastro | Assunção explícita; vendedor solicita correção. Secretaria resolve com registro e evidência documental pertinente. Documentos podem pertencer diretamente à matrícula, inclusive sem lead. | [secretaria/politica.int.test.ts](../src/server/secretaria/politica.int.test.ts), [uploads/arquivos.int.test.ts](../src/server/uploads/arquivos.int.test.ts) |
| D06 — descontos | Limites independentes para taxa e mensalidade, referência da negociação e desconto acumulado; entradas de matrícula e ajuste compartilham os controles. | [financeiro/regras.test.ts](../src/server/financeiro/regras.test.ts), [financeiro/politica.int.test.ts](../src/server/financeiro/politica.int.test.ts) |
| D07 — comissões | Política versionada por oferta/país/moeda, percentual da taxa ou valor fixo por matrícula. Novas versões preservam comissão anterior; fechamento e recálculo serializam alterações. | [financeiro/politica.int.test.ts](../src/server/financeiro/politica.int.test.ts), configuração no Financeiro e extrato em `/comissoes` |
| D08 — histórico docente | Vínculos temporais, diário e nomes dos alunos no registro da aula. Fim do vínculo remove acesso atual e mantém as próprias aulas em leitura. Retorno posterior não reabre período encerrado. | [diario/diario.int.test.ts](../src/server/diario/diario.int.test.ts), [turmas/vinculo-docente.test.ts](../src/server/turmas/vinculo-docente.test.ts) |
| D09 — exportação | Capacidade administrativa específica. XLSX contém somente projeção permitida; geração e entrega revalidam papéis, concessão e registros. | [api/exportacoes/[tipo]/route.int.test.ts](../src/app/api/exportacoes/[tipo]/route.int.test.ts) |

Os caminhos acima partem de `src/server`, exceto os explicitamente iniciados por `api`, que partem de `src/app`. As suites de integração usam PostgreSQL descartável real; drivers de WhatsApp são substituídos por doubles e não enviam mensagens externas.

## Decisões operacionais acrescentadas em 08/09

- **D10 — ativação:** contrato aceito com evidência documental e taxa confirmada. A configuração do ERP pode exigir também a primeira mensalidade, desabilitada por padrão. Informe a conferir não conta como recebimento. Não se gera aceite contratual automaticamente na ativação.
- **D11 — conferência:** prazo inicial de **48 horas**, configurável. O informe guarda seu vencimento de suspensão; mudança da configuração vale para novos informes. A suspensão afeta somente lembretes daquela cobrança, não confirma pagamento nem libera acesso às aulas. Rejeição ou expiração permite retomar a régua, revalidando o saldo e o destinatário.
- **D12 — inadimplência:** cobrança com saldo vencido há 30 dias ou mais gera restrição automática da matrícula ativa. Secretaria, Financeiro ou Administração podem solicitar restrição manual com motivo; outra pessoa da Administração aprova ou rejeita, com registro da decisão. Bloqueios manual e automático são separados: quitação remove a causa automática, sem desfazer uma decisão manual. Informe a conferir não equivale a pagamento confirmado. O recálculo acontece após as operações financeiras e pelo cron institucional; não depende de ativar envios do WhatsApp.

Configuração da ativação e do prazo de conferência: `/configuracao/operacao`, restrita à administração. Valores de desconto e comissão não foram inventados; devem ser cadastrados pela escola.

## Validação

| Verificação | Resultado observado |
|---|---|
| Testes unitários | **482/482**, em 46 arquivos, incluindo quatro regressões de falha no recálculo após confirmação da transação financeira |
| Integração com PostgreSQL real | **267/267**, em 29 arquivos; casos positivos, negativos, revogação, concorrência e integridade financeira |
| Regressão financeira após o último ajuste | **20/20** integrações repetidas; subconjunto dos 267, sem somar novamente ao total |
| TypeScript | `tsc --noEmit` aprovado |
| Build de produção | `next build` aprovado; aplicação standalone iniciada localmente |
| ESLint | **0 erros e 9 avisos**; detalhes no resumo JSON |
| HTTP com login real | **18/18** verificações de páginas, projeção, negação e revogação com cookie anterior |
| Migrações aplicadas | **42/42** checksums conferidos, incluindo as seis migrações desta implementação |
| Navegador | Login administrativo fictício; configuração alterada, salva e persistida após recarga; padrões de 48 horas e primeira mensalidade opcional restaurados e conferidos; renderização da Secretaria/Financeiro e alternância percentual/fixo verificadas |

Na conferência do navegador não apareceram erros no console. Essa conferência cobre as interações descritas; não representa teste de todas as jornadas ponta a ponta. O acesso efetivo a uma sala externa e os envios por provedor real não foram testados.

Comandos reproduzíveis em [scripts/validacao/README.md](../scripts/validacao/README.md). O [resumo durável da validação](validacao-acesso-2026-09-08.json) relaciona as suítes e os resultados; relatórios brutos locais ficam sob `node_modules/.implementation`. Os snapshots da auditoria original foram preservados. A rodada global de integração precedeu o último ajuste de resposta financeira; após ele foram repetidos todos os unitários, as 20 integrações financeiras, TypeScript, lint, build e HTTP.

## Limites e pendências explícitas

1. **Retomada após pausa:** decisão respondida após esta rodada de validação: as duas opções ficam disponíveis, sempre mediante proposta aprovada. A implementação D13 e sua validação são acompanhadas no [doc 39](39-retomada-com-aprovacao.md); os números desta tabela registram a rodada anterior a essa ampliação.
2. **Acesso efetivo à plataforma de aula:** não foi encontrada integração com LMS/sala externa. A restrição é registrada e aplicada à operação do ERP; impedir entrada em Zoom, Meet ou outra plataforma exige integração específica. Não considerar essa integração entregue.
3. **Exceção acadêmica:** na rodada acima existia apenas separação por papel. O fluxo de mudança excepcional de nível foi detalhado posteriormente como D14, com solicitação, parecer ou dispensa justificada, aprovação independente e execução pela secretaria; implementação e validação no [doc 40](40-mudancas-academicas-com-aprovacao.md). Progressão automática, avaliações por habilidade, dispensa curricular e alterações retroativas continuam fora dessa entrega.
4. **Dados antigos:** vínculo docente anterior à migração não é inventado. Documentos sem prova de contexto/autoria podem exigir reenvio. Mensagens antigas ou ambíguas sem assunto ficam na triagem administrativa, sem liberação automática de todo o histórico.
5. **Recebimentos anteriores ao ledger:** quando há eventos antigos com valor/data, são usados sem duplicar novos recebimentos. Valores legados sem evidência temporal suficiente não permitem reconstruir com precisão a receita mensal.
6. **Permissões configuráveis:** as quatro capacidades adicionais de exportação, caixa e comissão complementam papéis fixos e políticas de domínio. O inventário de nomes propostos do doc 37 não se tornou um editor genérico de todas as capacidades.
7. **Homologação e operação:** migrations e testes executados somente em banco local descartável. Implantação, migração dos dados reais, cadastro das equipes/alçadas e homologação com usuários da escola permanecem etapas distintas. O agendamento externo do cron institucional precisa estar ativo no ambiente implantado para aplicar a restrição automaticamente com o passar dos dias e reconciliar falhas de recálculo; a execução é periódica, sem promessa de bloqueio no segundo exato de D+30.

## Próximas prioridades

**Atualização após D14:** a solicitação de mudança de nível, parecer, aprovação independente e execução estão entregues no [doc 40](40-mudancas-academicas-com-aprovacao.md). Homologar as jornadas D01–D14 com secretaria, financeiro e docentes; integrar agenda/acesso à plataforma de aulas; completar avaliações, progressão e renovação; depois evoluir portal e gestão presencial. O [doc 41](41-situacao-consolidada-do-projeto.md) consolida o estado atual de ERP + CRM + WhatsApp e do backlog. O doc 33 preserva a priorização inicial.
