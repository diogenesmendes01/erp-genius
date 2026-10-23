# PR #403 — pré-integração local, publicação bloqueada

Base nova317-r3:a8dba58c443ff24be4745e51aab47abed9c4cf2a, head402 moderno.
Fonte recebida do DEV:A7 a7ebf56b4fb3391d1013ff776086616c46bb13c1,
com C3b6e03201 e C2menu29f0e3ec. Esta composição recebe seis arquivos
de prazo puro/Avatar/testes; Compositor, coordenador e menu permanecem
byte a byte iguaisA7. Conflitos apenas no quadro e em status de gates
do C6; a SPEC recebe o fechamento real do C6 no lugar do pending antigo.

Recorte inicial da composição:8 arquivos/93 testes EXIT0,d80a20.
O recorte verde não encerra a revisão: contraexemplo adicional C3 reproduzido
em ReactDOM/StrictMode no mesmo harness,sem mudar implementação:

1.Enviar texto emA e manter o resultado pendente.
2.IrB e voltarA sem editar ou anexar arquivo.
3.Concluir a tentativa original com ok.
4.O armazenamentoA ainda contém o texto confirmado; ele pode ressurgir.

Casos responder e nota falharam,10 casos originais passaram,executor612276
EXIT1. Log privado pr403-review-retorno-red.log. O novo owner revoga a
autorização antiga mesmo sem edição; os testes anteriores A→B→A cobriam
edição/arquivo posterior,mas não esse caso sem nova intenção.
Os dois casos exploratórios foram retirados literalmente após a prova,
restaurando o arquivo originalA7; o DEV recebeu o contraexemplo e fará
a correção isolada, preservando edição posterior/desmontagem do Inbox.

Sem global403 nesta fonte provisória e sem push. Aguardar correção residual,
QA/artefato complementar e liberação do integrador original antes de publicar.
Head remoto403 permanece32f9222d; nenhuma mensagem real ou DB executado.

## Residual corrigido, composição final em gates

DEV entregou f896c306d474f76038c3b6c4425c4b0a214a4b6c sobreA7. Token
lógico da intenção persiste no retorno sem edição, separado do owner;
confirmação notifica o editor atual compatível para limpar campo+storage.
Texto/emoji/arquivo posterior, inclusive editar e voltar ao mesmo texto,
revogam essa autorização. Cleanup do Inbox e contextos/modos mantêm isolamento.
Sem formato de storage novo, mapa global ou alteração de servidor.

Os dois contraexemplos do integrador foram repetidos na fonte nova com
oráculo adicional do campo visível:19 testes passaram,ae412b EXIT0.
O acréscimo exploratório foi retirado restaurando o blob indexado exatof896;
o source oficial contém17 testesReact reais/StrictMode. Recorte final da
composição:8 arquivos/100 testes,344b38 EXIT0. TESTERf896 favorável em
2 arquivos/62 testes próprios,d60052 EXIT0,sem DB/browser/global.
Global/TSC/lint da composição moderna e liberação de publicação ainda pendentes.
