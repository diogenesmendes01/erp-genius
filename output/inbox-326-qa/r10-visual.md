# QA independente — #326, corpus visual R10 v2

Parecer favorável ao estado painel-editar-contato nos seis pares examinados. Inspecionei diretamente os 12 PNG originais em resolução original, incluindo cada comparação APP/PROTO. Não observei problema visual bloqueante dentro de D14. Este parecer cobre a evidência nominal abaixo; não autoriza upload, nova operação ou encerramento automático da issue.

## Fonte e execução nominal

APP 6f92673dfb526e11ad1e349bea484d135819e849. Executor R10 v2 SHA256 e2a22a019a77ab2538a6606d28964c0f0d986680636ad6d4c35651b260d4a53e, pacote 32d808d740fa757e19fb3d8db5c5eaeb723432f1165310f9195062f6e6d8d128, observador readonly c6aa805dd98ee53fabf3070c64789cf9eddffe365396a600a6738d023fbfe363 e política 5458dea681226adcd46dea89858958b42d2f74fd22cb854e4b3a5949877821ea. A revisão offline anterior é nominal a esse executor; o vínculo também consta do manifesto curado. O manifesto bruto não possui campo próprio de hash do executor.

A única operação DEV B foi sessão 39632/c49c9a, EXIT0, run ea18396c-f445-4cae-9f3b-a8af4cd12097. Manifesto bruto: 391.810 bytes, SHA256 2067ad0243a2fda1b8f219f9dba847f243bfc4bee331cf4def2a74cc300f3b54. São seis APP novas e seis referências PROTO reutilizadas, sem Save ou submit nesta rodada; seis contextos e seis browsers fechados.

## Inspeção das imagens e comparação

| Tema | Viewport | Resultado observado no par |
|---|---|---|
| Claro | 1440×900 | Gaveta de 348 px, labels/campos legíveis, rodapé acessível, foco em Fechar; referência inline histórica legível. |
| Claro | 1024×768 | Gaveta de 348 px; data parcialmente sob a dobra inicial do rodapé, alcançável pela rolagem local; comparação coerente com D14. |
| Claro | 390×844 | Gaveta ocupa os 390 px, sem transbordamento horizontal; Horas começa na dobra e demais personalizados seguem no conteúdo rolável. |
| Escuro | 1440×900 | Mesma geometria; contraste de texto, campos e ações preservado, sem alerta ou sobreposição indevida. |
| Escuro | 1024×768 | Mesma condição de rolagem do tablet claro; rodapé e foco visíveis, campos legíveis. |
| Escuro | 390×844 | Largura contida, Cancelar e Salvar acessíveis; referência e APP mantêm leitura no tema escuro. |

Nos seis APP, Salvar aparece desabilitado no estado sem diferença, Cancelar permanece acessível e Fechar recebe foco visível. A fixture mostra cidade confirmada e Horas 2,75: são valores existentes após R9, não alteração feita para a foto. O controle booleano e outros personalizados abaixo da dobra têm prova DOM/alcance; não afirmo que todos os 11 estejam simultaneamente visíveis. Empresa/link são condicionais à fixture; as verificações registradas não exigem um elemento inexistente. Há badge de desenvolvimento Next nas capturas APP, declarado como elemento do ambiente; não editei pixels nem encontrei regra que imponha sua remoção.

D14 permite gaveta modal no APP versus edição inline no PROTO e dispensa alternância B2C/B2B nesta frente. Telefone, avatar, abas, conversa ao fundo e dados fictícios da referência não são requisitos de igualdade literal do editor. As referências são do lote histórico 15503/7c0d12, EXIT0, produto bec9d18e85539398875ca45b58a448d367f5a8b5/harness a54090c1e6dd3c81cca5bd64883e2741c1bb5a09; os seis arquivos foram reutilizados sem recaptura. O histórico não fixava hashes runtime HTML/support: a equivalência física/LF atual não cria um pin retroativo. Referências estáticas não comprovam foco, seleção ou autoscroll.

## Conferência independente dos registros

Usei apenas FS e cópias no worktree TESTER, sem novo browser, HTTP, DB ou Save. O verificador próprio verificar-final.mjs terminou em 88127a, EXIT0, cruzando os seis casos, 12 PNG/dimensões/hashes, seis pares, ZIP e prova ROOT. O leitor preliminar 69b53f falhou por parêntese excedente, erro administrativo sem execução de produto; foi corrigido em 3a53dd EXIT0. Não o conto como gate de produto.

