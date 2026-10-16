# Design System — ERP Genius

> Padrão visual do produto. Vale para toda tela nova. Princípio: **flat, minimalista, com
> tokens** — o tema (claro/escuro) troca via CSS variables, sem reescrever componente.

## Princípios
- **Flat & minimalista:** superfícies, bordas finas, cantos arredondados (8–12px). **Sem
  sombras, sem gradientes.**
- **Tokens primeiro:** cor vem de variável CSS (nunca hex solto no componente). Definidas em
  [`globals.css`](../src/app/globals.css) e referenciadas via Tailwind ([`tailwind.config.ts`](../tailwind.config.ts)).
- **Sentence case sempre:** nada de Title Case nem CAIXA ALTA (inclusive sem `uppercase` no CSS).

## Tipografia
- Fonte: **Roboto variável** (eixo de peso 100–900, `font-display: swap`), carregada localmente via
  `next/font/local` em [`src/app/layout.tsx`](../src/app/layout.tsx) (`roboto-variable.woff2` e
  `LICENSE-Roboto.txt`, Apache 2.0, em `src/app/fonts/`), exposta na variável `--font-sans`. A pilha é
  `var(--font-sans), "Segoe UI", Roboto, system-ui, sans-serif`.
- **Padrão de pesos (canônico):** **regular (400)**, **medium (500)** e **semibold (600)** — nada acima de
  600 (`font-bold` evitado; use `font-semibold`). Elementos que o navegador deixa em negrito por padrão
  (`h1`–`h6`, `dt`, `b`, `strong`, `th`) são levados a 600 em `globals.css`.
  `src/app/tipografia.test.ts` confere a fonte, o hash e falha se um peso maior voltar ao código.

## Cantos & bordas
- Raios: `rounded-md` = 8px (campo, cartão pequeno) · `rounded-item` = 10px (item de lista) · `rounded-lg`/`rounded-xl` = 12px (painel) · `rounded-dialog` = 14px · `rounded-full` (botão, chip, avatar).
- Bordas: 1px na cor `--border` (preto 10% no claro; branco 12% no escuro).

## Ícones
- **Tabler** (`@tabler/icons-react`), versão **outline** (componentes `Icon*`, não `Icon*Filled`).
- Tamanho padrão `h-4 w-4` (16px) na UI densa; `h-5 w-5` em destaques.

## Modo escuro
- Estratégia **classe** (`.dark` no `<html>`), com **anti-FOUC** (script no `layout.tsx` que lê
  `localStorage('tema')` ou `prefers-color-scheme` antes do paint). Toggle no rodapé da Sidebar.
- Regra de inversão: fundos escurecem (nunca preto puro), textos clareiam (nunca branco puro),
  bordas viram branco de baixa opacidade, **badges coloridos invertem** (claro = fundo claro +
  texto escuro; escuro = fundo escuro + texto claro).

## Tokens — Neutros
Valores do design system (`docs/planejamento/design-system-referencia.md`, v1.0 de 14/10/2026). **R** = literal do
spec; **A** = adaptação para manter as travas de contraste do ERP.

| Papel | Token | Claro | Escuro | Origem |
|---|---|---|---|---|
| Fundo da página | `--bg-page` | `#F7F5F3` | `#161717` | R |
| Superfície (cards) | `--surface` | `#FFFFFF` | `#161717` | R |
| Superfície sutil | `--surface-muted` | `#F7F5F3` | `#1D1F1F` | R `surface-alt` |
| Superfície elevada | `--surface-raised` | `#FFFFFF` | `#1D1F1F` | R |
| Neutro (chips, hover opaco) | `--neutral-muted` | `#EDEDED` | `#2A2C2C` | A: a seleção cabe sobre ele |
| Realce / pressionado | `--highlight` / `--pressed` | `rgba(194,189,184,.15)` / `rgba(0,0,0,.2)` | `rgba(255,255,255,.1)` / `rgba(255,255,255,.2)` | R |
| Texto primário | `--text-primary` | `#0A0A0A` | `#FAFAFA` | R |
| Texto secundário | `--text-secondary` | `rgba(0,0,0,.6)` | `rgba(255,255,255,.6)` | R `text-muted` |
| Texto terciário (placeholder) | `--text-terciary` | `#6D6C64` | `#8F9192` | A: o spec não tem terciário |
| Texto desabilitado | `--text-disabled` | `#BDBDBD` | `#424445` | R (só controle desabilitado) |
| Borda (card) | `--border` | `rgba(0,0,0,.10)` | `rgba(255,255,255,.10)` | R `divider` |
| Borda suave | `--border-soft` | `rgba(0,0,0,.20)` | `rgba(255,255,255,.10)` | R `outline-soft` |
| Borda (controle — input/select, `gray-300`) | `--border-control` | `#858383` | `#757778` | A claro (o R `#959393` dá 2,81:1) |

