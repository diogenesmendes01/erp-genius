# Auditoria profunda: documentação × código × execução

Data: 07/09/2026. Base: **bc858af**, checkout local do ERP Genius.

**Parecer: não é possível considerar tudo pronto e funcional.** O projeto compila e os testes existentes passam, mas reproduzi falhas de autorização, integridade financeira e continuidade dos fluxos. Parte da documentação descreve garantias mais abrangentes que a implementação. Outra parte já registra corretamente limitações ainda abertas.

Este documento complementa e aprofunda o [diagnóstico anterior](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/33-diagnostico-projeto-papeis-erp-crm-whatsapp.md). Nenhum código de negócio foi corrigido nesta auditoria.

## 1. O que foi efetivamente executado

| Verificação | Resultado | O que demonstra |
|---|---|---|
| `npm test -- --reporter=dot` | **340 testes passaram, 32 arquivos** | As expectativas unitárias existentes são satisfeitas |
| `npm run test:int -- --reporter=dot` | **145 testes passaram, 16 arquivos** | Os cenários existentes funcionam com PostgreSQL real de teste |
| `npx tsc --noEmit` | Passou | Consistência dos tipos verificados pelo compilador |
| `npm run lint` | **0 erros, 15 avisos** | Ainda há avisos de hooks/renderização/variáveis/texto |
| `npm run build` | Passou | O build de produção foi gerado; houve logs de banco ausente durante coleta de páginas, antes de preparar o banco |
| Suíte adicional desta auditoria | **25 falhas, 4 controles passaram, 1 inconclusivo/pulado** | Regras e combinações ausentes da cobertura anterior |
| Requisições HTTP ao build com login real de professor | Concluídas | Acesso indevido a duas páginas e upload aceito após desativação |

Os 25 cenários não representam 25 causas independentes, nem uma porcentagem de defeitos do sistema. Foram escolhidos deliberadamente nos pontos de risco. Alguns comprovam lacunas de processo ou divergência de política, identificadas abaixo, e não bugs aritméticos.

**Isolamento:** banco `erp_genius_test` fixo em `localhost:54329`, dados fictícios. Nas integrações adicionais, autenticação/cache e drivers externos são simulados; consultas, transações e regras usam o código real. O teste HTTP usa autenticação real. Nenhuma mensagem foi enviada a WhatsApp real, e nenhum banco de produção foi consultado.

Evidência reproduzível: [cenários](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/scripts/auditoria/cenarios.test.mjs), [resultado JSON](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/auditoria-2026-09-resultados.json), [teste HTTP](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/scripts/auditoria/http.mjs), [resultado HTTP](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/auditoria-2026-09-http.json), [instruções de reprodução](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/scripts/auditoria/README.md).

## 2. Papéis e visibilidade: prioridade imediata

### 2.1 Vendedor altera cobrança de outro vendedor — P1, reproduzido A02

Com dois vendedores e matrícula vinculada ao primeiro, o segundo conseguiu reduzir a cobrança de **100 para 90**, usando sua própria alçada de 20%. A ação carregou o objeto por ID e autorizou pela função, sem verificar a carteira do objeto.

Isso não depende de a interface oferecer o botão: a autorização precisa proteger a ação do servidor. Não foi demonstrada exploração em produção.

**Correção necessária:** validar propriedade/capacidade sobre a cobrança antes de ler dados e aplicar ajuste ou criar aprovação. [Código](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/acoes.ts:170).

### 2.2 Alçada e comissão podem ser contornadas na matrícula — P1, A03/A04

Um vendedor com limite de **5%** criou uma matrícula com **99% de desconto** sobre os preços de referência, sem aprovação. Em outro cenário, enviou comissão de **100%**, aceita e persistida pelo servidor.

O desconto é controlado no fluxo de ajuste, mas não de forma equivalente na criação. A política de comissão também não pode depender de um percentual livre fornecido pelo vendedor.

**Correção necessária:** aplicar a mesma política de negociação em criar/editar/ajustar; resolver comissão de regra autorizada. [Valores recebidos](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/schema.ts:78), [persistência](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:273). Diverge da [alçada documentada](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/07-papeis-permissoes.md:47).

### 2.3 Proteção de leitura é desigual — P1, A01/A05/A06 e HTTP

