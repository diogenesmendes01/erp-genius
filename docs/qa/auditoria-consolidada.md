# Auditoria consolidada: código × documentação (base para o UAT v1)

> Data: 2026-10-21 · Commit auditado: `9e3d1d3c` (branch `qa/auditoria-e-onboarding`, igual à `main`
> de 21/10 mais o kit de QA) · Método: 9 varreduras independentes, uma por área, cada uma lendo as
> SPECs com critérios de aceite, a política de acesso (doc 37), o quadro de entregas e o código,
> sempre com arquivo e linha. Nada no código foi alterado. Os relatórios completos estão em
> [`auditoria/`](auditoria/).
>
> Esta versão substitui a auditoria de 21/10 feita sobre o commit `bc858aff` (agosto), que ficou
> obsoleta: a `main` avançou 2.323 commits nesse intervalo.

## 1. Resumo executivo

| Área | Relatório | Itens | Conforme | Divergente | Parcial | Não impl. | Sem doc | Cenários |
|---|---|---|---|---|---|---|---|---|
| Acesso, papéis e navegação (189 páginas conferidas; doc 37 §8: 25/30 critérios atendidos) | [01](auditoria/01-acesso-papeis.md) | 34 | 13 | 10 | 4 | 1 | 6 | 38 |
| CRM novo, relatórios e Aria | [02](auditoria/02-crm-aria.md) | 63 | 26 | 13 | 15 | 4 | 5 | 50 |
| Inbox, WhatsApp e comunicações (LC-01..15: 30/38 critérios) | [03](auditoria/03-inbox-whatsapp-comunicacoes.md) | 27 | 6 | 8 | 6 | 2 | 5 | 50 |
| Entrada, matrícula, contrato e Secretaria (MAT 18/29, DOC 9/19 atendidos; resto parcial) | [04](auditoria/04-matricula-contrato-secretaria.md) | 24 | – | – | – | – | – | 60 |
| Acadêmico e avaliações (159 critérios: 136 atendidos, 18 parciais) | [05](auditoria/05-academico-avaliacoes.md) | 24 | – | – | – | – | – | 57 |
| Diário, agenda, reposições e turmas | [06](auditoria/06-diario-agenda-turmas.md) | 54 | 28 | 6 | 5 | 5 | 2 | 50 |
| Financeiro | [07](auditoria/07-financeiro.md) | 43 | 19 | 6 | 8 | 5 | – | 58 |
| Alunos, portal, empresas e migração | [08](auditoria/08-alunos-portal-empresas-migracao.md) | 55 | 28 | 11 | 9 | 4 | 3 | 50 |
| Configuração, Home, interface e ambiente UAT | [09](auditoria/09-configuracao-ambiente-uat.md) | 45 | 16 | 10 | 15 | 2 | – | 50 |

Leitura geral:

- **O núcleo está implementado e bem coberto por testes.** Guards de página em todas as 189 rotas,
  escopo por linha, critérios das SPECs de matrícula, contrato e avaliação em grande parte
  atendidos, 819 arquivos de teste unitário e 328 de integração.
- **O UAT não fecha nenhum fluxo ponta a ponta sem apoio do dev.** Cinco integrações estão sem modo
  simulado ou desligadas no código (assinatura, pagamento, e-mail do portal, Google Drive, mensagem
  recebida no WhatsApp), e o seed não monta a configuração mínima. A seção 2 lista o que precisa
  ser resolvido antes de o QA entrar.
- **Há bugs claros, já reproduzíveis pela leitura do código**, que o QA pode confirmar no primeiro
  ciclo (seção 3), e um conjunto de decisões de produto sem as quais o QA não sabe o que esperar
  (seção 4).
- **O kit de QA anterior e vários docs descrevem o sistema antigo** (CRM de leads e pipeline,
  movimentações na ficha do aluno, Gerente Comercial na configuração do WhatsApp). A seção 7 lista o
  que está desatualizado.

## 2. Bloqueadores do UAT (resolver antes de o QA entrar)