Razões medidas pela trava (`src/app/contraste-nucleo.ts`):

| Par | Claro | Escuro |
|---|---|---|
| `--border-control` sobre página / cartão / sutil / neutro (≥ 3:1, WCAG 1.4.11) | 3,47 / 3,77 / 3,47 / 3,22 | 3,99 / 3,99 / 3,68 / 3,12 |
| `--text-terciary` sobre página / cartão / sutil (≥ 4,5:1, 1.4.3) | 4,85 / 5,28 / 4,85 | 5,67 / 5,67 / 5,23 |
| `--brand-text` sobre página / cartão (≥ 4,5:1) | 6,96 / 7,57 | 7,51 / 7,51 |

> A borda de controle antiga (`rgba(0,0,0,.44)`) cai para 3,17–3,24:1 no antigo claro; o `#959393` do spec
> dá 2,81:1 sobre `#F7F5F3`, por isso a adaptação.

## Tokens — Semânticos (fundo / texto — repare a inversão)
| Cor | Token bg / text | Claro (bg / text) | Escuro (bg / text) |
|---|---|---|---|
| Info (azul) | `--info-bg` / `--info-text` | `#E6F1FB` / `#0064D1` | `#10283A` / `#53BDEB` |
| Sucesso (verde) | `--success-bg` / `--success-text` | `#D9FDD3` / `#15603E` | `#103529` / `#71EB85` |
| Aviso (âmbar) | `--warning-bg` / `--warning-text` | `#FFF7E5` / `#7A4F00` | `#362C1F` / `#FFD279` |
| Perigo/atraso (vermelho) | `--danger-bg` / `--danger-text` | `#FDE8EB` / `#B3002B` | `#321622` / `#FB5061` |
| IA (roxo — sugestões do copiloto, doc 27 C3) | `--ai-bg` / `--ai-text` | `#F2F0F9` / `#6A53BD` | `#2B2A37` / `#AD9FFA` |
| Temperatura Frio | `--cold-text` | `#007DAA` | `#5BB0D7` |
| Balão / compositor (Fase 3) | `--entry` / `--entry-accent` / `--composer` | `#FFFFFF` / `#D9FDD3` / `#FFFFFF` | `#242626` / `#144D37` / `#242626` |

> Adaptações (A): `--info-text` claro (o `#007BFC` do spec dá 4,01:1), `--warning-text` claro (o `#FFB938` é
> indicador, não texto) e `--danger-text` claro (`#EA0038` dá 3,93:1).
>
> **IA** tem cor própria de propósito — é o único sinal visual que diz "isto foi gerado por
> IA", nunca reaproveite `--ai-*` fora de sugestão do copiloto. `--ai-solid` (`#6A53BD`, não
> inverte: o mesmo valor nos dois temas, 5,86:1 com branco) é o botão de aceitar/aplicar sugestão,
> sempre com texto branco. Nisso ele difere do `--brand-solid`, que tem um valor por tema (`#1B8755`
> no claro, `#21C063` no escuro) e leva `text-on-brand` (ver o quadro abaixo).

<!-- Redação anterior à Fase 0, com valores que não valem mais (#6D28D9, #4338CA, #6264EC). Fica comentada
só para este trecho não colidir com a #178, que reescreveu as linhas abaixo; o texto válido é o parágrafo acima.
> **IA** tem cor própria de propósito — é o único sinal visual que diz "isto foi gerado por
> IA", nunca reaproveite `--ai-*` fora de sugestão do copiloto. `--ai-solid` (`#6D28D9`, não
> inverte: o mesmo valor nos dois temas) é o botão de aceitar/aplicar sugestão, sempre com texto
> branco. Nisso ele difere do `--brand-solid`, que desde a #157 tem um valor por tema (`#4338CA` no
> claro, `#6264EC` no escuro; ver o quadro abaixo).

