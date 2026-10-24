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

## Integração e regressão global — correção do classificador

Integração DEV27437/37989e no produto2b43b38fc7928bb11555949ea769080459570635: quatro arquivos completos/44 testes,191,96 s,maxWorkers1,perfilci-integracao487/clientE246,sem filtro de nome ou skip imposto,EXIT0. Banco liberado ao ROOT depois do terminal, sem restauro pelo DEV. Os arquivos foram exatamente os quatro propostos acima. Esta prova é nominal2b43, não execução nova depois da correção de teste abaixo.

Global inicial63868/10d9c0: EXIT1,928 arquivos/7.327 testes,7.326 pass e um finding em enums-rotulos para GavetaContato.tsx:69. A cadeia associa TipoCampoPersonalizado ao atributo nativo input.type, com number/date/text; não é rótulo visível. A fonte da gaveta era idêntica a bec9/7721. A camada de enums crus já considera type não textual, mas o detector independente de mapas não distinguia esse contexto. Não mover valoresHTML para labels nem acrescentar exceção por arquivo/nome.

TDD aprovado pelo ROOT somente em src/app/enums-rotulos.test.ts. RED21068/6f625b:138 casos,duas falhas esperadas (finding real e autotesteinputtype),136 pass. Sete negativos continuam detectados: texto em p,title nativo,type de componente simples/composto,folha fora do conjunto técnico e mapas indiretos por variável/função. GREEN29414/22e1db:138 casos completos,24,67 s,EXIT0. Tentativa13fe2f parou no assert do editor por EOL, antes de escrever fonte; não foi gate nem defeito de produto.

O fix reconhece exclusivamente a expressão direta em input nativo,type,com todas as folhas literais no conjunto fechado number/date/text, incluindo parênteses. Componentes, texto e indireções não são automaticamente isentos. Arquivo inteiro e listas de exceções permanecem ativos.

Verificações finais: cinco arquivos completos de guardas relacionados/166 testes em19491/b15d9a,20,58 s,EXIT0; TSC22929/ebb842,heap8192/incrementalfalse,EXIT0; lint do guard/zeroavisos e diff0d33d0,EXIT0. Global novo31619/1192b5:928 arquivos/7.335 testes,254,29 s,maxWorkers2,sem filtro de nome/skips impostos,EXIT0. Configuração unitária exclui INT. Os17 arquivos APP/servidor/testes da composição e schema/deps/harness continuam byteiguais ao freeze2b43; somente a trava compartilhada foi corrigida. Não houve nova integração por produto inalterado.

B1/cache do hook e C1/fallback de telefone da revisão325 são responsabilidade ROOT e ainda não integram esta fonte. Nenhum hook/labels/Gaveta/CLI foi editado nesta correção. Nova prova Save/visual aguarda esses deltas coordenados e GO operacional; observador/helper/blueprint permanecem privados, sem HTTP/UI/apply DEV.
