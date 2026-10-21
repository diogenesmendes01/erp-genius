# Incremento 495 — interface de conferência dos signatários do aditivo

Data: 15/09/2026. Meta integral ativa, confirmada pelo serviço de metas após o pedido de retomada. O turno anterior reativou os agentes e verificou cinco testes unitários; este incremento altera código, interface e especificações.

## Entrega

As ações de conferência, formulário e histórico exigem Secretaria/Administração e consultam o papel vigente. O par matrícula/proposta é validado antes de carregar o contexto. O formulário e a gravação compartilham a revalidação da proposta aprovada, da fonte contratual, das condições e das identificações. Uma proposta posterior bloqueia nova conferência da versão antiga, preservando a leitura de seu histórico.

A página de detalhes do aditivo oferece o formulário quando a proposta está aprovada e não foi superada. Os papéis são calculados pelo modelo aprovado. Identidades automáticas aparecem em leitura; representantes exigem identificação, fundamento e evidência. A classificação de maioridade é uma conferência documentada da Secretaria conforme a regra aplicável, não um cálculo de idade universal nem uma assinatura herdada. Modelo com condição de maioridade não resolvida mantém pendência e bloqueia o registro.

Documentos são paginados. A seleção permanece no formulário ao consultar outra página e todos os IDs são revalidados no registro, incluindo escopo e arquivamento. A consulta não expõe a URL interna. Se outra conferência alterar a versão durante a paginação, a tela exige reabrir a revisão. Repetição do mesmo envio reutiliza a chave idempotente; conteúdo diferente recebe nova chave.

O histórico paginado mostra autor, data, motivo, identidades, representação, critério de maioridade e nomes das evidências preservados. O serviço confere o hash do snapshot antes da projeção; não retorna o snapshot bruto, a chave idempotente ou referências externas de assinatura.

## Verificação

- Integração PostgreSQL descartável: **16/16 aprovados**, em `docs/validacao-aditivo-interface-final-495-2026-09-15.json`. Abrange as treze integrações anteriores e três cenários novos com múltiplas asserções: sessão/papéis/escopo, aprovação e versionamento/histórico, paginação/evidência arquivada depois da consulta.
- A primeira execução passou 14 e falhou 2 por fixtures incorretas: papel enviado como string em vez de lista e documento sem matrícula nem lead. As fixtures foram corrigidas respeitando as restrições do banco; o relatório inicial permanece em `docs/validacao-aditivo-interface-495-2026-09-15.json`.
- TypeScript e ESLint dos arquivos alterados aprovados.
- Build aprovado em `docs/validacao-build-495-2026-09-15.log`.
- Cinco unitários das regras de participantes passaram na retomada anterior.

## Limites e sequência

Ainda não houve ensaio visual/interativo desta nova tela em navegador autenticado. Compilação e testes de serviço não comprovam esse ensaio. Não houve nova migração, instalação de dependência, envio de assinatura ou operação em produção.

Continuam pendentes o original definitivo próprio do aditivo, conferência/liberação para assinatura, integração operacional do fornecedor, aplicação das condições com vigência e aprovações comerciais/financeiras aplicáveis, e encadeamento de aditivos já aplicados. A primeira fonte suportada ainda é o contrato original. Esta entrega não encerra Q117 nem a SPEC integral.
