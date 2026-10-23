# Inbox: telas, modais e atalhos (parte 3)

Análise só de leitura. Comparei o protótipo aprovado com o ERP no `main` `7e4810e5`.

**Fontes**
- **Protótipo:** `inbox-analise/prototipo/Inbox.dc.html`, `role.js` e `mobile.js`. As linhas do protótipo estão como `P:<linha>`, `mobile.js:<linha>` ou `role.js:<linha>`.
- **Outros protótipos**, para conferir os destinos: `ui2/*.dc.html`.
- **ERP:** `/home/claude/erp-genius`. Os caminhos partem da raiz do repositório.
- **Requisitos:**
  - `planejamento/03-funcoes-do-inbox.md` (doc 03);
  - `02-modelo-atendimento-crm-erp.md` (doc 02);
  - `plano/02-fase-crm.md`, `03-fase-inbox.md` e `05-fase-ia-relatorios-config.md`;
  - `docs/planejamento/quadro-entregas.md`.

**Legenda do status**
- **EXISTE:** o ERP faz o mesmo.
- **PARCIAL:** o ERP faz uma parte.
- **DIVERGE:** o ERP resolve de outro jeito ou com outra regra.
- **FALTA:** não existe no Inbox.

**Legenda do tipo de lacuna**
- **UI:** falta só a tela, porque o servidor e o modelo já existem.
- **BE:** falta back-end, consulta ou campo no modelo.
- **MOTOR:** depende do motor do WhatsApp (Fase 4).
- **ARIA:** depende do turno ou da geração da Aria.
- **FORA:** ficou fora por decisão do plano (pendência 12 de `03-fase-inbox.md:1543`).

---

## 1. Resumo executivo

1. O protótipo concentra o CRM dentro do Inbox. Ali o vendedor muda a etapa, cria e edita tarefas, edita o contato e as tags, vê os insights e desfaz ações da Aria sem sair da conversa. O Inbox do ERP é um painel de atendimento por setor. Mostra a oportunidade só como link (`PainelSetor.tsx:18-21`) e deixa o resto no Funil, em Contatos e em Tarefas.
2. Das 31 sobreposições do protótipo, o ERP tem 4 iguais, 11 parciais e 4 com outra regra. Faltam 12: tarefa (criar, editar e cartão no fio), resumo de handoff, edição e revisão da sugestão da Aria, tags, bloco B2B, templates e a faixa "Aria ativa".
3. Quase toda a lacuna é de UI. O servidor já tem mover etapa, perder, tarefa, tags, campos, histórico, desfazer da Aria, reagendar e enviar agora. Falta ligar tudo no Inbox. Lacunas reais de modelo:
   - probabilidade e previsão de fechamento da oportunidade;
   - CPF e idade na Pessoa;
   - vínculo da tarefa com a conversa, recorrência e "notificar também";
   - no agendamento: "perguntar se o contato responder", recorrência e edição do texto;
   - aprovar a sugestão da Aria com edição e em pacote;
   - todos os Insights.
4. **Achado grave:** a nota interna gravada pelo Inbox não aparece em lugar nenhum do Inbox. `notasDoAtendimento` (`src/server/whatsapp/acoes-conversa.ts:48`) não tem nenhuma chamada. A rota da conversa devolve só as notas do lead, e `useConversa` ignora o campo `notas`.
5. Das abas do painel (Detalhes, Oportunidades, Insights e Atividade), nenhuma existe como aba. Detalhes e Oportunidades são parciais. Insights e Atividade faltam. Insights não está planejado em fase nenhuma: a Fase 3 empurrou para a Fase 5 (`03-fase-inbox.md:1474`), e a Fase 5 só entregou o bloco da Aria (Task 29).
6. Atalhos de saída: o ERP tem `?c=`, mas não tem `?agendar=1`. Os atalhos para Contatos, Empresa e Configurações › Números faltam. Nenhuma tela do ERP, além do sino de SLA, abre uma conversa (`/inbox?c=`). No protótipo, Funil, Tarefas, Contatos e Agente abrem.
7. O ERP tem coisas que o protótipo não mostra:
   - atribuir, convidar e encerrar;
   - encaminhar, editar, reagir e apagar mensagem;
   - opt-out, vincular e desvincular;
   - cobrança com pagamento e promessa;
   - triagem;
   - respostas rápidas com `/`;
   - emoji e gravação de voz.

   Não podem sumir ao portar o desenho.

**Números:**

| | EXISTE | PARCIAL | DIVERGE | FALTA | Total |
|---|---|---|---|---|---|
| Telas e sobreposições | 4 | 11 | 4 | 12 | 31 |
| Atalhos | 3 | 4 | 2 | 15 | 24 |
| Abas do painel | 0 | 2 | 0 | 2 | 4 |
| **Total** | **7** | **17** | **6** | **29** | **59** |

---

## 2. Telas e sobreposições

