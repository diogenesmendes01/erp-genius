# QA independente #344 — marco 2

Parecer favorável ao marco 2 no commit exato0fdedf47ba900fd8a43c06a20b78fe716e27471f, paiM1c9e710e35a56c9b64366c31b5d292f9b5ae8a516. O recorte autorizado terminou verde e não encontrei divergência nova de EstadoAria, base de filtros ou contagem. O marco 3 não foi iniciado: lista, rota, SSR/API, parser, preferências e apresentação continuam preservados. Este resultado não encerra #344.

## Ambiente e execução própria

ROOT71107a preparou o worktree exclusivo inbox-tester, branch codex/inbox-e3-344-marco2-qa, perfiltester e banco descartável TESTER491 reservado exclusivamente, snapshotf1d15dff/424hashes/1.392registros após restauro7dd18a. Préflight7072a1 confirmou HEAD/perfil e tracked limpo. Cliente próprio490: SHA256647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Não executei install/generate/DDL, alterei schema/perfil/cluster ou acessei browser/HTTP de produto.

Node22 local: C:/Users/Mendes/AppData/Local/hermes/node/node.exe. Comandos próprios no checkout congelado:

```text
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/inbox/estado-aria-sql.int.test.ts src/server/inbox/contagens.int.test.ts src/server/inbox/estado-aria.int.test.ts --maxWorkers=1
node node_modules/vitest/vitest.mjs run src/server/inbox/estado-aria-sql.test.ts src/server/inbox/contagens.test.ts src/server/inbox/estado-aria.test.ts src/server/inbox/where-sql.test.ts src/server/aria/uso.test.ts src/server/aria/permissoes-tela.test.ts src/server/aria/turno/guardas.test.ts src/server/inbox/filtros.test.ts src/server/inbox/permissoes.test.ts src/server/whatsapp/escopo-atendimentos.test.ts --maxWorkers=2
node node_modules/eslint/bin/eslint.js src/server/inbox/estado-aria-sql.ts src/server/inbox/estado-aria-sql.test.ts src/server/inbox/estado-aria-sql.int.test.ts src/server/inbox/contagens.ts src/server/inbox/contagens.test.ts src/server/inbox/contagens.int.test.ts src/server/inbox/contagens-fixture.int.ts --max-warnings=0
```

UNIT:e3121b EXIT0, dez arquivos completos/160testes, 4, 22s, w2. É um recorte próprio, diferente de oito/219 do DEV. INT:sessão48047/iníciode1cdd/terminald0203b EXIT0, três arquivos completos/38testes, 144, 52s, w1; noveestadoSQL, onzecontagens e18preservados de342. Sem filtro por nome ou skips. A mesma sessão foi acompanhada até terminal. Lintsete:964569 EXIT0, sem saída/avisos. Avisos de vite-tsconfig-paths/MIXED_EXPORTS são de configuração, não falhas de teste.

Não repeti global, M1INT ou TSC e não criei TSC auxiliar. Os gates DEV8/219 e3/38, o TSC auxiliarDEV e restauro3564e1 pertencem às suas fontes/executores; não são execuções minhas nem parcelas a somar ao recorte próprio.

## CASE, H/S e paridade com342

A ordem SQL reproduz a derivação e as condições canônicas: encerrado ou grupo→null; handoff pendente→handoff; pausa local→humano; sugestão vigente→aprovacao; global efetivo e elegibilidade→ia; responsável→humano; restante→null. Pausa não é confundida com H resolvido, e sugestão pode permanecer aprovação mesmo com o global efetivo desligado.

H exige motivoHANDOFF, pausa não nula e atendimento aberto; SAIDA HUMANO/CELULAR ou EventoAtendimentoAssumido no mesmo alvo/agregado só resolvem se estritamente posteriores à pausa. IDs globais não são carregados nem interpolados. S é EXISTS deSUGERIDA, com expiração nula ou estritamente maior que o instante compartilhado. Payload não é projetado ou serializado. ISO UTC ligado como timestamp(3) evita a comparação acidental timestamp/timestamptz dependente da sessão.

