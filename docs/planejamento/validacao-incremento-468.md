# Incremento 468 — fila e gestão de regularizações Q24

Data: 15/09/2026. A meta integral continua ativa. Incremento anterior classificado como progresso: acesso ao diário implementado e testado.

## Entrega

Nova rota `/diario/regularizacoes`, ligada ao diário. Gestão Pedagógica/Administração consulta aulas previstas cujo horário terminou, responsáveis vigentes e histórico. O painel permite selecionar responsável ativo, registrar motivo, designar ou revogar. Uma designação vigente deve ser revogada antes de substituição. Histórico preserva designador, responsável, revogador, motivos e datas.

Professor consulta apenas aulas com designação vigente para si. O botão de regularização aparece somente quando há autorização para o usuário; gestão sem atribuição pode gerir designações, mas não recebe chamada por esse motivo. Consultas conferem papel ativo no banco, serializam com revogações e não retornam contatos, cadastros completos ou conteúdo do diário. Fila paginada com cursor e 30 encontros por página.

O formulário mantém a chave da tentativa quando há falha de comunicação e a mesma entrada é reenviada. Após sucesso recarrega dados e página; erros e estado de carregamento são apresentados. Responsável não vem pré-selecionado.

## Evidência

- Nove testes de integração aprovados em `docs/validacao-fila-q24-468-2026-09-15.json`, incluindo escopo da fila, exclusão após revogação, perfil inativo/indevido, histórico administrativo e paginação sem duplicações, além da regularização anterior.
- Lint direcionado aprovado.

## Limites

A fila desta etapa exibe pendências; consulta de histórico de aulas já concluídas possui ação administrativa, mas ainda não tem navegação dedicada nesta nova tela. Não houve validação visual em navegador. A gravação oficial da aula e os demais requisitos pendentes da SPEC seguem em implementação. Sem deploy ou alteração em produção.

Build inicial encontrou acesso possivelmente indefinido dentro do callback da página. Corrigido o estreitamento de tipo; novo build aprovado com TypeScript e 63 páginas estáticas. Não equivale a teste visual.