| # | Tela | Gatilho (protótipo) | Conteúdo e campos no protótipo | ERP hoje | Status | Lacuna |
|---|---|---|---|---|---|---|
| T01 | Popover "Nova conversa" | Botão "Nova conversa" (P:45) | **Campos:** busca "Nome ou número com DDD" (P:54), lista de contatos e conversas recentes ou resultados (P:68-75). A busca procura por nome ou por 3 ou mais dígitos (P:1041-1043).<br>**Número novo:** com 10 dígitos ou mais e sem contato, mostra "Conversar com +55…" ("cria o contato e uma oportunidade em Novo lead") (P:58-63, P:1044). "Novo contato" sem número válido dá aviso (P:1052). Lista vazia (P:76).<br>**Salva** com `startNew` (P:934-939). Telefone existente abre a conversa. Telefone novo cria o contato, a oportunidade em "Novo lead" com origem "Prospecção ativa", o responsável "Você" e o evento "a primeira mensagem precisa ser um modelo aprovado". O rascunho vem do insight. | `NovoAtendimento.tsx:15-64`, formulário fixo no topo da página (`page.tsx:69`).<br>**Campos:** "Finalidade e destinatário", só destinos já cadastrados no escopo (`listarOpcoesAtendimento`), e "Canal da escola". No comercial, só linhas comerciais (`:23`).<br>`abrirAtendimentoInstitucional` é idempotente.<br>**Não tem:** busca, número livre, criação de contato ou oportunidade. | DIVERGE | UI + BE (as peças existem: `garantirPessoaTx` em `crm/pessoas.ts:90` e `criarLead` em `comercial/acoes.ts:137`; falta a ação que junte as duas e abra o atendimento) + MOTOR (template na primeira mensagem) |
| T02 | Popover "Filtrar conversas" | Botão Filtros (P:44) | **Grupos com contagem** (P:1047): Etapa do funil, Tags, Responsável, Tipo (B2C/B2B) e Outros. Outros = não lidas, tarefa atrasada, sem tarefa aberta, fixadas, sem resposta há mais de 15 min e há mais de 1 h (P:989).<br>Chips removíveis (P:129-134), "Limpar" e "Mostrar N conversas" (P:93-96). | `PainelFiltros.tsx:31-77` fica sempre visível, sem popover.<br>**Tem:** busca, abas Todas, Minhas, Fila, Não lidas e Prazo estourado (`:44-50`), selects de setor, número e status (`:61-74`). | PARCIAL | UI + BE (o filtro não tem etapa, tag, tipo, tarefa nem fixadas; detalhes na parte 2) |
| T03 | Popover "Ver conversas de" (números de WhatsApp) | Rótulo do número (P:42). Só Admin, ou Gerente com a flag `crm-ger-wa` (P:871) | Para cada número: nome, número, contagem e aviso "Instável" (P:103).<br>"Gerenciar números em Configurações" leva a `Configuracoes.dc.html#wa`, só para Admin (P:104). | Select "Número" (`PainelFiltros.tsx:66-69`). Sem contagem, sem saúde e sem link. | PARCIAL | UI |
| T04 | Faixa "Aria ativa" com interruptor global | Sempre na lista (P:114-121) | Texto "N em atendimento · N aguardando você" ou "Pausada…" (P:1033). Interruptor de pausa global (P:1034, só estado local). | Não existe no Inbox. `pausarAria` e `reativarAria` existem (`src/server/aria/acoes.ts:35,39`) e são usadas na tela `/aria`. | FALTA | UI (e decidir quem vê) |
| T05 | Popover "Transferir conversa", 2 passos | Botão Transferir no cabeçalho (P:174) | **Passo 1** (P:189-215):<br>• Pessoas, com presença e carga. Sai o dono atual (P:833, P:1173).<br>• Equipes e filas (P:834).<br>• "Devolver para Aria", só se a conversa está com humano (P:207-213, P:1175).<br>**Passo 2** (P:216-234):<br>• destino com "Trocar";<br>• "Contexto para quem recebe" (opcional);<br>• "Anexar resumo de Aria como nota", ligado por padrão, só se vinha da IA (P:964);<br>• "Continuar seguindo a conversa";<br>• Voltar e Transferir.<br>**Salva** com `doTransfer` (P:960-968): rejeita as sugestões pendentes, troca o dono e grava as notas. | Ações separadas em `AcoesAtendimento.tsx:95-102`.<br>• **Transferir** (`:146-198`): setor do número, contexto obrigatório entre 12 e 1000 caracteres e matrícula ou aluno para Financeiro e Pedagógico.<br>• **Atribuir** (`:200-264`): só gerente ou admin.<br>• **Convidar:** duração, "Pode enviar" e motivo com pelo menos 10 caracteres.<br>• **Devolver para Aria:** no painel, só com a Aria pausada (`PainelAria.tsx:33-35`). | DIVERGE | UI + BE (não existe presença nem carga; não existe "equipe" além de setor) + FORA ("seguir conversa", pendência 12) |
| T06 | Menu "Mais" | Botão ⋮ (P:182) | **Status da conversa:** Aberta, Pendente, Resolvida e Arquivada (P:240-244, P:865, P:1178).<br>**Itens** (P:1179-1189):<br>• Marcar como não lida;<br>• Fixar;<br>• Silenciar por 8 h;<br>• Criar tarefa;<br>• Agendar mensagem;<br>• Buscar na conversa (⌘F, só aviso);<br>• Mesclar contato duplicado (aviso);<br>• Exportar conversa em PDF (aviso);<br>• Arquivar contato;<br>• Bloquear contato. | Sem menu; botões em linha (`AcoesAtendimento.tsx:94-107`):<br>• Assumir, Devolver para a fila, Atribuir e Transferir;<br>• Convidar, Nota interna, Agendar e "Convites e agendamentos";<br>• Encerrar, com confirmação (`:117-129`);<br>• Bloquear, desabilitado e sem motor (`:104`);<br>• Fixar e Silenciar por 8 h (`:48`, `:105-106`). | PARCIAL | Status: DIVERGE (enum `StatusAtendimentoWhatsApp` em `schema.prisma:401-406`).<br>Não lida: UI (`marcarNaoLida` em `whatsapp/preferencias.ts:45` sem tela).<br>Tarefa: UI.<br>Busca: UI + BE.<br>Mesclar (`crm/duplicados.ts:214`) e PDF: FORA.<br>Arquivar: substituído por Encerrar (doc 03:22).<br>Bloquear: MOTOR + motivo (doc 03:29). |
| T07 | Faixa de handoff | Conversa com handoff (P:253-262) | "Aria pediu ajuda há 4 min" (texto fixo), o motivo e o botão "Ver resumo e assumir". | `PainelAria.tsx:30-32` mostra "Aria pausada · Handoff" (rótulo de `MOTIVO_PAUSA_IA_LABEL`). O motivo e o resumo ficam em `AcaoAgenteIA.payload` (`aria/turno/handoff.ts:112-122`), mas não são lidos. | PARCIAL | UI (consulta do último HANDOFF) |
| T08 | Modal "Resumo de handoff" | "Ver resumo e assumir" (P:260), "Assumir conversa" (P:176) ou "Assumir para responder" (P:413) | Mostra "O que o contato quer", "O que Aria já fez" (registro não desfeito, com hora, P:1112) e "Próxima ação sugerida". Botões Cancelar e "Assumir e responder" (P:435-468).<br>**Salva** com `takeOver` (P:911): conversa vira humana, dono "Você", sugestões pendentes são rejeitadas, grava o evento. | Não existe. O resumo só vira nota de texto (`handoff.ts:38-45, :110`), e essa nota não aparece no Inbox (ver T19).<br>Não há ação "assumir da Aria": `pausarAriaNoAtendimento` (`aria/pausa.ts:38`) só é chamada pelo handoff e pela saída humana (`pausa.ts:67-68`). O enum `MANUAL` (`schema.prisma:9041`) não é usado. | FALTA | UI + BE (resumo estruturado e ação de assumir com pausa MANUAL) + ARIA (os campos "quer" e "próxima" vêm do turno) |
| T09 | Cartão de sugestão da Aria no fio | Sugestão pendente (P:298-326) | **Mostra:** cabeçalho "Aria sugere · aguardando aprovação", título, motivo e texto.<br>**Lista de ações:** enviar, mover etapa, criar tarefa com "Editar tarefa", agendar com horário (P:1019).<br>**Aviso:** "Isso será enviado agora no WhatsApp e não poderá ser desfeito" (P:315).<br>**Botões:** Aprovar e enviar, Editar e Rejeitar; numa sugestão de agendamento, Agendar e Ignorar (P:1018).<br>**Depois de decidir:** "Aprovado por você" ou "Rejeitado" (P:323).<br>**Salva:** `approve` executa o pacote todo (P:893-901), `reject` (P:902). | No painel lateral, não no fio: `PainelAria.tsx:38-51` mostra o rótulo, o resumo truncado (`consultas-inbox.ts:267-271`), "Expira às", Aprovar e Rejeitar.<br>Só vê quem tem `decidirHistorico`, ou seja, Admin e Gerente Comercial (`consultas-inbox.ts:280`). O vendedor não vê.<br>Cada `AcaoAgenteIA` é uma ação; não há pacote. | PARCIAL | UI + BE (agrupar por `TurnoAgenteIA`, em `schema.prisma:9092-9110`) + decisão de papel |
| T10 | Editar sugestão (texto) | "Editar" no cartão (P:319, P:1021) | Caixa de texto no lugar do texto (P:308, P:1022). O botão vira "Aprovar e enviar editado" (P:1018). | `aprovarAcaoAria(id)` não recebe texto editado (`aria/historico.ts:44-56`). | FALTA | UI + BE |
| T11 | Modal "Revisar tarefa sugerida" | "Editar tarefa" na ação da sugestão (P:312) ou "Editar" numa sugestão só de tarefa (P:1021) | É o modal de tarefa no modo da sugestão (P:919, P:1062): chip "Sugerida por Aria" (P:689) e botão "Aprovar com edições" (P:1070, P:924). | Não existe. | FALTA | UI + BE (aprovar com edição) |
| T12 | "Agendar sugestão de Aria" | "Editar" numa sugestão de agendamento (P:1021) | É o popover de agendar com o título da sugestão (P:1078). Botão "Aprovar e agendar" (P:1086, P:950). | Não existe. | FALTA | UI + BE |
| T13 | Cartão de tarefa no fio | Tarefa criada por humano ou pela Aria (P:283-297) | Ícone do tipo, "Você criou uma tarefa" ou "Aria criou uma tarefa" com hora, título e "prazo · responsável · tipo" (em vermelho se atrasada). Botões lápis e Concluir. Estados Concluída e Excluída (P:1005-1007). | Não existe. O fio só traz mensagens. `Tarefa` não tem `atendimentoId` (`schema.prisma:9595-9645`; tem `leadId`, `pessoaId`, `alunoId` e `matriculaId`). | FALTA | UI + BE (vínculo com a conversa ou projeção por Evento) |
| T14 | Modal "Nova tarefa" | Ícone no compositor (P:427), menu Mais (P:1183), "+ Nova tarefa" (P:560) ou "Criar tarefa" (P:586) | **Campos:**<br>• título obrigatório: aviso "Dê um título para a tarefa" (P:921), botão cinza enquanto vazio (P:1057, P:1071);<br>• Tipo, 5 chips (P:847);<br>• Quando: chips Hoje 18h, Amanhã 9h, Amanhã 14h e Segunda 9h, mais data e hora (P:836, P:1060);<br>• Responsável: Você e a equipe (P:1065);<br>• Lembrete: Sem lembrete, Na hora, 15 min, 1 h ou 1 dia antes (P:849);<br>• Descrição opcional;<br>• "Vincular à oportunidade", ligado por padrão (P:714, P:1066);<br>• "Enviar mensagem nesta data", com texto (P:715-720, P:926-927);<br>• Mais opções: Prioridade (Baixa, Normal ou Alta), Repetir (P:850) e "Notificar também" (P:724-727);<br>• "Já foi feita" (P:732).<br>**Contexto:** chip do contato e "Conversa vinculada" (P:686-690).<br>**Salva:** a tarefa, o cartão no fio e, se marcado, a mensagem agendada (P:927). | Não existe no Inbox.<br>**Servidor:** `criarTarefa` (`crm/tarefas.ts:161`). Validação em `:43-56`: título até 200, tipo com 5 valores, descrição até 2000, prioridade NORMAL ou ALTA, lembrete 0, 10, 30 ou 60 min, `leadId`, `pessoaId`, `alunoId` e `matriculaId`.<br>`IntencaoMensagem.tarefaId` existe (`schema.prisma:2703`; `crm/mensagens-agendadas.ts:50`).<br>`PainelTarefa` (`tarefas/PainelTarefa.tsx:43-79`) é preso à rota `/tarefas` e não passa lead nem pessoa. | FALTA | UI + BE (lembretes de 15 min e 1 dia, prioridade Baixa, recorrência e "notificar também" não existem no modelo) |
| T15 | Modal "Editar tarefa" | Lápis no cartão (P:292) ou na aba Oportunidades (P:570) | Mesmo modal no modo edição (P:918, P:925). O prazo atual vira chip (P:1064). Tem Excluir (P:733). Não tem "Já foi feita" nem mensagem. | Servidor: `editarTarefa(id, versao, …)` (`crm/tarefas.ts:217`).<br>O ERP não apaga: `cancelarTarefa` exige motivo (`:346`). | FALTA | UI. Excluir é DIVERGE (vira cancelar com motivo). |
| T16 | Popover "Agendar mensagem" | Relógio no compositor (P:426), menu Mais (P:1184) ou `?agendar=1` (P:881) | **Trava:** a conversa precisa estar com humano. Senão, aviso "Assuma a conversa para agendar mensagens" (P:940).<br>**Mensagem:**<br>• caixa pré-preenchida com o rascunho (P:942);<br>• "Escrever com Aria" (P:367, P:1095);<br>• respostas rápidas (P:862, P:373);<br>• Anexar: Proposta, Catálogo ou Foto da turma (P:863, P:374-378).<br>**Quando:**<br>• chips Em 1 hora, Hoje 18h, Amanhã 9h, Amanhã 14h e Segunda 9h (P:861);<br>• data (mínimo hoje) e hora;<br>• "Horário de Brasília (GMT-3)" fixo (P:387).<br>**Validações e alertas:**<br>• "Esse horário já passou" (P:1083);<br>• conflito: outra agendada a menos de 2 h (P:1076, P:1084).<br>**Opções:**<br>• "Perguntar antes de enviar se o contato responder" (P:391);<br>• Mais opções: Repetir e "Vincular a" Nenhum, Oportunidade ou Tarefa aberta (P:1085).<br>**Rodapé:** Salvar rascunho (P:401, P:946), Cancelar e Agendar. Agendar só com horário futuro e texto ou anexo (P:947-948). | `DialogoAgendar` (`AcoesAtendimento.tsx:291-321`):<br>• Mensagem obrigatória, até 4000 caracteres;<br>• "Enviar em" com o fuso escrito (`CampoDataHoraLocal`);<br>• `validarQuando` (`:56-62`) recusa vazio, horário inválido ou que cai no ajuste do horário de verão, e passado;<br>• idempotente.<br>Aparece só com `pode("agendar")` (`:101`).<br>A lista e o cancelamento ficam em "Convites e agendamentos" (`:328-396`). | PARCIAL | UI: chips, respostas rápidas, rascunho e conflito.<br>BE: o anexo existe no modelo (`IntencaoMensagem.midiaPath`), mas a ação só aceita texto. O vínculo existe em `agendarMensagem`, mas `agendarMensagemNoAtendimento` (`acoes-conversa.ts:72-86`) não o passa. "Perguntar se responder" não existe.<br>FORA: recorrência.<br>ARIA: "Escrever com Aria". |
| T17 | Cartões de mensagens agendadas no fio | Agendamento pendente (P:328-348) | **Mostra:** "Agendada para … · por você" ou "por Aria", anexo, texto e "Repete …".<br>**Botões:** Editar, Enviar agora e Cancelar.<br>**Se o contato respondeu:** "X respondeu depois que você agendou. Ainda quer enviar?", com "Cancelar envio" e "Manter agendada" (P:335-340, P:1090).<br>**Envio automático:** P:881. | Não existe no fio. Só a lista no diálogo, com Cancelar (`AcoesAtendimento.tsx:378-389`).<br>O servidor tem `reagendarMensagem` e `enviarAgora` (`crm/mensagens-agendadas.ts:320,331`). Editar o texto não existe. | FALTA | UI (reagendar e enviar agora) + BE (editar o texto e perguntar se o contato responder) |
| T18 | Popover "Enviar" (anexos) | Clipe no compositor (P:425) | 9 itens (P:1161): Documento, Fotos e vídeos, Câmera, Áudio, Localização, Contato, Proposta (gerada da oportunidade), Catálogo e Template (o Template preenche o rascunho, P:971). Os itens só simulam o envio (P:969-972). | Menu Anexar (`Compositor.tsx:243-261`):<br>• Documento, Fotos e vídeos, Áudio (abrem o seletor de arquivo);<br>• Contato, Enquete e Localização desabilitados sem o motor (`:54-58`, `:251-258`), e sem `onClick` mesmo com o motor (`:255`);<br>• gravação de voz (`:284-286`), colar arquivo (`:276`), emoji, GIF e figurinha (`:221-227`). | PARCIAL | UI: Câmera.<br>BE: Proposta (`Documento` categoria PROPOSTA em `schema.prisma:1496-1502`) e Catálogo (de onde vem?).<br>MOTOR: Contato, Localização e Enquete.<br>MOTOR + UI: Template. |
| T19 | Nota interna | Aba "Nota interna" no compositor (P:420), botão no compositor travado (P:412) ou "Adicionar nota" no painel (P:587) | **Compositor em modo nota:** borda e fundo amarelos, placeholder "Nota interna · @ para mencionar" (P:1105-1109) e dica "@ mencionar" (P:422).<br>**No fio:** balão "Nota interna · só equipe" (P:1010-1013).<br>**Salva:** `send` com nota (P:913-914). | **Gravação:** botão "Nota interna" abre `DialogoNota` (`AcoesAtendimento.tsx:266-288`): obrigatória, até 2000 caracteres, idempotente. Grava `Evento` NotaInterna (`acoes-conversa.ts:24-46`).<br>O `Compositor` tem modo nota (`Compositor.tsx:17,22,72,210`), mas `ConversaAberta.tsx:165` fixa `modo="responder"`.<br>**A nota gravada não aparece:**<br>• `notasDoAtendimento` (`acoes-conversa.ts:48`) não tem nenhuma chamada;<br>• a rota da conversa devolve só `notasDoLead` (`server/inbox/consultas-pagina.ts:183`);<br>• `useConversa` ignora `notas`.<br>**Menção com @:** não existe. | PARCIAL | UI (mostrar as notas e alternar o modo) + BE (menção e notificação) |
| T20 | Respostas rápidas | Dica "/ respostas rápidas" (P:422) e chips no agendar (P:373) | O protótipo não tem lista no compositor. | Atalho `/` com lista (`Compositor.tsx:207`, `:228-238`; `ConversaAberta.tsx:98-103`, `:172-173`). A base é `TemplateWhatsApp` com tipo `RESPOSTA_RAPIDA` (`schema.prisma:414-417`). | EXISTE | — (o ERP vai além) |
| T21 | Templates (modelos aprovados) | Item "Template" no anexo (P:1161, P:971). Conversa nova avisa "a primeira mensagem precisa ser um modelo aprovado" (P:937). | Preenche o rascunho com um texto fixo. | Não há seletor no Inbox. `TemplateWhatsApp` existe (`schema.prisma:2732`). | FALTA | UI + MOTOR |
| T22 | Encaminhar mensagem | Não existe no protótipo | — | `EncaminharMensagem` (`AcoesMensagem.tsx:88-172`): busca, "Carregar mais", só o mesmo número, só onde a pessoa pode enviar, confirmação. Atende o doc 03:19. | EXISTE | — (só no ERP) |
| T23 | Tags do contato | Chips no topo do painel com ✦ quando a IA criou (P:483-485). "+ tag" (P:486) não tem ação. | As tags também entram na busca (P:991) e no filtro (P:1047). | Não existem no Inbox.<br>**Servidor:** `atribuirTag` e `removerTag` (`crm/tags.ts:126-130`), `atribuirTagDaFicha` (`crm/contatos-acoes.ts:23-27`).<br>A Aria grava com `criadoPorId: null` (`aria/turno/executor.ts:390`). | FALTA | UI (o protótipo não define o fluxo de "+ tag") |
| T24 | Edição do contato (lápis do painel) | Lápis (P:475) | **Modo edição:** alterna B2C e B2B (P:504-511). Campos inline sem validação (P:517, P:532), guardados só em estado local (P:1127).<br>**Campos B2C:** WhatsApp, E-mail, Cidade, Origem, CPF, Idade, Preferências e campos personalizados.<br>**Campos B2B:** Empresa, Cargo, CNPJ, Segmento, Tamanho, Site e Decisor (P:1129-1139). | Só "Editar nome" (`AcoesContato.tsx:95-133`): nome da conversa, até 80 caracteres, explica de onde vem o nome; em branco volta ao perfil do WhatsApp.<br>**Servidor:** `editarPessoaDaFicha` (`crm/contatos-acoes.ts:11`). Os campos são nome, e-mail, cidade, cargo, LinkedIn, origem e empresa (`crm/contatos.ts:399-407`). `definirCampoDaFicha` (`contatos-acoes.ts:31`). | PARCIAL | UI + BE (CPF e idade não existem em `Pessoa`, `schema.prisma:9409-9444`; só em `Aluno.documento` e `nascimento`, `:1197-1207`) |
| T25 | Contato sem nome | `noName` (P:479) | Texto "Aria vai perguntar…", campo "Nome do contato" e Salvar. Salvar recusa vazio e tira a tag "Sem nome" (P:1119). | "Editar nome", fechado num botão (`AcoesContato.tsx:80`). | PARCIAL | UI |
| T26 | "Cliente voltou" | `askLink` (P:489, P:1124-1125) | "Fulano já é cliente e voltou a escrever… é um novo interesse?". Botões "Criar nova oportunidade" (leva a `Funil.dc.html?novo=`) e "Vincular a …". | "Criar oportunidade" (`criarLeadDaConversa`, `AcoesContato.tsx:60-64`, `:79`) e "Vincular" (`:138-196`).<br>Não detecta o cliente que voltou. | PARCIAL | UI + BE (consulta de oportunidade ganha ou perdida da pessoa) |
| T27 | Bloco B2B no painel | Oportunidade B2B (P:498-502) | Empresa com "Ver empresa" (P:499) e "Contatos nesta oportunidade" (nome, papel e cargo; P:1121). "Falar com" troca o interlocutor (P:501). | Não existe no Inbox.<br>**Modelo:** `Empresa` e `ParticipanteOportunidade` com papel (`schema.prisma:9183-9240`). Existe a rota `/empresas/[id]`. | FALTA | UI (bloco e link) + BE ("Falar com" exige abrir ou trocar o atendimento para outra pessoa) |
| T28 | Painel no tablet como gaveta | Botão "Painel do contato" (P:181). Abaixo de 1200 px o painel começa fechado (P:879, P:1113). | No tablet, fixo à direita sobre a conversa (`mobile.js:47`). | Abaixo de 1100 px: `Drawer` "Detalhes da conversa" (`InboxNovo.tsx:248-250`; `Drawer.tsx:22`). A partir de 1100 px: coluna própria (`:247`). | EXISTE | — (o conteúdo difere; ver §4) |
| T29 | Vistas do celular | `mView` (P:879, P:996, P:1113) | **Vistas:** lista, conversa ou painel, uma por vez (`mobile.js:34-36`).<br>**Voltar:** P:164 e P:474.<br>**Diálogos:** popovers viram painel de baixo (`mobile.js:43-45`); modais ocupam a tela (`mobile.js:44`). | `data-vista` lista, conversa ou painel (`InboxNovo.tsx:104`, `:214-250`).<br>Voltar em `ConversaAberta.tsx:112`.<br>`Modal` com `folha` abre de baixo no celular (`Modal.tsx:48`).<br>O painel no celular é uma gaveta, não uma vista. | EXISTE | — |
| T30 | Compositor travado enquanto a IA atende | Conversa com a Aria (P:408-415, P:997-999) | Mostra o estado da Aria, "Nota interna" e "Assumir para responder". Sem compositor. | O compositor depende só de `podeEnviar`, isto é, escopo e encerramento (`ConversaAberta.tsx:81-83`, `:163-174`). Um humano escreve com a Aria ativa, e a Aria pausa sozinha (`aria/pausa.ts:62-68`). | DIVERGE | Decisão (pergunta 17) |
| T31 | Aviso flutuante (toast) | Ações (P:185, P:959) | Mensagem curta no topo por 2,6 s. | `FeedbackAcao` dentro do bloco de cada ação. | DIVERGE | Só a forma |

