# Auditoria 09: Configuração, Home, interface e ambiente UAT

> Auditoria código × documentação, somente leitura, feita em 21/10/2026 na branch `qa/auditoria-e-onboarding`
> (= `main` + kit de QA). Precedência: SPECs (`docs/specs/*.md`) > doc 37 > doc 41 / quadro de entregas > docs 04, 06,
> 09, 31. Regra: especificação não comprova implementação. Toda referência é `arquivo:linha` no estado atual.
>
> Status usados: **Conforme** (código faz o que a fonte diz) · **Parcial** · **Divergente** · **Não implementado** ·
> **Corrigido** (achado antigo, do doc 42/43 ou do quadro, que o código já resolve) · **A confirmar** (depende de PO ou dev).

## Resumo

**Contagem da tabela de achados (45 achados):** Conforme 10 · Corrigido 6 · Parcial 15 · Divergente 10 · Não implementado 2 · A confirmar 2.

Números do ambiente:

- **474 migrations** (primeira `20260618184248_init`, última `20261020520000_q165_fotografia_origem_correcao_aula`).
- **819 arquivos de teste unitário**, **328 `*.int.test.ts`** e **2 specs Playwright** (`e2e/login.spec.ts`, `e2e/permissoes.spec.ts`).
- **6 rotas protegidas por `CRON_SECRET`**: 4 agendadas pelos composes, 1 sem agendador e 1 de monitoramento.
- **201 páginas**, **24 `loading.tsx`**, **21 `error.tsx`** e 1 `global-error.tsx`. O doc 42 contava 2 `loading.tsx` e nenhum `error.tsx`.

**Os 5 achados mais importantes para o UAT:**

1. **Nenhuma tela muda o status da turma (bloqueador B1, confirmado).** `alterarStatusTurma` existe
   (`src/server/turmas/acoes.ts:260`), mas nenhum arquivo de `src/app` ou `src/components` a chama. A turma nasce
   `PLANEJADA` (`src/server/turmas/acoes.ts:145`). A matrícula manual só lista turmas `ABERTA`
   (`src/server/matricula/consultas.ts:49`) e recusa as outras (`src/server/matricula/validacao.ts:62`). Só o cron passa a
   turma a `EM_ANDAMENTO` (`src/server/agenda/inicio-turmas.ts:20`). `CONCLUIDA` não se alcança pela interface.
2. **O pagamento simulado está desligado no código, seja qual for a variável.** `pagamentoSimuladoHabilitado()` devolve
   `false` fixo (`src/server/financeiro/gateway.ts:42-45`). `PAGAMENTO_SIMULADO=1`, citado no `.env.example`, no `SETUP.md`
   e nos dois composes, não tem efeito: `/pagar/[token]` não mostra o botão de pagar
   (`src/app/pagar/[token]/page.tsx:51`), e o webhook simulado responde 404
   (`src/app/api/pagamentos/webhook/simulado/route.ts:13-15`).
3. **O seed não basta para rodar uma matrícula de ponta a ponta.** O que falta:
   - fuso dos países: os 3 ficam em `America/Sao_Paulo` (`prisma/seed.ts:92-101` + default em `prisma/schema.prisma:904`);
   - regras de entrada das ofertas: `formaAgenda`, `taxaPreviaAssinatura` e `adiantamentoHoraExigido` ficam nulos (`prisma/seed.ts:141-143`);
   - política de comissão, que é obrigatória (`src/server/financeiro/politica.ts:24`);
   - a configuração operacional (registro `ConfiguracaoOperacional` "escola");
   - calendário institucional, regra de avaliação, grade, janela de admissão, turmas e modelo contratual.

   Os preços só existem para o produto Regular (`prisma/seed.ts:148-161`).
4. **As alçadas de desconto dos dois seeds não valem.** Os dois gravam só `limiteDescontoPct`
   (`prisma/seed.ts:51`, `prisma/seed-qa.ts:92`), campo legado que nenhuma regra em produção lê. A alçada efetiva vem
   de `limiteDescontoTaxaPct` e `limiteDescontoMensalidadePct` (`src/server/financeiro/politica.ts:5-15`); vazio = 0% de
   autonomia (`src/server/acesso/schema.ts:5`). O "VEND-A 10%" do roteiro (`docs/qa/03-roteiro-testes-manuais.md:87`) é,
   na prática, 0%. O seed também não define `gerenteComercialId`, então a Home de um Gerente Comercial puro sai com
   ranking e equipe vazios (`src/server/home/consultas.ts:133`).
5. **Editar a moeda de um país deixa as ofertas incoerentes.** `editarPais` grava a nova `moedaLocal`
   (`src/server/paises/acoes.ts:110`), mas não atualiza `ProdutoPais.moeda` nem os preços. A preparação da contratação
   então recusa a oferta: "Confira a oferta e a moeda do país antes de preparar."
   (`src/server/matricula/preparacao-comercial-tx.ts:50`). `alternarProdutoPais` também mantém a moeda antiga ao
   religar o produto (`src/server/paises/acoes.ts:30`).

## Telas de Configuração

**Quem entra:**

- O layout aceita ADM, GP, GC e SEC (`src/app/(app)/configuracao/layout.tsx:11`).
- As abas por papel vêm de `src/app/(app)/configuracao/_componentes/tabs.ts:11-32`.
- O ADM passa em qualquer guard (`src/server/_shared/sessao.ts:120-123`).
- O item "Configuração" do menu aparece só para ADM, GP e SEC (`src/lib/nav.ts:73-77`). O GC chega à aba CRM só pela
  URL ou pelo link "Definir metas" de Relatórios.

