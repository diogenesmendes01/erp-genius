# Candidato isolado de servidor — #372 parcial

Preparado sobre ROOT4905 a partir dos blobs DEVf731 e pré-requisitos explícitos, sem importar ancestrais privados. Destino comercial foi extraído literalmente; a factory conserva os dados e Eventos de criarLead. Forecast341, ACL atuais, Insights e documento499 permanecem. Schema e labels recebem apenas a origem da migração500. Nenhum consumidor de Grant ou permissões43 foi alterado.

Os testes DEV e seus negativos continuam atribuídos às fontes registradas no relatório da funcionalidade. Este candidato ainda requer cliente Prisma próprio, migração no banco descartável TESTER e testes independentes do commit exato. Não há QA executada deste candidato, PR, merge ou homologação. EXISTENTE, actions e UI continuam em desenvolvimento; a decisão de owner Admin/GC permanece pendente.

## Qualificação independente do candidato selecionado

O TESTER executou a fonte exata b8d17b12 em seu worktree, com cliente próprio do schema público499 acrescido somente deOrigin500. A migração manteve425tabelas de dados, histórico496, funções, gatilhos, índices e47fixtures; novo snapshot500 tem497migrações aplicadas/426tabelas/1445linhas. Nenhuma migração de Grant foi incorporada.

Sete arquivos unitários completos passaram86/86 (90c4e4), e onze arquivos nativos completos passaram39/39, em processos separados e série (6b9151,b0c925,3b0c29,3aac2c,816053,a96f90,cf14b2,565793,501132,769983,c15602). TSC global original terminou0 em60976/72df70. UTC, um worker nos testes e sete provedores externos vazios. O banco foi restaurado em6019ce, com hashes e fixtures conferidos.

O primeiro TSC desse worktree terminou2 por117diagnósticos em34cópias históricas privadas deoutput. Elas foram renomeadas para.txt, com os mesmos bytes, sem mudar fontes, configuração ou exclusões do projeto; o negativo permanece registrado. O TSC original foi executado novamente e passou.

Provider concorrente é colisão adversarial entre contatos distintos; não equivale a retry natural do mesmo contato. O negativo R7 porP2028 mantém sua causa não fechada, mesmo com os testes posteriores aprovados. A publicação conserva literalmente SRC/Prisma/config do candidato testado; diferenças documentais preservam o histórico da base pública.

Esta qualificação cobre o núcleo NOVO e a recuperação de concorrência. EXISTENTE, actions e UI continuam em desenvolvimento. Unidade/lint/build globais da nova composição, CI e aceite visual ainda são gates. O rascunho não conclui#372 nem autoriza merge.

## Gates globais do núcleo NOVO — 26/10/2026

A composição exata b8d17b12 passou nos quatro gates originais, sem alterações de código ou configuração entre as execuções aprovadas:

- Unidade global: 1.084 arquivos, 9.658/9.658 testes, saída 0 (sessão60305/aaa5cc).
- Lint global: saída 0, nenhum erro e 105 avisos (sessão82191/8d8d62).
- TypeScript global: saída 0 (sessão60976/72df70). O build também concluiu sua verificação de tipos.
- Build de produção: saída 0, 115 páginas, BUILD_ID 1NC40mQO0Qr3trrrAieGn (sessão17546/332f99).

O primeiro lint terminou2 porque os scripts privados CJS históricos não carregavam o plugin React no padrão atual do Next. A verificação de configuração reproduziu isso sem mudar pacotes. Após preservar os82scripts como texto, a execução seguinte terminou1: todos os2.957erros estavam em12itens privados antigos de QA/build, sem erros nas fontes do produto. Esses12itens foram arquivados por movimentação atômica fora do worktree; os723arquivos versionados deoutput, os relatórios atuais, as fontes e as regras/exclusões do lint foram preservados. O lint original foi repetido e terminou0; os negativos e manifestos permanecem registrados. Os105avisos incluem material local de QA, não apenas código do produto.

O build usou exclusivamente o banco descartável TESTER500, com os sete provedores externos vazios. A auditoria após o término confirmou as426tabelas e1.445linhas com os mesmos hashes, sem listeners ou escritas residuais (017053). Não houve envio real nem ativação de integração externa.

Esta atualização substitui a pendência de unidade/lint/build globais anotada no checkpoint anterior. A fonte publicada emSRC/Prisma/config continua literalmente igual ao candidato testado; somente evidências documentais foram acrescentadas. EXISTENTE/actions/UI seguem em desenvolvimento e fora deste recorte aprovado. CI remoto, aceite visual, decisão de ownerAdmin/GC e conclusão integral da#372 continuam pendentes. O PR permanece rascunho, sem fechamento automático da issue ou indicação de merge.

## Candidato de ações e abertura existente

O checkpoint2a29006f foi selecionado sobre o head público7e2f4ff0, sem incorporar seus ancestrais privados. Foram acrescentados o parser, a action, o núcleo EXISTENTE, dois arquivos unitários e dois de integração, além de SPEC e QA do DEV. O quadro público foi atualizado separadamente. NOVO, inbound, helpers compartilhados, dependências e schema permanecem iguais ao último candidato aprovado.