**Só no ERP, sem par no protótipo** (não podem sumir):
- **Diálogos de atendimento:** Atribuir, Convidar e "Convites e agendamentos" (`AcoesAtendimento.tsx:200-264`, `:328-396`), e Encerrar (`:117-129`).
- **Ações na mensagem:** Editar, Reagir e Apagar para todos (`AcoesMensagem.tsx:41-62`, `:174-219`).
- **Contato:** Opt-out (`OptOutContato.tsx:23-71`), Vincular e Desvincular (`AcoesContato.tsx:138-252`).
- **Cobrança:** registrar pagamento, promessa e retomar régua (`AcoesContato.tsx:254-328`).
- **Triagem e revisão de envio:** `PainelTriagem.tsx`.
- **Painéis de setor:** Financeiro, Secretaria e Pedagógico (`PainelSetor.tsx:22-31`).
- **Compositor:** emoji, GIF, figurinha e gravação de voz.

**Defeitos do próprio protótipo** (definir antes de implementar):
- Sem ação nenhuma: "+ tag" (P:486), "Marcar como perdido" (P:589), "Buscar na conversa" no cabeçalho (P:173) e o sino de notificações (P:33).
- Só aviso, sem efeito: Mesclar e Exportar (P:1186-1187).
- Código morto de agendamento: `openSchedule`, `popSchedule` e `doSchedule` (P:973-976, P:1168-1170, P:1191-1196). Não há marcação para `popSchedule`.
- `?c=` aceita só `c<número>` e, sem parâmetro, abre `c1` (P:879).

