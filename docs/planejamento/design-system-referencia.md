# Design system reutilizável — referência visual e CSS

**Versão deste documento:** 1.0 · **Data:** 14/10/2026 · **Base observada:** WhatsApp Desktop 2.2638.102.0 x64 e sua superfície web capturada em 13/10/2026.

Este arquivo reúne cores, tipografia, geometria, estados e receitas para construir outra aplicação com a mesma linguagem visual: superfícies neutras, verde como destaque, controles arredondados e alta densidade de informação. Os nomes de tokens e classes abaixo são genéricos. O CSS não depende de React, do WhatsApp, de serviços de mensagens ou do carregador interno do produto original.

Há três níveis de proveniência:

- **R — recuperado:** valor literal presente nos tokens/CSS ou recursos capturados do produto de referência.
- **L — implementação local:** valor presente em `web/src/styles.css` ou comportamento implementado no frontend deste repositório; não constitui comprovação de fidelidade ao original.
- **A — adaptação:** organização semântica, escala consolidada ou recomendação proposta para uso em outra aplicação.

O mapeamento para nomes como `--color-surface` é **A**; os valores da tabela de cores são **R**. As receitas são **A**, informadas pelos valores recuperados e pelos componentes locais. Não representam uma exportação oficial de componentes prontos.

## 1. Como usar em outra aplicação

1. Copie o CSS da seção 8 para uma folha global do seu projeto.
2. Use tema claro por padrão e aplique `data-theme="dark"` ao elemento `<html>` para o escuro. Para tema automático, sua aplicação deve acompanhar `prefers-color-scheme` e atualizar esse atributo.
3. Copie a fonte opcional para `assets/roboto-variable.woff2`, ajustando a URL do `@font-face` ao local da sua folha CSS. Sem o arquivo, a pilha de fontes do sistema funciona como fallback.
4. Adote os nomes semânticos e as receitas; substitua conteúdo, ícones, identidade e regras de negócio pelos da sua aplicação.
5. Implemente foco, teclado, validação, loading e responsividade conforme o contrato dos componentes. CSS sozinho não implementa esses comportamentos.

**O Markdown não incorpora fontes, ícones ou wallpaper.** Os valores e exemplos podem ser transportados sozinhos. Para levar os arquivos binários e a evidência completa, use o [pacote recuperado v3](analysis/whatsapp-design-system-recuperado-v3.zip) e os [assets locais](web/public/assets/). Os links deste documento são relativos à raiz deste repositório; ao transportar apenas o MD, copie também os arquivos de interesse ou atualize os links.

## 2. Cores semânticas — claro e escuro

Valores literais de [tokens-by-theme.json](analysis/design-system/web/tokens-by-theme.json), sem converter transparências em cores opacas. RGBA deve ser composto sobre a superfície de destino. O token `highlight`, por exemplo, é uma camada de interação, não uma cor independente de fundo.

| Token portátil | Uso | Claro | Escuro | Token original R |
| --- | --- | --- | --- | --- |
| `--color-page` | Fundo da aplicação | `#FFFFFF` | `#161717` | `--WDS-background-wash-plain` |
| `--color-page-inset` | Área de fundo recuada | `#F7F5F3` | `#161717` | `--WDS-background-wash-inset` |
| `--color-surface` | Superfície principal | `#FFFFFF` | `#161717` | `--WDS-surface-default` |
| `--color-surface-alt` | Superfície enfatizada | `#F7F5F3` | `#1D1F1F` | `--WDS-surface-emphasized` |
| `--color-surface-raised` | Popover/cartão elevado | `#FFFFFF` | `#1D1F1F` | `--WDS-surface-elevated-default` |
| `--color-highlight` | Camada de hover | `rgba(194, 189, 184, .15)` | `rgba(255, 255, 255, .1)` | `--WDS-surface-highlight` |
| `--color-pressed` | Camada de pressão | `rgba(0, 0, 0, .2)` | `rgba(255, 255, 255, .2)` | `--WDS-surface-pressed` |
| `--color-text` | Conteúdo principal | `#0A0A0A` | `#FAFAFA` | `--WDS-content-default` |
| `--color-text-muted` | Conteúdo secundário | `rgba(0, 0, 0, .6)` | `rgba(255, 255, 255, .6)` | `--WDS-content-deemphasized` |
| `--color-text-disabled` | Conteúdo indisponível | `#BDBDBD` | `#424445` | `--WDS-content-disabled` |
| `--color-on-accent` | Conteúdo sobre destaque | `#FFFFFF` | `#0A0A0A` | `--WDS-content-on-accent` |
| `--color-accent` | Destaque de marca/estado | `#1DAA61` | `#21C063` | `--WDS-accent` |
| `--color-accent-soft` | Seleção suave | `#D9FDD3` | `#103529` | `--WDS-accent-deemphasized` |
| `--color-accent-strong` | Conteúdo em seleção suave | `#15603E` | `#D9FDD3` | `--WDS-accent-emphasized` |
| `--color-action` | Ação enfatizada | `#1B8755` | `#21C063` | `--WDS-content-action-emphasized` |
| `--color-link` | Links | `#1B8755` | `#21C063` | `--WDS-content-external-link` |
| `--color-info` | Indicador informativo/leitura | `#007BFC` | `#53BDEB` | `--WDS-content-read` |
| `--color-danger` | Indicador de erro/destruição | `#EA0038` | `#FB5061` | `--WDS-secondary-negative` |
| `--color-danger-soft` | Fundo de aviso de erro | `#FDE8EB` | `#321622` | `--WDS-secondary-negative-deemphasized` |
| `--color-success` | Indicador positivo | `#1DAA61` | `#71EB85` | `--WDS-secondary-positive` |
| `--color-warning` | Indicador de atenção | `#FFB938` | `#FFD279` | `--WDS-secondary-warning` |
| `--color-warning-soft` | Fundo de aviso | `#FFF7E5` | `#362C1F` | `--WDS-secondary-warning-deemphasized` |
| `--color-divider` | Separadores sutis | `rgba(0, 0, 0, .1)` | `rgba(255, 255, 255, .1)` | `--WDS-lines-divider` |
| `--color-outline` | Borda de campo/controle | `#959393` | `#757778` | `--WDS-lines-outline-default` |
| `--color-outline-soft` | Borda de menor ênfase | `rgba(0, 0, 0, .2)` | `rgba(255, 255, 255, .1)` | `--WDS-lines-outline-deemphasized` |
| `--color-entry` | Cartão/balão neutro | `#FFFFFF` | `#242626` | `--WDS-systems-bubble-surface-incoming` |
| `--color-entry-accent` | Cartão/balão destacado | `#D9FDD3` | `#144D37` | `--WDS-systems-bubble-surface-outgoing` |
| `--color-composer` | Área de composição | `#FFFFFF` | `#242626` | `--WDS-systems-chat-surface-composer` |

