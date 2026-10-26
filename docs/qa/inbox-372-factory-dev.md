# QA DEV #372 — fase2 parcial da factory

Não é entrega completa D9. Owner aguarda resposta humana; kernel/endpoint/saudação não implementados. Banco B500: nenhuma SQLDEV ou lease nesta fase. Schema/client500 preparados ROOT; não usar restaurador496.

| Evidência | Resultado | Limite |
| --- | --- | --- |
| Baseline captura 28c468 | EXIT0,4/4 | Função real, código/evento/tx mockados |
| Scaffold62ebfc | EXIT1,4falhas | Duas leituras semcall eram TypeError; preservado |
| RED0f590c | EXIT1,4asserções falham | Quatro contratos de factory ausentes |
| GREEN1bdde0 | EXIT0,2arquivos/8 | Factory4 +captura4, sem SQL |
| Lint S24479/7d81a6 | EXIT0,4paths,0erros/avisos | Dois produtivos +dois UNIT; não global |

Executores originais locais, UTC, heap1024, maxWorkers1, sete providers stringvazia antes imports, nenhum filtro de caso/skips. Terminais observados até saída; sem processo desacoplado. Lint com stdout vazio pode não criar Tee file; nenhum hash de log inexistente é alegado.

R2 transfere telefoneE164 explícito já normalizado, inclusive null do global; dados raw não são reinterpretados. Código gerado pelo caller, payloads globais preservados. Extração exata de bloco: Sourceproof inversa do acoes.ts retorna bytes anteriores. Sem alteração de gerarCodigo.ts, normalização/DDI, política CRM, captura/inbound,435 ou escopo/grants. Proposta histórica de variávellivre foi corrigida antes de aplicação; versões1 TXT preservadas.

Testes UNIT protegem os valores e a propagação de erro, mas não são prova de atomicidade/rollbackSQL ou autorizaçãofresh. Native4 CRM ainda NÃO EXECUTADOS e só contarão após leaseB500/configoriginal/terminal0. Concurrency/pool1/tryPhone/UNIQUE/owner revogado e demais casos do kernel ainda precisam autoria/GO/execução. Não somar20pure anteriores como se mesmo recorte/global.

Publicação só ROOT/delta pertinente; ancestrais privados não publicáveis. Sem PR/push/instalação/generate/DDL do DEV. Ownerpendente não inferido. QA independente/visual/CI/global/TSC/build pendentes.

## Atualização após nativo4 autorizado

S82866/ee26e2 EXIT0, arquivo COMPLETO criar-lead-caracterizacao-372.int.test.ts,4/4,12.20s. Freeze c8655a71/HEAD02aab e8pins conferidos antes e depois byteiguais. Config original vitest.integration.config.ts,UTC/w1heap1024/no-file-parallelism/seteprovidersvaziosantesimports,semfiltro/skips. Nativo confirma defaults/dono/código singleton/payloads do CRM após a extração, NÃO o novo kernelD9/pool1/concurrency/freshACL do futuro fluxo.

Lease liberada imediatamente; ROOT confirmou restauro B500 b56483 EXIT0, hashes/snapshot preservados/zerooutrosatores e lease revogada. Não inferido pelo DEV. SemnovaSQL. Recibo output/inbox-372-native4-release-private.json SHAc51ea494ac159e99799916c3ecc042f52e6a7a3332898f214843f0663cdc8cdc; log8e70875d0ff341b6f70e7e08b50c44e807155df304a58d9b0808ca32a17d875a.

Checkpointsparciais fase1/factory têm whitelists separadas. #372 ainda não concluída: ownerpendente/kernel/endpoint/causais/pool1/visual/QA/global/TSC/CI.

## #372 — recuperação inbound R8, recorte parcial verificado em 26/10/2026

Proposta literal output/inbox-372-inbound-recuperacao-r8.diff.txt SHA256 0d868c8a66fc63afc58793c3b205cdcfd6ab19c95f75eac3494034f4feb0ff58 aplicada somente a src/server/whatsapp/inbound.ts. Fonte anterior 74fcdf100865e25e215296314673a155b3551bc5ecdd08ffc4582111364f4a0c; fonte R8 49df1db29d00900368c3c9ef2554eeafad928f9be8e1948d4ccc84faa21732f9. Dos 28 pins do manifesto f0d5b4e901b9e27e028e0b5368066175aa97b483001908e9ae22ccd40236ff7c, apenas inbound mudou como autorizado; UNIT22 e outros 27 pins preservados.

