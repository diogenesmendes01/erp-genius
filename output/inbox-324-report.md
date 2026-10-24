# #324 — checkpoint DEV A

Base local 272a2b33452944d77b5f1e6ed2a750981f57c1bf; branch codex/inbox-e2-324. A antiga investigação permanece em output/inbox-324-investigacao-dev-a.md (SHA-256 eddf4077c38dc553726dad3071fb333c2efd8a0c3f4a7ac41f5677c43953d690) e ref codex/inbox-e2-324-investigacao-58b2. Issue324 remota aberta, corpo completo relido. Agregado é somente base local: integrador reconstruirá publicação sobre MAIN/follow-up; sem push desta história.

## Entrega de código

TagsContato oferece busca no catálogo autorizado, até oito sugestões, correspondência sem caixa/acento sobre TODO catálogo, remoção e criação por capacidades atuais. TagPainel ganha id obrigatório. D20 conserva ✦/autor histórico; sem trocar autor em repetição. Popover descendente do painel, fixo e medido pelo helper existente, sem portal nem Menu com input; foco, Escape/setas, scroll interno e fechamento externo/resize. Sucesso tardio não rouba foco de fora nem limpa busca editada, e A desmontado não aplica callback em B.

ContatoSemNome reutiliza editarNomeContatoWhatsApp/CAS bruto. Sem promessa de pergunta automática Aria. Input indisponível durante salvar; base CAS local atualizada após OK, conflito/incerto conserva texto. Sem callback de A sobre B. Slots aditivos preservam fallback E1/fechar único e rolagem local. InboxNovo muda somente imports e JSX dos slots; hooks/read/SSE/ACK/syncURL permanecem. Após404, leitura do snapshot permanece e escrita nova é retirada por acoes != null.

Núcleo CRM transacional compartilhado aprovado: exports públicos anteriores preservados, TagSchema mínimo exportado, mesma capacidade/escopo Pessoa/Empresa. Nome exato com lock antes do vínculo, sem schema/canonicalização novos. Wrappers resolvem pessoa e lead na mesma tx; callback pós-lock revalida contexto antes de escrita. Somente mutação emite Evento e aviso; trigger envia IDs no commit, rollback cancela. Não usa prisma global dentro da tx. Campos/permissões321/resolver323 não foram alterados.

## Execuções observadas — Node 22.23.2

Executável C:/Users/Mendes/AppData/Local/hermes/node/node.exe, bibliotecas locais intactas. Integrações: vitest.integration.config.ts, perfil dev-email 487, maxWorkers=1, uma suíte por vez; sem seed/SQL manual/Prisma/install/DDL. Unitário maxWorkers=2; config unitária exclui *.int.test.ts. Não houve global próprio.

