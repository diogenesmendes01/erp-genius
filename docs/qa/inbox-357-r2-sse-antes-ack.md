# QA DEV A — #357 R2, SSE próprio antes do ACK

Base exata 0731267815851018749badeef684a6b36b2cc0c4, branch codex/inbox-357-r2-sse-antes-ack. Freeze #334 preservado na sua branch; não integra esta correção. Ownership do hook e Modal coordenado pelo ROOT com B358.

## Contraprova e reprodução

Oráculo independente do TESTER: original SHA256 9c2c05ed06d71f4f67ebfec2ab5c96149eadefc50eae747199fb7cfe705e065b, terminal 461bc2 EXIT 1, 8 casos/7 controles/1 falha. A cópia original em output/inbox-357-oraculo-t-original.test.ts.txt mantém os bytes; o checkout T não foi alterado. A cópia temporária própria em src/test permitiu usar a configuração ORIGINAL de Vitest, sem configurar includes/excludes especiais. Ela não é commitada.

Reprodução A a0139b EXIT 1, 1 arquivo/8 casos, mesmo negativo: handoff:null e owner atual no GET 200 do SSE antes do ACK fechavam o resumo. Próprios e três adversariais T incorporados ao teste rastreável: 441de4 EXIT 1, 5 falhas/11 controles. Não se considera o bootstrap/validação de âncora PowerShell como teste de produto.

## Correção

Somente useHandoffConversa.tsx e ModalResumoHandoff.tsx em produção. O executor registra tentativa local antes da RPC; o hook reconhece a transição própria com leitura compatível e retém exclusivamente o recibo. O Modal preserva callback em voo sem tornar contextoAtivo verdadeiro. ACK atual solicita GET posterior, sem foco antecipado. Campo e rascunho permanecem na mesma instância.

Inválidos permanentes: outra conversa/geração, handoff diferente, 404, capacidade perdida, outro responsável, desatribuição depois de posse própria observada e envio revogado. Responsável nulo ainda não confirmado não equivale a outro responsável: mantém resumo/503/retry de leitura, sem foco. Nenhuma alçada ou regra de backend foi alterada.

Primeira regressão 201a29 EXIT 1, 2 falhas/44 controles revelou essa distinção em dois controles antigos de owner nulo +503; as asserções foram preservadas. GREEN 6d6f8d EXIT 0, 3 arquivos/46 casos. Ampliação 3c0756 EXIT 0, 3 arquivos/50 casos cobre GET pendente/falho solicitado antes do ACK, erro/transporte após SSE, duplo clique, A→B→A, cancelar/reabrir/unmount, owner/capacidade/404 e campo/rascunho físico.

Primeiro recorte ampliado 39748/8a4cbc EXIT 0, 28 arquivos/731 casos. Controle adicional de envio com snapshot do mesmo handoff: fa4c44 EXIT 1, 1 falha/21 controles; guard corrigido sem mudar autorização inicial de fila. GREEN 92366b EXIT 0, 2 arquivos/44 casos. Recortes se sobrepõem e não são somados como cenários únicos.

## Validação final e limites

UTC, Node local, heap 1024, maxWorkers=1, configurações originais, seleção explícita de arquivos completos, sem filtro por nome/skips. Validação final 64182/c87215 EXIT 0: 29 arquivos completos/741 testes, 68,70s, incluindo o oráculo original por bytes (8 casos sobrepostos) e os 28 rastreados (733 testes). Lint 58b01d EXIT 0, 3 arquivos, --max-warnings=0. Nenhum filtro por nome ou skip. Nenhuma SQL, servidor, build, instalação ou envio real nesta correção. Backend/DTO/idempotência/configuração/dependências preservados na base 073; gates originais e QA independente ficam com o ROOT. Não declarar #357 homologada pelo recorte UI.

Lint inicial 3352a5 EXIT 1 detectou leitura de ref durante render. A correção mantém o token imperativo somente em handlers/efeitos e copia metadados de apresentação para estado React imutável; não há alias de ref, supressão ou regra relaxada. Focal 462bf4 EXIT 0 (2/44), lint 58b01d EXIT 0 e repetição final 64182/c87215 EXIT 0 validam a versão posterior. O primeiro final 78788/30677d (29/741) pertence à versão anterior ao ajuste de render, sem reatribuição.
