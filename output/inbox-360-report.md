# #360 — implementação e evidências DEV B

Status: em validação; não homologada, sem publicação pelo DEV. D5 completo continua dependente de369 e370. Branch codex/inbox-e4-360-transferir, base61a8e381a16f894f058016118ff5b5ceeb10de79 (ROOTc2b+fixture32c1). Nenhum arquivo do checkout ROOT foi editado.

## Código e limites

Controlador/popover locais e adaptador único ligam o coordenador de ConversaAberta ao fluxo. Portal desktop340 px e folha mobile usam useDialogo/ref real. Abertura/identidade/capacidades e responsável invalidam tentativas; reabrir recarrega pessoas. Callback retido, ACK antigo, dupla confirmação e desmontagem estão cobertos. Rascunho/File/compositor não são remontados. Atribuir/Fila saem só do menu do novo coordenador; APIs/consumidores históricos e atalho Aria #348 preservados.

transferencia-nucleo.ts NÃO tem use server. Atribuir histórico chama seu default; transferir setorial chama corpo extraído literal. Helpers de escopo, cancelamento e recibo são os existentes movidos. Nova action transferirPessoaInbox seleciona internamente o modo Inbox; cliente só envia id, destino, contexto e chave validados. Sem grant, CRM ou carteira novos; nenhum owner genérico autoriza conversa alheia.

Ordem pessoa Inbox: idempotência existente por autor/tipo/chave → Atendimento FOR UPDATE → ator ativo/papéis/permissões frescos → visibilidade/capatribuir → destino ativo/papel → responsável atual → replay ou update → exigirResponsavelEnxerga → cancelamento HUMANO PENDENTE/ADIADA anterior → EventoAtribuido com marca → NotaInterna se texto. Replay confere também destino no escopo e último recibo de ownership, sem escritas. Nenhum lock Acao/Config/advisory novo fora do mecanismo existente.

Setor histórico: idempotência existente → Atendimento → destinatário/matrícula/alocação/setores → encerrar → garantirAtendimento com seu advisory histórico de contexto → eventos e nota. Corpo/schema/hash/retorno preservados; ainda min12. Fila/Aria literais. A extensão369 será outro commit; grant370/494 continua somente proposta revisável em output.

Header: aplicar SOMENTE callback ref opcional ao Botao Transferir. Não copiar o arquivo inteiro sobre as três classes responsivas mais novas do ROOT. MenuConversa só tipo/import de RefCallback opcional. Registro de Botao/EstadoVazio/Campo nominal e exato, parsers/negativas genéricos intactos.

## Gates autoritativos

- UNIT ampliado final76052/75727b EXIT0:115 arquivos / 1.384 casos,91,24s. Pasta Inbox completa + Botao/Modal +2units backend +5guardas relacionadas. É recorte, NÃO global. UTC/w1/heap1024/config original.
- INT novo final21645/32bedb EXIT0:1arquivo completo14 casos/57,69s. Originalintegration/UTC/w1/1024/no-file-parallelism/seteprovidersblank. Contém os13 anteriores; não somar13+14.
- Regressão nativa26978/32a3fe EXIT0:4 arquivos completos41 casos/168,44s: atribuição, transferência, atendimento-idempotência e ações-pool. Anterior ao único novo guard do replay; fonte fora desse ramo literal. ROOT autorizou não repetir41.
- Guardas Botao/EstadoVazio86182/3447ee EXIT0:106 casos; incluídas novamente no focal final. Campos e demais guardas também incluídas no focal final.
- Lint final e0ec93 EXIT0, zero avisos, whitelist SRC completa. Sourcefreeze no recibo JSON separado. Depois dos gates, somente terminador final normalizado, sem alteração de corpo; versões nativas e hashes anteriores preservados.

## Negativos preservados

903719 opções7(4 fail);83f2c2 cascoSSR1 fail;a01350 UI2(1 fail);c7606a controller4(3 fail);6caf8f foco4(1 fail);264499 abertura/chave12(2 fail);e556a1 owner5(1 fail). Erros de scaffolding/busca de módulo não são RED de produto.

b32cc3 núcleo6(4 fail) → a5e1e0 unitentrada+nucleo9 pass. f93482 schema opcional3(1 fail). Nativo70888/8a3591 EXIT1:13(6 fail/7 pass), versão pré-extensão extraída SHAa3b5fd7b85adcef4c953544d43afe3ec9e2f13cb206478c10be11587e4bbaa88; GREEN81730/4d0330 13 pass. Novo guard de destino no replay: unitd55547 7(1 fail) → b9d5c5 7 pass; nativo15130/e589a5 EXIT1 14(1 fail/13 pass), baseline atual menos UMA chamada SHAdec47aac928fdea4d29dc80e1dfc2016d23562f0d1e11eadd6bbef8e7f39d3e2 → GREEN21645/32bedb14 pass, runtimeSHAaa5d0d15c4fdebd75f49c68839a52c0361ee8adc10381ae9554857a1dfe6182c.

Focal92619/8ed52b EXIT1:114 arquivos/1377 casos,43 fail/1334 pass. Causas: travessia de slot renderizar em2fixtures semDOM, menu faltante em mocks parciais,4exports de ícones no mock fechado e mapaCampo. Replay dirigido29be55 EXIT0 5arquivos70 casos; final115/1384 cobre a união. Ícones: mesma correção ROOT 346d8098, adicionados SOMENTE IconMessageCircle/IconMail/IconCalendar/IconCircleDot; integrar uma vez. Não houve alteração de ModalTarefa/InboxNovo por este DEV. Sem parser/exceção genérica.

## Qualificações e ambiente

SQL real e actions reais com auth/cache de teste. Só o teste de rollback injeta ErroRegra ao persistir NotaInterna; todos os writes anteriores e o rollback são PostgreSQL reais. ENVIANDO é fixture de estado, não prova de claim de worker. Nenhum dispatcher/provider/RPC externo disparado. Pool1 usa núcleo/db-aware real. Esperas usam pg_blocking_pids e barreiras, sem sleeps adivinhados.

Admissão final651722 comprovou ci-integracao/erp_genius_test_ciint/492/424 incluindo migrations/client647/zerooutrasconexões. Duas tentativas prévias abortaram por convenções erradas do próprio auditor (nomeciint e exclusão da tabela migrations), sem writes, negativas preservadas. Após13 + 41 banco liberadofec455; ROOT restauroud7dd1b. Após14 banco liberadof47392:492/424/0outras/2 Atend/2 Evento/0 Intent, fixtures declaradas, não503. Recibos output/inbox-360-replay14-liberacao-private.json e anteriores. NenhumaSQLB após liberação sem nova lease.

Configs/profile/client/package/lock preservados; nenhum install/generate/schema/envfile/build/TSC/servidor/browser/push/PR. Visual, QA independente e gates de integração/publicação continuam pendentes. Não atribuir gates ROOT578 ou outras features a este freeze.
