# Inbox #325 — composição de Detalhes e participantes B2B

## Publicação independente sobre main

Composição `6cf10369c3a230338a9fec2dc858a39efd4da759` diretamente da main confirmada `239ed17fde1593f2e96fde53a01851f48ed13f86`. A #325 não depende da #337 e não transporta seu código, schema ou SQL. O único conflito era no quadro: preservada toda a base main e acrescentado somente o bloco325. Prova `321d3f`, saída0: nove blobs do produto iguais a ddf e quinze do harness iguais a364, schema487 OID `1f575691cde242124c1493b8406121e8830a6f7e`. Diff-check contra essa base exata passou; a referência main local antiga não é usada para aferir o diff.

ROOT preparou client487 próprio (`52313/608dbb`, saída0, 66,13 s), Next typegen e comparação física com schema oficialmente formatado (`7b4467`, saída0). Perfil integracao exclusivo ROOT; banco descartável restaurado ao snapshot494 com424 hashes antes dos testes.

Gates desta composição direta main, todos com saída0:

- Global `44608/1c11ad`: **925 arquivos/7.263 testes**, 253,13 s, maxWorkers2, sem filtro de casos ou skips; configuração unitária exclui integração.
- TypeScript `45028/0c3842`: heap8192, sem diagnóstico.
- Lint global `2885/82e0cf`: zero erros/40 avisos herdados, teto40.
- Integração `19236/262081`: três arquivos completos/41 testes, 179,18 s, maxWorkers1, sem filtro de casos ou skips; painel-detalhes, paineis e atalhos. ROOT restaurou o banco após o terminal (`dae674`, saída0),424 hashes/snapshot494 preservados e nenhuma outra atividade.

Os dois pareceres integrais do TESTER, nominais às preparações abaixo, estão no [índice de QA](inbox-325-qa/indice.json), com hashes físicos e GitLF. A identidade dos nove blobs APP sustenta a aplicação desses pareceres ao produto; não substitui QA do harness posterior ou da visualização.

## Preparação histórica com a base337

Preparação sobre `419b694f`, fonte da PR #416 ainda em revisão R1; esta base não representa merge em main. Produto selecionado de `ddf872e13078fb48c7648da9c2fc48b1d3f29438` (nove paths), harness de `364fd5112b99767bff001c3f635df02828685e34` (15 paths). Os blobs de produto foram conferidos em `c6b5a8`; o porte do harness e dos dois documentos finais foi `bf2191`. Nenhum schema, SQL ou dependência foi alterado pela #325; a preparação usa client/banco490 da base #337 e preserva os consumidores dessa frente.

A aba comercial mostra Pessoa/empresa e participantes autorizados, com links produzidos pela #336. Convite contextual D13 permite dados da ficha, preservando capacidades de escrita e de acesso global ao CRM. O cartão de oportunidade leva ao Funil; a aba completa é #327. O hook de leitura é único e será reaproveitado pela edição #326. O rótulo genérico Documento da empresa e o teste de RUT chileno pertencem ao ajuste LATAM separado `ddf872e`; dados/documento/nascimento da Pessoa permanecem na #340.

## Gates desta preparação

- Global ROOT `46990/1044e6`: saída0, **932 arquivos/7.323 testes**, 214,56 s, maxWorkers2, sem filtro de nome ou skips; integrações são excluídas pela configuração unitária.
- TypeScript ROOT `14294/5a46e0`: saída0, heap8192, sem diagnóstico.
- Lint ROOT `92429/b3917a`: saída0, zero erros/40 avisos herdados, teto40.
- Integração ROOT `2419/dbba76`: saída0, três arquivos completos/41 testes, 144,92 s, maxWorkers1, perfil dev-gravacoes490 exclusivo. Arquivos painel-detalhes/paineis/atalhos, sem filtro ou skips. Banco restaurado `17f5d4`, 424 hashes/snapshot337B preservados.

O TESTER validou independentemente o produto exato ddf: UNIT69/726 (`74322/691eb2`, 20,94 s), INT3 completos/41 (`38918/b98407`, 146,34 s), TSC (`17401/2f198a`) e lint9 (`ccd896`), todos saída0. Perfil integracao487 próprio, snapshot494 restaurado `87a547`. Parecer físico `A9D9519708F93855DE4C53CC3B0DE7ADD5B285B2AB8170B10C71435B9149BA52`; não é QA do harness posterior ou da preparação490 ROOT. A estática preliminar0558 permanece nominal àquela fonte.

DEV/harness364: 16 arquivos/115 testes, TSC/lint/sintaxe/CLIhelp com saída0. A matriz220 preserva as190 combinações anteriores e acrescenta30: Pessoa/PJ APP+protótipo original e convidado somenteAPP. PJ tem referência real c2; autorização por convite não tem equivalente funcional no protótipo. Esses gates são do DEV, não reexecutados por este registro.

## Visual e pendências

O plano original35/15 exigia PaisCL/CLP existente; inspeção READ ONLY confirmou Pais vazio no banco e snapshot. A emenda ROOT explícita, validada pelo PaisSchema real, acrescentou somente um país fictício novo além dos35 registros, 36/16 e total534 mantendo os498 originais. BlueprintRootV2 SHA `b18a21538396e618cc089f11df455a3b260d2313e61acf0e8d77b2ffed20277b`. Aplicador foi lido integralmente: inspect `442fae`, saída0,59 chaves naturais/zero colisões; apply `199807`, saída0, commit confirmado e424 hashes dos originais/sequências intactos. Nenhum país original foi editado. Perfil B ci-integracao487, diferente dos bancos ROOT/TESTER/A, e preview local3111 com transportes externos desativados. Preflight `745b3e`, saída0, confirmou PF/PJ200, convidadoPJ200 com PII contextual autorizada/sem campos restritos ou fichas globais e destinos A200/B404; somente leituras e autenticação fictícia.

A primeira tentativa visual `26ab1b` terminou saída1 e foi preservada: uma PNG candidata, nenhuma aceita, GET Detalhes cancelado. Diagnóstico somente leitura está em curso para provar ou rejeitar recuperação por resposta substituta completa; nenhum erro foi ignorado nem a tentativa chamada de aceite. Contextos/browser dessa tentativa fecharam em finally. Não houve Save, Assumir, notas, mensagens de saída ou integração externa.

Fonte de produto está congelada. Aceite visual, eventual correção dirigida do diagnóstico/harness, QA independente do harness/imagens, gates da base direta main, publicação/CI/comentários/merge continuam pendentes. A #416 não bloqueia essa publicação independente. Não encerrar a issue ou presumir homologação.
