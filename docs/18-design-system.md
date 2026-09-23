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
- Fonte: **Anthropic Sans**, carregada localmente via `next/font/local` em
  [`src/app/layout.tsx`](../src/app/layout.tsx) (arquivos `.otf` em `src/app/fonts/`), exposta
  na variável `--font-sans`. `globals.css` referencia `var(--font-sans)`.
- **Padrão de pesos (canônico):** apenas **regular (400)** e **medium (500)** — nada de
  negrito pesado (`font-bold` evitado; use `font-medium`).
  > **Nota de alinhamento:** a implementação atual em `layout.tsx` ainda registra quatro pesos
  > (400/500/600/700); a redução para 400/500 está sendo alinhada em PR de front-end. Esta doc
  > descreve o padrão **pretendido** — ao alinhar, mantenha só 400/500.

## Cantos & bordas
- Raios: `rounded-md` = 8px · `rounded-lg` = 10px · `rounded-xl` = 12px · `rounded-full` (chips/avatar).
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
| Papel | Token | Claro | Escuro |
|---|---|---|---|
| Fundo da página | `--bg-page` | `#FAFAF7` | `#1B1B1A` |
| Superfície (cards) | `--surface` | `#FFFFFF` | `#242422` |
| Superfície sutil | `--surface-muted` | `#F4F4F0` | `#2B2B29` |
| Neutro (chips) | `--neutral-muted` | `#EFEEE9` | `#2F2F2C` |
| Texto primário | `--text-primary` | `#1A1A19` | `#ECECEA` |
| Texto secundário | `--text-secondary` | `#5F5E5A` | `#A7A6A1` |
| Texto terciário | `--text-terciary` | `#6D6C64` | `#979692` |
| Borda (card) | `--border` | `rgba(0,0,0,.10)` | `rgba(255,255,255,.12)` |
| Borda (controle — input/select, `gray-300`) | `--border-control` | `rgba(0,0,0,.42)` | `rgba(255,255,255,.34)` |

## Tokens — Semânticos (fundo / texto — repare a inversão)
| Cor | Token bg / text | Claro (bg / text) | Escuro (bg / text) |
|---|---|---|---|
| Info (azul) | `--info-bg` / `--info-text` | `#E6F1FB` / `#0C447C` | `#0C447C` / `#B5D4F4` |
| Sucesso (verde) | `--success-bg` / `--success-text` | `#EAF3DE` / `#27500A` | `#27500A` / `#C0DD97` |
| Aviso (âmbar) | `--warning-bg` / `--warning-text` | `#FAEEDA` / `#633806` | `#633806` / `#FAC775` |
| Perigo/atraso (vermelho) | `--danger-bg` / `--danger-text` | `#FCEBEB` / `#791F1F` | `#791F1F` / `#F7C1C1` |
| IA (roxo — sugestões do copiloto, doc 27 C3) | `--ai-bg` / `--ai-text` | `#F3EEFC` / `#5B21B6` | `#2F2350` / `#C4B5FD` |

> **IA** tem cor própria de propósito — é o único sinal visual que diz "isto foi gerado por
> IA", nunca reaproveite `--ai-*` fora de sugestão do copiloto. `--ai-solid` (`#6D28D9`, não
> inverte) é o botão de aceitar/aplicar sugestão — mesma lógica de `--brand-solid`.

> **Ações sólidas** (botões de confirmar/destrutivo) usam `--danger-solid` / `--success-solid`
> (texto branco nos dois modos) — distintas dos badges. Marca: `--brand-solid` (fundo do botão
> primário, **não inverte** no dark), `--brand` (accent de checkbox/radio **e** fundo de
> indicador de estado ativo — aba selecionada, passo concluído do wizard, chip de dia da
> semana marcado; nesses casos o fundo é `bg-brand-600`, nunca `bg-brand-solid`, porque não é
> uma ação — é feedback de seleção, e clarear no dark é aceitável ali), `--brand-text` /
> `text-brand-700` (links, só texto — nunca fundo), `--brand-bg` (fundo claro de hover/estado
> ativo em itens de menu).

## Como usar no código
As shades do Tailwind estão **mapeadas para os tokens** (ex.: `text-gray-600` → `--text-secondary`,
`bg-green-100 text-green-700` → badge sucesso que inverte sozinho, `bg-surface` → card). Então:
- **Card:** `bg-surface border border-gray-200 rounded-lg`.
- **Badge:** `rounded-full bg-{cor}-100 text-{cor}-700` (inverte no dark automaticamente).
- **Botão primário:** `bg-brand-solid text-white hover:brightness-95`. **Destrutivo:** `bg-danger text-white`.
- **Indicador de estado ativo** (aba selecionada, passo concluído, chip marcado): `bg-brand-600 text-white` — é seleção, não ação; não promova para `bg-brand-solid`.
- **Texto:** `text-gray-800/600/400` = primário/secundário/terciário.
- Evite hex literal e `shadow-*`; novas cores entram como token novo no `globals.css`.
- **Só use as shades mapeadas no `tailwind.config.ts`** (`gray`, `brand`/`brand-solid`, `green`,
  `red`, `amber`, `blue`, `indigo`, `orange`, `ai`/`ai-solid`, `danger`, `success`). Qualquer
  outra cor (`rose`, `emerald`, `sky`, `slate`, `violet`, `purple`, `cyan`, `teal`, `yellow`,
  `lime`, `fuchsia`, `pink`, `zinc`, `neutral`, `stone`, ou uma shade fora das listadas) cai na
  paleta padrão do Tailwind, que **não inverte** no dark. Dobre pro equivalente semântico:
  `rose`→`red`, `emerald`→`green`, `sky`→`blue`, `slate`→`gray`. Se nenhum couber, é sinal de
  precisar um token novo (como `--ai-*`) — não invente shade solta.
- `src/app/paleta.test.ts` trava as duas regras acima em `src/app`, `src/components` e `src/lib`:
  falha com cor fora do mapa, shade não listada (inclusive sob `dark:`/`hover:`), `shadow-*` ou
  cor hex arbitrária (`bg-[#…]`). Ele lê o mapa direto do `tailwind.config.ts` — mapear uma shade
  nova no config já a libera.
