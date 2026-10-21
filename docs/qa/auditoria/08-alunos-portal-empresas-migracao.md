# Auditoria 08: Alunos, portal do aluno, empresas e migração

> Data: 2026-10-21 · Branch auditada: `qa/auditoria-e-onboarding` (commit `9e3d1d3c` = `main` + kit de QA).
> Método: leitura do código (somente leitura) e cruzamento com as fontes, nesta ordem de precedência:
> SPEC (`docs/specs/erp-educacional.md` §1, §5, §10 e M01) → política de acesso (`docs/37`) → registros de
> entrega (`docs/41`, `docs/planejamento/quadro-entregas.md`) → especificação original (`docs/03`, `docs/04`,
> `docs/09` §Área Alunos). Regra aplicada: especificação não comprova implementação, e registro de entrega
> não substitui o código. Nenhum arquivo de código foi alterado; nada foi executado contra banco.
>
> Legenda de status: **Conforme** · **Divergente** (o código faz outra coisa) · **Parcial** · **Não
> implementado** · **Sem doc** (comportamento sem fonte normativa; precisa de decisão do PO).
> Marcadores nos cenários: **[PO]** depende de decisão do PO · **[DEV]** depende de passo do dev ·
> **[BLOQ]** não executável no UAT sem providência.

## Resumo

| Status | Quantidade |
|---|---|
| Conforme | 28 |
| Divergente | 11 |
| Parcial | 9 |
| Não implementado | 4 |
| Sem doc | 3 |
| **Total de achados** | **55** |

### Os 5 achados mais importantes

