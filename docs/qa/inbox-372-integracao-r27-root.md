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