**Escolha portátil A:** no botão principal do starter, o fundo usa `--color-action`, e o texto usa `--color-on-accent`. O verde de marca permanece disponível em `--color-accent`. Para essas cores opacas, branco sobre `#1DAA61` resulta em contraste aproximado de **3,01:1**; branco sobre `#1B8755`, **4,52:1**. No escuro, `#0A0A0A` sobre `#21C063` resulta em **8,28:1**. São cálculos das combinações indicadas, não uma certificação de acessibilidade de todo o sistema.

### Diferenças da implementação local

O [CSS local](web/src/styles.css) mantém aliases próprios. Por exemplo, `--surface-alt` é `#f0f2f5` no claro e `#202222` no escuro; `--accent` é `#008069` / `#21c063`; `--muted` é `#667781` / `#9c9e9e`; `--border` é `#e9edef` / `#303232`. Esses valores são **L**. A tabela acima escolhe explicitamente a família semântica WDS recuperada **R**, sem misturar as duas paletas silenciosamente.

## 3. Tipografia, fontes e ícones

### Fontes disponíveis

- **R:** a captura web contém Roboto, Roboto Variable, Droid Serif e Norican, em 14 arquivos públicos catalogados em [fonts/manifest.json](analysis/design-system/web/fonts/manifest.json). A presença de uma fonte no catálogo não significa que ela é a fonte de todas as telas.
- **L:** a interface local declara `Roboto, "Segoe UI", sans-serif`, com fonte variável de peso `100 900` e `font-display: swap`.
- **R/L:** [roboto-variable.woff2](web/public/assets/roboto-variable.woff2), 209.484 bytes, corresponde ao arquivo recuperado de SHA-256 `9b7e4c048bb083f9702640b8e25580f04dd7292331104c1ac5ba208d6ba8c36d`.
- **A:** pilha portátil: `"Interface Sans", "Segoe UI", Roboto, system-ui, sans-serif`. `Interface Sans` é o nome local proposto para o mesmo arquivo Roboto Variable; não é uma nova fonte.
- **R:** o token monoespaçado recuperado começa em `Consolas, Menlo, Monaco, Lucida Console` e termina em `monospace`. A receita reduz essa pilha para `Consolas, Menlo, Monaco, monospace` **A**.
- **R:** há seis fontes nativas catalogadas em [native/fonts.json](analysis/design-system/native/fonts.json), incluindo WhatsApp MDL2, Segoe Fluent Icons e WhatsApp Color Emoji. Elas não são necessárias para o starter web.

### Escala da implementação local L

| Papel | Tamanho | Peso/observação |
| --- | --- | --- |
| Corpo base | 14 px | `body` |
| Texto auxiliar | 12 px | `small`, cor secundária |
| Rótulo/input de busca | 13 px | Busca local |
| Corpo de composição | 15 px | `textarea`, linha de 22 px |
| Título de item | 16 px | Peso 450 na lista local |
| Título de seção `h3` | 16 px | Peso 500 |
| Título de painel `h2` | 20 px | Peso 500 |
| Título principal `h1` | 22 px | Peso 650, tracking −0,3 px |
| Texto de balão | 14 px padrão | Preferências locais de 12 / 14 / 17 px; linha 1,4 |

O starter mantém 14 px como corpo e oferece classes explícitas de título **A**. Em texto longo, aumente a fonte ou a altura de linha conforme o público. Pesos intermediários como 450 e 650 dependem de uma fonte variável ou do fallback disponível.

