# Inbox #325 — composição de Detalhes e participantes B2B

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

Nenhuma captura325 ou preview novo foi executado. O plano original35/15 exigia PaisCL/CLP existente; inspeção READ ONLY confirmou Pais vazio no banco e snapshot. A emenda ROOT explícita, validada pelo PaisSchema real, planeja somente um país fictício novo além dos35 registros, 36/16 e total534 mantendo os498 originais. BlueprintRootV2 SHA `b18a21538396e618cc089f11df455a3b260d2313e61acf0e8d77b2ffed20277b`; não aplicado. Nenhum país original será editado, nem haverá notas, mensagens de saída, Save ou integração externa. O helper e a aplicação aguardam inspeção ROOT.

Fonte e gates estão congelados. Aceite visual, QA do harness/imagens, base final após a revisão da #416, publicação/CI/comentários/merge continuam pendentes. Não encerrar a issue ou presumir homologação.
