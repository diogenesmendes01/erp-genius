# PR #402 — revisão C2

Fonte funcional: `7a82506297cdbb38f9146fd4d6528a6f49c4e44e`, sobre
`d8dde4a1f948bd45bf8ae6445706dcb5e3fb1294`. Apenas hook/teste alteram o
comportamento; SPEC/quadro e este relatório documentam os gates.

O mesmo resultado não recentraliza depois de um deslocamento superior a 1px
desde a última centralização. Novo resultado centraliza. RAF pendente valida
identidade/posição, inclusive A→B com a mesma área. Foco, pin, VirtualList e
interface posicional do hook preservados. Nome interno rolagemRef permite a
inferência correta do React Compiler instalado, sem waiver de lint.

RED causal: três falhas/10 passes antes da correção. GREEN hook14/14;
recorte ampliado sete arquivos/37 testes, EXIT0. Global final: 893 arquivos/
6.977 testes, sessão30869 EXIT0, sem filtros/ignorados,236,28s. TypeScript
39739 EXIT0, lint global3582 EXIT0,0 erros/40 avisos anteriores. O primeiro
global passou antes da renomeação interna, mas o lint havia indicado dois
erros de inferência; os gates finais acima são posteriores à correção.

TESTER independente examinou o SHA exato: sete arquivos/37 testes próprios,
exec220bac EXIT0, parecer favorável à correção delimitada. Não executou
browser, DB, global ou TSC/lint próprios. A ressalva de acompanhar no ERP a
posição do selecionado após compensação automática da âncora será verificada
na composição317/319. Não identificou defeito reproduzido nessa fronteira.

Chrome de componente, sessão53385 EXIT0: hook/BuscaConversa/VirtualList/CSS
reais, ResizeObserver nativo,150 mensagens fictícias/prepend40,390/1024/1440px
nos dois temas. Manual600/foco externo/pin000/Enter/Shift/prepend preservados;
fonte anterior reproduziu600→0. Última recaptura só ajustou o texto da fixture
para herdar a cor do tema escuro; seis imagens positivas inspecionadas e
métricas conferidas. Não envolve Next/API/SSE/DB nem chamadas externas.

[ZIP positivo](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-pr402-c2-7a825062.zip):
seis PNG/nove arquivos,113.219 bytes,
SHA256 `6a30496c67a9ee472bbf4c58f34e802c8d385a35b10e460a77442094fa07753e`.
ZIP asset668148410, sidecar668148409, release421321214 mantida em rascunho;
download e hash confirmados. README, manifesto e JSON positivo identificam
fonte/limites; sem negativos, scripts, logs brutos, HTML ou credenciais.

C2 resolvido; C1 de ancestralidade/main e CI permanece separado. Sem merge
antes dos pais e do bloqueio de dependências da #392 serem resolvidos.
