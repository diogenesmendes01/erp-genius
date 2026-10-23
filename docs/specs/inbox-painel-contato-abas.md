# Painel do contato com abas — Inbox #318

Base243c9348454b6cca5795a6afa747efa25ed3eef1, branch codex/inbox-e1-318. Brief aprovado em output/inbox-318-investigacao.md; issue318/Task13 são o contrato. O checkpoint exclusivo foi integrado ao contrato313 e a composição foi liberada separadamente. Visual, TESTER e global seguem pendentes.

## Casca e leitura

PainelContato mantém visivel boolean|null, sobreposto, className, aoFechar, focarAoAbrir e children. Acrescenta contato/abas/abaAtiva/aoTrocarAba opcionais; sem contato conserva o cabeçalho308. Não troca o ciclo de useDialogo, inert, isolamento local, cleanup de layout, Escape do diálogo filho ou retorno ao gatilho. Uma instância/campo sobrevive coluna↔overlay; não há outro painel nem botão de fechar duplicado.

Com contato: Avatar132 usa tomDoAvatar por id, nome20/500 e subtítulo setor·número recebidos; tags são só leitura, sem lápis/+tag. ✦ somente quando ia=true, com nome acessível. O tamanho mínimo da tag é26px; pode crescer para quebrar texto extenso, preservando leitura. LinhaCampo é puro, aceita ReactNode escapado, ícone18, valor14,5 e rótulo12,5, min52 e overflow-wrap:anywhere. O telefone só será montado pelo pai se já veio não vazio do servidor; não há consulta nova de telefone.

O scroller local engloba cabeçalho, abas e corpo enriquecidos: tags extensas não expulsam o corpo de uma flex rígida. Classes/SSR não comprovam geometria; medir altura500 e todas as bordas após liberar preview. O fallback308 conserva uma rolagem local. PainelSetor retira padding externo, ajusta dt12,5 e mantém região, links, rótulos, datas, valores e estados vazios.

Não reproduzir hide1100 do plano antigo: shell308 usa960/1400 com Sidebar224 e permite overlay até1399. Fechar continua disponível também na coluna manual e usa a mesma ref. O Botao atual e o nome acessível308 são preservados por enquanto; BotaoIcone36 e rótulo responsivo de voltar/fechar serão consumidos na integração313, sem stub ou edição do compartilhado.

## Abas

ABAS_ENTREGUES central e congelada contém somente detalhes. IdAbaPainel reserva a união futura, sem publicar controles futuros. abasDoPainel aplica restrição comercial ao mapa correspondente e retorna apenas Detalhes na E1, inclusive em setor desconhecido. AbasPainel é controlado, tem role=tablist/tab, aria-selected, roving tabindex, setas circulares/Home/End e ligação aria-controls/tabpanel. Uma seleção inválida cai na primeira aba disponível. Contagem usa mono/AI; teste isolado de aba futura não a entrega na aplicação.

## Tags e autorização

TagPainel={rotulo,ia}; PainelSetor.tags é opcional para fixtures antigas, mas carregarPainel devolve sempre array. Só busca PessoaTag depois de carregarDadosSetor aplicar escopo/carteira/convite e autorizar pessoa comercial que não seja responsável legal. Fora do escopo retorna null; lead oculto, pessoa legal/ausente e outros setores retornam[]. Nenhuma autorização substituída ou ampliada.

Query por pessoaId, orderBy tag.nome asc, select mínimo criadoPorId/tag.nome. ia é criadoPorId===null na associação PessoaTag. Não filtrar Tag.ativo: associação histórica segue legível, como no CRM existente. Helper interno não é action ou endpoint. Saída não inclui IDs/nomes de autores, cor, telefone ou provedor. Sem schema/migration. Ações de contato, Aria e podeEnviar continuam no retorno, com as próprias proteções.

## Coordenação e provas

Somente os quatro registros específicos das guardas foram autorizados: aba1 em NAO_SAO_BOTOES_DE_ACAO, key a.id em CONTROLES_QUE_NAO_SAO_BOTAO e ALTERNANCIAS_SEM_ARIA_PRESSED (role=tab/aria-selected), tag1 em DENTRO_DE_SUPERFICIE. Nenhum algoritmo, limite ou registro alheio alterado.

InboxNovo, ConversaAberta, dialogo.ts, BotaoIcone, scripts/visual e quadro global permanecem reservados. O handoff deve montar WhatsApp→setor→Aria→ações→opt-out(não grupo)→triagem, manter aprovação Aria e remover somente triagem duplicada da thread selecionada; a ponte sem seleção deve continuar acessível. Preservar guards de seleção/revogação/rede, estado de leitura e uma montagem da casca.

Resultados, REDs, sessões e filtros em output/inbox-318-report.md. Integração permitida foi somente paineis.int.test.ts no dev-email, após snapshot completo do integrador. Ele restaurou424 tabelas/551 registros e confirmou a fixture307/314 normal. Nenhum servidor/preview, seed307/reset extra, outra suíte DB ou full próprio. Sem aceite visual presumido.

Checkpoint exclusivo64e67072 integrado aos contratos313 no9292dcbc, com registros de guardas preservados. Gates combinados45arquivos448testes/TSC/lint0 observados; não incluem composição ou visual318. Detalhes no relatório. A espera pelo handoff de composição/harness continua explícita, sem presumir conclusão da funcionalidade.

## Composição autorizada após4f1c2049

InboxNovo monta o cabeçalho a partir do contato da seleção atual; tags só do painel cujo id corresponde à seleção. ABAS_ENTREGUES continua a única fonte de abas; estado associa id do atendimento/aba, ajustado condicionalmente quando a seleção muda, sem efeito pós-paint ou remontagem da casca. Callback recusa aba não entregue. A função abrir e todo controle de NovaConversa ficaram intactos nesta composição para receber o fix313 separado.

Detalhes contém WhatsApp apenas se já recebido não vazio, setor, aprovação Aria, ações, opt-out fora de grupo e triagem/revisões. A triagem da thread selecionada foi retirada de ConversaAberta; a ponte sem seleção continua no Inbox. Não há novo telefone, permissão ou chamada. Wrappers locais normalizam padding/bordas dos blocos antigos e ocultam wrappers vazios; componentes de negócio preservados. A geometria dessas divisórias ainda exige navegador.

O cabeçalho enriquecido consome BotaoIcone36 real313 com a mesma ref/handler de fechar. Um wrapper posiciona o controle, sem disputar a classe relative do compartilhado. aria-labelledby referencia textos responsivos Voltar para a conversa abaixo700/Fechar painel acima; a comprovação do nome computado fica para preview. Fallback308 continua com Botao e seu nome anterior. Nenhuma mudança no helper de diálogo ou limiares960/1400.

O conteúdo acima substitui apenas as pendências de composição/BotaoIcone das anotações históricas. CLI/harness continuam exclusivos doB até handoff; quadro não editado. Provas de altura500, nome/tags extensos, foco/resize/nomes acessíveis, app×protótipo e aceite independente ainda pendentes.