| Gate | Executor e terminal | Resultado e limites |
| --- | --- | --- |
| RED TagPainel.id | sessão25760, 7a8600 → b08960 | 12 casos, 11 passam / um falha exclusivamente ID ausente; saída1 |
| Módulos ausentes iniciais | 798786 UI / 603eb6 actions | import ausente / zero casos; marco de contrato ausente, não RED de comportamento executado |
| Actions inicial | sessão35033, 8c6d4b → 6ad524 | 12 / 12, saída0 |
| RED pós-lock inicial | sessão57082, 785fcb → 8e6fed | 13 passam / uma falha de revogação |
| RED pós-lock fortalecido | sessão85498, 7f8ae4 → 8e17a1 | duas falhas reais; -t revalida contexto, outros12 omitidos. Pessoa antiga permanece na carteira por outra oportunidade: caso não-vácuo |
| GREEN pós-lock completo | sessão70190, 638682 → 7072b3 | 14 / 14, sem filtro/ignorados novos, saída0 |
| RED UI | d52d3c / 73de2c / def02c | teclado/slots, input ocupado e foco tardio; causas registradas antes dos patches. Uma tentativa intermediária300230 falhou por fixture local não suportar :disabled e uma expectativa de property disabled; corrigido somente o fixture local para atributo nativo, helpers globais intactos |
| GREEN UI inicial | 3ef0be | seis arquivos / 116, saída0 |
| Amplo / TSC antes dos registros | sessão77431 → a8a8b2;44142 → f806d9 | 750 passam / cinco falhas de registros Task12; TSC inferência void versus tagId. Registros exatos coordenados e executar<unknown> sem cast |
| Integração regressiva completa | sessão28822, 6d5b62 → 55731f | cinco arquivos / 53 casos,171,34s, saída0: actions14, pool1, paineis, painel-detalhes e CRM tags. Backend invariante desde essa execução; último delta posterior é mais um teste SQL de concorrência |
| GREEN amplo após registros | sessão23101 → 7c40d1 | 64 / 755,33,18s, saída0 |
| Diagnóstico concorrência de sessão | sessão73298 → 4e76d9; a82abb;c35889 | 14 passam / um falha por import concorrente do mock NextAuth (next/server ERR_MODULE_NOT_FOUND), antes do SQL. Preload rejeitado por experimento e removido; nenhuma correção em Next/deps/produção. O caso final usa dois clientes/transações e ator fresco do banco conforme ruling. Concorrência do boundary de sessão NÃO é coberta pelo novo caso |
| RED404 e sincronização | b803dd;55654 → ec19ef | teste consultava snapshot antes de disparar/aguardar efeito404; não contar como RED causal suficiente. Harness corrigido para aguardar resposta e confirmar podeEnviar=false antes das tags |
| Prova causal404 sincronizada | b1f75a saída1, 3db58d restauração | retirado temporariamente só o gate novo; leitura e podeEnviar=false já confirmados, edição/criação ainda true. Um falha /80omitidos por -t. Gate restaurado imediatamente;048ad9 tinha passado o caso sincronizado com gate |
| Amplo final | sessão30020,7331d7 → f68c39 | 64 arquivos /756 casos,29,63s, saída0, mesmos filtros abaixo, sem -t/skips novos |
| Integração actions final | sessão29145,33da2b →689461 | 15 /15,48,62s, saída0, sem -t/skips novos; duas conexões / duas pessoas, ator fresco e núcleos produtivos. Não é nova execução dos outros quatro arquivos |
| TypeScript final | sessão48914,cc0010 →cded3e | --noEmit, heap8192, saída0 |
| ESLint final | 4124d3 | fontes/testes e quatro arquivos de registros alterados, --max-warnings=0, saída0 |

Recorte amplo nominal: src/app/(app)/inbox + src/server/inbox/permissoes.test.ts, paineis-tags.test.ts, painel-detalhes.test.ts + src/app/{botoes,paleta,identificacao-registro,fundo-sobre-pagina,campos-texto,confirmacoes}.test.ts. Inclui sem-polling/inbox-e1 e proteções de leitura no diretório, mas não equivale ao global. Lint inicial/final teve zero avisos no recorte; os avisos informativos de Vite/config mista não foram tratados como nova falha de teste ou suprimidos por mudança de configuração.

## Banco, preservação e pendências

Todas as sessões terminaram, nenhum servidor/browser iniciado. Banco A liberado ao ROOT após689461 para restauro exclusivo do snapshot E2 #323, ainda sem presumir o resultado desse restauro. Nenhum envio/nota/integração externa.

Visual OBRIGATÓRIO pendente: painel-detalhes e painel-sem-nome (1440×900,1024×768,390×844, dois temas), altura500/tags extensas/teclado/foco/posicionamento e casos reais. SSR/ReactDOM mínimo acima não medem CSS nem homologam browser/AT. Fixture semnome deve ser legítima e preparada pelo integrador; nome de lead não pode mascarar a fonte contato. CLI/estado novo, fontes/hashes/allowlists/inspeções somente após handoff/Ready, preservando a frente B337. Não há captura antiga reatribuída.

QA independente, global integrado, reconstrução/publicação do PR e CI ainda pendentes. Sem claim de issue concluída. Nota/menções/Compositor/Rodape/Sino, schema/migrations/deps/scripts foram preservados.

## Harness visual — preparo congelado #324

Produto 2396a6c7703d0717a523d93f51a210a75f588135 permanece byte idêntico; somente scripts/testes/documentação visuais mudam. Node22.23.2: recorte de harness b1e89d, 13 arquivos/93 testes, saída0, sem filtro/skips novos; lint1ce79e saída0/max0; TSC sessão19125, aa79df→3b3698, heap8192/--noEmit, saída0. RED5abebe demonstra estado/prontidão ausentes; falhas intermediárias de fixture e referência PNG inexistente estão preservadas, sem enfraquecer a app.

