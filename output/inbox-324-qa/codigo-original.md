# QA independente #324 — código

Fonte exata: `2396a6c7703d0717a523d93f51a210a75f588135` (base `272a2b33452944d77b5f1e6ed2a750981f57c1bf`). Worktree exclusivo TESTER, HEAD detached e rastreados limpos. Node 22.23.2; executáveis locais. Perfil `.erp-test-profile=tester`, banco descartável TESTER487 reservado pelo integrador. Nenhum Prisma, migration, instalação, servidor, browser ou integração externa foi iniciado por esta QA.

## Parecer de código

Favorável ao recorte de código revisado, sem achado alto/médio reproduzível. O diff tem 24 paths; `git diff --check` saiu 0. Schema, package/lock, permissões globais #321, identidade #323, ação de nome preexistente, thread, Compositor, leitura/R6 e SSE não foram alterados.

- A ação recebe apenas `atendimentoId`/tag ou nome: resolve Pessoa autorizada pelo atendimento na mesma transação, não aceita `pessoaId` do cliente. O bloqueio da linha de atendimento precede resolução e escrita; a callback após o lock do vínculo repete identidade, lead e capacidades. Convidado D13 pode ler dados comerciais, mas `editarTags` ainda requer capacidade CRM `contatos.editar`; criar exige também `carteira.equipe`. Responsável legal/B2B sem Pessoa editável não vira alvo por fallback.
- O núcleo CRM preserva os alvos Pessoa/Empresa e a semântica pública anterior. Lock do nome exato precede lock do vínculo, com namespace/tupla próprios. Atribuição repetida retorna `false`, sem sobrescrever `criadoPorId`, Evento ou aviso; remoção histórica de tag inativa continua possível. Criação, vínculo, Evento e `avisarAtendimento` participam da mesma transação; falha reverte todos. O teste final de duas conexões comprova os núcleos SQL com ator fresco, não a concorrência do boundary NextAuth de sessão.
- A UI usa `TagPainel.id` nas chaves, catálogo autorizado completo para detectar nome já existente e oito sugestões apenas na apresentação. O 404 retém snapshot legível e remove ações novas via `acoes != null`; não converte leitura em escrita. Slots de tags/aviso são aditivos à única montagem de `PainelContato`. `ContatoSemNome` envia o `nomeAnterior` bruto ao CAS existente, desabilita campo/Salvar no await, preserva texto após erro e atualiza a base local no OK; troca A→B desmonta o dono anterior. O popover de tags limpa foco/estado apenas se ainda pertence ao mesmo atendimento/revisão.

## Execuções próprias

- Unitário, chunk `fb9515`, terminal **exit 0**: 9 arquivos / **236 testes**, `vitest run --maxWorkers=2` com `ContatoCabecalho.interacao`, `ContatoSemNome`, `TagsContato`, `PainelContato`, `InboxNovo.interacao`, `paineis-tags`, `botoes`, `fundo-sobre-pagina` e `identificacao-registro`. Recorte ReactDOM/SSR/guardas, não suíte global.
- Integração, sessão **25150**, chunk final `e9a497`, terminal **exit 0**: 5 arquivos / **54 testes**, duração 165,15 s, `vitest.integration.config.ts --maxWorkers=1`, sem `-t` nem skips. Arquivos completos: `acoes-painel-tags.int.test.ts`, `acoes-painel-tags-pool1.int.test.ts`, `paineis.int.test.ts`, `painel-detalhes.int.test.ts` e `src/server/crm/tags.int.test.ts`. Provedores externos vazios. Banco TESTER liberado ao ROOT para restauração após a saída terminal.

Os resultados do DEV (53 casos em fonte anterior + 15 actions final em sessão distinta, TSC/lint próprios) são evidência externa e não somados aos 54 desta sessão. Visual em browser real, global integrado, publicação/CI e restauração final do banco dependem da coordenação do ROOT; este parecer não homologa a entrega final. A concorrência do boundary de autenticação NextAuth não é demonstrada pelo caso SQL de duas conexões.