### Ícones

[source-icons.json](web/src/source-icons.json) contém 13 entradas nomeadas: `WhatsappLogo`, `Plus`, `Smiley`, `PaperPlaneRight`, `Check`, `DownloadSimple`, `CaretDown`, `X`, `MagnifyingGlass`, `AudioFile`, `Sticker`, `RotateImage` e `DocumentFile`. Dez entradas usam `viewBox="0 0 24 24"`; o logo usa `0 0 31 30`, o arquivo de áudio `0 0 55 55` e o documento `0 0 22 26`. O catálogo recuperado maior tem [172 registros SVG](analysis/design-system/web/icons.json), com limitações de agrupamento/transforms de ancestrais descritas no catálogo.

**A:** renderize ícones funcionais com `currentColor`, preserve `viewBox` e proporção, e mantenha a área clicável maior que o desenho. Use `aria-hidden="true"` em SVG decorativo; no botão, forneça um nome acessível. Para outra marca, substitua o logo por identidade própria. O starter não incorpora nenhum desenho de ícone.

## 4. Espaçamento, raios, elevação e layout

Não foi recuperada uma escala universal de espaçamento com nomes estáveis suficiente para afirmar que todos os controles seguem um único grid. Os CSS observados incluem tokens minificados e valores específicos por componente.

**Escala portátil A:** `4, 8, 12, 16, 20, 24, 32, 40, 48 px`. Use 4–8 px dentro de controles, 12–16 px entre itens, 20–24 px em painéis e 32–48 px entre blocos maiores. Valores específicos podem permanecer fora dessa escala quando necessários.

| Medida/padrão | Valor | Origem |
| --- | --- | --- |
| Raio externo da aplicação | 12 px | **R**, `--radius-app` |
| Botão circular de ícone | 40 × 40 px; raio 50% | **L** |
| Botão textual | Altura mínima 40 px; raio 23 px; padding 10 × 22 px | **L** |
| Busca | Altura 38 px; variante da lista 40 px; raio 22 px | **L** |
| Item de lista | Altura mínima 76 px; raio 10 px | **L** |
| Balão/cartão compacto | Raio 8 px; padding 7/9/5 px | **L** |
| Compositor | Altura mínima 52 px; raio 28 px | **L** |
| Menu | Largura mínima 220 px; raio 9 px; padding vertical 8 px | **L** |
| Modal | Largura 460 px; variante 640 px; raio 14 px; máximo 90dvh | **L** |
| Header de painel | Altura 64 px | **L** |
| Barra de navegação lateral | Largura 64 px | **L** |
| Painel de lista | Largura 380 px; mínimo 300 px | **L** |

**Elevação L:** menus usam `0 5px 20px #0002` no claro e `0 6px 24px #0006` no escuro. O modal local usa `0 15px 60px #0006`; o overlay usa `#0009`. O starter reutiliza essas sombras e fundos como decisões portáteis **A**, não como tokens oficiais de elevação recuperados.

**Raios A:** consolidar `8px` para campos/cartões pequenos, `12px` para painéis, `14px` para diálogos e `999px` para pills. O raio de pill é uma convenção da receita; os controles locais têm valores concretos distintos.

## 5. Componentes e contratos de estado

| Componente portátil | Padrão visual | Estados/contrato A |
| --- | --- | --- |
| Botão principal | Verde de ação, texto contrastante, pill | Normal, hover, pressed, foco visível, disabled, pending |
| Botão secundário | Superfície transparente, borda, texto de ação | Mesmos estados; seleção quando aplicável |
| Botão de ícone | Área circular, SVG centralizado | Nome acessível, tooltip opcional, foco e ação por teclado |
| Campo/busca | Superfície secundária, borda, label externo | Vazio, preenchido, focus-within, invalid, disabled |
| Item de lista | Ícone/avatar, título, resumo e metadado | Hover, selecionado, navegação por teclado; texto longo com ellipsis |
| Chip/filtro | Pill compacta | Selecionado por `aria-pressed`; múltipla escolha conforme o caso |
| Menu/popover | Superfície elevada, itens verticais, sombra | Fechado/aberto; foco, teclado, fechamento e reposicionamento |
| Modal | Superfície elevada, header, corpo e ações | Aberto/fechado, validação, pending; foco contido e restaurado |
| Cartão/entrada | Fundo neutro ou destacado, texto e metadado | Default, selecionado, pending, sucesso e falha com texto explícito |
| Compositor | Campo flexível e ações laterais | Vazio/preenchido, multilinha, anexos, pending e erro recuperável |
| Aviso/toast | Conteúdo curto, ação contextual | Info/success/warning/error; anúncio acessível conforme urgência |

### O que a evidência confirma

