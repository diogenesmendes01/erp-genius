# Inbox #326 — retomada sobre Detalhes/B2B325

Composição DEV local revisável, sem homologação. Branch `codex/inbox-e2-326-retomada`, base `d775a140b824e56307d50d95d7bb0ad5284a5f6e`. Fontes originais: implementação09498f4d09fadcbd9d07241b10f87d22fdedb864, foco2de9d10b82b52a5d6b1492d3553eec4d3551c22c e Retrybec9d18e85539398875ca45b58a448d367f5a8b5. Não foram portadas histórias agregadas335/336, harness antigo202,326 visual,327/328 ou o Retry duplicado6e552.

## Composição e contratos

Dos18 pathsSRC iniciais, dois já existiam idênticos: hook `1b7c10d948eff1207feb2bc0d4a4a5b2e3634ef9` e teste `043ff1162a1791cc50bbf48909eb7b636881ddcc`. Foram portados16, mais o delta no teste de foco:17 arquivos finais de código/testes. CRM contatos/campos e actions-painel eram iguais ao pai09498; receberam somente os deltas originais de núcleos transacionais, lock e revalidação, mantendo C5/tag/permissões existentes.

InboxNovo teve três conflitos locais: imports, composição da aquisição e cabeçalho. A resolução conserva AbaDetalhes/B2B325, subtítulo/avatar do DTO e hrefs336; acrescenta GavetaContato e uma única instância de leitura ativa por Detalhes OU editor. Não se escolheu incoming inteiro. Foco2de9 foi inserido como bloco exato; Retrybec9 aplicado uma vez. PainelContato deixa a posse modal para Drawer enquanto o editor está aberto. Nenhum shared helper de diálogo foi alterado.

Backend resolve Pessoa por contexto autorizado, exige CAS pessoaIdEsperada e revalida identidade/ator/escopo após lock dentro da mesma tx. Empresa não pode ser alterada por essa action. Validação, pessoa/campos/Eventos e aviso são atômicos; no-op e rollback mantêm seus contratos. Cliente preserva snapshot/rascunho, bloqueia duplicação e ignora ACK de sessão desmontada. Esta é composição de implementação existente; não foi identificado novo defeito de produto nesta fase.

## Verificação atual e negativos separados

| Execução | Escopo | Resultado |
| --- | --- | --- |
| 58097/0154ce | 74 arquivos/700 testes Inbox cliente, servidor e rotas | EXIT1:698 passaram, dois testes de foco326 falharam por IconMail ausente no mock antigo ao renderizar AbaDetalhes325. Erro de fixture; nenhum guard retirado. |
| 7ea9bc | Seis arquivos completos: foco/interação/Painel/Gaveta/form/hook | EXIT0,137 testes,1,88s, sem filtro de nome. Mock de ícones completado. |
| 9b2bc8 | Mutação temporária e teste causal de composição | Ativação somente editor produziu EXIT1, pois faltava o GET de Detalhes anterior ao lápis. Fonte restaurada byte a byte; GREEN1 com87 ignorados pelo filtro. É diagnóstico de regressão do porte, não suíte completa. |
| 36669/655668 | Recorte integral final dos mesmos74 arquivos | EXIT0,700 testes,20,87s,maxWorkers2, sem filtro de nome ou skip imposto. Abertura do editor mantém uma aquisição e o mesmo DTO no painel/editor. Não é global unitário nem integração. |
| 30703/c2b8d7 | TypeScript completo | EXIT0,--noEmit --incremental false, heap8192. |
| a85cb1 | Lint dos17 arquivos alterados/novos | EXIT0, warnings máximos zero. |

Os gates foram observados até terminal. A configuração unitária exclui explicitamente *.int.test.ts. Nenhuma integração ou acesso ao banco ocorreu nesta fase. Perfil estático ci-integracao; schema Git `1f575691cde242124c1493b8406121e8830a6f7e`; cliente próprio B Prisma5.22.0, schema físico do cliente SHA256 `e24658b28818cf2bd124071f3ea41c7682b03581de9bb27a1ea122388e297200`. Fonte e plano privados foram inventariados em dbc51b, sem carregar PrismaClient ou abrir conexão.

## Integração e prova Save pendentes

Proposta de quatro arquivos completos, em um comando/um worker e somente após nova lease ROOT: src/server/inbox/acoes-painel-contato.int.test.ts; src/server/inbox/acoes-painel-contato-pool1.int.test.ts; src/server/crm/ficha-contato.int.test.ts; src/server/crm/campos.int.test.ts. O pool1 usa connection_limit1 e frescura por tx. Gates históricos09498 de4/44 não são reatribuídos à nova base.

Parecer independente histórico7721 (SHA5E33D786…EB8938) e parecer A foram lidos. O gate Save2588/2bca76 permanece EXIT1: duas Saves reais pontualmente bem-sucedidas, POST503 controlado, persistência, rascunho B e ACK antigo não demonstram retrospectivamente a causa de dois GETs abortados sem cronologia. O diagnóstico posterior847139 é distinto e não reclassifica os eventos antigos. As39 imagens/13pranchas e27 positivos ficam nominais bec9/a540; não foram copiadas ou atribuídas a esta base.

O plano privado `output/inbox-326-save-retomada-plano-private.md` propõe uma Save real nova com ACK original retido, dois contextos e versõesV0/V1 correlacionadas por request/session/ordinal/body/hash. A mesma Save pode comprovar commit, SSE/rascunho B e isolamento do ACK antigo após reaberturaA2. Não propõe repetir duas Saves nem fazer503 UI sem necessidade. O coletor estático96c tem um hash único e permanece intacto; o observador326 por fases exige coordenação antes de qualquer implementação. IDs/credenciais/action/fixture/preview dependem de GO concreto ROOT. Não há nova UI, Save, HTTP local, fixture, canônica, mensagem, integração externa, DDL ou dependência.

SPEC e quadro refletem integração, nova evidência visual/Save, QA independente, composição, CI e publicação pendentes. d775/96c, ZIP325, negativos e fontes337/336 foram preservados. Comuns scripts/visual continuam A327; não alterar fonte durante QA do commit congelado.