---

## 3. Atalhos para outras funcionalidades

| # | Atalho | Destino no protótipo | Equivalente no ERP | Abre no Inbox ou fora | Status | O que falta |
|---|---|---|---|---|---|---|
| A01 | Abrir a oportunidade atual | Cartão "Oportunidade atual" na aba Detalhes leva à aba Oportunidades, sem sair (P:497, P:1121) | Link `/funil?o=<id>` (`PainelSetor.tsx:19`) e "Abrir oportunidade" (`AcoesContato.tsx:74`, `:37-39`). O `/funil` abre o painel por `?o=` (`funil/page.tsx:25`). | Fora (navega) | PARCIAL | Ver a oportunidade dentro do Inbox. Dá para reaproveitar `funil/PainelOportunidade.tsx` numa gaveta. |
| A02 | Mudar a etapa | Barra de etapas clicável e select (P:547-551). `setStage` grava o evento "Você moveu para" sem regra (P:888-892). As etapas são as 6 do protótipo (P:744). | `moverEtapa` (`comercial/acoes.ts:446`).<br>Regra em `destinoDoArraste` (`crm/etapas.ts:29-49`): um passo por vez; Proposta, Experimental, Perdido e Matrícula exigem ação.<br>As etapas são as 10 de `EtapaLead` (`schema.prisma:1383-1394`; `lib/labels.ts:107-118`). Não existe "Negociação". | Fora (funil) | FALTA | A UI no Inbox, com as regras do funil. As etapas DIVERGEM (pergunta 6). |
| A03 | Ganhar | Sem botão. A etapa "Matrícula" no select e a tag "Ganho" (P:818-819). | "Preparar contratação" leva a `/oportunidades/[id]/contratacao` (`funil/PainelOportunidade.tsx:262`). | Fora | FALTA | Link ou ação no Inbox. |
| A04 | Perder | "Marcar como perdido" (P:589), sem ação. | `marcarPerdido` (`comercial/acoes.ts:572`) com `MotivoPerda` (`schema.prisma:1396-1406`). O modal `funil/ModalPerda.tsx` pode ser reaproveitado. | Fora (funil) | FALTA | UI |
| A05 | Aula experimental | Cartão com data, professor, status e resultado; "Editar" leva a `Funil.dc.html` (P:553, P:868) | `agendarExperimental` e `checkinExperimental` (`comercial/acoes.ts:489`, `:677`). Campos `dataExperimental` e `experimentalConfirmadaEm` (`schema.prisma:1464`, `:1470`). Na tela, `PainelOportunidade.tsx:233`. | Fora | FALTA | UI (cartão e link `/funil?o=`) |
| A06 | Nova oportunidade | `Funil.dc.html?novo=<nome>&pj=1` (P:1123, P:1125). O Funil abre o formulário preenchido (`Funil.dc.html:511`). | "Criar oportunidade" no próprio Inbox (`AcoesContato.tsx:79`, `criarLeadDaConversa`), sem formulário. O `/funil` não lê `?novo=` (`funil/page.tsx:20-60`). | Inbox (ERP) × fora (protótipo) | DIVERGE | Decidir o fluxo. Se for o do protótipo: parâmetro `?novo=` em `/funil` com `NovaOportunidade.tsx`. |
| A07 | Outras oportunidades e "Ver no contato" | Lista com status e valor, mais o link `Contatos.dc.html` (P:577-580, P:867) | Rota `/contatos?c=<pessoaId>` (`contatos/page.tsx:27`). `PainelSetor` recebe `pessoaId` (`server/inbox/paineis.ts:18`, `:61`) e não o usa (`PainelSetor.tsx`). Não há consulta de outras oportunidades no painel (`paineis.ts:49`). | Fora | FALTA | UI + consulta (`Pessoa.oportunidades`). Achado extra: o "Abrir contato" do Funil aponta para `/contatos/<id>`, rota que não existe (`PainelOportunidade.tsx:281`). |
| A08 | Ver empresa | `Contatos.dc.html` (P:499) | `/empresas/[id]` existe | Fora | FALTA | UI (link) |
| A09 | Criar ou editar tarefa | Modal no próprio Inbox (T14 e T15) | Só na tela `/tarefas`, que abre a tarefa por `?t=` (`tarefas/page.tsx:31`) | Fora | FALTA | UI no Inbox (ver T14) |
| A10 | Concluir, reabrir, reagendar ou excluir tarefa | Lista na aba Oportunidades (P:561-575, `taskOp` em P:929-933) e Concluir no cartão (P:293) | `concluirTarefa`, `reabrirTarefa`, `reagendarTarefa` e `cancelarTarefa` (`crm/tarefas.ts:276-346`) | Fora | FALTA | UI. Excluir vira cancelar com motivo. |
| A11 | Contato: editar campos, tags, CPF e perfil | Lápis e campos (T24), tags (T23) | A ficha `/contatos?c=` edita, gerencia tags e campos (`contatos/FichaContato.tsx`). No Inbox, só "Editar nome". | Fora (e só o nome no Inbox) | PARCIAL | UI e modelo (CPF e idade) |
| A12 | Matrícula, aluno e cobrança | O protótipo não tem links para o acadêmico nem para o financeiro | **Painéis de setor** (`PainelSetor.tsx:22-31`): matrícula, cobranças, documentos pendentes, turma e frequência.<br>**"Abrir cadastro do aluno":** `/alunos/[id]` (`AcoesContato.tsx:75`).<br>**Cobrança:** pagamento e promessa (`AcoesContato.tsx:254-328`). | Inbox (pagamento) e fora (aluno) | EXISTE | O código da matrícula sem link para `/matriculas/[id]` (melhoria pequena) |
| A13 | Configurações da Aria | Menu "Agente de IA" (P:1027, P:1031); as regras da etapa aparecem no painel (P:630) | `/aria?aba=` (`aria/page.tsx:31`), pelo menu geral | Fora | EXISTE | Opcional: atalho de "regras da etapa" para `/aria?aba=permissoes` |
| A14 | Insights da Aria | Aba Insights (P:651-677) | — | — | FALTA | ARIA + BE (ver §4) |
| A15 | Pausar a Aria para todos | Interruptor da faixa (P:120) | Só em `/aria` (`pausarAria`, `aria/acoes.ts:35`) | Fora | FALTA | UI (T04) |
| A16 | Devolver para Aria | Botão no cabeçalho (P:179) e item do Transferir (P:207-212) | `PainelAria.tsx:33-35`, só com a Aria pausada e com escopo de envio (`aria/pausa.ts:75-80`) | Inbox | PARCIAL | Botão no cabeçalho |
| A17 | Carteira e responsável | Linha "Responsável" (P:1140), estado "Com X" (P:994), menu Carteira(s) (P:1027) | Cabeçalho "Responsável: X" (`ConversaAberta.tsx:121`) e Atribuir (só gerente).<br>O dono da oportunidade (`vendedorDonoId`) é outra coisa; só muda no funil (`atribuirDono`) e em `/carteira` (`crm/carteira-acoes.ts:6`). | Inbox (atendimento) e fora (carteira) | PARCIAL | Mostrar o dono da oportunidade e decidir se transferir a conversa mexe na carteira (pergunta 3) |
| A18 | Histórico e atividade | Aba Atividade (P:592-650) | `historicoPessoa` (`crm/historico.ts:240`) em `/contatos?c=&hist=` (`contatos/page.tsx:28`); `historicoOportunidade` (`:141`) no funil | Fora | FALTA | UI no Inbox, com consulta por atendimento (ver §4) |
| A19 | Gerenciar números | `Configuracoes.dc.html#wa`, só Admin (P:104) | `/configuracao/whatsapp` existe | Fora | FALTA | UI (link) |
| A20 | Link direto `?c=` | Abre a conversa (P:879). Origens: Funil (`Funil.dc.html:628`), Tarefas (`Tarefas.dc.html:582`, `:695`, `:701`), Contatos (`Contatos.dc.html:624`) e Agente (`Agente.dc.html:618`, `:676`). | `page.tsx:31`. Busca o item fora da primeira página ou do filtro, respeitando o escopo (`:53-57`). Abre na vista conversa (`InboxNovo.tsx:104`) e grava `?c=` ao trocar de conversa (`:169-177`). | Inbox | EXISTE | — |
| A21 | Link direto `?agendar=1` | Abre o agendamento 300 ms depois (P:881). Vem de "Agendar mensagem" no Funil (`Funil.dc.html:628`). | `page.tsx` não lê; o Funil não tem esse item | — | FALTA | UI (abrir `DialogoAgendar` pelo parâmetro) e o item no Funil |
| A22 | Buscar na conversa | Lupa (P:173) e menu (P:1185); no protótipo só dá aviso | — | — | FALTA | UI + BE (a busca está na lista oficial, doc 03:17) |
| A23 | Assumir a conversa da Aria | "Assumir conversa" no cabeçalho (P:176) e no painel (P:588), ou pelo resumo (T08) | "Assumir" é só para a fila (`AcoesAtendimento.tsx:95`). Não há pausa manual da Aria (T08). | Inbox | DIVERGE | BE (pausa MANUAL) e UI |
| A24 | Abrir a conversa a partir das outras telas | Funil, Tarefas, Contatos e Agente apontam para `Inbox.dc.html?c=` (linhas de A20) | Só o sino de SLA (`tarefas/SinoNotificacoes.tsx:17`) e `NovoAtendimento.tsx:30`. Nenhum link em Funil, Contatos, Tarefas ou Aria. | — | FALTA | UI nas outras telas, com consulta "atendimento aberto da pessoa ou oportunidade" |