| # | Problema | Evidência | Efeito no UAT | Quem resolve |
|---|---|---|---|---|
| B1 | **Nenhuma tela muda o status da turma.** `alterarStatusTurma` existe mas nada a chama. A matrícula manual só lista turmas `ABERTA`; a passagem para `EM_ANDAMENTO` depende do cron; `CONCLUIDA` não se alcança. | `src/server/turmas/acoes.ts:260-298`, `src/server/matricula/consultas.ts:49` | Fluxo legado de matrícula bloqueado; conclusão de turma intestável. | DEV abre turmas no banco, ou expõe a ação na UI. |
| B2 | **Não existe driver de assinatura de contrato, nem simulado.** A ativação exige aceite de uma conclusão de assinatura; o aceite por anexo está vetado. | `src/server/contratos/aceite-estado.ts:20` e relatório 04 §fluxo | Nenhuma matrícula do fluxo novo (oportunidade → contratação) chega a ATIVA. Aditivos e substituição ficam inacessíveis. | DEV entrega driver simulado ou fixture. |
| B3 | **Pagamento simulado desligado no código.** `pagamentoSimuladoHabilitado()` retorna `false` fixo e ignora `PAGAMENTO_SIMULADO`; o webhook responde 404; nenhuma tela gera o link `/pagar`. | `src/server/financeiro/gateway.ts:42-45`, `src/server/financeiro/baixa.ts:26` | Pagamento em UAT só por informe da Secretaria + confirmação de outro usuário Financeiro, ou recebimento direto pelo Financeiro. Em `/pagar` só dá para testar link inválido e expirado. | PO decide se liga; DEV corrige a flag. |
| B4 | **Portal do aluno sem modo simulado.** O token de ativação só nasce quando o e-mail é enviado de verdade (Resend + flag). O banco guarda só o hash. | relatório 08 §portal, relatório 01 §portal | Convite fica "Preparado" para sempre; ativação, login e recuperação do portal intestáveis. | PO escolhe: chave de teste do Resend para uma caixa do time, ou ferramenta dev que gera o token. |
| B5 | **Gravação de aula exige Google Drive.** Sem Drive, publicar gravação dá "Erro inesperado". Único caminho: exceção de gravação aprovada por outra pessoa da gestão. | `src/server/gravacoes/gravacao-aula.ts:38-39`, `resultado.ts:35-36` | Sem aula "Ministrada" não há reposição, correção nem conclusão de turma pelo caminho normal. | DEV configura Drive de teste ou o roteiro usa só a exceção. |
| B6 | **Experimental não chega ao check-in do professor.** O funil novo agenda sem professor e zera o responsável; não há tela para atribuir professor; o check-in exige um. Regressão em relação à ficha antiga. | `PainelOportunidade.tsx:203`, `src/server/comercial/acoes.ts:494,678-683` | Etapas "Exp. realizada" e "No-show" inalcançáveis pela interface. | DEV corrige. |
| B7 | **Seeds não montam o ambiente.** Falta: vínculo vendedor → gerente comercial; alçadas de desconto nos campos novos (o seed preenche o campo antigo, que nenhuma regra lê: todo vendedor fica com 0% de autonomia); configuração operacional (fuso, prazos do portal e de reposição); calendário; regras de avaliação; grades; janelas de admissão; turmas; modelos contratuais; políticas de comissão; 2º Administrador; 2º Gerente Pedagógico; 2º Financeiro com permissão de aprovar acertos. | relatório 09 §Dados mínimos (checklist de 19 passos), relatório 01 §Usuários | Sem isso, Home do GC vazia, todo desconto vai para aprovação, preparação para em "Regras de entrada incompletas", reserva falha, notas não lançam. | DEV + ADM seguem o checklist do relatório 09. |
| B8 | **Não há como simular mensagem recebida no WhatsApp**, e o que o QA envia pela Inbox em modo simulado some (fica só no banco). Nota interna e contexto de transferência são gravados e não aparecem. | relatório 03 §UAT e achados 2 e 4 | Inbox só testável com receita do DEV (POST assinado no webhook do motor) e com o DEV lendo o banco. | DEV segue a receita do relatório 03. |

