# Incremento 518 — seleção mensal comum e sobreposição de indisponibilidades

15/09/2026. Implementação/revisão com agentes Terra e validação pelo orquestrador.

`selecionarCondicaoContinuidadeVigente` centraliza a seleção usada pela prévia e pelo resolvedor de preço mensal. Ambos validam todas as regras carregadas, selecionam a condição efetiva na data civil e desempatam pela versão. Documento, moeda e origem do preço permanecem conferidos pelos consumidores. A mudança evita que as duas seleções voltem a divergir; não cria emissor recorrente.

Adicionado cenário de dois relatos sobrepostos: terminar o primeiro não elimina a pendência do segundo; confirmar o segundo mantém a indisponibilidade até seu próprio término. A projeção retorna somente o relato que ainda atinge a data consultada.

## Evidências

- Seis integrações de término aprovadas: `docs/validacao-termino-oferta-518-2026-09-15.json`.
- Cenário mensal completo revalidado (um caso selecionado): `docs/validacao-continuidade-518-2026-09-15.json`.
- Dezesseis unitários de seleção e planejamento mensal aprovados: `docs/validacao-unitarios-518-2026-09-15.json`.
- ESLint focado e build aprovados: `docs/validacao-build-518-2026-09-15.log`.

## Ensaio interativo ainda pendente

Foi criado `scripts/qa-termino-oferta.mjs`, com URL fixa do banco descartável e senha das contas sintéticas recebida por variável de ambiente. Não lê a URL de produção, não trunca dados nem envia mensagens. A massa foi gerada; execuções posteriores das integrações podem removê-la no banco de testes, exigindo nova preparação antes do ensaio.

Duas tentativas de iniciar `next start` foram rejeitadas pela revisão automática com a mensagem genérica “blocked by policy”. A segunda restringia explicitamente o servidor a `127.0.0.1`. Não foi tentado contorno. Nenhum servidor de QA foi iniciado por essas chamadas e nenhuma interação de navegador foi validada. A falha de aprovação do processo não foi apresentada como defeito do produto nem como conclusão do ensaio.

Q157 continua pendente. Emissão recorrente e integração das compensações seguem necessárias. Este incremento não comprova a conclusão da SPEC integral.
