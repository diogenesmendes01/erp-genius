# Inbox #357 — DEV B

Base de desenvolvimento6e70f73c7eeff6262c73a058e538650a88b42170 (composição local ROOT), branch codex/inbox-e3-357-assumir. Publicação/base nomeada serão mapeadas pelo integrador. D3 já aprovada; somente a tomada MANUAL foi implementada neste recorte, não o bloqueio do compositor358 nem edição355.

## Fonte e política

Novo núcleo db-aware assumir-aria.ts e action assumirConversaDaAria. DTO obrigatório podeAssumirAria usa exatamente a mesma autorização contextual: ator/escopo de envio, destino/linha atuais, aberto/individual, fila ou mesmo responsável. Não concede alçada global, carteira ou acesso a cartões por podeDecidir. Legacy assumirAtendimento e pausa.ts default não foram alterados; Header/root responsivo não foi editado.

Ordem: todasSUGERIDA por id ASC FOR UPDATE → Atendimento FOR NO KEY UPDATE → releituras frescas → pausa/cancelamento → releitura após esperas → owner/status → revalidação → rejeições/eventos. Novos phantoms reiniciam TX inteira até3 apenas pelo sentinel fechado. 40P01/P2034 e erros desconhecidos continuam propagados. Não introduz advisory/skiplocked/late-action-lock. Pool1 real e FK331 estão cobertos.

Pausa anterior de qualquer motivo vira MANUAL com histórico preservado. Rejeita todas sugestões pendentes pelo núcleo canônico; cancela apenas IA PENDENTE/ADIADA. ENVIANDO, HUMANO e outro atendimento permanecem. Replay estrito exige mesmo autor/último evento de posse/mesma pausaMANUAL vigente. Reativar/devolver invalida receipt. Qualquer revogação posterior à espera desfaz integralmente efeitos.

Cabeçalho/Aba reconciliam apenas ACK vivo sem autofocus. Modal usa ponteC1 local: responsável atual também executa transiçãoMANUAL;503/pending/enviofalse bloqueiam CTA, retry préACK só relê. Foco só depoisACK+200posterior+owner/envio/capacidade atuais. Não há selector global, remount de rascunhos ou envio automático.

## Evidências observadas

- RED nativo inicial4271/9d65fd EXIT1:8/8 falharam contra a action legada; nova produção só depois desse RED. Primeiro GREEN30997/e70b79 EXIT0:8/8.
- Primeiras contraprovas com middleware não reconheciam TemplateStringsArray (67597/7bad7d EXIT1); corrigida somente a observação para formatos exatos. Não são prova de falha do produto. Fixtures FK331 precisaram ConfigOperacional com UTC e telefone real do lead; convite usava nome incorreto de coluna, grupo é recusado pelo próprio banco. Não houve bypass de constraint/SQL/ACL.
- Native completo final53775/79b302 EXIT0:2arquivos/29casos,118,21s. Main27+driver2: turno real phantom/3retries, aprovação354 e expiração reais esperando locks observados, concorrência dupla, revogação pós-lock e após cancelamentos com rollback integral, pool1 Admin/Vendedor, FK331 global, defaults negativos e recibos. Driver inteiramente fake comprova que PENDENTE não envia e ENVIANDO já claimed continua atéDESPACHADA uma vez; não promete cancelar RPC em curso.
- UNIT erros795681 EXIT0:3cases preservam erro original40P01/P2034/outro sem retry.
- RED consumidores Aba19021c e replay limpo5b7478 EXIT1:7falhas/158; GREENcf3085 EXIT0:5arquivos/178casos. Header/modal RED1e05c3/f1efe2 preservados; estados reais/ação de fronteira mockada, hooks/componentes reais.
- Inbox completo19235/e5a4a4 EXIT1:87arquivos/973casos,965pass8fail. Um shape404; sete controlesC1 identificaram mudança do responsável e preservaram exigência de não agir silenciosamente em503/pending/enviofalse. Novos controles exigem MANUAL+ACK+200posterior e retry só leitura. Green9b5f89 EXIT0:3arquivos/43casos. Falha intermediária d5c0f7 (42/43) provou bypass de foco ao retentar leitura sem ACK; corrigido no hook, não removida a asserção.
- Focal completo39503/327ca1 EXIT0:96arquivos/1.217casos. Inclui pastaInbox inteira, Botao, Modal, guardas botoes/campos/campos-texto/confirmacoes/estados-vazios/paginacao e unit de erros; maxWorkers1/heap1024/config unit original. Sem filtros/skips novos. Mapas/parser guardas intactos.
- Lint focal23paths86cfcd EXIT0, --max-warnings=0.
- Regressão legado/DTO37553/f32280 EXIT1:4arquivos46casos40pass6fail, somente expectativas exatas do campo obrigatório faltante. Globalpausa/default e legadoPool1 passaram (2arquivos18casos); fonte desses contratos literal. Ajustadas expectativas explícitas e lista exata de chaves, sem toMatchObject enfraquecido.
- Replay DTO28 terminou pass no log inbox-357-regressao-dto-green-private.log, mas session_id se perdeu na compactação: SEM atribuir EXIT0. Log preservado como evidência incompleta. Replay original completo73007/e1174d EXIT0:2arquivos/28casos,139,01s, sem filtro de caso/skip novo. Log inbox-357-regressao-dto-terminal-private.log; o log incompleto anterior permanece preservado.

## Ambiente e pendências

Perfil ci-integracao492 e cliente/configs originais, lease exclusiva ROOT95759e; sete providers vazios só no executor. Uma suíteSQL por vez, nenhum servidor/build/HTTP/browser externo. Sem schema/package/lock/install/generate/envfile. Fixtures finais permanecem até integrador restaurar; não afirmar banco503 restaurado.

QA independente, TypeScript e gates globais originais, composição/publicação e visual ainda pendentes. Gate Root de outra composição não pertence a esta fonte. Não concluir issue/D3 inteira nem iniciar358/355.
