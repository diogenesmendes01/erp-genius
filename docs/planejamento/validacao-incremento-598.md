# Incremento 598 — Fila administrativa de desistências

16/09/2026. Objetivo integral em andamento.

Implementada consulta paginada e tela `/secretaria/desistencias`, acessível pelo painel da Secretaria. Um item por matrícula, referente ao último pedido ainda sem decisão administrativa. Revalidação das fontes e dos papéis no banco; casos alterados permanecem para conferência. A Secretaria consulta; a decisão continua exigindo outra pessoa da Administração e ocorre na tela específica. Não há efeitos sobre cobranças, assinaturas ou reservas nesta consulta.

## Validação

- 14 integrações passaram: cinco da fila e nove da decisão administrativa (`docs/validacao-integrada-598-2026-09-16.json`).
- Após acrescentar a conferência final de acesso antes do retorno, as cinco integrações da fila foram reexecutadas e passaram (`docs/validacao-integrada-final-598-2026-09-16.json`). São os mesmos cinco cenários, não testes adicionais.
- Quatro testes de renderização passaram (`docs/validacao-unitaria-598-2026-09-16.json`): paginação e links, estado alterado, leitura e distinção entre erro e fila vazia.
- Build passou (`docs/validacao-build-598-2026-09-16.log`). Tipos e lint iniciais e finais passaram; a conferência final está registrada nos arquivos `docs/validacao-tipos-final-598-2026-09-16.log` e `docs/validacao-lint-final-598-2026-09-16.log`.

As integrações usaram somente o banco local de testes. Não houve nova migração, homologação interativa, envio externo ou alteração de produção. A fila não lista todos os acertos pendentes: seu recorte é a decisão administrativa ainda não registrada. Efetivação de desistências com pagamentos/assinaturas permanece incompleta, conforme a SPEC; Q165 aguarda decisão sobre o cálculo do acerto.

Q160 já está registrada em FIN-02.3 da SPEC central e implementada na configuração/planejamento desde o incremento 523. Esta rodada não habilita emissão recorrente.
