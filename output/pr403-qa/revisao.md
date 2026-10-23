# PR #403 — revisão C2/C3 e composição final

Gates finais aprovados na fonte741f595e1f9f32cd3511cbba6808bcd005e1c9c8:
899 arquivos/7.046 testes unitários,global53047 EXIT0,288,08s,maxWorkers2,
sem filtros/ignorados. Next typegen/TSC36894 e lint6472 EXIT0,0 erros/
40 avisos anteriores. TESTER da composição exata favorável6/85,63aaeb EXIT0;
TESTER do C3f896 favorável2/62,d60052 EXIT0. Os pareceres completos estão
versionados neste diretório. CI/main/#392B2 seguem pendentes antes do merge.

## Histórico do diagnóstico anterior ao f896

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
Global/TSC/lint da composição moderna encerraram0 conforme o fechamento
acima; ROOT liberou publicação após QA exata741 e gates. Arquivos de C3,
menu/rodapé/Conversa são byteidênticosf896; só seis produtores puro/Avatar
adicionais vêm da base402a8. Documentação final não altera essa fonte.

## Evidências visuais e seus limites

[Pacote original317](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-317-evidencias-85f.zip):
122 PNG/137 arquivos/15.823.526bytes,SHA256
`74a17180135461a99a50e6e48e45b42280ef4b804321607ce3480645ca27f4aa`.
Preserva fontes por grupo, incluindo capturas históricas317bbb/df9. Elas
não são reatribuídas ao C3f896 ou à composição741.

[Complemento menuC2](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-pr403-menu-a7.zip):
16 PNG/21 arquivos/1.677.732bytes,SHA256
`4faa6c22ef72e4614d293c869d0986aca56047ee57a5ed5eeb4800490ebaa60c`.
DEV29f e TESTERA7: atendimento individual ENCERRADO,GETs reais200,
podeEnviar=false,Nota em menu/rodapé/diálogo,foco/teclado e ausência de
gestão/envio/agenda. Sem submit de nota ou mensagem. Upload/download/hash
confirmados pelo integrador original,release mantida em rascunho.
historico-menu-a7.json registra o estado do pacote à época; a indicação
C3 ainda em correção nesse registro é histórica. O C3 final tem comprovação
separada em ReactDOM real/StrictMode,sem alegar sucesso ERP ou prova DB.

C2 mantém a regra20 existente: visualizar permite anotar, inclusive
ENCERRADO; menu separa somente notaInterna do gateaberto. Grupo continua
sem nota e demais ações/permissões/servidor permanecem iguais. As imagens
do menu são das fontes29f/A7,com controles idênticos na fonte final.
Nenhum PNG,probe,log bruto,HTML,credencial ou snapshot novo foi versionado.
