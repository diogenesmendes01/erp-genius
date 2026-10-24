# Inbox #325 — parecer visual DEV

Parecer favorável por arquivo para 36 imagens inspecionadas individualmente em 24/10/2026: 24 da aplicação e 12 referências visuais estáticas. Fonte APP `ddf872e13078fb48c7648da9c2fc48b1d3f29438`; harness `96c9e60752b3c1951922a745cee89045b4597ace`. QA independente da curadoria, composição, CI e publicação permanecem pendentes. A issue não está concluída nem homologada.

| Cenário | APP formal | Referência estática | APP320 complementar | Total |
| --- | ---: | ---: | ---: | ---: |
| Pessoa | 6 | 6 | 2 | 14 |
| B2B | 6 | 6 | 2 | 14 |
| Convidado | 6 | N/A por autorização | 2 | 8 |
| Total | 18 | 12 | 6 | 36 |

Os 30 estados formais usam 1440×900, 1024×768 e 390×844, em ambos os temas. As seis complementares usam 320×500 e rolagem interna real. A matriz global continua 190+30=220; não houve delta de APP, servidor, schema, dependências ou harness durante a curadoria.

## Fontes e lotes

L1, sessão `74891`, terminal `eb2985`, terminou EXIT1 e permanece uma execução negativa. As 18 imagens APP anteriores à falha foram selecionadas individualmente: nenhuma falha, GETs de Detalhes todos concluídos, sem pendências e com auditoria depois do browser fechado. A primeira referência registrou o erro herdado e não gerou PNG. Foram fechados 19 contextos e o browser. A seleção por arquivo não muda o resultado global de L1.

L2, sessão `18441`, terminal `ba4c36`, terminou EXIT0: somente as 12 referências e seis APP320 restantes, sem repetir as 18 APP. Foram fechados 18 contextos e o browser. As 24 capturas APP somam 71 STARTs e 71 conclusões de GETDetalhes, zero pendências finais, 72 links alcançados por Tab e alvos novos de pelo menos 44 px; cada ligação foi alcançada entre dois e 51 Tabs. SSE teve duas aberturas sequenciais em StrictMode, máximo uma simultânea por página.

Os nomes, dimensões, bytes, SHA256, lotes e fontes individuais estão em `output/inbox-325-visual-allowlist.json`. São 3.434.158 bytes de PNG. O diretório privado consolidado é `output/inbox-325-visual-final`; seus arquivos são cópias byte a byte dos originais, que foram preservados.

## Inspeção e limites

Cabeçalho de Pessoa, avatar circular de132 px e empresa com avatar quadrado de132 px estão coerentes com o DTO. B2B mostra a empresa como título, interlocutora como subtítulo, participante atual e links Falar com autorizados. O cartão abre o Funil; somente Detalhes foi implementada nesta frente, sem abas vazias futuras. Dados fictícios LATAM e totais em CLP mantêm a diferença entre título de produto e nome de oportunidade. O rótulo Documento da empresa e o RUT chileno estão contidos e legíveis em 320 px. Campos restritos e autoria Aria aparecem para Admin; convidado lê somente o contexto D13 permitido, sem campo reservado, ficha global, empresa ou linkB.

Os painéis em tablet são sobrepostos e os perfis longos exigem rolagem. As complementares mostram o documento/perfil, sem prometer que todo o painel caiba em 500 px; uma linha posterior pode aparecer parcialmente na borda inferior. Telefones foram anonimizados no DOM pelo helper existente; os pixels originais das PNGs não foram editados. A supressão do toast de desenvolvimento preserva indicadores de issues e os listeners de diagnóstico.

A referência original tem uma limitação real: `support.js:1013` chama `componentDidUpdate(prevProps)`, enquanto `Inbox.dc.html:883` acessa `ps.sel`. Isso interrompe a execução antes de `toBottom`. A exceção aprovada pelo ROOT aplica-se exclusivamente ao alvo PROTO e à mensagem+stack/callsites originais, após conferir os hashes HTML `7698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf` e support `d6bb6dd3aadb9ff722d5d6db2193572ece476b915899575a571de7a0717f001f`. L2 registrou 36 ocorrências, mantidas em privado. Quaisquer outros consoleerrors, pageerrors ou HTTP continuam falha. Não se afirma autoscroll, posição da thread, foco, comportamento após seleção ou aceite funcional da referência. As 12 referências comprovam somente o painel visual estático. APP e guardas953 não receberam exceção.

## Destinos reais e autorização

