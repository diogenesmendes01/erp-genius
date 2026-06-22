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
- Fonte: **Anthropic Sans** é o alvo; como o arquivo não está empacotado, carregamos **Inter**
  via `next/font/google` na variável `--font-sans` (stand-in) — trocar pela Anthropic Sans
  quando houver os arquivos (`next/font/local`). `globals.css` referencia `var(--font-sans)`.
- Só **dois pesos**: **regular (400)** e **medium (500)** — nada de negrito pesado
  (`font-bold` evitado; use `font-medium`).

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
| Texto terciário | `--text-terciary` | `#88877F` | `#6E6D68` |
| Borda | `--border` | `rgba(0,0,0,.10)` | `rgba(255,255,255,.12)` |

## Tokens — Semânticos (fundo / texto — repare a inversão)
| Cor | Token bg / text | Claro (bg / text) | Escuro (bg / text) |
|---|---|---|---|
| Info (azul) | `--info-bg` / `--info-text` | `#E6F1FB` / `#0C447C` | `#0C447C` / `#B5D4F4` |
| Sucesso (verde) | `--success-bg` / `--success-text` | `#EAF3DE` / `#27500A` | `#27500A` / `#C0DD97` |
| Aviso (âmbar) | `--warning-bg` / `--warning-text` | `#FAEEDA` / `#633806` | `#633806` / `#FAC775` |
| Perigo/atraso (vermelho) | `--danger-bg` / `--danger-text` | `#FCEBEB` / `#791F1F` | `#791F1F` / `#F7C1C1` |

> **Ações sólidas** (botões de confirmar/destrutivo) usam `--danger-solid` / `--success-solid`
> (texto branco nos dois modos) — distintas dos badges. Marca: `--brand` (botão primário),
> `--brand-text` (links), `--brand-bg` (estado ativo).

## Como usar no código
As shades do Tailwind estão **mapeadas para os tokens** (ex.: `text-gray-600` → `--text-secondary`,
`bg-green-100 text-green-700` → badge sucesso que inverte sozinho, `bg-surface` → card). Então:
- **Card:** `bg-surface border border-gray-200 rounded-lg`.
- **Badge:** `rounded-full bg-{cor}-100 text-{cor}-700` (inverte no dark automaticamente).
- **Botão primário:** `bg-brand-600 text-white`. **Destrutivo:** `bg-danger text-white`.
- **Texto:** `text-gray-800/600/400` = primário/secundário/terciário.
- Evite hex literal e `shadow-*`; novas cores entram como token novo no `globals.css`.