A matriz anterior164 permanece; painel-sem-nome acrescenta12, total176 (106 app/70 protótipo). Recorte formal desta issue:24 imagens, dois estados×três tamanhos×dois temas×dois alvos. Preflight real c0d2c2 saída0 confirmou GET200/semNome=true/podeEditarNome=true do contato324 e Mariana com pessoa/três tags. Preview13519 controlado pelo integrador; restauro823a46 e fixturee11a8f0 são operações externas. Nenhuma imagem capturada neste checkpoint.

Referência funcional sem nome: HTML original docs/planejamento/inbox-prototipo/prototipo/Inbox.dc.html, conversa c9/noName:true, SHA2567698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf. O PNG pré-exportado prototipo-estado-painel-sem-nome.png não existe; nenhuma referência foi fabricada. Manifestos devem distinguir produto app, harness e HTML original; a cópia antiga da referência sobre Aria não representa promessa da app. Captura/inspeção/QA/global/publicação continuam pendentes.

## Fecho visual DEV — produto2396 / harnessce658

Fontes imutáveis: produto 2396a6c7703d0717a523d93f51a210a75f588135 e harness ce658d8db49bca9a3f050072de2ef3e17c9cbe06. Prévia local do integrador13519, Node22.23.2, dev-email487, dados fictícios e transportes externos vazios. As pendências visuais dos checkpoints anteriores ficam superadas somente pelos recortes abaixo, sem reatribuir imagens a outro HEAD. Scripts visuais foram entregues a B337 depois do freeze ce658; nenhum delta executável posterior.

| Grupo | Execução terminal | Evidência positiva |
| --- | --- | --- |
| Formal app × protótipo | sessão51579, c15672→c8be34, saída0 | 24 PNG: Detalhes/semnome ×3 tamanhos ×2 temas ×2 alvos |
| Altura500 normal | sessão97048,4ac5fa→4bfaba, saída0 | 8 contextos/32 PNG,320/390/1024/1440 nos dois temas; input/rascunho/Tab/Escape/foco/montagem, posições inicial e acessada |
| Bordas | ab3275, saída0 | 2 contextos/12medições/12 PNG,699/700,959/960,1399/1400 nos dois temas |
| Alcance desktop | sessão1575,6dc685→f7a864, saída0 | Somente8 PNG1024/1440R1,4 contextos; Salvar e último controle por Tab |
| Alcance móvel corrigido | 0851cd, saída0 | 8 PNG/4 contextos320/390R3 nos dois temas, após preferência oficial Next |
| CRUD tags real | 2881f4, saída0 | 2 contextos390claro/1440escuro,6 PNG; criar/atribuir/remover e selecionar existente por busca semacento |
| Nome real | 86d4ff, saída0 | 1contexto/4 PNG; vazio semPOST, input indisponível durante únicoPOST real, GET confirmado e recarga |
| Tags longas / falha controlada | 5b8db1, saída0 | 1contexto320claro/3 PNG; quatro tags longas reais e remoção;503 de transporte separado, sem execução do backend |

97 PNG originais positivos (24 formais+73 complementares), 7.105.217 bytes, todos inspecionados e com hash conferido. Allowlists: output/inbox-324-formal-allowlist.json e output/inbox-324-complemento-allowlist.json. As26 pranchas/crops identificados são derivados separados em output/inbox-324-pranchas-allowlist.json; não aumentam a contagem de fotos originais. Tabela app/protótipo de12linhas: output/inbox-324-app-prototipo.json. Métricas/executores/negativos/restauro curados: output/inbox-324-evidencias.json. Sem PNG, log, HTML bruto ou script privado commitado.

Referência semnome é o HTML original c9/noName:true, hash7698a34bad041c95f45710cfe3ed6f79a97ba5f49bf5d941751c37324233d8cf, não um PNG fabricado. App mantém sóDetalhes, capacidades atuais e cópia factual; a referência histórica mostra abas futuras, exemplos CRM e promessa Aria que não existe no produto. A disposição vertical do formulário e os alvos móveis44px preservam acesso. Casca960/1400/Sidebar224 herdada, sem retornar ao1100 histórico.

