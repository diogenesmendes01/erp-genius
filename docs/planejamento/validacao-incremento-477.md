# Incremento 477 — autorização para relatar falha no material

Data: 15/09/2026. Turno anterior classificado como progresso: código, testes e SPEC atualizados. Meta integral permanece ativa.

## Evidência do problema e implementação

Q57 limita o relato do aluno ao material ao qual possui acesso autorizado. O endpoint verificava somente propriedade e disponibilidade do material, permitindo relato mesmo com bloqueio da matrícula ou conta inativa. A revisão Terra confirmou a diferença frente à autorização de reprodução.

O núcleo de autorização agora pode ser reutilizado dentro de uma transação. O relato o executa antes de persistir, incluindo conta ativa, matrícula exata, decisão, publicação, bloqueios, D+30 e coerência da fonte vinculada. Não consulta bytes do Drive para aceitar o relato: uma falha técnica de reprodução é justamente um motivo para relatar. A tela usa a mesma autorização para oferecer player e formulário; conserva o histórico visível.

## Validação

- 17 testes de integração aprovados: relatos e autorização de reprodução. Seis casos novos verificam matrícula pausada, encerrada, bloqueio manual, conta inativa, ausência de disponibilização e D+30, sem criar relato quando recusados. Fixture dos relatos passou a publicar a janela de disponibilização necessária ao acesso.
- Sete testes das rotas de vídeo e indisponibilidades aprovados.
- Relatórios: `docs/validacao-relato-autorizacao-477-2026-09-15.json` e `docs/validacao-rotas-relato-477-2026-09-15.json`.
- TypeScript, lint direcionado e build aprovados; 63 páginas estáticas geradas. Banco descartável usado por um único processo de integração.

## Limites e continuidade

Não implementa ainda propagação da indisponibilidade para outros materiais da mesma fonte nem substituição da gravação por Q23. A investigação dessa propagação identificou primeiro o desvio de autorização corrigido neste incremento. Sem validação visual, acesso real ao Drive ou deploy. As verificações locais não comprovam conclusão da SPEC integral.