1. **O portal do aluno não tem modo simulado: em UAT sem envio de e-mail não existe link de convite, e
   ativação, primeiro login e recuperação não podem ser testados pela interface** (achado #16). O token só
   nasce no despacho do e-mail (`src/server/portal-aluno/identidade.ts:483-498`), e o despacho só roda com
   `EMAIL_PORTAL_ENVIO_ENABLED="true"`, Resend configurado e URL pública HTTPS
   (`src/server/portal-aluno/envio-resend.ts:22-27`, `src/server/portal-aluno/processar-envios.ts:36-38`,
   `src/app/api/portal-aluno/envios/cron/route.ts:9-14`). Desligado, o convite fica para sempre em
   "Preparado". O banco guarda só o digest do token, então o dev também não consegue recuperar o link.
   Precisa de decisão e de um passo do dev antes do UAT.
2. **A importação XLSX de alunos perde o número do documento quando se usa o próprio modelo** (achado #36).
   O cabeçalho "Número" (endereço) casa por prefixo com "Número do documento"
   (`src/server/alunos/importacao.ts:109-117`, colunas em `:25` e `:36`). As duas colunas viram a chave
   `documento`, e a do endereço, que vem depois, sobrescreve a do documento
   (`src/app/api/alunos/importar/route.ts:144-148`). Com "Número" vazio, o documento some. Preenchido, o
   número da casa vira documento. Isso também enfraquece a deduplicação por documento. Bug reproduzível.
3. **Pausar, encerrar, reativar e trocar turma saíram da ficha** para quase todo aluno real (achados #4 a
   #8). Os botões globais só aparecem para aluno sem alocação nem vínculo contratual
   (`src/server/matricula/limite-legado.ts:5-20`). `trocarTurma` e `reativarAluno` sempre recusam
   (`src/server/alunos/acoes.ts:223-228`, `:267-273`). O fluxo atual é por matrícula, com proposta e
   aprovação de outra pessoa, em `/alunos/[id]/movimentacoes` e `/alunos/[id]/academico`. Os cenários
   ALU-05 a ALU-12 de `docs/qa/03-roteiro-testes-manuais.md` estão desatualizados. Além disso, a pausa
   por matrícula **não libera a vaga nem tira o aluno da visão do professor**
   (`src/server/matricula/pausa-execucao.ts:45`, `src/server/alunos/consultas.ts:344`). A R10 continua no
   fluxo novo, e o Gerente Pedagógico ficou sem acesso às movimentações (`src/server/matricula/pausa-estado.ts:8`).
4. **"Empresa como pagadora de contratos individuais" não fecha** (achados #51 e #52). Fatura B2B e lote
   estão desligados por decisão (D9) (`src/lib/funcionalidades.ts:11`, `src/server/empresas/acoes.ts:44-46`,
   `:144-152`). Mas nenhum código grava `Matricula.empresaId`: a matrícula com pagador "Empresa" cria só um
   responsável em texto livre (`src/server/matricula/acoes.ts:228`). Por isso a lista "Colaboradores" da
   ficha da empresa fica sempre vazia. O B2B real hoje é só o cadastro da empresa.
5. **LGPD e consentimento estão mínimos, e a importação presume consentimento** (achados #33, #34 e #37).
   O único item de LGPD é um script que tira o texto de busca dos eventos de exportação
   (`src/server/lgpd/anonimizar-busca-exportacoes.ts`). Não há exportação de dados do titular,
   anonimização de aluno nem consentimento por canal ou finalidade. A importação XLSX grava "Recebe
   comunicações = Sim" quando a célula está vazia (`src/app/api/alunos/importar/route.ts:214`), contra
   o checklist de migração ("ausência de informação não comprova autorização") e contra a própria migração
   M01, que grava `false` (`src/server/migracao/aplicacao-cadastro.ts:77`).

Outros pontos que o QA precisa saber antes de começar:

- **Decisões "por outra pessoa da Administração" exigem dois administradores.** Isso vale para a troca de
  e-mail do portal e para a reemissão de envio incerto. O seed tem só `admin@genius.com`
  (`prisma/seed-qa.ts` não cria outro).
- **Os prazos do portal precisam estar configurados antes de qualquer teste.** Sem eles, login e ativação
  falham com mensagem genérica (`src/server/portal-aluno/identidade.ts:47-63`, tela
  Configuração › Operação).
- **O certificado público só valida o que já existe.** Nenhuma tela emite certificado: `aprovarNivelAluno`
  não é chamado por componente nenhum, e a ficha da turma tem `podeAprovar = false`
  (`src/app/(app)/alunos/turma/[id]/page.tsx:36`). A SPEC §1 tira certificados do escopo.

## Ficha do aluno como está no código

A ficha **não tem abas**. É uma página única (`/alunos/[id]`) com seções, e as operações ficam em
sub-telas abertas por links. Guard da página: Secretaria, Gerente Pedagógico, Financeiro e Professor
(Administrador sempre passa) (`src/app/(app)/alunos/[id]/page.tsx:37-42`; `src/server/_shared/sessao.ts:119-122`).
Vendedor e Gerente Comercial são mandados para `/acesso-negado`. Professor só abre aluno de turma em que é
docente vigente; fora disso, 404 (`src/server/alunos/consultas.ts:65-87`, `:297`).

| Seção / sub-tela | Papéis que veem | Ações e quem faz | arquivo:linha |
|---|---|---|---|
| Cabeçalho: nome, nome preferido, selo "Cadastro: Ativo/Pausado/Encerrado", código, país | Todos os papéis da guarda. O telefone só aparece para SEC e ADM | — | `src/app/(app)/alunos/[id]/FichaAluno.tsx:219-230` |
| Links do topo | "Pausa, retomada e encerramento por matrícula": ADM, SEC, FIN · "Acesso ao portal de reposições": ADM, SEC · "Conferir agenda para aditivo": ADM, SEC, GP | Navegação | `src/app/(app)/alunos/[id]/page.tsx:125-130` |
| Botões globais | "Editar dados": SEC, ADM · "Pausar" e "Encerrar" (aluno Ativo) e "Propor retomada"/"Encerrar" (aluno Pausado): SEC, GP, ADM, **só se o aluno não tiver alocação, mais de uma matrícula, preparação comercial, horas ou proposta por matrícula** | Editar exige motivo; Pausar exige motivo; Encerrar exige motivo da lista fechada, e observação se o motivo for "Outro". Nos demais casos aparece o aviso "Pausa, retomada e encerramento devem identificar as matrículas envolvidas…" | `FichaAluno.tsx:234-254`; `src/server/alunos/consultas.ts:45-58`; `src/server/matricula/limite-legado.ts:5-20`; `src/server/alunos/schema.ts:17-28,81` |
| Link acadêmico | ADM, SEC, GP: "Turma, nível e solicitações acadêmicas" · PROF: "Consultar solicitações e emitir parecer" | Abre `/alunos/[id]/academico` | `FichaAluno.tsx:256`; `page.tsx:141` |
| Turmas atuais | Todos (PROF só as suas turmas) | Sem turma: ADM e SEC veem a "Turma sugerida na ativação" com o link "Preparar alocação por matrícula" | `FichaAluno.tsx:516-543`; `page.tsx:52-53` |
| Dados pessoais | SEC, ADM | Edição pelo drawer "Editar dados", com motivo; inclui o opt-in "Recebe comunicações" | `FichaAluno.tsx:545-581`, `:374`; `src/server/alunos/acoes.ts:52-54` |
| Financeiro (resumo) | ADM, SEC, FIN | "Em dia/Em atraso", valor em aberto, próximo vencimento, link "Ver ficha financeira" | `FichaAluno.tsx:584-604`; `consultas.ts:40-42` |
| Histórico de movimentações | Todos. Motivo e observação só para SEC e ADM; PROF vê só as movimentações da própria turma | Leitura: tipo, matrícula, autor e data. **Sem "de → para"** | `FichaAluno.tsx:606-630`; `consultas.ts:315-322` |
| Acadêmico (testes de nível, certificados) | ADM, GP | Links "Gerenciar solicitações acadêmicas" e "Gerenciar acesso ao portal". Este último leva o GP a "acesso negado" | `page.tsx:55-62`, `:144-161`; `src/app/(app)/alunos/[id]/AcademicoAluno.tsx` |
| `/alunos/[id]/financeiro` | FIN, SEC, GC, VEN (+ADM). GC e VEN veem o resumo comercial, com escopo | Registrar pagamento: FIN, SEC · Renegociar: FIN, VEN · Retomada, acesso às aulas, informes, concluir matrícula | `src/app/(app)/alunos/[id]/financeiro/page.tsx:21-35`, `:71-91` |
| `/alunos/[id]/movimentacoes` | SEC, FIN, ADM (**GP é recusado**) | Nova pausa e nova retomada por matrícula: SEC, FIN, ADM · Aprovar ou rejeitar: FIN, ADM, **outra pessoa** · Aplicar proposta aprovada: SEC, FIN, ADM · Novo pedido de encerramento: SEC, ADM · Acerto do encerramento: FIN, ADM · Compras de horas e compensações: FIN, ADM · Vínculos legados: SEC, ADM | `src/app/(app)/alunos/[id]/movimentacoes/page.tsx:34-75`; `src/server/matricula/pausa-estado.ts:8`; `src/server/matricula/pausa-integridade.ts:5`; `src/server/matricula/pausa-proposta.ts:49` |
| `/alunos/[id]/academico` | SEC, GP, PROF (+ADM) | Escolher o contrato; mudanças acadêmicas; avaliações por matrícula (PROF, GP, ADM); reposições (perfis amplos); executar equivalência (SEC) | `src/app/(app)/alunos/[id]/academico/page.tsx:18-46` |
| `/alunos/[id]/portal` | SEC, ADM | Preparar convite; preparar troca assistida de e-mail; aprovar ou rejeitar a troca (só ADM, e diferente de quem preparou) | `src/app/(app)/alunos/[id]/portal/page.tsx:10-23`; `src/app/(app)/alunos/[id]/portal/painel.tsx:35-79` |
| `/alunos/[id]/agenda-aditivo` | SEC, GP, ADM | Só consulta: lista as matrículas particulares ativas com link para a agenda do aditivo | `src/app/(app)/alunos/[id]/agenda-aditivo/page.tsx:13-20` |
| `/alunos/[id]/creditos/[creditoId]` | FIN, ADM | Proposta de uso e de devolução de crédito; outra pessoa decide | `src/app/(app)/alunos/[id]/creditos/[creditoId]/page.tsx:17`; `src/server/financeiro/uso-credito-proposta.ts:22,48,91` |
| `/alunos/turma/[id]` | SEC, GP, FIN, PROF (+ADM) | Leitura; diário e progressão só para GP e PROF; aprovar nível **desligado** (`podeAprovar = false`) | `src/app/(app)/alunos/turma/[id]/page.tsx:17-36` |

**Onde estão as movimentações hoje.** Ainda existem na área Alunos, mas não na ficha principal:

- Pausa, retomada e encerramento ficam em `/alunos/[id]/movimentacoes` (por matrícula).
- Troca de turma e nível ficam em `/alunos/[id]/academico` (mudança acadêmica, equivalência e aproveitamento).
- A retomada também é iniciada pela ficha financeira (`/alunos/[id]/financeiro#retomada`).
- As ações globais antigas (`pausarAluno`, `encerrarAluno`) só valem para aluno sem vínculo contratual.
  `reativarAluno` e `trocarTurma` só devolvem a mensagem de orientação (`src/server/alunos/acoes.ts:223-228`, `:267-273`).

## Portal do aluno: fluxo real (convite → ativação → uso → saída)

O portal novo (`/portal-aluno/**`) tem **identidade própria** (`ContaPortalAluno`, `prisma/schema.prisma:6378-6402`).
Não usa o login da equipe. O endereço antigo `/portal` só explica isso e leva a `/portal-aluno/entrar`
(`src/app/(portal)/portal/page.tsx:9-28`). Um usuário da equipe só com o papel ALUNO é mandado para
`/portal` por qualquer rota interna (`src/server/_shared/sessao.ts:182-185`).

1. **Pré-condição (Admin).** Configurar os quatro prazos em Configuração › Operação › "Acesso do aluno"
   (sessão, convite, recuperação e validação de e-mail, em minutos). Não existe valor padrão
   (`src/server/portal-aluno/configuracao.ts:14-36`; `src/server/portal-aluno/politica.ts:25-38`).
2. **Convite (SEC ou ADM).** Ficha › "Acesso ao portal de reposições" › "Preparar convite"
   (`painel.tsx:35-40`). O servidor (`identidade.ts:131-182`):
   - sem e-mail no cadastro, devolve "Acesso pendente: cadastre e confirme um e-mail individual." (`:160-167`);
   - conta que já tem senha é recusada com "O aluno já possui credencial; use recuperação…" (`:152`);
   - conta bloqueada é recusada (`:151`);
   - em qualquer outro caso, cria a conta (se faltar) e uma solicitação de envio "Preparado". Repetir o
     clique devolve a mesma solicitação.
   - A equipe nunca vê token, senha nem link (`painel.tsx:68`).
3. **Envio (worker).** O cron chama `POST /api/portal-aluno/envios/cron` a cada 60 s (`docker-compose.prod.yml:152-158`).
   Com `EMAIL_PORTAL_ENVIO_ENABLED` diferente de `"true"`, responde `{executou:false}` e não toca no banco
   (`src/app/api/portal-aluno/envios/cron/route.ts:13-15`). Ligado, faz o "claim" (Preparado → Incerto),
   gera o token, chama a Resend e marca "Enviado" se o provedor aceitar (`identidade.ts:442-536`).
   **Não há transporte simulado.** A fila da equipe fica em `/secretaria/envios-portal` (SEC, ADM), com as
   abas Incertos (padrão), Falhas e Todos (`src/server/portal-aluno/filtro-fila-envios.ts:13-35`).
4. **Ativação.** O link tem a forma `/portal-aluno/ativar#token=…`: o token vai no fragmento e sai da barra
   de endereço logo ao abrir (`politica.ts:58-61`; `src/app/portal-aluno/ativar/page.tsx:56-58`).
   - Senha de 12 caracteres a 72 bytes, com confirmação (`identidade.ts:27-29`; `ativar/page.tsx:92-96`).
   - O convite exige que o e-mail atual do aluno seja igual ao destinatário (`identidade.ts:270-276`).
   - Ao ativar: grava o e-mail verificado, revoga os outros tokens e as sessões e abre a sessão
     (`identidade.ts:282-305`).
   - Link usado, vencido ou revogado mostra "Este link não está mais disponível…" (`src/app/portal-aluno/requisicoes.ts:10,25`).
5. **Login.** `/portal-aluno/entrar`, com e-mail verificado e senha (`identidade.ts:206-231`).
   - 5 falhas em 15 minutos bloqueiam o e-mail por 15 minutos. O bloqueio fica no banco e sobrevive a
     reinício (`src/server/portal-aluno/rate-limit.ts:4-5,51`).
   - Bloqueado ou senha errada dão a mesma mensagem, "E-mail ou senha incorretos." (`src/app/portal-aluno/entrar/page.tsx:79`).
   - Prazos ausentes dão "Não foi possível entrar com esses dados…" (HTTP 422).
6. **Sessão.**
   - Cookie `portal_aluno_session`: httpOnly, sameSite=lax, `secure` só com `NODE_ENV=production`
     (`politica.ts:69-82`).
   - Cada página revalida conta ativa, versão e expiração (`src/server/portal-aluno/sessao.ts:41-63`).
     Sessão morta leva de volta a `/portal-aluno/entrar` (`sessao.ts:112-116`).
   - Os POST exigem Origin do próprio host; outra origem recebe 403 (`politica.ts:85-96`).
7. **O que o aluno vê.**
   - Início: lista de reposições (`src/app/portal-aluno/page.tsx:24-34`).
   - Detalhe da reposição: prazo, entregas com a versão aprovada, correções, player de gravação, relato de
     indisponibilidade e formulário de entrega (`src/app/portal-aluno/reposicoes/[id]/page.tsx:15-83`).
   - "Frente acadêmica": avaliações oficializadas, recuperações, habilidades, frequência e fechamento, por
     matrícula (`src/app/portal-aluno/resultados/page.tsx:130-151`).
   - "Preferências de horário": só o fuso de exibição (`src/app/portal-aluno/preferencias/page.tsx`).
   - **Não há cobranças, financeiro nem documentos no portal** (coerente com a SPEC §1).
   - O vídeo só passa pelo servidor, via Drive, e depende de credenciais do Drive
     (`src/app/api/portal-aluno/reposicoes/[id]/video/route.ts:18-46`). Sem Drive configurado, aparece
     "Reprodução indisponível" ou a gravação "não está liberada".
8. **Sair.** O botão "Sair" revoga a sessão atual e volta para `/portal-aluno/entrar`
   (`src/app/portal-aluno/sair.tsx`; `src/app/api/portal-aluno/sair/route.ts:7-13`).
9. **Recuperação.** `/portal-aluno/recuperar` dá sempre a mesma resposta, exista ou não a conta
   (`src/app/api/portal-aluno/recuperacao/route.ts:12-17`). Só uma conta ativa com senha recebe envio
   preparado (`identidade.ts:185-204`). Cada pedido conta na mesma janela de 5 por 15 minutos (`:192`).
   Também depende do envio real.
10. **Troca assistida de e-mail.** SEC ou ADM prepara com motivo e evidência (`identidade.ts:309-352`). O
    novo endereço recebe um link de validação. Depois, **outro** ADM decide (`:356`, `:374`). Aprovar troca
    o e-mail, apaga a senha, revoga sessões e links e prepara a recuperação no novo endereço
    (`painel.tsx:71-78`). Depende do envio real e de dois administradores.
11. **Envio incerto (Q166).** A SEC registra a evidência; **outro** ADM autoriza a reemissão
    (`src/server/portal-aluno/conciliacao-envio.ts:71-130`; `src/server/portal-aluno/fila-envios.ts:69-70`).
    Só existe depois de uma tentativa real de envio.

Lacunas do portal: nenhuma tela bloqueia uma conta (`ativa=false` não tem quem grave). Encerrar o aluno ou a
matrícula não revoga o acesso ao portal. As leituras históricas continuam visíveis (achado #27, Sem doc).

## Empresas (B2B): fluxo real e lacunas

**O que existe:**

- `/empresas` e `/empresas/[id]`, só para Financeiro e Administrador (`src/app/(app)/empresas/page.tsx:13-17`;
  `src/app/(app)/empresas/[id]/page.tsx:49-54`; `src/server/empresas/consultas.ts:23,34,95,167`).
- Cadastro e edição: nome, país, documento, contato, dia de vencimento de 1 a 28 e observações
  (`src/server/empresas/schema.ts:5-46`). Ativar e inativar pedem confirmação
  (`src/server/empresas/acoes.ts:58-142`; `FichaEmpresa.tsx:283-302`).
- A empresa também pode nascer de um lead PJ no CRM (`src/server/comercial/acoes.ts:160-182`).

**O que está desligado por decisão (D9, 19/10/2026):**

- Fechar e pagar fatura B2B (`src/lib/funcionalidades.ts:11-14`; `acoes.ts:44-46,159,259`). A tela mostra
  "A cobrança de empresas (fatura B2B) está desligada nesta escola…" (`FichaEmpresa.tsx:182`).
- **Cancelar** uma fatura FECHADA antiga continua disponível (`acoes.ts:333-360`).
- O lote de colaboradores sempre recusa: "Contratação corporativa em lote não integra esta entrega…"
  (`acoes.ts:144-152`), conforme o quadro (`docs/planejamento/quadro-entregas.md:366`) e o roadmap
  (`docs/03-roadmap.md:3`).

**O que falta para o fluxo "empresa paga contratos individuais":**

- Na matrícula, o pagador "Empresa (B2B)" é texto livre: cria um `Responsavel` com parentesco "Empresa"
  (`src/app/(app)/matriculas/nova/MatriculaFormulario.tsx:576-580`; `src/server/matricula/acoes.ts:228`).
- Nenhum código grava `Matricula.empresaId` (`prisma/schema.prisma:1932`). Por isso a seção "Colaboradores"
  da ficha da empresa mostra sempre "Nenhum contrato individual vinculado a esta empresa ainda"
  (`FichaEmpresa.tsx:129-135`).
- O botão "Preparar matrícula individual" só abre `/matriculas/nova`, sem a empresa (`FichaEmpresa.tsx:130`).
- Também não existem: relatório por colaborador com dados novos, contrato corporativo com termos aplicados
  às matrículas, portal empresarial (fora do escopo pela SPEC §1) e pipeline B2B próprio (ver auditoria 06).

## Importação e migração: o que existe

| Carga | Rota / tela | Formato | Colunas | Validações | Papel |
|---|---|---|---|---|---|
| Cadastro de alunos em lote (importador simples, não é migração) | Alunos › "Cadastrar por lote" (`src/app/(app)/alunos/ImportarAlunosModal.tsx`) → `POST /api/alunos/importar`; modelo em `GET /api/alunos/modelo` | Só XLSX; 5 MB; 1000 linhas; **lê só a 1ª aba, cabeçalho na linha 1** (`src/app/api/alunos/importar/route.ts:31-32,97-120`) | 27 colunas do modelo; obrigatórias: Nome e País (`src/server/alunos/importacao.ts:16-44`) | País por nome ou ISO; documento valida mas não bloqueia; telefone normalizado para E.164; deduplicação por documento no país, ou nome + e-mail/telefone/nascimento, contra o cadastro e contra as linhas anteriores (`src/server/alunos/importacao-duplicidade.ts`); relatório de criados, ignorados e erros por linha. **Problemas:** "Número" sobrescreve o documento (#36); vazio em "Recebe comunicações" vira Sim (#37); fuso não é validado (#39); cria código novo, status Ativo e não guarda o ID de origem (#38) | Só ADM (`route.ts:72-74`; `src/app/api/alunos/modelo/route.ts:35`) |
| M01: preparação do lote | Configuração › "Preparação de migração" (`/configuracao/migracao`) | CSV (vírgula ou ponto e vírgula) ou XLSX; 5 MB; **500 linhas por aba**; escolhe a aba; **cabeçalho na linha 1** (`src/server/migracao/planilha-leitura.ts:4-11`; `src/server/migracao/planilha.ts:8-26`) | Mapeamento manual coluna → campo: aluno (id, nome, e-mail, documento, país, fuso), turma, matrícula, alocação, financeiro, consentimento e presença. As colunas não mapeadas ficam na fotografia (`planilha.ts:4,28-37`) | Origem + chave do lote idempotentes; pendência por campo (nome, país, fuso, e-mail, documento ausente ou inválido, datas, moeda, país ISO) (`src/server/migracao/preparacao.ts:51-90`); colisões e conflitos entre lotes. Não cria nada | Só ADM (`src/server/migracao/acoes.ts:34-36`; `src/app/(app)/configuracao/migracao/page.tsx:11`) |
| M01: aplicação de cadastro | Detalhe do lote (`/configuracao/migracao/[loteId]`), botões Ensaiar e Aplicar (`AplicarCadastroMigracao.tsx`) | — | Só linhas CADASTRO completas | Ensaio antes; aplicação só com o mesmo hash; bloqueia se houver pendência ou colisão, país ISO não inequívoco, ou e-mail/documento já existente sem mapa; o destino divergente não é sobrescrito; cria o aluno com WhatsApp e comunicações **desligados** e grava o mapa origem → aluno (`src/server/migracao/aplicacao-cadastro.ts:32-88`). **Cria aluno sem código `A-`** (#43) | Só ADM |
| M01: vínculo de matrícula | Detalhe do lote: correspondências de produto, turma e situação, Ensaio e Aplicar (`EnsaioVinculoMigracao.tsx`, `AplicarVinculoMigracao.tsx`) | — | IDs de aluno, turma e matrícula de origem; termos, fatos e evidências | Correspondências versionadas e revogáveis; ensaio persistido; repetir com dados diferentes é recusado; ENCERRADA exige limite final (`src/server/migracao/ensaio-vinculo.ts:32-127`; `src/server/migracao/aplicar-vinculo.ts:27-66`) | Só ADM |
| M01: conciliação financeira | `/financeiro/migracao` e `/financeiro/migracao/[linhaId]` (link "Conferir conciliação da migração" no Financeiro) | — | Linha FINANCEIRO_HISTORICO com o ID financeiro e o ID do contrato | Modalidades: pendência, vincular recebimento existente ou registrar recebimento comprovado; complementos com evidência; **outra pessoa decide**; revalida a fotografia (`src/server/migracao/conciliacao-financeira.ts:28-58`) | ADM e FIN (`src/app/(app)/financeiro/migracao/page.tsx:12`) |
| M01: entrada financeira histórica (pagador e obrigação) | Mesma tela da linha financeira (`EntradaFinanceiraHistorica.tsx`) | — | Tipo de cobrança, valor, moeda, vencimento, competência | Proposta imutável; **outra pessoa** do Financeiro ou da Administração aprova (`src/server/migracao/entrada-financeira-historica.ts:21-72`) | FIN e ADM |
| M01: presença histórica | `/configuracao/migracao/presenca/[linhaId]` (link no detalhe do lote, que é só do ADM) | — | Aula histórica existente + participação + evidência | Aula no passado; um único vínculo histórico; **outra pessoa** decide; divergência resolvida por GP ou ADM (`src/server/migracao/presenca-historica.ts:25-100`) | Propor: SEC, GP, ADM · Decidir: GP, ADM |
| Cargas Q10 (docs 19-23) e turmas XLSX | `/api/turmas/importar` (fora desta área) | XLSX | — | — | ADM |

O que **não** migra (SPEC M01, `docs/specs/erp-educacional.md:449-451`): contratos e aditivos, cobranças
ausentes completas, gravações e materiais, reposições, cotas, créditos, mudanças acadêmicas, leads,
atendimentos e preferências por finalidade. A carga real conferida está pendente.

## Mapa de telas

| Rota | Arquivo | Papéis (guard real) | O que faz |
|---|---|---|---|
| `/alunos` | `src/app/(app)/alunos/(lista)/page.tsx` | SEC, GP, FIN, PROF (+ADM) por `exigirPapelLeitura`; outros veem "Acesso negado" (`:14-25`) | Lista paginada com busca e filtros (país, turma, status); PROF só as suas turmas; coluna financeira só para ADM, SEC e FIN; "Cadastrar por lote" só ADM (`:41`); "Exportar planilha" com a concessão `dados.exportar_alunos` ou ADM |
| `/alunos/[id]` | `src/app/(app)/alunos/[id]/page.tsx`, `FichaAluno.tsx` | SEC, GP, FIN, PROF (+ADM); PROF fora da turma recebe 404 | Ficha (ver a seção acima) |
| `/alunos/[id]/financeiro` | `src/app/(app)/alunos/[id]/financeiro/page.tsx` | FIN, SEC, GC, VEN (+ADM) (`:21-26`) | Ficha financeira (auditoria 05) |
| `/alunos/[id]/movimentacoes` | `src/app/(app)/alunos/[id]/movimentacoes/page.tsx` | SEC, FIN, ADM (`:34`; `pausa-estado.ts:8`) | Pausa, retomada e encerramento por matrícula, com aprovação independente |
| `/alunos/[id]/academico` | `src/app/(app)/alunos/[id]/academico/page.tsx` | SEC, GP, PROF (+ADM) (`:18`) | Mudanças acadêmicas por matrícula, avaliações e reposições |
| `/alunos/[id]/portal` | `src/app/(app)/alunos/[id]/portal/page.tsx` | SEC, ADM (`:10`) | Convite, troca de e-mail, situação da conta |
| `/alunos/[id]/agenda-aditivo` | `src/app/(app)/alunos/[id]/agenda-aditivo/page.tsx` | SEC, GP, ADM (`:13`) | Conferência de agenda para aditivo (só leitura) |
| `/alunos/[id]/creditos/[creditoId]` | `src/app/(app)/alunos/[id]/creditos/[creditoId]/page.tsx` | FIN, ADM (`:17`) | Uso e devolução de crédito |
| `/alunos/turma/[id]` | `src/app/(app)/alunos/turma/[id]/page.tsx` | SEC, GP, FIN, PROF (+ADM) (`:17-22`) | Ficha da turma; acadêmico só GP e PROF |
| `/portal` (legado) | `src/app/(portal)/portal/page.tsx` | Público (nada é consultado) | Explica que o portal tem acesso próprio; botão "Entrar na área do aluno" |
| `/portal-aluno/entrar` | `src/app/portal-aluno/entrar/page.tsx` | Público | Login do aluno |
| `/portal-aluno/recuperar` | `src/app/portal-aluno/recuperar/page.tsx` | Público | Pedido de recuperação (resposta neutra) |
| `/portal-aluno/ativar` | `src/app/portal-aluno/ativar/page.tsx` | Público (token no `#`) | Definir a senha (convite ou recuperação) ou validar o novo e-mail |
| `/portal-aluno` | `src/app/portal-aluno/page.tsx` | Sessão do portal (`exigirSessaoPortalAlunoPagina`) | Lista de reposições, links e "Sair" |
| `/portal-aluno/reposicoes/[id]` | `src/app/portal-aluno/reposicoes/[id]/page.tsx` | Sessão do portal; reposição de outro aluno dá 404 (`:24-30`) | Detalhe, entrega, relato e vídeo |
| `/portal-aluno/resultados` | `src/app/portal-aluno/resultados/page.tsx` | Sessão do portal | Avaliações, frequência e fechamento por matrícula |
| `/portal-aluno/preferencias` | `src/app/portal-aluno/preferencias/page.tsx` | Sessão do portal | Fuso de exibição |
| `/secretaria/envios-portal` | `src/app/(app)/secretaria/envios-portal/page.tsx` | SEC, ADM (`:19`) | Fila de envios (Incertos, Falhas, Todos); evidência e decisão de reemissão |
| `/certificado/[codigo]` | `src/app/certificado/[codigo]/page.tsx` | Público | "Certificado autêntico" (nome, nível, data) ou "Código inválido" |
| `/preferencias` | `src/app/(app)/preferencias/page.tsx` | Qualquer usuário da equipe autenticado (`:7`); link "Fuso" na barra lateral (`src/components/Sidebar.tsx:144`) | Fuso de exibição pessoal |
| `/empresas` | `src/app/(app)/empresas/page.tsx` | FIN (+ADM) (`:13`) | Lista, filtros, criar empresa |
| `/empresas/[id]` | `src/app/(app)/empresas/[id]/page.tsx`, `FichaEmpresa.tsx` | FIN (+ADM) (`:49`) | Dados, colaboradores (sempre vazio), faturas históricas (só cancelar), ativar e inativar |
| `/configuracao/migracao` | `src/app/(app)/configuracao/migracao/page.tsx` | ADM (`:11`); aba visível só para ADM (`src/app/(app)/configuracao/_componentes/tabs.ts:22`) | Preparar lote (CSV/XLSX) e listar lotes |
| `/configuracao/migracao/[loteId]` | `src/app/(app)/configuracao/migracao/[loteId]/page.tsx` | ADM (`:20`) | Linhas, pendências, colisões; aplicar cadastro; ensaiar e aplicar vínculo; links para presença e financeiro |
| `/configuracao/migracao/presenca/[linhaId]` | `src/app/(app)/configuracao/migracao/presenca/[linhaId]/page.tsx` | SEC, GP, ADM (`:8`) | Propor e decidir presença histórica |
| `/financeiro/migracao` | `src/app/(app)/financeiro/migracao/page.tsx` | ADM, FIN (`:12`) | Fila de linhas financeiras da migração |
| `/financeiro/migracao/[linhaId]` | `src/app/(app)/financeiro/migracao/[linhaId]/page.tsx` | ADM, FIN (`:17`) | Conciliação e entrada financeira histórica |
| `/configuracao/operacao` | `src/app/(app)/configuracao/operacao/page.tsx` | ADM (`:10`) | Inclui "Acesso do aluno" (prazos do portal) e prazos de entrega de reposição |
| `GET /api/alunos/modelo` · `POST /api/alunos/importar` | `src/app/api/alunos/{modelo,importar}/route.ts` | ADM | Modelo e importação XLSX |
| `GET /api/exportacoes/alunos` | `src/app/api/exportacoes/[tipo]/route.ts` | Concessão `dados.exportar_alunos` ou ADM (`:44,52`) | XLSX com código, nome, situação, país e turma (`:68`); evento `DadosExportados` |
| `POST /api/upload` · `GET /api/files/[...path]` | `src/app/api/upload/route.ts`, `src/app/api/files/[...path]/route.ts` | Upload: VEN, GC, SEC, FIN, PROF (+ADM) (`upload/route.ts:93`); leitura: sessão da equipe + autorização por objeto (`src/server/uploads/autorizacao.ts:115-166`) | Arquivos privados em `data/uploads` |
| `POST /api/portal-aluno/{sessao,token,recuperacao,sair}` | `src/app/api/portal-aluno/*/route.ts` | Público com checagem de Origin | Login, ativação, recuperação e saída |
| `POST /api/portal-aluno/envios/cron` | `src/app/api/portal-aluno/envios/cron/route.ts` | Cabeçalho `x-cron-secret` | Worker de envio (desligado sem a flag) |

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Estrutura da ficha | docs/09 §Ficha do Aluno | Cabeçalho, turma com "tempo na turma", dados pessoais, financeiro resumido, histórico e movimentações na ficha | Página única sem abas; o conteúdo existe; operações em sub-telas por link; sem "tempo na turma" nem data de início (`FichaAluno.tsx:516-630`; `page.tsx:125-130`) | Parcial | Seções na mesma página; links no topo; não procurar abas |
| 2 | Projeção por papel na ficha | docs/37 AC04, linhas 150-159 | Professor só com campos pedagógicos; financeiro só com vínculo financeiro; texto livre fora da projeção pedagógica | Cadastro (dados pessoais e telefone) só SEC e ADM; financeiro só ADM, SEC e FIN; GP vê todos os alunos sem cadastro e sem financeiro; PROF só as suas turmas; motivo e observação só SEC e ADM (`src/server/alunos/consultas.ts:40-87,255-331`) | Conforme | FIN não vê dados pessoais nem telefone; GP e PROF sem bloco financeiro e sem dados pessoais |
| 3 | Histórico de movimentações | docs/09 §Ficha ("data · de→para · motivo · autor") | Linha do tempo com de → para | Mostra tipo, matrícula, motivo e observação (só SEC e ADM), autor e data; sem turma de origem e destino (`FichaAluno.tsx:606-630`) | Parcial | Sem "de → para"; GAP já conhecido (rel. 02 #64) |
| 4 | Trocar turma pela ficha | docs/09 §Ciclo de status e §Movimentações (equivalente com execução direta) · SPEC REQ-05/D14 | Equivalente: execução direta pela SEC; entre níveis: parecer + aprovação | Não há botão; `trocarTurma` sempre recusa, mandando ao fluxo de equivalência com aprovação pedagógica independente (`src/server/alunos/acoes.ts:267-273`); fluxo em `/alunos/[id]/academico` (`academico/page.tsx:46`) | Divergente | Trocar turma só por "Turma, nível e solicitações acadêmicas"; até a equivalente pede aprovação **[PO]** |
| 5 | Pausar e encerrar na ficha | docs/09 §Movimentações (modais na ficha) · SPEC REQ-07 (seleção por matrícula) | doc 09: modal na ficha; SPEC: por matrícula | Botões só aparecem se o aluno não tiver alocação, mais de uma matrícula, preparação, horas ou propostas; nos outros casos, um aviso (`src/server/matricula/limite-legado.ts:5-20`; `page.tsx:49`; `FichaAluno.tsx:239-254`) | Divergente | Aluno com turma: sem Pausar ou Encerrar na ficha; usar "Pausa, retomada e encerramento por matrícula". Roteiro ALU-05 a 12 obsoleto |
| 6 | Reativar | docs/09 §Ciclo de status (D13: Pausado → Ativo só com aprovação independente) | Retomada com proposta e aprovação de outra pessoa (FIN/ADM) | `reativarAluno` recusa sempre (`acoes.ts:223-228`); botão "Propor retomada" leva a `financeiro#retomada` (`FichaAluno.tsx:247`); proposta e decisão em `retomada-proposta.ts:13,43` | Conforme | Sem "Reativar" direto; a retomada vira proposta para outra pessoa do FIN ou ADM |
| 7 | Quem movimenta por matrícula | docs/37 `aluno.movimentar` (SEC/GP/ADM) · docs/09 §Visão por papel (GP faz movimentações acadêmicas) | GP movimenta | `/movimentacoes` aceita só SEC, FIN e ADM; GP é recusado (`movimentacoes/page.tsx:34`; `pausa-estado.ts:8`); aprovação: FIN e ADM, não a própria (`pausa-integridade.ts:5`; `pausa-proposta.ts:49`) | Divergente | GP em `/alunos/[id]/movimentacoes` vai para "Acesso negado" **[PO]** |
| 8 | Pausa por matrícula, vaga e professor | docs/09 §Ciclo de status (Pausado não ocupa vaga e não aparece para o professor) | Libera a vaga e some da visão do professor | Aplicar a pausa só muda `Matricula.status` para PAUSADA (`src/server/matricula/pausa-execucao.ts:45`); a alocação continua ativa e a vaga é contada por alocação ativa (`src/server/alunos/consultas.ts:344`); o escopo do professor também é por alocação ativa (`consultas.ts:68-70`); o selo da ficha continua "Cadastro: Ativo" | Divergente | Após pausa aplicada: vaga continua ocupada, professor continua vendo, selo "Ativo" **[PO]** (R10 persiste) |
| 9 | Encerramento por matrícula | SPEC REQ-07 (proporcional, multa, compensações, aprovação) | Encerramento com acerto e aprovação | SEC registra o pedido (`encerramento-solicitacao.ts:14`); FIN prepara o acerto (`encerramento-rascunho.ts:20`); **outra pessoa** do FIN decide (`encerramento-decisao.ts:15,25`); FIN efetiva (`encerramento-efetivar.ts:11`) | Conforme | Fluxo em várias etapas e pessoas; o doc 09 ("sem aprovação") está superado pela SPEC |
| 10 | Lista de alunos | docs/09 §Lista · docs/37 `aluno.ler` | Busca, filtros (país, turma, status), situação financeira; escopo por papel | Guard SEC, GP, FIN e PROF (+ADM); PROF só as suas turmas; financeiro só ADM, SEC e FIN (`(lista)/page.tsx:14-25,50`; `consultas.ts:175-253`) | Conforme | VEN e GC: "Acesso negado"; PROF vê só os seus alunos |
| 11 | Exportação de alunos | docs/37 `dados.exportar` (linha 138), "Exportação controlada" (linha 316) | Concessão explícita, campos limitados, registro | Botão só com a concessão ou para ADM (`src/components/ExportarPlanilha.tsx:9-13`); rota revalida (`route.ts:52,90`); 5 colunas (`:68`); evento sem o texto da busca (`:104`) | Conforme | Sem a concessão, o botão "Exportar planilha" não aparece |
| 12 | Créditos do aluno | SPEC REQ-02 | Uso de crédito com concordância, proposta e aprovação independente | Proposta só FIN; decisão por outra pessoa com `financeiro.aprovar_acertos` ou ADM (`uso-credito-proposta.ts:22,48,91`); página FIN e ADM (`creditos/[creditoId]/page.tsx:17`) | Conforme | Quem propôs não vê o botão de decidir; a entrada é pelos links de horas e desistência, não pela ficha |
| 13 | Agenda para aditivo | SPEC REQ-18 (DCT03) | Conferência de agenda antes do aditivo | Só leitura; lista as particulares ativas com encontro futuro (`agenda-aditivo/page.tsx:13-20`) | Conforme | "A conferência não reserva nem altera agenda" |
| 14 | Portal legado `/portal` | quadro-entregas:362 (identidade própria do portal) | Portal com identidade separada | `/portal` só explica e leva a `/portal-aluno/entrar` (`(portal)/portal/page.tsx:9-28`); usuário só-ALUNO é redirecionado (`sessao.ts:182-185`) | Conforme | Login da equipe não abre a área do aluno |
| 15 | Convite do portal | SPEC REQ-09 (convite individual por e-mail) · Q72/Q73 | Convite individual, sem a equipe ver senha ou link | SEC e ADM preparam; sem e-mail fica "PENDENTE_EMAIL"; com senha, recusa; idempotente (`identidade.ts:131-182`; `painel.tsx:35-40,68`) | Conforme | "Convite preparado. O envio depende da configuração institucional." ou "Acesso pendente: cadastre e confirme um e-mail individual." |
| 16 | Envio do convite e modo de teste | SPEC §10 (portal habilitado só após validar dependências) · AGENTS.md (sem e-mails reais nesta fase) | Operação externa desligada em ensaio | Sem transporte simulado; o token é criado só no despacho (`identidade.ts:483-498`); o despacho exige a flag + Resend + URL HTTPS (`envio-resend.ts:22-27`; `processar-envios.ts:36-38`); o cron não executa com a flag desligada (`cron/route.ts:13-15`) | Parcial | Em UAT o envio fica "Preparado" (aba "Todos" de Envios do portal) e nenhum link chega **[BLOQ][DEV][PO]** |
| 17 | Prazos do portal | Q72/Q73 (prazos escolhidos pela escola, sem padrão implícito) | Sem número implícito | Sem os 4 prazos, login e ativação falham (`identidade.ts:47-63`; `politica.ts:25-38`); salvar só ADM (`configuracao.ts:14-36`) | Conforme | Antes de configurar: "Não foi possível entrar com esses dados…" |
| 18 | Senha e token | SPEC REQ-09 (senha definida pelo aluno; token único com validade) | Token único, com validade, senha do aluno | Senha de 12 caracteres a 72 bytes, bcrypt 12 (`identidade.ts:27-29,282`); token no `#`, uso único, revoga os outros (`politica.ts:58-61`; `identidade.ts:251-252,294-303`) | Conforme | Link reusado: "Este link não está mais disponível…"; senha curta: o link continua valendo |
| 19 | Login e bloqueio por tentativas | Sem regra específica além de REQ-09 | — | 5 falhas em 15 min bloqueiam por 15 min, no banco (`rate-limit.ts:4-5,51`); bloqueado responde como senha errada (`entrar/page.tsx:79`) | Conforme | Na 6ª tentativa, mesmo com a senha certa: "E-mail ou senha incorretos." por 15 min |
| 20 | Sessão, cookie e CSRF | Política de segurança do portal (Q72-Q74) | Sessão própria e revogável | Cookie httpOnly/lax/secure em produção (`politica.ts:69-82`); revalida em cada página (`sessao.ts:41-63`); Origin obrigatório (`politica.ts:85-96`); "Sair" revoga (`sair/route.ts:7-13`) | Conforme | Depois de "Sair", "Voltar" do navegador cai em `/portal-aluno/entrar` |
| 21 | Recuperação de acesso | SPEC REQ-09 · Q74 | Recuperação com token único e validade, sem revelar conta | Resposta neutra (`recuperacao/route.ts:12-17`); só conta ativa com senha (`identidade.ts:197-202`) | Conforme | Sempre "Pedido registrado. Se houver uma conta ativa…"; o envio depende do #16 |
| 22 | Troca assistida de e-mail | Q74 · INV-07 (aprovação independente) | Secretaria prepara; outra pessoa da Administração decide | Prepara SEC ou ADM com motivo e evidência (`identidade.ts:309-352`); decide só ADM, diferente de quem preparou (`:356,374`); aprovar apaga a senha e revoga sessões (`painel.tsx:71-78`) | Conforme | Exige o link de validação (#16) e 2 administradores **[DEV]** |
| 23 | Envio incerto (Q166) | SPEC Q166 (`erp-educacional.md:437-441`) | SEC registra evidência; ADM independente autoriza reemissão | `conciliacao-envio.ts:71-130`; `fila-envios.ts:69-70` | Conforme | Só aparece com envio real que deu "Incerto"; fora do UAT simulado |
| 24 | Conteúdo do portal | SPEC §1 (reposições + acompanhamento acadêmico; sem comercial; sem portal de responsáveis) | Reposições, avaliações, frequência e consolidado | Reposições, resultados e preferências; sem cobranças (`portal-aluno/page.tsx:32-33`; `resultados/page.tsx:130-151`) | Conforme | Não procurar cobranças no portal; não é bug |
| 25 | Reprodução da gravação | SPEC REQ-09 (reprodução pelo servidor, sem download) · auditoria pós-183 Q33 | Player autenticado; sem URL pública | Rota de vídeo com revalidação contínua via Drive (`video/route.ts:18-46`); doc 41 L145: "sem ensaio real" | Parcial | Sem Drive configurado: "Reprodução indisponível" ou a gravação "não está liberada" **[DEV]** |
| 26 | Entrega, relato e gestão de reposição | auditoria pós-183 (Q33, Q35, Q57, Q58) | Formulário de relato, versão validada, painel de gestão | Portal: versão aprovada, relato e entrega (`reposicoes/[id]/page.tsx:68-82`); gestão em `/diario/reposicoes` (`src/app/(app)/diario/reposicoes/OperacaoEntregaReposicao.tsx:6-14`) | Conforme | As lacunas da auditoria 183 foram cobertas no código; homologação visual pendente |
| 27 | Bloqueio da conta do portal | Sem fonte | — | Nenhuma tela grava `ContaPortalAluno.ativa=false`; encerrar aluno ou matrícula não revoga a sessão (busca no código: sem escritor) | Sem doc | Aluno encerrado continua entrando no portal **[PO]** |
| 28 | Preferências pessoais | quadro-entregas:67, :455 (fuso de exibição) | Preferência de fuso para equipe e portal | Equipe: `/preferencias` (`preferencias/page.tsx:7`; `src/server/preferencias/fuso-exibicao.ts:30-40`); portal: `preferencia-fuso.ts:81-88`; `US/*` convertido para IANA | Conforme | Só fuso; vazio = "Usar fuso de origem" |
| 29 | Validação pública de certificado | docs/03 Fase 3 · SPEC §1 (certificados fora do escopo) | Validação por código | Código hex de 8 a 16 caracteres; mostra nome, nível e data (`src/server/academico/consultas-legado.ts:264-281`; `certificado/[codigo]/page.tsx`) | Conforme | Código válido: "Certificado autêntico ✅"; inválido: "Código inválido…" |
| 30 | Emissão de certificado | docs/03 Fase 3 · SPEC §1 (fora do escopo) | — | `aprovarNivelAluno` (GP) existe (`src/server/academico/acoes-legado.ts:111-149`), mas nenhuma tela o chama; `podeAprovar = false` (`turma/[id]/page.tsx:36`) | Não implementado | Ficha da turma: "Elegível: concluir no fluxo acadêmico", sem botão de emitir |
| 31 | Certificado público e dados pessoais | Sem fonte (LGPD) | — | Página pública mostra nome completo; sem `noindex` nem limite de tentativas (`certificado/[codigo]/page.tsx:6-33`) | Sem doc | Registrar o observado **[PO]** |
| 32 | Minimização na trilha de exportação | Decisão D5 (#165) | Tirar o texto de busca dos eventos antigos | Script idempotente com simulação por padrão (`src/server/lgpd/anonimizar-busca-exportacoes.ts:56-123`; `scripts/anonimizar-busca-exportacoes.ts`) | Conforme | Sem tela; não é teste de interface |
| 33 | Direitos do titular (LGPD) | checklist-dados-migracao §3; docs/37:138,316 | Exportação controlada; autorização por finalidade | Não há exportação de dados de um aluno, anonimização ou exclusão de aluno (busca no código: só o script do #32) | Não implementado | Não testar |
| 34 | Consentimento de comunicação | checklist-dados-migracao §3 ("canal, finalidade, permitido/recusado/desconhecido") | Por canal e finalidade, com origem e data | Um booleano `aceitaComunicacoes` editável na ficha, com motivo (`FichaAluno.tsx:374`; `src/server/alunos/schema.ts:64,81`); M01 só guarda `consentimentoOrigem` na fotografia (`planilha.ts:34`) | Parcial | Caixa única "Recebe comunicações" |
| 35 | Importador XLSX: base | docs/37 `dados.importar` (linha 137) · docs/42-43 (dedup) | Capacidade específica; não duplicar | Só ADM; 5 MB e 1000 linhas; Nome e País obrigatórios; dedup em 4 critérios no país (`route.ts:31-32,72-74,115-120`; `importacao-duplicidade.ts`) | Conforme | Reenviar a mesma planilha: "N linha(s) ignorada(s) por já existir o aluno" |
| 36 | Importador XLSX: coluna "Número" | Modelo do próprio sistema (`importacao.ts:16-44`) | Cada cabeçalho do modelo cai no seu campo | "Número" (endereço) casa por prefixo com "Número do documento" (`importacao.ts:109-117`; colunas `:25` e `:36`); a coluna posterior sobrescreve o documento (`route.ts:144-148`). Teste da rota não tem a coluna (`route.test.ts:35`) | Divergente | Com o modelo: o documento some (ou vira o número da casa) na ficha **(bug)** |
| 37 | Importador XLSX: comunicação | checklist-dados-migracao §3 ("ausência de informação não comprova autorização") | Vazio não é Sim | `resolverBool(...) ?? true` (`route.ts:214`); M01 grava `false` (`aplicacao-cadastro.ts:77`) | Divergente | Célula vazia gera "Recebe comunicações" marcado **[PO]** |
| 38 | Importador XLSX usado como migração | analise-planilha-leticia §5 itens 1-2; SPEC §10 | Preservar IDs de origem; reexecução sem duplicar; não presumir situação | Gera código novo, status Ativo, não guarda o ID de origem, só a 1ª aba (`route.ts:97,194,227`) | Divergente | Para migração usar Configuração › Preparação de migração, não "Cadastrar por lote" |
| 39 | Importador XLSX: fuso | M01 ("fuso precisa ser válido") | Fuso IANA válido | Grava o texto como veio (`route.ts:225`) | Parcial | Fuso inválido entra sem aviso |
| 40 | M01: preparação | SPEC M01 (`erp-educacional.md:461-467`) | Lote imutável por origem + chave; pendências por campo; mapeamento manual; não cria nada | `acoes.ts:34-106`; `preparacao.ts:51-94`; `PreparacaoMigracaoPainel.tsx` | Conforme | "Esta tela não cria alunos, matrículas, consentimentos, presença, cobranças ou recebimentos." |
| 41 | M01: formato da planilha | analise-planilha-leticia §1 e §5.1 (cadastros começam na linha 4; 1ª aba = Instruções; 106 alunos) | Ler a fonte real com mapeamento | Escolhe a aba, mas o cabeçalho tem de estar na linha 1; limite de 500 linhas por aba (`planilha-leitura.ts:4,11`) | Parcial | A planilha Leticia precisa ter as linhas 1-3 removidas antes **[DEV]** |
| 42 | M01: aplicação de cadastro | SPEC M01 (`erp-educacional.md:469`) | Só CADASTRO completo; e-mail ou documento existente bloqueia; sem fusão; WhatsApp e comunicações desligados | `aplicacao-cadastro.ts:32-88` | Conforme | Ensaiar → Aplicar; linhas com pendência ficam "Bloqueado" com o motivo |
| 43 | M01: código do aluno | docs/09 (código `A-` na ficha e na lista) | Todo aluno tem código | Cria o aluno sem `codigo` (`aplicacao-cadastro.ts:77`; `prisma/schema.prisma` Aluno.codigo opcional) | Divergente | Aluno migrado sem código na lista e na ficha **[PO]** |
| 44 | M01: vínculo | SPEC M01 (`erp-educacional.md:471-476,489-491`) | Correspondências revisadas; ensaio; aplicação idempotente | `ensaio-vinculo.ts:32-127`; `aplicar-vinculo.ts:27-66` | Conforme | Repetir com dados diferentes: "A linha já foi aplicada com condições diferentes…" |
| 45 | M01: conciliação e entrada financeira | SPEC M01 (`erp-educacional.md:453-459`) | Preparação e aprovação por pessoas distintas; não inferir pagamento | `conciliacao-financeira.ts:28-58`; `entrada-financeira-historica.ts:21-72` | Conforme | Quem propôs não decide: "A decisão exige outro usuário financeiro." |
| 46 | M01: presença histórica, acesso | SPEC M01 (presença: SEC, GP, ADM propõem) | SEC e GP operam | A página aceita SEC, GP e ADM (`presenca/[linhaId]/page.tsx:8`), mas o único link está no detalhe do lote, que é só ADM (`[loteId]/page.tsx:20,33`) | Parcial | SEC e GP só entram com a URL passada pelo ADM |
| 47 | M01: carga completa | SPEC §10 e M01 (`erp-educacional.md:451`) | Fases até a carga aprovada; outros históricos | Contratos, cobranças completas, gravações, reposições, créditos e leads não migram | Não implementado | Não testar |
| 48 | Uploads e leitura de arquivos | docs/37 AC04 e "Documentos e comprovantes" (checklist §3) | Arquivo não fica disponível a todos os papéis | Upload de PDF, JPG ou PNG até 10 MB; PROF só teste de nível (`upload/route.ts:86-109`); leitura por objeto: comprovante ADM, FIN e SEC; documento de matrícula ADM e SEC (+FIN para comprovante e contrato confirmado); lead pelo escopo comercial (`autorizacao.ts:115-166`); o portal não lê arquivos (`files/route.ts:23`) | Conforme | URL de arquivo alheio: "Acesso negado." (403) |
| 49 | Upload sem vínculo | Sem fonte | — | O autor não consegue reabrir o próprio arquivo antes de vinculá-lo (sem regra de autoria em `autorizacao.ts:115-166`) | Sem doc | Registrar o observado |
| 50 | Empresas: cadastro | docs/03 Fase 2 B2B · quadro:366 | Empresa como pagadora | CRUD e situação só FIN e ADM (`empresas/acoes.ts:58-142`; `consultas.ts:23`) | Conforme | SEC, VEN e GC: "Acesso negado" em `/empresas` |
| 51 | Fatura única e lote B2B | docs/03 Fase 2 ("contrato corporativo · fatura única · matrículas em lote") · roadmap:3 · decisão D9 | doc 03 marca a Fase 2 como entregue | Fechar e pagar desligados (`funcionalidades.ts:11`); lote recusado (`acoes.ts:144-152`); cancelar fatura antiga permitido (`acoes.ts:333-360`) | Divergente | Aviso "A cobrança de empresas (fatura B2B) está desligada nesta escola…"; não abrir bug |
| 52 | Empresa ligada às matrículas | quadro-entregas:366 ("empresas permanecem como pagadoras de contratos individuais") | Matrícula individual com a empresa como pagadora | Pagador "Empresa" vira um Responsável em texto livre (`matricula/acoes.ts:228`); nada grava `Matricula.empresaId` (`schema.prisma:1932`) | Não implementado | Ficha da empresa: "Nenhum contrato individual vinculado…" mesmo após matricular com pagador Empresa **[PO]** |
| 53 | Link do portal para o GP | docs/37 (o menu é só UX; não oferecer ação indisponível) | — | O bloco Acadêmico (ADM, GP) mostra "Gerenciar acesso ao portal" (`AcademicoAluno.tsx`), mas a página exige SEC ou ADM (`portal/page.tsx:10`) | Divergente | GP clica e cai em "Acesso negado" (bug de UX) |
| 54 | Testabilidade das decisões independentes | SPEC INV-07 · Q166 | Outra pessoa da Administração decide | Só 1 ADM no seed (`prisma/seed.ts`; `prisma/seed-qa.ts:36-82`) | Parcial | Sem o 2º ADM, a troca de e-mail e a reemissão não se decidem **[DEV]** |
| 55 | Roteiro do QA | `docs/qa/03-roteiro-testes-manuais.md` ALU-05..ALU-12 | Botões Trocar turma, Pausar e Reativar na ficha | Código atual: ver #4 a #8 | Divergente | Substituir ALU-05 a 12 pelos cenários A08 abaixo |

## Cenários de teste para o QA

Papéis: ADM = admin@genius.com · ADM-2 = segundo administrador **[DEV]** · SEC = secretaria@genius.com ·
FIN = financeiro@genius.com · FIN-2 = ana@genius.com (FIN+SEC, serve de "outra pessoa" do Financeiro) ·
GP = gp@genius.com · PROF = carla@genius.com · PROF-2 = professor2@genius.com · VEN = joao@genius.com ·
GC = gerente@genius.com.

Massa: AL-1 (com matrícula ativa e turma, Módulo 3); AL-S (aluno sem matrícula, criado por importação XLSX);
AL-P (aluno com e-mail individual para o portal).

### Pré-condições específicas desta área

- **PC-1 (ADM).** Configuração › Operação › "Acesso do aluno": preencher os 4 prazos (por exemplo, sessão 60,
  convite 1440, recuperação 60, validação de e-mail 1440) e salvar.
- **PC-2 [DEV][PO] [BLOQ].** Definir como o QA recebe o link do portal sem enviar e-mail real. Opções:
  (a) ligar `EMAIL_PORTAL_ENVIO_ENABLED` com uma chave Resend de teste e uma caixa de e-mail controlada
  pelo time; (b) criar uma ferramenta de dev que gere o token de convite para o QA. Sem isso, A08-20 a
  A08-31 ficam bloqueados.
- **PC-3 [DEV].** Criar um segundo administrador (ADM-2) para as decisões independentes.
- **PC-4 [DEV].** Para A08-34, inserir no banco de UAT um certificado com código conhecido, porque a
  interface não emite certificado.
- **PC-5 [DEV].** Para A08-42 e A08-43, preparar um CSV pequeno no formato do mapeamento (cabeçalho na
  linha 1) com IDs de origem fictícios.

| ID | Pré-condição | Papel | Passos | Resultado esperado | Marcador |
|---|---|---|---|---|---|
| A08-01 | AL-1 em turma de PROF | SEC | Abrir a ficha do AL-1 | Seções: cabeçalho com "Cadastro: Ativo", código e telefone; Turmas atuais; Dados pessoais; Financeiro; Histórico. Links no topo: "Pausa, retomada e encerramento por matrícula", "Acesso ao portal de reposições", "Conferir agenda para aditivo". Botão "Editar dados". **Sem** Pausar, Encerrar ou Trocar turma; aparece "Pausa, retomada e encerramento devem identificar as matrículas envolvidas…" | — |
| A08-02 | AL-1 | FIN | Abrir a ficha do AL-1 | Bloco Financeiro visível; **sem** Dados pessoais e sem telefone no cabeçalho; sem "Editar dados"; link "Pausa, retomada e encerramento por matrícula" visível; **sem** o botão acadêmico | — |
| A08-03 | AL-1 | GP | Abrir a ficha do AL-1 e depois a ficha de um aluno de outra turma | Os dois abrem (GP vê todos). Sem Financeiro e sem Dados pessoais; bloco "Acadêmico" com testes de nível e certificados; botão "Turma, nível e solicitações acadêmicas" | — |
| A08-04 | AL-1 em turma de PROF; aluno X em turma de PROF-2 | PROF | 1) Alunos 2) Ficha do AL-1 3) Abrir pela URL a ficha do aluno X | 1: só alunos das suas turmas. 2: sem Financeiro, sem Dados pessoais, sem botões; botão "Consultar solicitações e emitir parecer"; histórico sem motivo. 3: página 404 | — |
| A08-05 | — | VEN, depois GC | Abrir `/alunos` e `/alunos/<id do AL-1>` pela URL | `/alunos`: "Acesso negado" para os dois. Ficha: redireciona para `/acesso-negado` | — |
| A08-06 | AL-1 | SEC | Ficha › Editar dados: mudar o e-mail sem motivo; depois com motivo | Sem motivo: não salva. Com motivo: salva e o histórico de cadastro registra a alteração | — |
| A08-07 | AL-1 ativo | SEC | Pausa por matrícula › Nova pausa: escolher o contrato, ver a prévia e solicitar | Proposta "Pendente" com os impactos; a SEC **não** vê "Aprovar proposta" | — |
| A08-08 | Proposta do A08-07 | FIN | Abrir a proposta, motivo com menos de 5 caracteres; depois com motivo válido › Aprovar | Botão desabilitado com motivo curto; aprova com motivo válido; status "Aprovada" | — |
| A08-09 | Proposta solicitada pelo próprio FIN | FIN | Solicitar uma pausa como FIN e tentar aprovar a própria proposta | Recusado: "Quem solicita não pode decidir a própria proposta." | — |
| A08-10 | Proposta aprovada no A08-08 | SEC | "Aplicar proposta aprovada" e depois abrir a ficha do AL-1 e a ficha da turma | Contrato "Pausada". Registrar: selo do cadastro, vaga da turma e visão do PROF (hoje continuam "Ativo", ocupada e visível) | [PO] (#8, R10) |
| A08-11 | — | GP | Abrir `/alunos/<id do AL-1>/movimentacoes` pela URL | Redireciona para "Acesso negado" | [PO] (#7) |
| A08-12 | AL-1 pausado (A08-10) | SEC | Ficha financeira › Retomada (ou Nova retomada em Movimentações): propor | Proposta pendente; FIN-2 aprova e a SEC aplica; quem propôs não aprova | — |
| A08-13 | AL-1 | SEC | Movimentações › Novo pedido de encerramento: data, motivo e evidência | Pedido "Aberto" na lista "Pedidos de encerramento", com autor e datas | — |
| A08-14 | Pedido do A08-13 | FIN, depois FIN-2 | FIN prepara o acerto; FIN tenta decidir o próprio acerto; FIN-2 decide | FIN recusado: "Outra pessoa deve decidir o acerto."; FIN-2 decide e o FIN efetiva | — |
| A08-15 | AL-S (sem matrícula nem turma) | SEC | Ficha › Pausar sem motivo; depois com motivo | Botões Pausar e Encerrar visíveis (aluno sem vínculo). Sem motivo: bloqueado. Com motivo: "Cadastro: Pausado" | — |
| A08-16 | AL-S pausado | SEC | Encerrar com "Outro" sem observação; depois "Desistiu" | Sem observação: "Observação obrigatória quando o motivo é Outro". Com "Desistiu": "Encerrado" e histórico com motivo e autor | — |
| A08-17 | AL-1 com turma; outra turma equivalente com vaga | SEC | Ficha › "Turma, nível e solicitações acadêmicas" › escolher o contrato › preparar a transferência equivalente | Gera solicitação que precisa de aprovação pedagógica independente; não troca na hora | [PO] (#4) |
| A08-18 | AL-1 | GP | Bloco Acadêmico › "Gerenciar acesso ao portal" | Hoje cai em "Acesso negado" | Bug de UX (#53) |
| A08-19 | AL-S sem e-mail | SEC | Ficha › Acesso ao portal › "Preparar convite" | "Acesso pendente: cadastre e confirme um e-mail individual."; Identidade de portal "Aguardando definição de senha" | — |
| A08-20 | AL-P com e-mail; PC-1 | SEC | Acesso ao portal › "Preparar convite"; clicar de novo | "Convite preparado. O envio depende da configuração institucional."; o 2º clique não cria outro envio. Em Envios do portal › Todos: 1 item "Convite · Preparado". Sem token ou link na tela | — |
| A08-21 | A08-20 com envio desligado | SEC | Esperar 2 minutos e abrir Envios do portal › Todos | O item continua "Preparado" (envio desligado). ℹ️ Não é bug | [BLOQ] (#16) |
| A08-22 | PC-2; link de convite do AL-P | Aluno | Abrir o link; senha de 11 caracteres; depois senhas diferentes; depois válida e igual | 11: erro de mínimo de 12. Diferentes: o envio fica bloqueado. Válida: entra em `/portal-aluno` com "Acesso individual: <e-mail>". A barra de endereço não mostra `#token` | [DEV] |
| A08-23 | Link já usado no A08-22 | Aluno | Abrir o mesmo link de novo | "Este link não está mais disponível. Ele pode ter sido usado…" e o botão "Já tenho senha: entrar" | [DEV] |
| A08-24 | Convite preparado, e-mail do aluno alterado pela SEC antes de ativar | Aluno | Abrir o link e definir uma senha válida | Recusado com a mensagem genérica "Este link não está mais disponível…" (o servidor recusa por contato diferente, `identidade.ts:270-276`, e a rota devolve 422); a SEC precisa preparar outro convite | [DEV] |
| A08-25 | AL-P ativo | Aluno | `/portal-aluno/entrar` com senha errada 5 vezes; na 6ª, a senha certa | As 5: "E-mail ou senha incorretos.". 6ª: a mesma mensagem (bloqueado por 15 min). Depois de 15 min entra | [DEV] |
| A08-26 | AL-P logado | Aluno | Ver Início, "Ver frente acadêmica…", "Preferências de horário" | Lista de reposições ou "Não há reposições para este acesso."; resultados por matrícula; **sem** cobranças | [DEV] |
| A08-27 | AL-P logado; reposição de outro aluno (id) | Aluno | Trocar o id na URL `/portal-aluno/reposicoes/<id>` | Página "não encontrado" (sem dizer que existe) | [DEV] |
| A08-28 | AL-P logado | Aluno | Preferências › fuso "Costa Rica" › Salvar; voltar ao detalhe de uma reposição | "Preferência salva."; instantes exibidos em America/Costa_Rica | [DEV] |
| A08-29 | AL-P logado | Aluno | "Sair"; depois "Voltar" do navegador | Volta para `/portal-aluno/entrar`; a área exige login de novo | [DEV] |
| A08-30 | — | Público | `/portal-aluno/recuperar` com e-mail inexistente; depois com o e-mail do AL-P | Os dois: "Pedido registrado. Se houver uma conta ativa…". Só o do AL-P gera envio "Recuperação" (Envios › Todos) | Envio [BLOQ] |
| A08-31 | AL-P ativo; PC-2; PC-3 | SEC, depois ADM e ADM-2 | SEC: troca assistida com motivo e evidência; aluno valida o link do novo e-mail; ADM (preparador) tenta aprovar; ADM-2 aprova | Preparador: recusado. ADM-2: confirmação "Aplicar a troca do e-mail…"; depois, a sessão do aluno cai e a senha antiga deixa de valer | [DEV] |
| A08-32 | Sessão da equipe aberta (SEC) | SEC | Abrir `/portal` e `/portal-aluno` | `/portal`: "A área do aluno tem acesso próprio". `/portal-aluno`: pede o login do aluno | — |
| A08-33 | AL-1 encerrado com conta de portal ativa | Aluno | Entrar no portal | Registrar se ainda entra (hoje entra) | [PO] (#27) |
| A08-34 | PC-4 | Público | `/certificado/<código>`; `/certificado/abc`; `/certificado/<código em minúsculas>` | Válido: "Certificado autêntico ✅" com nome, nível e data. `abc`: "Código inválido…". Minúsculas: aceito (converte para maiúsculas) | [DEV] |
| A08-35 | Turma com aluno elegível | GP | Ficha da turma › progressão | "Elegível: concluir no fluxo acadêmico", sem botão de emitir certificado. ℹ️ Não é bug (fora do escopo) | — |
| A08-36 | — | ADM | Alunos › Cadastrar por lote › baixar o modelo › preencher 1 linha (Nome, País, Tipo e Número do documento; "Número" do endereço vazio) › importar | **Hoje:** a ficha fica **sem documento**. Esperado: com o documento | Bug (#36) |
| A08-37 | Modelo com "Recebe comunicações" vazio | ADM | Importar e abrir a ficha › Editar dados | Hoje: "Recebe comunicações" marcado | [PO] (#37) |
| A08-38 | (a) Planilha com Nome, Sobrenome, País e E-mail; (b) o arquivo do A08-36 (sem e-mail) | ADM | Importar cada arquivo duas vezes | (a) 2ª vez: "0 de 1 aluno(s) cadastrado(s)" e "1 linha(s) ignorada(s)…: Já cadastrado como … mesmo nome e e-mail. A linha não foi importada." (b) Hoje **duplica** o aluno, porque o documento foi perdido pelo bug #36 e não há outra chave; esperado: ignorar pela chave do documento | Bug (#36) |
| A08-39 | — | ADM | Importar um .csv; um XLSX sem a coluna País; uma linha com País "Narnia" | CSV: "Não foi possível ler o arquivo. Use um .xlsx válido.". Sem País: "Cabeçalho inválido…". Narnia: erro na linha "País não reconhecido" | — |
| A08-40 | — | SEC, FIN | Abrir Alunos; chamar `/api/alunos/modelo` pela URL | Sem o botão "Cadastrar por lote"; o modelo responde "Apenas administrador." | — |
| A08-41 | FIN sem a concessão de exportação | FIN, depois ADM | Alunos com um filtro aplicado | FIN: sem "Exportar planilha". ADM: "Exportar planilha (filtros aplicados)" baixa XLSX com Código, Nome, Situação, País e Turma | — |
| A08-42 | PC-5 (CSV com e-mail vazio em 1 linha) | ADM | Configuração › Preparação de migração › ler o arquivo › mapear › preparar com chave "QA-1"; preparar de novo com a mesma chave | Lote criado "Com pendências"; linha com EMAIL_AUSENTE. A 2ª preparação devolve o mesmo lote, sem duplicar | [DEV] |
| A08-43 | Lote do A08-42 | ADM | Detalhe do lote › Ensaiar cadastro › Aplicar | Linha com pendência: "Bloqueado" com o motivo; completa: "Aplicado". Aluno criado sem WhatsApp e sem comunicações. Registrar: aluno sem código `A-` | [DEV] [PO] (#43) |
| A08-44 | Lote CADASTRO com o e-mail de um aluno já cadastrado | ADM | Ensaiar | "Bloqueado": "E-mail ou documento já existe sem mapa de origem; exige conferência humana." | [DEV] |
| A08-45 | — | SEC, FIN | Abrir `/configuracao/migracao` pela URL | Redireciona para "Acesso negado" | — |
| A08-46 | Linha FINANCEIRO_HISTORICO preparada | FIN, depois FIN-2 | Financeiro › "Conferir conciliação da migração" › linha › propor; FIN tenta decidir; FIN-2 decide | FIN: sem botão de decidir (ou "A decisão exige outro usuário financeiro."); FIN-2 aprova ou rejeita | [DEV] |
| A08-47 | — | ADM, FIN, SEC | `/empresas` | ADM e FIN: lista. SEC: "Acesso negado" | — |
| A08-48 | — | FIN | Nova empresa (nome, país, dia de vencimento 29) › salvar; corrigir para 10; inativar | Dia 29 recusado (máximo 28); salva com 10; inativar pede confirmação | — |
| A08-49 | Empresa criada; matrícula nova com pagador "Empresa (B2B)" e o mesmo nome | VEN, depois FIN | Concluir a matrícula; FIN abre a ficha da empresa | "Colaboradores (0)": "Nenhum contrato individual vinculado…" | [PO] (#52) |
| A08-50 | Empresa com fatura FECHADA antiga (se houver) | FIN | Ficha da empresa › faturas | Aviso "A cobrança de empresas (fatura B2B) está desligada…"; sem "Pagar"; "Cancelar" disponível. ℹ️ Não é bug (D9) | — |

## Testes existentes por módulo

Contagem de arquivos no repositório (unitário = `*.test.ts` sem `.int`; integração = `*.int.test.ts`):

| Módulo | Unitários | Integração | Observação |
|---|---|---|---|
| `src/server/alunos` | 8 | 2 | Dedup, filtros, escopo da lista, movimentação, vencimento; **sem teste do conflito "Número"/documento** |
| `src/app/(app)/alunos/**` | 21 | 0 | SSR e interação da ficha, movimentações, portal da equipe, créditos |
| `src/server/portal-aluno` | 9 | 16 | Identidade, idempotência, envio Resend, concorrência, sessão capturada, rate-limit, entregas e guardrails |
| `src/app/portal-aluno/**` | 12 | 0 | Ativação, entrar, recuperar, reposições, resultados |
| `src/app/api/portal-aluno/**` | 5 | 1 | Rotas, cron, vídeo (CT03) |
| `src/app/(portal)` | 1 | 0 | Página legada |
| `src/app/certificado` | 0 | 0 | **Sem teste** |
| `src/server/lgpd` | 1 | 1 | Script de anonimização |
| `src/server/preferencias` · `src/app/(app)/preferencias` | 0 · 0 | 1 · 0 | Backstop SQL do fuso |
| `src/server/empresas` · `src/app/(app)/empresas` | 4 · 3 | 3 · 0 | B2B, fatura desligada, idempotência |
| `src/server/migracao` | 9 | 13 | Preparação, cadastro, vínculo (adversariais), conciliação, presença, múltiplas participações |
| `src/app/(app)/configuracao/migracao` · `financeiro/migracao` | 8 · 6 | 0 · 0 | Formulários e SSR |
| `src/app/(app)/secretaria/envios-portal` | 2 | 0 | Fila e feedback |
| `src/server/uploads` · `api/files` · `api/upload` | 1 · 1 · 1 | 1 · 0 · 0 | Autorização por objeto |
| `src/app/api/alunos` | 2 | 0 | Importar e modelo |
| `e2e/` (Playwright) | — | — | Só `login.spec.ts` e `permissoes.spec.ts` (inclui "Vendedor não vê a lista de alunos"); **nenhum E2E do portal, empresas ou migração** |

Nenhum teste foi executado nesta auditoria (regra do AGENTS.md). As contagens comprovam só a existência dos
arquivos, não aprovação.