- **R estático:** o [inventário nativo](analysis/design-system/state-inventory/native-states.json) registra 231 declarações `VisualState`, 135 nomes distintos, 59 grupos em 24 XAML. Há nomes explícitos de normal, hover, pressed, foco, disabled e seleção. São declarações de templates nativos, sem confirmação automática de comportamento web.
- **R estático:** os botões Material3 declaram `Normal`, `PointerOver`, `Disabled`, `Focused` e `Unfocused`; alguns estados de foco estão vazios. Declaração de nome não garante mudança visual local.
- **R estático:** o recorte XAML contém duas transições explícitas de visibilidade, keyframes de 333/133 ms, zero triggers declarados e nenhum nome de estado contendo loading/busy/progress. Isso não demonstra ausência desses comportamentos no produto.
- **R observado:** os relatórios recuperados documentam listas, menus, composição, seleção simples/múltipla, campos vazios/preenchidos, temas e algumas prévias/visualizadores. Não foi confirmada uma matriz completa de todos os componentes × estados × temas. Veja [COBERTURA-ESTADOS.md](analysis/design-system/COBERTURA-ESTADOS.md).
- **L:** há estilos de hover, seleção por classe, foco visível, controles disabled, tela de loading e avisos de erro no frontend local. O compositor local considera Enter, Shift e composição IME; o modal local implementa Escape e contenção de Tab.

**A para sua aplicação:** trate pending, sucesso, erro, vazio e indisponibilidade como estados independentes, com texto e contrato de dados próprios. Não derive sucesso apenas de um botão ter sido clicado nem represente uma operação real apenas com um spinner decorativo.

## 6. Responsividade e interação

### Referência da implementação local L

- A partir de `1500px`, o shell tem `max-width: 1720px` e margens automáticas.
- Até `1100px`, o painel lateral passa a 340 px, mínimo 280 px; detalhes podem sobrepor o conteúdo, com largura 380 px e limite pela viewport.
- Até `760px`, navegação fica em 56 px e lista/detalhe alternam visibilidade; o painel de detalhes ocupa a tela. Modais recebem margem menor. Esses breakpoints são da implementação local, não limites oficiais do produto recuperado.
- O CSS local usa `min-width: 0`, ellipsis, quebra de conteúdo, rolagem em painéis e `100dvh`. Há uma regra `prefers-reduced-motion: reduce` que desativa animações/transições.

### Contrato portátil A

- Em tela ampla, mostre navegação, lista e detalhe. Em tela estreita, mostre uma etapa por vez e preserve seleção/contexto ao voltar. O exemplo CSS só fornece o layout; a troca de etapa depende da aplicação.
- Use propriedades lógicas como `padding-inline` e `border-inline-end`, e teste conteúdo longo e RTL. Não copie setas ou alinhamentos dependentes de direção sem revisão.
- Enter ativa botões nativos. Em campos multilinha, explicite se Enter confirma ou quebra linha; evite confirmação durante composição IME. Exponha essa preferência quando o fluxo exigir.
- Escape fecha camadas canceláveis. Ao abrir um modal, mova o foco para seu conteúdo; contenha Tab; ao fechar, devolva-o ao acionador. Menus precisam navegação e semântica coerentes, não apenas uma lista visual de botões.
- Mantenha controles importantes alcançáveis por toque e teclado. A receita adota altura mínima de 44 px **A**, maior que vários controles de 40 px da implementação local.
- Não esconda a única forma de executar uma ação atrás de hover. Ofereça acesso por foco, menu ou ação persistente.

## 7. Acessibilidade para a aplicação de destino

Estas são recomendações **A**, não resultados de uma auditoria completa:

- Use elementos HTML nativos, labels persistentes e nomes acessíveis em botões de ícone.
- Mostre foco visível; não remova `outline` sem alternativa. Diferencie foco de seleção.
- Associe erros por `aria-describedby` e `aria-invalid`. Explique como corrigir o problema e preserve o que a pessoa digitou.
- Use `disabled` para indisponibilidade real e `aria-busy` para atividade em andamento; o estado visual não substitui o bloqueio de duplicatas na lógica da operação.
- Combine cor com texto/ícone nos estados de sucesso, alerta, erro e leitura. Verifique contraste nas combinações finais, inclusive RGBA sobre fundos, imagens e overlays.
- Em modais, use `dialog.showModal()` ou uma implementação equivalente com foco e semântica. O exemplo seguinte usa `<dialog>`; abrir exige JavaScript.
- Respeite redução de movimento. Anuncie loading/resultado por uma região de status apropriada, evitando anúncios de conteúdo repetitivo.
- Teste zoom, aumento de texto, teclado, leitura de tela, contraste, toque e os dois temas. Os valores recuperados não garantem conformidade da aplicação final.

## 8. CSS starter portátil A

As cores abaixo repetem exatamente os valores **R** da tabela. Escala, seletores e composição das receitas são **A**. Tipografia e parte da geometria vêm da implementação **L**. O tema claro é o padrão desta receita, enquanto o CSS local original deste repositório começa no escuro.