---

## 4. Abas do painel do contato

O protótipo tem 4 abas (P:1114). Só Atividade tem contador: as alterações da IA não desfeitas.

No ERP, o painel não tem abas:
- **Cabeçalho** (`InboxNovo.tsx:192-196`): nome, telefone (quando a regra 5 deixa) e número com setor.
- **Painel do setor:** `PainelSetor`.
- **Aria:** `PainelAria`, só para Admin e Gerente Comercial.
- **Cadastro e cobrança:** `AcoesContato`.
- **Opt-out:** `OptOutContato` (`InboxNovo.tsx:190-211`).

| Aba | Conteúdo no protótipo (linhas) | ERP hoje | Status | Lacuna |
|---|---|---|---|---|
| **Cabeçalho, comum às abas** | **Identidade:** avatar grande e nome (P:476-478).<br>**Linha abaixo do nome:** "Pessoa física · …" ou "Falando com X · papel" (P:1138).<br>**Tags com ✦:** P:483-486.<br>**Lápis de edição:** P:475.<br>**Blocos de situação:** contato sem nome (T25) e cliente que voltou (T26). | Nome, telefone e número com setor (`InboxNovo.tsx:192-196`). "Editar nome", Vincular e Criar oportunidade (`AcoesContato.tsx:72-88`). | PARCIAL | UI (tags e edição) |
| **Detalhes** | **Oportunidade atual:** cartão "produto · valor/mês · etapa" que leva à aba Oportunidades (P:497).<br>**Bloco B2B** (T27, P:498-502).<br>**Contato:** WhatsApp, E-mail, Cidade (ou Segmento no B2B) e Origem (P:1139).<br>**Perfil (B2C):** CPF, Idade, Preferências e campos personalizados com ✦ IA (Objetivo, Nível, Disponibilidade, Profissão; P:765, P:1129-1131).<br>**Empresa (B2B):** Empresa, Cargo, CNPJ, Segmento, Tamanho, Site/LinkedIn e Decisor (P:1129).<br>**Edição** com alternância B2C e B2B (P:504-511). | No comercial (`PainelSetor.tsx:18-21`): link da oportunidade com etapa e valor. Telefone no cabeçalho.<br>E-mail, cidade, origem, campos personalizados e empresa não aparecem. `carregarPainel` não lê a Pessoa (`paineis.ts:43-61`); `camposDaPessoa` existe (`crm/ficha-dados.ts:21`). | PARCIAL | UI + consulta (BE leve). Modelo: CPF, idade e "decisor" (o B2B tem `PapelParticipante.DECISOR`). |
| **Oportunidades** | **Cabeçalho:** "Oportunidade atual · Funil Matrículas", título (produto), valor e observação (P:543-544).<br>**Etapa:** barra e select (A02).<br>**Aula experimental** (A05).<br>**Linhas:** Responsável, Temperatura com score, Probabilidade com previsão, Produto (P:1140).<br>**Tarefas:** "N aberta(s)" e "+ Nova tarefa". Cada uma com caixa para concluir ou reabrir, reagendar para amanhã 9h, editar e excluir, prazo em vermelho se atrasada e ✦ se a IA criou (P:559-576).<br>**Outras oportunidades:** com "Ver no contato" (P:577-580) e "Nova oportunidade" (P:581).<br>**Ações:** Criar tarefa, Adicionar nota, Assumir conversa e "Marcar como perdido" (P:585-590). | Título, etapa, valor e link (`PainelSetor.tsx:18-21`). Fora do comercial, mostra o painel do setor.<br>No modelo: `temperatura` (`schema.prisma:1424`), `valorPrevisto` e `planoPrevisto` (`:1478-1479`), `dataExperimental` (`:1464`), `Tarefa.leadId` com índice. Faltam probabilidade e previsão de fechamento. | PARCIAL | UI (etapa, perda, experimental, tarefas, outras oportunidades) + BE (probabilidade e previsão; "valor por mês" e valor do contrato) + DIVERGE (etapas e regra) |
| **Insights** | **Indicadores:** Temperatura (Quente, Morno, Frio ou Ganho, com ícone), Chance de fechar em %, Sentimento e Melhor horário (P:652-657).<br>**Análise:** Intenção detectada (P:658-661), Sinais de compra (P:662-665), Objeções e riscos (P:666-669).<br>**Próximo melhor passo:** título, texto sugerido e botão "Usar como rascunho" ou "Assumir e usar como rascunho" (P:670-675, P:1165-1166).<br>**Rodapé:** "Atualizado há 2 min · com base nas mensagens, campos e histórico" (P:676). | Não existe.<br>No modelo só há `temperatura` (manual, `definirTemperatura` em `comercial/acoes.ts:299`) e o resumo executivo `interesse`, `objetivo`, `urgencia`, `orcamento`, `objecao` e `proximaAcao` (`schema.prisma:1454-1460`, "IA na Fase 1"), gravado por `atualizarResumo` (`comercial/acoes.ts:365`).<br>Não há chance, sentimento, melhor horário, listas de sinais e riscos nem texto sugerido. `OrigemChamadaIA.RESUMO` existe no enum, sem gerador.<br>Nenhuma fase planeja (`03-fase-inbox.md:1474` passa para a Fase 5; a Task 29 da Fase 5 não inclui). | FALTA | ARIA + BE (modelo e geração) + UI |
| **Atividade** | **Mensagens agendadas:** horário e autor, com Editar, Enviar agora e Cancelar (P:593-610).<br>**Atividade recente:** última interação, número de conversas e tarefas abertas, e as 2 últimas notas internas com autor e hora (P:611-621).<br>**"Aria neste contato":** última ação, barra de confiança com cor por faixa (75 e 55; P:1145) e regras da etapa, "Automático em X" e "Com aprovação" (`RULES`, P:745-751; P:623-631).<br>**"Alterações da IA":** lista com ícone, texto e hora. Desfazer restaura etapa, tag, campo, agendamento ou tarefa (P:903-910). Quando não dá, mostra cadeado com o motivo ("Mensagem já enviada", "Handoff já comunicado"; P:633-649). | **Agendadas:** só no diálogo "Convites e agendamentos", com Cancelar (`AcoesAtendimento.tsx:328-396`).<br>**Notas:** não aparecem (T19).<br>**Aria:** `PainelAria` mostra só pausa e sugestões.<br>**Servidor que existe:**<br>• `desfazerAcaoAria` (`aria/acoes.ts:65`; `aria/historico.ts:163`), que recusa quando um humano mudou depois;<br>• confiança em `TurnoAgenteIA.confianca` e `AcaoAgenteIA.confianca` (`schema.prisma:9101`, `:9124`);<br>• a matriz da etapa em `VersaoAgenteIA.config`.<br>**Falta a consulta por atendimento:** `historicoAria` (`aria/consultas.ts:194`) filtra por busca, ação, etapa e resultado. `AcaoAgenteIA` tem índice por `[atendimentoId, criadoEm]`, então a consulta é simples. | FALTA | UI + BE (consultas por atendimento: ações da Aria, notas, resumo de atividade) |

