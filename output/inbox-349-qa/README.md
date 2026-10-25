# QA independente #349

[Parecer integral](codigo-cb285.md), [índice e limites](indice.json) e [identidade da composição](composicao.json). Sete SRC iguais à fonte testada; revisão independente favorável2UNIT/30 e2INT/44 completos, lint7. ROOT TSC original/lint global aprovados, bancos restaurados. Recortes não são somados.

Os negativos DEV de integração ampla280/282 e lint global privado não são apagados; busca UTC é a issue423 separada, orçamento inconclusivo. CI da publicação pendente. Sem nova UI, envio externo ou homologação visual.


### Composição com main343/423 e correção de expectativas349
BaseMain170edbad. Merge5b50cb4b+correção d9b1b08e (origem14337900),oito pathsSRC contraMain:sete originais349 byteiguaiscb285/b292 e umteste comquatro literais aditivos. Produção não mudou;toEqualcompleto preservado. Fullb29240140932662 terminou EXIT1:349arquivos/3.117passes,1arquivo/2falhas,3arquivos/4casos optin ignorados. Falhas emSECRETARIA/PEDAGOGICO de paineis.int porausência de cartoes[]/podeDecidir:false;as outras duas expectativas ainda não eram alcançadas. REDlocal11/13EXIT1 eGREENcompleto13/13EXIT0(58,07s),lint1EXIT0,restauroROOTcf2a26EXIT0. Main343/423preservada,quadroMainintegral. Provas públicas no QA:composicao-main343.json eci-full-b292-negativo.json. TSC/lintoriginaiscombinados e novaCI/full ainda pendentes neste checkpoint. Não concluir349 nem apresentar full anterior como verde.


Atualização dos gates da composição: TypeScript original terminou com código0 (sessão28227,terminala6beb3), sem exclusões auxiliares e sem incremental. Lint global terminou0 (sessão42789,terminal5d9ca8), zero erros e40avisos herdados. Nenhuma fonte foi alterada durante essas execuções. CI e integração completa da nova composição permanecem pendentes.


### Integração completa aprovada no código23fb
A nova integração40144382961 terminou com quatro shards aprovados:350arquivos/3.128testes;trêsarquivos/quatrotestes opt-in ignorados, declarados separadamente. Terminal32578/3fce24 EXIT0 e conferência45436/a19dd2 EXIT0. CI rápida40144356996 também aprovada5/5,939arquivos/7.457UNIT em cada fuso. [Registro dos jobs e fontes](ci-23fb.json).

O negativo anteriorb292 continua preservado com suas duas falhas;os quatro literais completos foram corrigidos e a nova execução combinada incluiMain343/423. Revisão independente23fb favorável e comentáriosR1C1–C6 tratados. Este fechamento altera somente documentação;as oito fontes/testes permanecem23fb. A CI do filho documental e o merge serão conferidos antes de encerrar349.
