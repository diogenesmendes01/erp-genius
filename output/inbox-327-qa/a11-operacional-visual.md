# QA operacional e visual independente #327 — A11

Favorável aos seis APPleitores novos, individualmente e ao lote nativo A11, dentro do escopo e limites abaixo. Inspecionei TODOS os seis PNGs originais em resolução original e auditei os registros brutos, não apenas o resumo. Não identifiquei problema visual bloqueante concreto. A composição proposta é mista:6APPadmin A7 +6PROTO A9 +6APPleitor A11; não é uma execução nova18 de um único executor. Isso não encerra327/328 nem presume composição em main, CI, curadoria, publicação ou autorização de anexos.

## Execução nominal e integridade

Execução feita pelo DEV A sob GO ROOT, sessão39668/terminalea44d4 EXIT0, run1a93d06a-02f2-4847-a0c4-93875c1d75a4. APP ebf7675d5c7c0397fb9de1a988f78a99c873e37a; HARNESS/CHECKOUT cfa243291d154b445e1dec83f52604589f42a58e; executor51.862 bytes/SHA6ad3b51a4f3ac42ad9612e92f0aadedbc7f4f976f7f276fa9f425d129892941b. Pacote offline73304/7cbd7cf9 e parecer wrapper7102/eecca651 são antecedentes distintos, não novos testes operacionais do TESTER.

Manifesto RAW376.049 bytes/SHA8c2972fd1d1fb7ef943ea663d16d583dc3cc28a5e5c72130217fe6927f250d8f. Marker SHA5aa286bc713a0eaf59941dcecaba06180d9ccf61806d8a1efcd06fa56fc30f1e registra6casos novos,12selecionados anteriores e0mutações de negócio autorizadas. Copiei RAW/marker/seis PNGs para snapshot próprio; terminal3302bb EXIT0 conferiu bytes,hashes e dimensões. Cada imagem é o original byteigual, não crop, montagem ou miniatura derivada.

| Tema / tamanho | Dimensões | Bytes PNG | SHA256 original |
| --- | --- | ---: | --- |
| escuro / desktop | 1440×900 | 95477 | 27c159b4505426a465584df2447cf6f96edd61af37e0964a5ba881d142807df6 |
| escuro / tablet | 1024×768 | 83374 | 3f54288cec56a4810909090bb96aa0a83be92f9b786ffec491f7194abf124109 |
| escuro / celular | 390×844 | 38498 | 5cd04f2070aee504e52925facb56848da6a0d4adb9ef937ea3a2ff27dba07d16 |
| claro / desktop | 1440×900 | 94985 | e95b3e3df1b76dd9e64c72513267a4101c02953b5987252c6fd8da896324ee77 |
| claro / tablet | 1024×768 | 85500 | f0f1759e30548492c26a419a3728c5849a9396eebf3565f10aadbb32bd947fff |
| claro / celular | 390×844 | 38988 | 57a200947b288cd3a1d0243058fca9d4fbf464da478a27eb7492aa9bb1f04691 |

Total dos seis PNGs:436.822 bytes. O verificador próprio verificar-inbox-327-a11-operacional-tester.mjs terminou325bd9 EXIT0. Allowlist individual privada: inbox-327-a11-operacional-review-tester/allowlist-leitor-individual-tester.json,16193 bytes/SHAa869150df34f015b313c4ea0263803df6358030c47fc9461e0d17d7c632daa4a, com fonte/executor/run/hash/dimensões e limites por arquivo.

## Evidência operacional nos brutos

O manifesto final é aceitável true/finalizado true; seis contextos e seis IDs de Page distintos, todos fechados, browsersClosed true. Cada candidato tem falhas vazias e três auditorias positivas após browser.close: core Oportunidades, rede genérica e SSE. Pendentes e handlers0; selos e revisões válidos. Não houve erro console warning/error ou pageerror registrado nos seis casos. Há mensagens informativas de desenvolvimento e badgeNext, que não foram removidos das imagens.