---

## 5. Integrações cruzadas e lacunas do modelo

| Entidade | O Inbox precisa ler | O Inbox precisa escrever | Schema | Servidor que já existe | Lacuna |
|---|---|---|---|---|---|
| **Oportunidade** (`@@map("Lead")`) | Título e produto, valor, etapa, temperatura, probabilidade e previsão, experimental, dono, outras oportunidades da pessoa e participantes B2B | Etapa, perda com motivo, nova oportunidade, temperatura, experimental | `schema.prisma:1408-1494`. Probabilidade e previsão não existem. `planoPrevisto` é texto livre. | **Leitura:** `paineis.ts:49` lê só id, nome, etapa, `valorPrevisto` e `pessoaId`. `obterOportunidade` e `historicoOportunidade` (`crm/historico.ts:141`, `:158`) dão o detalhe completo, usado no funil.<br>**Escrita:** `comercial/acoes.ts`: `criarLead` 137, `definirTemperatura` 299, `atualizarResumo` 365, `moverEtapa` 446, `agendarExperimental` 489, `enviarProposta` 549, `marcarPerdido` 572, `atribuirDono` 766. | Campos: probabilidade e previsão. Etapas: as 6 do protótipo contra as 10 do ERP. O painel do Inbox precisa usar `DetalheOportunidade` e as regras de `destinoDoArraste`. |
| **Pessoa e contato** | E-mail, cidade, cargo, origem, empresa, CPF, idade, preferências, campos personalizados e possíveis duplicados | Os mesmos campos, mais o nome | `Pessoa` (`:9409-9444`), `ContatoWhatsApp` (`:2451`, com `nomeExibicao` e `nomePerfil`), `ValorCampoPersonalizado` (`:9524`), `Aluno.documento` e `nascimento` (`:1197-1207`) | `editarPessoaDaFicha`, `definirCampoDaFicha` e `mesclarContatosDaLista` (`crm/contatos-acoes.ts:11`, `:31`, `:35`). `camposDaPessoa` (`crm/ficha-dados.ts:21`). `editarNomeContatoWhatsApp` (Inbox). | CPF e idade fora da Pessoa. O painel não carrega a Pessoa. O tipo B2C ou B2B sai de `Oportunidade.b2b` e `empresaId`; no protótipo é uma alternância livre (P:1136). |
| **Tarefa** | Tarefas da oportunidade e da pessoa (abertas e concluídas), atraso e se a IA criou | Criar, editar, concluir, reabrir, reagendar e cancelar | `Tarefa` (`:9595-9645`): tem `leadId`, `pessoaId`, `alunoId`, `matriculaId`, `setor` obrigatório e `origem` (HUMANO, IA, IA_SUGERIDA ou AUTOMACAO). `PrioridadeTarefa` é NORMAL ou ALTA (`:9578`). Lembrete em minutos (`:9611`). | `crm/tarefas.ts:161-370` e `tarefas-acoes.ts` (`"use server"`). Escopo em `escopoTarefas` (`:73`). | **Faltam no modelo:** `atendimentoId` (cartão no fio e "Conversa vinculada"), recorrência, "notificar também" e prioridade Baixa.<br>**Lembrete:** o protótipo pede 15 min e 1 dia; o ERP aceita 0, 10, 30 e 60.<br>**Excluir:** no ERP é cancelar com motivo.<br>**Setor:** vem do atendimento. |
| **Tag** | Tags da pessoa, com a marca de IA | Atribuir e remover | `Tag` e `PessoaTag` (`:9456-9480`, com `criadoPorId`). Também `EmpresaTag`. | `crm/tags.ts:126-130`. A Aria grava com `criadoPorId: null` (`aria/turno/executor.ts:390`). | Só UI. Decidir se "sem autor" quer dizer "feita pela IA" (importação também pode gravar sem autor). |
| **Atividade e Evento** | Eventos no fio ("Você moveu para…", "Aria adicionou tag…", tarefas e agendamentos; P:887-891), notas, histórico | Nota interna | `Evento` (`:2346-2364`), com agregados `AtendimentoWhatsApp`, `Lead`, `Pessoa` e `AcaoAgenteIA` | `registrarNotaAtendimento` e `notasDoAtendimento` (`acoes-conversa.ts:24`, `:48`), `historicoPessoa` (`crm/historico.ts:240`) | O fio do ERP só mostra mensagens (`BalaoMensagem`). Falta mostrar eventos no fio e as notas do atendimento (T19). |
| **Aria** | Estado global, pausa por conversa, sugestões em pacote, ações feitas com desfazer, confiança, regras da etapa, resumo de handoff e insights | Aprovar (com edição), rejeitar, desfazer, devolver, assumir (pausa MANUAL) e pausar para todos | `AgenteIA`, `VersaoAgenteIA`, `TurnoAgenteIA` e `AcaoAgenteIA` (`:9063-9152`); `AtendimentoWhatsApp.iaPausadaEm` e `iaPausaMotivo` | `aria/acoes.ts:31-75`, `carregarAriaDoAtendimento` (`consultas-inbox.ts:274`), `historicoAria` (`aria/consultas.ts:194`) | **Back-end:**<br>• aprovar com payload editado;<br>• sugestão em pacote por turno;<br>• consulta de ações por atendimento;<br>• ação "assumir" com pausa MANUAL;<br>• resumo de handoff estruturado.<br>**Insights:** sem modelo.<br>**Papel:** só Admin e Gerente Comercial decidem (`capacidadesAria`). |
| **Comercial** (carteira e linha) | Dono da oportunidade, linha comercial, quem pode ver a oportunidade na conversa | Reatribuir dono (?) | `Oportunidade.vendedorDonoId`, `CoberturaCarteira` (`:265`) | `podeVerLeadNaThread` (`consultas-inbox.ts:181`), `reatribuirCarteiraEmLote` (`crm/carteira-acoes.ts:6`) | Responsável do atendimento e dono da oportunidade são campos diferentes. O protótipo mostra um só "Responsável". |
| **Mensagem agendada** | Pendentes do atendimento, com autor, anexo e recorrência; "contato respondeu depois" | Agendar, reagendar, editar, enviar agora e cancelar | `IntencaoMensagem` (`:2652-2720`): tem `agendadaPara`, `tarefaId`, `leadId` e `midiaPath` | `agendarMensagemNoAtendimento` (`acoes-conversa.ts:72`), `reagendarMensagem`, `enviarAgora` e `cancelarMensagemAgendada` (`crm/mensagens-agendadas.ts:320-340`), `listarConvitesEAgendamentos` | **Faltam:** editar o texto, "perguntar se o contato responder" (campo e fluxo), anexo e vínculo no agendamento feito pelo Inbox.<br>**FORA:** recorrência. |
| **Template e resposta rápida** | Modelos aprovados e respostas rápidas | — | `TemplateWhatsApp` (`:2732`), com tipo `RESPOSTA_RAPIDA` (`:414-417`) | `respostasRapidasDoCompositor` (`crm-config/acoes-respostas.ts:21`) | Seletor de template (MOTOR, janela de 24 h) |

