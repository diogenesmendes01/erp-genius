# PR #397 — C1: ancestralidade e produtores corrigidos

Nova base codex/inbox-e1-base-312-r3@b32b19c0 incorpora main5f476a19,
3953fc403de,39631a9b666 e os produtores #392/#393 por merges normais.
A base original6e0f6361 ficou intacta. O arquivo de prazo conserva a API
reexportada do módulo puro393; não há uso interno que exija import local.

Fonte aa99d11d74ad287833d9ce0358fe56ae0dfcba93: ItemConversa,
ListaAtendimentos e VirtualList são idênticos ao acbb revisado. A alteração
no código próprio312 é só retirar a definição duplicada de prazoEstourado
e manter o reexport puro. O relógio SSR, fallback determinístico, timer único
e fronteiras visuais não mudam. A propagação91→aa99 muda apenas os três
arquivos da correção SSE396, idênticos ao babd/ad47 aprovado.

Quadro/README conciliados preservando lista-vazia312, casca308, selo311,
pareceres e todas as linhas únicas. A verificação de cópia literal protegeu
uma linha adicional de fechamento310 antes de concluir a deduplicação.

Gates Node22.23.2, executores acompanhados até saída0:

- Global35662:863 arquivos /6.780 testes unitários, maxWorkers2, sem filtro
  ou ignorados. Integração DB é excluída dessa configuração.
- Geração de tipos Next e TypeScript29759, heap8192.
- Lint global86227:zero erros /40 avisos herdados.
- Recorte pré-SSE na91:9 arquivos /141 testes, incluindo hydrateRoot29→30
  sem mismatch e estado visual sem relógio cliente.
- Integração89303 na91:3 arquivos /29 testes completos de consultas-pagina,
  opcoes-filtro e nao-lidas, ci-integracao/erp_genius_test_ciint exclusivo,
  sem filtro/ignorados. O backend permaneceu idêntico após incorporar SSE;
  não é uma nova execução de DB no aa99 nem suíte completa de integração.

TESTER aa99 favorável:12 arquivos/162 testes mais página1/15, total13/177
próprios, saídas0. Conferiu OIDs dos componentes, helper puro e SSE, além de
hidratação29→30 em DOM mínimo. Sem novo browser/DB/global do TESTER.

As evidências visuais anteriores da fonte4b6 permanecem identificadas no
inventário remoto; não são recaptura desta composição. Não houve novo
browser próprio. Retarget/main e CI final dependem dos pais395/396/392/393
e da decisão humana392/B2. Sem pacote/lock/install/schema/envio ou deploy.
# Propagação C6 da #396

Fonte332fc7c66f65f7800c66525ef456a4608d59c5b2 por merge normal da
base312-r3@b56943c752756f2e1beacecc47bd3151377c1f28, que recebe396bc09.
Contra6e6, delta produtivo somente eventos-inbox.ts e seu teste, objetos
idênticos ao funcional01a254f5 aprovado. Item/Lista/VirtualList/prazo/hook,
backend, scripts e package/lock inalterados. Conflito só no quadro, ambas
as entradas preservadas. Sem novo DB/browser ou reatribuição de evidências.

Global final332:863 arquivos/6.788 testes unitários,sessão98604 EXIT0,
235,08s,maxWorkers2,sem filtros/ignorados. Next typegen/TSC27444 e lint44188
EXIT0,0 erros/40 avisos anteriores. TESTER da composição exata solicitado;
parecer01a anterior limita-se ao compartilhamento isolado. CI/main/#392B2
continuam gates antes do merge.