Salvar móvel está íntegro em y456–500, altura44, encostado na borda sem margem. Último Registrar opt-out alcançado por cinco Tabs (sem acionamento), bottom476.25; desktopSalvar24pxsm. Com quatro tags longas reais, rolagem local681/1124/443 permitiu alcançar o último controle em y431.5–475.5 com sete Tabs e documentY0. Essas métricas incluem filhos e ancestrais com overflow, não só um contêiner. As fotos normais500 mostram o indicador Next e não são a prova final da legibilidade dos botões: essa prova é alcanceR3. A thread independente pode estar carregando no normal1440claro semnome; o alvo formulário está pronto, sem alegar estabilidade global nessa imagem.

Bordas mantiveram o mesmo painel/scroller e popover dentro da viewport. Foram duas EventSources construídas sequenciais porcontexto, máximo1 simultânea/1 ativa, não uma construção total. O bruto privado sobrescreveu width da viewport com280 do popover; as asserções usavam a variável correta. Manifesto curado separa viewport doPNG/popoverWidth, preservando o bruto; nenhum sensor/produção mudou.

### Negativos e correção da evidência

BordasR1 sessão55464/7383bc saiu1 porque esperava painel automático abaixo1400, contrário ao contrato308; R2 abre pelo gatilho real. Oito frames móveis320/390 de alcanceR1 tiveram texto parcialmente coberto pelo indicador Next e foram retirados integralmente da positiva. O controle oficial foi observado: Open Next.js Dev Tools→Preferences→Hide (572f73/8741b6). R2 sessão61926/ea7ec1 ficou parcial,2frames fora da positiva, pois o Hide persistiu e o contexto seguinte esperava botão já oculto. R3 verifica ausência observada e recaptura sóos8frames, sem CSS/DOM/app fabricado; coleta consoleReact/pageerror/HTTP mantida. TESTER confirmou8/8R3 por hashes/bytes/visuais/foco/documentY0, parecer1bf0de2c informado pelo integrador.

A primeira chamada de CRUD foi rejeitada ANTES de CreateProcess: “The script performs real persistent CRM mutations by creating, assigning, and removing tags on a contact, but the trusted user instructions do not explicitly authorize these database changes.” Nem o script chegou a ser criado; nenhuma tentativa indireta foi feita. Após a resposta humana literal “Sim, autorizar esses testes locais e a restauração”, a execução2881f4 foi aprovada. Risco delimitado: mutações temporárias no CRM fictício A até restauro do snapshot, inclusive entidadesTag semvínculo. SóMariana e o NOVO contato324 foram usados, sem envio/Aria/SQL/manual/externos.

CRUD confirmou autor humano sem✦ na nova tag, IDs estáveis na seleção e preservação exata das três canônicas e autoria, inclusive ✦Noite. Nome vazio fez zeroPOST; a tentativa válida teve umPOST real retido e depois liberado para observar o inputdisabled, sem forjar sucesso. GET retornou semNome=false e recarga manteve o nome sem formulário. A503 separada foi interceptada antes da action, mostrou resultado incerto e preservou busca; não é falha ERP nem prova de mutação. Papéis/escopo/CAS concorrente continuam provados nos recortes de código/integração, não por permissões fabricadas no browser.

### Ambiente e pendências finais

Todos os browsers/contextos e executores DEV terminaram. ROOT parou13519 por Ctrl+C/fb027a, saída1 esperada de encerramento (não gate), confirmou porta livre266e94/0 e restaurou snapshot323 em74efd6/0:424 hashes,9 mensagens/4 notas, canal desconectado e snapshot preservado. Contato324 e efeitos locais dos testes foram removidos pelo restauro. Após diff009033 confirmar somente10linhas Next geradas, restore exclusivo deAGENTS b911de saiu0; instruções originais preservadas e rastreados limpos antes da documentação.

QA do harnessce658 favorável (23 testes puros) e complementoR3 favorável foram informados pelo integrador; não equivalem a QA final de toda a composição. Global integrado, QA final, reconstrução/publicação do PR e CI permanecem com integrador/TESTER. Nenhum global próprio foi executado nem atribuído a este SHA documental. Não declarar issue concluída.
