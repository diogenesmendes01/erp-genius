# #298 — PainelSetor e componentes isolados: verificação visual complementar

Fonte antes: `3dbd3df803ef840bf2190cec9d4fc98d4a05a755`, servidor `localhost:3108`, banco descartável `integracao`. Fonte depois do aplicativo: `815d863de66982505026980faa786290211a6ae1`, servidor `localhost:3109`, banco descartável `tester`. Capturas de Enquete/Reserva pelo harness do DEV, cuja métrica declara fonte depois `8f26101e6d194bb1be4ddb303f71a2e8a60828fa`; código de produção desses componentes idêntico até `815d863d` segundo o diff revisado.

## PainelSetor no aplicativo

Comandos `node output/capturar-inbox-298-painel.mjs painel-antes http://localhost:3108` (sessão `99005`, exit 0) e `node output/capturar-inbox-298-painel.mjs painel-depois http://localhost:3109` (sessão `37656`, exit 0). Seis capturas antes e seis depois em `output/inbox-capturas/painel-antes/` e `painel-depois/`, com manifestos JSON. Conversa fictícia; 1440×900 mostra coluna de detalhes, 1024×768 e 390×844 mostram gaveta após clicar “Detalhes da conversa”; temas claro/escuro. `pageerror=[]` em todos os contextos.

Os rótulos secundários Oportunidade, Etapa e Valor mostram hierarquia menor e continuam legíveis. “Etapa” antes tinha classe `text-muted-foreground` mas herdava cor de texto integral (`rgb(10,10,10)` claro; `rgb(250,250,250)` escuro); depois usa `text-gray-600` com `rgba(0,0,0,0.6)` claro e `rgba(255,255,255,0.6)` escuro nos seis contextos. Coluna/gaveta, títulos e botões continuam presentes. Em 390px, Oportunidade/Novo/Sem valor ficam cortados à direita tanto antes quanto depois: limitação preexistente, sem regressão de #298. A sobreposição vermelha de 1–2 issues é do Next dev server; o capturador não registrou `pageerror`.

## EnqueteLeitura e Reserva — componente real isolado

Inspecionei visualmente as 12 imagens “depois” em `output/inbox-298-visual/`: ambos componentes em 1440×900, 1024×768 e 390×844, claro e escuro. Textos e estados legíveis, sem corte nesses componentes. Enquete mostra barras verdes de votação; Reserva mostra cartão cinza “Aguardando execução”. `metricas.json` confirma cores computadas: Enquete transparente antes → `rgb(27,135,85)` claro / `rgb(33,192,99)` escuro depois; Reserva transparente antes → `rgb(237,237,237)` claro / `rgb(42,44,44)` escuro depois. O harness usa JSX real extraído por AST e CSS/Tailwind reais; Reserva injeta dados/estado fictícios. Isso valida a apresentação de cores solicitada, mas não homologa envio de enquete nem operação de devolução financeira, cujos comportamentos não mudaram nesta issue.

**Parecer visual #298:** favorável no escopo de cor, com ressalva do recorte já existente da gaveta móvel. Parecer de código/testes em `output/inbox-298-botoes-review-r4.md`; delta final documental/harness será conferido à parte.
