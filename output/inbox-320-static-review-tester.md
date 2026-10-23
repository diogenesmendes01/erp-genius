# QA estática independente — #320

**Fonte exata:** `b5094856c326c4fdf559b1833dbe0827868b591a`, pai `16e3298d9f26d1bdd8ec327bf6acbaec489bb6f3`. Worktree TESTER em detached HEAD; nenhum código de produção editado. Parecer: **favorável ao recorte de código**, sem achado bloqueante. E1/visual/global/integrações continuam pendentes e não são aprovados por este parecer.

## Escopo e contratos

`git diff --name-status 16e3298d..HEAD` mostrou 19 arquivos: remoção de `PainelFiltros.tsx`, retirada dos três testes ligados exclusivamente a ele, migração da asserção `paramsDaUrl({}).toString()===''` para `filtros-url.test.ts`, classes nos quatro contadores, guarda `inbox-e1.test.ts`, testes SSR e documentação. As mudanças em `InboxNovo.tsx`, `page.test.ts` e `opcoes-filtro.ts`/teste de integração são apenas texto de comentário/título. `git diff --check` saiu 0. `git ls-tree` confirmou que o componente removido não está no commit.

- A cobertura da coluna atual permanece em `PopoverFiltros`, `ChipsFiltro`, `SeletorNumero`, `ColunaConversas` e página: setores autorizados, número, filtros rápidos e formato público da URL. O teste da URL vazia foi transferido, não perdido. O teste de integração de `opcoesFiltroInbox` só mudou de título; execução no banco cabe ao integrador.
- `NotaNaThread` e o export do componente `AcoesAtendimento` já estavam ausentes; o arquivo `AcoesAtendimento.tsx`, seu hook e diálogos seguem. `Chip` continua em funil/agenda/configuração WhatsApp e `ItemLista` no sino de tarefas. Os arquivos desses componentes e os mapas de guardas não mudaram.
- `contarNaoLidas` permanece a soma compartilhada por escopo em `consultas-inbox.ts` e mantém o teste por papel em `linha-comercial.int.test.ts`. Não foi confundida com contador pessoal #311 nem com chips #310.
- Comparação de diff restrita saiu 0 para `consultas-inbox.ts`, filtros/contagens, `AcoesAtendimento.tsx`, `ConversaAberta.tsx`, `Compositor.tsx`, `useEventosInbox.ts`, `eventos-inbox.ts`, `Chip.tsx` e `ItemLista.tsx`. Portanto, o recorte #320 não alterou C3, SSE, leitura R6, autorização nem transporte. `sem-polling.test.ts` ainda inclui eventos e selo; nenhuma exceção compartilhada nova no diff.
- Os quatro spans numéricos reais têm `font-mono tabular-nums`: total do `ChipsFiltro`, badge de filtros aplicados na `ColunaConversas`, contagem opcional do `PainelContato` e pílula do `SeloNaoLidasInbox`. O selo em ponto permanece sem número; os testes SSR verificam os spans. `ItemConversa` e `BalaoMensagem` já tinham os dois tokens e são byteiguais à base.
- A guarda E1 verifica ausência dos órfãos/export/cabeçalho antigo, os tokens nas fontes e ausência de `uppercase` no TSX da Inbox. A verificação tipográfica dessa guarda é por arquivo, não por elemento; os testes SSR específicos completam essa prova. Não é um bloqueio nem substitui inspeção visual.

## Execução própria

Node `22.23.2`, `node_modules/vitest/vitest.mjs run`, `--maxWorkers=2`, sem instalação, banco, servidor ou preview:

| Recorte | Resultado |
|---|---|
| `inbox-e1`, `filtros-url`, `PopoverFiltros`, `ChipsFiltro`, `ColunaConversas`, `ListaAtendimentos`, `PainelContato`, `ItemConversa`, `SeloNaoLidasInbox`, `BalaoMensagem`, `sem-polling`, `botoes` | **12 arquivos / 161 testes**, `exit 0`, executor `77cb55`, 8,85 s |
| `SeletorNumero`, `ColunaConversas.interacao`, `page` | **3 arquivos / 24 testes**, `exit 0`, executor `707172`, 2,03 s |

Nenhum filtro `-t` ou skip foi acrescentado. Esses 15 arquivos/185 testes são recorte unitário, não suíte completa; o aviso informativo de `vite-tsconfig-paths` não foi falha. Não executei integração, TypeScript, lint global ou captura visual neste SHA.

## Gates para o aceite final

Aguardar os terminais do integrador para global unitário, typegen/TypeScript, lint dentro do teto de 40 avisos de código e as 15 integrações sequenciais no banco `integracao`. Aguardar o DEV e o integrador concluírem a matriz visual de 20 estados (100 app + 64 protótipo) e o Ready do perfil TESTER para conferência independente de 320×500, focos, rolagem, filtros e contadores. O código pode avançar para esses gates; este parecer não marca a issue nem E1 como homologadas.
