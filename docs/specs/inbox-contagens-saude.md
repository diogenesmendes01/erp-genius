# Inbox #310 — contagens dos chips e saúde dos números

## Recorte e contrato

Branch `codex/inbox-e1-310`, base E0 `bcc3d27ab007231a08cabe2c3cf9c9b46a151558`. A #306 permanece congelada em sua própria branch. Esta entrega produz dados para #311/#313; não altera a casca #308 nem desenha chips/seletor. A Task 5 Step 5 reserva o aceite visual à Task 8 (#313), confirmado pelo integrador.

- `IdChipInbox` e `ContagensChipsInbox` são definidos centralmente em `server/inbox/filtros.ts`.
- `contarChipsInbox(usuario, filtros, opcoes?)` usa o mesmo escopo autorizado da lista e retira somente `responsavel`, `naoLidas` e `prazoEstourado`. Mantém setor, número, status e busca. Cada chip conta atendimentos, independentemente do limite da página; não soma mensagens.
- `todas`: base; `minhas`: responsável atual; `fila`: sem responsável e aberto; `naoLidas`: a condição pessoal existente; `prazo`: a condição existente, prazo estritamente menor que agora, sem primeira resposta e aberto. Não amplia o filtro de prazos para grupos nem altera regras de negócio. As cinco contagens executam em `Promise.all`.
- A opção adicional `{ enviar?: boolean }`, aprovada pelo integrador, preserva o escopo já existente de `envio=1`, inclusive convites sem envio, número inativo e atendimento encerrado. A assinatura de dois argumentos continua válida.
- `GET /api/inbox/atendimentos?contagens=1`, sem cursor, acrescenta o campo `contagens`. Sem flag exata ou com cursor, mantém `{ itens, proximo }` e não consulta agregados. Preserva autenticação, alçada, cursor inválido, filtros e `Cache-Control: no-store`.
- A página consulta contagens somente depois da guarda, com o usuário/filtros reais, e entrega a prop opcional ao InboxNovo. Deep links não inflacionam o agregado.
- InboxNovo guarda os agregados do servidor em estado reservado ao consumidor #313. Primeira página pede a flag; paginação não pede. Recarga manual/SSE atualiza somente snapshots do contexto vigente. Troca de filtro invalida consultas anteriores, inclusive A→B→A.
- Não há subtração heurística por linha ou por deep link. GET iniciado antes/durante leitura otimista não substitui o agregado. O resultado da leitura agenda uma reconciliação pontual (falha já fazia isso; sucesso passa a fazê-lo quando há prop de contagens). Mantém as proteções #299 da lista e não acrescenta polling.

## Saúde e divergência do plano

O schema atual permite somente `DriverWhatsApp.META_CLOUD`, `DriverWhatsApp.BAILEYS` e `DriverWhatsApp.MOTOR`. `SIMULADO` citado no plano não existe: ruling do integrador determina seguir o schema, sem inventar enum, migration ou adapter. Referências legadas usam enum tipado, respeitando a trava contra literais de provedores removidos.

`ativo=false` sempre resulta em `desconectado`. Ativo com canal META_CLOUD resulta em `conectado`; MOTOR/BAILEYS seguem a sessão: CONECTADO→conectado, DESCONECTADO→desconectado, AGUARDANDO_QR/CAIU→instavel. Saúde é apresentação, não permissão/capacidade de envio.

`opcoesFiltroInbox` mantém a seleção por setores/papéis e retorna exatamente `{ id, rotulo, saude }`. Driver, sessão e ativo são apenas insumos internos; telefone e referência do provedor não saem. Nenhum novo filtro de ativo/excluído foi introduzido.

## Verificação e limites

Evidência detalhada em `output/inbox-310-report.md`. Recortes TDD incluem API/SSR, tabela de saúde, banco real dev-email e Promises diferidas para SSE/leitura/filtros. Não há nova tela própria; captura app × protótipo fica vinculada à #313. Não é alegada homologação visual de chips inexistentes nesta etapa.

Sem schema, migration, dependências, package/lock, mudança de permissões, transporte externo ou ação de negócio. Banco descartável usado sequencialmente; nenhum servidor iniciado pelo DEV. Revisão independente favorável noSHA67014764:86unitários e26integração perfiltester comsaída0. Global combinado309+310 fonte103a507d, sessão15987exit0:850arquivos/6634testes,TSCheap8192 e lint0erros40avisos, Node22.23.2. Parecer e logs em `output/inbox-310-qa/`; fonte310 não mudou após revisão. Pronta para PR; visual dos consumidores segue313, sem merge/deploy.

## Revisão C1 da PR394 — agrupamento no consumidor

Revisão isolada sobre head eb68e314, sem importar funcionalidades posteriores313. Primeira página+agregados passam por janela fixa50ms, no máximo1GET até terminar corpo HTTP e1pendência trailing consolidada. Avisos da thread/painel/ação de leitura permanecem imediatos. Captura filtro/versões apenas no início real do GET, preservando guards e reconciliação pessoal fresca após conclusão da leitura sucesso/falha. Não-ok também drena o corpo, sem abort/retry autônomo/polling.

Mudança pública real de filtros cancela lote antigo/invalida voo; objetos equivalentes não eliminam pendência pessoal. Cleanup/StrictMode/A→B→A cobertos. Sem backend/SQL/permissão/schema/SSEstore novo. Recorte24/329, TSC5951heap8192 e lint4fontes saída0; detalhe TDD/tipos/cache/pendências em output/inbox-310-c1-report.md. Porte agregado atual, QA independente e medição browser coordenada ainda pendentes; visual3134f anterior não é atribuído ao novo scheduler.

### C1 P2 — invalidação de snapshot no mesmo contexto

PropsSSR de identidade nova/mesmos valores mantêm a época, mas o guard de snapshots continua invalidando GET em voo. A fila recebe invalidarSnapshotEmVoo e conserva1trailing fresco SOMENTE para voo da época atual; não revive A antigo apósA→B→A. Idle/prévoo não geram consulta adicional. RED público sem leitura/lerpendente reproduz2→3perdido; correção preserva todosguards e autoridade do snapshot fresco.82écheckpoint histórico não adotado; Fontecorrigida:24/334,TSC32952heap8192/lint4fontes78e0c3 saída0; QA/porte pendentes em relatórioC1.

### Porte do consumidor atual

O mesmo helper do isoladob233 foi portado sobre676 sem levar código313 à PR394. Consumidor cancela apenas chave públicaREAL ou versaoNavegacaoREAL; props equivalentes invalidam snapshot emvoo e conservam1trailing. GuardsR6/freshzero e reconciliação pessoal final/finally311/automático preservados. Gatesporte83dirigidos/56arquivos627testes/typegenTSC82827heap8192/lint4fontes25da72 saída0; QA/browser/global/adoção pendentes, semDB/preview próprios.
