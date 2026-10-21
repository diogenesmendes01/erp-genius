# Incremento 596 — Conferência documental da desistência

16/09/2026. O objetivo integral continua em andamento. A rodada anterior foi progresso verificado; esta acrescenta a consulta documental própria de Q121 e sua interface.

## Comportamento

Secretaria/Administração pode conferir documentos e processos de assinatura da matrícula na nova página `/matriculas/[id]/desistencia/documentos`, acessível pelo pedido de desistência. O servidor revalida o papel ativo sob bloqueio do contexto. Apresenta metadados e pendências, sem URLs, hashes, referência externa real ou dados de signatários. A consulta não altera documento, processo, matrícula ou reserva.

Resultados de cancelamento para substituição de contrato são mostrados como tal. Confirmação para substituição não autoriza desistência; conclusão registrada e envio incerto permanecem identificados para tratamento próprio. Ausência de registros locais não certifica ausência de envio externo.

## Evidência da revisão de integração externa

Revisão Terra confirmou que Q155 continua sem fornecedor/plano escolhido. `src/server/contratos/envio-tx.ts` e `cancelamento-assinatura-tx.ts` são primitivas internas de persistência, sem adaptador autenticado, transporte operacional ou webhook. A lista de fornecedores aceita pelo schema não é contratação nem escolha operacional. Testes com fornecedor/ambiente são fixtures locais.

O cancelamento existente pertence à substituição Q116 e usa `PropostaSubstituicaoContratual`; a aplicação cria um processo substituto. Não deve ser usado para efetivar Q121. O próximo fluxo requer proposta/decisão próprias da desistência, intenção persistida antes da chamada, retorno autenticado, conciliação de incertezas e revalidação antes da aplicação. Contrato já concluído não se resolve cancelando uma solicitação aberta.

## Limites

Esta entrega é a conferência contextual, não uma aprovação documental persistida nem integração de cancelamento. Casos com documentos continuam impedidos nos aplicadores restritos existentes. Acertos com pagamentos, decisão administrativa conforme avanço formal, encerramento externo e homologação interativa permanecem no objetivo.

[Regra detalhada](../specs/desistencia-preparacao.md). Nenhuma migração, importação real ou envio externo faz parte desta rodada.

## Validação

- **22 integrações aprovadas**: quatro da conferência documental, sete do pedido de desistência e onze da efetivação. `docs/validacao-integrada-596-2026-09-16.json`.
- Os quatro testes documentais usam fontes contratuais reais da fixture local: preservação e filtragem de metadados; observação de substituição incerta seguida de confirmada sem liberar desistência; pedido sem documentos/processos; acesso Secretaria/Administração e recusa de vendedor/usuário inativo. Não são chamadas ao fornecedor externo.
- **9 testes de renderização aprovados**: três da nova conferência e seis da página de desistência. `docs/validacao-unitaria-596-2026-09-16.json`.
- Tipos e lint aprovados: `docs/validacao-tipos-596-2026-09-16.log`, `docs/validacao-lint-ui-596-2026-09-16.log` e `docs/validacao-lint-server-596-2026-09-16.log`.

- Build aprovado: `docs/validacao-build-596-2026-09-16.log`, incluindo a nova rota documental.

As verificações são específicas desta entrega e da regressão indicada. Não comprovam todas as transições documentais, o transporte externo ou homologação em navegador.