As nove INTestadoSQL comparam cada linha do CASE à derivação e, para cada um dos quatro estados, ao filtro Prisma342 no mesmo Db. Exercitam globaltrue/false, H sobre sugestão, pausa sobre sugestão, optout, linha com dono, encerramento, HUMANO/CELULAR e AssumidoT−1/T/T+1. ExpiraçãoT−1/T/T+1 passa emUTC/SãoPaulo/Tokyo na mesma conexão, com finally de restauração daTZ. O caso de grupo usa SELECT sintético; não foi gravado atendimento proibido pelo trigger. Os18testes existentes342 preservam a paridade e a migração parcial já aplicada, sem novaDDL.

As junções são singulares Atendimento→Conversa→Número e LEFTContato; filhos de H/S ficam emEXISTS. Múltiplas sugestões/Eventos não multiplicam atendimentos. NULL é preservado em todas: todas inclui linhas sem classe, enquantos os quatro estados não incluem null. As classificações e os marcadores SLA/fila se sobrepõem; os sete chips não formam uma partição.

## Contexto, base e agregado único

carregarContextoListaInbox clona o instante e reutiliza situacaoAria, estadoOrcamento, ariaAtivaGlobal, capacidadesAria e escopoAtendimentos no Db recebido. Não reescreve regras de papel/convite/carteira nem chama carregarContextoAria sem IDs para obter H global. ConfigIA conserva o upsert legado do orçamento; inclusive contexto vazio não é uma promessa de leitura sem escrita. Estado bruto e pausa retornados na faixa permanecem distintos de versão/orçamento usados no global efetivo. podeGerenciar deriva de capacidadepausar, sem conceder ação.

resumoComContexto combina o escopo autorizado com o tradutor fechadoM1 e executa uma queryagregada com seteCOUNTs: todas, ia, aprovacao, handoff, humano, semResposta, naoAtribuidas. Não são setePromise.all de contagens. O contexto tem cargas próprias de situação/versão/orçamento/ACL; uma query de sete totais não significa um único roundtrip para toda a requisição. O teste de chamadas observa uma agregação por chamada, com contexto reutilizado sem repetir as cargasglobais;301handoffs adicionais também resultam em apenas uma queryagregada, sem cap/N+1 de consultas por atendimento.

A base remove aria, prazoEstourado e responsável somente quandofila. Preserva eu/ID, setor, número, status, busca e não lidas pessoais. O teste A–G exige totais7/IA2/aprovacao1/handoff1/humano2/SLA1/fila3; FINANCEIRO paraAdmin=1. Vendedor recebe somente os dois autorizados. Termo único de telefone=1 e termo ausente=0 tornam a busca observável; “Contato A” casa os sete por sua semântica canônica de palavras, sem ajuste artificial do produtor.

SLA exige prazo estritamente anterior ao instante, primeira resposta nula e atendimento aberto. Fila exige responsável e encerramento nulos. Remover fila da base nova não altera a regra dos cinco chips legados, que continuam sem delta. COUNT chega com bigint e é convertido somente se não negativo e atéNumber.MAX_SAFE_INTEGER; tipo inesperado/overflow lança, sem truncamento int32, zero ou arredondamento silencioso. O UNIT cobre as bordas válidas e recusadas.

Não lidas preserva os três ramos canônicos porEXISTS: preferência marcada; contadorcompartilhado positivo semleitura pessoal não nula; ou entrada posterior à leitura pessoal. Preferência de outro usuário não substitui a atual, e a mensagem tem o atendimento correlacionado. O teste compara ao helperPrisma canônico e alterna igualdade/posterioridade da entrada. Sem lista globalcomLeitura e sem nova definição de não lida.

Pool1 lê carteira e pausa global não commitadas no mesmo Db, exige os totais esperados e confirma rollback fora da transação. O envio usa escopoAtendimentos(enviar:true), sem substituir ACL por estadoAria. MesmoDb e contexto reutilizado não prometem snapshot serializável universal sobREADCOMMITTED; a carteira mantém seu relógio canônico existente. Não fiz EXPLAIN nem alego custo de execução universal pelo número de roundtrips.