| Tela | Campos | Validações | Quem edita | Ciclo de status | Efeitos colaterais | arquivo:linha |
|---|---|---|---|---|---|---|
| **Países** `/configuracao/paises` | nome, código ISO, moeda, DDI, fuso, idioma, tipos de documento (nome + validador da lista `cpf`, `cedula_cr`, `curp`, `dni_ar`, `dui_sv`, `passaporte`); por país, checkbox "catálogo habilitado" para cada produto | ISO de 2 letras, gravado em maiúsculas; moeda de 3 letras; DDI `+NNN`; fuso IANA real; nomes de documento distintos; ISO único | ADM | RASCUNHO → ATIVO → PAUSADO ⇄ ATIVO → ENCERRADO. A UI esconde a volta de ENCERRADO; o servidor aceita qualquer transição. Ativar exige moeda, ≥ 1 tipo de documento e ≥ 1 preço (a contagem inclui preços inativos) | Editar **não recria** os tipos de documento: preserva os IDs, atualiza os existentes, cria os novos e só apaga os que não têm aluno; recusa apagar tipo em uso. Mudar a moeda **não propaga** para ofertas nem preços. Ligar ou desligar produto grava `ProdutoPais` e evento. Encerrar pede `ConfirmarAcao` com digitação do nome | `src/server/paises/schema.ts:14-35`; `src/server/paises/acoes.ts:19-44` (oferta), `:82-128` (editar), `:137-171` (status; checklist em `:147-153`); `src/server/paises/tipos-documento.ts:7-26`; `src/app/(app)/configuracao/paises/PaisesPainel.tsx:39-48` (transições), `:253-263` (confirmação); `PaisFormulario.tsx:15` (validadores) |
| **Catálogo**: Idiomas | nome; ativar/desativar | nome obrigatório (com o campo vazio, "Adicionar" não faz nada) | GP e ADM | ativo/inativo | Desativar pede confirmação, mas **não tem efeito**: produto, nível e matrícula continuam listando o idioma | `src/server/catalogo/acoes.ts:49-99`; `IdiomasPainel.tsx:36`, `:133-146`; `src/server/matricula/consultas.ts:33-39` |
| **Catálogo**: Modalidades | nome, segmento, frequência, horas/aula, duração/nível, aulas/nível, mínimo para abrir | horas > 0; mínimo ≥ 1; aulas/nível não muda por aqui (vai para Acadêmico › Quantidade de aulas) | ADM | sem status | Editar frequência e horas não confere as turmas existentes; o evento só registra nome e mínimo | `src/server/catalogo/schema.ts:22-30`; `src/server/catalogo/acoes.ts:101-168` (trava de aulas em `:140`) |
| **Catálogo**: Níveis | idioma, código, ordem | idioma existente; ordem ≥ 0 | GP e ADM | sem status | nenhum | `src/server/catalogo/acoes.ts:170-196`; `NiveisPainel.tsx:28` |
| **Catálogo**: Produtos | idioma × modalidade | par único | ADM | sem status | nenhum | `src/server/catalogo/acoes.ts:198-228` |
| **Catálogo**: Preços | país, produto, tipo de cobrança (MATRÍCULA, MENSALIDADE, HORA_PARTICULAR, MATERIAL, CERTIFICADO; multa fora da lista), valor, versão do estudo | valor > 0; moeda vem do país; produto e país existentes. Não exige produto habilitado no país | ADM | ativo/inativo; um ativo por país + produto + modalidade + tipo | Novo preço inativa o ativo anterior (é a "versão"); reativar inativa o irmão ativo; desativar pede confirmação | `src/server/catalogo/schema.ts:51-58`; `src/server/catalogo/acoes.ts:231-343`; `PrecosPainel.tsx:162`, `:255-273` |
| **Catálogo**: Regras de entrada por oferta | forma de agenda (Turma / Particular com grade fixa / Particular flexível), exigir taxa antes da assinatura, adiantamento de hora, motivo | motivo de 5 a 2.000 caracteres; versão esperada (controle de concorrência) | ADM | a versão sobe a cada gravação | Sem essas regras, a preparação e a assinatura falham (ver Dados mínimos) | `src/server/catalogo/entrada-oferta.ts:9-29`; `EntradasOfertas.tsx:26-52` |
| **Turmas** `/configuracao/turmas` | nome, modalidade, nível, professor, dias da semana, início e fim (HH:MM), data de início, data final de referência, capacidade, rolling | nº de dias = frequência da modalidade; duração = horas/aula da modalidade; fim depois do início; capacidade ≥ 1; na edição, capacidade ≥ alocações + reservas | GP e ADM (SEC não) | PLANEJADA → ABERTA → EM_ANDAMENTO → CONCLUÍDA, **sem botão na tela**; EM_ANDAMENTO só pelo cron | Criar dispara o gatilho que vincula a regra de avaliação aprovada do nível (só com data de início futura). Com agenda publicada, editar professor, nível, datas ou horários é recusado. O link "Preparar grade" leva a `/academico/grades/nova` | `src/server/turmas/schema.ts:37-64`; `src/server/turmas/acoes.ts:36-60`, `:103-162`, `:164-232`, `:260-300`; `prisma/migrations/20260913040000_regra_inicial_turma/migration.sql:6-20`; `TurmasPainel.tsx:170-207` |
| **Turmas**: importar e modelo | planilha .xlsx: Modalidade\*, Nível\*, Professor, Dias\*, Início\*, Fim\*, Data de início\*, Data final, Capacidade, Rolling | até 5 MB; a mesma validação da tela, linha a linha (aplica as boas e lista as ruins) | só ADM | todas nascem PLANEJADA | nenhum | `src/app/api/turmas/importar/route.ts:57-58`, `:64-73`, `:241`; `src/app/api/turmas/modelo/route.ts:32`; `src/server/turmas/importacao.ts:13-25` |
| **Usuários** `/configuracao/usuarios` | nome, e-mail, senha, papéis (inclui ALUNO), gerente comercial, desconto máximo na taxa e na mensalidade (%), limite legado, permissões específicas (7 capacidades) | e-mail válido e único; ≥ 1 papel; senha ≥ 6 (na edição, vazia mantém a atual); limites de 0 a 100; gerente = outro usuário GC ativo | ADM; aumentar a própria alçada ou mexer no próprio papel de ADM exige outro ADM | ativo/inativo; ninguém desativa a si mesmo | Desativar pede `ConfirmarAcao` e corta o acesso na hora (os papéis são relidos do banco a cada página) | `src/server/acesso/schema.ts:11-32`; `src/server/acesso/acoes.ts:24-36`, `:38-78`, `:80-143`, `:145-168`; `UsuarioFormulario.tsx:99`, `:127`; `UsuariosPainel.tsx:165-176`; `src/lib/capacidades.ts:1-5` |
| **Operação** `/configuracao/operacao` | fuso oficial da escola, exigir a 1ª mensalidade, suspender lembretes (horas), prazo inicial de reserva (min); prazos do portal (sessão, convite, recuperação, validação de e-mail); prazos de reposição por gravação; link para avisos do diário (prazo de regularização e intervalo) | fuso IANA; horas de 1 a 720; prazos inteiros positivos | ADM | registro único `escola`, criado no primeiro salvar | Mudar o fuso com pausa ou retomada já aplicada é recusado. Sem os prazos do portal, o portal não emite link nem sessão. Sem o prazo de reserva, nenhuma reserva nasce | `src/server/operacao/acoes.ts:10-32`; `src/app/(app)/configuracao/operacao/page.tsx:9-12`; `src/server/portal-aluno/identidade.ts:62`; `src/server/matricula/reserva-vaga-tx.ts:28` |
| **Preparação de migração** `/configuracao/migracao` | arquivo CSV/XLSX, mapeamento de colunas, lotes, ensaio e aplicação de vínculo, presença histórica | ao menos o ID de aluno mapeado (o aviso só aparece depois de enviar) | ADM (o papel é reconferido na transação) | lote preparado → ensaio → aplicação | Registra a fotografia da origem; não cria aluno, matrícula nem presença sem as etapas próprias | `src/app/(app)/configuracao/migracao/page.tsx:11-18`; `src/server/migracao/acoes.ts:21`, `:34-36` |
| **Modelos contratuais** `/configuracao/contratos` | título, aplicação, campos variáveis, seções, assinaturas; decisão (publicar ou rejeitar) | schema do conteúdo; decisão por pessoa diferente de quem preparou | SEC prepara; ADM decide | versão preparada → publicada ou rejeitada | Só modelo publicado serve para contrato. A página da lista **não tem guard de página**: GP e GC, que passam no layout, recebem a tela de erro da área em vez de "acesso negado" | `src/app/(app)/configuracao/contratos/page.tsx:6-8`; `src/server/contratos/modelos.ts:10-14`, `:17-21`, `:47-48` |

## Home por papel

**Como a variante é escolhida** (`src/app/(app)/home/page.tsx:17-53`):

- ADM ou GC: Home do Gerente.
- Senão, PROFESSOR: Home do Professor.
- Demais papéis: Home de atalhos.

O usuário só ALUNO é desviado para `/portal` antes de chegar à Home (`src/server/_shared/sessao.ts:182-185`). Quem
tem GC e PROFESSOR vê só a Home do Gerente.