```css
/* Opcional: copie o arquivo e ajuste esta URL ao local da folha CSS. */
@font-face {
  font-family: "Interface Sans";
  src: url("./assets/roboto-variable.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  color-scheme: light;
  --color-page: #FFFFFF;
  --color-page-inset: #F7F5F3;
  --color-surface: #FFFFFF;
  --color-surface-alt: #F7F5F3;
  --color-surface-raised: #FFFFFF;
  --color-highlight: rgba(194, 189, 184, .15);
  --color-pressed: rgba(0, 0, 0, .2);
  --color-text: #0A0A0A;
  --color-text-muted: rgba(0, 0, 0, .6);
  --color-text-disabled: #BDBDBD;
  --color-on-accent: #FFFFFF;
  --color-accent: #1DAA61;
  --color-accent-soft: #D9FDD3;
  --color-accent-strong: #15603E;
  --color-action: #1B8755;
  --color-link: #1B8755;
  --color-info: #007BFC;
  --color-danger: #EA0038;
  --color-danger-soft: #FDE8EB;
  --color-success: #1DAA61;
  --color-warning: #FFB938;
  --color-warning-soft: #FFF7E5;
  --color-divider: rgba(0, 0, 0, .1);
  --color-outline: #959393;
  --color-outline-soft: rgba(0, 0, 0, .2);
  --color-entry: #FFFFFF;
  --color-entry-accent: #D9FDD3;
  --color-composer: #FFFFFF;

  --font-ui: "Interface Sans", "Segoe UI", Roboto, system-ui, sans-serif;
  --font-code: Consolas, Menlo, Monaco, monospace;
  --text-small: .75rem;
  --text-body: .875rem;
  --text-section: 1.25rem;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --radius-small: 8px;
  --radius-panel: 12px;
  --radius-dialog: 14px;
  --radius-pill: 999px;
  --shadow-popover: 0 5px 20px #0002;
  --shadow-dialog: 0 15px 60px #0006;
  --motion-fast: 120ms;
  --motion-normal: 150ms;
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-page: #161717;
  --color-page-inset: #161717;
  --color-surface: #161717;
  --color-surface-alt: #1D1F1F;
  --color-surface-raised: #1D1F1F;
  --color-highlight: rgba(255, 255, 255, .1);
  --color-pressed: rgba(255, 255, 255, .2);
  --color-text: #FAFAFA;
  --color-text-muted: rgba(255, 255, 255, .6);
  --color-text-disabled: #424445;
  --color-on-accent: #0A0A0A;
  --color-accent: #21C063;
  --color-accent-soft: #103529;
  --color-accent-strong: #D9FDD3;
  --color-action: #21C063;
  --color-link: #21C063;
  --color-info: #53BDEB;
  --color-danger: #FB5061;
  --color-danger-soft: #321622;
  --color-success: #71EB85;
  --color-warning: #FFD279;
  --color-warning-soft: #362C1F;
  --color-divider: rgba(255, 255, 255, .1);
  --color-outline: #757778;
  --color-outline-soft: rgba(255, 255, 255, .1);
  --color-entry: #242626;
  --color-entry-accent: #144D37;
  --color-composer: #242626;
  --shadow-popover: 0 6px 24px #0006;
}

*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--color-page);
  color: var(--color-text);
  font: var(--text-body)/1.5 var(--font-ui);
}
button, input, textarea, select { font: inherit; }
button { cursor: pointer; }
a { color: var(--color-link); text-underline-offset: 3px; }
code, pre { font-family: var(--font-code); }
:where(button, a, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid var(--color-action);
  outline-offset: 3px;
}
.title { margin: 0; font-size: 1.375rem; font-weight: 650; letter-spacing: -.3px; }
.section-title { margin: 0; font-size: var(--text-section); font-weight: 500; }
.muted { color: var(--color-text-muted); }
.caption { font-size: var(--text-small); }
.stack { display: flex; flex-direction: column; gap: var(--space-4); }
.inline { display: flex; align-items: center; gap: var(--space-2); }
.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-panel);
  padding: var(--space-6);
}

/* Botões: variantes e estados explícitos. */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-block-size: 44px;
  padding: 10px 22px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: var(--color-action);
  color: var(--color-on-accent);
  font-weight: 500;
  transition: filter var(--motion-fast), transform var(--motion-fast);
}
.button--secondary {
  background: transparent;
  color: var(--color-action);
  border-color: var(--color-outline-soft);
}
.button--icon { inline-size: 44px; padding: 0; flex-shrink: 0; }
.button svg { inline-size: 24px; block-size: 24px; flex-shrink: 0; }
@media (hover: hover) {
  .button:hover:not(:disabled) { filter: brightness(.94); }
  .button--secondary:hover:not(:disabled) { background: var(--color-highlight); }
}
.button:active:not(:disabled) { transform: translateY(1px); }
.button:disabled {
  cursor: not-allowed;
  color: var(--color-text-disabled);
  background: var(--color-surface-alt);
  border-color: var(--color-divider);
}
.button[aria-busy="true"] { cursor: progress; }

/* Campo: aplique .field ao label e associe ajuda/erro por IDs. */
.field { display: grid; gap: var(--space-2); }
.field__label { font-weight: 500; }
.field :is(input, textarea, select) {
  inline-size: 100%;
  min-inline-size: 0;
  min-block-size: 44px;
  padding: 11px 12px;
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-small);
  background: var(--color-surface-alt);
  color: var(--color-text);
}
.field textarea { resize: vertical; min-block-size: 90px; }
.field :is(input, textarea)::placeholder { color: var(--color-text-muted); }
.field :is(input, textarea, select)[aria-invalid="true"] { border-color: var(--color-danger); }
.field :is(input, textarea, select):disabled { color: var(--color-text-disabled); cursor: not-allowed; }

/* Lista/filtro: escolha aria-current, aria-selected ou aria-pressed
   conforme a semântica real; os seletores só fornecem o visual. */
.list-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  inline-size: 100%;
  min-block-size: 76px;
  padding: var(--space-3);
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text);
  text-align: start;
}
.list-item__body { flex: 1; min-inline-size: 0; }
.truncate { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.list-item:hover { background: var(--color-highlight); }
.list-item:is([aria-current="page"], [aria-selected="true"]) {
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
}
.chip {
  border: 1px solid var(--color-outline-soft);
  border-radius: var(--radius-pill);
  min-block-size: 44px;
  padding-inline: var(--space-3);
  background: transparent;
  color: var(--color-text-muted);
}
.chip[aria-pressed="true"] { background: var(--color-accent-soft); color: var(--color-accent-strong); }

/* Cartões e composição opcionais; nenhum conteúdo específico do produto. */
.entry {
  max-inline-size: 84%;
  padding: 7px 9px 5px;
  border-radius: var(--radius-small);
  background: var(--color-entry);
  color: var(--color-text);
  box-shadow: 0 1px 1px #0003;
  overflow-wrap: anywhere;
}
.entry--accent { margin-inline-start: auto; background: var(--color-entry-accent); }
.entry__text { white-space: pre-wrap; line-height: 1.45; }
.composer {
  display: flex;
  align-items: end;
  gap: var(--space-2);
  min-block-size: 52px;
  padding: 4px 6px;
  border: 1px solid var(--color-outline-soft);
  border-radius: 28px;
  background: var(--color-composer);
}
.composer:focus-within { border-color: var(--color-action); }
.composer textarea {
  flex: 1;
  min-inline-size: 0;
  min-block-size: 40px;
  max-block-size: 140px;
  padding: 9px 7px;
  border: 0;
  resize: vertical;
  background: transparent;
  color: var(--color-text);
  line-height: 22px;
}

/* Popover: posicionamento, collision handling e teclado exigem lógica. */
.popover {
  min-inline-size: 220px;
  max-inline-size: calc(100vw - 24px);
  padding-block: var(--space-2);
  border: 1px solid var(--color-divider);
  border-radius: 9px;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-popover);
}
.popover__item { display: block; inline-size: 100%; padding: 12px 20px; border: 0; text-align: start; color: inherit; background: transparent; }
.popover__item:hover { background: var(--color-highlight); }
.dialog {
  inline-size: 460px;
  max-inline-size: calc(100vw - 24px);
  max-block-size: 90dvh;
  overflow: auto;
  padding: var(--space-6);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-dialog);
  background: var(--color-surface-raised);
  color: var(--color-text);
  box-shadow: var(--shadow-dialog);
}
.dialog::backdrop { background: #0009; }
.dialog__actions { display: flex; flex-wrap: wrap; justify-content: end; gap: var(--space-3); margin-block-start: var(--space-6); }
.notice { padding: var(--space-3); border-radius: var(--radius-small); background: var(--color-surface-alt); color: var(--color-text); }
.notice--error { background: var(--color-danger-soft); border-inline-start: 3px solid var(--color-danger); }
.notice--warning { background: var(--color-warning-soft); border-inline-start: 3px solid var(--color-warning); }

/* Layout opcional: navegação + lista + detalhe. */
.workspace { display: grid; grid-template-columns: 64px 380px minmax(0, 1fr); min-block-size: 100dvh; }
.workspace__nav, .workspace__list { border-inline-end: 1px solid var(--color-divider); }
.workspace__detail { min-inline-size: 0; }
@media (max-width: 1100px) {
  .workspace { grid-template-columns: 64px 340px minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .workspace { grid-template-columns: 56px minmax(0, 1fr); }
  .workspace__detail { display: none; }
  .workspace[data-view="detail"] { grid-template-columns: minmax(0, 1fr); }
  .workspace[data-view="detail"] > :is(.workspace__nav, .workspace__list) { display: none; }
  .workspace[data-view="detail"] > .workspace__detail { display: block; }
  .entry { max-inline-size: 90%; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

Os tamanhos em `rem` assumem 16 px como tamanho raiz habitual; não fixe o tamanho raiz para impedir preferências do navegador. O starter não inclui os assets, a lógica de tema automático, gerenciamento de menus, validação, autoajuste de textarea ou operações assíncronas.

### Exemplo mínimo de componentes

```html
<html lang="pt-BR" data-theme="dark">
  <!-- Carregue a folha CSS no head da sua aplicação. -->
  <body>
    <main class="panel stack">
      <h1 class="title">Preferências</h1>
      <p class="muted">Configure sua aplicação.</p>

      <label class="field" for="project-name">
        <span class="field__label">Nome do projeto</span>
        <input id="project-name" name="projectName"
               aria-describedby="project-help" autocomplete="off">
        <small id="project-help" class="caption muted">Use um nome fácil de reconhecer.</small>
      </label>

      <div class="inline">
        <button type="button" class="button">Salvar</button>
        <button type="button" class="button button--secondary">Cancelar</button>
      </div>
    </main>
  </body>