-->

## Tokens — Marca e ações sólidas
| Papel | Token | Claro | Escuro |
|---|---|---|---|
| Accent (checkbox/radio, foco, barra sem texto) | `--brand` | `#1DAA61` | `#21C063` |
| Texto/link da marca | `--brand-text` | `#15603E` | `#21C063` |
| Fundo suave (hover, item ativo) | `--brand-bg` | `#D9FDD3` | `#103529` |
| Texto sobre `--brand-bg` | `--brand-strong` | `#15603E` | `#D9FDD3` |
| Contorno tingido | `--brand-border` | `#B7EBC0` | `#1E5C40` |
| Fundo sólido (botão primário e seleção com texto) | `--brand-solid` | `#1B8755` | `#21C063` |
| Texto sobre `--brand-solid` / `--success-solid` | `--on-brand-solid` | `#FFFFFF` (4,52:1) | `#0A0A0A` (8,28:1) |
| Sólido de sucesso | `--success-solid` | `#1B8755` | `#21C063` |
| Sólido destrutivo (texto branco) | `--danger-solid` | `#EA0038` (4,61:1) | `#C4002F` (6,20:1) |
| Sólido da IA (texto branco) | `--ai-solid` | `#6A53BD` (5,86:1) | `#6A53BD` (5,86:1) |

> **O texto sobre o sólido não é mais sempre branco.** No escuro o verde clareia (`#21C063`), então o texto do
> botão primário e da seleção é escuro (`--on-brand-solid`). `TEXTO_SOBRE_SOLIDO` em
> `src/app/contraste-mapa.ts` guarda o par de cada sólido (`--brand-solid` e `--success-solid` com
> `--on-brand-solid`; `--danger-solid` e `--ai-solid` com branco) e a trava confere ≥ 4,5:1 nos dois temas.
>
> `--brand` é accent, contorno de foco e barra sem texto; **nunca** fundo de texto (branco sobre ele dá 3,06:1
> no claro e 2,32:1 no escuro). `--brand-text` / `text-brand-700` são links, só texto — nunca fundo.
>
> **`--brand-solid` cumpre duas contas nos dois temas:** o texto do par ≥ 4,5:1 (WCAG 1.4.3) e ele sobre a
> página, o cartão, a superfície sutil e o neutro ≥ 3:1 (WCAG 1.4.11; é o fundo que mostra qual aba ou chip está
> selecionado).
>
> | Tema | `--brand-solid` | Texto sobre ele | sobre `--bg-page` / `--surface` / `--surface-muted` / `--neutral-muted` |
> |---|---|---|---|
> | Claro | `#1B8755` | 4,52:1 | 4,16 / 4,52 / 4,16 / 3,86:1 |
> | Escuro | `#21C063` | 8,28:1 | 7,51 / 7,51 / 6,93 / 5,88:1 |
>
> `--neutral-muted` entrou na conta da seleção (antes ficava de fora porque, no escuro de então, nenhuma cor
> cumpria as duas contas sobre ele). O autoteste de `selecaoImpossivelSobre` segue com hex fixo.
>
> **Hover do primário** (`hover:brightness-95`, `src/components/Botao.tsx`) escurece o fundo só enquanto o
> ponteiro está em cima; a conta de 3:1 vale para o estado em repouso, que é o que mostra a seleção.

## Tokens — Sombras
`--shadow-popover` (`0 5px 20px #0002` / `0 6px 24px #0006`) e `--shadow-dialog` (`0 15px 60px #0006`, igual nos
dois temas) são as únicas sombras do sistema: menu/popover e modal/drawer. Ficam fora da conta de contraste.

## Camadas