| Papel | Blocos | Fonte | arquivo:linha |
|---|---|---|---|
| ADM | Home do Gerente, sem filtro de escopo:<br>• cards Leads hoje, Conversão, Matrículas ativadas no mês e Recebido no mês (por moeda);<br>• meta de matrículas do mês, quando houver;<br>• faixa "Alertas de SLA" (lead NOVO há mais de 60 min, valor fixo no código);<br>• faixa "check-in vencido";<br>• Ranking de vendedores (matriculados por dono, todos os vendedores ativos);<br>• Funil por etapa e Equipe.<br>Os alertas não são clicáveis, e a nota "refinar (P10)" aparece na tela | `dadosHomeGerente` | `src/server/home/consultas.ts:17`, `:90-162`; `src/app/(app)/home/HomeGerente.tsx:26-35`, `:38-56`, `:59-93`, `:74` |
| Gerente Comercial | Os mesmos blocos, filtrados pelo escopo comercial. Ranking e equipe trazem só os vendedores cujo `gerenteComercialId` é ele; como o seed não preenche esse campo, ficam vazios | `dadosHomeGerente` + `escopoComercialAtual` | `src/server/home/consultas.ts:93-94`, `:132-134` |
| Professor | • Faixa de check-ins vencidos.<br>• "Próxima aula experimental".<br>• "Experimentais para check-in": Compareceu registra direto; Faltou pede `ConfirmarAcao`.<br>• "Minhas turmas": rótulo, dias e horário, nº de alunos ativos.<br>Não há "próxima aula" das turmas regulares nem agenda de Hoje/Amanhã | `dadosHomeProfessor` | `src/server/home/consultas.ts:25-87`; `src/app/(app)/home/HomeProfessor.tsx:47-66`, `:87-97`, `:144-164` |
| Vendedor | Home de atalhos (a Home do Vendedor do doc 09 saiu) | `navParaPapeis` | `src/app/(app)/home/page.tsx:36-53`; `docs/09-fase0-telas.md:5-8` |
| Gerente Pedagógico | Home de atalhos (Mudanças acadêmicas, Diário, Alunos, Permutas, Configuração...) | `navParaPapeis` | `src/app/(app)/home/page.tsx:37`; `src/lib/nav.ts:12-77` |
| Secretaria Acadêmica | Home de atalhos | idem | idem; `docs/09-fase0-telas.md:533-534` ("ainda usa a Home genérica") |
| Financeiro | Home de atalhos | idem | idem |

## Estados de interface e mobile

