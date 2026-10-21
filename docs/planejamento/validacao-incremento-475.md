# Incremento 475 — gravação original na reposição autorizada

Data: 15/09/2026. Meta integral ativa. Incremento anterior foi progresso de código e validação.

## Implementação

A publicação de material aceita a opção de usar a gravação da aula original, sem receber arquivo do cliente nessa opção. Deriva a fonte pela aula que originou a reposição, exige publicação oficial da aula ministrada no Drive configurado, confere disponibilidade e repete a validação antes de persistir. Preserva a aprovação do pedido e a configuração de prazo obrigatórias.

Migration 215 adiciona `publicacaoAulaId` ao material, com vínculo imutável e conferência de aula, arquivo e provedor. O fluxo de material informado manualmente continua disponível; não pode ser combinado com a opção de gravação original na mesma entrada. O botão foi incluído no painel operacional. A publicação registra material, vínculo, janela de entrega e evento na mesma transação. Não conclui reposição nem altera frequência.

## Evidência

- Rodada inicial: 28 aprovações e uma falha por configuração ausente na fixture nova; relatório preservado em `docs/validacao-material-original-475-2026-09-15.json`. Os 14 testes operacionais passaram nessa rodada.
- Após corrigir a fixture: 15 testes aprovados em `docs/validacao-material-original-475-final-2026-09-15.json`. O cenário novo conclui a aula com gravação, preserva a fonte na Q23, solicita/autoriza reposição e publica a fonte original; verifica vínculo imutável, um prazo e nenhuma conclusão automática. São 29 cenários distintos aprovados entre os dois arquivos.
- TypeScript, lint direcionado e build aprovados; build gerou 63 páginas estáticas. Migration aplicada somente ao banco descartável de testes.

## Limites

Não implementa substituição da gravação por Q23 nem propaga correções/indisponibilidade entre materiais já publicados. Essa relação precisará compor a conferência dos impactos da troca de vídeo. Sem validação visual ou acesso real ao Drive nesta rodada; sem deploy ou alteração em produção. A SPEC integral permanece em implementação.
