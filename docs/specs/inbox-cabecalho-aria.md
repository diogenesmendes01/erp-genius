# Inbox #348 — estado e devolução da Aria no cabeçalho

O cabeçalho mantém 68px a partir de 700px de viewport. Até 699px, identidade e ações ocupam duas linhas com altura natural para manter nome e estado legíveis quando os controles coexistem. Identidade/status/setor/número e ações existentes são preservados. A linha usa item.estadoAria/atendidoPorVoce/responsavelNome da343: ia = Aria está atendendo; aprovacao = Aria aguarda sua aprovação somente pela capacidade podeDecidir do painel atual, senão Aria aguarda aprovação; handoff = Aria pediu um humano; humano = Você está atendendo, primeiro nome está atendendo ou Uma pessoa está atendendo. Nomes são aparados e separados por whitespace. Grupos, encerradas e estado null mantêm o fallback atual. A pausa gera title pelo helper textoPausaAria, preservando literalmente os cinco motivos existentes e o fallback Aria pausada.

textos-aria.ts é puro. haQuanto recebe ISO e agora explícitos; usa duração em milissegundos/floor: menos de1min agora, menos de60min há N min, menos de24h há N h, demais há N dias (singular há1dia). Futuro retorna agora e data/agora inválidos retornam string vazia. Não cria timer ou relógio próprio.

Botão Devolver para Aria só aparece por aria.podeDevolver no DTO do painel da seleção atual, em conversa individual aberta. Não infere autorização de papel, resumo global ou estado visual. Fundo/texto usam tokensAI; o nome acessível permanece completo, texto visível encurta para Devolver abaixo1200px. Usa action existente devolverParaAria e useAcaoCliente real com idempotente:true, pois servidor revalida escopo e não grava evento se já retomada.

ControladorDevolverAria fornece botao e feedback; ConversaAberta põe feedback imediatamente após o header, fora de sua altura e sem portal. A key do coordenador/ação pertence ao atendimento. Mudança de capacidade conserva a instância e o conteúdo da conversa, mas invalida o token ativo da tentativa. ACK de A desmontado, A→B→A ou capacidade revogada/recuperada não reconcilia nem mostra erro/sucesso antigo ou toma foco. Hook permanece dono único de ocupado/erro/sucesso, com trava imediata de duplo clique e feedback visível/focado em erro atual. Falha de transporte atual permite reenviar a mesma operação. Nenhuma escrita de estado durante render.

InboxNovo passa somente painelDoAberto.dado.aria. Em404 de revogação preserva história de pausa/cartões e limpa apenas podeDevolver/podeDecidir da cópiaAria, além das travas preexistentes acoes/podeEnviar. Erro503 conserva último DTO conhecido. PainelAria continua montado e suas ações existentes são preservadas até353; apenas importa/reexporta textoPausaAria do novo módulo.

Sem mudança em servidor/domínio/ACL, schema, migração, provider ou envio. Sem D3/Assumir357, compositor358, switch359 ou retirada353. Base técnica716a6261 carrega346/347 em drafts; o DAG não presume merge delas. Entrega/testes em output/inbox-348-report.md e quadro único. Visual, QA independente e CI/TSC/global exigem evidências próprias e não são aprovados por esta SPEC.

A apresentação do botão usa a variante canônica ia de Botao (bg-ai-50 text-ai-700 hover:bg-highlight), adicionada com coordenação técnica explícita do ROOT e teste SSR/mapa declarativo. Não sobrescreve cor por className; base de foco, alvo móvel, disabled e ocupado permanece comum ao design system.

## R1 / composição da PR #434

B1/C1/C3: a integração com #430 e a pilha #435/#432/#427/#420 preserva os cartões da thread, o controlador do cabeçalho, todas as props e os testes dos dois lados. A prop aria fica declarada e passada uma única vez, compartilhando o DTO autorizado da seleção vigente. As variantes ia, iaFantasma e perigoContorno e seus mapas permanecem juntas. Históricos do quadro são preservados.

C4: os casos existentes foram renomeados para linha_por_estado, textoPausaAria_mantem_o_texto_atual (parametrizado por motivo), haQuanto (por duração) e botao_com_rotulo_e_dica. Asserções e quantidade de casos foram mantidas.

C5: o botão do PainelAria e o novo botão do cabeçalho coexistem até a remoção do painel na #353, conforme o plano. Ambos usam devolverParaAria; isso não cria uma nova permissão. A duplicação será registrada na inspeção visual, sem declarar que o painel já foi removido. Assumir/compositor/switch global continuam nas extensões próprias aprovadas pelo dono.

O primeiro TSC da composição detectou uma prop JSX aria repetida pelo merge automático (TS17001, EXIT2). A rodada global em andamento foi interrompida pelo integrador (EXIT1) antes de mudar a fonte; não representa suíte completa nem sucesso. O atributo repetido foi removido sem alterar seu valor ou ciclo de atualização. Novos gates são registrados separadamente.
### Remoção do legado na #353

PainelAria foi retirado da aba Detalhes. textoPausaAria continua no módulo aria/textos-aria; seu reexport legado desaparece. A pausa/motivo e a única devolução permanecem no cabeçalho/controlador canônico, com feedback irmão e refresh existente. Capacidade, action, foco e token de ciclo não mudaram. A coexistência registrada em C5 era temporária e termina aqui; não implica implementação de D3/#357.

## Correção mobile R4 — 25/10/2026

A inspeção com a linha fictícia ativa e desconectada mostrou um defeito em 390px: Transferir, Devolver, Assumir, Painel e Menu comprimiam nome e estado para poucos caracteres. As capturas anteriores com a linha inativa não demonstravam esse conjunto de controles e permanecem apenas como diagnóstico.

Até 699px, a identidade ocupa a largura das duas colunas; as ações principais e o Menu ficam na linha seguinte. A altura é natural, sem fixar 110px, e o fio absorve a redução de espaço. As ações principais têm grupo acessível nomeado. O Menu continua fora do containment, preservando seu posicionamento no viewport. Os mesmos controles, handlers, nomes acessíveis, capacidades, estado de processamento e instâncias são mantidos; não há cópias por breakpoint. A partir de 700px, permanecem a linha de 68px e os cortes existentes de largura útil.

O protótipo mobile de 68px possui menos controles simultâneos; a diferença de altura é deliberada para preservar a identificação da conversa. O aceite depende de novo build e medição real nos dois temas, nos limites 699/700 e com os conjuntos completo e parciais de ações. [Evidências e limites](../qa/inbox-348-mobile-r4-root.md).
