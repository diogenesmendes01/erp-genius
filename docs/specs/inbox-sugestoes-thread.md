# Inbox #349 — cartões de sugestão e decisão idempotente

O servidor acrescenta `podeDecidir` e `cartoes` a `AriaDoAtendimento`. O produtor depende de #342 e prepara #350. Não cria interface, rota, alçada, migração ou envio externo; a lista legada `sugestoes` permanece até #353.

`cartoesDaThread(db, usuario, atendimento, agora)` recebe o mesmo Db/transação do chamador. Sem a capacidade atual `decidirHistorico`, devolve uma lista vazia antes de consultar ações ou nomes. O atendimento é previamente obtido pelo servidor sob `escopoAtendimentos`. Cada ação usa sua própria oportunidade; na ausência dela, usa o lead do atendimento. Admin e Gerente Comercial mantêm a alçada atual de `leadsDecidiveis`, sem ampliação de permissões nesta entrega.

O indicador `podeDecidir` obedece literalmente ao lead do ATENDIMENTO. A autorização de cada cartão obedece à oportunidade da AÇÃO ou ao fallback. Portanto pode haver cartão autorizado com indicador falso quando os leads divergem; esse comportamento é deliberado e testado. O indicador não autoriza uma decisão: cada action revalida seu alvo no servidor.

Entram sugestões SUGERIDAS com expiração nula ou estritamente posterior a agora, além de APROVADAS, REJEITADAS e EXPIRADAS cuja decisão ocorreu desde agora menos 24 horas, inclusive no limite. Decisão sem data não entra. A ordenação é criadoEm ASC/id ASC. São devolvidos os primeiros 20 AUTORIZADOS; páginas keyset de 100 candidatos prosseguem até completar 20 ou EOF, sem cap de páginas ou 200 candidatos. A autorização é feita em lote por página e os nomes dos decisores finais vêm em uma única consulta. Não há consulta por cartão.

O DTO contém IDs de ação/turno, ação/status, datas ISO, justificativa, texto opcional, detalhe tipado e decisor/data. O texto vem exclusivamente de payload.texto string. O payload bruto não é exposto. O decoder valida objeto, folhas, enum, datas e números finitos; preserva zero e false nos campos e devolve outro quando não consegue interpretar o detalhe. Os tipos públicos são enviar, agendar, etapa, tarefa, tag, campo, perdido, nota, condicao e outro.

Aprovar e rejeitar preservam a ordem de lock AcaoAgenteIA → alvos do executor. Depois de travar a ação, o servidor relê ativo, papéis e permissões do ator com tx.usuario, sem memo e sem travar Usuario. Esses dados alimentam a autorização local antes do escopo e antes de reconhecer retry. O checkpoint protege revogação/inativação já confirmada durante a espera da ação; não promete serialização universal de alterações posteriores da ACL.

A repetição só tem sucesso quando status e decididaPorId coincidem e o último Evento do mesmo tipo/agregado pertence ao mesmo autor. Rejeitar também exige o mesmo motivo normalizado por trim e limite de 500 caracteres, preservando null. Evento ausente, último de outro autor, motivo inconsistente ou status oposto continuam recusados. A repetição ocorre antes da expiração original de uma aprovação já concluída, mas depois da autorização. Não grava ação, Evento, intenção ou aviso e não executa novamente o efeito.

O executor existente continua revalidando pausa, encerramento, documento e valores; desfazer não muda. A concorrência do mesmo ator deve produzir dois sucessos com um único efeito/Evento/intenção. Testes com espera real no Postgres verificam revogação de papel e inativação durante o lock; teste de pool1 verifica ações e nomes ainda não commitados no Db recebido e o rollback.

D1, D2 e D3 aprovadas permanecem nas issues #354–#358: responsável da CONVERSA, edição/envio humano e Assumir/cancelamento de pendentes. A #349 mantém as alçadas atuais e não antecipa essas extensões. Não depende da #343.

Aceite visual: N/A, produtor de dados sem apresentação nova. Gates, negativos nominais e pendências de QA, composição e CI constam no [relatório](../../output/inbox-349-report.md). A publicação é coordenada pelo ROOT depois da revisão e integração da #342.


Publicação: composição598aae2c diretamente na main79310013, com os sete SRC nominais cb285 e QA independente favorável. ROOT aprovou TypeScript original e lint global; restauros491 conferidos. [Evidências e limites](../../output/inbox-349-qa/indice.json). CI/revisão final/merge pendentes; não concluir349.


## Compatibilidade dos painéis por setor — 24/10/2026

Os campos aditivos podeDecidir e cartoes são obrigatórios no DTO retornado aos painéis. Secretaria, professor e vendedor convidado sem decidirHistorico recebem false e [], preservando as demais regras do setor. As quatro expectativas completas de paineis.int.test.ts passam a declarar esses defaults; continuam usando toEqual, inclusive nos casos de dados restritos do convidado. Nenhuma produção, alçada ou campo handoff da #351 entra nesta correção de teste. O relatório registra o RED local, o GREEN completo e o negativo remoto nominal.


### Composição com main343/423 e correção de expectativas349
BaseMain170edbad. Merge5b50cb4b+correção d9b1b08e (origem14337900),oito pathsSRC contraMain:sete originais349 byteiguaiscb285/b292 e umteste comquatro literais aditivos. Produção não mudou;toEqualcompleto preservado. Fullb29240140932662 terminou EXIT1:349arquivos/3.117passes,1arquivo/2falhas,3arquivos/4casos optin ignorados. Falhas emSECRETARIA/PEDAGOGICO de paineis.int porausência de cartoes[]/podeDecidir:false;as outras duas expectativas ainda não eram alcançadas. REDlocal11/13EXIT1 eGREENcompleto13/13EXIT0(58,07s),lint1EXIT0,restauroROOTcf2a26EXIT0. Main343/423preservada,quadroMainintegral. Provas públicas no QA:composicao-main343.json eci-full-b292-negativo.json. TSC/lintoriginaiscombinados e novaCI/full ainda pendentes neste checkpoint. Não concluir349 nem apresentar full anterior como verde.


Atualização dos gates da composição: TypeScript original terminou com código0 (sessão28227,terminala6beb3), sem exclusões auxiliares e sem incremental. Lint global terminou0 (sessão42789,terminal5d9ca8), zero erros e40avisos herdados. Nenhuma fonte foi alterada durante essas execuções. CI e integração completa da nova composição permanecem pendentes.


### Integração completa aprovada no código23fb
A nova integração40144382961 terminou com quatro shards aprovados:350arquivos/3.128testes;trêsarquivos/quatrotestes opt-in ignorados, declarados separadamente. Terminal32578/3fce24 EXIT0 e conferência45436/a19dd2 EXIT0. CI rápida40144356996 também aprovada5/5,939arquivos/7.457UNIT em cada fuso. [Registro dos jobs e fontes](../../output/inbox-349-qa/ci-23fb.json).

O negativo anteriorb292 continua preservado com suas duas falhas;os quatro literais completos foram corrigidos e a nova execução combinada incluiMain343/423. Revisão independente23fb favorável e comentáriosR1C1–C6 tratados. Este fechamento altera somente documentação;as oito fontes/testes permanecem23fb. A CI do filho documental e o merge serão conferidos antes de encerrar349.
