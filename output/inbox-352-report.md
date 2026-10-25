# Entrega DEV B — Inbox #352

Base final autorizada: 17feea9990cebfa5ccefee4d4fa20551441e152a. Branch codex/inbox-e3-352-handoff-conversa. Recorte exclusivamente frontend; backend #357 e D3 permanecem explicitamente pendentes. Nenhuma mudança de servidor, schema, contrato de action, package, lock, env, perfil, banco ou integrações.

## TDD e negativos preservados

- c8f91b: módulos ausentes, saída 1 administrativa; zero casos executados, não é RED de comportamento.
- d9b268: scaffold vazio, cinco falhas de comportamento.
- 5081c0: prop Modal, uma falha e três controles; GREEN apresentação 86a28d, três arquivos/nove casos, saída 0.
- dcfbf8 (log red-interacao): sete casos de interação RED; GREEN 5404a3, sete casos, saída 0.
- 3dae43: consumidores, dois arquivos/49 casos, duas falhas e 47 controles.
- d380a0: primeira integração, 18 falhas/43 controles por variável leituraPainel não desestruturada; corrigida. GREEN a17356: três arquivos/56 casos, saída 0.
- 014f6d: revogação e mapa, 99 casos, duas falhas/97 controles; intenção de foco revivida após revogação e entradas de mapa ausentes. Ambas corrigidas sem alterar guardas.
- sessão7006/d3106b: regressão1, 88 arquivos/1.032 casos, 36 falhas/996 controles. Somente mocks legados de hooks em dois testes. Adaptações locais preservaram asserções; comportamento novo usa React/Modal/hook reais.
- sessão53138/3d53c6: regressão2, 88 arquivos/1.032 testes, saída 0. w1/heap1024. Recorte, não suíte global.
- 6c4939: interação ampliada, 12/12 saída 0; controles adicionais de clique duplo, revogação pré-ACK e preservação dos rascunhos.
- 65c6b0: lint inicial de oito fontes, saída 0.

Gates finais serão registrados somente após saída terminal. Logs privados originais permanecem em output/inbox-352-*. Nenhum filtro de caso ou skip novo. Integração de banco excluída pela configuração original; sem DB/Next/browser/HTTP/install/env/provider/captura/push/deploy. Histórico output/v1/v2 preservado.

- sessão5328/afbbc7: regressão ampliada com paleta/contraste/tipografia, saída 1; 92 arquivos/1.072 casos, única falha foi bg-danger-bg inexistente no mapa Tailwind (1.071 controles). Corrigida para bg-red-50, mapeado ao MESMO --danger-bg original; nenhuma mudança de token global/guarda/config.
- 99272c: lint de todos os 17 arquivos TS/TSX alterados, --max-warnings=0, saída 0.
## Gates finais

- sessão39987/chunk602cf1, saída 0: 92 arquivos/1.072 testes. Pasta Inbox completa + Modal (3 arquivos), Compositor (4), Botao, mapa botões completo (85 casos), paleta, contraste, contraste-elementos e tipografia. w1/heap1024, sem filtro de caso/skip novo. Não é suíte global.
- aa6cb8, saída 0: quatro arquivos/31 testes canônicos de useDialogo, retorno de foco e guarda de diálogos.
- 547cb1, saída 0: lint dos 17 arquivos TS/TSX tocados, --max-warnings=0.
- 71b8e6, saída 0: git diff --check.

TypeScript original sessão53407/58eee5 terminou EXIT2: 1.107 diagnósticos em output histórico privado e três TS2769 na fixture nova (ok boolean). Fixture corrigida com literal true: 12 testes EXIT0 71eeb0, lint EXIT0 0f870e. Replay original incremental já iniciado antes da orientação de não repetir terminou sessão24094/ce82c4 EXIT2: zero diagnóstico src, 1.107 em output. Não é TSC aprovado. Inventário privado contém 23 arquivos causais/hash, todos untracked e não ignorados, zero versionado; ROOT arquivará históricos preservando hashes antes de outro original. Nenhuma configuração/exclusão/generate foi alterada. QA independente/build/CI/visual estão pendentes do integrador/TESTER, sem alegação de homologação. Matriz visual e limite #357 documentados no SPEC.