---

## 6. Perguntas ao dono

1. **Sugestões da Aria e papéis.** Hoje, no Inbox, só Admin e Gerente Comercial veem e aprovam sugestões (`consultas-inbox.ts:280`). O vendedor dono da conversa também decide, como no protótipo?
2. **Sugestão em pacote e edição.** O protótipo aprova de uma vez enviar, mover a etapa e criar a tarefa, e permite editar o texto, a tarefa e o horário antes de aprovar. Isso entra? Exige aprovar com edição e agrupar por turno.
3. **Transferir.** O protótipo junta pessoa, equipe ou fila e "Devolver para Aria" num só fluxo, com contexto opcional e "anexar resumo". O ERP separa:
   - Transferir: entre setores, contexto obrigatório com pelo menos 12 caracteres;
   - Atribuir: só gerente;
   - Convidar.

   Qual modelo vale? O vendedor pode passar a conversa para outro vendedor? Isso muda o dono da oportunidade (carteira)?
4. **Presença e equipes.** No Transferir, presença (online ou ausente) e carga de cada pessoa entram? "Equipes e filas" são os setores ou equipes novas?
5. **Status da conversa.** O protótipo tem Aberta, Pendente, Resolvida e Arquivada, manuais. O ERP tem Sem responsável, Em atendimento, Aguardando cliente e Encerrado. Qual lista aparece? Existem "Pendente" e "Resolvida" manuais?
6. **Etapas.** O protótipo tem 6 etapas livres, com "Negociação". O ERP tem 10, com regras: um passo por vez, check-in do professor, e Proposta e Matrícula por ação. A mudança de etapa no Inbox segue as regras do Funil?
7. **Nova conversa por número.** O vendedor pode digitar um número, criar a Pessoa e a oportunidade em "Novo lead" e abrir a conversa pelo Inbox? Em quais linhas? Como escolhe o template da primeira mensagem?
8. **Tarefa no Inbox.** Entram prioridade Baixa, lembretes de 15 min e 1 dia, recorrência, "notificar também" e "já foi feita"? "Excluir" vira "cancelar com motivo", que é a regra atual?
9. **Agendamento no Inbox.** Entram "perguntar antes de enviar se o contato responder", anexo, "vincular a" oportunidade ou tarefa, editar o texto e "enviar agora"? A recorrência continua fora (pendência 12 da Fase 3)?
10. **Insights.** Em qual fase entram? Quais campos (chance, sentimento, melhor horário, sinais, riscos)? Podem usar os campos de resumo da Oportunidade (interesse, objeção, próxima ação)?
11. **Dados do contato no painel.** O painel mostra telefone, e-mail e CPF? A regra 5 esconde o telefone no pedagógico. CPF e idade não existem na Pessoa (só no Aluno): criar?
12. **Tags da IA.** "Sem autor" pode ser o critério para a marca ✦ de "feita pela IA"? Como funciona o "+ tag", que o protótipo não define?
13. **Itens só de aviso no protótipo.** Mesclar duplicado, exportar PDF e "seguir conversa" continuam fora (pendência 12)? "Buscar na conversa" está no doc 03 (linha 17): quando entra?
14. **Bloquear.** O protótipo bloqueia sem motivo e para qualquer um. O doc 03 exige motivo e restringe a Admin e gerentes. Confirmar o doc 03.
15. **Abas e setores.** As abas do protótipo convivem com os painéis de Financeiro, Secretaria e Pedagógico? Quais abas aparecem em conversa que não é comercial?
16. **Onde abrir a ficha.** Oportunidade, contato e tarefa abrem dentro do Inbox (gaveta) ou vão para Funil, Contatos e Tarefas?
17. **Assumir da Aria.** "Assumir conversa" deve pausar a Aria na hora (pausa MANUAL), mesmo antes de o humano enviar? Enquanto a Aria atende, o compositor fica travado, como no protótipo, ou livre, como no ERP?
18. **Faixa "Aria ativa".** A faixa com interruptor global aparece no Inbox? Para quem?
19. **Entrada pelas outras telas.** Funil ("Agendar mensagem" com `?agendar=1`), Tarefas e Contatos ("Abrir conversa") e o Histórico da Aria abrem a conversa no Inbox, como no protótipo?

