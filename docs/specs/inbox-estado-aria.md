# Inbox #342 — estado da Aria derivado no servidor

Estado atual: PR421 em rascunho, código54c44b2a. QA independente e gates locais ROOT aprovados; três bancos descartáveis restaurados. CI rápida5/5 e integração completa4/4 aprovadas no código54c;CI do último SHA documental pendente. [Evidências e limites](../../output/inbox-342-qa/indice.json). Não concluir a issue antes dos gates finais.

O produtor `src/server/inbox/estado-aria.ts` define `EstadoAria = ia | aprovacao | handoff | humano`, a classificação pura de um atendimento e filtros Prisma equivalentes. O contexto e os loaders recebem o mesmo `Db`/transação. Não há consumidor visual, rota ou nova alçada nesta issue; lista, filtros, cartões e cabeçalho pertencem às dependências seguintes.

A primeira regra aplicável vence:

| Prioridade | Estado | Regra |
| --- | --- | --- |
| 1 | null | Atendimento encerrado ou conversa de grupo |
| 2 | handoff | Handoff ainda sem resposta humana/celular ou evento de Assumir posterior à pausa |
| 3 | humano | Pausa preenchida, inclusive handoff já atendido |
| 4 | aprovacao | Sugestão SUGERIDA, com expiração nula ou estritamente futura |
| 5 | ia | Global ATIVA, versão publicada, sem pausa global, orçamento permitido e guardas do turno satisfeitas |
| 6 | humano | Responsável preenchido |
| 7 | null | Nenhuma regra anterior |

`ariaAtivaGlobal` exclui SHADOW/DESLIGADA, versão ausente, pausa global e ESTOURADO+PAUSAR; ESTOURADO+SO_SUGERIR mantém o contrato atual. `derivarEstadoAria` reutiliza `motivoParaNaoAtuar` em vez de copiar a guarda do turno. “Sem resposta” e “Não atribuída” continuam marcações sobrepostas. O filtro de estado deve ser combinado com o escopo autorizado pelo consumidor futuro; classificar um atendimento não concede acesso a ele.

Handoff usa uma consulta parametrizada com pausa HANDOFF não nula, atendimento aberto e dois NOT EXISTS: MensagemWhatsApp SAIDA/HUMANO ou CELULAR e Evento AtendimentoAssumido do mesmo agregado, ambos com `criadoEm > iaPausadaEm`. Instantes iguais não encerram a pendência. IDs ausentes significam universo; lista vazia retorna vazio sem consulta; listas são deduplicadas e não têm cap100/200 ou consulta por atendimento. Grupos não podem abrir atendimento por invariante existente do banco; a função pura mantém a defesa de grupo nulo.

Sugestões vêm em uma consulta DISTINCT ON por atendimento, apenas status vigente, ordenada por criadoEm DESC/id DESC. O desempate por ID é estabilidade de seleção, não causalidade do handoff. A fronteira de vigência é UTC em milissegundos: Date ligado por raw chega como timestamptz, enquanto as colunas Prisma são timestamp sem fuso. A query passa o ISO UTC como parâmetro e faz cast timestamp(3), mantendo paridade com `sugestaoVigente` independentemente da TZ da sessão.

`carregarContextoAria` fixa agora uma vez e usa o mesmo Db em situação, orçamento e handoffs. `estadoOrcamento(agora?, tx?)` acrescenta somente o segundo argumento opcional; consumidores atuais mantêm comportamento. O upsert legado inicializa ConfigIA ausente, portanto o contexto não promete ausência absoluta de escrita. Nenhum client ou transação interna é criado. Pool1 deve enxergar valores ainda não commitados e preservar rollback.

Consumidores de página devem passar `atendimentoIds` com os IDs autorizados dessa página: o modo sem IDs carrega o universo de handoffs, cujo conjunto vira parâmetros `IN` no filtro. Não há limite de volume prometido para esse modo; consumidores de contagem global devem avaliar subquery antes de usá-lo em bases grandes. A #343 passa explicitamente os IDs da página.

Rastreio de aceite: `resposta_pelo_celular_encerra_handoff_pendente` corresponde ao caso CELULAR do teste parametrizado `resposta %s encerra handoff somente posterior`; o mesmo teste cobre HUMANO e a fronteira temporal estrita.

A única migração é o índice parcial `20261024213000_inbox_aria_indice_handoff`, reservado e aplicado pelo ROOT: CREATE INDEX CONCURRENTLY, um comando fora de transação, em iaPausadaEm para HANDOFF aberto. Schema e cliente permanecem compatíveis com a base490; o histórico passa a491. Não há modelo, enum ou alteração de dados do domínio nesta migração.

D1–D3 aprovadas orientam os consumidores futuros: responsável da CONVERSA decide dentro do escopo; mensagem editada sai como humana e pausa; Assumir pausa MANUAL, atribui responsável e cancela pendentes; nota interna continua permitida. Esta entrega não implementa essas ações. Os textos históricos divergentes de #354/#357 não prevalecem sobre a decisão aprovada.

Aceite visual: N/A para este produtor interno sem interface nova. Testes de prioridade, matriz filtro/derivação, expiração, limites temporais, lotes205, SQL parametrizado, índice e Db/pool1 estão documentados no relatório. Evidência e pendências: [relatório #342](../../output/inbox-342-report.md). QA independente e gates locais estão registrados no índice; integração remota completa4/4 aprovada; CI documental e publicação continuam com o ROOT.