## Suplemento de papéis e negativo do executor privado

Por não haver atorProfessor/Financeiro/semEscopo diretamente nos onze casos do agregado, preparei um único caso privado suplementar, sem editar SRC. A primeira configuração usou mergeConfig: a versão instalada CONCATENA arraysinclude, ampliando indevidamente o recorte. Isso foi erro da minha preparação. Interrompi a sessão28428/f0e49a porCtrlC, terminal179a73 EXIT1, antes de qualquer alegação verde. Não há contagem confiável de casos executados nessa tentativa e não afirmo que zero casos ou zero mutações de fixture ocorreram. O log e a configuração ampliada foram preservados; não são evidência de produto aprovado ou falha de produto.

Antes de outro executor, confirmei ausência do runner privado e workersVitest/tinypool próprios do worktree porCIM (b92c43/5b8192 e37200/3fd5e6, EXIT0), sem tocar cluster/processos alheios. A prova535872 em memória confirmou a concatenação. Corrigi somente a configuração privada para spread do original com include literal sobrescrito, conservando ambiente, setup, perfil efileParallelism. Vitestlist com arquivo explícito/--filesOnly--json terminoueb4c12 EXIT0; o JSON de coleção contém exatamente um arquivo e foi conferido em9f48f1. A CLI de execução também recebeu esse único caminho explícito.

```text
node node_modules/vitest/vitest.mjs list output/inbox-344-marco2-papeis-private.int.test.ts --config output/vitest-inbox-344-marco2-papeis-private.config.ts --filesOnly --json=output/inbox-344-marco2-papeis-colecao-tester.json --maxWorkers=1
node node_modules/vitest/vitest.mjs run output/inbox-344-marco2-papeis-private.int.test.ts --config output/vitest-inbox-344-marco2-papeis-private.config.ts --maxWorkers=1
```

Execução corrigidaf5990f EXIT0:um arquivo/um caso, 6, 27s, w1, sem filtro por nome/skips. Professor sem contexto retorna setezeros; convite de leitura na pausaE dá umahumano e enviotrue dázero. Financeiro próprioG vê umhumano/podeGerenciarfalse; desatribuirG permite fila1 e mantém eu0; númeroinativo nega enviotrue mas conserva leitura1. UsuárioALUNO semcontexto retorna setezeros e não recebe gerência. Esses são controles adicionais num único caso, não 38+umteste de uma sessão única ou ampliação do produto.

Após f5990f liberei explicitamente TESTER491 ao ROOT, sem executorDB ativo ou acesso posterior ao banco. Restauro/constância final são prova posterior do integrador. Nenhuma execução negativa foi apagada, reclassificada ou usada para dispensar o restauro.

## Identidades e limites finais

Verificação própriae8cac9 EXIT0 por trees/cat-file:dezpaths no delta, seteSRC todos novos, 5.764arquivos versionados existentes fora do delta iguais ao pai. M1/342/343, ACL/CRM/uso, lista/API/SSR/InboxNovo, parser, schemas/SQL/deps/scripts/workflows continuam literais. M1where-sql permaneceSHA94ab79b2674d9ee2e7b46f9e00a563981d6306ff5cc8c5968c55531962841abf. Git diff --check0 e tracked limpo. Recibo identidade:4.044bytes/SHA256 e1d58942883981e9f9a56c6b34c8b728b83aa524358caf9c2b4fb55f29c17ef9.

Gates/coleção/negativos e hashes dos artefatos:output/inbox-344-marco2-gates-tester.json, 3.092bytes/SHA256 b7d14a6df2c7ad66309ce457ffc67df52a68c049b638dc644947adaf866830cd, verificação81abf8 EXIT0. Os negativosDEV porstub/módulo ausente e o caso19/20 com expectativa de busca equivocada permanecem históricos distintos e não são convertidos em verde.

Nenhum achado bloqueante novo de produto no marco2. Marcos3/integração da lista antes de paginação/SSR/API/apresentação, CI e encerramento344 continuam pendentes de GO e provas próprios. Este parecer não aprova novaACL, UI, integração externa ou uso posterior do banco.
