# PR408 — comentários R1 e rastreabilidade #322

Base exata/branch local: ddf9a9bd51eb6fd54abd2a6e64381a229a25190b / codex/inbox-pr408-review-todos. Review5632791756 lida integralmente no inventário ROOT output/inbox-pr-reviews-20261023.json. Checkout b02c74 saída0 e rastreados limpos antes das três edições MD. PRs/branches publicadas e investigação324 preservadas. Nenhuma execução de banco/teste/Prisma/browser/instalação/preview/push.

| Comentário | Tratamento nesta rodada | Gate ainda necessário |
| --- | --- | --- |
| C1 HIGH quatro INT + migrations no HEAD FINAL | Plano executável abaixo e fontes/objetos atuais inventariados; não confundir os62nominais DEVb29/TESTERcea com novo aceite final. | Integrador prepara ambiente/schema/snapshot e coordena quatro arquivos completos no head final com saída terminal0 |
| C2 MEDIUM CI ausente em pilha | Sem tentativa de fabricar check run ou alterar workflow. | CI verde após composição/retarget elegível a main, no SHA final |
| C3 MEDIUM pilha/base/main e Pick | Preservar #407/#406/#405/#403 e resolver composição em ordem; dados herdados de main não são implementação322. Pick recente ItemEstadoCabecalho deve ser mantido. | Integração/retarget e gates da composição pelo integrador |
| C4 MEDIUM quadro/harness herdados | Append local preserva históricos; nenhuma edição de scripts/visual ou de conflitos hipotéticos. | Integrador resolve quadro/harness/docs dos pais sem descartar contratos |
| C5 LOW nomes diferentes do plano | SPEC recebe tabela do plano aos it/it.each reais, linhas/arquivos e oráculos; testes maiores não são renomeados nem reduzidos. | Mapa documental pronto, sujeito a QA exata |

## Fontes históricas e limites

output/inbox-322-report.md documenta DEV b29b5f4d35c8c8a87f898b2cfef26b7d689e111e: integração78268,4arquivos/62testes,173,05s,terminal0 no perfil B. output/inbox-322-integracao-final.md registra TESTERcea66f08343fe1b79ef14d70f8e17a88b3195ffd (53653/25856d,4/62,207,57s,0) e ROOTcea (global904/7118 e integração5/66+3/22,0). São registros atribuídos àquelas fontes e ambientes. Nesta revisão não foram reexecutados/verificados por conexão; não encerram C1 no head final. UI N/A nesta infraestrutura. Extensões D10 futuras permanecem fora322, sem novos campos/permissões.

## Plano coordenado para C1 — NÃO EXECUTADO

1. Congelar e registrar SHA final da composição, versão Node/Prisma e diferenças nos nove arquivos abaixo; coordenar worktree/perfil/banco e ausência de outra suíte. O perfil OWN atual é dev-email; isso não concede Ready automático nem comprova estado real do banco hoje.
2. Integrador confirma schema final, client Prisma compatível e migrations20261023100000_tarefa_atendimento/20261023110000_tarefa_atendimento_indice concluídas. Verificar colunaTEXT nullable, FK RESTRICT/CASCADE, índice btree(atendimentoId,status) exato sem predicado/indisvalid/indisready, nulidade de tarefas anteriores, snapshot E2/restauro compatíveis. CONCURRENTLY fica fora de bloco transacional. DEV não executa SQL/Prisma.
3. Com Ready explícito e transports externos vazios, executar o comando abaixo no worktree A e preservar session_id/log nominal até saída terminal. Config integração usa .erp-test-profile e rejeita ERP_TEST_PROFILE divergente; fileParallelism=false, maxWorkers1. beforeEach trunca public: snapshot E2 e janela exclusiva são pré-condições, sem seed/reset manual adicional.
4. Registrar contagem observada dos quatro arquivos completos/tempo/saída/filtros/skips, sem exigir artificialmente o total histórico62 se a composição tiver casos novos. Se falhar, manter resultado e diagnosticar; não converter ausência de execução em aceite. Integrador restaura/confronta snapshot ao liberar banco. CI/main/composição C2–C4 são gates separados.

Comando PowerShell real, executáveis locais existentes, a executar somente após Ready na fonte FINAL (não executado agora):

~~~powershell
Set-Location -LiteralPath 'C:/Users/Mendes/.codex/worktrees/inbox-dev-a/erp-genius'
$env:ERP_TEST_PROFILE = 'dev-email'
$env:MOTOR_URL = ''
$env:MOTOR_API_KEY = ''
$env:WHATSAPP_URL = ''
$env:WHATSAPP_API_KEY = ''
$env:OPENAI_API_KEY = ''
& 'C:/Users/Mendes/AppData/Local/hermes/node/node.exe' node_modules/vitest/vitest.mjs run -c vitest.integration.config.ts src/server/crm/tarefa-atendimento.int.test.ts src/server/aria/turno/executor-crm.int.test.ts src/server/crm/criar-tarefa-idempotencia.int.test.ts src/server/crm/tarefas.int.test.ts --maxWorkers=1
~~~

Não usa npx/install/npm wrapper nem URL de produção. Sem -t, exclusões ou novos skips. Ler exit do processo executor, não somente a saída textual do Vitest. A seleção explícita não é suíte de integração global. O integrador poderá usar o próprio worktree/perfil exclusivo com o MESMO recorte e atribuição nominal; não sobrescrever perfil local para contornar divergência.

## Mapa dos quatro arquivos