Em todos os seis casos: snapshots DOM antes/depois da PNG idênticos; selo positivo; semântica, valores/checked, vínculo form, estado sem diff, Salvar disabled, tema e labels aprovados; docWidth igual ao viewport; scrollTop restaurado a zero. Os 11 controles tiveram interseção e alcance positivos por rolagem local, inclusive checkbox de 20 px, sem inventar critério de 44 px para o glifo. As 14 verificações de Tab por caso permaneceram dentro da gaveta, com foco interno e modal não inert.

Cada observador readonly registra 6 START/6 settled, zero pendências/Save solicitada e corpo canônico V0 4741dc555950d70fe4b836d24fecf4f28f0c22b4654c20ff3d929712129e37a6. Os abortos de Detalhes sem headers foram associados a GET posterior da mesma URL/contexto/página, 200 com corpo completo e mesmo hash V0. A comparação usa o campo canônico do preflight BE059EB7979F470F9338A1088E010876F8A0EDEF36B83059B48D0D9885C48DA2; não confunde esse hash com o SHA HTTP bruto b9ab3f34addbae40d8cf88ee0f28b7654b05014f5569bf409709fff5182dc825.

A auditoria geral registra 48 START por caso: 47 finitos settled e um SSE separado, thread pronta, sem falhas ou pendências finais. Os seis diagnósticos 953 de Mensagens apontam substituto estritamente posterior, mesma URL, status 200 e corpo completo/hash. Cada SSE teve 1 START/1 terminal real requestfailed, status 200/MIME text/event-stream, enquanto a página estava viva e antes de context.close. O fechamento chamou EventSource.close nativo; a auditoria pós-close conserva 1/1, sem falhas. Handlers/WS também ficaram sem pendências ou falhas. Essa evidência usa ordem de await e flags PageAlive, não um wallclock independente do evento.

Zero Save/submit não significa ausência de qualquer POST: login e incidentais naturais autorizados ocorreram; por caso, um LIDO e duas respostas rápidas. Não houve envio de mensagem, nota ou outra Save de negócio.

## ZIP e preservação

ZIP inbox-326-visual-6f92673-e2a22a01-r10-20261024.zip: 1.219.564 bytes, SHA256 d5f4dd2a35bcdbd30895f5cfe825dcc1d4e81e285d9d462a3428dbab9b1c41ab. Abri e extraí as 15 entradas em cópia TESTER: 12 PNG originais, README, manifesto e índice; sem caminhos de extração externos. Todos os PNG coincidem com o manifesto bruto e índice; total PNG 1.247.576 bytes. Conferi também hashes dos textos e li os três. Não há scripts, raw HTTP, headers, cookies ou credenciais no pacote; a fixture fictícia visível nas imagens permanece. O campo QAIndependente pendente no manifesto curado é o estado histórico da preparação do ZIP, anterior a este parecer; não altera o binário examinado.

Relato DEV inbox-326-visual-r10-evidencias.md: 3.078 bytes, SHA256 d0e651f3443fff0fa77e61b3b367f1b5cf69ad78f168a521c49900bd90497c7f, coerente com o corpus inspecionado. A prova ROOT pós-R10 foi lida e teve hash conferido: 639debb6f45f954a2f7614f8fdef50994b0169a20aac28db41152701b1b10bea. Ela vincula este run/manifesto, preserva 498 originais/424 hashes e sequências, total 520, os três eventos R9 e valores cidade/número 2,75/booleano false; Save cumulativa 2, zero Save visual. Trata-se da auditoria DB do integrador, não de execução DB minha.

Evidência derivada TESTER: output/inbox-326-r10-operacional-review-tester/verificacao-final-tester.json, SHA256 8c4e4e82fd694919c208910cca15d73eeef7cfe9de6db8744364e7dd79112631; contém os 12 hashes/dimensões e resumo individual dos seis casos.

## Conclusão e limites

O corpus R10 supre a matriz visual do estado painel-editar-contato: três viewports, dois temas e comparação com referência legítima, dentro de D14. Em conjunto com R9, permite separar a prova visual inicial da prova funcional nominal de Save/ACK. A exigência de anexar as imagens à PR continua uma etapa de publicação: este parecer e o ZIP local não comprovam upload nem substituem a autorização pendente dos novos anexos.

R7 continua EXIT1; o candidato c371 permanece negativo e preservado. Não homologo novamente as 39 imagens antigas, não atribuo execução nativa ao commit de composição 798f e não extrapolo este lote admin para uma nova matriz de permissões. Não repeti testes de aplicação ou integração nem executei operação nativa nesta QA FS.