Cada Page executou sete chamadas API preparatórias, separadas das aquisições UI: autenticação GETcsrf200/POSTcredentials302/GETsession200 e quatro GETpreflight200(session/Painel/Oportunidades/Detalhes). Os42 registros não são novas chamadas desta QA. Capacidade moverEtapa false/podeEnviar false, descrição podeMover false/podeAbrirFunil false e href legado do mesmo alvo autorizado. O preflight não representa aquisição pela UI.

Aquisições UI reais somam23:17Detalhes e6Oportunidades. Escuro/desktop tem2+1; demais cinco casos3+1. Os23 registros core têm START e settled, mesma identidade de contexto/Page/atendimento/oportunidade/pessoa/usuário. Headers200/body completo/hash canônico esperado conferidos nos sucessos. Sete abortos Detalhes ERR_ABORTED sem headers são recuperados por requisições posteriores do MESMO endpoint/Page/contexto,200/body/hash esperado e anteriores à mudança de fase; nenhum200 anterior ao aborto serve como substituto. A requisição Oportunidades começa depois da fronteira explícita em todos os casos.

Precisão do contador: transicaoOrdem recebe o valor corrente de ordem sem incrementá-lo. No claro/desktop, o último START Detalhes válido e a fronteira valem48; Oportunidades começa49. Igualdade nesse registro significa o último START anterior à mudança de fase, não um START simultâneo ou posterior. O contrato do coletor usa substituto<=transicaoOrdem, token corrente e ausência de pendências. Minha primeira auditoria impôs < e falhou a5621b; preservei o verificador em verificar-inbox-327-a11-operacional-ordem-estrita-negativo-tester.mjs. Depois da leitura literal c813eb corrigi SOMENTE minha asserção para<=; nenhum coletor, guarda, captura ou comportamento nativo mudou. Não atribuo esse negativo administrativo ao produto.

A auditoria chamada coletaFinita contém290 registros no RAW:284não-SSE +6SSE. O nome não permite contar290 requisições finitas adicionais aos SSE. Cada request tem START/settled e Page/contexto exatos;45 registros no primeiro caso e49 nos outros cinco. Os18POSTs de browser são exatamente três incidentais naturais por Page, respostasRapidasDoCompositor duas vezes e marcarAtendimentoLidoAutomatico uma vez, IDs42hex permitidos e200/body completo. Nenhuma outra action aparece;0Save,etapa,perda,nota,envio. Esse0 refere-se às operações de negócio guardadas, não à ausência total de POST, pois autenticação e incidentais ocorreram.

Sete abortos de mensagens receberam recuperação953 estritamente posterior, mesma URL/identidade,200/body/hash bruto e canônico esperados, apoiada pela prova DOM da thread. Outros sete abortos de painel têm sucessores válidos e são vinculados ao core fechado/selado; não são tolerância genérica de rede. Hash bruto de resposta não foi confundido com hash canônico JSON. As falhas nativas históricas de SSE/header/corpo permanecem negativas em seus próprios lotes.

Antes e depois de cada PNG, DOM do painel e thread retornam true; revisão da rede antes/depois é idêntica. Os selos finais incluem os drenos e auditorias pós-browser, sem novos STARTs, handlers ou falhas tardias. São resultados dos predicados guardados na fonte cfa, não snapshots completos de cada propriedade CSS ou uma nova execução dos testes pelo TESTER.

## SSE real e encerramento

Em cada Page houve1START/1terminal real do request SSE200/MIMEtext-event-stream; terminal requestfailed ERR_ABORTED observado com Pageviva true antes de context.close. O registro genérico do mesmo request traz ABORTO_APOS_CLOSE_EXPLICITO. O helper registra dois objetos EventSource históricos: um já fechado pelo cleanup do produto e uma ativa exata antes do fechamento do harness. Máximo simultâneo1. Depois:0ativas/2CLOSED, close nativo invocado e válido;0URLhistórica inesperada/estado inválido/close inválido/fechada semclose nativo. Não se confundem dois objetos construídos sequencialmente com dois streams simultâneos ou doisSTARTs de rede.