## 3. Bugs prováveis (o QA confirma e abre issue no primeiro ciclo)

| # | Bug | Evidência | Relatório |
|---|---|---|---|
| X1 | Usuário criado com letra maiúscula no e-mail nunca consegue entrar: o login normaliza para minúsculas, o cadastro grava como digitado. | `src/lib/auth.ts:18,26`, `src/server/acesso/acoes.ts:44,53` | 01 |
| X2 | Menu "Empresas" aparece para Gerente Comercial e Secretaria, mas a página só abre para Financeiro e Admin. | `src/lib/nav.ts:63-69`, `src/app/(app)/empresas/page.tsx:13` | 01, 02 |
| X3 | `/financeiro/permuta` e `/configuracao/contratos` negam acesso com a tela de erro genérica "Não foi possível carregar esta tela" em vez de "Acesso negado". | `permuta/page.tsx:12`; `configuracao/contratos` sem guard | 01 |
| X4 | Gerente Comercial ao abrir `/financeiro` cai na aba Comissões, que chama uma consulta que exige papel Financeiro: erro provável. O teste da página mocka essa consulta. | `src/server/financeiro/consultas.ts:318-319` | 07 |
| X5 | Contador de "não lidas" da Inbox nunca zera: abrir a conversa não marca como lida. | relatório 03 achado 1 | 03 |
| X6 | Importação XLSX de alunos: a coluna "Número" (endereço) também casa com "Número do documento" e o sobrescreve; reimportar o mesmo arquivo sem e-mail duplica alunos. | `src/server/alunos/importacao.ts:109-117`, `src/app/api/alunos/importar/route.ts:144-148` | 08 |
| X7 | Funil: mover em lote mostra "Etapa atualizada." mesmo quando todas foram recusadas; "Abrir contato" leva a rota inexistente (404); aba Conversas dos Relatórios diz "sem horário configurado" com horário salvo. | `FunilCliente.tsx:74-81`, `PainelOportunidade.tsx:250`, `relatorios/atendimento.ts:101` | 02 |
| X8 | Reserva de vaga em turma nunca expira: nenhum código grava `EXPIRADA`; vencida, segue ocupando a vaga até uma desistência. A particular expira pelo cron. | relatório 04 achado 3 | 04 |
| X9 | Trocar a moeda de um país não atualiza as ofertas; a contratação passa a recusar com "Confira a oferta e a moeda do país". | `editarPais` (relatório 09 achado 5) | 09 |
| X10 | Desativar um idioma não tem efeito: continua em produto, nível e matrícula. | relatório 09 | 09 |
| X11 | Campo de senha do cadastro de usuário sem `autocomplete`: o navegador preenche a senha do próprio admin. Achado "Alta" do doc 42 ainda aberto. | relatório 01 e 09 | 01, 09 |
| X12 | Trocar a senha de um usuário não encerra as sessões abertas dele. | relatório 01 | 01 |
| X13 | Pausa por matrícula não libera a vaga nem tira o aluno da visão do professor. | relatório 08 achado 3 | 08 |
| X14 | Reposição: "Reposta em [data]" não aparece no diário. | relatório 06 | 06 |
| X15 | Algumas ações da Inbox (encaminhar, reagir, editar, apagar, bloquear, grupos, confirmação de leitura) chamam o motor direto, sem passar pela trava `WHATSAPP_LIVE`. Hoje inertes porque nenhum número está conectado. **O QA nunca deve escanear o QR em UAT.** | relatório 03 achado 3 | 03 |

## 4. Decisões de produto pendentes (o QA registra o observado, não abre bug)