| Caminho | Comportamento reproduzido | Limite da conclusão |
|---|---|---|
| Lista de alunos | Professor recebe objeto `financeiro`, incluindo atraso e totais | A projeção protegida da ficha não cobre a lista |
| Ficha de lead | Usuário que perdeu VENDEDOR e virou PROFESSOR continua lendo o lead do qual ainda é dono | Papéis foram relidos do banco; o problema é falta de exigência comercial na leitura |
| Busca de vínculos da inbox | Professor sem papel de atendimento obtém sucesso na busca global | A ação exige sessão, sem a capacidade necessária |
| `/configuracao/paises` | Professor autenticado recebe HTTP 200 e dados do país no HTML | Confirmado com login real, sem mock |
| `/configuracao/catalogo` | Professor autenticado recebe HTTP 200 e dados do catálogo/país no HTML | Confirmado com login real, sem mock |
| `/configuracao/usuarios` | Mesmo professor recebe conteúdo de acesso negado | Contraprova: não é uma falha geral do login ou de todos os guards |

Referências: [lista](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/consultas.ts:101), [escopo comercial](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/consultas.ts:176), [busca da inbox](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/acoes.ts:350), [catálogo](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/configuracao/catalogo/page.tsx:15), [países](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/(app)/configuracao/paises/page.tsx).

### 2.4 Usuário desativado continua fazendo upload — P1, HTTP H04/H05

Fiz login real, desativei o usuário no banco e reutilizei seu cookie. `POST /api/upload` aceitou e gravou o arquivo (**200**). A leitura desse mesmo arquivo rejeitou a sessão (**401**), corretamente.

O upload usa apenas `auth()`; outras rotas consultam o estado atual do usuário. O arquivo fictício foi removido após a verificação.

**Correção necessária:** mesma validação de usuário ativo e capacidade de upload nas duas pontas. [Rota](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/api/upload/route.ts:19).

### 2.5 Filtro substitui escopo obrigatório — P2, A07

`listarLeads(usuario, { vendedorId: outro })` consegue sobrepor o dono imposto pelo escopo. Reproduzido na consulta real. **As páginas inspecionadas não passam esse filtro**, portanto é uma falha latente da consulta, não uma exposição demonstrada pela tela atual. Corrigir com interseção de escopo e filtros. [Código](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/consultas.ts:191).

## 3. Financeiro e matrícula: consistência quebrada entre operações

### 3.1 Desconto após pagamento parcial deixa saldo errado — P1, F01

Sequência real: cobrança **100 → recebe 40 → saldo 60 → desconto reduz negociado para 80**. Resultado persistido: negociado **80**, recebido **40**, saldo **60**. O saldo correto é **40**.

`aplicarAjuste` altera o valor negociado sem recalcular saldo e situação. A correção deve tratar também perdão, quitação resultante do ajuste e excedente, com histórico preservado. [Código](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/ajustes/acoes.ts:115).

### 3.2 Indicadores ignoram recebimentos parciais — P1, F02

Ao receber **40 de 100**, o painel apresentou **nenhum valor recebido no mês** e **100 a receber**, em vez de 40 e 60. A consulta soma apenas cobranças totalmente pagas para recebidos, e usa valor negociado integral nas abertas.

Além de corrigir saldos, o recebido por mês precisa considerar a data de cada recebimento: somar tudo pela data da quitação também distorce pagamentos distribuídos entre meses. Essa segunda situação é inferência do código, não cenário adicional executado. [Código](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/financeiro/consultas.ts:27).

### 3.3 Ativação não preserva invariantes — P1, F04/F05/F06

| Sequência | Resultado observado | Resultado necessário |
|---|---|---|
| Matrícula CANCELADA → ativar recebendo taxa | Sucesso; torna-se ATIVA | Rejeitar ou exigir fluxo explícito de reabertura |
| Primeira mensalidade paga → ativar matrícula | Primeira mensalidade vira PENDENTE | Preservar a quitação |
| Taxa de 100 com 40 já recebidos → ativar recebendo os 60 restantes | Ativação rejeitada | Considerar o acumulado anterior, sem cobrar duas vezes |

A ativação tem uma lógica própria de alocação que não se compõe corretamente com a baixa parcial. Ela só rejeita o estado já ATIVA e reescreve a primeira mensalidade. [Estado/alocação](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:409), [reescrita da mensalidade](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:475).

### 3.4 Contrato: regra divergente e flag sem evidência — F07

A documentação exige contrato + taxa + primeira mensalidade. O fluxo atual exige cobertura da taxa, agenda mensalidade e grava **`contratoOk: true`** sem assinatura ou evidência correspondente.

Há comentários no código indicando mudança de decisão do produto. Portanto, **não recomendo restaurar automaticamente a regra antiga**. É preciso consolidar a regra vigente; de qualquer forma, não usar uma flag de contrato confirmado para representar apenas o pagamento da taxa. [Código](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:489), [regra documentada](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/05-fase1-fluxo-matricula.md:14).

### 3.5 Concorrência de pagamentos — risco estático, não confirmado nesta execução

A baixa lê o acumulado antes da transação e depois grava o total calculado. Duas baixas simultâneas podem ler o mesmo valor inicial; falta proteção explícita contra atualização perdida. [Código](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/financeiro/acoes.ts:47).

