# #324 — evidência visual curada

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