Somente PrismaClientKnownRequestError P2002 de ContatoWhatsApp com target array exato [telefoneE164] autoriza uma nova transação, depois do rollback da primeira. Não há terceira tentativa. P2002 de MensagemWhatsApp com target array exato [numeroId, providerMessageId] só retorna duplicada após lookup independente confirmar a mensagem persistida depois do rollback. Outros modelos, targets, códigos, rede e segunda falha propagam. Anchors são locais por tentativa; apenas a transação confirmada agenda um efeito pós-commit. Falha do agendamento não volta ao retry/dedupe.

Negativos preservados: UNIT22 RED b8e6ed teve 16 falhas de asserção e seis aprovações, com fixture completa; R7 inbound3 EXIT1 teve um aprovado e dois falhos. NOVO-first Contact P2002 capturado pelo catch amplo foi causal; observer inbound-first/P2028 não foi fechado como causa e não foi chamado deadlock. Não houve aumento de timeout. Native1 adversarial anterior ao patch, d7d9e2 EXIT0, arquivo completo inbound-provider-concorrencia-372.int.test.ts, um caso, confirmou três PIDs, blocker/query INSERT real e P2002 MensagemWhatsApp target [numeroId, providerMessageId]. Esse caso usa contatos/conversas distintos no mesmo número/provider e não prova retry natural do mesmo contato. Artefato sanitizado OS.tmp erp-372-provider-aqHlCH/mensagem-error.json SHA256 45015a343715f5574b85870faf70b48b3e306efd516102b8d094ae6f3a8c298b. ROOT informou restauro B ca0466 EXIT0 depois desse native1.

GREEN R8: executor 3d89a7 EXIT0, config unitária original, arquivo completo inbound-recuperacao-372.test.ts, 22/22, 423 ms, sem filtro/skips; Prisma mockado e DATABASE_URL localhost:1, sem SQL. Lint só inbound.ts --max-warnings 0, fa76c7 EXIT0. Node hermes explícito, UTC, heap1024, um worker, sete providers vazios antes dos imports. Ambos executores retornaram código final sem sessão pendente. Não é suíte global nem validação nativa da R8. Novos nativos, TRO da fonte nova, TSC/global/CI, decisão humana owner e demais entregas #372 permanecem pendentes. Sem commit/push/merge/deploy ou homologação presumida; Node/SQL em HOLD até novo GO ROOT.
## #372 — checkpoint local parcial NOVO + recuperação inbound, 26/10/2026

Após R8, seis arquivos INT distintos completos deram EXIT0: inbound concorrência3 350a0c, provider1 694330, replay3 edae92, CRM2 3bb56b, FK3 0cca82 e triagem Aria original4 sessão69953/c37b84→31b99a, total16casos. Unitários distintos: recuperação22 3d89a7 + inbound original2 4d971a =24casos; lint inbound fa76c7 EXIT0. Não é suíte global. Todos sem filtro/skips, configs originais, hermes explícito/UTC/heap1024/w1/sete providers vazios. ROOT informou restauro final B0cd81f EXIT0; lease SQL encerrada. Relatório curado privado output/inbox-372-pos-r8-recibo-curado-r10-dev-b.md preserva fontes, negativos e limites.

Negativos UNIT22 RED16fail/6pass e R7 inbound3 1pass/2fail permanecem. Catch amplo convertendo ContactP2002 em duplicada foi causal em NOVO-first; observer/P2028 inbound-first não teve causa fechada, sem inferir deadlock nem aumentar timeout. Native adversarial pré-R8 de provider não é retry natural do mesmo contato. Evidência causal R9 registrou bloqueio/3PIDs nas duas ordens e ContactP2002 exato; provider pós-R8 confirmou P2002 MensagemWhatsApp exato. FonteR8 49df1db29d00900368c3c9ef2554eeafad928f9be8e1948d4ccc84faa21732f9; novos testes imutáveis. TRO R8 aplicado favorável b97ac340 informado ROOT; revisão whitelist77efd aprovada ROOTc4f8d7 para checkpoint LOCAL PARCIAL, sem PR/publicação/issue completa.