---

## 7. Esforço por bloco e ordem sugerida

| Bloco | Conteúdo | Tipo | Esforço |
|---|---|---|---|
| B1 | **Atalhos simples.** No Inbox:<br>• `/contatos?c=` e `/empresas/[id]`;<br>• matrícula com link;<br>• `/configuracao/whatsapp`;<br>• `?agendar=1`;<br>• "Marcar como não lida";<br>• "Devolver para Aria" no cabeçalho.<br>Nas outras telas: links "Abrir conversa" (A24). | UI | P |
| B2 | **Notas.** Mostrar as notas do atendimento no fio ou no painel, e alternar Responder e Nota no compositor (T19). A menção com @ e a notificação ficam à parte. | UI (+ BE para a menção) | P (M com menção) |
| B3 | **Aba Detalhes.** Carregar a Pessoa e os campos no painel, edição inline e tags (T23, T24, T25). | UI + BE leve | M |
| B4 | **Aba Oportunidades.** Etapa com `destinoDoArraste`, perda com `ModalPerda`, experimental, outras oportunidades, nova oportunidade, bloco B2B (A02-A08, T27). | UI + BE leve | M |
| B5 | **Tarefas no Inbox.** Modal de criar e editar, lista na aba, ações (T13-T15, A09-A10). | UI (+ BE para vínculo com a conversa, recorrência e "notificar") | M (G com modelo novo) |
| B6 | **Agendamento completo.**<br>• Parte de UI: chips, conflito, rascunho, cartões no fio, reagendar e enviar agora.<br>• Parte de BE: anexo, "perguntar se responder" e editar o texto (T16-T17). | UI e BE | M (UI) + M (BE) |
| B7 | **Atividade.** Ações da Aria com desfazer, confiança, regras da etapa, agendadas, notas e resumo (§4). | UI + BE (consultas) | M |
| B8 | **Aria no fio.**<br>• Cartão de sugestão, faixa e modal de handoff, assumir com pausa MANUAL.<br>• Aprovar com edição, pacote por turno, revisar a tarefa e o agendamento sugeridos (T07-T12, A23). | UI + BE + ARIA | G |
| B9 | **Transferir unificado e nova conversa por número.** Presença, equipes, criar contato e oportunidade, template (T01, T05, T21). | UI + BE + MOTOR | G (depende das perguntas 3, 4 e 7) |
| B10 | **Insights** (aba e geração). | ARIA + BE + UI | G |
| B11 | **Anexos extras.**<br>• Câmera: P.<br>• Proposta da oportunidade: M.<br>• Contato, Localização e Enquete: motor.<br>• Catálogo: decisão. | UI + MOTOR | P a M |
| B12 | **Faixa "Aria ativa" e status da conversa** (T04, T06). | UI (+ decisão) | P |

**Ordem sugerida:**
1. **B1 e B2:** rápidos, e corrigem a nota invisível.
2. **B3, depois B4:** o painel passa a ter Detalhes e Oportunidades, reaproveitando Funil e Contatos.
3. **B5, depois a parte de UI de B6.**
4. **B7:** a Atividade reaproveita `desfazerAcaoAria`.
5. **B12.**
6. **B8:** depende das perguntas 1, 2 e 17.
7. **A parte de BE de B6 e o B9:** dependem das perguntas 3, 4, 7 e 9.
8. **B10 e B11:** dependem de fase e decisão.

Antes do B4, alinhar as etapas (pergunta 6). Sem isso, a barra de etapas do protótipo não tem como ser portada.

---

## 8. Capturas de estado geradas

Todas ficam em `docs/planejamento/inbox-prototipo/telas/` (seleção; o conjunto completo ficou fora do repositório). Nenhum arquivo existente foi sobrescrito.

**Como foram geradas**
- Scripts: (scripts de captura fora do repositório) e (scripts de captura fora do repositório).
- Tema escuro, papel Admin.
- Tamanhos: computador 1440×900, tablet 1024×768 e celular 390×844.

**Lista**
- Conversa nova: `prototipo-estado-nova-conversa.png` e `prototipo-estado-nova-conversa-numero.png` (número novo digitado).
- Lista: `prototipo-estado-filtros.png` e `prototipo-estado-seletor-whatsapp.png`.
- Transferir e menu Mais:
  - `prototipo-estado-transferir-passo1.png`;
  - `prototipo-estado-transferir-passo2.png`;
  - `prototipo-estado-menu-mais.png`.
- Handoff:
  - `prototipo-estado-handoff-banner-b2b.png` (Grupo Ventura);
  - `prototipo-estado-modal-resumo-handoff.png`.
- Anexos: `prototipo-estado-anexos.png`.
- Agendar mensagem:
  - `prototipo-estado-agendar-deeplink.png` (`?c=c4&agendar=1`);
  - `prototipo-estado-agendar-mais-opcoes.png` (com anexos e o aviso de conflito);
  - `prototipo-estado-agendar-erro-passado.png`;
  - `prototipo-estado-agendar-bloqueado-ia.png` (`?c=c1&agendar=1`, aviso "Assuma a conversa").
- Tarefa:
  - `prototipo-estado-tarefa-nova.png`;
  - `prototipo-estado-tarefa-nova-mais-opcoes.png` (com "Enviar mensagem nesta data");
  - `prototipo-estado-tarefa-editar.png`.
- Sugestões da Aria:
  - `prototipo-estado-sugestao-pendente.png`;
  - `prototipo-estado-sugestao-editando-texto.png`;
  - `prototipo-estado-sugestao-revisar-tarefa.png`;
  - `prototipo-estado-sugestao-agendar-followup.png`.
- Nota interna: `prototipo-estado-nota-interna.png`.
- Painel do contato:
  - `prototipo-estado-painel-detalhes.png`;
  - `prototipo-estado-painel-detalhes-b2b.png`;
  - `prototipo-estado-painel-oportunidades.png`;
  - `prototipo-estado-painel-oportunidades-tarefas.png`;
  - `prototipo-estado-painel-insights.png`;
  - `prototipo-estado-painel-atividade.png`;
  - `prototipo-estado-painel-atividade-agendadas.png`;
  - `prototipo-estado-painel-editar-contato.png`;
  - `prototipo-estado-painel-sem-nome.png`;
  - `prototipo-estado-painel-cliente-voltou.png`.
- Tablet: `prototipo-estado-tablet-painel-drawer.png`.
- Celular:
  - `prototipo-estado-celular-lista.png`;
  - `prototipo-estado-celular-conversa.png`;
  - `prototipo-estado-celular-sheet-transferir.png`;
  - `prototipo-estado-celular-painel.png`;
  - `prototipo-estado-celular-menu-mais.png` (painel de baixo do menu "Mais" da barra inferior).

**Não captado:** o menu ⋮ da conversa como painel de baixo no celular. O clique falhou porque a conversa no celular sempre abre na lista.