O cenário **F03 foi deixado pulado**: a execução concorrente encontrou erro de importação de `next/server` no ambiente de mocks de Auth.js, antes de uma conclusão válida sobre o banco. Esse erro não foi contado como defeito do produto. É necessário repetir via requisições reais ou isolamento de autenticação apropriado.

## 4. Operação acadêmica e cadastro

| ID | Situação reproduzida | Classificação e aceite |
|---|---|---|
| F08 | Pausar cancela mensalidades futuras; reativar muda o aluno para ATIVO e deixa zero mensalidades futuras pendentes | **Fluxo incompleto.** Definir retomada, vencimentos e eventual prorrogação; não presumir que recriar todas as cobranças antigas seja a política correta |
| F09 | Encerrar aluno mantém alocação ativa na turma | **Inconsistência operacional.** Encerrar vínculo/liberar vaga preservando histórico |
| F10 | Secretaria transfere aluno de A1 para B2 sem justificativa/aprovação | **Divergência da autoridade acadêmica documentada.** Distinguir transferência equivalente de avanço/exceção |
| F11 | Editar país apaga/recria tipos de documento; aluno existente fica com `tipoDocumentoId = null` | **P1, perda de vínculo histórico.** Atualizar tipos por identidade estável; impedir exclusão destrutiva de tipo em uso |
| F12 | País PAUSADO aceita nova matrícula | **Regra de disponibilidade ausente.** Bloquear novas operações conforme status, mantendo contratos existentes acessíveis |

Referências: [pausa/reativação](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/acoes.ts:168), [encerramento](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/acoes.ts:231), [transferência](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/alunos/acoes.ts:265), [tipos de documento](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/paises/acoes.ts:81), [criação de matrícula](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/matricula/acoes.ts:576).

## 5. WhatsApp: estruturas existem, mas há falhas no ciclo completo

Todos os envios desta seção chegaram somente a **drivers falsos**. O teste prova a decisão do sistema de encaminhar a mensagem ao provedor; não prova entrega externa.

| ID | Cenário | Resultado observado |
|---|---|---|
| W01 | Intenção adiada; lead depois avança para EM_ATENDIMENTO | Driver chamado; intenção DESPACHADA |
| W02 | Lembrete adiado até depois da experimental/validade | Driver chamado com lembrete antigo |
| W03 | Vendedor responde pelo celular, saída com `fromMe` e origem nula | Cron ainda enfileira follow-up de lead novo |
| W04 | Aluno responde REAGENDAR | Evento registrado, mas próximo cron enfileira novo lembrete da agenda anterior |
| W05 | Envio interrompido com resultado incerto vira FALHOU | Próximo cron reabre PENDENTE, contrariando a regra de revisão humana |
| W06 | Cobrança entra em lote; depois é totalmente paga | Driver chamado com “Pague 100” |
| W07 | Número é desativado após enfileirar | Driver ainda chamado usando esse número |

**Prioridade P1 antes de ampliar automações:** validar estado atual do destinatário, cobrança, ocorrência, validade e remetente imediatamente antes do envio. A fila guarda uma intenção histórica; isso não basta para autorizar uma ação futura. Falha de resultado incerto precisa de tratamento distinto de falha comprovadamente sem envio.

Referências: [despachante](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/despachante.ts:74), [cron comercial](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/whatsapp/cron-comercial.ts:163), [captura de resposta](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/server/comercial/captura.ts:108).

Vários desses problemas **já estão reconhecidos no doc 32** como bloqueadores do piloto. Isso confirma que o módulo não estava documentado uniformemente como pronto; há conflito entre resumos otimistas e documentos de auditoria mais específicos. [Plano do piloto](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/32-comercial-c1-c2-piloto-baileys.md:18).

Outros pontos identificados por leitura, sem homologação externa: o webhook Meta captura exceções e responde 200 sem persistir o evento bruto para recuperação; um erro pode interromper o processamento do restante do lote. O parser também não extrai texto/payload de `button` ou `interactive.button_reply`. Esses caminhos precisam de testes próprios antes de prometer recuperação confiável e confirmação por botões. [Webhook](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/app/api/whatsapp/webhook/meta/route.ts:99).

## 6. Onde a documentação engana, está antiga ou descreve futuro

