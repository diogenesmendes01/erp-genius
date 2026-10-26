# Inbox #328 — visual R5 e correção do harness R6

A matriz visual completa da PR #432 passou em uma execução de 30 capturas: 24 do aplicativo e seis referências estáticas do protótipo, em dois temas e três larguras. O código produtivo capturado é `7fc073e5d272ea2090aa3d1aa9070ff8526457bc`. A composição parte de `97642299013406f669049d6647bef3b135d122cc`, preservando seus dois Markdown e a base main após o merge da #327.

Esta atualização incorpora ao harness rastreado as correções que permitiram concluir o lote. Nenhum arquivo do aplicativo, contrato, schema, pacote ou configuração foi alterado.

## Correções e contraprovas

- O título do cartão do protótipo exige o ícone do cabeçalho e visibilidade; o texto invisível dentro de `option` não compete com ele.
- O badge do protótipo identifica o contêiner colorido, preservando a rejeição do badge transparente e do status incorreto. O span de texto interno não cria uma duplicata.
- Produto e preço do protótipo são buscados nos ramos anteriores ao seletor de etapa. O campo Produto posterior não mascara um cabeçalho errado; duplicatas no próprio cabeçalho continuam recusadas.
- Depois de preencher a observação de perda, o driver aguarda `scrollIntoViewIfNeeded()` do botão de confirmação, sem clicar nele, antes do mesmo predicado estrito. A falha da rolagem é propagada. No celular, essa ação revela os oito pixels de rodapé antes cortados, preservando os nove motivos, a observação, os botões e o foco.

O HTML/DOM original do protótipo, o timeout, os critérios de geometria, visibilidade, estado e permissões foram preservados. As funções rastreadas `semanticaAcoes328` e `preencherPerda` são literais às funções do driver privado R5 que produziu as capturas.

O arquivo completo `src/test/visual-inbox-acoes-oportunidade.test.ts` tem 179 casos. Antes da implementação: sete falhas causais e 172 controles aprovados. Depois: **179/179, código 0** (`6fe3c8`). As nove regressões novas cobrem as duplicatas reais, o escopo do cabeçalho, os controles negativos e a ordem preencher → revelar → predicado, sem confirmação. O lint dos dois arquivos alterados terminou com código 0 (`191ca9`). TypeScript com a configuração original e heap de 8 GB: **código 0**, sessão73303, saída `a4e7e4`. Nenhum include/exclude foi alterado.

A primeira tentativa do RED falhou no cache temporário do Vitest por `EPERM`, antes de coletar testes. O RED acima veio da repetição do mesmo comando com acesso ao cache. Foram usados Node22.23.2 e Vitest4.1.11 locais, sem instalação. Propostas e caches históricos TypeScript não rastreados foram preservados com sufixo `.txt`, sem alterar includes/excludes. Os 17 testes privados focais anteriores não são somados aos 179 como uma suíte adicional independente. Não foi executada regressão global nesta atualização.

## Capturas, fontes e limites

Execução R5 `006af5b0-e6d0-4ed2-a465-81abfe3aeea3`, sessão7518, saída `d53ccc`, código 0. Todas as 30 capturas têm bytes e SHA256 conferidos, semântica antes e depois positiva e auditoria de rede/painel aceitável. Orçamento: 24 logins fictícios, 168 requisições de autenticação/preflight e 54 RPCs naturais permitidos. Nenhuma perda foi confirmada; nenhuma etapa, nota ou mensagem foi enviada ou salva.

Identidades do harness privado efetivo:

- Driver R5: `8c0e40ff9365eea4592a59e0b39ccad668fd158d598fa9434c6ef1f7bc2c7f13`.
- Entry R5: `f5ea4c300bba3d264a660d4685f5bd58a0ecf5d73e203d2641b071ca63fdb5ec`.
- Ready R5: `2d23da0076dc178ac7a8045a296df5970cfbace297d536194936de4a7bcea51c`, com 148 pins, 27 recursos APP e 24 PROTO.
- Arquivo rastreado corrigido: SHA256 `3f040254657e4f3c5e6cad62dec60997c51f489b5e47b0bad57877be6ab4a679`. Este commit identifica a nova fonte do harness; o campo histórico de fonte do manifesto não substitui os hashes privados acima.

R1–R4 negativos e os diagnósticos permanecem preservados, separados do lote completo R5. As 14 capturas positivas de R4 não foram somadas a R5. Os diagnósticos APP registram erros de cleanup porque não selaram o fluxo completo; todas as auditorias finais do lote formal R5 passaram.

A inspeção própria cobriu as 30 imagens e três celulares em resolução original. O integrador informou parecer independente favorável do TESTER, com ressalva: o badge do Next em modo desenvolvimento sobrepõe parcialmente o canto do botão **Voltar nos dois temas do celular**. A legenda continua legível e Confirmar está livre. Isso **não comprova clique na área coberta**. Não houve edição do DOM para ocultar o badge. As capturas inferiores também não mostram o cabeçalho inteiro na mesma imagem; o protótipo é referência estática, com dados e campos distintos. O relatório independente próprio deve acompanhar a revisão final.

## Banco e evidência para anexo

Auditoria pós-captura `4c7433`, código 0: 426 tabelas, 506 registros originais e sequências preservados; 520 registros totais, correspondentes à fixture518 e duas preferências naturais permitidas. Apenas `ultimoAcesso` dos dois atores novos pôde variar; zero listeners, outros atores ou escritas da auditoria. O preview próprio foi encerrado por Ctrl-C, com código1 de interrupção; isso não é um teste aprovado nem uma falha da matriz. O integrador informou a restauração do banco ao snapshot B500/506 e sua reserva para outra frente. Nenhuma nova operação SQL, servidor ou browser foi executada na incorporação R6.

ZIP local preparado: `inbox-328-evidencias-bd6f-r5.zip`, 2.825.077 bytes, 32 entradas: 30 PNGs fictícios, README e manifesto. SHA256 `b012e8d2c0c20d827f39c7c0e2e095f96cc99b0441f00dc11d75f8983edab784`; manifesto `f3bf6e772105f9411b8ae510979703766115e28e74ad949f2a77ba17a51dd22f`. Não contém credenciais, cookies, headers ou rawHTTP. Nenhum upload foi realizado por esta frente.

A CI do head anterior `97642299` teve cinco jobs SUCCESS em [40378726467](https://github.com/diogenesmendes01/erp-genius/actions/runs/40378726467). Isso não equivale à CI do novo harness. A PR continua em rascunho até o anexo autorizado, a revisão e os cinco checks do head final. O integrador conserva a responsabilidade pelo anexo, ready, merge e confirmação do fechamento da issue #328. Nenhum deploy foi realizado.