A tabela principal/plano→nomes está em docs/specs/inbox-tarefa-atendimento.md, seção PR408R1. Caminhos reais confirmados por leitura (7cefb1/c594eb/fc8031), sem rodar/importar configuração de banco:

- crm/tarefa-atendimento.int.test.ts:14casos nominais expandidos, com vínculo/payloadnull/escopo/revogação/CRM/edição/replay/conflito/concorrência/hash legado/chave curta. A tabela da SPEC aponta cada nome relevante.
- aria/turno/executor-crm.int.test.ts: tarefa_com_origem_aria; tarefa da Aria usa o atendimento do turno também no evento, sem confiar em campo da proposta; tarefa sem oportunidade conserva o atendimento e responsável nulo; it.each tarefa %s não persiste tarefa nem evento efetivo (SUGERIR/SHADOW/NEGAR); rollback da tarefa da Aria não deixa tarefa, evento nem ação. Executar arquivo completo inclui regressões de etapa/tag/nota/agendamento/desconto/campo/reversibilidade.
- crm/criar-tarefa-idempotencia.int.test.ts: os cinco it reais estão transcritos no mapa da SPEC e permanecem integrais.
- crm/tarefas.int.test.ts,15it completos: vendedor cria só para si; o setor vem do papel; vínculo a oportunidade fora da carteira é recusado; gerente atribui à equipe, mas não a quem não é da equipe; horário sem data, título vazio e escola sem fuso são recusados; vê as minhas e a fila do setor; equipe só com o interruptor; não edita tarefa fora do escopo; versão desatualizada é recusada; concluir ligação com resultado registra InteracaoRegistrada na oportunidade; reabrir devolve a tarefa à fila de abertas; reagendar recalcula o instante; cancelar não apaga; secretaria assume tarefa da fila do setor; editar só o título não rearma o lembrete já disparado; reenviar o mesmo agendamento junto com o título não rearma o lembrete; trocar a hora recalcula lembrarEm e rearma o lembrete; limpar data, hora e lembrete juntos, como o painel faz; inclui as abertas atrasadas antes do intervalo, mas não as concluídas. Ponto e vírgula faz parte de vários nomes, não separa casos novos.

## Identidade executável/schema/testes

Objetos e SHA256 de disco em ddf foram lidos em fc8031; nenhuma comparação exige banco. Os produtores, quatro testes e três arquivos Prisma/SQL devem permanecer idênticos nesta revisão MD. Ledger gerado abaixo com os objetos Git da base e SHA256 dos bytes locais (CRLF de checkout pode diferir do blob normalizado). Nenhum artefato/PNG/harness novo é incluído.

| Arquivo | Git blob ddf | SHA256 local |
| --- | --- | --- |
| src/server/crm/tarefas.ts | 723b4d917f26bf13e9ec930b8294a130c1fb8cda | 4d9cce5881616d43ca0ddff8394b666dbd279b8deab863ab0502fbc5f1fb2850 |
| src/server/aria/turno/executor.ts | b3b74732a2544814dae2e6a631c0d3d179815c63 | 07c316f22d6d8303b246a39bbaef3db231de73c686921f08878ad62abff3d614 |
| src/server/crm/tarefa-atendimento.int.test.ts | 62122bfdb388d0b8b88da522ad526a7b9b4d12ac | 513e93f9976a837ec6504d74eff4871b109d2cc2264a79d15d3a29d91476a874 |
| src/server/aria/turno/executor-crm.int.test.ts | 1d36c3e2d97b64aeebb56cf45d49df3bcf79fc0f | a69fc2088f3051c42e63f754baa50eba0c6ca593d326715f83decfe635cd67cb |
| src/server/crm/criar-tarefa-idempotencia.int.test.ts | 3f6ef2d5274ef022ed2f204818a4321cadb734b1 | 97909791a5ed187ba67d2310525cad2a1b4117ac32f1eaf56ba847a0ebe8494f |
| src/server/crm/tarefas.int.test.ts | 04aa8c0b2147c78269cfff59cfd4db0ac28a2e59 | a5fe77cb8c2de553cd07fe27f912caeb17e1392973a395108fc146cd3bf100ff |
| prisma/schema.prisma | 1f575691cde242124c1493b8406121e8830a6f7e | 82756077ef0cee1e56e839134e148f90ad404131c26de107cb00f936372363b3 |
| prisma/migrations/20261023100000_tarefa_atendimento/migration.sql | 8a881162eb2c3a95379ca82a7f0ffc18279996a0 | 40aabd258e58320de9bd4ca99ae8b3547109a30691b68e54909fccc89e8f1fc8 |
| prisma/migrations/20261023110000_tarefa_atendimento_indice/migration.sql | 19db3bedf7834d6ddd5b04e25a5f624d23f83509 | 741196c6f3a78a91b5987a75bcda9a72057ecbfa21af13e5ed764af653be1aed |

## Fechamento desta entrega MD

15e303: git diff --check saída0; git diff --quiet ddf -- src scripts prisma package.json package-lock.json saída0. O recorte inclui todo src (produtores e testes) e toda prisma (schema/migrations/SQL), não somente os nove arquivos inventariados. Sem execução nova de unitários/INT/TSC/lint: texto documental não altera o objeto executável e C1 deve ser nominal ao head final, após Ready separado. Allowlist do commit: esta MD, SPEC inbox-tarefa-atendimento e quadro-entregas. C1–C4 permanecem pendentes do integrador; nenhuma homologação/CI presumida.