| Padrão | Existe? | Onde | Achados do doc 42 corrigidos? |
|---|---|---|---|
| Estado vazio | Sim: `EstadoVazio`, `EstadoVazioLinha` e a variante `bloco` com ação, em 200 arquivos de tela | `src/components/EstadoVazio.tsx:1-30`; trava em `src/app/estados-vazios.test.ts` | Corrigido em geral (doc 42 §5.3; PR #134). Em Configuração, Países, Turmas, Contratos (com ação), Ofertas e Níveis usam o componente. Ainda aberto: "Adicionar" com nome vazio em Idiomas e Níveis não dá retorno (`IdiomasPainel.tsx:36`, `NiveisPainel.tsx:28`) |
| Erro de rota | Sim: 21 `error.tsx` com `ErroArea` (título, "Tentar de novo" e volta; nunca mostra `error.message`), um `global-error.tsx` e 4 `not-found.tsx` | `src/components/ErroArea.tsx:11-36`; `src/app/(app)/configuracao/error.tsx:15-18` | Corrigido (doc 42, problema 1). Exceção: `/configuracao/contratos` mostra esse erro em vez de "acesso negado" para GP e GC |
| Carregando | Sim: 24 `loading.tsx` com esqueleto | `src/components/Esqueleto.tsx`; `src/app/(app)/configuracao/loading.tsx` | Parcial. O doc 42 contava 2. O quadro (linha da #174) listava `matriculas/nova`, `configuracao/whatsapp` e `/portal` sem `loading.tsx`; o de `configuracao/whatsapp` já existe |
| Feedback de ação (erro separado de sucesso) | Sim: `useAcaoCliente` + `FeedbackAcao` | `src/components/FeedbackAcao.tsx`; `src/app/(app)/configuracao/operacao/OperacaoFormulario.tsx:14`, `:30` | Corrigido em Operação, prazos do portal e reposições (doc 42, Operação #1, Alta) |
| Confirmação de ação destrutiva | Sim: `ConfirmarAcao` (`alertdialog`, foco inicial em "Voltar", conferência e digitação opcionais, erro dentro do diálogo); lista fechada de 32 ações | `src/components/ConfirmarAcao.tsx:10-40`; `src/app/confirmacoes-mapa.ts` | Corrigido: encerrar país (com digitação do nome), desativar usuário, preço e idioma, "Faltou" no check-in (`PaisesPainel.tsx:253`; `UsuariosPainel.tsx:165`; `PrecosPainel.tsx:255`; `IdiomasPainel.tsx:133`; `HomeProfessor.tsx:144`) |
| Shell mobile (menu em gaveta) | Sim: `BarraMobile` abaixo de 768 px; `Drawer` com `inert`, foco preso e Escape; Sidebar `hidden md:flex`; `main` com `min-w-0 p-4 md:p-8` | `src/components/BarraMobile.tsx:12-45`; `src/components/Drawer.tsx:9-53`; `src/components/Sidebar.tsx:131`; `src/app/(app)/layout.tsx:16-22` | Corrigido (doc 42, /home #1 e §5.8 A1) |
| Bottom sheet | Sim: `Modal folha`, ancorado embaixo no celular e centralizado a partir de `sm`; usado só na inbox | `src/components/Modal.tsx:28`, `:48-60`; `src/app/(app)/inbox/AcoesAtendimento.tsx:106`, `:151` | Padrão novo. Configuração não usa bottom sheet |
| Tabela larga no celular | Sim: `overflow-x-auto` nas 7 tabelas de Configuração (Países, Usuários, Preços, Produtos, Modalidades, Turmas, Idiomas) | ex.: `src/app/(app)/configuracao/paises/PaisesPainel.tsx` | Corrigido (doc 42 §5.8 A2) |
| Diálogo do formulário de turma | Sim: `role="dialog"`, Escape e confirmação ao descartar; dias da semana com `role="group"` e `aria-pressed` | `src/app/(app)/configuracao/turmas/TurmasPainel.tsx:54-73`, `:105`; `TurmaFormulario.tsx:254-261` | Corrigido (doc 42, Turmas #1, #2 e #6). Aberto: tabela de turmas sem busca, filtro e paginação (#3) |
| Fuso validado | Sim: `CampoFuso` + `fusoIanaValido` no país, na escola e nas preferências | `src/server/paises/schema.ts:29`; `src/server/operacao/fuso.ts:8-16` | Corrigido (doc 42, Países #2) |
| Usuários: senha e busca | Não | `src/app/(app)/configuracao/usuarios/UsuarioFormulario.tsx:99` (sem `autoComplete`); `UsuariosPainel.tsx` sem busca | **Aberto** (doc 42, Usuários #1 Alta e #3) |
| Países: rótulos dos validadores e pré-requisitos de "Ativar" | Não | `PaisFormulario.tsx:15`, `:151-153` (slugs crus); botão "Ativar" sempre habilitado | **Aberto** (doc 42, Países #4 e #5) |
| Preços: separar ativos do histórico | Não | `PrecosPainel.tsx` (uma lista só) | **Aberto** (doc 42, Catálogo #5) |
| Regras de entrada: busca e filtro | Não | `EntradasOfertas.tsx:48-52` (um formulário por oferta, todos abertos) | **Aberto** (doc 42, Catálogo #1) |
| Home: alertas clicáveis e Home de trabalho para SEC, FIN e GP | Não | `HomeGerente.tsx:38-56`; `home/page.tsx:36-53` | **Aberto** (doc 42, /home #6 e #7) |

Situação geral da auditoria de UX (doc 43 §7, remedição de 13/10):

- Achados Alta: 79 resolvidos, 26 parciais e 40 abertos, de 145.
- Média e Baixa: de 58,9% a 66,8% abertos, conforme a semente da amostra.

## Ambiente UAT

O UAT é o único ambiente. Cada merge na `main` dispara o deploy no Coolify, que roda `prisma migrate deploy` antes de
subir o app e **não espera o CI** (`docs/planejamento/quadro-entregas.md:269`). O compose do UAT é
`docker-compose.coolify.yml`.

### Variáveis de ambiente

| Variável | Obrigatória? | Vazia = ? | Integração afetada |
|---|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | Sim (o compose recusa subir) | O deploy falha. A senha precisa ser hex, porque entra crua na URL | Banco (`docker-compose.coolify.yml:23-25`) |
| `DATABASE_URL` | Sim (montada pelo compose) | O app não conecta; `/api/ready` responde 503 | Banco (`docker-compose.coolify.yml:64`) |
| `AUTH_SECRET` | Sim | O compose recusa subir; sem ela não há sessão | Login (`docker-compose.coolify.yml:65`) |
| `DOMINIO_APP` → `NEXTAUTH_URL` | Sim | O compose recusa subir. `NEXTAUTH_URL` também é a base do link de pagamento (`src/server/financeiro/gateway.ts:24-26`) | Login e links |
| `AUTH_TRUST_HOST` | Fixa em `"true"` no compose | — | Auth.js atrás do Traefik |
| `CRON_SECRET` | Sim no compose; opcional em dev | As 6 rotas de cron respondem 503 | Régua, início de turmas, reservas, despacho, portal, avisos (`src/app/api/whatsapp/cron/route.ts:38-39`) |
| `WHATSAPP_LIVE` | Não | **Modo simulado**: tudo vira intenção `SIMULADA` e nada sai. Só `"1"` liga o envio real | WhatsApp (`src/server/whatsapp/despachante.ts:166`) |
| `MOTOR_IMAGE` | Sim (o compose recusa subir) | O deploy falha | Motor Baileys |
| `MOTOR_URL`, `MOTOR_API_KEY`, `MOTOR_WEBHOOK_SECRET` | Sim no compose (chave e segredo com ≥ 32 caracteres) | As ações que falam com o motor (conectar número, sessão, envio) falham com `SEM_CONFIG` | Motor (`src/server/whatsapp/motor/config.ts:12-19`) |
| `ANTHROPIC_API_KEY` | Não | **Provedor local "simulado"**, sem rede e com custo 0 | Aria (`src/server/aria/provedor/index.ts:10-14`) |
| `PAGAMENTO_SIMULADO` | Não | **Sem efeito**: o código desliga o pagamento simulado sempre (`src/server/financeiro/gateway.ts:42-45`) | `/pagar/[token]` e webhook simulado |
| `RESEND_API_KEY`, `EMAIL_INSTITUCIONAL_REMETENTE` | Não | Nenhum e-mail sai (`ErroConfiguracaoEmail`) | Portal do aluno e avisos de agenda por e-mail (`src/server/email/resend.ts:25-31`) |
| `EMAIL_PORTAL_ENVIO_ENABLED` | Não (padrão `false`) | O cron do portal responde `{executou:false}` | E-mails de convite, recuperação e troca de e-mail (`src/app/api/portal-aluno/envios/cron/route.ts:12`) |
| `PORTAL_ALUNO_URL_PUBLICA` | Só com o envio do portal ligado | O envio do portal falha por configuração | Links dos e-mails (`src/server/portal-aluno/envio-resend.ts:27`) |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY`, `DRIVE_ORGANIZACAO_ID` | Não | Gravações indisponíveis no player | Drive (`src/server/gravacoes/credenciais.ts:50-52`, `:92`) |
| `GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_*` | Não | Publicação e fixação de revisão indisponíveis | Drive (`src/server/gravacoes/credenciais-publicacao.ts:21`) |
| `CONTINUIDADE_MENSAL_EMISSAO_ENABLED` | Não (padrão `false`) | A rota responde `{executou:false, motivo:"emissao_desligada"}` | Emissão mensal (`src/app/api/financeiro/continuidade/cron/route.ts:8`) |
| `COMUNICACOES_AGENDA_ENVIO_ENABLED` | Não (padrão `false`) | A rota responde `{executou:false}`, e o despachante retém os avisos | Avisos de agenda (`src/server/comunicacoes-agenda/envio-gate.ts:4`) |
| `COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED` | Não (padrão `false`) | Os avisos de quantidade de aulas (Q38) não chegam a nenhum provedor | Avisos Q38 |
| `SOURCE_COMMIT` → build-arg `GIT_SHA` | Não | `/api/health` responde `sha: "desconhecido"`. Exige "Include Source Commit in Build" ligado no Coolify | Rastreio da versão (`docker-compose.coolify.yml:56`; `src/app/api/health/route.ts:17-19`) |
| `QA_SEED_PASSWORD` | Só para `npm run seed:qa` | O script aborta sem gravar | Usuários de QA (`prisma/seed-qa.ts:20-27`) |
| `TZ` | Não é fixada no compose | O servidor roda em UTC; as datas da tela usam o fuso da escola | Datas civis (o CI testa UTC e `America/Sao_Paulo`) |

### Crons

Todas as rotas usam o header `x-cron-secret: <CRON_SECRET>`. Sem segredo configurado, respondem 503; com segredo
errado, 401.

| Rota | Método | Segredo | Agendamento no UAT | O que faz | Como disparar à mão (passo do dev) |
|---|---|---|---|---|---|
| `/api/whatsapp/cron` | POST | `CRON_SECRET` | serviço `cron`, a cada 300 s (`docker-compose.coolify.yml:147-158`) | Vence reservas particulares, **inicia as turmas pela agenda**, reconcilia o acesso por vencimento e por aulas, roda a régua de cobrança, o fechamento de comissões, os fechamentos pendentes, as mensagens órfãs da linha comercial, os eventos do motor, os lembretes de tarefa, os alertas de SLA, a Aria e o despacho (`src/app/api/whatsapp/cron/route.ts:46-73`) | `curl -sS -X POST -H "x-cron-secret: $CRON_SECRET" http://app:3000/api/whatsapp/cron` no terminal do serviço `cron` no Coolify |
| `/api/whatsapp/despacho` | POST | `CRON_SECRET` | `cron-despacho`, a cada 60 s | Drena a fila (mensagens agendadas) | mesmo formato |
| `/api/portal-aluno/envios/cron` | POST | `CRON_SECRET` | `cron-portal-envios`, a cada 60 s | E-mails do portal (só com a flag em `true`) | mesmo formato |
| `/api/agenda/avisos/cron` | POST | `CRON_SECRET` | `cron-avisos-agenda`, a cada 300 s | Avisos de alteração de agenda (só com a flag em `true`) | mesmo formato |
| `/api/financeiro/continuidade/cron` | POST | `CRON_SECRET` | **Nenhum** (`docker-compose.coolify.yml:105-107`) | Emissão mensal recorrente (só com a flag em `true`) | Scheduled Task do Coolify ou `curl` manual |
| `/api/whatsapp/health` | GET | `CRON_SECRET` | monitor externo (UptimeRobot), não liveness | Saúde do canal: 200 saudável, 503 com os motivos | `curl -H "x-cron-secret: …"` |

### Health, ready e logs

- **`/api/health`** (GET/HEAD, público): liveness, sem banco. Responde `{ ok, sha, timestamp }`
  (`src/app/api/health/route.ts:22-27`). O quadro de 13/10 diz que a rota não expõe o SHA; isso mudou com a #165. É por
  ela que o QA anota a versão testada.
- **`/api/ready`** (GET/HEAD, público): `SELECT 1` com timeout de 3 s. Responde 200 `{ready:true}` ou 503
  `{ready:false}`, sem detalhe do erro (`src/app/api/ready/route.ts:13-41`). É o healthcheck do Coolify, chamado em
  `127.0.0.1` (`docker-compose.coolify.yml:122`). O `docker-compose.prod.yml` não tem healthcheck no app.
- **Logs:** aba "Logs" do Resource no Coolify.
  - Os serviços de cron imprimem `cron tick <status>`, `despacho tick …` etc. (`docker-compose.coolify.yml:154`, `:167`).
  - Etapa do cron que falhou: `[cron <rótulo>] falhou:` (`src/app/api/whatsapp/cron/route.ts:30`).
  - Falha do ready: `[api/ready] banco/Prisma indisponível:`.
- **Backup:** `scripts/backup-producao.sh`, cron diário às 03:15, descrito no `SETUP.md` §Backup. Durante o backup, um
  poll de `/api/whatsapp/health` pode receber um 503 isolado.

### CI

- **Em PR para a `main` e em push na `main`** (`.github/workflows/ci.yml:5-9`), quatro jobs:
  - `typecheck`: `tsc --noEmit` (`:29-50`);
  - `lint`: **`eslint . --max-warnings 40`** (`:64-67`; o teto é travado por `src/test/ci-workflow.test.ts:11-18`);
  - `test`: testes unitários em dois fusos, UTC e `America/Sao_Paulo` (`:69-94`);
  - `build`: build de produção (`:96-117`).

  Esse CI não roda `*.int.test.ts` nem Playwright.
- **Integração** (`.github/workflows/integracao.yml`): toda noite às 06:17 UTC e sob demanda, em 4 shards, cada um com
  Postgres 16 e `migrate deploy` do zero (`:6-10`, `:30-80`). Não roda em PR.
- O deploy no UAT **não espera** nenhum dos dois.

## Dados mínimos do UAT

A ordem garante que cada passo encontre o anterior pronto. "Seed" = `npm run seed`; "Seed QA" = `npm run seed:qa`.

Como rodar os seeds no container do Coolify **não está documentado**: o `runner` não tem `tsx`, e o serviço `migrate`
usa o estágio `builder`. É passo do dev.

1. **[DEV] Variáveis do Coolify.** As obrigatórias da tabela acima; `WHATSAPP_LIVE` vazio; flags de envio em `false`;
   "Include Source Commit in Build" ligado. Conferir `/api/ready` = 200 e anotar o `sha` de `/api/health`.
2. **[DEV] Seed principal.** Cria (`prisma/seed.ts:8-66`, `:78-171`; `prisma/seed-whatsapp.ts:12-49`):
   - 5 usuários com senha de dev conhecida e os contadores;
   - 3 países ATIVOS (CR/CRC, PA/USD, SV/USD), com 1 tipo de documento cada;
   - Português com 7 níveis, 7 modalidades e 7 produtos ofertados nos 3 países;
   - preços de MATRÍCULA e MENSALIDADE **só do Regular**;
   - templates do WhatsApp e a política de cobrança DESLIGADA.

   O bloco de catálogo é pulado se já existir algum idioma (`prisma/seed.ts:79-82`).
3. **[DEV] Seed QA.** 7 usuários de papel único (GP, GC, FIN, SEC, VEND-2, VEND-3, PROF-2), com a senha de
   `QA_SEED_PASSWORD` (`prisma/seed-qa.ts:35-98`).
4. **ADM, Configuração › Usuários.**
   - Trocar a senha dos 5 usuários do seed principal.
   - **Preencher "Desconto máximo na taxa" e "na mensalidade"** dos vendedores que o roteiro trata com limite (o seed não
     preenche).
   - Definir o **gerente comercial** dos vendedores. Sem isso, a Home do GC fica vazia e o escopo de equipe não funciona.
5. **ADM, Configuração › Operação.** Preencher:
   - fuso oficial da escola (ex.: `America/Costa_Rica`);
   - exigir ou não a 1ª mensalidade;
   - prazo de suspensão de lembretes e **prazo inicial de reserva**;
   - os 4 prazos do portal e os 2 de reposição;
   - em "avisos do diário", o prazo e o intervalo.

   Salvar cria o registro `escola`. Sem ele, reserva, preparação, calendário e portal falham.
6. **ADM, Configuração › Países.** Corrigir o **fuso** de CR, PA e SV (o seed deixa `America/Sao_Paulo`) e conferir o
   tipo de documento. Opcional: criar um "País QA" em rascunho para os testes de ciclo de status.
7. **ADM, Catálogo › Preços.** Cadastrar MATRÍCULA e MENSALIDADE de cada produto testado em cada país (e HORA_PARTICULAR,
   se o ciclo tiver particular). Deixar de propósito um par país × produto habilitado **sem** preço, para o teste negativo.
8. **ADM, Catálogo › Regras de entrada por oferta.** Para cada oferta usada:
   - forma de agenda (TURMA, para turma);
   - exigir ou dispensar a taxa antes da assinatura;
   - adiantamento de hora (particular).

   Sem isso, a preparação para em "Regras de entrada incompletas nesta preparação."
   (`src/server/secretaria/condicoes-entrada.ts:37`), e a assinatura não valida
   (`src/server/contratos/assinatura-estado.ts:26`).
9. **FIN ou ADM, Financeiro › Políticas de comissão.** Uma política vigente por país × produto usado. Publica quem é ADM,
   ou FIN/GC com a capacidade `comissao.configurar` (ação em `src/server/financeiro/acoes.ts:183-186`). Sem ela:
   "Configure a política de comissão desta oferta antes de matricular." (`src/server/financeiro/politica.ts:24`).
10. **GP, Acadêmico › Regras.** Publicar a regra de avaliação de cada nível usado e aprová-la (outra pessoa), **antes** de
    criar as turmas: o gatilho só vincula regra aprovada a turma com data de início futura
    (`prisma/migrations/20260913040000_regra_inicial_turma/migration.sql:12-17`).
11. **GP/ADM, Acadêmico › Calendário.** Preparar e aprovar o calendário institucional. Exige o fuso do passo 5
    (`src/server/agenda/calendario.ts:30`).
12. **GP, Configuração › Turmas.** Criar as turmas do roteiro com professor, horário compatível com a modalidade
    (Regular: 1 dia, 2 h) e data de início futura.
13. **GP, Acadêmico › Grades.** Propor e aprovar a grade de cada turma. É ela que gera os encontros PREVISTO; sem eles, a
    admissão acusa `AGENDA_NAO_PUBLICADA` (`src/server/matricula/admissao-turma.ts:23`).
14. **GP, Acadêmico › Admissões.** Configurar e aprovar a janela de admissão de cada turma. Sem ela: "Configure e aprove a
    janela de admissão antes de reservar." (`src/server/matricula/reserva-vaga-tx.ts:37`).
15. **[DEV] Status ABERTA** nas turmas usadas pela matrícula manual (B1): não há tela para isso. **[PO]** decidir se o
    caminho `/matriculas/nova` continua no escopo do ciclo ou se ele usa só `/oportunidades/[id]/contratacao`.
16. **SEC prepara, ADM decide (Configuração › Modelos contratuais).** Um modelo publicado por regime usado.
17. **ADM, Configuração › WhatsApp** (área 06): números de vendas e cobrança, política DESLIGADA, kill switch desligado.
18. **[DEV] Agendadores no ar.** Confirmar nos logs um `cron tick 200` a cada 5 min. Sem eles, a turma não passa a
    EM_ANDAMENTO e as reservas particulares não vencem.
19. **[PO] Pagamento online.** Com o simulado desligado no código, a baixa no UAT é só manual (Financeiro). Decidir se o
    cenário de `/pagar/[token]` sai do ciclo.

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Ciclo da turma | doc 09 §3 Turmas; doc 37 `turma.manter` | Planejada → Aberta → Em andamento → Concluída; só turma "Aberta com vaga" no seletor | `alterarStatusTurma` sem chamador na UI (`src/server/turmas/acoes.ts:260`); o seletor exige ABERTA (`src/server/matricula/consultas.ts:49`) | Divergente | Turma sempre "Planejada"; nenhuma turma aparece em `/matriculas/nova` até o dev mudar o status no banco |
| 2 | Início da turma | SPEC de agenda; doc 09 | A turma inicia no primeiro encontro | Cron `iniciarTurmasDaAgenda` (`src/server/agenda/inicio-turmas.ts:9-20`; `src/app/api/whatsapp/cron/route.ts:48`) | Conforme | Vira "Em andamento" até 5 min depois do 1º encontro, se o cron estiver no ar |
| 3 | Conclusão da turma | doc 09 | Concluída ao final | Só via `alterarStatusTurma` (`src/server/turmas/acoes.ts:281`), sem tela | Não implementado | Não há como concluir turma pela interface |
| 4 | Pagamento simulado | `.env.example`; `SETUP.md` §Variáveis | `PAGAMENTO_SIMULADO=1` liga o botão de pagar | `pagamentoSimuladoHabilitado()` = `false` fixo (`src/server/financeiro/gateway.ts:42-45`) | Divergente | `/pagar/[token]` sem botão de pagar; a baixa é só manual |
| 5 | Fuso do país no seed | doc 04 §país | O fuso do país faz as mensagens saírem na hora certa | O seed não informa fuso; o default é `America/Sao_Paulo` (`prisma/seed.ts:92-101`; `prisma/schema.prisma:904`) | Divergente | CR, PA e SV aparecem com o fuso de São Paulo até o ADM corrigir |
| 6 | Regras de entrada no seed | SPEC documento-contratual; `entrada-oferta.ts` | Oferta com forma de agenda e regra de taxa definidas | `ProdutoPais` criado sem as 3 regras (`prisma/seed.ts:141-143`) | Não implementado | "Regras de entrada incompletas nesta preparação." até o ADM configurar |
| 7 | Preços do seed | doc 04; doc 09 §Catálogo | Preço por país × produto | Só o Regular tem preço (`prisma/seed.ts:148-161`) | Parcial | Nas outras modalidades, a matrícula pede justificativa e aprovação por falta de preço |
| 8 | Moeda do país × ofertas | doc 04 §Moeda | A moeda acompanha a oferta e a matrícula | `editarPais` não atualiza `ProdutoPais.moeda` (`src/server/paises/acoes.ts:110`); a preparação compara as duas (`src/server/matricula/preparacao-comercial-tx.ts:50`) | Divergente | Depois de trocar a moeda: "Confira a oferta e a moeda do país antes de preparar." |
| 9 | Moeda da matrícula | doc 04 §Moeda | Moeda local **ou** dólar | Sempre `pais.moedaLocal` (`src/server/matricula/preparacao-comercial-tx.ts:62`) | Parcial | Não há como escolher USD para a Costa Rica na contratação |
| 10 | Checklist de ativação | doc 04 §Checklist | Moeda, documento e ≥ 1 produto com preço | Conta todos os preços, inclusive os inativos (`src/server/paises/acoes.ts:143`, `:152`) | Parcial | País só com preço desativado consegue ativar |
| 11 | Transições do país | doc 04 §Ciclo de vida | Encerrado = saída definitiva | A UI não oferece volta (`PaisesPainel.tsx:48`); o servidor aceita qualquer alvo (`src/server/paises/acoes.ts:137-171`) | Parcial | Pela tela, não há botão em Encerrado. As demais transições não têm caminho de tela para testar |
| 12 | Encerrar país | doc 42, Países #1 | Pedir confirmação | `ConfirmarAcao` com digitação do nome (`PaisesPainel.tsx:253-263`) | Corrigido | O diálogo pede para digitar o nome do país |
| 13 | Tipos de documento | doc 04; pergunta "editar recria?" | Preservar identidades | IDs preservados; recusa excluir tipo usado (`src/server/paises/tipos-documento.ts:7-26`) | Conforme | Remover tipo em uso: "Não é possível excluir tipo de documento usado por alunos…" |
| 14 | Validadores de documento | quadro de 13/10, §#62 item 8 | Validadores de CR, MX, AR, SV e passaporte fora do UAT | Os 6 existem (`src/server/_shared/validacao.ts:87-93`) | Corrigido | Documento inválido gera aviso na matrícula; a lista mostra slugs crus (`cedula_cr`) |
| 15 | Fuso do país validado | doc 42, Países #2 | Validar contra a base IANA | `fusoIanaValido` (`src/server/paises/schema.ts:29`) | Corrigido | "America/SaoPaulo" é recusado |
| 16 | Quem edita o catálogo | doc 09 §Catálogo ("só ADM"); doc 37 `curriculo.manter` | O doc 37 prevalece: idioma e nível com GP/ADM; preço com Direção/ADM | Idioma e nível exigem GP (`src/server/catalogo/acoes.ts:51`, `:172`); o resto, ADM | Conforme | O GP vê só Idiomas e Níveis (`catalogo/page.tsx:19-24`) |
| 17 | Idioma inativo | doc 37 ("respeitar vínculos") | Desativar tira o idioma das opções | Nenhuma consulta filtra `ativo` (`src/server/matricula/consultas.ts:33-39`) | Divergente | Idioma "Inativo" continua no produto, no nível e na matrícula |
| 18 | Versão do preço | doc 09 §Catálogo; doc 37 `preco.manter` | Versão por estudo de mercado; "versionar vigência" | Substitui o ativo e grava `vigenteDesde = now` (`src/server/catalogo/acoes.ts:251-262`); sem vigência futura nem data de fim | Parcial | O novo preço vale na hora; o anterior vira histórico |
| 19 | Preço sem oferta | doc 04 ("dois níveis") | O preço é do produto no país | `criarPreco` não exige `ProdutoPais.oferecido` (`src/server/catalogo/acoes.ts:236-240`) | Parcial | Dá para precificar produto desligado no país |
| 20 | Certificado | doc 04 §Tipos de cobrança | Valor fixo, não negociável, só Costa Rica | Valor livre no formulário (`MatriculaFormulario.tsx:124`), sem filtro de país (`src/server/matricula/acoes.ts:346-356`) | Divergente | Campo de certificado editável em qualquer país |
| 21 | Editar modalidade | doc 06 | A modalidade define ritmo e duração | Muda frequência e horas sem conferir as turmas; o evento só guarda nome e mínimo (`src/server/catalogo/acoes.ts:141-163`) | Parcial | A edição é aceita; as turmas antigas mantêm o horário antigo |
| 22 | Quem mantém turma | doc 37 `turma.manter` | GP/SEC | Só GP + ADM (`src/server/turmas/acoes.ts:64-67`; `tabs.ts:15-19`) | Divergente | A SEC não vê a aba Turmas |
| 23 | Regra de avaliação na turma | SPEC avaliacao-por-habilidades, AV-23 | Turma nova usa a regra vigente | O gatilho só vincula com regra aprovada e início futuro (`migration.sql:12-17`) | Conforme | Turma criada antes da regra fica pendente de conferência |
| 24 | Importar turmas | doc 37 `dados.importar` | Capacidade específica | Só ADM (`src/app/api/turmas/importar/route.ts:57-58`) | Parcial | O GP não vê "Importar" |
| 25 | Papel ALUNO no cadastro de usuário | doc 09 §4 (7 papéis) | 7 papéis internos | O formulário lista os 8, inclusive ALUNO (`UsuarioFormulario.tsx:127`) | A confirmar | Usuário só ALUNO é desviado para `/portal` ao entrar |
| 26 | Senha no formulário de usuário | doc 42, Usuários #1 (Alta) | `autoComplete="new-password"` | Sem `autoComplete` (`UsuarioFormulario.tsx:99`) | Divergente | O navegador pode preencher a senha do ADM no usuário editado |
| 27 | Busca de usuários | doc 42, Usuários #3 | Busca e filtro | Não há | Divergente | Lista inteira, sem busca |
| 28 | Desativar usuário | doc 42, Usuários #2 | Pedir confirmação | `ConfirmarAcao` (`UsuariosPainel.tsx:165-176`); ninguém desativa a si mesmo (`src/server/acesso/acoes.ts:154`) | Corrigido | O diálogo nomeia a pessoa; a sessão dela cai na próxima página |
| 29 | Alçadas no seed | doc 37 §alçada; `docs/qa/02` | Limites separados para taxa e mensalidade | Os seeds gravam só o campo legado (`prisma/seed.ts:51`; `prisma/seed-qa.ts:92`); a regra lê taxa e mensalidade (`src/server/financeiro/politica.ts:5-15`) | Divergente | Todo desconto de vendedor vai para aprovação até o ADM preencher os dois campos |
| 30 | Equipe do gerente no seed | doc 09, Home do Gerente | Ranking e equipe do gerente | `gerenteComercialId` não é semeado; filtro em `src/server/home/consultas.ts:133` | Parcial | O GC puro vê "Sem vendedores." |
| 31 | Configuração operacional | SPECs de matrícula; decisões Q | Prazos e fuso explícitos, sem padrão implícito | Falha fechada (`src/server/matricula/reserva-vaga-tx.ts:28`; `src/server/portal-aluno/identidade.ts:62`; `src/server/agenda/calendario.ts:30`) | Conforme | Mensagens "Configure…" até o ADM salvar a Operação |
| 32 | Política de comissão | doc 37, AC24 | Regra ausente exige configuração | `resolverComissao` recusa (`src/server/financeiro/politica.ts:24`) | Conforme | "Configure a política de comissão desta oferta antes de matricular." |
| 33 | Guard de Modelos contratuais | doc 37 | Página sem permissão → acesso negado | A lista não chama `exigirSessaoPagina` (`src/app/(app)/configuracao/contratos/page.tsx:6-8`); a consulta lança erro | Parcial | GP e GC abrindo a URL veem "Não foi possível carregar esta configuração" |
| 34 | Menu Configuração do GC | `tabs.ts` (a aba CRM é do GC) | O GC configura o CRM | O item do menu não inclui o GC (`src/lib/nav.ts:73-77`) | A confirmar | O GC não vê "Configuração" no menu; abre pela URL |
| 35 | Home de Secretaria, Financeiro e GP | doc 09 "Em aberto"; doc 42, /home #7 | Home de trabalho por papel | Atalhos do menu (`src/app/(app)/home/page.tsx:36-53`) | Parcial | Só botões de atalho |
| 36 | Home do Professor | doc 09 §Home do Professor | Próxima aula, Hoje/Amanhã e Minhas turmas | Próxima **experimental**, check-in e Minhas turmas (`src/server/home/consultas.ts:25-87`) | Parcial | Não há próxima aula das turmas regulares |
| 37 | Home do Gerente | doc 09 §Home do Gerente e §Aprovações | Dashboard, SLA, ranking, funil e equipe; aprovações entre as pendências | Blocos presentes; SLA fixo em 60 min (`src/server/home/consultas.ts:17`); sem aprovações; alertas não clicáveis | Parcial | Sem card de aprovações pendentes; nota "refinar (P10)" visível |
| 38 | Shell mobile | doc 42, /home #1 e §5.8 | Menu em gaveta, sem vazamento horizontal | `BarraMobile` e `Drawer` com `inert` (`src/app/(app)/layout.tsx:16-22`) | Corrigido | Em 375 px: barra no topo, menu em gaveta, tabelas com rolagem horizontal |
| 39 | Erro e carregamento de rota | doc 42, problemas 1 e 2 | `error.tsx` e `loading.tsx` | 21 e 24 arquivos (`src/components/ErroArea.tsx:11-36`) | Corrigido | Erro dentro do shell, com "Tentar de novo" |
| 40 | SHA da versão no health | quadro de 13/10, §Publicação | O SHA não é exposto | Agora é exposto (`src/app/api/health/route.ts:17-23`) | Conforme | `/api/health` mostra o `sha` (ou "desconhecido") |
| 41 | Cron sem agendador | `.env.example`; `SETUP.md` §Coolify | A continuidade não é agendada | Confirmado (`docker-compose.coolify.yml:105-107`) | Conforme | A emissão mensal não acontece sozinha no UAT |
| 42 | Etapas acadêmicas no cron "do WhatsApp" | `SETUP.md` §Variáveis | O tick roda as etapas de base | Reservas, início de turmas e acesso rodam no mesmo tick (`src/app/api/whatsapp/cron/route.ts:46-50`) | Conforme | Parar o serviço `cron` também para o acadêmico |
| 43 | Teto de avisos do lint | quadro, linha da #151 ("sem `--max-warnings`") | Limitar os avisos | `--max-warnings 40` (`.github/workflows/ci.yml:67`) | Conforme | — |
| 44 | Senha de dev no UAT | `docs/qa/02` §1 | A senha de dev não pode valer no UAT | O seed cria os 5 usuários com a senha `genius123`, publicada no `SETUP.md` (`prisma/seed.ts:8`, `:52`); a troca é manual | Parcial | Até a troca, as contas do seed entram com a senha publicada no `SETUP.md` |
| 45 | Como semear o UAT | `docs/qa/02` §1 | Rodar `npm run seed` no banco do UAT | O procedimento no Coolify não foi encontrado no `SETUP.md` | Parcial | Passo do dev, antes do ciclo |

## Cenários de teste para o QA

Marcas: **[PO]** depende de decisão do PO · **[DEV]** depende de passo do dev · **[MOB]** rodar em 375 × 812
(DevTools, modo dispositivo). Comece o nome de todo registro criado com `QA` + o ID do cenário.

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CFG9-01 | ADM | Configuração › Países › Novo país: nome "QA País", ISO "Q1", moeda "usd", DDI "+999", fuso `America/Costa_Rica`, idioma "es", sem documento. Salvar | Criado em **Rascunho**; ISO e moeda aparecem em maiúsculas |
| CFG9-02 | ADM | Novo país com ISO "CR" | Erro "Já existe país com código CR." |
| CFG9-03 | ADM | Novo país com fuso `America/SaoPaulo`; depois com `GMT-3` | Os dois são recusados com a mensagem de fuso não reconhecido |
| CFG9-04 | ADM | DDI "506" (sem o +) e moeda "US" | Erros "DDI no formato +XXX" e "Moeda em 3 letras" ao lado dos campos |
| CFG9-05 | ADM | No "QA País", ainda sem documento, clicar **Ativar** | Erro "Cadastre ao menos um tipo de documento antes de ativar." |
| CFG9-06 | ADM | Adicionar um documento (Passaporte) e clicar Ativar de novo | Erro "Cadastre ao menos um produto com preço (Catálogo) antes de ativar." |
| CFG9-07 | ADM | Catálogo › Preços: MENSALIDADE do Regular no "QA País". Ativar o país | País **Ativo**; o preço mostra a moeda do país |
| CFG9-08 | ADM | Pausar o "QA País" e depois Reativar | Pausado → Ativo, sem confirmação |
| CFG9-09 | ADM | Encerrar o "QA País": no diálogo, tentar confirmar sem digitar o nome; depois digitar o nome | O botão fica bloqueado até o nome exato; depois o país fica **Encerrado**, sem botões de status na linha |
| CFG9-10 | ADM | Num país com aluno que usa o tipo de documento, editar e remover esse tipo | Erro "Não é possível excluir tipo de documento usado por alunos…"; o tipo continua lá |
| CFG9-11 | ADM | Editar o nome de um tipo de documento em uso e salvar | Salva; os alunos continuam ligados ao tipo (mesmo registro, com o nome novo) |
| CFG9-12 | ADM | **[DEV]** Num país de teste, trocar a moeda (ex.: USD → CRC) e preparar a contratação de um lead desse país | Pelo código atual: "Confira a oferta e a moeda do país antes de preparar." Registrar como bug (achado 8) |
| CFG9-13 | ADM | Catálogo › Idiomas: clicar "Adicionar" com o campo vazio | Hoje nada acontece, sem mensagem (achado de UX aberto). Registrar como melhoria |
| CFG9-14 | ADM | Desativar um idioma que tem produtos; abrir `/matriculas/nova` | A confirmação mostra o impacto; depois o idioma **ainda aparece** nos produtos da matrícula (achado 17) |
| CFG9-15 | ADM | Novo preço de MENSALIDADE para um par que já tem preço ativo | O novo fica Ativo e o anterior, Inativo; só 1 ativo no par |
| CFG9-16 | ADM | Desativar o preço ativo (confirmar) e Reativar o antigo | Há confirmação antes de desativar; reativar inativa o outro ativo |
| CFG9-17 | ADM | Novo preço com valor 0 ou negativo | "Valor deve ser maior que zero" |
| CFG9-19 | ADM | Novo produto com um par idioma × modalidade que já existe | "Já existe um produto para esse idioma + modalidade." |
| CFG9-20 | ADM | Editar uma modalidade mudando "aulas por nível" | Erro que manda para Acadêmico › Quantidade de aulas |
| CFG9-21 | ADM | Regras de entrada: salvar com motivo de 3 letras; depois com motivo válido | O primeiro é recusado; depois a "Versão" sobe 1 |
| CFG9-22 | GP | Abrir Configuração | Abas Catálogo e Turmas; em Catálogo, só Idiomas e Níveis |
| CFG9-23 | GP | Turmas › Nova turma Regular (1x/semana) marcando 2 dias | "A modalidade Regular é 1x/semana: selecione exatamente 1 dia(s)…" |
| CFG9-24 | GP | Nova turma Regular das 19:00 às 20:00 (1 h) | Erro: a aula dura 2 hora(s) |
| CFG9-25 | GP | Nova turma válida, início daqui a 14 dias, com professor | Criada como **Planejada**, com código T-…, e "0 matriculados · 0 reservas · N vagas" |
| CFG9-26 | GP | Abrir o formulário de turma, preencher e clicar no fundo escuro | Pede confirmação para descartar; Escape fecha com a mesma regra |
| CFG9-27 | GP | Procurar como mudar a turma para "Aberta" | **Não existe** (B1). Registrar; **[DEV]** muda no banco para seguir |
| CFG9-28 | GP | Mudar para 2 a capacidade de uma turma com 3 alocados | Erro de capacidade menor que a ocupação |
| CFG9-29 | ADM | Turmas › Importar uma planilha com 1 linha boa e 1 com modalidade inexistente | Cria a boa e lista "Modalidade não reconhecida" para a ruim |
| CFG9-30 | GP | Abrir `/api/turmas/modelo` pela URL | Recusado (apenas administrador) |
| CFG9-31 | SEC | Abrir `/configuracao/turmas` pela URL | Redireciona para acesso negado |
| CFG9-32 | GP | Abrir `/configuracao/contratos` pela URL | Hoje: tela de erro da Configuração (achado 33). Esperado: acesso negado. **[PO]** |
| CFG9-33 | ADM | Usuários › Novo: e-mail repetido; senha de 5 caracteres; nenhum papel | Três erros: e-mail já existente, senha com no mínimo 6 caracteres e "Selecione ao menos um papel" |
| CFG9-34 | ADM | Criar um vendedor com desconto de 10% na taxa e 5% na mensalidade, com o GC puro como gerente; logar como ele | Desconto dentro do limite passa; acima dele vai para aprovação. O GC passa a ver o vendedor na Home |
| CFG9-35 | ADM | Desativar a própria conta | "Você não pode desativar a si mesmo." |
| CFG9-36 | ADM | Desativar a SEC (confirmar) com ela logada em outro navegador; ela navega | O diálogo nomeia a pessoa; na próxima página, ela vai para o login |
| CFG9-37 | ADM | Operação: fuso `America/Costa_Rica`, prazo de reserva 60, salvar; depois prazo de conferência 0 | Primeiro, "salvo" em verde; depois, erro em vermelho (mensagens separadas) |
| CFG9-38 | ADM | **[DEV]** Sem prazo de reserva configurado, preparar uma contratação com turma | "Configure o prazo de reserva antes de iniciar uma nova reserva." |
| CFG9-39 | VEND | Preparar uma contratação numa oferta sem regras de entrada | Falha na conferência: "Regras de entrada incompletas nesta preparação." |
| CFG9-40 | VEND | Matrícula numa oferta sem política de comissão | "Configure a política de comissão desta oferta antes de matricular." |
| HOME9-01 | ADM | Abrir a Home | Cards Leads hoje, Conversão, Matrículas ativadas no mês e Recebido no mês; Ranking; Funil; Equipe |
| HOME9-02 | GC puro | Abrir a Home antes e depois do CFG9-34 | Antes: "Sem vendedores."; depois: o vendedor aparece no ranking e na equipe |
| HOME9-03 | GC | Ter um lead NOVO criado há mais de 60 min | Faixa "Alertas de SLA: 1…"; clicar nela não leva a lugar nenhum (achado aberto) |
| HOME9-04 | PROF | Com uma experimental atribuída no passado, clicar **Faltou** | Diálogo de confirmação com o nome e a data; confirmar tira o item da lista |
| HOME9-05 | PROF | Abrir a Home com turmas atribuídas | "Minhas turmas" com dias, horário e nº de alunos; não há "próxima aula" da turma |
| HOME9-06 | SEC, FIN, GP | Abrir a Home | Só atalhos para as áreas do papel |
| UI9-01 | ADM | **[MOB]** Home, Países e Usuários | Barra no topo com menu; a gaveta abre e fecha com Escape; as tabelas rolam na horizontal sem vazar da página |
| UI9-02 | PROF | **[MOB]** Check-in "Faltou" | O diálogo cabe na tela; os botões têm área de toque grande |
| UI9-03 | ADM | **[MOB]** Formulário de turma e confirmação de encerrar país | O modal cabe na tela e rola; nada fica atrás do teclado |
| ENV9-01 | QA | Abrir `/api/health` e `/api/ready` no UAT | `{ok:true, sha:…}` e `{ready:true}`; anotar o SHA no relatório do ciclo |
| ENV9-02 | QA | Abrir `/pagar/<token>` de uma cobrança | Página sem botão de pagar (achado 4). **[PO]** decide se o cenário fica fora |