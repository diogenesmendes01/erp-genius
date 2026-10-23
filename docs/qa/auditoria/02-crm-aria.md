# Auditoria 02: CRM, relatórios e Aria

> Data: 21/10/2026 · Branch `qa/auditoria-e-onboarding` (HEAD `9e3d1d3c`, igual ao `main` mais o kit de QA).
> Método: leitura estática do código e dos documentos. Nada foi executado (sem testes, sem app).
> "Existe código" não quer dizer "homologado". As referências `arquivo:linha` são do HEAD acima.
>
> Precedência usada: (1) SPECs em `docs/specs/` (para esta área só existe a SPEC-ERP-005,
> `docs/specs/whatsapp-linha-comercial.md`); (2) `docs/37`; (3) `docs/planejamento/quadro-entregas.md`,
> `decisoes-dono-2026-10-17.md` e `.superpowers/sdd/*` (o que foi entregue); (4) docs 01 a 32, em especial
> 08 e 27 (especificação original, em parte obsoleta). O plano das Fases 2 e 5 citado no quadro
> (`00-visao-geral.md`, "plano 05") **não está no repositório**: as regras dele só aparecem pelo que o
> quadro registra.

## Resumo

| Status | Itens |
|---|---|
| CONFORME | 26 |
| DIVERGENTE | 13 |
| NAO_IMPLEMENTADO | 4 |
| PARCIAL | 15 |
| SEM_DOC | 5 |
| **Total** | **63** |

O CRM antigo (`/pipeline`, `/leads`, ficha do lead, `/carteiras`, copiloto, réguas comerciais) saiu do código
(quadro, blocos J e "B13 e D4", migration `20261020090000_remover_crm_antigo`). O CRM novo é o funil de
**Oportunidade** (o model `Oportunidade` continua gravado na tabela `"Lead"`, `prisma/schema.prisma:1398-1470`),
com Contatos (Pessoa como hub), Carteira, Tarefas, Relatórios, Metas, Configuração › CRM e a Aria.

**Os 5 achados mais importantes**

1. **A experimental não chega ao check-in do professor (achado 4).** O funil novo agenda a experimental sem
   professor (`src/app/(app)/funil/PainelOportunidade.tsx:203` manda só `dataISO`), a action grava
   `professorExperimentalId = null` (`src/server/comercial/acoes.ts:494,503`) e não há tela que chame
   `atribuirProfessorExperimental` (`acoes.ts:703`). O check-in exige o professor atribuído (`acoes.ts:678-683`)
   e a Home do professor só lista as atribuídas (`src/server/home/consultas.ts:44`). Na prática, as etapas
   **Exp. realizada** e **No-show** ficam inalcançáveis pela interface, e a Home do gerente conta "check-ins
   vencidos" que ninguém resolve (`home/consultas.ts:123-125`). A ficha antiga tinha o select "Professor
   responsável" (`docs/guia-dev-fluxo-crm.md:405`): é regressão.
2. **O kit de QA e o guia do dev descrevem o CRM antigo (achados 60 e 61).** `docs/guia-dev-fluxo-crm.md`
   (base `f8a9c0e`), o Módulo 2 de `docs/qa/03-roteiro-testes-manuais.md` (CRM-01 em diante, "Leads › Novo lead",
   ficha, "Mudar etapa…") e a tabela de menus de `docs/qa/02-usuarios-e-papeis.md:150-153` ("Pipeline · Leads")
   apontam para telas que não existem. Os cenários deste relatório substituem esse módulo.
3. **Seeds sem equipe comercial (achado 62).** Nenhum seed preenche `Usuario.gerenteComercialId` (nenhuma
   ocorrência em `prisma/seed.ts` nem em `prisma/seed-qa.ts`). O escopo do Gerente Comercial é a equipe
   (`src/server/_shared/escopo-comercial.ts:51-57`): o GC puro (`gerente@genius.com`) abre Funil, Carteira e
   Relatórios vazios até o Administrador ligar os vendedores a ele em Configuração › Usuários
   (`src/app/(app)/configuracao/usuarios/UsuarioFormulario.tsx:106`).
4. **Gerente Comercial sem caminho de menu para Configuração › CRM, e Empresas com menu que nega (achados 48
   e 18).** O item "Configuração" não existe para o GC (`src/lib/nav.ts:73-77`, travado por
   `src/app/casca-crm-removida.test.ts:27`), embora a aba CRM seja dele (`configuracao/_componentes/tabs.ts:25`).
   Ele só chega por URL ou pelo link "Definir metas" (`relatorios/_componentes/AbaEquipe.tsx:14`). Já "Empresas"
   aparece no menu do GC e da Secretaria (`nav.ts:63-69`), mas a página só abre para Financeiro e Administrador
   (`src/app/(app)/empresas/page.tsx:13-17`). O vendedor cria empresas pelo funil (modo Empresa) e não consegue
   vê-las.
5. **Retornos enganosos na tela (achados 10, 11, 32).** "Mover selecionadas" mostra "Etapa atualizada." mesmo
   quando todas as oportunidades foram recusadas (`src/app/(app)/funil/FunilCliente.tsx:74-81`); "Abrir contato"
   aponta para `/contatos/<id>`, rota que não existe (`PainelOportunidade.tsx:250`; a ficha abre por
   `/contatos?c=<id>`, `contatos/page.tsx:26`); e a aba Conversas dos Relatórios diz "sem horário de
   funcionamento configurado" mesmo com horário salvo (`src/server/relatorios/atendimento.ts:16-17,101`;
   `relatorios/_componentes/AbaConversas.tsx:21`).

## Mapa de telas

Legenda: ADM administrador · GC gerente comercial · VEND vendedor · FIN financeiro · SEC secretaria acadêmica ·
GP gerente pedagógico · PROF professor. `exigirSessaoPagina` redireciona papel errado para `/acesso-negado`; o
Administrador passa em qualquer guard (`src/server/_shared/sessao.ts:120-123,186`). O menu só esconde.