A coleta SSE final mantém identidade e1/1semfalhas depois dos contextos/browsers fechados; rede/core também auditados após esse fechamento. Não houve settled sintético ou simples limpeza de counters. O TESTER apenas conferiu os registros; não abriu nem fechou EventSource/browser adicional.

## Inspeção visual das seis originais

Escuro e claro,1440×900: aba Oportunidades selecionada, avatar/cabeçalho e identificação legíveis, bloco Oportunidade atual/Funil Matrículas, produto,valorR$1.234,56,etapaProposta e três campos íntegros. Select e oito segmentos estão desabilitados; lápis do cabeçalho ausente. A conversa informa que o leitor não pode enviar. Não há navegação global Funil visível no menu desse ator.

Escuro e claro,1024×768: painel lateral ocupa a área própria/recobre parte da conversa conforme composição, sem cortar o conteúdo principal327. Cabeçalho,abas,produto,valor,etapa e campos continuam legíveis. Opt-out inferior fica parcialmente abaixo da dobra; não afirmo que todo o conteúdo está simultaneamente visível nem trato a rolagem natural como clipping indevido.

Escuro e claro,390×844: painel em largura disponível, avatar/nome/subtítulo,abas,produto,valor,select e campos cabem sem estouro horizontal perceptível. Oito segmentos mantêm layout compacto. Cadastro e Editar nome aparecem abaixo do bloco; demais ações podem exigir rolagem. BadgeNext fica no canto inferior e é preservado; não afirmo foto limpa ou cobertura integral de todo o footer. Nenhum texto ou controle crítico novo327 está obstruído nas seis imagens.

Abrir oportunidade e Editar nome pertencem ao slot legado Cadastro, não ao novo bloco327 ou à capacidade global funil.ver/editarContato. O link contextual corresponde ao href/ID do preflight; não concede mover etapa ou escrita327. A permissão do antigo Editar nome é um contrato distinto do lápis novo ausente. A inspeção não clicou esses controles nem presume autorização de destino sem revalidação. Não foi encontrada divergência visual nova em relação a esse contrato.

## Corpus misto e limites preservados

Reconferi hashes/bytes dos12 históricos contra os originais já copiados e inspecionados anteriormente, sem reabrir testes invariantes. Seis APPadmin A7 continuam nominais9480/APP EBF/executor35edd606, com allowlist1c8fe087 e parecer831f8678. Seu reuso é qualificado por fonte/render/fixture e não aplica retroativamente checks novos de href/slot/fronteira. BadgeNext sobre parte do link mobile permanece limite. Agregado A7 continua EXIT1.

Seis PROTO A9 continuam nominaisbe45/APP EBF/executor a4b945b7/allowlist a271225d, com congruência forte literal do caminho PROTO. Referência estática, com diferenças reais de fixture/valor/etapas e rolagem natural; sem prova funcional de foco/autoscroll/seleção. Agregado A9 continua EXIT1. A10 permanece EXIT1/0PNG, sem diagnóstico de causa exclusiva e sem fornecer imagem ao corpus. Nenhuma PNG diagnóstica ou negativa foi certificada por esta allowlist.

Os seis novos leitores são nominais A11/cfa e possuem a nova prova positiva completa. Portanto a allowlist pode compor18arquivos selecionados, sem apresentá-los como um run18 único nem apagar os agregados negativos de origem. As qualificações e o adendo ancestral continuam vinculados aos certificados cfa/f5bd e wrapper/eecca.

Auditoria DB pós-A11, parada de preview/restauro e curadoria/publicação são responsabilidades separadas do ROOT. Na hora deste parecer não executei consulta para confirmá-las nem presumo sua conclusão. Não houve browser, HTTP, DB, teste repetido, Save, nota ou edição de fonte por mim; checkout423/cliente490/perfil continuam preservados e sem lease. Nenhum upload foi feito ou autorizado por esta QA.