| # | Decisão | Hoje o código faz | Fonte que diz diferente | Relatório |
|---|---|---|---|---|
| R1 | Destino do fluxo legado `/matriculas/nova`: continua no ciclo ou sai? | Sempre cria aluno novo (duplica cadastro), emite taxa e mensalidade na criação, não confere janela nem reserva. A Secretaria abre a tela mas não consegue salvar. | SPEC-002 (matrícula como unidade operacional) | 04, 09 |
| R2 | Ligar o pagamento simulado em UAT? | Desligado no código (B3). | docs/37 §pagamentos a conferir | 07 |
| R3 | Como o QA recebe links do portal sem e-mail real? | Só e-mail real via Resend. | – | 08 |
| R4 | Oficializar a nota equivale a divulgá-la ao aluno? | Publica no portal no instante da oficialização. | ACA-22 ("não presumir divulgação") | 05 |
| R5 | O que acontece quando o prazo da recuperação vence sem realização? | Fechamento fica bloqueado, sem saída pela interface. | Q137 / ACA-17 | 05 |
| R6 | Secretaria pode cancelar segunda chamada? | – | specs de segunda chamada | 05 |
| R7 | Alcance das autorizações especiais quando a matrícula passa de pausada a encerrada (Q163). | – | SPEC-004 | 05 |
| R8 | Turmas encerradas continuam visíveis no portal do aluno? | Continuam após transferência. | – | 05 |
| R9 | Aria: ligar em modo "Ativa" sem confirmação; atua só no setor Comercial e em número sem dono (regra não documentada); sem chave, transfere com "Falha do provedor". | Como descrito. | docs/27 (IA copiloto só-leitura) | 02 |
| R10 | Certificado profissional com valor livre em qualquer país. | Valor livre. | docs/04: fixo, em colones, só Costa Rica | 09 |
| R11 | Importação XLSX presume consentimento de comunicações quando a célula está vazia; a migração M01 assume "não". | Como descrito. | LGPD / SPEC-001 §10 | 08 |
| R12 | Vendedor pode aumentar valor e adiar vencimento de cobrança sem aprovação (só desconto acima do limite vai para alçada). | Como descrito. | docs/37 §4 alçadas | 07 |
| R13 | Gerente Comercial sem item "Configuração" no menu, mas abre `/configuracao/crm` por URL e pelo link "Definir metas". | Como descrito (um teste trava isso). | docs/09 | 01, 02 |
| R14 | Secretaria não gerencia turmas. | Só Admin e Gerente Pedagógico. | docs/37 diz GP/SEC | 01 |

## 5. Não implementado ou desligado (não testar, não abrir bug)

- Motor de risco de cobrança (doc 25). Estorno automático de comissão em cancelamento. Estorno de
  recebimento confirmado.
- B2B: fatura única e lote de colaboradores desligados por decisão do dono (D9). Empresas é só um
  cadastro; "Colaboradores" fica sempre vazio.
- LGPD: só um script que limpa texto de busca nos eventos de exportação. Sem exportação ou
  anonimização por aluno, sem consentimento por canal.
- Cancelamento de aula de turma pedido pelo professor (Q08). Remarcação de turma (só pelo
  replanejamento global do calendário). Substituição de professor sem tela.
- Reposição particular: benefício e autorização excepcional só no servidor, sem tela. Reposição por
  gravação depende de Drive e de conta do portal. Em UAT o ciclo vai só até "Autorizada".
- Segunda chamada: prorrogação (Q149) e oportunidade extra (Q150) sem tela; a tela de propor e
  decidir só abre por URL.
- Recuperação: falta e cancelamento pelo aluno (Q137); antecedência configurada e nunca usada.
- Lead automático e réguas comerciais (C1/C2) foram removidos com o CRM antigo. LC-10 e LC-11 da
  SPEC-005 não implementados.
- Continuidade mensal: precisa de flag de ambiente mais uma chamada externa que nada agenda.
- Régua de cobrança automática começa desligada.
- Modo simulado de e-mail: não existe. Com as chaves desligadas, convites e avisos ficam
  "Preparado" nas telas da Secretaria.