Checkpoint proposto limita-se a quatro produtivos, dez novos testes e três documentos. AGENTS histórico, output privado, schema/deps/configs e ancestrais Grant excluídos. TSC próprio --noEmit --incremental false e lint dos14TS são gates antes do commit, ainda sem atribuir resultado futuro neste registro. CI/global/build/QA do checkpoint e integração de delta com pré-requisitos continuam sob ROOT. Decisão humana D9 owner pendente; #372 não concluída, sem homologação presumida.
### Gate de tipagem e alinhamento de harness antes do checkpoint

TSC inicial heap1024 400f09 EXIT134 esgotou heap, sem diagnóstico de código. Repetição heap8192 sessão55116/be587f EXIT2 revelou nulabilidade em inbound e três canários nativos, além de três harnesses da baseline. Ajustes autorizados: alias estável não nulo após o guard da única leitura da linha; const contato + throw canário antes do uso nos nativos novo/unique/pool1. Nenhuma asserção de negócio, timeout ou fluxo mudou. Três harnesses baseline receberam apenas Array.from(NodeList).find, props tipada com children:null mantendo filho React real e Record<string,string>[] nos headers inválidos; ficam separados da frente372 e não serão republicados pelo ROOT.

Após ajustes: TSC --noEmit --incremental false/config original/heap8192 sessão24612/3fc21a→0f93e8 EXIT0; focal cinco arquivos unitários completos92e654 EXIT0,65/65 (três harnesses + inbound original + recuperação22), sem filtro/skips; lint17TS (14 da whitelist372 +3baseline)7536de EXIT0, nenhuma saída/aviso reportado. O focal65 não é suíte global e se sobrepõe aos24UNIT anteriores. Fonte inbound agora0116643419fce01a25be6c302f3c98ba71949bb08c71b356d060070400fcda0b; as evidências SQL R9 continuam atribuídas à fonte49df anterior. Três nativos com canários modificados precisam nova admissão e execução, não reatribuídos. Checkpoint ainda sem commit; aguarda refreeze/revisão ROOT e GO. Sem SQL desde liberação final, sem novos endpoints/UI/ACL370 ou decisão owner presumida.
### Recibo final R11 — nativos com canários e checkpoint parcial

Após admissão ROOTe0e7d4/TRO7 favorável informado, os três arquivos completos com canários R11 passaram em série: nova-conversa-novo.int.test.ts 8/8 5b91d6 EXIT0 (5,66s); unique-concorrencia 2/2 1b6cf6 EXIT0 (5,07s); pool1 1/1 7f15ca EXIT0 (4,88s). Sem filtros/skips, originalintegration UTC7blankhermesheap1024w1/no-file-parallelism/escalated, fontes/asserts/timeouts intactos; sem helpers extra ou outra SQL. Os35pinsR11 foram conferidos antes de atualizar somente estes três documentos. Banco liberado para ROOT após a terceira saída0; restauro final desta janela deve ser atribuído ao recibo ROOT próprio.

Fonte inbound alias011664 e canários novo80a395/uniquee40bd6/pool18b6069 agora têm gates atuais TSC0 sessão24612, focal5/65 92e654, lint17TS7536de e nativos3/11 acima. Os seis INT/16 R8 anteriores mantêm atribuição à fonte49df, cujo delta atual é só alias não nulo sem nova leitura/runtime de negócio. Não chamar soma desses recortes de suíte global nem atribuir todos à mesma execução. OOM1024, TSC2, UNITRED16/6 e R7negativo/causa parcial continuam registrados.

Checkpoint LOCAL PARCIAL autorizado: baseline3 de tipagem separada e feature372 de17caminhos (4produção/10novostestes/3docs), sem output/AGENTS/schema/deps/config/privados. Nenhum push/PR/merge/deploy. ROOT extrairá delta com pré-requisitos, sem importar ancestrais Grant. OwnerD9, EXISTENTE/actions/UI, QA exata do checkpoint, integração e CI/global continuam pendentes; não fechar issue nem presumir homologação.