O DEV registrou RED de duas revogações ocorridas no último await; após a leitura final de ator, relações e tupla no mesmo snapshot,64/64unitários, lint e TSC terminaram0. Dois arquivos de integração completos passaram5/5 e4/4, com action, reader, helper de atendimento e SQL reais. A instrumentação de rede bloqueia chamadas inesperadas; nenhuma ocorreu. O integrador restaurou o banco descartável após os testes (13668e).

O eventoAtendimentoInstitucionalAberto segue a convenção existente: audita a intenção de abertura mesmo quando reutiliza atendimento. Replay da mesma chave não acrescenta evento; nova tentativa pode acrescentar. criado:false informa que não houve criação de uma nova oportunidade.

As garantias de frescor são limitadas à última leitura qualificada emREADCOMMITTED; não representam linearização global de permissões ou de todos os possíveis cadastros concorrentes. Relações de equipe do gerente e disputa simultânea de chaves ainda não foram exercitadas nesse recorte. A QA independente em fonte pública e os gates globais da composição atual ainda precisam terminar. A UI, a escolha de owner paraAdmin/GC, CI e aceite visual também seguem pendentes.

## QA independente e gates do incremento EXISTENTE — 26/10/2026

O TESTER confirmou o commit público exato 4eaa2b56 em seu próprio worktree e banco. Os dois arquivos de integração completos passaram 5/5 e 4/4 (85032/61c06c e 25902/493c92); os dois arquivos unitários passaram 64/64 (df53cc); TypeScript global original terminou com código 0 (95484/e2bbcc). Nenhuma fonte foi editada durante a qualificação. O integrador restaurou o banco TESTER500 em 8c6234. Os limites de gerente comercial e disputas não amostradas permanecem explícitos.

Na mesma fonte, o integrador concluiu os gates globais originais:

- Unidade: 1.086 arquivos, 9.722/9.722 testes, código 0 (74024/414a8a).
- Lint: código 0, nenhum erro e 105 avisos (97802/6a46ac).
- TypeScript: código 0 na execução independente; o build também concluiu sua verificação de tipos.
- Build de produção: código 0, 115 páginas, BUILD_ID YmhPYyYJANyheE9GAoygE (41704/b3d35f).

As configurações originais e as fontes permaneceram intactas. A auditoria após o build confirmou as 426 tabelas, 1.445 linhas e os mesmos hashes do snapshot TESTER500, sem atividade ou listeners residuais (9e08cb). Integrações externas ficaram desligadas.

A publicação acrescenta este registro, o quadro e uma regra específica em .gitattributes para manter a migração Origem500 em LF no checkout Windows. Os bytes SQL são os mesmos já aplicados e testados; nenhuma migração histórica ou checksum foi reescrito. Código, schema, dependências e configurações de execução são literalmente iguais à fonte 4eaa2b56 aprovada.

A action e o caminho EXISTENTE integram este incremento. Consultas de preview e seleção de linhas para a interface, UI completa, decisão de responsável para Admin/Gerente Comercial, CI remoto e aceite visual continuam pendentes. A PR permanece em rascunho e a issue #372 aberta.


## #372 — decisão de vendedor e interface por telefone, composição R28

Incorporadas as correções R17/R19 de linhas/preview e abertura de cadastro existente, seguidas da interface D9 do checkpoint500f87a0. O escopo irrestrito OR e a navegação canônica B1 já são herdados da PR453; a presença452 e os testes públicos de Insights/transferência foram preservados. Nenhum ancestral privado foi importado. NOVO, inbound, schema, migration500 aplicada e dependências não mudam neste delta.

Decisão humana aplicada: Admin ou gerente comercial sem papel vendedor deve escolher um vendedor ativo autorizado, sem padrão pelo dono da linha. Ator com papel vendedor usa seu próprio identificador, inclusive em papéis combinados. A consulta retorna somente id/nome autorizados e revalida a foto final de ator/equipe/candidatos. A intenção e chave de idempotência permanecem em memória por ator ao fechar e reabrir o diálogo; o servidor revalida os dados da confirmação. Saudação é manual no compositor existente, sem envio automático.

DEV D9:166UNIT/9arquivos, lint e TypeScript0; oito nativos completos de opções e action passaram, com snapshot e direitos frescos. C1inbound: os dois arquivos pedidos passaram13+1 mantendo fonte01166434. A colisão adversarial do provider não é retry natural nem explica a causa histórica R7/P2028. R17/R19 e demais recortes históricos continuam qualificados em seus registros, sem somar testes sobrepostos.

C3: a decisão aprovada não restringe a origemProspecção ativa ao novo fluxo; relatórios/importação/selects atuais preservados. C6: migration500 já aplicada é imutável, reserva exclusiva coordenada, sem reescrever SQL ou acrescentar IF NOT EXISTS. C4: tela e consultas agora incluídas, mas a emissão de AvisoInbox do atendimento criado está em correção separada; esta candidata ainda não cumpre esse ponto. QA independente exata, regressões públicas, browser/aceite visual e CI permanecem pendentes.