## 6. Comportamentos que o QA precisa saber (não são bugs)

- **Fuso da escola** em Configuração › Operação é obrigatório para lançar notas, preparar
  calendário e usar o portal. O seed deixa os países em `America/Sao_Paulo`.
- **Regra de avaliação** precisa estar publicada e aprovada **antes** de criar a turma: o vínculo só
  acontece para turma com início futuro.
- **Chamada só abre depois do fim real do encontro**, e a aula dura o tempo da modalidade (2 h no
  Regular). O DEV precisa criar uma modalidade curta de UAT e manter o cron no ar (tick a cada 5 min).
- **Quase toda decisão exige outra pessoa** (aprovação independente). Usar o Admin como segundo
  decisor esconde erros de papel: por isso o pedido de 2º Admin, 2º GP e 2º Financeiro.
- **"Em atraso" é calculado na leitura**, nunca gravado. `/pagar` pode mostrar cobrança vencida como
  "Pagamento em aberto".
- **Inbox:** Professor e Gerente Pedagógico abrem a Inbox hoje. O que o QA envia em modo simulado
  não aparece na conversa.
- **Aria sem chave** usa provedor simulado com respostas fixas. O selo "SIMULAÇÃO" só aparece no
  Playground. PDF na base de conhecimento falha sem chave: esperado.
- **Login:** 5 falhas em 15 min bloqueiam o e-mail (em memória). Não existe troca de senha pelo
  próprio usuário.
- **Movimentações do aluno** (pausar, encerrar, reativar, trocar turma) saíram da ficha e viraram
  propostas com aprovação em `/alunos/[id]/movimentacoes` e `/academico`. O Gerente Pedagógico não
  abre a página de movimentações.
- **Desistência antes da ativação** funciona nos ramos simples, administrativo, financeiro e acerto
  contratual. Falta o encerramento da assinatura externa (ação existe, sem tela).
- `/api/health` mostra o SHA do commit: use para confirmar qual versão está no UAT.

## 7. Docs e materiais desatualizados

| Material | O que está errado |
|---|---|
| `docs/guia-dev-fluxo-crm.md` | Descreve o CRM antigo (Leads, Pipeline, ficha do lead), removido. |
| `docs/40-mudancas-academicas-com-aprovacao.md` | Diz que transferência equivalente é direta (hoje passa por proposta, decisão e execução) e "um pedido aberto por aluno" (o limite real é por matrícula). |
| `docs/specs/fechamento-e-aproveitamento-academico.md` e planos 358, 413, Q54, 565 | Dão como pendentes coisas já implementadas. |
| `docs/37` | Diz que Secretaria gerencia turmas (não gerencia). AC14, AC18, AC19, AC24 parciais; AC30 sem evidência. |
| `docs/04` | Certificado fixo em colones só na Costa Rica: o código aceita valor livre em qualquer país. |
| `docs/09`, `10`, `11`, `12`, `16`, `26`, `27` | Especificação original: telas, regras, modelo de dados e eventos de agosto. Usar só como contexto histórico. |
| Quadro de entregas (13/10) | Diz que `/api/health` não mostra o SHA; já mostra. |
| Kit de QA anterior (roteiro de 177 cenários, matriz de usuários, testes Playwright de menu) | Escrito sobre o commit de agosto. Substituído por esta versão. |

## 8. Como isso vira o roteiro de QA

Cada relatório em `auditoria/` termina com 38 a 60 cenários (463 no total), já escritos para UAT
pela interface, com papel, passos e resultado esperado, e marcados `[PO]` quando dependem de uma
decisão da seção 4 e `[DEV]` quando exigem passo do desenvolvedor (banco, variável, cron, webhook).
O roteiro em [`03-roteiro-testes-manuais.md`](03-roteiro-testes-manuais.md) organiza esses cenários
na ordem real de uso e aponta para os IDs B, X e R desta página. O checklist de preparação do
ambiente está no relatório 09, seção "Dados mínimos do UAT".
