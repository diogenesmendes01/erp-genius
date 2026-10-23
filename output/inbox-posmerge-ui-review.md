# Follow-ups UI pós-merge — DEV A

Base4829a27424c2cf6091f5f7c5ea545a888fc0be06, branch codex/inbox-review-posmerge-ui; dc726409 e inventário c246 preservados. Escopo autorizado:384C3acessibilidade/variável,385C3caminhos de manifestos,395C6Escape em coluna. Commits separados por área. Nada deDB/Prisma/browser/preview/instalação/schema/package/lock/PNG/merge/push. Dados de negócio/capacidades/Aria/Assumir preservados.

## Primeiro commit — PR384 C3

Review5620875398, reclassificação6353905866LOW. livre/temcapacidade era só nome local; small real sem relação programática. useId incondicional por compositor +sufixo recurso, aria-describedby no botão e id no small, temCapacidade. Textos/rótulos e disabled não mudam. Testes semânticos com ReactDOM/StrictMode verificam motivos reais,6IDs únicos/2instâncias e IDs estáveis ao trocar capacidades/reabrir. Não testa AT/browser/CSS.

- RED19dbfc:19casos/2falhas de aria-describedby,17C3anteriorespassaram. Não houve falha de produção diferente fabricada.
- GREEN8cb009:2arquivos/64testes0 (19ReactDOM/StrictMode+45controlados), maxWorkers2, sem-t/skipsnovos. MocklocaluseId usa g.useId jáexistente; tela-sem-dom/dom-minimo compartilhados não mudaram.
- Regressão guardas/rodapé98408 (11841a→6420b1):8arquivos/145testes0,11,58s. RodapeConversaSSR/interação,ConversaAberta.rodape,botoes,fundo,identificacao,paleta,campos-texto. Sensores/registros globais intactos.
- Lint3arquivosb2079f saída0 --max-warnings0. TSCheap8192 sessão22022→93e8f3 TERMINAL0.

Próximos385/395 não entram neste primeiro commit. Sem novas capturas; imagens antigas não são QA deste semântico. Integrador fará composição/QA final.

C2LOW384 incorporado como tabela Task6→nomes reais na SPEC, por autorização ROOT: capacidade completa, handler de cada item habilitado, semmotor, capacidades parciais e ausência na Nota. Não renomeou/reduziu testes. Diffcheck e allowlist conferidos antes do commit; QAexata/integrador posteriores.


## Segundo commit — PR385 C3 (referências históricas)

Review5621078861/C3, reclassificação6353905551LOW. Foram corrigidos somente os quatro caminhos nas linhas7/11 do parecer output/inbox-305-visual/qa/inbox-305-review.md: menu-mensagem-antes/depois e menu-mensagem-motor-antes/depois saem de inbox-capturas e apontam para inbox-305-visual. Test-Path e git ls-files confirmaram que todos os destinos são reais/rastreados antes da edição(d4dce3); validação repetida no próprio patch. OIDs dos manifestos, inalterados: antes1e054adba3162a9e1798fa3b2e61e57d966cf05b; depoisba9619eb93e4e9ac61d007d3a832b3fa9000014a; motorantesdc12ce86f5f7d841e6c2bb5203470ac11e096d60; motordepois30a70728bbabed9f57ea91d985684303e3b13565.

Não edita a autoria, fontes/SHAs, números, limites ou conclusões históricas do TESTER e não reinspeciona fotos/ZIP. Apenas este parecer, relatório e quadro mudam; nenhum PNG/manifesto/harness/src/schema/deps. Diffcheck/identidade contra50a4 antesdo commit; não repetir TSC/unit/lint de produção por MD. Outros mapas/whitespace do lote seguem ROOT, não foram absorvidos nesta mudança.


## Terceiro commit — PR395 C6 (Escape e intenção do editor)

ACK técnico/humano recebido do integrador: manter Escape normal fechando inclusive no input, com mesma montagem/rascunho, mas respeitar editor filho que consumiu o evento. Não ignorar inputs por tipo, não mudar helperdialogo/Aria/Assumir. Produção altera uma condição local PainelContato: sobreposto || e.defaultPrevented || key!==Escape. Guardas existentes de diálogo/alertdialog/portal intactos; comportamento modal continua existente. Sem ampliar para IME/controle nativo por hipótese.

Testes ReactDOM no arquivo existente PainelContato.interacao.test.ts: o positivo digita valor no input, Escape fecha e foca gatilho, reabrir conserva o MESMO nó/valor; o negativo entrega preventDefault num onKeyDown de editor filho, painel permanece aberto e foco/valor continuam. Fixture local agora reflete defaultPrevented de um evento nativo, sem modificar dom-minimo/dialogo globais.9casos antigos foram preservados (sobreposição/Tab/Escape/dialogofilho/isolamento/resize/abas).

RED2bbd1e saída1:11casos/1falha consumido,10passes; GREENc06e2b11/11saída0. Gate combinado final10690(68f11b→d629e6)11arquivos/288testes,17,80s,maxWorkers2, saída0, sem-t/skipsnovos: Compositor/C3reais, PainelContatoSSR/interação, dialogoSSR/interação/retorno, botoes/identificacao/confirmacoes/fundo. TSC58024(596fb7→e8d12f)heap8192saída0; lint71decb5fontesalteradas/max0saída0. Fonte não foi editada enquanto gates ativos; sóMD depois.

SemDB/browser/preview/PNG/envio/Prisma/install/global/push/merge. É prova de ciclo/evento/foco em ReactDOM real sobre DOMmínimo, não medição CSS ou AT. SPEC395 inbox-casca-tela-cheia explicita a decisão, Sem alteração de menus/editor de terceiros ou autorização. Integrador fará QAexata/composição/CI.

## Allowlist e preservação final

Somente três áreas autorizadas nesta branch:384C2/C3 (primeiro50a4a64996eddd024bdd8141d4c5732d07533584),385C3MD(segundo652d43a4e66fa23480f8547f59856744c9576caf),395C6(terceirocommit). PNGs299/302/303 e demais itens da auditoria continuam intocados por este DEV. Report privado de auditoria c246 permanece congelado; dc726409 e investigações324 preservados nas própriasrefs. src/lib/dialogo.ts,dom-minimo,tela-sem-dom,guardas,backend,Prisma/schema/migrations,scripts/harness,package/lock não foram editados. Únicasfontesalteradas:Compositor.tsx/test/controlado+rascunhoReactDOM ePainelContato.tsx/interacao. O único testeauxiliar de useId chama a API jáexistente do harness. Finaldiffcheck e identidade dos caminhos excluídos conferidos antes do commit; não representam novaexecução global.