</html>
```

Para loading, a lógica pode aplicar `aria-busy="true"`, trocar o texto para “Salvando…” e impedir requisições duplicadas. Para erro, preserve o input, marque `aria-invalid="true"` e associe uma explicação. Para diálogo, use `<dialog class="dialog" aria-labelledby="dialog-title">` com título de ID correspondente e abra por `showModal()`.

## 9. Arquivos de apoio e limites de fidelidade

| Fonte local | Conteúdo/utilidade |
| --- | --- |
| [ZIP v3](analysis/whatsapp-design-system-recuperado-v3.zip) | Catálogo recuperado para transporte; não inclui automaticamente este novo MD ou o frontend local |
| [README do catálogo](analysis/design-system/README.md) | Proveniência, cobertura e limites da investigação |
| [Tokens por tema](analysis/design-system/web/tokens-by-theme.json) | 1.475 variáveis computadas por tema observado e 302 diferenças |
| [CSS claro](analysis/design-system/web/tokens-light.css) / [CSS escuro](analysis/design-system/web/tokens-dark.css) | Tokens com nomes originais, preservados |
| [Definições de tokens](analysis/design-system/web/token-definitions.json) | 21.638 declarações, com seletor/contexto/origem |
| [CSS local](web/src/styles.css) | Implementação local usada para geometria e receitas |
| [Fonte variável local](web/public/assets/roboto-variable.woff2) | Arquivo opcional para levar à outra aplicação |
| [Manifesto de fontes](analysis/design-system/web/fonts/manifest.json) | Metadados e hashes dos 14 arquivos web |
| [Ícones locais nomeados](web/src/source-icons.json) / [SVGs recuperados](analysis/design-system/web/icons.json) | 13 entradas locais / 172 registros geométricos recuperados |
| [Wallpaper claro](web/public/assets/wallpaper-light.webp) / [escuro](web/public/assets/wallpaper-dark.webp) | Assets opcionais de 540 × 960 px; não necessários para a linguagem visual genérica |
| [Manifesto de wallpaper](web/public/assets/wallpaper-manifest.json) | Origem pública, dimensões e hashes dos assets |
| [Catálogo nativo](analysis/design-system/native/README.md) | 95 XAML, 5.561 tokens escalares/brushes e recursos nativos |
| [Estados nativos](analysis/design-system/state-inventory/README.md) | Declarações estáticas de estados e suas limitações |
| [Cobertura observada](analysis/design-system/COBERTURA-ESTADOS.md) | Distinção entre estados observados, parciais e pendentes |

`Colors.g.xaml` e `Brushes.g.xaml` declaram ter sido gerados de `WAWebAppGlobal.css` pelo `WhatsApp.DesignSystemGenerator`. Isso vincula a origem declarada de parte da paleta nativa ao CSS; não prova equivalência integral entre componentes nativos e web.

O material é uma fotografia da versão e sessão indicadas. Há variações de escopo, componentes, experimentos e estados não cobertos. Os scripts recuperados continuam minificados e dependentes da infraestrutura interna; este documento não os transforma em biblioteca portátil. As receitas foram escritas para reutilização, mas não passaram por uma implementação/renderização na aplicação de destino. Preserve a distinção R/L/A ao continuar o trabalho e valide o resultado no seu contexto.


## 10. Cartão de pedido Pix (implementação 1.0.12)

- Bolha: largura 368 px limitada ao espaco disponivel; corpo interno com margem de 5 px, fundo escuro #1b1b1b e raio 4 px.
- Valor: Roboto 40 px, peso 600, centralizado; 32 px em telas estreitas e 24/22 px em valores longos.
- Identificação: Pagar com em 14 px/600; solicitante em 13 px com linha de 18 px; badge Pix 28 x 28 px, horário abaixo.
- Acao: Copiar código Pix, altura minima 54 px (48 px no mobile), icone Copy 22 px, verde do token --accent, borda superior --border.
- Estados: pronto, copia em andamento, copiado, falha com código selecionável; desabilitado ao selecionar mensagens. Mensagem apagada substitui integralmente o cartão.
- O logo em web/public/pix-logo.svg foi recuperado do cliente original. Para outras aplicacoes, confirme a permissão/licenca dos assets de marca.
- Dados: amount/offset, currency BRL, merchantName e copyCode. Copiar e uma ação local; o componente não executa pagamentos.


### Menu contextual de mensagem — atualização 1.0.13

- Painel flutuante: largura externa 272 px; lista central de 204 px; limite horizontal de 8 px em cada borda da janela.
- Ancoragem: 6 px de distância do controle; abre acima quando não há espaço abaixo. Limites verticais seguem a região de mensagens, sem invadir cabeçalho/compositor. Lista com rolagem interna quando a altura é insuficiente.
- Lista: fundo `--surface` (#161717 no escuro), borda `--border` de 1 px, raio de 18 px, sombra `--shadow`; texto 14 px/peso 500; padding por ação 10 × 16 px e gap ícone/texto 12 px. Apagar mantém a cor normal no menu; confirmação usa o tratamento destrutivo próprio.
- Barra de reações: seis emojis e botão Mais reações, controles de 34 px, gap de 3 px, padding de 6 px, fundo `--surface-alt` e raio de 30 px. Emojis são conteúdo Unicode; a aparência varia conforme o renderizador.
- Teclado: setinha revelada por foco, Escape fecha e restaura foco; setas/Home/End percorrem os controles sem capturar as teclas dos inputs, selects e conteúdo editável.
- Fluxo de interação: selecionar reação fecha o painel; o seletor completo mantém pesquisa, tom de pele e recentes, com persistência antes de desmontar.


### Identidade e atividade de contato — atualização 1.0.14

- Contato pessoal não salvo: telefone confirmado formatado como título; nome de apresentação separado com prefixo `~`. Nome salvo ou comercial tem prioridade. Identificadores internos não são telefones.
- Perfil pessoal não salvo: avatar circular de 132 px; título 24 px/peso 500; texto secundário 18 px em `--muted`, centralizado e com quebra para nomes longos.
- Atividade: digitando... e gravando áudio... usam `--accent` no resumo; indicador de três pontos junto à última mensagem, com animação de 1,2 s e fallback sem movimento para `prefers-reduced-motion`.
- Histórico curto: conteúdo alinhado ao fim da área rolável, próximo ao compositor. O histórico longo mantém rolagem normal e ordem cronológica.
- Aviso de mensagens temporárias: linha central com ícone Timer, descrição e ação Mudar duração; a ação abre o diálogo de configuração existente.

### Cartão de cobrança Pix comercial — atualização 1.0.15

- Largura de 368 px, limitada à conversa; conteúdo com padding de 9 × 10 px. Referência de cobrança: 11 px, peso 600 e espaçamento de letras de 1 px, em --muted.
- Item e quantidade: 16 px/21 px, empilhados. Separadores tracejados usam --border; método Pix e total usam 16 px.
- Descrição: 16 px/21 px, preservando quebras e a formatação rica existente. Horário alinhado ao fim do cartão.
- Rodapé: Copiar código Pix, ícone Copy e --accent; altura mínima de 54 px, 48 px em telas estreitas. Sucesso e fallback de erro ficam abaixo.
- O formato de pedido estático com valor em destaque continua separado. O resumo comercial combina item e valor, enquanto o corpo completo permanece disponível para busca e cópia da mensagem.

### Organização das conversas — atualização 1.0.16

- Filtros: chips de 30 px, raio 18 px, gap 7 px; trilha com rolagem horizontal e seta de 34 × 32 px mantida acessível. Cor ativa usa o tratamento existente de Tudo.
- Editor lateral: largura 766 px limitada ao espaço disponível; cabeçalho 54 px com Voltar e título 18 px/peso 400. Em tela estreita respeita a área restante após a navegação.
- Nome: label 13 px em --muted, campo 18 px com sublinhado de 2 px em --accent, emoji no fim e contador de 25 caracteres. Padding lateral 26 px.
- Conversas incluídas: título 14 px/peso 600, botão de adicionar com círculo verde de 42 px e ícone Plus de 28 px; seleção com foto/grupo, nome e checkbox. Membros removíveis antes de salvar.
- Ação Criar/Salvar lista: botão arredondado, padding 12 × 26 px, estado desabilitado com --surface-hover. Exclusão tem confirmação e preserva conversas.
- Trancadas: linha LockKey acima de Arquivadas; tela de senha com título, explicação da senha do produto, erro visível e ação Abrir. A pasta usa a lista de conversas existente, com ação Fechar conversas trancadas no cabeçalho.
- Transparência: listas/trancas locais têm copy que informa seu alcance; a tranca nativa pode ser retirada no produto após reautenticação; o código secreto do WhatsApp permanece independente. Não simular sincronização nem preencher as listas com nomes da captura.


### Histórico e listas virtuais — 1.0.18

O desenho de mensagens, menus e linhas permanece o mesmo. O histórico abre com60 mensagens e oferece carregamento das anteriores, com posição de leitura preservada. Listas longas renderizam somente a janela visível; alturas de texto, fotos e áudio são medidas. Separadores de data não capturam foco, e mensagens de sistema com ações continuam acessíveis. Busca, galeria e favoritas consultam páginas próprias. Carregamento e erro ficam próximos ao conteúdo correspondente.


### Navegacao de historico limitado (1.0.19)

Historicos longos oferecem anteriores, mais recentes e retorno explicito ao presente. Controles de recentes usam sobreposicao dentro da area de mensagens, mantendo a geometria do viewport ao aparecer. A ancora visual deve ser preservada tanto na transicao para virtualizacao quanto entre janelas ja virtualizadas. Acoes abertas nao devem desaparecer por descarte de paginas; se necessario, informar que a acao precisa ser concluida antes do avanco.


## Estados de mídia validados — 1.0.20

Visualizadores de fotos/vídeos devem distinguir carregamento, conteúdo pronto e falha com ação de nova tentativa. Fechar permanece disponível durante carregamento. Áudio deve expor play/pause, posição, duração, buffering e erro recuperável. Só um fluxo audível toca por vez; animação GIF silenciosa preserva voz. Trocar de conversa, revogar ou substituir conteúdo libera recursos antigos; substituição reinicia posição/zoom. GIF respeita pausa explícita e movimento reduzido. Evidências e limites em docs/MEDIA-QA.md.
