# Incremento 608 — acompanhamento financeiro da continuidade

16/09/2026. Objetivo integral permanece em andamento.

## Implementação

Página `/financeiro/continuidade` e consulta `consultarFilaContinuidadeMensal`, restritas a Financeiro/Administração antes de buscar dados. A consulta revalida o usuário ativo e os papéis no banco. O link no painel financeiro usa o mesmo alcance de operação financeira; Gerência Comercial não recebe a nova fila.

Consulta somente leitura com paginação de 20 matrículas e cursor por ID. Inclui matrículas ativas com preparação mensal e matrículas legadas sem preparação que já possuem mensalidade, para não ocultar a necessidade de conferência. Não inclui ofertas por hora por causa de uma cobrança antiga. O carregador de continuidade determina o estado de cada matrícula: prazo a aguardar, pronta nas condições consultadas, indisponibilidade, relato pendente, confirmação de oferta necessária ou regra a conferir.

A projeção contém identificação mínima, estado, motivo operacional, cobertura e vencimento quando calculáveis. Não retorna preço, documento, cláusula, memória financeira ou snapshot. Erros técnicos interrompem a consulta com mensagem genérica, sem serem apresentados como pendências de negócio normais. A página distingue carregamento, falha e lista vazia; oferece links às conferências existentes e navegação de página.

A tela não emite nem autoriza ignorar bloqueios. Mostra o estado atual consultado, não comprova ativação ou execução do agendamento. Cada emissão continua revalidando as fontes em sua própria transação.

## Validação

**43/43 testes integrados aprovados**, em `docs/validacao-integrada-608-2026-09-16.json`: seis da fila e 37 de aditivos/continuidade. Os testes de integração incluem acesso negado a Professor, Vendedor, Secretaria e Gerência Comercial; revogação/desativação; 21 matrículas legadas em duas páginas; ausência de criação de cobrança/evento pela consulta; e transição real de falta de prova para pronta após aprovação pedagógica, seguida da próxima cobertura depois da emissão.

**11/11 testes unitários/SSR aprovados**, em `docs/validacao-unitaria-608-2026-09-16.json`: estados de oferta/prazo, erro técnico, paginação, projeção restrita e guard da página antes da consulta. Lint e build passaram (`docs/validacao-lint-608-2026-09-16.log`, `docs/validacao-build-608-2026-09-16.log`). A primeira checagem de tipos concorrente com geração do Next leu os tipos de rota durante sua atualização; foi repetida após o build.

## Limites

Nenhuma migração neste incremento; a próxima continua 146. A rotina externa permanece desligada. Esta fila é uma consulta do estado atual, sem histórico persistido de tentativas/rodadas ou diagnóstico operacional completo do cron. Homologação com dados reais, agendamento externo, desempenho em volume real e validação interativa permanecem pendentes. Não houve produção, mensagem ou cobrança externa.
