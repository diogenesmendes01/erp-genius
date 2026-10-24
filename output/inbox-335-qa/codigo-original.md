# QA independente #335 — revisão de código e recorte

Fonte exata: `4c76d200257ea4c3df3707e95100d9180a9efdbc`; base `8e503a72d8e25c5c9244956e975376c3fa351e8a`. Parecer favorável no código, unitários e integração independente no cliente/banco ci-integracao487 preparado pelo integrador. Os 3 arquivos/32 testes INT do DEV permanecem evidência separada.

- `hrefConversa` produz apenas `/inbox?c=` com `encodeURIComponent` do ID bruto; `agendar=1` só para opção true. O helper não autoriza nem agenda. Os testes cobrem caracteres de injeção de origem/query/hash e Unicode.
- FINANCEIRO e SECRETARIA projetam `matriculaId` da mesma relação já selecionada que fornece `matriculaCodigo`, sob os mesmos gates por papel. `PainelSetor` cria `/matriculas/{id}` só quando ID e código existem, usando o código apenas como texto legível. O destino `carregarCabecalho` exige sessão e `consultarCabecalhoMatricula` revalida o registro.
- Funil usa `/contatos?c={pessoaId}` codificado, rota real existente; `ContatosPage` chama `obterContato`, que exige `contatos.ver` e `escopoPessoas`. A leitura D13 da oportunidade não amplia CRM global. Um link para pessoa fora da carteira resulta em estado de não encontrado, sem projetar a ficha.
- Recorte próprio Node 22: executor `bd86b1`, terminal 0, 4 arquivos/35 testes (href, PainelSetor, PainelOportunidade, contatos/page); executor `24411c`, terminal 0, 1 arquivo/3 testes da rota API de painel. O primeiro comando continha um caminho de rota inexistente e por isso apenas quatro arquivos foram descobertos; foi corrigido no segundo comando e não conto cinco no primeiro. `git diff --check` `4c0293` terminal 0. Tracked clean `8dfda1` terminal 0.

Integração própria: `vitest.integration.config.ts`, perfil `ci-integracao`, maxWorkers1, três arquivos completos `paineis.int`, `paineis-envio.int`, `painel-detalhes.int`, sem -t/skips: sessão `1313`, chunk final `abe79f`, terminal 0, 3 arquivos/32 testes, 99,31s. Banco liberado ao integrador para restauro; não usei o banco TESTER490.

Limites: não executei browser; cliente TESTER490 não é compatível com a fonte487. Não rodei Prisma, migrações, TSC ou suíte global. O painel pode mostrar link cuja página de destino revalide escopo e negue acesso, conforme contrato; não confundo a presença do link com autorização do destino.