Probes `53179/a656b7`, EXIT0, seis contextos fechados e browser fechado. Tab seguido de Control+Enter abriu o link real em uma segunda página autenticada; origem e chegada foram auditadas separadamente. SSE ficou no máximo uma simultânea em cada página, com duas páginas por contexto; não se afirma uma única conexão global entre abas.

| Ator/origem | Destino real | Prova de chegada |
| --- | --- | --- |
| Admin/Pessoa | `/funil?o=inbox-325-op-pf` | Oportunidade Mariana Costa325; produto distinto Espanhol Intensivo325 |
| Admin/Pessoa | `/contatos?c=inbox-325-pessoa-pf` | Ficha de Mariana Costa325 |
| Admin/B2B | `/empresas/inbox-325-empresa` | Empresa Ventura Chile325 |
| Admin/B2B | `/inbox?c=inbox-325-atendimento-alvo-a` | Header Bianca Silva325; painel200, podeEnviartrue |
| Admin/B2B | `/inbox?c=inbox-325-atendimento-alvo-b` | Header Caio Lima325; painel200, podeEnviartrue |
| Leitor/B2B | `/inbox?c=inbox-325-atendimento-alvo-a` | Header Bianca Silva325; painel200, podeEnviarfalse; B404 e sem linkB na origem |

Os alvos A/B têm leadId nulo. A chegada comprova a thread autorizada e o estado legítimo Sem oportunidade visível para você; não pressupõe um DTO com oportunidade/B2B. Nenhum envio foi testado ou executado. A autorização de leitura contextual não presume acesso do leitor ao Funil ou às fichas globais.

O executor nominal53179 foi preservado byte a byte em privado, SHA256 `fd95c2dd9a825b006bd57e6bcad71f01768b37fcd4bc5243cc8ab5faf4068245`, igual ao manifesto. Ele usa skip explícito de about:blank e router por origem exata http://localhost:3111; todos os destinos executados foram internos. O guard futuro do init por origem exata tem outro arquivo/hash (`f7ffe5cd5b948c92e50afe6e8b0953fdedcf050090c62d6243eae2dc8997bcd8`) e não foi executado nem atribuído à prova. Executors dos dois lotes também foram preservados e comparados com seus manifestos em `af1642`, EXIT0.

## Negativos, integridade e entrega

Permanecem privados: primeira PNG rejeitada26ab1b, diagnóstico c588cb, prova focada nominal c578af com seu limite de coleta, história d1f51 e reprodução em memória7f1915, L1/74891 EXIT1 e probe56898 EXIT1. Este último teve dois erros administrativos do executor: título de produto usado como título de oportunidade e init em about:blank. Foram diagnosticados antes da rodada corrigida e não atribuídos ao APP. Nenhuma imagem negativa entrou no corpus.

A coleta usa o módulo real96c, com listeners desde START até o fechamento do browser. O namespace de hashes é explícito na allowlist: blob GitLF e bytes físicos. O físico do coletor tem apenas a última quebra em CRLF; normalizar LF reproduz o blob Git de 8.558 bytes/SHA256 `52a2400bd31e802a00d8574f1296dda2bed3fb27d911ec9b25661130d8e85269`, sem delta de código. A prova independente f3aa49 reconciliou a diferença de EOL; os gates continuam nominais96c.

O ZIP privado `inbox-325-aceite-ddf872e-96c9e607-20261024.zip` tem 3.361.508 bytes, SHA256 `37f09534f89890984efb6316fe9ccf999593097306b711f301248d28f3b28d69`, 38 entradas: 36 PNGs, manifesto e README curados. Leitura completa conferiu os 38 hashes (`ba3da5`, EXIT0). Não contém scripts, probes, credenciais, cookies/headers, respostas/logs brutos ou rejeitadas. Imagens/ZIP ficam fora do Git; publicação é do ROOT.

Nas capturas APP e probes positivos houve 99 chamadas somente das duas ações incidentais aprovadas: marcarAtendimentoLidoAutomatico e respostasRapidasDoCompositor. Nenhum Save, Assumir, Aria, nota, etapa, envio, CRUD ou API externa. ROOT parou preview `97596/9d0c00` (Ctrl-C/saída1 esperada, porta livre) e restaurou ciint `ae152c`, EXIT0, 424 hashes/498 linhas. AGENTS foi restaurado somente no bloco Next gerado após o stop, preservando suas instruções. Sem nova HTTP/browser/DB depois da liberação.

Fonte executável congelada para integração e QA. Após este freeze, ownership dos comuns/harness pode ser devolvido à frente327; não iniciar outra funcionalidade sem GO.