| Afirmação/documento | Situação encontrada | Tratamento correto |
|---|---|---|
| Doc 16: toda página/rota usa guard com papéis frescos | Upload e páginas de configuração contradizem a generalização; propriedade ainda permite leitura de ex-vendedor | Marcar cobertura parcial até fechar e testar todos os caminhos |
| Doc 16: projeção pedagógica remove cobranças | Verdade na ficha protegida; lista ainda entrega financeiro | Especificar a cobertura por endpoint/projeção |
| Doc 07: alçada por usuário | Ajuste aplica regra, criação de matrícula permite contorná-la | Uma única política em todos os pontos de escrita |
| Docs 05/09/10/15: gatilho com três condições | Código atual ativa pela taxa e grava contrato confirmado | Registrar decisão vigente e migrar semântica das flags |
| Doc 16: storage em `public/uploads` | Código usa storage privado em `data/uploads` e leitura autorizada | Atualizar documentação; aqui o código está mais avançado |
| Doc 16: testes de ativação aguardam marcadores de merge | Suíte de integração atual executou com sucesso | Remover limitação antiga após registrar evidência atual |
| Papéis professor/gestão acadêmica descritos com notas, frequência e progressão | São objetivos de fases futuras; não encontrei ciclo acadêmico completo implementado | Não apresentar como funcionalidade entregue apenas porque consta na descrição do papel |
| Doc 32: bloqueadores C1/C2 | Vários foram reproduzidos nesta auditoria | Manter abertos; existência de fila/cron não equivale a piloto aprovado |

Referências principais: [plano de execução](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/16-plano-execucao.md:23), [papéis](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/07-papeis-permissoes.md), [storage atual](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/src/lib/uploads.ts:7).

## 7. Por que os 485 testes existentes não detectaram isso

Há proteções reais: os controles adicionais confirmaram bloqueio da ficha de lead de terceiro, bloqueio de criação após revogação, isolamento dos alunos de turmas de outro professor e rejeição de matrícula sem referência de preço/justificativa. Não se trata de um sistema inteiro sem autorização.

A lacuna está principalmente na combinação entre operações: **pagar → ajustar**, **pagar → ativar**, **pausar → reativar**, **enfileirar → mudar estado → despachar**, **logar → desativar → reutilizar sessão**. Testar a operação isolada e seu evento de sucesso não garante que os dados continuem coerentes depois da próxima operação.

Também faltam contraprovas sistemáticas por objeto e campo: conhecer um ID não concede permissão; ter sessão não concede papel; ver o aluno não concede acesso a valores financeiros; ter sido dono não mantém a capacidade após revogação.

## 8. Ordem recomendada de correção e critérios de conclusão

1. **Autorização e alçadas:** corrigir A01–A06 e os acessos HTTP; endurecer A07 antes de expor novos filtros. Aceite: testes por papel, propriedade, múltiplos papéis, revogação e acesso direto, conferindo também dados retornados e ausência de mutação.
2. **Integridade financeira/cadastral:** corrigir F01/F02/F04/F05/F06/F11 e investigar concorrência F03. Aceite: saldo reconciliado após cada operação, pagamentos preservados, transições explícitas e tipos de documento mantidos.
3. **Despacho e cadências:** corrigir W01–W07 antes de ampliar piloto. Aceite: zero chamada ao driver para intenção obsoleta, cobrança paga ou remetente inativo; recuperação incerta não reabre sozinha.
4. **Regras da escola:** decidir contrato/ativação, retomada após pausa, liberação de vaga, progressão e países pausados. Consolidar decisões no código, testes e documentação juntos.
5. **Só então ampliar features:** diário/frequência, agenda online, avaliações, renovação/retenção e integrações. O roadmap do doc 33 permanece útil, mas a estabilização ganhou prioridade por evidência de execução.

Uma entrega deve trazer: regra vigente, entradas permitidas, estados de origem/destino, escopo dos objetos, projeção dos campos, teste positivo e negativo, e evidência da operação completa. Checkbox marcado ou build verde não substitui esse aceite.

## 9. Limitações e ambiente

Não foram homologados provedores reais, pagamentos externos, assinatura digital, restauração de backup, carga, dispositivos/navegadores ou toda interação visual. Não é certificação de produção nem garantia de ausência de outras falhas.

O `npm run test:db` não concluiu normalmente neste Windows. Foi necessário iniciar o Postgres com permissão de execução adequada e criar o banco por Prisma. Ao encerrar o servidor, a chamada inicial liberou a saída e terminou com **`createdb.exe ENOENT`**: o script referencia um executável ausente no pacote nativo instalado, que contém `initdb`, `pg_ctl` e `postgres`. A ausência do executável está confirmada; a causa do bloqueio anterior da chamada não foi isolada. [Script](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/scripts/test-db.mjs:57). A instância HTTP e o Postgres iniciados para a auditoria foram encerrados.

As novas suítes são material de auditoria separado das suítes normais e ficam vermelhas enquanto os comportamentos persistirem. A expectativa de F07/F08/F10 deve acompanhar a decisão formal de produto, sem apagar a evidência histórica desta execução.