Modal, confirmação e drawer são camadas elevadas: fundo `bg-surface-raised`, `shadow-dialog`, véu `bg-black/60`.
- **Modal** (`Modal.tsx`, e `ConfirmarAcao` sobre ele): `max-h-[90dvh] w-full max-w-[calc(100vw-24px)] overflow-y-auto rounded-dialog border border-gray-200 bg-surface-raised p-6 shadow-dialog`; largura `sm:w-[460px]` e, com a propriedade `larga`, `sm:w-[640px]`. Título `text-xl font-medium`; ações `mt-6 flex flex-wrap justify-end gap-3`.
- **Drawer**: `bg-surface-raised shadow-dialog` com borda `border-s border-gray-200` (ou `border-e` pela esquerda).
- Escape, contenção de Tab, devolução do foco e `inert` seguem como antes (`useDialogo`).

## Como usar no código
As shades do Tailwind estão **mapeadas para os tokens** (ex.: `text-gray-600` → `--text-secondary`,
`bg-green-100 text-green-700` → badge sucesso que inverte sozinho, `bg-surface` → card). Cores novas: `on-brand`, `surface-raised`, `highlight`, `pressed`, `border-soft`, `disabled`, `entry`, `entry-accent`, `composer`, `cold-700`; `brand-800` = `--brand-strong`. Fonte `font-sans` = `var(--font-sans)` com Segoe UI/Roboto de reserva. Então:
- **Card:** `bg-surface border border-gray-200 rounded-lg`.
- **Badge:** `rounded-full bg-{cor}-100 text-{cor}-700` (inverte no dark automaticamente).
- **Botão primário:** `bg-brand-solid text-on-brand hover:brightness-95`. **Destrutivo:** `bg-danger text-white`.
- **Indicador de estado ativo** (aba selecionada, passo concluído, chip marcado): `bg-brand-solid text-on-brand`.
  `bg-brand-500`/`bg-brand-600` (que clareiam no escuro) **nunca** levam `text-white`, em nenhuma
  forma de `className`; ficam para fundo sem texto (barra de progresso). A trava é
  `src/app/contraste.test.ts`, que também recalcula pelos tokens do `globals.css` o contraste do
  texto de cada fundo sólido (o par de `TEXTO_SOBRE_SOLIDO`, ≥ 4,5:1), da borda de controle sobre cada
  superfície (≥ 3:1) e do `--brand-solid` sobre a página, o cartão, a superfície sutil e o neutro (≥ 3:1),
  nos dois temas. `text-white` sobre `bg-brand-solid` é reprovado: no escuro o branco sobre o verde `#21C063`
  não passa; `text-on-brand` (`--on-brand-solid`) é branco no claro e preto no escuro.
- **Texto:** `text-gray-800/600/400` = primário/secundário/terciário.
- Evite hex literal; a única sombra é de camada flutuante: `shadow-popover` (menu, popover) e `shadow-dialog` (modal, drawer). Nenhuma outra `shadow-*`; novas cores entram como token novo no `globals.css`.
- **Só use as shades mapeadas no `tailwind.config.ts`** (`gray`, `brand`/`brand-solid`, `green`,
  `red`, `amber`, `blue`, `indigo`, `orange`, `ai`/`ai-solid`, `danger`, `success`). Qualquer
  outra cor (`rose`, `emerald`, `sky`, `slate`, `violet`, `purple`, `cyan`, `teal`, `yellow`,
  `lime`, `fuchsia`, `pink`, `zinc`, `neutral`, `stone`, ou uma shade fora das listadas) cai na
  paleta padrão do Tailwind, que **não inverte** no dark. Dobre pro equivalente semântico:
  `rose`→`red`, `emerald`→`green`, `sky`→`blue`, `slate`→`gray`. Se nenhum couber, é sinal de
  precisar um token novo (como `--ai-*`) — não invente shade solta.
- `src/app/paleta.test.ts` trava as duas regras acima em `src/app`, `src/components` e `src/lib`:
  falha com cor fora do mapa, shade não listada (inclusive sob `dark:`/`hover:`), sombra
  (`shadow-*`, `drop-shadow-*`, `shadow-[…]`) ou cor arbitrária (`bg-[#…]`, `rgb()`, `hsl()`). Ele lê o mapa direto do `tailwind.config.ts` — mapear uma shade
  nova no config já a libera.