| Rota | Arquivo | Papéis (guard real) | O que faz | Status vs doc |
|---|---|---|---|---|
| `/funil` | `src/app/(app)/funil/page.tsx:20` | ADM, GC, VEND | Quadro (10 colunas, Matriculado e Perdido recolhidos) e Lista; filtros Busca, Tipo, Dono (só quem atribui), Temperatura, Origem, Perdidos 30/90 dias, Ordem; Nova oportunidade; mover em lote (Lista); Exportar (só ADM ou quem tem `dados.exportar_leads`, `page.tsx:48`) | PARCIAL |
| `/funil?o=<id>` | `funil/PainelOportunidade.tsx` | ADM, GC, VEND, dentro da carteira | Painel lateral com abas Oportunidade (responsável, temperatura, agendar experimental, link de pagamento da taxa, Enviar proposta, Preparar contratação, Marcar como perdida), Detalhes (dados, resumo, datas, documentos) e Atividade (interação, nota interna, histórico) | PARCIAL (achados 4, 11) |
| `/carteira` | `src/app/(app)/carteira/page.tsx:34` | ADM, GC, VEND; aba Coberturas só ADM/GC (`:36-38`) | Lista das oportunidades não perdidas com dias sem interação, turma ativa, tags; filtros; reatribuição em lote (gestão); coberturas temporárias | CONFORME |
| `/contatos` e `/contatos?c=<id>` | `src/app/(app)/contatos/page.tsx:23` | ADM, GC, VEND, SEC | Lista de Pessoas e Empresas no escopo, ficha (dados, tags, campos, opt-out, notas, histórico, oportunidades), Nova oportunidade (quem tem `funil.mover`), Importar e Mesclar (ADM/GC), Exportar (`dados.exportar_contatos`) | CONFORME |
| `/tarefas` | `src/app/(app)/tarefas/page.tsx:25` | ADM, GC, VEND, FIN, SEC | Lista, agenda semanal e calendário; Minhas/Equipe (Equipe só com `tarefas.equipe`); Nova tarefa; sino de notificações | PARCIAL |
| `/oportunidades/[id]/contratacao` | `src/app/(app)/oportunidades/[id]/contratacao/page.tsx:9` | VEND, GC, SEC (e ADM) | Preparar contratação: conferir identidade, escolher oferta e turma, reserva. Detalhe do fluxo na auditoria 04 | CONFORME |
| `/relatorios` | `src/app/(app)/relatorios/page.tsx:50` | ADM, GC, VEND; abas Equipe e Aria só ADM/GC (`:18-25,53`) | Visão geral, Funil, Equipe, Aria, Conversas, Atividades; período Hoje/7D/30D/personalizado; filtros Responsável e Autor só gestão; detalhe por métrica; CSV (`dados.exportar_leads`) | PARCIAL (achado 32) |
| `/configuracao/crm` | `configuracao/crm/page.tsx:8`, `layout.tsx:10` | ADM, GC | Redireciona para a primeira seção; sub-abas por papel (`secoes.ts:16-22`) | DIVERGENTE (achado 48) |
| `/configuracao/crm/distribuicao` | `distribuicao/page.tsx:17` | ADM (4 setores), GC (só Comercial) | Regra (Rodízio, Menor carga, Manual), participantes, prazo da 1ª resposta, alertas, horário por dia, "Copiar de outro setor" | CONFORME |
| `/configuracao/crm/tags-campos` | `tags-campos/page.tsx:7` | ADM, GC | Tags (nome, cor, grupo) e campos personalizados; arquivar | CONFORME |
| `/configuracao/crm/respostas` | `respostas/page.tsx:8,15` | ADM (todos os setores), GC (só Comercial) | Respostas rápidas (atalho, setor, "Aria pode usar") | CONFORME |
| `/configuracao/crm/metas` | `metas/page.tsx:22` | ADM, GC | Metas por mês e pessoa: Matrículas, Valor ganho (com moeda), Experimentais realizadas | CONFORME |
| `/configuracao/crm/ia` | `ia/page.tsx:7` | só ADM | Provedor e estado da chave, modelos, orçamento mensal, ação ao estourar, triagem, chamadas recentes | CONFORME |
| `/aria` (menu "Agente de IA") | `src/app/(app)/aria/page.tsx:27` | ADM (tudo), GC (opera, sem matriz, estado nem provedor; `src/server/aria/permissoes-tela.ts:22-30`) | Cabeçalho (estado, pausa, supervisão), abas Visão geral, Comportamento, Permissões, Conhecimento, Handoff, Confiança, Histórico, Playground; publicar versão | CONFORME |
| `/empresas`, `/empresas/[id]` | `src/app/(app)/empresas/page.tsx:13-17`, `[id]/page.tsx:13-18` | só FIN (e ADM) | Lista e ficha da empresa B2B (contrato, faturas; cobrança B2B desligada, D9) | DIVERGENTE (achado 18) |
| `GET /api/exportacoes/[tipo]` | `src/app/api/exportacoes/[tipo]/route.ts:44-52` | capacidade por tipo (`leads` → `dados.exportar_leads`, `contatos` → `dados.exportar_contatos`) | Planilha .xlsx com o escopo e os filtros da tela | CONFORME |
| `GET /api/relatorios/exportar` | `src/app/api/relatorios/exportar/route.ts:21` | `dados.exportar_leads`; Equipe, Aria e filtro por pessoa só para gestão (quadro, R1 do #228, C2) | CSV da aba | CONFORME |
| `POST /api/contatos/importar` | `src/app/api/contatos/importar/route.ts:39-41` | `contatos.importar` (ADM, GC) | Prévia e aplicação de XLSX de contatos | CONFORME |

Matriz de capacidades do CRM (`src/server/crm/permissoes.ts:32-47`): ADM tudo; GC funil (ver, mover, atribuir),
carteira (equipe, coberturas), contatos (ver, editar, mesclar, importar), tarefas (ver, equipe), comissões (ver,
equipe); VEND funil ver e mover, contatos ver e editar, tarefas ver, comissões ver; FIN tarefas e comissões
(inclusive estornar, Q7); SEC contatos ver e tarefas ver; GP, PROF e ALUNO nada.

## Máquina de estados da oportunidade como está no código

Etapas (`enum EtapaLead`, `prisma/schema.prisma:1373-1384`), na ordem das colunas do quadro
(`src/server/crm/etapas.ts:6-17`): Novo → 1º contato → Qualificado → Exp. agendada → Exp. realizada → No-show →
Proposta → Aguardando matrícula → Matriculado → Perdido. Matriculado e Perdido nascem recolhidas (`etapas.ts:19`).

**Regra única do arraste e dos botões** (`destinoDoArraste`, `etapas.ts:29-48`):

| Origem → destino | O que acontece |
|---|---|
| Mesma coluna | Nada (sem diálogo, sem Evento) |
| Matriculado ou Perdido → qualquer | Recusa "Oportunidade encerrada não volta ao funil." |
| qualquer → Perdido | Abre o modal "Marcar … como perdida" (motivo da lista fechada; observação obrigatória em "Outro", `src/server/comercial/schema.ts:97-105`) |
| qualquer → Aguardando matrícula ou Matriculado | Vai para "Preparar contratação" |
| qualquer → Proposta | Abre o painel; a etapa só muda com o botão "Enviar proposta" |
| qualquer → Exp. realizada ou No-show | Recusa "Esta etapa é registrada pelo check-in do professor." |
| transição manual permitida | Move e grava `EtapaAlterada {de, para, origem: "manual"}` (`src/server/crm/mover-etapa.ts:28-34`) |
| transição manual permitida para Exp. agendada | Abre o painel para "Agendar experimental" |
| o resto | Recusa "Avance uma etapa por vez." |

Transições manuais (`src/server/_shared/regras.ts:355-369`): Novo → 1º contato; 1º contato → Novo ou Qualificado;
Qualificado → 1º contato ou Exp. agendada; Exp. agendada → Qualificado; Exp. realizada, No-show e Proposta →
Qualificado ou Exp. agendada; Aguardando matrícula → Proposta (Proposta não é etapa manual, então na prática não
há saída). `moverEtapaTx` trava a linha (`FOR UPDATE`) e exige papel VEND/GC e a carteira (`mover-etapa.ts:18-27`).

**Etapas geradas por ação:**

| Etapa | Quem / onde | Função |
|---|---|---|
| Exp. agendada | Botão "Agendar experimental" no painel, só a partir de Qualificado, Exp. realizada, No-show ou Proposta (`PainelOportunidade.tsx:81`) | `agendarExperimental`, `acoes.ts:481-538`. Grava a data, zera a confirmação e **zera o professor** quando não recebe `professorId` (`:494,503`); a tela nunca envia professor |
| Exp. realizada / No-show | Home do professor, "Compareceu"/"Faltou" | `checkinExperimental`, `acoes.ts:659-700`; exige etapa Exp. agendada e o professor atribuído (`:678-683`). Hoje inalcançável (achado 4) |
| Proposta | "Enviar proposta", de qualquer etapa aberta (`PainelOportunidade.tsx:82`) | `enviarProposta`, `acoes.ts:540-561`: só muda a etapa e grava `dataProposta` |
| Aguardando matrícula | **Só o caminho legado** `/matriculas/nova` | `criarMatriculaTx`, `src/server/matricula/acoes.ts:394-403`. "Preparar contratação" não muda a etapa (`src/server/matricula/preparacao-comercial.ts:41-63`) |
| Matriculado (ganho) | Ativação da matrícula pela Secretaria | `src/server/matricula/ativacao-preparacao-tx.ts:96-98` (e `matricula/acoes.ts:580-589`) |
| Perdido | "Marcar como perdida" (painel ou arraste) | `marcarPerdido`, `acoes.ts:563-584`, evento `LeadPerdido {motivoPerda, observacao}` |

Pontos de atenção:

- O servidor de `enviarProposta`, `marcarPerdido` e `agendarExperimental` confere só a carteira
  (`exigirLeadVisivel`, `acoes.ts:95-100`), não a etapa de origem. A tela esconde os botões nas encerradas
  (`PainelOportunidade.tsx:80-84`), mas uma chamada direta reabriria uma oportunidade Perdida ou Matriculada.
  Não é testável pela interface (achado 7).
- Na etapa Exp. agendada o botão "Agendar experimental" some (origem igual ao destino). Para remarcar, o vendedor
  volta a oportunidade para Qualificado e agenda de novo (comentário em `regras.ts:359-360`).
- "Enviar proposta" aparece desde Novo: a oportunidade pode pular qualificação e experimental.
- Fluxo de ganho real hoje: Proposta → Preparar contratação → (Secretaria) contrato, pagamento e ativação →
  Matriculado. A coluna Aguardando matrícula fica vazia no fluxo novo.
- Mover em lote (Lista, até 50, `src/server/crm/oportunidades.ts:10-38`) usa a mesma máquina, linha a linha; as
  recusadas voltam no resultado, mas a tela não as mostra (achado 10).
- Toda mudança grava Evento no agregado `Lead`; a aba Atividade do painel é a leitura desses eventos.

## Regras de distribuição, carteira e tarefas como estão no código

**Dono da oportunidade (carteira).**
- Criação manual (`criarLead`, `src/server/comercial/acoes.ts:134-260`): o vendedor sempre vira o dono
  (`resolverDonoLead`, testado em `src/server/_shared/regras.test.ts:195-207`). GC escolhe um vendedor ativo da
  própria equipe; "Sem responsável" é recusado para ele ("Selecione um vendedor da sua equipe.", `acoes.ts:102-104`).
  Só o Administrador cria sem dono.
- "Criar lead" numa conversa da linha comercial (`criarLeadDaConversa`, `src/server/whatsapp/acoes.ts:388-447`):
  dono = dono da linha; se a linha não tem dono, quem cria assume se for vendedor, senão fica sem dono (`:426`).
- Importação de contatos com dono escolhido: pessoa nova ganha oportunidade em Novo com esse dono
  (`src/server/crm/importacao-contatos.ts:207-219`).
- Não há auto-lead no primeiro inbound (removido; a coluna `ConfigComercial.autoLeadAtivo` saiu na migration
  `20261020090000_remover_crm_antigo`) nem rodízio para o dono da oportunidade.

**Escopo de leitura** (`src/server/_shared/escopo-comercial.ts:33-59`): ADM tudo; VEND as próprias e as dos
titulares que ele cobre com cobertura vigente; GC as dos vendedores com `gerenteComercialId` = ele (não as dele
mesmo, salvo se também for vendedor); oportunidade sem dono só o ADM vê. Relatórios e metas usam outro escopo
(`src/server/relatorios/escopo.ts:20-30`): GC = ele e a equipe, VEND = só ele, coberturas não contam.

**Reatribuição.** Manual pelo painel (GC/ADM, motivo, `ConfirmarAcao`) ou em lote na Carteira (até 50, motivo de
5 a 1.000 caracteres, `src/server/crm/carteira.ts:238-271`). `atribuirDono` (`acoes.ts:733-760`) troca o dono,
passa o atendimento comercial aberto para o novo dono, cancela as mensagens humanas pendentes do anterior e grava
`LeadAtribuido {de, para, motivo}`. Comissões já geradas não mudam.

**Coberturas** (`src/server/acesso/coberturas.ts:13-36`): só GC/ADM, entre vendedores ativos da equipe; dão ao
substituto a carteira do titular enquanto vigentes. Não dão acesso à linha de WhatsApp do titular (SPEC-ERP-005
LC-D02) nem entram em relatórios e metas.

**"Dias sem interação" da carteira** (`carteira.ts:66-96`): conta desde o último contato real: eventos
`InteracaoRegistrada`, `TarefaConcluida`, `ExperimentalAgendada`, `ExperimentalConfirmada`, `ExperimentalRealizada`,
mais mensagem recebida do cliente ou enviada por pessoa (`HUMANO` ou `CELULAR`) que chegou. Nota interna, edição,
reatribuição, tags, documentos, régua e Aria não contam (decisões D13 e #254). Sem contato, conta da criação. A
carteira lista tudo que não está Perdido (inclui Matriculado), ordena pelos mais parados e corta em 500.

**Distribuição de atendimentos** (`src/server/crm-config/distribuicao.ts:37-140`), chamada no primeiro inbound de
um atendimento sem responsável (`src/server/whatsapp/atendimentos.ts:105,159`):
1. Comercial com oportunidade cujo dono está ativo → o dono (motivo `CARTEIRA`), em qualquer regra;
2. senão, regra do setor: `RODIZIO` (próximo da lista depois do último atribuído), `MENOR_CARGA` (menos
   atendimentos abertos; empate pela ordem), `MANUAL` ou lista vazia → fila do setor;
3. grava `AtendimentoAtribuido {motivo}`; falha de banco deixa o atendimento na fila (savepoint).
Ela atribui o **atendimento** do Inbox, não o dono da oportunidade. Não há reatribuição automática por SLA. Quem
edita: ADM todos os setores, GC só Comercial; o GP pode pelo servidor (`distribuicao.ts:11-17`), mas a página só
abre para ADM/GC.

**SLA.** Prazo da 1ª resposta por setor, contado só no horário quando ligado, com feriados do calendário escolar
aprovado; alerta único por atendimento no sino (responsável; gerente opcional; sem responsável vai ao gerente ou ao
ADM); resposta da Aria no prazo evita o alerta (quadro, "SLA: horário…" e "SLA: feriados…").

**Tarefas** (`src/server/crm/tarefas.ts`):
- Criação manual em `/tarefas` (título, tipo, descrição, data, hora, duração, prioridade, lembrete 0/10/30/60 min,
  responsável). Exige o fuso da escola configurado (`:177-178`) e data e hora para ter lembrete. A tela não tem campo
  de oportunidade, contato, aluno ou matrícula (`src/app/(app)/tarefas/PainelTarefa.tsx:72-85`), embora o servidor
  aceite. Criação automática só pela Aria (ação `CRIAR_TAREFA`, `src/server/aria/turno/executor.ts:424`).
- Quem vê (`escopoTarefas`, `:73-83`): as minhas, mais a fila sem responsável dos meus setores (setor vem do papel:
  VEND/GC Comercial, FIN Financeiro, SEC Secretaria); "Equipe" acrescenta as dos subordinados do GC; ADM vê todas.
- Atribuir a outra pessoa: só com `tarefas.equipe`, e só para a equipe (`:131`); sem isso, a tarefa é sempre de quem
  cria. "Assumir" pega uma tarefa da fila.
- Estados: Aberta, Concluída (com resultado; se ligada a oportunidade, vira `InteracaoRegistrada`, `:291`),
  Cancelada (motivo obrigatório, `:350`), Reaberta. Edição concorrente recusa com "Esta tarefa foi alterada por outra
  pessoa. Recarregue." (versão otimista, `:151-154`).
- Vencimento e agrupamento por data civil da escola: Atrasadas, Hoje, Amanhã, Próximos 7 dias, Depois, Sem data,
  Concluídas (`src/server/crm/tarefas-regras.ts:4-17`).
- Lembrete: o cron do WhatsApp dispara `rodarLembretesTarefas` (`src/app/api/whatsapp/cron/route.ts:63`;
  `src/server/crm/lembretes.ts:16-35`) e cria uma notificação no sino, que só existe em `/tarefas` e `/inbox`.
  Sem o cron rodando no UAT, nenhum lembrete aparece.

## Aria e integrações: o que é real, o que é simulado, o que o QA consegue testar

**O que é.** Agente de IA do Comercial e da triagem de setor (Fase 5, quadro blocos 5A a 5G). Responde clientes no
Inbox e propõe ou executa ações de CRM: Responder, Enviar documento, Atualizar campo, Tag, Mover etapa, Marcar
perdido, Criar tarefa, Agendar mensagem, Nota interna, Condição comercial, Handoff, Classificar setor
(`enum AcaoAgenteIATipo`, `prisma/schema.prisma:8717-8730`). O que ela pode em cada etapa vem da matriz
(Permissões; só o ADM edita) e das faixas de confiança (padrão: executa a partir de 80, transfere abaixo de 50,
`src/server/aria/config-schema.ts:154-155`).

**Provedor.** Anthropic (Claude Sonnet 5.5 para conversa, resumo e PDF; Claude Haiku 5.5 para classificação;
`src/app/(app)/configuracao/crm/ia/IaPainel.tsx:22-25`), escolhido só pela variável `ANTHROPIC_API_KEY`
(`src/server/aria/provedor/index.ts:9-16`). Sem chave, entra o **provedor simulado**
(`src/server/aria/provedor/simulado.ts`): nada chama a rede e as respostas são fixas:
- conversa: "Obrigada pela mensagem! Vou verificar e já te respondo." (confiança 60); se a fala tem "humano",
  "atendente" ou "pessoa": "Certo, vou chamar um atendente para continuar com você." com handoff "Pediu para falar
  com uma pessoa" (confiança 20);
- classificação de setor por palavra-chave (boleto/pix → Financeiro; professor/nota → Pedagógico;
  declaração/certificado → Secretaria; preço/curso/matricular → Comercial);
- extração de PDF e resumo devolvem vazio, então PDF na base de conhecimento falha com "Não foi possível extrair
  texto deste PDF (documento vazio ou apenas imagem)." (`src/server/aria/conhecimento/fontes.ts:194,233-245`).
Custo: tabela oficial em `src/server/aria/provedor/custo.ts`; orçamento mensal com alerta em 80% e ação ao estourar
(Só sugerir ou Pausar).

**Estados** (`src/server/aria/estado.ts:49-60`; nasce DESLIGADA): Desligada não faz nada; Sombra (SHADOW) roda o
turno e registra tudo como "Simulada", sem enviar nem mudar o CRM (`src/server/aria/turno/executor.ts:121,574`);
Ativa responde e age. Só o ADM muda o estado, e só depois de publicar uma versão ("Publique uma versão antes de
ligar a Aria."). **Ativa sem chave nunca usa o simulado com cliente real**: todo turno vira handoff "Falha do
provedor" (`src/server/aria/turno/orquestrador.ts:184-192`). Em Ativa, a fala da Aria sai pelo despachante; sem
`WHATSAPP_LIVE=1` no ambiente, todo envio é simulado (`src/server/whatsapp/despachante.ts:30,113`).

**Quando a Aria atua** (`src/server/aria/turno/guardas.ts:42-56`): só em atendimento do setor **Comercial**, em
número **sem dono** (linha de vendedor fica de fora: `LINHA_COM_DONO`), conversa individual, sem opt-out, sem pausa
no atendimento, com mensagem que tenha texto. Resposta humana (Inbox ou celular) pausa a Aria naquele atendimento;
"Devolver para Aria" retoma (`src/app/(app)/inbox/PainelAria.tsx:35`). Sugestões são aprovadas ou rejeitadas no
painel do Inbox (`PainelAria.tsx:47-48`) e na aba Histórico, que também desfaz ações executadas; sugestão não
decidida expira pelo cron (`src/server/aria/expiracao.ts:49`).

**"Selo de simulação".** Existe só no Playground: "SIMULAÇÃO · nada é enviado nem alterado"
(`src/app/(app)/aria/_componentes/Playground.tsx:71-73`). O aviso de que o provedor é o simulado aparece só em
Configuração › CRM › IA, para o ADM: "Sem chave, a Aria usa o provedor simulado e nada chama a rede."
(`IaPainel.tsx:47`). A tela `/aria`, o Histórico e o Inbox não dizem se as respostas vieram do simulado.

**O que o QA testa sem chave real e sem WhatsApp real**
- Acesso por papel à `/aria` e à Configuração › CRM › IA.
- Edição do rascunho (Comportamento, Handoff, Confiança, Conhecimento), publicação numerada com nota, descarte,
  restauração de versão, e as travas do GC (não muda matriz, não afrouxa confiança, não muda estado).
- Estado, pausa global com motivo, reativação, supervisão.
- Playground (sem efeito; registra a chamada no uso do mês): respostas fixas do simulado, handoff por pedido de
  humano, destino das ações ("executaria", "pediria aprovação", "sem permissão").
- Base de conhecimento: fonte de texto fica Pronta; PDF falha com a mensagem de extração (esperado sem chave).
- Configuração › CRM › IA: "Chave de API: ausente", salvar modelos, orçamento e triagem; "Chamadas recentes" com
  modelo "simulado".

**O que depende de passo do dev**
- Turno real (SHADOW ou ATIVA): precisa de inbound num número Comercial sem dono, ou seja, motor de WhatsApp
  conectado ou simulado no UAT (ver auditoria 06).
- Resposta "de verdade" do modelo: `ANTHROPIC_API_KEY` no ambiente do UAT.
- Lembretes de tarefa, alertas de SLA e expiração de sugestões: o agendador do `/api/whatsapp/cron` precisa estar
  rodando.

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Transições manuais | doc 08 §Pipelines; `guia-dev` §5 | Novo → 1º contato → Qualificado → Exp. agendada, passo a passo | `regras.ts:355-369`, `etapas.ts:42-47`, `mover-etapa.ts:18-35` | CONFORME | Arrastar duas colunas de uma vez mostra "Avance uma etapa por vez." |
| 2 | Coluna No-show | doc 09 (R9 da auditoria antiga) | No-show é etapa visível | `etapas.ts:12` (coluna existe) | CONFORME | O quadro tem a coluna No-show |
| 3 | Etapas de evento | doc 08 §Aula experimental | Realizada/No-show pelo check-in; proposta e matrícula por ação | `etapas.ts:34-41` | CONFORME | Arrastar para Exp. realizada/No-show recusa; para Proposta abre o painel; para Matriculado/Aguardando vai à contratação |
| 4 | Professor da experimental e check-in | doc 08 §Aula experimental; `guia-dev` l.267 e l.405 | Agendar com professor responsável; professor marca Compareceu/Faltou e o CRM muda de etapa | Agenda sem professor (`PainelOportunidade.tsx:203`; `acoes.ts:494,503`); sem tela para `atribuirProfessorExperimental` (`acoes.ts:703`); check-in exige o atribuído (`acoes.ts:678-683`); Home do professor filtra por ele (`home/consultas.ts:44`) | DIVERGENTE | Não há campo "Professor" ao agendar; a experimental não aparece na Home de nenhum professor; Exp. realizada e No-show não são alcançáveis. Abrir bug |
| 5 | Reagendar experimental | doc 08 §Aula experimental ("Reagendar") | Remarcar a aula | Botão some em Exp. agendada (`PainelOportunidade.tsx:81`; `etapas.ts:30`); caminho é voltar a Qualificado (`regras.ts:359-361`) | PARCIAL | Para remarcar: mover para Qualificado e agendar de novo |
| 6 | Enviar proposta | doc 37 l.72; doc 08 | Proposta com preços e descontos autorizados e versão aprovada | Só muda etapa e `dataProposta` (`acoes.ts:540-561`); botão a partir de qualquer etapa aberta (`PainelOportunidade.tsx:82`) | PARCIAL | "Enviar proposta" aparece já em Novo e não pede conteúdo. Confirmar com o PO se é o esperado |
| 7 | Encerrada não reabre (servidor) | `etapas.ts:31-33` | Oportunidade encerrada não volta ao funil | `enviarProposta`, `marcarPerdido` e `agendarExperimental` não checam a etapa (`acoes.ts:481-584`) | DIVERGENTE | Pela tela os botões somem nas encerradas; não testável pela interface (item para o dev) |
| 8 | Perda | doc 08 §Motivos de perda | Lista fechada; "Outro" com observação obrigatória | `schema.ts:97-105`; `ModalPerda.tsx:56-82` | CONFORME | "Outro" sem observação é recusado |
| 9 | Ganho e Aguardando matrícula | doc 08 §PF ("Aguardando Matrícula em diante = máquina da matrícula") | Aguardando matrícula entre Proposta e Matriculado | "Preparar contratação" não muda etapa (`preparacao-comercial.ts:41-63`); Aguardando só pelo legado (`matricula/acoes.ts:394-395`); Matriculado na ativação (`ativacao-preparacao-tx.ts:96-98`) | PARCIAL | Depois de preparar a contratação a oportunidade fica em Proposta até a Secretaria ativar; a coluna Aguardando fica vazia |
| 10 | Mover em lote | `oportunidades.ts:12-38` (devolve `recusadas`); `guia-dev` §1 (erro de regra aparece) | Recusas visíveis ao usuário | Tela mostra "Etapa atualizada." sem olhar `recusadas` (`FunilCliente.tsx:74-81`) | DIVERGENTE | Mover em lote para uma etapa inválida mostra sucesso e nada muda. Abrir bug |
| 11 | Link "Abrir contato" | `contatos/page.tsx:26`; `FichaContato.test.ts:119` | Ficha abre por `/contatos?c=<id>` | Link para `/contatos/${pessoaId}` (`PainelOportunidade.tsx:250`); não existe rota `[id]` | DIVERGENTE | O link leva a "página não encontrada". Abrir bug |
| 12 | Funil B2B separado | doc 08 §Pipelines | Dois funis (PF e Empresa, etapas próprias) | Funil único com filtro Tipo (`funil.ts:85`; `FunilCliente.tsx`, filtro Tipo) | NAO_IMPLEMENTADO | Empresa usa as mesmas etapas do PF. Não abrir bug |
| 13 | Visualizações salvas e filtro por tag | quadro bloco D (C3: "a exposição como action vem junto com a tela") | Salvar visualização no funil e contatos | Lista as salvas (`funil/page.tsx:30`; chips em `FunilCliente.tsx`), sem botão de salvar (`salvarFiltro` sem chamador em `src/app`); `tagId` só pela URL (`funil.ts:89`) | PARCIAL | Não há como criar visualização nem filtrar por tag pela tela |
| 14 | Exportar do funil | doc 37 D09 | Exportação depende de permissão; planilha com o autorizado | Exige `dados.exportar_leads` (`funil/page.tsx:48`); leva só busca, tipo, temperatura e dono (`:42-46`) | PARCIAL | Sem a permissão o botão não aparece; com filtros de origem, tag ou perdidos, a planilha traz mais linhas que a tela |
| 15 | Responsável na criação (GC) | doc 37 l.64 | GC cria para integrante da equipe | Select oferece "Sem responsável" (`NovaOportunidade.tsx`, campo Responsável), servidor recusa para GC (`acoes.ts:102-104`) | PARCIAL | GC que deixa "Sem responsável" recebe "Selecione um vendedor da sua equipe." |
| 16 | Vendedor dono | doc 08 §Comissão; doc 37 l.64 | Dono definido na entrada; vendedor não escolhe outro | `resolverDonoLead` (`regras.test.ts:195-207`) | CONFORME | Vendedor não vê o campo Responsável |
| 17 | Oportunidade de Empresa | quadro bloco E (C2) | Cria a `Empresa` e liga `empresaId`, sem Pessoa | Sempre cria empresa nova (`NovaOportunidade.tsx:127`; `acoes.ts:157-180`), sem buscar existente; `/empresas` não abre para VEND/GC | PARCIAL | Duas oportunidades da mesma empresa criam duas empresas; o vendedor não vê a empresa criada |
| 18 | Menu Empresas × guard | `guia-dev` §4; comentário `empresas/page.tsx:10-11` ("papéis alinhados ao nav") | Menu e guard iguais | Menu para ADM, GC, FIN, SEC (`nav.ts:63-69`); página só FIN/ADM (`empresas/page.tsx:13-17`) | DIVERGENTE | GC e SEC clicam em Empresas e veem "Acesso negado". Decisão do PO |
| 19 | Escopo comercial | doc 37 l.37-38; `specs/erp-educacional.md` l.77 | Carteira própria ou cobertura; gerente vê a equipe | `escopo-comercial.ts:33-59` | CONFORME | Vendedor A não vê oportunidade de B; `?o=` de outra carteira mostra "Oportunidade fora da sua carteira." |
| 20 | Oportunidade sem dono | SPEC-ERP-005 §5.3 | Dono = dono da linha ou quem cria, se vendedor | GC cria em linha sem dono → sem dono (`whatsapp/acoes.ts:426`); escopo do GC exige dono da equipe (`escopo-comercial.ts:51-58`) | PARCIAL | O GC cria o lead pela conversa e ele não aparece no funil dele (só no do ADM) |
| 21 | Pessoa na oportunidade da conversa | `modelo-atendimento-crm-erp.md` E8; quadro bloco C ("Pessoa como hub") | Toda oportunidade ligada a uma Pessoa | `criarLeadDeInboundWhatsApp` não cria Pessoa (`comercial/captura.ts:66-99`) | DIVERGENTE | Lead criado pelo Inbox não aparece em Contatos e não tem "Abrir contato" |
| 22 | Mensagem com tela antiga | quadro bloco J (saem `/leads`) | Não citar telas removidas | "Cadastre o lead pela tela de Leads" (`whatsapp/acoes.ts:419`) | DIVERGENTE | Texto cita uma tela que não existe; o caminho é Funil › Nova oportunidade |
| 23 | Auto-lead da linha | SPEC-ERP-005 LC-D05 e LC-02 | Com auto-lead ligado, o 1º inbound cria o lead do dono da linha | Coluna removida (migration `20261020090000_remover_crm_antigo`; quadro "B13 e D4") | DIVERGENTE | Sempre aparece "Criar lead"; LC-02 não é testável. SPEC precisa de atualização |
| 24 | Réguas comerciais | doc 08 §Régua; doc 27 C1/C2 | Follow-up automático, lembrete de experimental, recuperação de no-show | Removidas na E1 (nota de 19/10 no doc 27, l.31-36) | NAO_IMPLEMENTADO | Nenhuma mensagem comercial automática. Não abrir bug |
| 25 | Posse de 90 dias | doc 08 §Propriedade e §Comissão | Lead parado > 90 dias volta à fila | Nenhuma regra no código (sem ocorrência em `src/server/crm` e `comercial`) | NAO_IMPLEMENTADO | Oportunidade nunca muda de dono sozinha |
| 26 | Distribuição | doc 08 §Distribuição; quadro 5F Task 39 | Respeitar o dono; opcional reatribuir se não responder | Atribui o atendimento no 1º inbound: carteira, depois rodízio/menor carga/manual (`distribuicao.ts:37-140`); sem reatribuição por SLA | PARCIAL | A regra vale para conversa nova do Inbox, não para a oportunidade criada à mão |
| 27 | Reatribuição | doc 08 §Comissão ("toda troca gera histórico") | Troca auditada | `atribuirDono` (`acoes.ts:733-760`); lote (`carteira.ts:238-271`) | CONFORME | Atividade registra a troca; motivo curto (< 5) recusa no lote |
| 28 | Dias sem interação | quadro D13 e #254 | Só contato real conta | `carteira.ts:66-96` | CONFORME | Nota interna não zera a contagem; interação registrada zera |
| 29 | Coberturas | doc 37 D02; quadro 5E C3 (DF5-11) | Cobertura temporária; não entra em relatório | `coberturas.ts:13-36`; `escopo-comercial.ts:42-50`; `relatorios/escopo.ts:15-19` | CONFORME | Substituto vê a carteira do titular "(cobertura até dd/mm)" e só enquanto vigente |
| 30 | GP e distribuição Pedagógica | quadro 5F Task 39 | GP só Pedagógico | Servidor aceita GP (`distribuicao.ts:11-17`); página só ADM/GC (`distribuicao/page.tsx:17`) | PARCIAL | GP não tem tela; só o ADM configura o setor Pedagógico |
| 31 | SLA | quadro "SLA: horário…" (D1 a D11) e "SLA: feriados…" | Prazo por setor, horário, feriados, alerta no sino | `crm-config/horario-atendimento.ts`, `whatsapp/alertas-sla.ts`, tela `SetorPainel.tsx:109-161` | CONFORME | Tela mostra horário por dia, copiar de outro setor e a nota de feriados |
| 32 | "Fora do horário" nos relatórios | quadro "SLA: horário…", Pendente ("ligar `dentroDoHorario` em `foraDoHorarioPct`") | Métrica com o horário do setor | Sempre `null` (`relatorios/atendimento.ts:16-17,101`) e texto "sem horário de funcionamento configurado" (`AbaConversas.tsx:21`) | DIVERGENTE | Texto diz que não há horário mesmo com horário salvo. Abrir bug (texto) ou aguardar a pendência |
| 33 | Vínculo da tarefa | quadro bloco H (Tasks 27 a 31) | Tarefa ligada à oportunidade/contato e mensagem pela tarefa | Tela sem campo de vínculo (`PainelTarefa.tsx:72-85`); só a Aria cria tarefa ligada (`aria/turno/executor.ts:424`) | PARCIAL | Tarefa criada na tela não aparece na oportunidade nem conta como contato |
| 34 | Escopo das tarefas | quadro bloco H | Minhas + fila do setor; equipe para o gerente | `tarefas.ts:73-83,111-133` | CONFORME | GC vê "Equipe"; atribuir fora da equipe: "Você só pode atribuir tarefas à sua equipe." |
| 35 | Lembretes e sino | quadro "SLA: horário…", Pendente ("levar o sino ao layout global") | Aviso ao responsável | Notificação no sino (`lembretes.ts:16-35`), sino só em `/tarefas` e `/inbox` (`tarefas/page.tsx:18`, `inbox/page.tsx:15`) | PARCIAL | O lembrete só aparece nessas duas telas, e só com o cron rodando |
| 36 | Mensagem agendada pela tarefa | `.superpowers/sdd/02-fase-crm/task-29-report.md` | Agendar mensagem ligada à tarefa | `agendarMensagem` sem chamador na interface (`crm/mensagens-agendadas.ts:99`); a agenda só lista e reagenda (`AgendaTarefas.tsx:194`) | PARCIAL | Mensagens agendadas pelo Inbox aparecem na agenda de tarefas; não há botão para agendar a partir da tarefa |
| 37 | Tarefa concluída vira interação | quadro D13 | Concluir com resultado é contato real | `tarefas.ts:276-300` (`InteracaoRegistrada`, `:291`) | CONFORME | Só vale para tarefa ligada a oportunidade (hoje só as da Aria) |
| 38 | Contatos por papel | quadro bloco B (decisão do C3) | Secretaria vê alunos e responsáveis, sem dados de oportunidade | `pessoas.ts:32-53`; `contatos.ts:325-353` | CONFORME | SEC vê só alunos/responsáveis, sem bloco de oportunidades |
| 39 | Criar contato | não encontrado | — | Sem "Novo contato" em `/contatos`; contato nasce por Nova oportunidade, importação ou Inbox | SEM_DOC | Para criar um contato use Funil › Nova oportunidade ou Importar |
| 40 | Deduplicação | quadro blocos C e F | Uma Pessoa por telefone; aviso de duplicado | `pessoas.ts:90-150` (lock por telefone), `possiveisDuplicados` (`:158-200`) | CONFORME | Ao digitar nome/telefone existente: "Já existe no CRM: …" e "Usar cadastro" |
| 41 | Importação de contatos | quadro bloco F | XLSX com prévia; fora da carteira não é tocado | `api/contatos/importar/route.ts:39-130`; `importacao-contatos.ts:14-17,50-221` | CONFORME | Limites 5 MB e 1.000 linhas; colunas Nome, WhatsApp, E-mail, Cidade, Origem, Tag |
| 42 | Tag criada na importação | não encontrado | — | Tag inexistente é criada com cor neutra (`importacao-contatos.ts:183-188`) | SEM_DOC | Importar com tag nova cria a tag em Tags e campos |
| 43 | Mescla de contatos | quadro D14 | Mescla com prévia; cadastro acadêmico exige alçada da Secretaria | `duplicados.ts:106-112,173,214` | CONFORME | GC sem Secretaria não mescla pessoa com cadastro acadêmico |
| 44 | Exportar contatos | doc 37 D09; quadro bloco F | Capacidade própria, sem telefone e e-mail | `contatos/page.tsx:33`; `exportacoes/[tipo]/route.ts:44` | CONFORME | Planilha sem telefone e e-mail; botão só com a permissão |
| 45 | Escopo dos relatórios do GC | `relatorios/escopo.ts:15-19` (só cobertura documentada) | — | Relatório: GC + equipe (`relatorios/escopo.ts:24-27`); funil: só a equipe (`escopo-comercial.ts:51-57`) | SEM_DOC | Números do GC nos relatórios podem incluir oportunidades dele que o funil não mostra (GC que também é dono) |
| 46 | Exportar relatórios | doc 37 D09; quadro 5E (C2) | Permissão específica; Equipe e Aria só gestão | `pode-exportar.ts:4-10`; rota `exportar/route.ts` | CONFORME | Sem `dados.exportar_leads` o botão some; GC também precisa da permissão |
| 47 | Metas | quadro 5E e decisão de 18/10 | 3 métricas; GC define para a equipe; experimentais contam 1 por oportunidade | `metas.ts:34-75`; tela `metas/page.tsx:22-33` | CONFORME | Meta geral só ADM ("Só o administrador define a meta geral."); Valor ganho exige moeda |
| 48 | Acesso do GC à Configuração › CRM | `tabs.ts:23-25` ("única aba que o GC vê"); quadro 5F (#233) | GC configura o CRM | Sem item "Configuração" no menu do GC (`nav.ts:73-77`; teste `casca-crm-removida.test.ts:27`); só por URL ou "Definir metas" (`AbaEquipe.tsx:14`) | DIVERGENTE | GC não encontra Distribuição, Tags e Respostas pelo menu. Decisão do PO |
| 49 | Seções da Configuração › CRM | quadro 5F | IA só ADM; demais ADM e GC | `secoes.ts:16-22`; `ia/page.tsx:7` | CONFORME | GC não vê a aba IA; por URL cai em acesso negado |
| 50 | Respostas rápidas | quadro "Aria usa as respostas rápidas" | GC só Comercial; Aria usa as marcadas, só no Comercial | `respostas/page.tsx:15`; aviso `AVISO_ARIA` | CONFORME | GC só escolhe o setor Comercial |
| 51 | Tags e campos | quadro 5F Task 40 | Nome único sem acento/caixa; arquivar não apaga | `crm-config/tags-campos.ts` | CONFORME | "Ação" e "acao" contam como o mesmo nome |
| 52 | Provedor e chave | quadro 5A | Chave só no ambiente; sem chave, simulado | `provedor/index.ts:9-16`; `IaPainel.tsx:44-47` | CONFORME | "Chave de API: ausente" e o aviso do simulado |
| 53 | Estados e papéis da Aria | quadro 5B (DF5-13) | ADM muda estado e matriz; GC opera | `permissoes-tela.ts:22-30`; `estado.ts:49-60` | CONFORME | GC não vê o seletor de estado; ligar sem versão publicada é recusado |
| 54 | Sombra e Ativa sem chave | quadro 5C | Sombra não envia; Ativa sem chave não fala com cliente | `executor.ts:121,574`; `orquestrador.ts:184-192` | CONFORME | Em Sombra, Histórico mostra ações "Simulada"; Ativa sem chave transfere com "Falha do provedor" |
| 55 | Onde a Aria atua | não encontrado (só no código) | — | Só Comercial, número sem dono (`guardas.ts:50-51`) | SEM_DOC | Conversa numa linha de vendedor nunca recebe resposta da Aria |
| 56 | Selo de simulação | quadro 5A, 5D | Deixar claro o que é simulado | Selo só no Playground (`Playground.tsx:71-73`); aviso do provedor só para o ADM (`IaPainel.tsx:47`) | PARCIAL | No Inbox e no Histórico não há indicação de que a resposta veio do simulado |
| 57 | PDF sem chave | não encontrado | — | Extração pelo simulado devolve vazio → fonte em Erro (`fontes.ts:194,233-245`) | SEM_DOC | Sem chave, PDF falha com "Não foi possível extrair texto…"; fonte de texto funciona |
| 58 | Aria no Inbox | quadro 5D (Task 29) | Estado, devolver e sugestões no painel | `PainelAria.tsx:15-48` | CONFORME | Aprovar/Rejeitar sugestão; "Devolver para Aria" só com escopo de envio |
| 59 | Gestão e IA do doc 08 | doc 08 §Gestão e §Métricas | Relatório diário no WhatsApp, ranking de gargalos por IA, CAC por campanha, conversão por professor | Nada disso no código (`src/server/relatorios/*` não cita professor nem investimento) | NAO_IMPLEMENTADO | Não procurar essas telas |
| 60 | Guia do dev | `docs/guia-dev-fluxo-crm.md` (base `f8a9c0e`) | Telas `/pipeline`, `/leads`, `/carteiras`, copiloto, réguas | Removidas (quadro bloco J e "B13 e D4"; trava `casca-crm-removida.test.ts:9`) | DIVERGENTE | Não usar o guia como referência de tela |
| 61 | Kit de QA | `docs/qa/03-roteiro-testes-manuais.md` Módulo 2 (l.243 em diante); `docs/qa/02-usuarios-e-papeis.md:150-153` | Cenários na ficha do lead e menus Pipeline/Leads | Telas não existem (redirects em `next.config.mjs`: `/leads` → `/funil`) | DIVERGENTE | Substituir o Módulo 2 pelos cenários abaixo |
| 62 | Equipe comercial nos seeds | `docs/qa/02-usuarios-e-papeis.md` (GC puro) | GC testável isolado | Nenhum `gerenteComercialId` em `prisma/seed.ts` e `prisma/seed-qa.ts` | PARCIAL | Antes dos testes, o ADM liga joao, vendedor2 e vendedor3 ao gerente em Configuração › Usuários |
| 63 | Ligar a Aria sem confirmação | `guia-dev` §2 ("`ConfirmarAcao` em ação de efeito externo") | Confirmar antes de efeito externo | Seletor de estado executa no `onChange` (`aria/_componentes/Cabecalho.tsx:92-100`) | DIVERGENTE | Escolher "Ativa" já liga a Aria, sem pedir confirmação. Decisão do PO |

## Cenários de teste para o QA

Usuários (`docs/qa/02-usuarios-e-papeis.md`): ADM `admin@genius.com`; GC puro `gerente@genius.com` (Ricardo);
GC+VEND `mariana@genius.com`; VEND-A `joao@genius.com`; VEND-B `vendedor2@genius.com`; FIN `financeiro@genius.com`;
SEC `secretaria@genius.com`; PROF `carla@genius.com`. Telefones fictícios `+506 8888 01xx`. Prefixe os nomes com
"QA" e o código do cenário.

Marcas: **[PO]** depende de decisão do PO (registrar o observado, não abrir bug); **[DEV]** depende de passo do
dev no ambiente; **[BUG]** comportamento atual já identificado como defeito nesta auditoria (abrir ou vincular bug).

**Pré-requisito**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-P01 [DEV] | ADM | Configuração › Usuários › editar joao, vendedor2 e vendedor3 › Gerente comercial = Ricardo Vargas › salvar. Conceder "Exportar leads" a mariana e "Exportar contatos" a gerente | Sem este passo, o GC puro vê "Nenhuma oportunidade na sua carteira." em todo o CRM |

**Acesso e menu**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-A01 | VEND-A | Conferir o menu | Tem Funil, Relatórios, Carteira, Contatos, Tarefas, Inbox; não tem Agente de IA nem Configuração |
| CRM-A02 [PO] | GC puro | Conferir o menu; digitar `/configuracao/crm` | Menu tem Agente de IA e não tem Configuração; a URL abre "Distribuição e SLA" com abas Distribuição e SLA, Tags e campos, Respostas rápidas, Metas (sem IA) |
| CRM-A03 | GC puro | Abrir `/configuracao/crm/ia` | Acesso negado |
| CRM-A04 | SEC | Abrir `/funil`; abrir Contatos | Funil: acesso negado. Contatos lista só alunos e responsáveis, sem oportunidades e sem "Nova oportunidade" |
| CRM-A05 | FIN | Abrir Tarefas; digitar `/funil` e `/contatos` | Tarefas abre; as outras duas: acesso negado |
| CRM-A06 [PO] | GC puro | Clicar em Empresas no menu | Hoje: "Acesso negado" (achado 18) |
| CRM-A07 | PROF | Digitar `/funil` e `/aria` | Acesso negado nas duas |

**Funil e oportunidade**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-F01 | VEND-A | Funil › Nova oportunidade › Pessoa, nome "QA F01", WhatsApp `+506 8888 0101`, país Costa Rica, etapa Novo › Criar | Cartão em Novo, código `L-` + 6 dígitos, dono joao; não existe campo Responsável |
| CRM-F02 | VEND-A | Nova oportunidade "QA F02" com etapa Qualificado | Cartão em Qualificado; aba Atividade com as duas mudanças de etapa |
| CRM-F03 | VEND-A | Nova oportunidade digitando o telefone do F01 | Aviso "Já existe no CRM: QA F01" e botão "Usar cadastro"; ao usar, "Usando o cadastro de QA F01" |
| CRM-F04 | GC puro | Nova oportunidade "QA F04" com Responsável "Sem responsável"; depois com joao | 1º: "Selecione um vendedor da sua equipe."; 2º: criada com dono joao. O select só lista a equipe |
| CRM-F05 | VEND-A | Arrastar QA F01 de Novo para Qualificado; depois para 1º contato | 1º: "Avance uma etapa por vez."; 2º: move, e a Atividade mostra a mudança |
| CRM-F06 | VEND-A | Arrastar um cartão para Exp. realizada ou No-show | "Esta etapa é registrada pelo check-in do professor." |
| CRM-F07 [BUG] | VEND-A → PROF | VEND: em QA F02 (Qualificado), aba Oportunidade › data e hora › "Agendar experimental". PROF carla: abrir Home | Cartão em Exp. agendada. Esperado pelo doc: a experimental na Home do professor com Compareceu/Faltou. Hoje: não há campo de professor e a experimental não aparece em nenhuma Home (achado 4) |
| CRM-F08 | VEND-A | Abrir QA F02 em Exp. agendada; tentar remarcar | Botão "Agendar experimental" não aparece; mover para Qualificado e agendar de novo funciona |
| CRM-F09 [PO] | VEND-A | Em QA F01 (1º contato), "Enviar proposta" | Vai para Proposta; Atividade "Proposta enviada". Confirmar com o PO se proposta antes da experimental é permitida |
| CRM-F10 | VEND-A | Em Proposta, "Preparar contratação" | Abre `/oportunidades/<id>/contratacao`; a oportunidade continua em Proposta (achado 9). Seguir o fluxo da auditoria 04 |
| CRM-F11 | VEND-A | "Marcar como perdida" › motivo Outro sem observação; depois com observação | 1º recusa; 2º vai para Perdido com o motivo no painel, sem botões de ação; arrastar de volta: "Oportunidade encerrada não volta ao funil." |
| CRM-F12 [BUG] | VEND-A | Lista › marcar 2 oportunidades em Novo › "Mover para…" Proposta › "Mover selecionadas" | Esperado: aviso de recusa. Hoje: "Etapa atualizada." e nada muda (achado 10) |
| CRM-F13 | VEND-A | Lista › 2 em Novo › Mover para 1º contato | As duas mudam; seleção limpa |
| CRM-F14 | VEND-A × VEND-B | VEND-B cria "QA F14"; VEND-A abre o Funil e depois `/funil?o=<id do F14>` | VEND-A não vê o cartão; pela URL: "Oportunidade fora da sua carteira." |
| CRM-F15 [BUG] | VEND-A | Painel › Detalhes › "Abrir contato" | Hoje: página não encontrada (achado 11). Contorno: Contatos e clicar no nome |
| CRM-F16 | GC puro | Painel de QA F04 › Responsável = vendedor2 › motivo › "Atribuir responsável" › confirmar | "Responsável atualizado."; Atividade registra; VEND-A deixa de ver, VEND-B passa a ver |
| CRM-F17 | VEND-A | Detalhes: editar resumo e datas, anexar documento; Atividade: registrar interação e nota interna | Cada ação mostra sucesso e aparece no histórico com autor e hora |
| CRM-F18 | VEND-A × mariana | VEND-A procura o botão Exportar; mariana (com a permissão) exporta | VEND-A: sem botão. Mariana baixa .xlsx sem telefone; filtros de origem e perdidos não são aplicados (achado 14) |
| CRM-F19 [PO] | VEND-A | Nova oportunidade › Empresa "QA F19 SA"; repetir com o mesmo nome; abrir Empresas | Duas oportunidades e duas empresas; Empresas não abre para o vendedor (achado 17) |

**Carteira**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-C01 | VEND-A | Abrir Carteira | Título "Minha carteira", só as dele, sem aba Coberturas; perdidas não aparecem |
| CRM-C02 | VEND-A | Numa oportunidade com N dias sem interação: registrar nota interna; depois registrar interação | Nota não muda os dias; interação zera ("0") |
| CRM-C03 | GC puro | Selecionar 2 linhas › reatribuir para vendedor2 com motivo "ok"; depois "troca de férias" | 1º: "Informe o motivo (mínimo 5 caracteres)."; 2º: reatribuídas; Atividade com o motivo |
| CRM-C04 | GC puro | Coberturas › titular joao, substituto vendedor2, de hoje a amanhã › conceder; entrar como VEND-B; revogar | VEND-B vê as oportunidades do joao no Funil e "joao (cobertura até dd/mm)" na Carteira; depois de revogar, deixam de aparecer |

**Contatos**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-K01 | VEND-A | Abrir Contatos e clicar em "QA F01" | Ficha abre na mesma tela (`?c=`); lista só contatos com oportunidade dele; sem Importar e sem Mesclar |
| CRM-K02 | VEND-A | Ficha › Nova oportunidade | Modal já com "Usando o cadastro de QA F01"; cria a 2ª oportunidade ligada ao mesmo contato |
| CRM-K03 | VEND-A | Ficha › Registrar opt-out › confirmar | "Opt-out registrado: não recebe mensagens." e "(opt-out)" ao lado do telefone |
| CRM-K04 | GC puro | Importar XLSX com Nome, WhatsApp, E-mail, Cidade, Origem, Tag (3 válidas, 1 sem nome, 1 repetida) › Prévia › Aplicar com dono joao | Prévia com novos/existentes e a linha inválida; aplicar cria contatos com oportunidade em Novo para joao; a tag nova aparece em Tags e campos |
| CRM-K05 | GC puro | Importar arquivo .csv renomeado ou planilha com mais de 1.000 linhas | "Não foi possível ler o arquivo. Use um .xlsx válido." ou "Planilha com muitas linhas (máx. 1000 por importação)." |
| CRM-K06 | GC puro | Mesclar dois contatos duplicados › Revisar mesclagem › confirmar; repetir com um aluno | Prévia mostra o que passa; mescla grava "Contatos mesclados". Com aluno, sem alçada de Secretaria: recusa com motivo |

**Tarefas**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-T01 [DEV] | VEND-A | Nova tarefa para hoje, hora daqui a 15 min, lembrete 10 min; aguardar | Tarefa em Hoje; depois do lembrete, item no sino de Tarefas (exige o cron rodando) |
| CRM-T02 | VEND-A | Nova tarefa com lembrete e sem horário | "O lembrete exige data e horário." |
| CRM-T03 | VEND-A | Concluir com resultado; Reabrir; Cancelar sem motivo; Cancelar com motivo | Concluída; volta a Aberta; "Informe o motivo do cancelamento."; Cancelada |
| CRM-T04 | GC puro | Equipe › Nova tarefa para joao; editar a mesma tarefa em duas abas | Tarefa aparece para joao; na 2ª aba: "Esta tarefa foi alterada por outra pessoa. Recarregue." |
| CRM-T05 | FIN × VEND-A | FIN cria tarefa sem responsável (fila); VEND-A procura; outro FIN assume | VEND-A não vê; a tarefa aparece na fila do Financeiro e "Assumir" passa para quem assumiu |
| CRM-T06 [PO] | VEND-A | Procurar como ligar a tarefa a uma oportunidade | Não há campo (achado 33) |

**Relatórios e metas**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-R01 | VEND-A | Abrir Relatórios | Abas Visão geral, Funil, Conversas, Atividades; sem filtros Responsável e Autor |
| CRM-R02 | GC puro | Abrir Relatórios › Equipe › filtrar por joao › abrir um número | 6 abas; tabela por pessoa; o detalhe lista as oportunidades da métrica |
| CRM-R03 | GC puro | Período personalizado com "até" antes de "de" | Aviso do erro e "Mostrando os últimos 30 dias." |
| CRM-R04 [BUG] | ADM | Salvar horário do Comercial em Distribuição e SLA; abrir Relatórios › Conversas | Hoje: "Fora do horário: sem horário de funcionamento configurado." (achado 32) |
| CRM-M01 | GC puro | Relatórios › Equipe › "Definir metas" › meta Matrículas do mês para joao = 5; depois meta geral | Abre Configuração › CRM › Metas; meta salva; meta geral: "Só o administrador define a meta geral." |

**Configuração › CRM**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-CF01 | GC puro | Distribuição e SLA | Só o bloco Comercial; regra Rodízio com joao e vendedor2; prazo e horário salvos |
| CRM-CF02 | ADM | Distribuição e SLA › Financeiro › "Copiar de outro setor" Comercial › salvar | 4 setores; horário copiado; nota sobre feriados do calendário escolar |
| CRM-CF03 | GC puro | Tags e campos › criar tag "Ação"; criar "acao"; arquivar a primeira | 2ª recusada por nome repetido; arquivada some das listas de escolha |
| CRM-CF04 | ADM | Configuração › CRM › IA | "Chave de API: ausente" e "Sem chave, a Aria usa o provedor simulado…"; salvar orçamento muda a barra de uso |

**Aria**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CRM-AR01 | ADM | Agente de IA › Estado = Sombra antes de publicar | "Publique uma versão antes de ligar a Aria." |
| CRM-AR02 | ADM | Comportamento › mudar o nome › Salvar › Publicar com nota | Versão 1 publicada; o aviso "A Aria ainda não foi publicada" some; Histórico de versões com a nota |
| CRM-AR03 | GC puro | Abrir Agente de IA; tentar mudar Permissões e baixar a faixa de confiança | Sem seletor de estado; matriz bloqueada ("Só o Administrador…"); baixar confiança recusado |
| CRM-AR04 | GC puro | Playground › cliente: "Quanto custa o curso?" › Testar; depois "quero falar com um atendente" | Selo "SIMULAÇÃO · nada é enviado nem alterado"; 1º: "Obrigada pela mensagem! Vou verificar e já te respondo."; 2º: handoff "Pediu para falar com uma pessoa". Nenhuma oportunidade ou mensagem nova |
| CRM-AR05 | GC puro | Pausar com motivo; Reativar | Aviso "Aria está pausada." com o motivo; depois "Aria reativada." |
| CRM-AR06 | ADM | Conhecimento › fonte de texto; fonte PDF | Texto: Pronta; PDF sem chave: Erro "Não foi possível extrair texto deste PDF…" |
| CRM-AR07 [PO] | ADM | Estado = Ativa | Muda na hora, sem confirmação (achado 63) |
| CRM-AR08 [DEV] | ADM + VEND | Aria em Sombra; enviar mensagem de um contato para número Comercial **sem dono**; abrir Histórico | Ações registradas como "Simulada"; nada enviado ao contato nem mudado no CRM. Em linha com dono, nenhum turno |
| CRM-AR09 [DEV] | ADM | Aria em Ativa sem chave; repetir o AR08 | Atendimento passa para pessoa com motivo "Falha do provedor"; nenhuma resposta da Aria ao contato |

Total: 1 pré-requisito e 50 cenários.

## Testes automatizados existentes

Contagem de arquivos (unitários `*.test.ts` × integração `*.int.test.ts`). O `npm test` do CI roda só os unitários;
a integração roda à noite em 4 shards (`.github/workflows/integracao.yml:9,31`) e o quadro não registra a primeira
execução bem-sucedida dela no Actions.

| Módulo | Unit | Int | O que cobre (exemplos) |
|---|---|---|---|
| `src/server/crm` | 15 | 24 | `etapas.test.ts`, `funil.int.test.ts`, `funil-carteira-equivalencia.int.test.ts` (40 casos de escopo e ordem), `carteira.int.test.ts`, `pessoas.int.test.ts`, `duplicados`, `importacao-contatos.test.ts`, `tarefas.int.test.ts`, `lembretes.int.test.ts`, `mensagens-agendadas.int.test.ts`, `permissoes.test.ts` |
| `src/server/crm-config` | 4 | 7 | `distribuicao.test.ts`/`.int`, `sla.int`, `horario-atendimento*.test.ts`, `tags-campos.int`, `respostas-rapidas.int`, `auditoria.test.ts` (toda action grava Evento) |
| `src/server/metas` | 0 | 1 | `metas.int.test.ts` |
| `src/server/aria` | 19 | 22 | provedor (`anthropic`, `simulado`, `custo`), `turno/*` (guardas, gatilhos, executor, orquestrador, handoff), `playground.int`, `versoes.int`, `estado.int`, `pausa.int`, `triagem.int`, `permissoes-tela.test.ts` |
| `src/server/relatorios` | 2 | 5 | `funil-pipeline.int`, `atividades-equipe.int`, `atendimento-aria.int`, `escopo.int`, `detalhe.int` |
| `src/server/comercial` | 5 | 5 | `leads.int`, `criar-lead-idempotencia.int`, `captura` |
| `src/server/empresas` | 4 | 3 | `b2b.int`, `fatura-desligada` |
| Telas (`src/app/(app)/funil`, `carteira`, `contatos`, `tarefas`, `oportunidades`, `relatorios`, `configuracao/crm`, `aria`, `empresas`) | 6, 1, 4, 6, 2, 2, 4, 5, 3 | 0 | renderização e interação (`NovaOportunidade.interacao`, `EdicaoOportunidade.interacao`, `PainelOportunidade.test`, `QuadroFunil.test`, `PainelTarefa.interacao`, `secoes.test`, `BarraPublicar.interacao`) |
| Rotas `api/relatorios`, `api/exportacoes`, `api/contatos` | 0, 1, 0 | 1, 2, 1 | exportação CSV, exportação xlsx, importação |

Lacunas que explicam os achados: nenhum teste cobre agendar experimental **com** professor pela tela nem o check-in
a partir do funil novo (achado 4); `FunilCliente` não tem teste do retorno do lote (achado 10); nenhum teste
confere o `href` de "Abrir contato" no painel (achado 11); a trava `casca-crm-removida.test.ts:27` **exige** que o
GC não tenha o item Configuração (achado 48).
