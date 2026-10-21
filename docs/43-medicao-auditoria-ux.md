# Medição da auditoria de UI/UX (doc 42) — quanto foi resolvido

Data: 07/10/2026. Código medido: `origin/main` em `6b105093` (depois da #138). Linha de base: `1ca53675`, o `main` que a auditoria leu. O merge da auditoria (`9bd583d2`) já continha a #64, então não serve de base. Escopo: as PRs #64–#138 (ganhos rápidos 1–24 e projetos E1–E8).

> **Atualização de 13/10/2026:** remedição na main `e5418550` (depois da #161) na §7. As seções 1–6 abaixo continuam sendo a fotografia de 07/10.
>
> **Atualização de 13/10/2026 (item 11):** amostra Média/Baixa com outra semente (20261013) na main `4c4f526a` (depois da #174) na §7.6.

## 1. Resumo em 10 linhas

1. **Cor e tipografia: tudo zerado.** `bg-brand-700` caiu de 65 arquivos para 0, `bg-white` de 40 para 0, shades fora do mapa de 98 para 0, `shadow-*` de 5 para 0 e `font-semibold` de 8 para 0. A classe de cor fora do token caiu de 4,2% para 0,0%, com trava no CI (`src/app/paleta.test.ts`).
2. **Estado de rota.** 188 das 193 páginas herdam `loading.tsx` e `error.tsx` (antes, 3/177 e 0/177). Existem `not-found` e `global-error`. Ficam sem cobertura só `/`, `/login`, `/pagar/[token]`, `/certificado/[codigo]` e `/portal`. `<Suspense>` continua em 0.
3. **Biblioteca de componentes adotada.** As importações de `@/components/*` subiram de 21 para 866, e há 24 componentes em `src/components`. O botão primário tem 1 string de `className` no critério da auditoria (eram 32); 218 arquivos usam `Botao`/`botaoClasses`.
4. **Texto da tela.** `{valor} {moeda}` cru caiu de 44 para 0, data civil em ISO de 16 para 0 e código de especificação na tela de 14 para 0. As redações de "Resultado não confirmado" caíram de 25 para 4. Já os instantes impressos com `toISOString()` continuam **8**, igual à base.
5. **Acessibilidade estática.** Nenhum controle sem nome acessível foi detectado (eram 187). A regra global de `focus-visible`, o skip link e o `aria-current` existem. Os overlays sem semântica de diálogo caíram de 8 para 0. Mas `aria-invalid` aparece só 22 vezes, para 631 `required`.
6. **Contraste: 4 famílias reprovam, antes e agora, mas não as mesmas.** `--text-terciary` foi resolvido (4,79–5,82:1). `--border-control` é **nova** e reprova por pouco sobre `surface-muted` (2,996 no claro e 2,991 no escuro). `#fff` sobre `--brand` no escuro **já reprovava e piorou**, de 4,47:1 para 4,06:1, porque a auditoria recomendou clarear `--brand`. Isso afeta 6 elementos com `bg-brand-600 text-white`. `--border` e `--brand-border` seguem iguais.
7. **Listas.** A ordenação por coluna foi de 0 para 4 `aria-sort`, com `ColunaOrdenavel` usado 11 vezes. Busca e filtro na URL estão em alunos, leads, empresas, inbox, secretaria e diário. A **paginação só para frente não mudou**: 31 de 62 arquivos.
8. **Robustez de ação.** O catch central (`useAcaoCliente`) cobre todos os client components, salvo 1 caso real. Mas 41 de 169 fluxos (24%) ainda terminam só em `router.refresh()`, contra a meta de menos de 10%. E **nenhuma das 12 ações de alto impacto verificadas ganhou confirmação**: 11 têm só estado de ocupado e 1 não tem nada.
9. **Achados Alta da seção 6:** de 145, **37 resolvidos (26%), 21 parciais (14%) e 87 abertos (60%)**. O que fechou foi só o que uma PR transversal resolve em lote. Os achados de fluxo de cada tela seguem abertos.
10. **Média e Baixa**, numa amostra estratificada de 126 de 727 achados (6 Média e 3 Baixa por área, semente 42), com veredito e evidência por linha na tabela 5.1. Na amostra crua: 17 resolvidos, 18 parciais e 91 abertos. Ponderado pela população de cada estrato, a estimativa é de **71% abertos (IC 95% 63–79%), ≈ 517 dos 727**.

## 2. Método

- **Scripts** em `scripts/medicao-ux/`, em Node ≥ 18 puro, sem dependência. O mapa de cores sai do texto do `tailwind.config.ts`, sem importar o `.ts`, então roda no Node 20 do projeto. Em versão menor, o script sai com mensagem clara.
  - `nucleo.mjs` reúne as funções puras: mapa de cores, contagem de cor, nome acessível, contraste, cobertura por herança, catch central, validação de argumentos e estimativa estratificada.
  - `metricas.mjs [raiz] [--json]` recalcula as métricas das seções 7.1–7.6.
  - `achados.mjs [--sev Alta|Media|Baixa] [--json] [--resumo]` extrai os achados da seção 6. Aceita "Média"; outra severidade é erro.
  - `amostra.mjs 6 3 42` sorteia a amostra reproduzível de Média e Baixa. Argumento não inteiro é erro.
  - Testes em `src/test/medicao-ux.test.ts`, que entram no `include` do Vitest. Cobrem uma árvore-fixture com contagens conhecidas, a extração dos 872 achados, a amostra igual às linhas da tabela 5.1, a calibração da tabela 2.1 e as somas das tabelas 4.1 e 5.1 deste documento contra os resumos das seções 4 e 5.
- **Mesma régua nos dois lados.** A linha de base é `1ca53675`, o `main` que a auditoria leu (pai do branch dela). O merge `9bd583d2` não serve: a #64 entrou antes dele, e 10 números já mudam nesse merge. Rodei `metricas.mjs` na base e no código atual:
  ```
  git archive 1ca53675 src tailwind.config.ts | tar -x -C <pasta>
  node scripts/medicao-ux/metricas.mjs <pasta> --json > docs/medicao-ux/metricas-1ca53675.json
  node scripts/medicao-ux/metricas.mjs --json > docs/medicao-ux/metricas-6b105093.json
  ```
  As duas saídas ficam versionadas, para a próxima medição comparar por diff. Arquivos `*.test.ts(x)` e `src/test/` ficam de fora nas duas medições.
- **Calibração.** A tabela 2.1 compara o doc 42 com o script rodado na base. Nas tabelas da seção 3, "base" é o valor do doc 42 e, quando difere, "base recalculada" é o do script. A comparação com o atual usa sempre a base recalculada.
- **Inventário.** As tabelas da seção 6 têm 872 linhas de achado: 145 Alta, 515 Média e 212 Baixa. A coluna "Alta" da tabela 7.8 soma 88 no domínio e não bate com as tabelas. Usei as tabelas.
- **Classificação dos achados.** Cada achado Alta foi conferido no código atual, no arquivo citado ou no que o substituiu, e classificado assim:
  - **resolvido:** o defeito não ocorre mais;
  - **parcial:** parte foi corrigida, ou só uma das telas citadas;
  - **aberto:** o defeito continua.

  A evidência é `arquivo:linha` atual e/ou a PR que resolveu. Quando a recomendação do doc 42 tem mais de uma parte (por exemplo, pré-preencher o fuso **e** mostrar a conversão) e só uma foi feita, o achado é parcial. Média e Baixa foram classificadas só por amostra (seção 5).
- **Estimativa da amostra.** A amostra tem alocação igual por estrato (área × severidade), mas os estratos têm populações diferentes. A proporção de 727 é estimada por média ponderada pela população do estrato, com variância estratificada (`estimativaEstratificada` em `nucleo.mjs`). Estrato com 0 ou 3 de 3 abertos contribui com variância zero, o que deixa o intervalo otimista.
- **Fora do alcance do grep.** Também foram lidas no código as métricas de leitura manual: consultas sem `take`, tetos, busca por lista, confirmações, guards e polling. As métricas de fluxo da 7.7 (cliques e tempo com operador real) **não foram medidas**: exigem cronômetro e operador.

### 2.1 Calibração: doc 42 × script na base `1ca53675`

| Métrica | Doc 42 | Script na base | Diferença e motivo |
|---|---|---|---|
| `page.tsx` | 177 | 177 | — |
| `loading.tsx` / `error.tsx` | 2 / 0 | 2 / 0 | — |
| `not-found.tsx` / `global-error.*` | 0 / 0 | 0 / 0 | — |
| `notFound()` | 17 em 15 arquivos | 17 em 15 | — |
| `<Suspense>` | 0 | 0 | — |
| Arquivos com `bg-brand-700` | 65 | 65 | — |
| `bg-white` | 40 / 20 arquivos | 40 / 20 | — |
| Shades fora do mapa | 95 / 29 arquivos | 98 / 29 | +3: o detector de `paleta.test.ts` também pega `border-x/y`, `ring-offset` e variantes encadeadas |
| % de cor fora do token | ≈ 9,8% (95 / (95 + ~870)) | 4,2% (98 / 2.356) | **grande**: o doc 42 estimou ~870 classes mapeadas; o script conta 2.258 |
| `dark:` / `shadow-` | 3 / 5 | 3 / 5 | — |
| Strings do botão primário | 32 | 32 | — |
| Importações de `@/components/*` | 21 | 21 | — |
| Headings sem `font-medium` | 147 de 645 | 146 de 645 | −1 |
| `font-semibold` | 8 | 8 | — |
| Mapas de rótulo ad-hoc | 30 | 29 | −1 |
| Enum cru na tela | ≥ 22 (leitura caso a caso) | 31 (regex) | **método diferente**: a regex pega candidatos, a leitura confirma |
| `{valor} {moeda}` cru | 48 | 44 | −4: o grep do doc 42 não foi publicado; a regex do script exige `{…moeda}` logo depois |
| Data civil em ISO | 18 | 16 | −2, mesmo motivo |
| "Resultado não confirmado" | 25 | 25 | — |
| Códigos de especificação | 7 telas | 14 linhas | **unidade diferente** (telas × linhas, com comentários) |
| Controles sem nome | 198 em 32 arquivos (de 1.085) | 187 em 29 (de 1.085) | −11 / −3 arquivos; o total de controles é igual. A varredura do doc 42 não foi publicada |
| `aria-invalid` / `required` | 0 / 619 | 0 / 619 | — |
| Overlays com diálogo + Esc | 1 de 9 | 1 de 9 | — |
| `focus-visible` em `globals.css` | 0 | 0 | — |
| `outline-none` sem `focus:ring` | 37 (de 51) | 37 (de 51) | — |
| `setErro` sem `role="alert"` | 34 | 34 | — |
| Skip link / `aria-current` | 0 / 0 | 0 / 0 | — |
| Famílias de token reprovando AA | 4 | 4 | — |
| `useSearchParams` | 0 | 0 | — |
| Busca | 3 de 10 listas | 6 linhas `placeholder="Buscar` | **unidade diferente**: o doc 42 conta listas; a leitura das listas está na 7.5 |
| Contador "N de M" | 1 | 1 | — |
| Tabelas de 7+ colunas sem `overflow-x` | 9 de 30 | 3 arquivos (por arquivo) / 2 de 6 tabelas largas (por tabela) | **grande**: o critério do doc 42 não é reproduzível com o comando citado. Os 20 wrappers `overflow-hidden` do doc 42 (5.8) batem com o script |
| Paginação só para frente | 31 de 61 | 31 de 61 | — |
| `aria-sort` | 0 | 0 | — |
| Server action sem `catch` | 55 de 200 | 55 de 200 | — |
| Fluxos só com `router.refresh()` | 78 de 169 | 80 de 169 | +2 |
| `.focus()` / `scrollIntoView` | 0 / 1 | 0 / 1 | — |
| Dinheiro em `type="number" step="0.01"` | 16 | 16 | — |
| `name="fuso` / `defaultValue="UTC"` | 22 / 10 | 22 / 10 | — |

Resultado: 27 linhas iguais e 12 diferentes. Das 12, 4 são de unidade ou método (enum, códigos, busca, tabelas), 1 é de denominador (%) e 7 são de critério de regex (de −11 a +3).

## 3. Métricas das seções 7.1 a 7.6

Legenda da coluna "Situação": ✅ meta atingida, ◐ andou e não atingiu a meta, ✖ não andou ou piorou.

### 7.1 Cobertura de estado de rota

| Métrica | Base | Hoje | Meta | Situação | Comando |
|---|---|---|---|---|---|
| `loading.tsx` | 2 arquivos; 3 de 177 páginas cobertas | **9 arquivos; 188 de 193 páginas cobertas por herança** | ≥ 14 arquivos | ◐ — a cobertura é total no shell e no portal; faltam esqueletos próprios em `matriculas/`, `academico/`, `diario/` e `secretaria/` | `find src/app -name loading.tsx \| wc -l` + cobertura por herança no `metricas.mjs` |
| `error.tsx` | 0 | **2** (`(app)` e `portal-aluno`), 188/193 páginas | ≥ 2 | ✅ | `find src/app -name error.tsx \| wc -l` |
| `not-found.tsx` / `global-error.tsx` | 0 / 0 | **4 / 1** (raiz, `(app)`, `matriculas/[id]`, `portal-aluno`) | ≥ 1 cada | ✅ | `find src/app -name "not-found.tsx" -o -name "global-error*"` |
| `notFound()` sem página 404 própria | 17 | **0**: as 22 chamadas (19 arquivos) caem num `not-found.tsx` do shell ou da raiz | 0 | ✅ | `grep -rn "notFound()" src --include=*.ts*` × árvore de `not-found.tsx` |
| `<Suspense>` | 0 | **0** | ≥ 1 nas 3 telas pesadas | ✖ | `grep -rn "<Suspense" src --include=*.tsx \| wc -l` |

Sem `loading.tsx` nem `error.tsx` ficam: `src/app/page.tsx`, `login/page.tsx`, `pagar/[token]/page.tsx`, `certificado/[codigo]/page.tsx` e `(portal)/portal/page.tsx`. São páginas fora do shell; a #64 cobriu essas rotas com `src/app/not-found.tsx` e `global-error.tsx`.

### 7.2 Classe de cor fora do token

| Métrica | Base | Hoje | Meta | Situação | Comando |
|---|---|---|---|---|---|
| Arquivos com `bg-brand-700` | 65 | **0** | 0 | ✅ (#65/#66) | `grep -rl 'bg-brand-700' src --include=*.tsx \| wc -l` |
| `bg-white` literal | 40 / 20 arquivos | **0** | 0 | ✅ (#66) | `grep -rn 'bg-white' src --include=*.tsx \| wc -l` |
| Shades fora do mapeamento | 95 (recalculada: 98) / 29 arquivos | **0** | 0, com grep no CI | ✅ (#67; trava `paleta.test.ts`, #80) | detector de `paleta.test.ts` reproduzido no `metricas.mjs`, com o mapa do `tailwind.config.ts` de cada lado |
| Classes `dark:` manuais | 3 | **0** | 0 | ✅ | `grep -rn 'dark:' src --include=*.tsx \| wc -l` |
| `shadow-*` | 5 | **0** | 0 | ✅ | `grep -rn 'shadow-' src --include=*.tsx \| wc -l` |
| % de classes de cor fora do token | ≈ 9,8% (doc 42; o denominador era estimado em ~870) — recalculada: 98 / 2.356 = **4,2%** | **0,0%** (0 de 1.997) | < 1% | ✅ | união dos greps acima ÷ total de utilitários de cor com shade |

### 7.3 Design system aplicado

| Métrica | Base | Hoje | Meta | Situação | Comando |
|---|---|---|---|---|---|
| Strings distintas do botão primário | 32 | **1** no critério literal (`bg-brand-600\|700`): `h-full bg-brand-600`, que é a barra de progresso de `HomeVendedor`, não um botão. Contando `bg-brand-solid`, são 9 strings: 5 são botões fora do shell (login, `global-error`, `/pagar`, três telas de auth do portal, `entrega-gravacao`) e 4 são badge, input de arquivo ou indicador | 1 (via `Botao`) | ◐ — falta migrar os botões das telas fora do shell | `grep -rhoE 'className="[^"]*bg-brand-(600\|700)[^"]*"' src --include=*.tsx \| sort -u \| wc -l` |
| Arquivos que usam `Botao`/`botaoClasses` | 0 | **218** | — | ✅ (#105, #112–117, #135; trava `botoes.test.ts`, follow-up #140) | `grep -rlE 'botaoClasses\|<Botao\b' src --include=*.tsx` |
| Importações de `@/components/*` | 21 | **866** | ≥ 300 | ✅ | `grep -rho 'from "@/components/[A-Za-z]*"' src --include=*.tsx \| wc -l` |
| Headings sem `font-medium` | 147 de 645 (recalculada: 146) | 141 de 646 sem a classe, mas **0 sem peso**: a regra `h1…h6, dt, b, strong, th { font-weight: 500 }` está em `globals.css` | 0 (por regra em `@layer base`) | ✅ (#79; trava `tipografia.test.ts`) | contagem de `<h1-3` × `globals.css` |
| `font-semibold` | 8 | **0** | 0 | ✅ | `grep -rn 'font-semibold' src --include=*.tsx \| wc -l` |
| Mapas de rótulo ad-hoc em componentes | 30 (recalculada: 29) | **22** pelo grep. Na leitura, 12 são funções de formatação ou apelidos de `labels.ts` (`const rotulo = STATUS_ENCONTRO_LABEL`). Mapas literais restantes: `rotulosAcao` (`ResolucaoRevisaoProgressao`), `rotulosPendencia` e `rotulosInsuficiencia` (`CorrecaoAula`), `rotuloParticipacaoOrigem` (`ReposicoesEquipe`), `rotuloReferenciaVencimento` (`CondicoesContinuidadeMensal`) e `rotulosPendencia` (portal, `resultados`); mais 2 de campos, não de enum (`PreparacaoMigracaoPainel`, `CadastroContratualAplicado`) | 0 | ◐ (#138; brechas da trava em #142) | `grep -rnoE "(const\|function) (rotulo\|rotulos\|ROTULO\|ROTULOS)[A-Za-z0-9_]*" src/app src/components --include=*.tsx` |
| Enum cru no texto | ≥ 22 (leitura) — heurística recalculada: 31 | **2** candidatos: `{item.estado}` em `academico/recuperacoes/page.tsx:25` e `{c.tipo}` na tabela de comissões de `financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx:22` | 0 | ◐ (#93, #138; follow-up #142) | regex `{x.status\|situacao\|estado\|tipo}` fora de atributo (`metricas.mjs`) |
| `{valor} {moeda}` cru | 48 (recalculada: 44) | **0** | 0 | ✅ (#93) | `\{…\}\s*\{…moeda\}` |
| Datas civis em ISO cru | 18 (recalculada: 16) | **0** | 0 | ✅ (#111, #137) | `{….vencimento\|competencia\|coberturaInicio}` |
| Instantes impressos com `toISOString()` (não estava na 7.3; citado em 5.7 A4) | 8 | **8**: `matriculas/[id]/emissao/page.tsx:18`, `pagador/page.tsx:29`, `segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx:54,56`, `admissoes/excecoes/[reservaId]/page.tsx:29`, `alunos/[id]/movimentacoes/page.tsx:62`, `configuracao/contratos/[codigo]/page.tsx:35,45` | 0 | ✖ | `\{…toISOString()…\}` seguido de texto, ponto ou tag |
| Redações de "Resultado não confirmado" | 25 | **4**: 3 constantes em `src/lib/mensagens.ts`, uma por evento (decisão da #118), e 1 avulsa em `secretaria/reservas/ConferirReserva.tsx`. Há 355 usos das constantes | 1 (ou 2) | ◐ — a avulsa deveria virar constante | `grep -rhoE '"Resultado não confirmado[^"]*"' src \| sort -u` |
| Códigos internos de especificação na tela | 7 telas (recalculada: 14 linhas) | **0** | 0 | ✅ (#111; trava `codigos-internos.test.ts`) | `grep -rn 'Q23\|Q92\|Q165\|M01\|(S15)' src/app --include=*.tsx` |

### 7.4 Acessibilidade

| Métrica | Base | Hoje | Meta | Situação | Comando |
|---|---|---|---|---|---|
| Controles sem nome acessível | 198 (recalculada: 187 de 1.085) | **0 reais**. O script aponta 7 candidatos em 4 arquivos, e todos são falso positivo verificado: 4 estão em comentários de `CampoFuso`/`CampoTexto`; os outros recebem `id` por prop e o `htmlFor` fica no chamador. Os controles crus caíram para 757, porque 319 viraram `CampoTexto`, 15 `CampoMoeda` e 10 `CampoFuso` | 0 | ✅ (#76, #82–84) — varredura estática; não houve auditoria em leitor de tela | varredura de tags no `metricas.mjs` (dentro de `<label>`, `aria-label`, `id`↔`htmlFor`) |
| `aria-invalid` | 0 para 619 `required` | **22** em 6 arquivos (`LeadFormulario`, `UsuarioFormulario`, `PaisFormulario`, `ModalidadeFormulario`, `login`, `CampoTexto`), para 631 `required` | ≥ 1 por formulário com validação (146 formulários) | ◐ — **em andamento** na #145: `Campo` único com `aria-invalid` (E1/E7) | `grep -ro "aria-invalid" src --include=*.tsx \| wc -l` |
| Overlays com `role="dialog"` + `aria-modal` + Esc | 1 de 9 | **4 de 4** arquivos com `fixed inset-0` (`Modal`, `Drawer`, `FilaCobranca`, `TurmasPainel`); os outros 5 overlays viraram `<Modal>` (9 usos de `Modal`/`Drawer`) | 9 de 9 | ✅ (#89; trava `dialogos.test.ts`) | `grep -rln 'fixed inset-0'` + teste por arquivo |
| Regra global de `focus-visible` | 0 | **1 regra** (`globals.css`, 6 linhas de seletor) | 1 | ✅ (#71) | `grep -n "focus-visible" src/app/globals.css` |
| `outline-none` sem substituto | 37 | 42 pelo grep literal (`grep -vc focus:ring`), mas **0 efetivos**: a regra global tem especificidade 0-1-1, maior que a 0-1-0 de `.outline-none`, e as 56 linhas com `outline-none` também têm `focus:border` ou `focus-visible:` | 0 | ✅ | `grep -rn outline-none src --include=*.tsx \| grep -vc focus:ring` |
| Telas com erro/sucesso sem live region | 34 | 16 pelo grep literal (`setErro` sem `role="alert"`), **0** contando `FeedbackAcao`/`MensagemStatus`. Ressalva: em ~12 formulários o erro sai num `MensagemStatus` (`role="status"`, sem cor), junto com o sucesso (seção 4) | 0 | ◐ — live region existe; erro como alerta, não | loop `grep -q setErro` + `! grep -q 'role="alert"'` |
| Skip link / `aria-current` | 0 / 0 | **1 / 2 ocorrências** de `aria-current` na Sidebar, em expressão dinâmica que cobre os 16 itens | 1 / 16 | ✅ (#71) | `grep -rn "Pular para\|aria-current" src/components/Sidebar.tsx 'src/app/(app)/layout.tsx'` |
| Pares de token reprovando AA | 4 famílias: `#fff/--brand`, `--border`, `--brand-border`, `--text-terciary` | **4 famílias**: `#fff/--brand`, `--border`, `--border-control` e `--brand-border`. **Saiu** `--text-terciary`, agora com 4,79–5,82:1 nas três superfícies e nos dois temas. **Entrou** `--border-control` (token novo da #71): 2,996 sobre `surface-muted` no claro e 2,991 no escuro, abaixo de 3; sobre `surface` passa (3,04 e 3,07). **Piorou** `#fff`/`--brand` no escuro: já reprovava com 4,47:1 e caiu para 4,06:1, porque `--brand` foi clareado para `#6b6ef5`, como a auditoria recomendou. Esse par aparece em 6 elementos com `bg-brand-600 text-white`: `SubTabs.tsx:31`, `BarraAbasFinanceiro.tsx:27`, `FichaLead.tsx:182`, `TurmaFormulario.tsx:255`, `PoliticaPainel.tsx:203` e `MatriculaFormulario.tsx:795`. A barra de `HomeVendedor` não tem texto. **Igual:** `--border` e `--brand-border` (1,25–1,56), em bordas de cartão decorativas | 0 | ◐ — trocar `bg-brand-600` por `bg-brand-solid` (7,90:1) e escurecer `--border-control` | cálculo WCAG sobre os tokens de `globals.css` (`metricas.mjs`) |

### 7.5 Listas, dados e busca

| Métrica | Base | Hoje | Meta | Situação | Comando |
|---|---|---|---|---|---|
| Consultas de lista principal sem `take` | 6 | **3** no caminho ativo: `listarLeads` chamada por `/pipeline` sem `take` nem filtro (`server/comercial/consultas.ts:239`, `pipeline/page.tsx:13`); `listarFilaCobranca` (`server/cobrancas/consultas.ts:211-222`, filtro só no cliente); `listarInformesPagamento` (`server/financeiro/consultas.ts:184-194`). Já paginadas: alunos (#92), leads (#95), comissões (#103/#122), empresas (#98). `listarAlunos` **ainda carrega todas as cobranças** de cada aluno para pintar a coluna de situação (`server/alunos/consultas.ts:224-232`), agora limitado a 50 alunos por página | 0 | ◐ | leitura das 6 consultas |
| Listas com teto fixo sem página seguinte | 3 | **1**: a inbox mantém o teto de 200 sem página seguinte, mas agora avisa "Mostrando as 200 mais recentes…", tem busca no servidor e as não lidas antigas entram até o limite de 500 (`busca-inbox.ts:9,11`). `/secretaria` (40/página) e `/carteiras` (50/página) têm `Paginacao` e contador (#103) | 0 | ◐ — nenhum teto mudo; a inbox ainda tem teto | leitura dos `take` sem cursor |
| Filtros de lista na URL | 0 arquivos com `useSearchParams` | 0 em `src/app`/`src/components`. O padrão adotado é outro: filtro lido do `searchParams` da página, no servidor, mais `useFiltrosUrl` (`src/lib/filtros-url.ts`, que usa `useSearchParams`) em 4 listas. 104 páginas leem `searchParams`. Na leitura das 10 listas principais, **9 de 10** têm filtro na URL; falta a fila de cobrança do `/financeiro` (`FilaCobranca.tsx:88-91`, `useState`) | ≥ 5 (alunos, leads, financeiro, empresas, pipeline) | ✅ em número; `/pipeline` não tem filtro e a fila de cobrança está **em andamento** na #144 (E4) | `grep -rl "useSearchParams\|useFiltrosUrl" src --include=*.ts*` + leitura |
| Listas principais com busca | 3 de 10 | **7 de 10**: alunos, leads, fila de cobrança (só no cliente), secretaria, empresas, inbox e diário. Faltam `/pipeline`, `/comissoes` e `/carteiras`. `placeholder="Buscar` foi de 6 para 10 linhas | 10 de 10 | ◐ — `/comissoes` **em andamento** na #144 (E4) | `grep -rn 'placeholder="Buscar' src/app --include=*.tsx` + leitura das 10 listas |
| Contadores "N de M" em lista filtrável | 1 | **8 de 10** listas (faltam inbox e diário) | ≥ 6 | ✅ | leitura das listas |
| Tabelas de 7+ colunas sem `overflow-x` | 9 de 30 (recalculada por tabela: 2 de 6 largas; wrappers `overflow-hidden` que cortam: 20) | **0 de 6**; wrappers `overflow-hidden` sem `overflow-x`: **0** | 0 | ✅ (#75; trava `responsivo.test.ts`) | contagem de `<th>` por tabela × `overflow-x` no wrapper (`metricas.mjs`) |
| Paginações só para frente | 31 de 61 | **31 de 62**. `Paginacao` bidirecional é usado em só 7 arquivos | 0 | ✖ | arquivos com "Próxima" e sem "Anterior" |
| Colunas ordenáveis | 0 | **4** `aria-sort` (`ColunaOrdenavel` usado 11 vezes em `/comissoes`, `/alunos` e `/empresas`) | ≥ 3 listas | ✅ (#136; trava em #141) | `grep -rn "aria-sort" src --include=*.tsx \| wc -l` |

### 7.6 Robustez de ação e feedback

| Métrica | Base | Hoje | Meta | Situação | Comando |
|---|---|---|---|---|---|
| Client components com server action e sem `catch` | 55 de 200 | 57 de 202 pelo grep literal. Contando `useAcaoCliente`/`executarAcaoCliente` como catch central: **3 pelo grep, 0 reais**, porque os 3 importam só tipo ou função pura de `@/server` (`AlunosLista`, `LeadsLista`, `ValorEstruturadoCampo`). A leitura achou **1 caso real**, que o grep por arquivo não pega: `academico/regras/turmas/[turmaId]/historica/ConferenciaRegraHistorica.tsx:14` (`try/finally` sem `catch`) | 0 | ◐ (#85–87; trava `acoes-cliente.test.ts`) | loop `use client` + `from "@/server/"` + `! grep -q catch` |
| Fluxos que terminam só em `router.refresh()` | 78 de 169 (recalculada: 80) | 96 pelo grep literal; o critério deixou de valer, porque `setMensagem` foi trocado por `useAcaoCliente`. Contando sucesso via `useAcaoCliente`/`FeedbackAcao`/`MensagemStatus`: **41 de 169 (24%)**. Desses, 4 são navegação de autenticação (`login`, `entrar`, `ativar`, `sair`) | < 10% | ◐ | loop + `grep -qiE "setMensagem\|setSucesso\|setAviso\|setNota\|sucesso:\|useAcaoCliente\|MensagemStatus"` |
| `.focus()` / `scrollIntoView` ao exibir erro | 0 / 1 | **4 / 2**, centralizados: `FeedbackAcao` faz `scrollIntoView({block:"center"})` + `focus()` e é usado em 50 arquivos | ≥ 1 por componente de feedback | ✅ (#85) | `grep -rn "\.focus()\|scrollIntoView" src` |
| Dinheiro em `type="number" step="0.01"` | 16 / 11 arquivos | **0 de dinheiro**: os 3 restantes são percentuais (limites de desconto em `UsuarioFormulario` e percentual de comissão em `PoliticasComissao`). `CampoMoeda` tem 15 usos | 0 | ✅ (#68) | `grep -rnoE '<input[^>]*type="number"[^>]*step="0.01"' src` |
| Campos de fuso em texto livre | 22 / 20 arquivos, 10 com `UTC` fixo | **11** campos visíveis fora do `CampoFuso`: o grep dá 13 linhas, das quais 1 é comentário e 1 é hidden. 7 são texto sem sugestão; 3 deles vêm vazios, só com placeholder (agenda e remarcação de segunda chamada, fechamento de horas). 4 têm `datalist`. Há mais 10 usos de `CampoFuso`. A leitura achou ao menos mais 2 fora do grep (`ConferenciaAgendaFormulario.tsx`, `PrepararGrade.tsx:48`). `defaultValue="UTC"`: **1 pelo grep, 0 em código** (a ocorrência é o comentário em `CampoFuso.tsx:4`), mas há fallback para UTC quando a escola não tem fuso configurado (`avaliacoes/[alocacaoId]/[codigo]/page.tsx:22`). Nenhum campo de fuso é `<select>`; `CampoFuso` é `input` + `datalist` | 0 | ◐ (#69) | `grep -rn 'name="fuso' src --include=*.tsx` |
| Ações de alto impacto sem confirmação | ~10 | **12 de 12** verificadas continuam sem confirmação: as 9 do ranking 8 mais desativar usuário, preço e idioma. 11 ganharam só estado de ocupado (#72, #86, #87). "Cobrar"/"Lembrar" na linha da fila (`FilaCobranca.tsx:454`) e o "Enviar via WhatsApp (API)" da gaveta (`:589`) não têm nem ocupado | 0 | ✖ | leitura dos botões do ranking 8 |
| Guards de sessão por render de `/financeiro` | ~12 `usuario.findUnique` | **~3** (2 para administrador): `carregarUsuarioFresco`, `papeisDaSessao` e `escopoComercialAtual` estão memoizados por requisição (`_shared/memo-requisicao.ts`, #91). Sobram `podeConfigurarComissoes` (`financeiro/consultas.ts:228-231`) e `consultarPreferenciaFusoEquipe`. O `auth()` (JWT) continua uma vez por guard | 1 | ◐ | leitura de `sessao.ts`, `guards.ts`, `escopo-comercial.ts` |
| Reconstruções da inbox por hora em segundo plano | ~120 | **0**: só faz `router.refresh()` com `visibilityState === "visible"`, e faz um refresh ao voltar para a aba (`InboxCliente.tsx:122-134`, #74) | 0 | ✅ | `setInterval` × `visibilityState` |

### Extras: números das seções 4 e 5 sem linha própria na 7

| Métrica | Base | Hoje | Projeto |
|---|---|---|---|
| `grid-cols-2` sem prefixo de breakpoint | 25 | **6**, todos de KPI `grid grid-cols-2 … md:grid-cols-4` (`HomeGerente:24`, `HomeVendedor:65`, `FichaFinanceira:141`, `FilaCobranca:259`, `FinanceiroPainel:343`, `FichaLead:302`). São permitidos por `responsivo.test.ts`: nada a reduzir | E6 (#94) |
| `page`/`layout` com `metadata`/`generateMetadata` | 2 | **6** (títulos de aba nas fichas e em `/matriculas/[id]`) | E2 (#90, #106) |
| Classes de mostrar/esconder por breakpoint | 0 | **3** (Sidebar `hidden md:flex`, `BarraMobile`) | E6 (#94) |
| `<textarea minLength>` sem contador | 254 | **2** (`CampoTexto` tem 319 usos) | E1 (#121) |
| `<p>Nenhum…</p>` cru | 129 | **9** (`EstadoVazio` tem 260 usos) | E1 (#126, #134; trava em #139) |
| `beforeunload` (proteção de rascunho) | 0 | **0** | — |
| Confirmação de ação (`window.confirm` ou componente) | 1 | **1** (`ReguaComercialPainel.tsx:127`); `ConfirmarAcao`, proposto no E1, não existe | E1 |

## 4. Achados Alta da seção 6 (145)

| Área | Alta | Resolvido | Parcial | Aberto |
|---|---|---|---|---|
| Alunos e turmas | 12 | 6 | 1 | 5 |
| Secretaria | 4 | 1 | 0 | 3 |
| Matrículas — entrada | 7 | 0 | 3 | 4 |
| Matrículas — contrato | 6 | 0 | 1 | 5 |
| Matrículas — ciclo | 9 | 0 | 1 | 8 |
| Acadêmico — base | 22 | 5 | 2 | 15 |
| Acadêmico — avaliações | 10 | 1 | 0 | 9 |
| Acadêmico — recuperações | 4 | 1 | 3 | 0 |
| Acadêmico — segundas chamadas | 9 | 0 | 2 | 7 |
| Diário de aulas | 7 | 3 | 0 | 4 |
| Financeiro | 5 | 1 | 1 | 3 |
| Comercial | 14 | 4 | 3 | 7 |
| Configuração | 17 | 2 | 3 | 12 |
| Público e portal | 19 | 13 | 1 | 5 |
| **Total** | **145** | **37 (26%)** | **21 (14%)** | **87 (60%)** |

**Leitura.** Os 37 resolvidos vieram todos de PRs transversais:
- 17 de tokens e cor (#66, #67): portal do aluno, diff de correção, regularizações, troca de fonte, inbox e migração;
- 14 de `useAcaoCliente`/`FeedbackAcao`/`Modal` (#85–89);
- 1 de `CampoFuso` + `min` cruzado (#69, #78), em L1603;
- 5 de busca e paginação (#103), coluna de empresas (#101), moeda (#93), bordas de rota (#64) e shell mobile (#94).

**Mudança na R1.** L1540 e L1590 passaram de "resolvido" para "parcial". O `CampoFuso` (#69) cumpriu a parte de pré-preencher e sugerir o fuso, mas a recomendação do doc 42 também pede "exibir a conversão resultante" antes de enviar, e isso não existe. É o mesmo critério já aplicado a L1786. Além disso, o campo continua texto livre e vem vazio quando a escola não tem fuso configurado. L1603 fica como resolvido: a recomendação dele pede só pré-preencher, sugerir e validar `fim > início`, e as três partes foram feitas.

Os 108 abertos ou parciais são, na maioria, defeitos de fluxo de cada tela, que nenhuma PR em lote alcança. Cinco padrões concentram 67 deles:

| Padrão (Alta aberto ou parcial) | Qtde | Linhas do doc 42 |
|---|---|---|
| Ação irreversível ou de alto impacto sem confirmação ou resumo | 22 | 309, 531, 547, 715, 799, 853, 906, 1058, 1102, 1156, 1218, 2014, 2016, 2281, 2295, 2298, 2428, 2499, 2516, 2517, 2518, 2693 |
| Formulário que perde o que foi digitado (`key` com versão/página/filtro, `<form method="get">` aninhado, troca de tipo, nenhum `beforeunload`) | 15 | 562, 629, 1059, 1081, 1314, 1327, 1761, 1814, 1835, 2202, 2203, 2217, 2367, 2368, 2395 |
| Erro e sucesso no mesmo `setMensagem` → `MensagemStatus` (`role="status"`, sem cor), ou sucesso que some no refresh | 10 | 1315, 1389, 1400, 1438, 2442, 2457, 2485, 1219, 1671, 892 |
| Beco sem saída ou link que falta | 9 | 577, 691, 905, 934, 1244, 1670, 1709, 1722, 2676 |
| Fuso e instante (texto livre, UTC fixo, sem conversão) | 11 | 406, 530, 729, 1126, 1256, 2429; parciais: 1540, 1566, 1590, 1747, 1786 |

### 4.1 Tabela por achado

`L` = linha do achado em `docs/42-auditoria-frontend-ux.md`. Os caminhos são relativos a `src/app/(app)/`, salvo quando indicado.

**Alunos e turmas**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 224 | /alunos | 1 | aberto | `alunos/ImportarAlunosModal.tsx:122-123`: "Importar" continua habilitado com o mesmo arquivo depois do resultado; `api/alunos/importar/route.ts:151` faz `create` sem checar duplicidade |
| 225 | /alunos | 2 | parcial | O fundo não fecha mais depois do resultado (`bloquearFechamento`, #89), mas não há download nem cópia das linhas rejeitadas |
| 240 | /alunos/[id] | 1 | resolvido | Erro dentro do Drawer, acima dos botões (`FichaAluno.tsx:233`, `FeedbackAcao`, #87) |
| 241 | /alunos/[id] | 2 | resolvido | `disabled={acao.ocupado}` + "Confirmando…" (`FichaAluno.tsx:430,447`, #87) |
| 279 | /alunos/[id]/creditos/[creditoId] | 1 | aberto | `creditos/[creditoId]/page.tsx:13`: o título não traz o aluno; o nome está só no título da aba (#106) |
| 293 | /alunos/[id]/financeiro | 1 | aberto | `FichaFinanceira.tsx:153-159` sem coluna "Contrato"; o campo `contrato` (`:77`) está declarado e sem uso |
| 294 | /alunos/[id]/financeiro | 2 | resolvido | Erro dentro do Modal de ajuste (`FichaFinanceira.tsx:366`, #85) |
| 295 | /alunos/[id]/financeiro | 3 | resolvido | Erro (`role="alert"`) e sucesso (`role="status"`) separados na linha (`ResumoFinanceiroComercial.tsx:62`, #85) |
| 308 | /alunos/[id]/movimentacoes | 1 | aberto | Os seis painéis começam vazios, sem `useEffect` (`MovimentacoesPainel.tsx:100`, `CompensacoesPainel.tsx:75`, …) |
| 309 | /alunos/[id]/movimentacoes | 2 | aberto | `EfetivarAcerto.tsx:14-23` ganhou ocupado, mas continua sem confirmação; a falha sai como `role="status"` |
| 323 | /alunos/[id]/portal | 1 | resolvido | Os quatro cartões usam `bg-surface` (`portal/painel.tsx:50-53`, #66) |
| 324 | /alunos/[id]/portal | 2 | resolvido | `disabled={acao.ocupado}` + `FeedbackAcao` por seção (`painel.tsx:51-53`, #87) |

**Secretaria**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 361 | /secretaria | 1 | resolvido | Busca por nome/código, contagem e `Paginacao` (`secretaria/page.tsx:20-43`, #103) |
| 363 | /secretaria | 3 | aberto | `SecretariaPainel.tsx:26-29`: um único `erro`/`ocupado` para a lista; o alerta fica no topo (`:34`) e todos os cards travam juntos |
| 406 | /secretaria/reservas/particulares/[id] | 1 | aberto | `particulares/[id]/page.tsx:14`: `horarios[0]?.fusoOrigem` aplicado a todos os horários (`:20`, `:23`) |
| 431 | /secretaria/envios-portal | 1 | aberto | `server/.../fila-envios.ts:8,43` só com cursor e `orderBy id asc`; `envios-portal/page.tsx:26` lista todas as situações, sem filtro |

**Matrículas — entrada e contratação**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 471 | /matriculas/nova | 1 | parcial | `Campo` liga `htmlFor`+`id` (`MatriculaFormulario.tsx:722-726`, #84); emergência e responsável (`:485-511`) têm `aria-label`, mas o placeholder segue como único rótulo visível |
| 472 | /matriculas/nova | 2 | parcial | Erro junto do botão "Próximo" (`:516-517`, #87); `validarPasso1` (`:251-266`) ainda devolve só o primeiro erro, sem marcar campo nem dar foco |
| 530 | /matriculas/[id]/preparacao | 1 | aberto | `preparacao/page.tsx:29` repete a expressão do fuso sem o fallback e deixa o "·" órfão |
| 531 | /matriculas/[id]/preparacao | 2 | parcial | Estilos diferenciados (`DecidirPreco.tsx:23`, #135); sem confirmação e sem repetir os valores decididos |
| 547 | /matriculas/[id]/emissao | 1 | aberto | Sem soma nem contagem do plano (`emissao/page.tsx:27`); botão genérico (`ConfirmarEmissao.tsx:24`) |
| 562 | /matriculas/[id]/pagador | 1 | aberto | `PagadorFormulario.tsx:12` (`dados` só quando `atual.tipo === tipo`) e `:25` (`<fieldset key={tipo}>`): trocar o tipo ainda apaga os seis campos |
| 577 | /matriculas/[id]/entrada-particular | 1 | aberto | Link para `/financeiro` incondicional (`entrada-particular/page.tsx:27`); a guarda segue sem SECRETARIA (`financeiro/contexto.ts:16`) |

**Matrículas — contrato, aditivos e substituições**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 629 | …/contrato/previas/[previaId]/participantes | 1 | aberto | Ainda `<form method="get">` para a maioridade (`participantes/page.tsx:44`), com `key` incluindo `maioridade` (`:47`) |
| 666 | …/contrato/substituicoes/[propostaId] | 1 | aberto | Dois `TextoPrevia` integrais lado a lado (`page.tsx:34,37`), sem destacar diferenças |
| 691 | …/contrato/aditivos/[propostaId] | 1 | aberto | Mensagem sem link em `[propostaId]/page.tsx:39`; os imports de `:15-16` seguem sem uso |
| 703 | …/aditivos/[propostaId]/alcadas | 1 | parcial | `VoltarPara` (#110) e cabeçalho com aluno e código (#90); faltam a versão da proposta e o link do PDF |
| 715 | …/aditivos/[propostaId]/originais/[artefatoId] | 1 | aberto | `CondicoesFormalizadasFormulario.tsx:12`: só o botão, sem checkbox, motivo ou resumo |
| 729 | …/contrato/aditivos/agenda | 1 | aberto | "Fuso novo" em `<input>` livre (`ConferenciaAgendaFormulario.tsx:26`); `catch` genérico em `:25` |

**Matrículas — ciclo de vida, desistência e compensações**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 787 | …/desistencia/documentos | 1 | aberto | `documentos/page.tsx:31`: `<li>{doc.nome}</li>`, sem `url` no select (`desistencia-documental.ts:68`) |
| 798 | …/desistencia/financeiro | 1 | aberto | `<td>{item.cobrancaId}</td>` (`desistencia/financeiro/page.tsx:63,87`) e `credito.id` (`:88`) |
| 799 | …/desistencia/financeiro | 2 | aberto | `AcertoContratualFormularios.tsx:41` e `ReconferenciaDeltaFormularios.tsx:87` aplicam com um clique |
| 853 | …/compensacoes/[cobrancaId]/periodo-integral | 1 | aberto | `PeriodoIntegral.tsx:193-207`: "Aplicar regularização aprovada" sem resumo nem confirmação |
| 891 | …/continuidade-mensal | 1 | aberto | `CondicoesContinuidadeMensal.tsx:39,127-136`: calendário transcrito à mão, sem pré-preenchimento |
| 892 | …/continuidade-mensal | 2 | aberto | Mensagem no topo (`:45`), botão em `:145`, sem foco nem rolagem |
| 905 | …/fechamentos-horas | 1 | parcial | O layout (#90) dá abas de saída, mas a aba "Fechamentos de horas" (`secoes.ts:33`) aponta para a rota sem `?aluno=` e cai no mesmo beco (`page.tsx:32`) |
| 906 | …/fechamentos-horas | 2 | aberto | `EmitirFechamento.tsx:16-23`: "Emitir cobrança aprovada" com um clique |
| 934 | …/indisponibilidade-oferta | 1 | aberto | `RelatosIndisponibilidadeOferta.tsx:83`: sem link para `/compensacoes/{cobrancaId}` |

**Acadêmico — calendário, grades, regras, modalidades, admissões**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 1014 | /academico/admissoes/[id] | 1 | aberto | `JanelaFormulario.tsx:32`: `type="date"` sem `min` |
| 1035 | /academico/admissoes/excecoes/[reservaId] | 1 | aberto | `FormularioExcecao.tsx:26`: `defaultValue="rejeitar"`, sem opção vazia |
| 1036 | /academico/admissoes/excecoes/[reservaId] | 2 | resolvido | `useAcaoCliente` + `FeedbackAcao` (`FormularioExcecao.tsx:15-21`, #87) |
| 1058 | /academico/calendario/novo | 1 | aberto | `PrepararCalendario.tsx:43`: o período sai na hora, sem confirmação |
| 1059 | /academico/calendario/novo | 2 | aberto | Nenhum `beforeunload` em `src/` |
| 1070 | /academico/calendario/[id] | 1 | aberto | `page.tsx:18` conta os encontros PREVISTO da escola inteira; o botão desabilitado (`:42`) não remete ao replanejamento |
| 1081 | …/calendario/[id]/replanejamento | 1 | aberto | `EditorRevisao.tsx:58`: `SalvarRevisao` desmonta quando `alterado` |
| 1102 | …/revisoes/[revisaoId] | 1 | aberto | `DecidirReplanejamento.tsx:20`: "Aprovar e aplicar conjunto" sem "Conferi" nem diálogo |
| 1103 | …/revisoes/[revisaoId] | 2 | resolvido | `useAcaoCliente({idempotente:false})` + `FeedbackAcao` (#87) |
| 1126 | /academico/grades/nova | 1 | aberto | `PrepararGrade.tsx:48-49`: fuso em texto livre com `datalist` de 3 sugestões |
| 1156 | /academico/regras/[nivelId] | 1 | aberto | `Formularios.tsx:64`: "Remover última avaliação" sem confirmação; campos não controlados |
| 1182 | …/regras/turmas/[turmaId]/historica | 1 | resolvido | `historica/page.tsx:41` usa `bg-gray-50` (#67) |
| 1183 | …/regras/turmas/[turmaId]/historica | 2 | aberto | `ConferenciaRegraHistorica.tsx:14`: `try/finally` sem `catch` (escapou da #87) |
| 1184 | …/regras/turmas/[turmaId]/historica | 3 | parcial | Ganhou `aria-label` (#84); sem `<label>` visível, sem `fieldset`/`legend` |
| 1204 | /academico/modalidades/[id]/quantidade | 1 | resolvido | Chave em `useRef` por assinatura dos dados (`AlterarQuantidadeAulas.tsx:17,20`, #85) |
| 1205 | /academico/modalidades/[id]/quantidade | 2 | resolvido | `useAcaoCliente` + `FeedbackAcao` (#85) |
| 1218 | …/quantidade/propostas/[propostaId] | 1 | aberto | `DecidirQuantidadeAulas.tsx:11`: "Aprovar e aplicar" sem conferência nem número de turmas |
| 1219 | …/quantidade/propostas/[propostaId] | 2 | parcial | Erro via `useAcaoCliente` (#87); o sucesso ainda faz `window.location.reload()` (`:10`) |
| 1230 | /academico/indisponibilidades | 1 | aberto | `SolicitarAusencia.tsx:38`: select de professor sem opção vazia |
| 1231 | /academico/indisponibilidades | 2 | aberto | `DecisaoAusencia.tsx:27`: desabilitado por `!impactoHash`, sem explicação |
| 1244 | /academico/reposicoes | 1 | aberto | `reposicoes/page.tsx:21`: sem `matriculaId` mostra só a frase; sem busca nem lista |
| 1256 | …/reposicoes/correcoes/[reposicaoId] | 1 | aberto | `CorrecoesConclusaoReposicao.tsx:140`: "Horário da validação (UTC)"; `isoUtc` acrescenta `:00Z` |

**Acadêmico — avaliações, correções e equivalências**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 1314 | /academico/avaliacoes/[alocacaoId]/[codigo] | 1 | aberto | `[codigo]/page.tsx:38`: `<form method="get">` do fuso; `key` com `fusoEntrada` (`:46`) |
| 1315 | /academico/avaliacoes/[alocacaoId]/[codigo] | 2 | aberto | `Formularios.tsx:34,53`: erro e sucesso no mesmo `setMensagem` / `MensagemStatus` sem cor |
| 1327 | …/[codigo]/designacao | 1 | aberto | `designacao/page.tsx:32,34`: busca por GET que remonta o formulário (`key` com `d.busca`) |
| 1365 | …/[alocacaoId]/fechamento | 1 | resolvido | Tons mapeados amber/green (`fechamento/page.tsx:63,85`, `ExcecaoFrequencia.tsx:112,118`, #67) |
| 1389 | /academico/correcoes/[lancamentoId] | 1 | aberto | `Formularios.tsx:20,31`: um `setMensagem` e um `MensagemStatus` sem cor; `key` com versão (`page.tsx:25`) |
| 1399 | …/correcoes/[lancamentoId]/[propostaId] | 1 | aberto | `[propostaId]/page.tsx:19`: "Solicitação {i.id}" |
| 1400 | …/correcoes/[lancamentoId]/[propostaId] | 2 | aberto | `Formularios.tsx:40`: mesmo `setMensagem`; `{d.podeDecidir && …}` (`page.tsx:21`) desmonta o formulário |
| 1411 | /academico/correcoes/revisoes/[casoId] | 1 | aberto | `ResolucaoRevisaoProgressao.tsx:164,183`: só a contagem de casos |
| 1437 | /academico/equivalencias/[propostaId] | 1 | aberto | `AcoesEquivalencia.tsx:66`: `horarioCompativel: true` fixo; checkbox sem `name` (`:103`) |
| 1438 | /academico/equivalencias/[propostaId] | 2 | aberto | `AcoesEquivalencia.tsx:45-70,106`: mesmo `setMensagem` / `MensagemStatus` |

**Acadêmico — recuperações**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 1540 | /academico/recuperacoes/planos/[propostaId] | 1 | parcial | `CampoFuso` com o fuso institucional e `datalist` (`Formularios.tsx:29`, #69); falta a conversão resultante pedida na recomendação |
| 1566 | …/planos/[propostaId]/prorrogacoes | 1 | parcial | Fuso institucional (#69); `Horario` (`Formularios.tsx:28`) sem `min` igual ao prazo vigente |
| 1590 | …/tentativas/[itemReservaId] | 1 | parcial | `fusoInstitucional` → `CampoFuso` (`page.tsx:31`, #69); falta mostrar a conversão ("equivale a … UTC"), pedida na recomendação |
| 1603 | …/tentativas/[itemReservaId]/agenda | 1 | resolvido | `CampoFuso` (#69) + `min` do fim preso ao início (`agenda/Formulario.tsx:28-30`, #78) |

**Acadêmico — segundas chamadas**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 1670 | …/segundas-chamadas/[alocacaoId]/[codigoAvaliacao] | 1 | aberto | `page.tsx:14`: `ativa && statusMatricula==="ATIVA"`; o formulário some sem motivo |
| 1671 | …/segundas-chamadas/[alocacaoId]/[codigoAvaliacao] | 2 | aberto | `SegundaChamadaPainel.tsx:62`: `window.location.reload()` |
| 1709 | /academico/segundas-chamadas/agendas | 1 | aberto | `agendas/page.tsx:25`: só `cursor`, sem busca nem filtro de data |
| 1722 | …/segundas-chamadas/pendentes-agenda | 1 | aberto | `pendentes-agenda/page.tsx:45`: "Preparar agenda inicial" sempre, qualquer que seja a situação |
| 1747 | …/segundas-chamadas/minhas/[reservaId] | 1 | parcial | `CampoFuso` institucional (#69, `Formulario.tsx:39`); sem fuso do encontro nem `min`/`max` |
| 1761 | …/propostas/[propostaId]/agenda | 1 | aberto | `agenda/Formulario.tsx:31`: `onChange` limpa a prévia a cada campo |
| 1785 | …/reservas/[reservaId]/cancelamento | 1 | aberto | O efeito (`page.tsx:20`) só aparece nas propostas (`:44`), não no formulário |
| 1786 | …/reservas/[reservaId]/cancelamento | 2 | parcial | `CampoFuso` (#69, `Formulario.tsx:36`); sem instante convertido |
| 1814 | …/reservas/[reservaId]/substituicao | 1 | aberto | `substituicao/page.tsx:48`: `key={substitutoId…}`; `router.replace` em `Formulario.tsx:49` |

**Diário de aulas**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 1835 | /diario | 1 | aberto | `DiarioAulas.tsx:84`: trocar a data chama `escolherTurma`, que zera `registros` (`:39`) |
| 1863 | /diario/encontros/[id] | 1 | aberto | `encontros/[id]/page.tsx:21`: `role` e cor ainda condicionados a `ocorrencias` |
| 1864 | /diario/encontros/[id] | 2 | aberto | `page.tsx:24`: só a frase, sem lista de vínculos nem ação |
| 1901 | /diario/encontros/[id]/correcao | 1 | resolvido | `bg-surface` (#66); rose, `*-800/900` removidos (#67) |
| 1947 | /diario/regularizacoes-gravacao | 1 | resolvido | `RegularizacoesGravacao.tsx:21-22`: `bg-surface` (#66) |
| 1989 | /diario/reposicoes/[id]/troca-fonte | 1 | aberto | `troca-fonte/page.tsx:15`: título genérico; `TrocaFonteReposicao.tsx:68` sem aluno nem matrícula |
| 1990 | /diario/reposicoes/[id]/troca-fonte | 2 | resolvido | `TrocaFonteReposicao.tsx:66,72,80`: `bg-surface` (#66) |

**Financeiro**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 2014 | /financeiro | 1 | aberto | `FilaCobranca.tsx:454`: "Cobrar"/"Lembrar" → `enviarViaApi` (`:135-139`), que enfileira sem confirmação |
| 2015 | /financeiro | 2 | resolvido | A linha virou `<button>`; o drawer tem `role="dialog"` + `useDialogo` (`FilaCobranca.tsx:~355,516-525`, #89) |
| 2016 | /financeiro | 3 | aberto | `FinanceiroPainel.tsx:201-202`: "Fechar mês e marcar pagas" chama `fecharMesComissoes()` direto |
| 2017 | /financeiro | 4 | aberto | `FinanceiroPainel.tsx:397-399`: `if (entradas.length === 0) return;` mudo |
| 2065 | /financeiro/acertos-cobertura/[matriculaId]/[propostaId] | 1 | parcial | Botão desabilitado sem lista de pendências (`ImpactosCoberturaFormulario.tsx:30,42`); só o mínimo do texto ficou visível (#121) |

**Comercial**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 2201 | /leads/[id] | 1 | resolvido | Cada handler aguarda `executar` e só fecha com sucesso (`FichaLead.tsx:436-500`, #87) |
| 2202 | /leads/[id] | 2 | parcial | Sai da edição só com sucesso (`:559`), mas a leitura exibe o rascunho `f[k]` (`:571`) depois de Cancelar |
| 2203 | /leads/[id] | 3 | aberto | `FichaLead.tsx:586-589`: `useState` inicializado uma vez; "Salvar datas" envia a `exp` antiga |
| 2217 | /leads/[id]/contratacao | 1 | aberto | `contratacao/page.tsx:29`: `key` com `c.pagina` e `o.paginaTurmas` |
| 2229 | /pipeline | 1 | resolvido | Modal com `FeedbackAcao` próprio; fecha só com ok (`KanbanBoard.tsx:326-423`, #87/#89) |
| 2269 | /empresas | 1 | resolvido | Coluna "Faturas a receber" (`EmpresasCliente.tsx:177`, #101) |
| 2281 | /empresas/[id] | 1 | aberto | `FichaEmpresa.tsx:172-186`: pagar e cancelar a um clique; inativar (`:208-228`) também |
| 2282 | /empresas/[id] | 2 | aberto | `fecharFaturaB2B` (`acoes.ts:99`) sem chamador |
| 2295 | /inbox | 1 | aberto | `InboxCliente.tsx:751-788`: arquivo e áudio enviados direto, legenda `""` |
| 2296 | /inbox | 2 | aberto | `InboxCliente.tsx:392` diz "use template", mas o composer não tem seletor de template |
| 2297 | /inbox | 3 | parcial | A promessa (`:538-540`) ignora o `ok` e anuncia "régua pausada"; o pagamento (`:600-602`) não promete pausa |
| 2298 | /inbox | 4 | aberto | `vincular` (`:967-970`) e opt-out (`:440-444`) diretos; não existe desvincular |
| 2299 | /inbox | 5 | parcial | Busca no servidor e aviso de lista limitada (#102); a thread corta em 300 mensagens (`:130`) |
| 2300 | /inbox | 6 | resolvido | Sem `bg-white`, `violet-*` nem `amber-300/500` (#66, #67) |

**Configuração**

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 2324 | /configuracao | 1 | parcial | `(app)/error.tsx` e `not-found.tsx` (#64); sem `loading.tsx` próprio para a troca de sub-aba |
| 2367 | /configuracao/contratos/novo | 1 | aberto | `ModeloFormulario.tsx:17`: só `useState`, sem autosave nem `beforeunload` |
| 2368 | /configuracao/contratos/novo | 2 | aberto | `ModeloFormulario.tsx:25-31`: bloqueio da tentativa não confirmada, sem "reenviar" nem "descartar" |
| 2395 | /configuracao/turmas | 1 | aberto | `TurmasPainel.tsx:66-69`: clique no fundo fecha sem confirmar descarte |
| 2412 | /configuracao/usuarios | 1 | aberto | `UsuarioFormulario.tsx:79,99`: senha sem `autoComplete` |
| 2428 | /configuracao/paises | 1 | parcial | "Encerrar" em variante perigo (#135), sem confirmação; `_count` fora das colunas |
| 2429 | /configuracao/paises | 2 | aberto | `PaisFormulario.tsx:105,109`: fuso e idioma em texto livre; `server/paises/schema.ts:23-24` `z.string().min(1)` |
| 2442 | /configuracao/operacao | 1 | parcial | `OperacaoFormulario` usa `FeedbackAcao` (#86); `PrazosPortalFormulario` e `PrazosEntregaReposicaoFormulario` não |
| 2457 | /configuracao/operacao/avisos-diario | 1 | aberto | `AvisosDiarioFormulario.tsx:23,36`: `setMensagem(ok ? sucesso : erro)` num só `MensagemStatus` |
| 2469 | /configuracao/migracao | 1 | resolvido | Leitura e preparo com `useAcaoCliente` + `FeedbackAcao` próprios (#86) |
| 2483 | /configuracao/migracao/[loteId] | 1 | aberto | `server/migracao/consultas.ts:44`: `linhas` sem `take`; `<pre>` com JSON por linha |
| 2484 | /configuracao/migracao/[loteId] | 2 | resolvido | Sem sky/emerald/`amber-300`/`bg-white` em `migracao/` (#67) |
| 2485 | /configuracao/migracao/[loteId] | 3 | aberto | `EnsaioVinculoMigracao.tsx:25,31` e `AplicarCadastroMigracao.tsx:17-18`: mesmo estado para erro e sucesso |
| 2499 | /configuracao/migracao/presenca/[linhaId] | 1 | aberto | `PresencaHistorica.tsx:16`: "Aprovar e aplicar" como primeira opção, sem confirmação |
| 2516 | /configuracao/whatsapp | 1 | aberto | `PoliticaPainel.tsx:90-118`: `alternarKill` direto, nos dois sentidos |
| 2517 | /configuracao/whatsapp | 2 | aberto | `PoliticaPainel.tsx:135`, `ComercialPainel.tsx:109,194`, `ReguaComercialPainel.tsx:166`: ATIVA sem confirmação; só o piloto tem `window.confirm` |
| 2518 | /configuracao/whatsapp | 3 | aberto | `TemplatesPainel.tsx:212-213`: aviso em `text-[11px] text-gray-400`; salvar não confirma |

**Público, portal do aluno, home e preferências** (caminhos relativos a `src/app/`)

| L | Rota | # | Status | Evidência atual |
|---|---|---|---|---|
| 2566 | /pagar/[token] | 1 | resolvido | `PagarCliente.tsx:50`: `formatarMoeda(valor, moeda)` (#93) |
| 2581 | /certificado/[codigo] | 1 | resolvido | `text-green-700`; `green.200` mapeado (#67) |
| 2593 | /portal (legado) | 1 | parcial | `server/.../sessao.ts:153` ainda faz `redirect("/portal")` → `/portal-aluno/entrar`, sem erro (#64), mas sem explicar o acesso próprio |
| 2602 | /portal-aluno | 1 | resolvido | `exigirSessaoPortalAlunoPagina` redireciona; `portal-aluno/error.tsx` (#64) |
| 2603 | /portal-aluno | 2 | resolvido | `bg-surface` (`portal-aluno/page.tsx:20`, #66) |
| 2616 | /portal-aluno/entrar | 1 | resolvido | `bg-surface`, sem `shadow-sm` (#66) |
| 2626 | /portal-aluno/ativar | 1 | aberto | `ativar/page.tsx:8-14`: token só em `useRef`; o formulário aparece sem token |
| 2627 | /portal-aluno/ativar | 2 | aberto | `ativar/page.tsx:28`: um campo de senha, sem "mínimo 12", sem confirmação |
| 2628 | /portal-aluno/ativar | 3 | resolvido | `bg-surface`, sem sombra (#66) |
| 2639 | /portal-aluno/recuperar | 1 | aberto | `recuperar/page.tsx:11-12`: `try` sem `catch`; `finally` faz `setEnviado(true)` sempre |
| 2640 | /portal-aluno/recuperar | 2 | resolvido | `bg-surface` (#66) |
| 2651 | /portal-aluno/preferencias | 1 | resolvido | `bg-surface` (#66) |
| 2664 | /portal-aluno/resultados | 1 | resolvido | Tons mapeados green/amber (#67); `bg-white` removido |
| 2676 | /portal-aluno/reposicoes/[id] | 1 | aberto | `page.tsx:74`: `podeRelatar={podeReproduzir}`; o formulário some sem motivo |
| 2677 | /portal-aluno/reposicoes/[id] | 2 | resolvido | `bg-surface` e `border-amber-200` (#66, #67) |
| 2691 | /home | 1 | resolvido | `Sidebar` `hidden md:flex` + `BarraMobile`; `main` com `p-4 md:p-8` (#94) |
| 2692 | /home | 2 | resolvido | `HomeProfessor.tsx:107,114`: `disabled={acao.ocupado}` (#87) |
| 2693 | /home | 3 | aberto | `HomeProfessor.tsx:112-118`: "Faltou" chama `checkin` direto |
| 2707 | /preferencias | 1 | resolvido | `FusoExibicaoFormulario.tsx:24`: `bg-surface` (#66) |

## 5. Achados Média e Baixa — amostra

**Amostra.** Foram sorteados 6 achados Média e 3 Baixa por área (`node scripts/medicao-ux/amostra.mjs 6 3 42`): 126 de 727, ou 17%. Cada um foi conferido no código como na seção 4. A amostra é estratificada por área × severidade, com alocação igual. Com 6 e 3 por estrato, a proporção **por área** é indicativa, não estimativa. O agregado dos 727 sai ponderado pela população de cada estrato (método na seção 2).

| Área | Média (amostra de 6) R / P / A | Baixa (amostra de 3) R / P / A | População Média / Baixa |
|---|---|---|---|
| Alunos e turmas | 2 / 0 / 4 | 1 / 1 / 1 | 26 / 14 |
| Secretaria | 0 / 1 / 5 | 0 / 0 / 3 | 22 / 9 |
| Matrículas — entrada | 0 / 2 / 4 | 1 / 0 / 2 | 34 / 9 |
| Matrículas — contrato | 0 / 1 / 5 | 1 / 0 / 2 | 30 / 16 |
| Matrículas — ciclo | 1 / 2 / 3 | 0 / 0 / 3 | 62 / 12 |
| Acadêmico — base | 0 / 0 / 6 | 0 / 0 / 3 | 56 / 5 |
| Acadêmico — avaliações | 1 / 0 / 5 | 1 / 0 / 2 | 33 / 16 |
| Acadêmico — recuperações | 0 / 1 / 5 | 0 / 1 / 2 | 44 / 19 |
| Acadêmico — segundas chamadas | 1 / 0 / 5 | 1 / 0 / 2 | 33 / 19 |
| Diário de aulas | 1 / 1 / 4 | 0 / 0 / 3 | 44 / 14 |
| Financeiro | 2 / 0 / 4 | 0 / 2 / 1 | 32 / 24 |
| Comercial | 2 / 2 / 2 | 1 / 0 / 2 | 28 / 11 |
| Configuração | 0 / 2 / 4 | 0 / 1 / 2 | 36 / 30 |
| Público e portal | 1 / 0 / 5 | 0 / 1 / 2 | 35 / 14 |
| **Total** | **11 / 12 / 61** (84) | **6 / 6 / 30** (42) | **515 / 212** |

R = resolvido, P = parcial, A = aberto.

**Agregado.** Na amostra crua: 17 resolvidos, 18 parciais e 91 abertos. **Estimativa estratificada para os 727** (ponderada pela população do estrato, IC 95%):

| Status | Estimativa | IC 95% | ≈ achados |
|---|---|---|---|
| Resolvido | 12,6% | 7,1–18,1% | 92 |
| Parcial | 16,3% | 9,6–22,9% | 118 |
| Aberto | 71,1% | 63,1–79,2% | 517 |

A estimativa de amostra aleatória simples, sem peso, dava 72% (Wald 64–80%). Ela não é a certa, porque as áreas têm populações diferentes.

Leitura: entre Média e Baixa, a proporção de abertos é ainda maior que entre os Alta. Os resolvidos da amostra são, outra vez, transversais: rótulo de enum (#138), moeda (#93), tons (#67), `CampoTexto` (#121), `min` cruzado (#78), contador e paginação de `/alunos` e `/empresas` (#92, #98, #136) e hub de `/matriculas/[id]` (#90). Os abertos se repetem nos padrões da seção 4: erro e sucesso no mesmo `MensagemStatus`, paginação só para frente, ação de um clique e `<p role="alert">` solto em vez de cabeçalho com volta. Esse último padrão aparece em mais de 30 páginas de `/matriculas/[id]`.

### 5.1 Veredito por achado da amostra

Linhas sorteadas por `node scripts/medicao-ux/amostra.mjs 6 3 42`, na ordem do doc 42. Os caminhos são relativos a `src/app/(app)/`, salvo quando indicado.

| L | Área | Rota | # | Sev | Status | Evidência atual |
|---|---|---|---|---|---|---|
| 229 | Alunos e turmas | /alunos | 6 | Média | resolvido | `AlunosLista.tsx:141-143`: "N–M de T alunos (de X no total)" com paginação (#92) |
| 242 | Alunos e turmas | /alunos/[id] | 3 | Média | aberto | `Drawer.tsx:38,46`: Esc e fundo fecham sem guarda; `FichaAluno.tsx:228` descarta a edição sem confirmar |
| 257 | Alunos e turmas | /alunos/[id]/academico | 3 | Média | aberto | `academico/page.tsx:22,44` não avisa quando falta `matriculaId`; `MudancasAcademicasPainel.tsx:70` mostra só "Turma atual" |
| 268 | Alunos e turmas | /alunos/[id]/agenda-aditivo | 1 | Média | aberto | `agenda-aditivo/page.tsx:12`: `<h1>` genérico; o nome do aluno só no título da aba (#106) |
| 270 | Alunos e turmas | /alunos/[id]/agenda-aditivo | 3 | Baixa | aberto | `agenda-aditivo/page.tsx:12`: `h1 text-2xl` sem `font-medium` na classe; link `underline` sem cor de marca |
| 283 | Alunos e turmas | /alunos/[id]/creditos/[creditoId] | 5 | Baixa | parcial | Valores com `formatarMoeda` (#93); UUIDs de cobrança, aplicação e decisão continuam crus (`creditos/[creditoId]/page.tsx:19-20`) |
| 312 | Alunos e turmas | /alunos/[id]/movimentacoes | 5 | Média | aberto | `NovaPausa.tsx:68`: só `disabled={ocupado}`, sem aviso de pendências (`:66`) |
| 326 | Alunos e turmas | /alunos/[id]/portal | 4 | Média | resolvido | `portal/painel.tsx:53`: `rotular(SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL, …)` (#138) |
| 327 | Alunos e turmas | /alunos/[id]/portal | 5 | Baixa | resolvido | Botões com `botaoClasses` (`painel.tsx:51-53`, #114/#135) |
| 377 | Secretaria | /secretaria/reservas | 1 | Média | aberto | Resultado só em estado local (`ConferirReserva.tsx:17-19`); o componente desmonta quando `podeConferir` vira falso (`reservas/page.tsx:31`) |
| 378 | Secretaria | /secretaria/reservas | 2 | Média | aberto | `reservas/page.tsx:28`: " · Prazo vencido" concatenado, sem destaque |
| 381 | Secretaria | /secretaria/reservas | 5 | Baixa | aberto | `reservas/page.tsx:14`: erro com `VoltarPara` e alerta, sem `<h1>` nem "Tente novamente" |
| 394 | Secretaria | /secretaria/reservas/[id] | 3 | Baixa | aberto | `reservas/[id]/Formularios.tsx:23`: date/time sem `min`/`defaultValue` |
| 408 | Secretaria | /secretaria/reservas/particulares/[id] | 3 | Baixa | aberto | `particulares/[id]/page.tsx:16`: `<h1>` sem aluno nem matrícula |
| 419 | Secretaria | /secretaria/desistencias | 2 | Média | aberto | `desistencias/page.tsx:29-30`: cursor só avança; para trás só "Voltar ao início" |
| 420 | Secretaria | /secretaria/desistencias | 3 | Média | aberto | `desistencias/page.tsx:24-27`: quatro frases longas sem marcador curto |
| 434 | Secretaria | /secretaria/envios-portal | 4 | Média | parcial | Botões com `botaoClasses` (#117); campos `className="block w-full border"` (`ConciliacaoEnvio.tsx:20`) |
| 445 | Secretaria | /secretaria/avisos-agenda | 1 | Média | aberto | `avisos-agenda/page.tsx:24`: sem link nem referência ao encontro; só rótulos mudaram (#138) |
| 504 | Matrículas — entrada | /matriculas/[id]/reserva | 7 | Baixa | resolvido | Motivo em `CampoTexto minLength={5}` com mínimo visível (`ReservarFormulario.tsx:17`, #121) |
| 515 | Matrículas — entrada | /matriculas/[id]/nova-reserva | 2 | Média | aberto | `invalidar()` apaga a revisão sem mensagem (`nova-reserva/Formulario.tsx:19`, `:37-41`) |
| 534 | Matrículas — entrada | /matriculas/[id]/preparacao | 5 | Média | aberto | `DecidirPreco.tsx:23` desabilita sem motivo; `CampoTexto` (`:22`) sem `minLength` |
| 536 | Matrículas — entrada | /matriculas/[id]/preparacao | 7 | Média | aberto | Link "Pedido de desistência" no topo como link comum (`preparacao/page.tsx:21`) |
| 549 | Matrículas — entrada | /matriculas/[id]/emissao | 3 | Média | parcial | Vencimentos com `formatarDataCivil` (#111); `c.criadaEm.toISOString()` cru em `emissao/page.tsx:18` |
| 551 | Matrículas — entrada | /matriculas/[id]/emissao | 5 | Média | aberto | Plano em `<ul>` com campos concatenados por "·" (`emissao/page.tsx:27`) |
| 567 | Matrículas — entrada | /matriculas/[id]/pagador | 6 | Baixa | aberto | `PagadorFormulario.tsx:30`: `pattern` do telefone sem `title` nem texto de ajuda |
| 582 | Matrículas — entrada | /matriculas/[id]/entrada-particular | 6 | Média | parcial | Vencimento formatado (#111); `d.codigo ?? d.matriculaId` mostra UUID (`entrada-particular/page.tsx:18`) |
| 583 | Matrículas — entrada | /matriculas/[id]/entrada-particular | 7 | Baixa | aberto | Cada pendência com `role="alert"` (`:24`); resumo (`:19`) sem `role` |
| 603 | Matrículas — contrato | /matriculas/[id]/contrato | 2 | Média | aberto | `contrato/page.tsx:30-36` sem a etapa do contrato; o layout (#90) mostra só o status da matrícula |
| 608 | Matrículas — contrato | /matriculas/[id]/contrato | 7 | Baixa | resolvido | Hub `/matriculas/[id]` e cabeçalho com abas (`layout.tsx:30-41`, #90); `VoltarPara` (#110) |
| 630 | Matrículas — contrato | /matriculas/[id]/contrato/previas/[previaId]/participantes | 2 | Média | aberto | Só `issues[0]?.message` (`participantes/Formulario.tsx:30`), depois do fieldset (`:55`), sem foco |
| 645 | Matrículas — contrato | /matriculas/[id]/contrato/originais/[artefatoId] | 4 | Baixa | aberto | `originais/[artefatoId]/page.tsx:49-50`: sem `download` nem formato indicado |
| 654 | Matrículas — contrato | /matriculas/[id]/contrato/substituicoes | 1 | Média | aberto | `substituicoes/page.tsx:30`: frase única, sem estado da fonte nem link para o original |
| 682 | Matrículas — contrato | /matriculas/[id]/contrato/aditivos | 5 | Média | aberto | Nenhum link para `aditivos/agenda` em `aditivos/page.tsx` nem em `Formularios.tsx` |
| 693 | Matrículas — contrato | /matriculas/[id]/contrato/aditivos/[propostaId] | 3 | Média | aberto | Sem `AndamentoAditivo`; seções em sequência plana (`[propostaId]/page.tsx:32-46`) |
| 705 | Matrículas — contrato | /matriculas/[id]/contrato/aditivos/[propostaId]/alcadas | 3 | Baixa | aberto | Sucesso e erro na mesma `<p role="alert">` (`alcadas/Formulario.tsx:18,27`) |
| 718 | Matrículas — contrato | /matriculas/[id]/contrato/aditivos/[propostaId]/originais/[artefatoId] | 4 | Média | parcial | Estado com rótulo e ambiente teste/produção (#138, `:68-69`); `fornecedor` cru |
| 762 | Matrículas — ciclo | /matriculas/[id]/desistencia | 1 | Média | parcial | Layout (#90) e Trilha (#99) dão saída; `desistencia/page.tsx:23` ainda devolve `<p role="alert">` solto, sem `<h1>` nem "tentar de novo" |
| 776 | Matrículas — ciclo | /matriculas/[id]/desistencia/administracao | 1 | Média | aberto | `DecisaoFormulario.tsx:19-20,31`: sucesso e erro no mesmo `MensagemStatus`, sem `role="alert"` |
| 778 | Matrículas — ciclo | /matriculas/[id]/desistencia/administracao | 3 | Baixa | aberto | `administracao/page.tsx:64`: h3 só com versão e registrador; `criadoEm` não é selecionado |
| 829 | Matrículas — ciclo | /matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula | 3 | Média | parcial | Rótulo e `formatarMoeda` (#93, `RevisoesCorrecaoAula.tsx:69`); parágrafos com IDs crus |
| 857 | Matrículas — ciclo | /matriculas/[id]/compensacoes/[cobrancaId]/periodo-integral | 5 | Média | resolvido | `PeriodoIntegral.tsx:142`: `min={periodo.min}` no fim (#78) |
| 869 | Matrículas — ciclo | /matriculas/[id]/condicoes | 4 | Baixa | aberto | `CondicoesFormulario.tsx:27`: dia de vencimento 1-31 sem explicar 29-31 |
| 879 | Matrículas — ciclo | /matriculas/[id]/condicoes-horas | 2 | Média | aberto | `CondicoesHoras.tsx:17,42-49`: campos começam vazios, sem copiar a versão anterior |
| 924 | Matrículas — ciclo | /matriculas/[id]/autorizacoes-comunicacao | 5 | Baixa | aberto | `autorizacoes-comunicacao/page.tsx:20`: só "Início" e "Próxima página" |
| 937 | Matrículas — ciclo | /matriculas/[id]/indisponibilidade-oferta | 4 | Média | aberto | `RelatosIndisponibilidadeOferta.tsx:37`: sem bloco explicativo quando `podeRegistrar` é falso |
| 1037 | Acadêmico — base | /academico/admissoes/excecoes/[reservaId] | 3 | Média | aberto | `admissoes/excecoes/[reservaId]/page.tsx:15-16,29`: instantes em ISO cru / `toISOString()` |
| 1047 | Acadêmico — base | /academico/calendario | 1 | Média | aberto | `calendario/page.tsx:29`: só "Versões anteriores", sem "Anterior" nem volta à primeira |
| 1084 | Acadêmico — base | /academico/calendario/[id]/replanejamento | 4 | Média | aberto | `EditorRevisao.tsx:41-45`: não mostra data/hora atual; campos começam vazios |
| 1157 | Acadêmico — base | /academico/regras/[nivelId] | 2 | Média | aberto | `regras/[nivelId]/Formularios.tsx:23`: `replace(",", ".")` troca só a primeira vírgula; sem `pattern` |
| 1170 | Acadêmico — base | /academico/regras/turmas/[turmaId] | 1 | Média | aberto | `regras/turmas/[turmaId]/page.tsx:21-24`: alterações só em prosa, sem antes/depois |
| 1207 | Acadêmico — base | /academico/modalidades/[id]/quantidade | 4 | Média | aberto | `AlterarQuantidadeAulas.tsx:21`: impactos em `<li>` concatenado, sem tabela nem contador |
| 1209 | Acadêmico — base | /academico/modalidades/[id]/quantidade | 6 | Baixa | aberto | `AlterarQuantidadeAulas.tsx:20`: sucesso faz `window.location.assign(...)` |
| 1258 | Acadêmico — base | /academico/reposicoes/correcoes/[reposicaoId] | 3 | Baixa | aberto | `CorrecoesConclusaoReposicao.tsx:139`: "Retirar a conclusão" como primeira opção, sem alerta |
| 1259 | Acadêmico — base | /academico/reposicoes/correcoes/[reposicaoId] | 4 | Baixa | aberto | `correcoes/[reposicaoId]/page.tsx:44-46`: "seguinte" antes de "anterior"; sem "Versão N de M" |
| 1300 | Acadêmico — avaliações | /academico/avaliacoes/[alocacaoId] | 2 | Média | aberto | `[alocacaoId]/page.tsx:57,62`: `<li>` com rótulo e contagem, sem link para resolver |
| 1316 | Acadêmico — avaliações | /academico/avaliacoes/[alocacaoId]/[codigo] | 3 | Média | aberto | `[codigo]/Formularios.tsx:34`: texto fixo de sucesso ignora `modo` |
| 1328 | Acadêmico — avaliações | /academico/avaliacoes/[alocacaoId]/[codigo]/designacao | 2 | Média | aberto | `designacao/Formulario.tsx:22-23,37`: erro e sucesso no mesmo `MensagemStatus` |
| 1342 | Acadêmico — avaliações | /academico/avaliacoes/[alocacaoId]/equivalencia | 5 | Baixa | resolvido | `(app)/not-found.tsx` (#64) mantém o 404 no shell; mensagem genérica |
| 1353 | Acadêmico — avaliações | /academico/avaliacoes/[alocacaoId]/extras | 2 | Média | resolvido | `extras/page.tsx:25` e `Formularios.tsx:24`: `rotular(HABILIDADE_LABEL, …)` (#138) |
| 1354 | Acadêmico — avaliações | /academico/avaliacoes/[alocacaoId]/extras | 3 | Média | aberto | `planos/[propostaId]/Formularios.tsx:22`: `else router.refresh()`, sem sucesso nem `reset()` |
| 1368 | Acadêmico — avaliações | /academico/avaliacoes/[alocacaoId]/fechamento | 4 | Baixa | aberto | `ExcecaoFrequencia.tsx:21-26,140-157`: sem percentual nem mínimo na decisão |
| 1428 | Acadêmico — avaliações | /academico/equivalencias | 5 | Média | aberto | `equivalencias/page.tsx:17`: `VoltarPara`, mas sem seleção de matrícula; rota fora do `nav.ts` |
| 1441 | Acadêmico — avaliações | /academico/equivalencias/[propostaId] | 5 | Baixa | aberto | `[propostaId]/page.tsx:94`: "Conferir regra preservada" / "Fonte preservada a conferir" |
| 1469 | Acadêmico — recuperações | /academico/recuperacoes | 3 | Baixa | parcial | "Ir para a primeira página" só com página vazia (#134); com itens, só "Próximas" (`recuperacoes/page.tsx:27-29`) |
| 1494 | Acadêmico — recuperações | /academico/recuperacoes/correcoes/[notaId] | 5 | Baixa | aberto | `correcoes/[notaId]/Formularios.tsx:36`: "plano(s) aprovado(s) … vinculado(s)" |
| 1506 | Acadêmico — recuperações | /academico/recuperacoes/designadas | 4 | Média | aberto | `AgendaPublicada.tsx:25-31`: fuso e "Atualizar situação" em cada item; sem modo compacto |
| 1529 | Acadêmico — recuperações | /academico/recuperacoes/planos/autorizacoes-preparacao | 1 | Média | aberto | `autorizacoes-preparacao/page.tsx:13,18`: `alocacaoId = ""`; erro como `<p role="alert">` solto |
| 1556 | Acadêmico — recuperações | /academico/recuperacoes/planos/[propostaId]/autorizacao-reserva | 3 | Média | parcial | `STATUS_MATRICULA_LABEL` (#138, `autorizacao-reserva/page.tsx:32`); "nas condições atuais" sem motivo (`:34,40`) |
| 1605 | Acadêmico — recuperações | /academico/recuperacoes/tentativas/[itemReservaId]/agenda | 3 | Média | aberto | `tentativas/[itemReservaId]/agenda/page.tsx:28`: sem `PreviaAgenda`; conflitos só após guardar |
| 1616 | Acadêmico — recuperações | /academico/recuperacoes/tentativas/[itemReservaId]/autorizacao | 1 | Média | aberto | `autorizacao/page.tsx:36-40`: histórico sem marcar vigente/expirada |
| 1617 | Acadêmico — recuperações | /academico/recuperacoes/tentativas/[itemReservaId]/autorizacao | 2 | Média | aberto | `autorizacao/page.tsx:29`: `VoltarPara` com rótulo e destino divergentes (#110 só trocou o componente) |
| 1645 | Acadêmico — recuperações | /academico/recuperacoes/tentativas/[itemReservaId]/designacao/propostas | 4 | Baixa | aberto | `designacao/propostas/page.tsx:26`, `PreviaSubstituicao.tsx:28`: `text-xl` sem `font-medium` na classe |
| 1687 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/autorizacoes | 3 | Média | aberto | `autorizacoes/Formulario.tsx:19`: `if (resultado.ok) router.refresh()`, sem mensagem nem reset |
| 1698 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/historico | 2 | Baixa | resolvido | Mapa único `STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL` (`lib/labels.ts:251`, #138) |
| 1723 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/pendentes-agenda | 2 | Média | aberto | `pendentes-agenda/page.tsx:44`: prazo em texto corrido, sem badge nem ordenação |
| 1748 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/minhas/[reservaId] | 2 | Média | aberto | `minhas/[reservaId]/Formulario.tsx:80`: nota com `inputMode="decimal"`, sem min/max nem validação |
| 1765 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/propostas/[propostaId]/agenda | 5 | Baixa | aberto | `propostas/[propostaId]/agenda/page.tsx:45`: mesma frase sobre proposta histórica |
| 1788 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/reservas/[reservaId]/cancelamento | 4 | Média | resolvido | `cancelamento/page.tsx:18`: `rotular(STATUS_ENCONTRO_LABEL…)` e `STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL` (#138) |
| 1800 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/reservas/[reservaId]/remarcacao | 2 | Média | aberto | `remarcacao/Formulario.tsx:51`: `<input name="fusoOrigem">` vazio, sem `CampoFuso` |
| 1803 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/reservas/[reservaId]/remarcacao | 5 | Média | aberto | `remarcacao/Formulario.tsx:53`: rótulo "…se o horário a atingir" sem alteração |
| 1804 | Acadêmico — segundas chamadas | /academico/segundas-chamadas/reservas/[reservaId]/remarcacao | 6 | Baixa | aberto | `remarcacao/page.tsx:43`: `<p role="alert">` solto, sem volta nem identificação |
| 1836 | Diário de aulas | /diario | 2 | Média | aberto | `DiarioAulas.tsx:98`: Cancelar fecha sem confirmação |
| 1839 | Diário de aulas | /diario | 5 | Média | aberto | `diario/page.tsx:17-23`: links soltos em `space-y-6`, sem `<nav>` |
| 1854 | Diário de aulas | /diario/encontros | 4 | Baixa | aberto | `diario/encontros/page.tsx:29`: ainda "Próximos encontros" |
| 1890 | Diário de aulas | /diario/encontros/[id]/remarcacao | 2 | Média | aberto | `RemarcacaoParticular.tsx:30`: "Conferir e submeter"; a conferência só aparece depois (`:36`) |
| 1913 | Diário de aulas | /diario/encontros/[id]/gravacao | 1 | Média | parcial | `VoltarPara href="/diario"` (#110, `gravacao/page.tsx:9`); mensagem (`:13`) sem próximo passo |
| 1925 | Diário de aulas | /diario/pendencias | 2 | Média | resolvido | `pendencias/page.tsx:27`: `border-amber-200 … text-amber-700` (#67) |
| 1952 | Diário de aulas | /diario/regularizacoes-gravacao | 6 | Média | aberto | `RegularizacoesGravacao.tsx:22`: `MensagemStatus` e alerta no fim da seção, após a lista |
| 1966 | Diário de aulas | /diario/excecoes-gravacao | 5 | Baixa | aberto | `excecoes-gravacao/page.tsx:22`: `<h2>{professor} · {data}</h2>` sem turma nem resumo |
| 1980 | Diário de aulas | /diario/reposicoes | 6 | Baixa | aberto | `ReposicaoDocente.tsx:26,34`: `<h1 className="text-xl">` dentro dos cartões |
| 2018 | Financeiro | /financeiro | 5 | Média | aberto | `FilaCobranca.tsx:221-225,324`: `enviarLote` chama `aprovarLoteCobranca` direto, sem revisão |
| 2021 | Financeiro | /financeiro | 8 | Média | resolvido | Sem `text-red-800`, `text-blue-800`, `bg-green-500`, `bg-amber-500`, `border-red-300/400` em `FilaCobranca.tsx` (#67) |
| 2031 | Financeiro | /financeiro/acertos-taxa | 2 | Baixa | parcial | Sem `loading.tsx`/`error.tsx` no segmento; só os genéricos de `(app)` (#64) |
| 2041 | Financeiro | /financeiro/acertos-taxa/[matriculaId]/[propostaId] | 1 | Média | aberto | `DecisaoTaxa.tsx:26-27,38`, `ImpactosTaxaOperacao.tsx:28-29,42`: erro e sucesso no mesmo `MensagemStatus` |
| 2079 | Financeiro | /financeiro/acertos-vencimento/[matriculaId]/[propostaId] | 1 | Média | aberto | `acertos-vencimento/.../page.tsx:24,27`: `<p>` solto sem h1 nem volta; Trilha não mapeia o segmento |
| 2082 | Financeiro | /financeiro/acertos-vencimento/[matriculaId]/[propostaId] | 4 | Baixa | parcial | Estado com rótulo (#138); título ainda `Proposta {p.id}` (`page.tsx:42`) |
| 2130 | Financeiro | /financeiro/migracao/[linhaId] | 2 | Média | aberto | `EntradaFinanceiraHistorica.tsx:33`: select começa em "Aprovar e aplicar", sem opção vazia |
| 2133 | Financeiro | /financeiro/migracao/[linhaId] | 5 | Baixa | aberto | `ConferenciaFinanceiraMigracao.tsx:116`: `CampoTexto` (#121) sem `className` |
| 2145 | Financeiro | /financeiro/permuta | 4 | Média | resolvido | `PermutaOperacional.tsx:134-155`: saldo, limite e valor com `formatarMoeda` (#93) |
| 2187 | Comercial | /leads | 1 | Média | parcial | Busca, contagem e vazio duplo (#95, `LeadsLista.tsx:115-194`); sem ordenação por coluna (`:177-182`) |
| 2190 | Comercial | /leads | 4 | Média | parcial | `(app)/error.tsx`, `(app)/loading.tsx` e `leads/(lista)/loading.tsx` (#64/#81); `leads/[id]` sem `loading.tsx` próprio |
| 2206 | Comercial | /leads/[id] | 6 | Média | aberto | `FichaLead.tsx:384-398`: `<select>` executa `moverEtapa` no `onChange` |
| 2207 | Comercial | /leads/[id] | 7 | Média | resolvido | `blue-200` mapeado (`tailwind.config.ts:52`, #67); título `text-blue-700` (`FichaLead.tsx:756`) |
| 2219 | Comercial | /leads/[id]/contratacao | 3 | Baixa | aberto | `contratacao/page.tsx:22`: oferta selecionada sem destaque nem `aria-current` |
| 2244 | Comercial | /carteiras | 1 | Média | aberto | `CoberturasPainel.tsx:36`: `revogar(c.id)` em um clique (variante perigo, #117) |
| 2271 | Comercial | /empresas | 3 | Média | resolvido | Busca, situação e país na URL, `take` no servidor e ordenação (#98, #136, `empresas/consultas.ts:39-41`) |
| 2272 | Comercial | /empresas | 4 | Baixa | aberto | `EmpresasCliente.tsx:89`: toggle com rótulo fixo e sem `aria-expanded` |
| 2303 | Comercial | /inbox | 9 | Baixa | resolvido | `AtendimentosPainel.tsx:127`: `FeedbackAcao` com erro e sucesso separados (#87) |
| 2326 | Configuração | /configuracao | 3 | Baixa | parcial | Trilha no shell (#99) e `VoltarPara` em três filhas (#110); `contratos/[codigo]/page.tsx:23` mantém link ad hoc |
| 2354 | Configuração | /configuracao/contratos | 1 | Média | aberto | `server/contratos/modelos.ts:50-52`: `groupBy` sem `decisao`; `contratos/page.tsx:13` só última versão |
| 2430 | Configuração | /configuracao/paises | 3 | Média | parcial | Checkbox desabilitado durante a ação (#86, `PaisesPainel.tsx:202`); sem estado otimista (`:200`) |
| 2431 | Configuração | /configuracao/paises | 4 | Média | aberto | `PaisesPainel.tsx:38,171-180`: "Ativar" sem mostrar pré-requisitos |
| 2432 | Configuração | /configuracao/paises | 5 | Baixa | aberto | `PaisFormulario.tsx:14,145`: slugs crus de `VALIDADORES` |
| 2458 | Configuração | /configuracao/operacao/avisos-diario | 2 | Baixa | aberto | `avisos-diario/page.tsx:12`: `<h1 className="text-2xl">` abaixo do `<h1>` do layout |
| 2486 | Configuração | /configuracao/migracao/[loteId] | 4 | Média | aberto | `migracao/[loteId]/page.tsx:24`: lista única, sem contadores, filtros nem ordenação |
| 2501 | Configuração | /configuracao/migracao/presenca/[linhaId] | 3 | Média | aberto | `PresencaHistorica.tsx:15`: select abre em "Presente", sem opção vazia |
| 2519 | Configuração | /configuracao/whatsapp | 4 | Média | parcial | Uma rota por seção (#100); sem indicador de alteração pendente nem `beforeunload` |
| 2553 | Público e portal | /login | 2 | Média | aberto | `login/page.tsx:33`: `router.push("/home")` fixo; `redirect("/login")` sem `callbackUrl` |
| 2567 | Público e portal | /pagar/[token] | 2 | Média | aberto | `PagarCliente.tsx:24`: `status === "PAGO" ? "pago" : "aberto"`; `gateway.ts:55-69` sem filtrar status |
| 2572 | Público e portal | /pagar/[token] | 7 | Baixa | aberto | `pagar/[token]/page.tsx` sem `metadata`/`robots` |
| 2584 | Público e portal | /certificado/[codigo] | 4 | Baixa | aberto | `certificado/[codigo]/page.tsx:19`: emoji em "Certificado autêntico ✅" |
| 2606 | Público e portal | /portal-aluno | 5 | Média | aberto | `portal-aluno/sair.tsx:8`: `fetch` sem checar `ok` nem `catch` |
| 2652 | Público e portal | /portal-aluno/preferencias | 2 | Média | aberto | `preferencias-formulario.tsx:22-23`: input + `datalist`; "fuso IANA válido" (`:18`) |
| 2682 | Público e portal | /portal-aluno/reposicoes/[id] | 7 | Média | resolvido | `STATUS_MATRICULA_LABEL` (#138, `reposicoes/[id]/page.tsx:58`) e `SITUACAO_RELATO…_LABEL` (#93); falta a frase de consequência |
| 2709 | Público e portal | /preferencias | 3 | Média | aberto | `FusoExibicaoFormulario.tsx:25-26`: input + `datalist`; "fuso IANA válido" (`:21`) |
| 2712 | Público e portal | /preferencias | 6 | Baixa | parcial | Confirmação via `FeedbackAcao` (#87); botão ainda `variante: "secundario"` (`:28`) |


## 6. O que ainda falta (priorizado)

> Em 13/10/2026 os itens 1–7 desta lista já foram entregues (#153–#161); ver §7.5.

**Fora desta lista:**
- **Travas de teste** com brechas conhecidas já estão nos issues: #139 (vazio paginado), #140 (botões), #141 (`aria-sort` e ordenação com acento) e #142 (enum cru).
- **Em andamento** em PRs paralelas, sem proposta nova aqui (os números deste documento são de `6b105093`, antes delas):
  - #145 (E1/E7): `Campo` único com `aria-invalid`. Cobre a métrica de `aria-invalid` da 7.4 e os achados 471/472;
  - #144 (E4): filtro da fila de cobrança na URL e busca em `/comissoes`;
  - #143 (E2/E6): layouts de `/academico` e `/diario`. Os 6 `grid-cols-2` restantes são KPIs permitidos e não mudam.

Ordem por (achados Alta destravados × risco) ÷ esforço:

1. **`ConfirmarAcao` e confirmação nas ações irreversíveis.** 22 Alta abertos e 12 de 12 ações da métrica 7.6. O componente proposto no E1 nunca foi criado; o único `confirm` do app é `ReguaComercialPainel.tsx:127`. Começar pelo que tem efeito externo ou financeiro:
   - cobrar por WhatsApp na fila (`FilaCobranca.tsx:454` e `:589`, que nem estado de ocupado têm);
   - fechar mês de comissões (`FinanceiroPainel.tsx:201`);
   - aplicar acerto e reconferência delta (`AcertoContratualFormularios.tsx:41`, `ReconferenciaDeltaFormularios.tsx:87`);
   - emitir cobrança de fechamento (`EmitirFechamento.tsx:16`);
   - kill switch, régua e template do WhatsApp;
   - encerrar país;
   - "Faltou" no check-in (`HomeProfessor.tsx:113`);
   - pagar e cancelar fatura B2B;
   - vincular contato e opt-out na inbox;
   - aprovar replanejamento, quantidade de aulas e presença histórica;
   - desativar usuário, preço e idioma.
2. **Erro e sucesso separados nos formulários que ficaram fora da E3.** Cerca de 12 componentes ainda fazem `setMensagem(ok ? sucesso : erro)` num `MensagemStatus` (`role="status"`, sem cor): em `academico/avaliacoes`, `correcoes` e `equivalencias`; em `configuracao/operacao` (`Prazos*`, `AvisosDiario`) e `migracao` (`EnsaioVinculo`, `AplicarCadastro`); em `financeiro/acertos-taxa`; e em `matriculas/[id]/desistencia/administracao`. Migrar para `useAcaoCliente` + `FeedbackAcao` fecha 8 Alta e baixa os 41 fluxos "só refresh" (24%) rumo à meta de menos de 10%. Corrigir junto o `catch` que falta em `ConferenciaRegraHistorica.tsx:14` e trocar `window.location.reload()` (`SegundaChamadaPainel.tsx:62`, `DecidirQuantidadeAulas.tsx:10`) por mensagem mais `router.refresh()`.
3. **Não perder o que foi digitado.** 15 Alta. Tirar versão, página e filtro do `key` dos formulários (`[codigo]/page.tsx:46`, `designacao`, `participantes`, `contratacao`, `substituicao`, `correcoes`). Trocar o `<form method="get">` aninhado por controle client-side. Preservar os campos por tipo no `PagadorFormulario`. Ressincronizar o estado da `FichaLead` depois do refresh. Proteger com `beforeunload` (hoje há 0) `contratos/novo`, `calendario/novo` e os templates do WhatsApp.
4. **Paginação nos dois sentidos.** O número não mudou: 31 de 62 arquivos só andam para frente. `Paginacao` já existe e está em 7 arquivos. A migração é mecânica (desistências, recuperações, calendário, agendas de segunda chamada, autorizações de comunicação, …), mas exige cursor anterior nas consultas por cursor.
5. **Contraste.**
   - `#fff` sobre `--brand` no escuro já reprovava e piorou, de 4,47:1 para 4,06:1. Trocar `bg-brand-600 text-white` por `bg-brand-solid` nos 6 elementos com texto: `SubTabs`, `BarraAbasFinanceiro`, `FichaLead`, `TurmaFormulario`, `PoliticaPainel` e o passo do `MatriculaFormulario`. Depois, estender a `paleta.test.ts` para proibir `bg-brand-500|600` com `text-white`.
   - `--border-control`, família nova, reprova sobre `surface-muted` (2,996 e 2,991). Basta escurecê-lo o suficiente para passar de 3:1.
6. **Fuso e instante.** Restam 11 campos de fuso livres fora do `CampoFuso`, 3 deles vazios, e mais 2 com outro `name` (`ConferenciaAgendaFormulario`, `PrepararGrade`). `PaisSchema` aceita qualquer string, e ainda há fallback para UTC quando a escola não tem fuso. Os 8 instantes impressos com `toISOString()` continuam iguais à base, inclusive a frase de auditoria da emissão (`emissao/page.tsx:18`) e o histórico do pagador. Falta a prévia de conversão ("isso será 14:00 em São Paulo"), que nenhuma tela tem.
7. **Becos sem saída e identificação do registro fora de `/matriculas/[id]`.**
   - Becos: aba "Fechamentos de horas" sem `?aluno=` (`secoes.ts:33`); link para `/financeiro` que a SECRETARIA não abre (`entrada-particular/page.tsx:27`); `/academico/reposicoes` sem lista; "Preparar agenda inicial" incondicional; formulários que somem sem explicar (`podeRelatar`, segunda chamada inativa).
   - Identificação: telas que nomeiam a ação e não o aluno (créditos, agenda de aditivo, troca de fonte, propostas de correção) e IDs crus (`cobrancaId`, `credito.id`, "Solicitação {id}").
8. **Portal público.**
   - `/portal-aluno/ativar`: token só em memória, senha sem regra visível e sem confirmação.
   - `/portal-aluno/recuperar`: sem `catch`, diz "enviado" mesmo se falhar.
   - `/pagar/[token]`: não trata todos os status.
   - `/login`: sem `callbackUrl`.
   - Botões dessas telas fora de `botaoClasses`.
9. **Consultas e dados no servidor.**
   - Três listas principais ainda sem `take`: `/pipeline` (`listarLeads` sem filtro), a fila de cobrança (`listarFilaCobranca`, que entra na #144, em andamento) e os informes de pagamento (`listarInformesPagamento`).
   - `listarAlunos` ainda traz todas as cobranças de cada aluno só para pintar "Em dia/Em atraso"; a solução é `groupBy`. A segunda consulta da exportação fica, por decisão do ganho rápido 21.

   Ainda neste item, o lote de migração sem `take` (`server/migracao/consultas.ts:44`). A fila de envios do portal sem filtro de situação. A importação de alunos sem deduplicação (reenviar recadastra a planilha). A thread da inbox cortada em 300 mensagens, sem "anteriores". O envio de template na inbox, que não existe.
10. **Borda de rota restante.** `<Suspense>` continua em 0. Sem `loading.tsx` próprio: `/matriculas/[id]`, `/academico`, `/diario`, `/secretaria`, `/configuracao`; o genérico de `(app)` cobre por herança, mas não tem o formato da tela. Também sem `loading.tsx`: `/login`, `/pagar` e `/certificado`.
11. **Média e Baixa.** Repetir a amostra (`amostra.mjs` com outra semente) depois dos itens 1–4. Pela estimativa estratificada atual, ≈ 517 desses achados (71% de 727, IC 95% 63–79%) ainda estão abertos, e a maior parte cai nos padrões 1–4 acima.

As métricas de fluxo da 7.7 (cliques até concluir uma matrícula, tempo até o primeiro sinal, reenvios após erro) continuam **sem medição**. Exigem um operador real e cronômetro e devem ser feitas antes de declarar a auditoria encerrada.

## 7. Remedição de 13/10/2026 (main e5418550)

Código medido: `origin/main` em `e5418550` (merge da #161). As seções 1–6 mediram `6b105093`, depois da #138; entre as duas medições entraram as PRs #143–#161 (análise PR a PR no doc 44 §7). Tudo o que entra na `main` é publicado automaticamente no UAT (doc 44 §3). O UAT não foi aberto nesta remedição e as telas não foram vistas rodando: todos os vereditos abaixo são por leitura de código.

O método é o da seção 2:
- métricas por `node scripts/medicao-ux/metricas.mjs` na `e5418550`;
- os 145 achados Alta conferidos um a um no código;
- a mesma amostra de 126 achados Média/Baixa (`node scripts/medicao-ux/amostra.mjs 6 3 42`), com a estimativa estratificada de `scripts/medicao-ux/nucleo.mjs`. Rodar o cálculo com os vereditos antigos reproduz exatamente os 71,1% da seção 5.

**Resumo.**
- **Achados Alta (145):** de 37 resolvidos, 21 parciais e 87 abertos para **79 resolvidos, 26 parciais e 40 abertos**. Nenhum piorou.
- **Média e Baixa (727):** os abertos caíram de 71,1% (IC 95% 63,1–79,2%, ≈ 517) para **58,9% (IC 95% 50,3–67,5%, ≈ 428)**.
- **§6:** os itens 1–7 foram entregues (#153–#161), cada um com restos; os itens 8–11 não foram iniciados (§7.5).

### 7.1 Métricas

Mesma legenda da seção 3: ✅ meta atingida, ◐ andou e não atingiu a meta, ✖ não andou ou piorou.

| Métrica | 07/10 (§3) | 13/10 | Situação |
|---|---|---|---|
| Paginações só para frente ("Próxima" sem "Anterior") | 31 de 62 | **4 de 37**. `Paginacao` é usado em 24 arquivos (eram 7) | ◐ (#158, #161). O critério do script só vê "Próxima". A trava `paginacao-dois-sentidos.test.ts` ainda ancora como pendência 26 telas (27 links) de versões e históricos por cursor, que andam num sentido só |
| Campos de fuso fora do `CampoFuso` | 11 campos visíveis (13 linhas do grep) | **0** pelo critério da trava `fuso-instante.test.ts`. O grep `name="fuso` ainda dá 11 linhas, mas 9 são `CampoFuso` (contando o `Controller` de `PaisFormulario`), 1 é `hidden` (`ReposicoesEquipe`) e 1 é o `onChange` do formulário da agenda da segunda chamada. `CampoFuso` tem 30 usos (eram 10); `defaultValue="UTC"`: 0 | ✅ (#159) |
| Instantes crus na tela | 8 (`toISOString()` impresso) | **1** pelo critério antigo, e é falso positivo: em `academico/grades/[id]/page.tsx:37` o `toISOString()` vai para `data(...)`, que formata. **0** pelo critério da trava `fuso-instante.test.ts` | ✅ (#159) |
| `beforeunload` | 0 | **4** linhas, todas em `src/lib/aviso-ao-sair.ts` (`useAvisoAoSair`) | ◐ (#155). Cobre recarga, fechar a aba e sair do site; o clique num link interno do Next não dispara o evento (`aviso-ao-sair.ts:12-13`) |
| `window.confirm` | 1 (`ReguaComercialPainel.tsx:127`) | **0**. `ConfirmarAcao` existe, e a trava `confirmacoes.test.ts` proíbe `window.confirm` | ✅ (#154). A confirmação cobre só a fatia A (§7.5) |
| `aria-invalid` | 22, para 631 `required` | **37**, para 629 `required` | ◐ (#145). O `Campo` único é usado em só 2 telas: `FichaAluno` e `MatriculaFormulario` |
| Fluxos que terminam só em `router.refresh()` | 41 de 169 (24%) | **40 de 172 (23%)**, contando sucesso via `useAcaoCliente`/`FeedbackAcao`/`MensagemStatus` (137 pelo grep literal) | ◐. Longe da meta de < 10% |
| `<Suspense>` | 0 | **0** | ✖ |
| `loading.tsx` | 9 arquivos; 188 de 193 páginas cobertas | **9 arquivos; 188 de 193** | ◐. Sem mudança |
| Pares de token reprovando AA | 4 famílias | **3 famílias**: `#fff/--brand` (4,059:1 no escuro), `--border` e `--brand-border` (1,25–1,57:1). Saiu `--border-control`, agora com 3,19 (claro) e 3,18 (escuro) sobre `surface-muted`. `#fff/--brand` continua na conta porque o script conta por token, mas não tem mais uso com texto: o único `bg-brand-600` restante é a barra sem texto da `HomeVendedor`. `--border` e `--brand-border` estão em bordas decorativas | ◐ (#156, #157) |
| Controles sem nome acessível | **0 reais** (7 candidatos, todos falso positivo) | **69 no script, falso positivo.** 61 estão em `FichaAluno` (24) e `MatriculaFormulario` (37), que recebem `id` e `aria-*` pelo spread `{...campo}` do `Campo` (#145), e o script não segue spread. 7 são comentários em `Campo` (3), `CampoFuso` (2) e `CampoTexto` (2). Sobra 1 candidato em `FichaLead`, conferido nesta remedição: é o comentário da linha 116 (`<input type="datetime-local">` dentro de `//`). Controles reais sem nome: **0** | ✅. Varredura estática; não houve auditoria em leitor de tela |
| `<p>Nenhum…</p>` cru | 9 | **10** (`EstadoVazio` tem 267 usos; eram 260) | ◐. Subiu 1 |
| `outline-none` sem substituto | 42 pelo grep literal, 0 efetivos | **43** pelo grep literal (57 linhas com `outline-none`). Vale a mesma ressalva da seção 3: a regra global de `focus-visible` tem especificidade 0-1-1, maior que a 0-1-0 de `.outline-none`, e todas as 57 linhas também têm classe `focus:` ou `focus-visible:`. Efetivos: 0 | ✅ |

Nas demais métricas medidas pelo script, a situação não mudou. Números que andaram sem mudar a situação:
- importações de `@/components/*`: 866 → 963;
- componentes em `src/components`: 24 → 30;
- mapas de rótulo ad-hoc pelo grep: 22 → 25;
- listas com `useFiltrosUrl`: 4 → 5.

### 7.2 Achados Alta (145)

| Faixa (linhas do doc 42) | Achados | Resolvido antes → agora | Parcial antes → agora | Aberto antes → agora |
|---|---|---|---|---|
| 1–48 (L224–L1126) | 48 | 9 → 22 | 6 → 8 | 33 → 18 |
| 49–96 (L1156–L2201) | 48 | 10 → 29 | 8 → 8 | 30 → 11 |
| 97–145 (L2202–L2707) | 49 | 18 → 28 | 7 → 10 | 24 → 11 |
| **Total** | **145** | **37 → 79** (26% → 54%) | **21 → 26** (14% → 18%) | **87 → 40** (60% → 28%) |

**O que mudou.** 56 achados mudaram de status, e nenhum piorou:
- aberto → resolvido: 33;
- parcial → resolvido: 9;
- aberto → parcial: 14.

Conferência: 37 + 33 + 9 = 79 resolvidos; 21 − 9 + 14 = 26 parciais; 87 − 33 − 14 = 40 abertos.

**Por qual PR** ("(p)" marca os que ficaram parciais):

| PR | Achados que mudaram de status | Qtde |
|---|---|---|
| #145 (`Campo` único) | 471, 472 | 2 |
| #153 (feedback separado) | 309 (p), 892 (p), 1183, 1219, 1400 (p), 1438, 1671, 2442, 2457, 2485 | 10 |
| #153 + #155 | 1315, 1389 | 2 |
| #154 (`ConfirmarAcao`, fatia A) | 799, 906, 2014, 2016, 2281 (p), 2516, 2517 (p), 2518 | 8 |
| #155 (não perder o digitado) | 562, 629, 1059 (p), 1081, 1314, 1327, 1761, 1814, 1835, 2202, 2203, 2217, 2367 (p), 2368, 2395 | 15 |
| #158 (paginação nos dois sentidos) | 1709 (p) | 1 |
| #159 (fuso e instante) | 530, 729 (p), 1126, 1540, 1590, 1786, 2429 (p) | 7 |
| #160 (becos e identificação) | 279, 577 (p), 691, 798, 905, 1244, 1399 (p), 1670, 1722 (p), 1989, 2676 (p) | 11 |
| **Total** | | **56** |

As #158/#161 também trocaram a paginação de `/secretaria/envios-portal` (L431) para cursor nos dois sentidos, sem mudar o status. A #159 acrescentou a prévia de conversão em L1566, que continua parcial.

**Tabela por achado.** `L` = linha do achado em `docs/42-auditoria-frontend-ux.md`. Os caminhos são relativos a `src/app/(app)/`, salvo quando indicado; na área "Público, portal do aluno, home e preferências", são relativos a `src/app/`. Na coluna PR, "—" quer dizer que nada mudou depois de `6b105093`, e a PR entre parênteses é a que já tinha resolvido antes do doc 43. Na coluna "O que falta", **Efeito** é o que o usuário final vê hoje e **Falta** é o que ainda precisa ser feito.

**Alunos e turmas**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 224 | /alunos | 1 | aberto | aberto | `alunos/ImportarAlunosModal.tsx:122-123`: `disabled={enviando}` e rótulo "Importar" mesmo com `res` preenchido; `fileRef` só é limpo em `fechar()` (`:32`); `src/app/api/alunos/importar/route.ts:151`: `tx.aluno.create` sem dedupe | — | **Efeito:** um segundo clique em "Importar" recadastra a planilha inteira em duplicidade. **Falta:** depois do resultado, trocar para "Importar outra planilha", limpar `fileRef`/`res`, desabilitar até escolher novo arquivo (e idealmente dedupe no servidor). |
| 225 | /alunos | 2 | parcial | parcial | `ImportarAlunosModal.tsx:68`: `bloquearFechamento={enviando \|\| !!res}`; `:100-113`: erros só em memória; `:117-125` só "Fechar"/"Importar" | (#89, anterior) | **Efeito:** o modal não fecha mais por acidente, mas, ao fechar, a lista de linhas rejeitadas se perde. **Falta:** botão "Baixar linhas com erro (.csv)" (ou cópia). |
| 240 | /alunos/[id] | 1 | resolvido | resolvido | `alunos/[id]/FichaAluno.tsx:265`: `<FeedbackAcao erro={modal === "editar" ? acao.erro : null} />` dentro do `<Drawer>` (`:258`) | (#87) | **Efeito:** a falha ao salvar aparece dentro do Drawer, acima dos botões. Nada falta. |
| 241 | /alunos/[id] | 2 | resolvido | resolvido | `FichaAluno.tsx:462,469` e `:502,509`: `disabled={acao.ocupado}` e "Confirmando…" | (#87) | **Efeito:** o duplo clique não gera duas pausas ou encerramentos. Nada falta. |
| 279 | /alunos/[id]/creditos/[creditoId] | 1 | aberto | **resolvido** | `creditos/[creditoId]/page.tsx:23-26`: `<IdentificacaoRegistro rotulo="Aluno e matrícula deste crédito" … aluno, matriculaCodigo … "saldo disponível ${formatarMoeda(...)}">`; o cabeçalho vem de `consultarCabecalhoMatricula`, sem filtro para FINANCEIRO/ADMIN (`server/matricula/cabecalho.ts:19`) | #160 | **Efeito:** quem aprova o uso ou a devolução vê o aluno (com link), o código da matrícula e o saldo. Nada falta. O nome fica num bloco logo abaixo do `h1`, e não no próprio título. |
| 293 | /alunos/[id]/financeiro | 1 | aberto | aberto | `alunos/[id]/financeiro/FichaFinanceira.tsx:155-159`: colunas Tipo/Vencimento/Valor/Status/Ações, sem "Contrato"; `:77`: `contrato` por aluno, sem uso por cobrança | — | **Efeito:** com dois contratos ativos, as mensalidades se misturam e o ajuste pode cair na cobrança errada. **Falta:** enviar `matriculaId` e código por cobrança e criar a coluna "Contrato" (ou agrupar por matrícula). |
| 294 | /alunos/[id]/financeiro | 2 | resolvido | resolvido | `FichaFinanceira.tsx:366`: `<FeedbackAcao erro={acao.erro} />` dentro do modal de ajuste | (#85) | **Efeito:** o erro do ajuste aparece dentro do modal. Nada falta. |
| 295 | /alunos/[id]/financeiro | 3 | resolvido | resolvido | `ResumoFinanceiroComercial.tsx:62`: `<FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />` (alerta vermelho e status verde separados) | (#85) | **Efeito:** a recusa de alçada é anunciada como erro, não como informação. Nada falta. |
| 308 | /alunos/[id]/movimentacoes | 1 | aberto | aberto | Nenhum `useEffect` em `alunos/[id]/movimentacoes/*.tsx`; `MovimentacoesPainel.tsx:100` "Consultar propostas", `CompensacoesPainel.tsx:75` "Carregar compensações", `ComprasHorasPainel.tsx:35`, `RecomposicaoPainel.tsx:56`, `VinculosLegados.tsx:44` (todos só no clique) | — | **Efeito:** a página abre com seções vazias, e o operador conclui que não há pendências. **Falta:** carregar no servidor ou na montagem, deixar o botão só como "Atualizar" e mostrar o contador de pendências no título. |
| 309 | /alunos/[id]/movimentacoes | 2 | aberto | **parcial** | `movimentacoes/EfetivarAcerto.tsx:14-18`: `onClick` executa `efetivarAcertoEncerramento` direto; `:18` `<FeedbackAcao erro sucesso />` (falha agora em `role="alert"` vermelho) | #153 | **Efeito:** a falha passou a aparecer como erro, mas o encerramento irreversível continua num clique só. **Falta:** `ConfirmarAcao` listando as matrículas que serão encerradas. |
| 323 | /alunos/[id]/portal | 1 | resolvido | resolvido | `portal/painel.tsx:50-53`: quatro `section` com `bg-surface` | (#66) | **Efeito:** os cartões ficam legíveis no tema escuro. Nada falta. |
| 324 | /alunos/[id]/portal | 2 | resolvido | resolvido | `painel.tsx:51-53`: `disabled={acao.ocupado}` e `FeedbackAcao` por seção (`alvo === "convite"`…) | (#87) | **Efeito:** o resultado aparece na seção que originou a ação, e não há convite duplo. Nada falta. |

**Secretaria**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 361 | /secretaria | 1 | resolvido | resolvido | `secretaria/page.tsx:20-43`: `busca`, `whereBuscaMatriculas`, `skip/take`, `<Paginacao>` | (#103) | **Efeito:** qualquer matrícula pode ser achada por aluno ou código. Nada falta. |
| 363 | /secretaria | 3 | aberto | aberto | `secretaria/SecretariaPainel.tsx:26-27`: um único `erro`/`ocupado`; `:33`: alerta único no topo; todos os botões usam `disabled={ocupado}` | — | **Efeito:** o erro na 37ª matrícula aparece fora da tela, e um clique trava os botões de todos os cards. **Falta:** um `Record<matriculaId, {erro, ocupado}>`, com o alerta dentro do `<article>` afetado. |
| 406 | /secretaria/reservas/particulares/[id] | 1 | aberto | aberto | `secretaria/reservas/particulares/[id]/page.tsx:14`: `fuso = r.reserva.horarios[0]?.fusoOrigem ?? "UTC"`, aplicado a todos os horários (`:20`) e passado a `PrepararResolucao` (`:23`) | — | **Efeito:** horários de professores em outro fuso aparecem com hora e rótulo errados, e a prorrogação pode ser gravada no instante errado. **Falta:** formatar cada horário com o próprio `h.fusoOrigem` e usar o fuso administrativo (preferência de equipe) no prazo e no campo de prorrogação. |
| 431 | /secretaria/envios-portal | 1 | aberto | aberto | `src/server/portal-aluno/fila-envios.ts:9`: `Entrada = z.object(camposNavegacaoFila)` (só navegação, sem `situacao`); `:45` `orderBy: { id }`; `secretaria/envios-portal/page.tsx:17-29` lista tudo, sem abas | (#158/#161 só trocaram a paginação para cursor nos dois sentidos) | **Efeito:** para achar os "Resultado incerto", ainda é preciso varrer todas as páginas, agora podendo voltar. **Falta:** filtro `situacao` no schema e abas "Incertos" (padrão), "Falhas" e "Todos". |

**Matrículas — entrada e contratação**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 471 | /matriculas/nova | 1 | parcial | **resolvido** | `src/components/Campo.tsx:66-75`: `<label htmlFor={id}>` + `id`/`aria-*` no controle; `matriculas/nova/MatriculaFormulario.tsx:549-558`: "Rótulo visível em cada campo" no contato de emergência (`Nome do contato`, `Parentesco`, `Telefone`); `:577-588` no responsável; o placeholder fica só como exemplo (`+506...`) | #145 | **Efeito:** todo campo tem nome acessível e rótulo visível, e clicar no rótulo foca o campo. Nada falta. |
| 472 | /matriculas/nova | 2 | parcial | **resolvido** | `MatriculaFormulario.tsx:67`: `errosDoPasso1(...): ErrosDeCampos` (todos os erros); `:358-360`: `setTentouPasso1(true); if (focarPrimeiroComErro(validarPasso1(), IDS_PASSO1)) return;`; `Campo.tsx:39` `CONTROLE_INVALIDO = "aria-[invalid=true]:border-red-500"` aplicado em `inputCls` (`:19-21`) | #145 | **Efeito:** ao clicar em "Próximo", todos os campos inválidos ficam marcados com mensagem, e o foco vai para o primeiro. Nada falta. |
| 530 | /matriculas/[id]/preparacao | 1 | aberto | **resolvido** | `matriculas/[id]/preparacao/page.tsx:21-22`: `const fuso = … ?? "UTC"; const data = (d, origem = fuso) => \`${x.texto} (${x.fuso})\`` (o fuso é sempre impresso; o "·" órfão sumiu) | #159 | **Efeito:** cada data mostra o fuso ao lado, inclusive quando cai em UTC, e os horários da particular usam o `h.fusoOrigem` de cada um (`:57`). Nada falta. |
| 531 | /matriculas/[id]/preparacao | 2 | parcial | parcial | `preparacao/DecidirPreco.tsx:23`: Aprovar `secundario` e Rejeitar `perigo`, ambos direto em `decidir()`, sem confirmação e sem repetir valores | (#135, anterior) | **Efeito:** os botões se distinguem, mas um clique ainda registra a decisão comercial irreversível. **Falta:** repetir "Taxa · Mensalidade · desconto" no card e confirmar a aprovação em duas etapas. |
| 547 | /matriculas/[id]/emissao | 1 | aberto | aberto | `matriculas/[id]/emissao/page.tsx:32`: lista do plano linha a linha, sem soma nem contagem; `emissao/ConfirmarEmissao.tsx:24`: "Confirmar conferência e emitir cobranças" | — | **Efeito:** a Secretaria emite cobranças reais sem ver quantas são nem o total. **Falta:** somar as linhas `CONFERENCIA_SECRETARIA`, exibir "Serão emitidas N cobranças · total X" acima do formulário e repetir o total no botão. |
| 562 | /matriculas/[id]/pagador | 1 | aberto | **resolvido** | `matriculas/[id]/pagador/PagadorFormulario.tsx:36`: `useState(() => rascunhosIniciais(atual))`, um rascunho por tipo; `:39-47` campos controlados por `rascunhos[tipo]`; não há mais `<fieldset key={tipo}>` | #155 | **Efeito:** trocar Responsável ↔ Empresa preserva o que foi digitado em cada tipo. Nada falta. |
| 577 | /matriculas/[id]/entrada-particular | 1 | aberto | **parcial** | `entrada-particular/page.tsx:30-32`: `abreFinanceiro(usuario.papeis) ? <Link href="/financeiro"> : <p>… <Link href={/secretaria?matriculaId=…}>`; mas `emissao/page.tsx:23` (ramo EMITIDA, guard só SECRETARIA_ACADEMICA em `:13`) mantém `<Link className="underline" href="/financeiro">Abrir Financeiro</Link>` incondicional | #160 | **Efeito:** na entrada particular a Secretaria recebe o caminho certo, mas na emissão concluída ainda cai em "acesso negado". **Falta:** aplicar a mesma guarda em `emissao/page.tsx:23` e, para quem tem o papel, linkar a cobrança específica em vez da raiz `/financeiro` (vale para as duas telas). |

**Matrículas — contrato, aditivos e substituições**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 629 | …/contrato/previas/[previaId]/participantes | 1 | aberto | **resolvido** | `participantes/SeletorMaioridade.tsx:20-28`: seletor client com `router.replace(..., { scroll: false })` e o aviso "não apaga o que já foi preenchido"; `participantes/page.tsx:47-49`: `<FormularioParticipantes>` sem `key`; `participantes/Formulario.tsx:24`: `valores` em estado por nome de campo | #155 | **Efeito:** trocar a maioridade atualiza os papéis exigidos sem perder nome, e-mail, documento e evidência digitados. Nada falta. |
| 666 | …/contrato/substituicoes/[propostaId] | 1 | aberto | aberto | `substituicoes/[propostaId]/page.tsx:34-37`: `grid xl:grid-cols-2` com dois `<TextoPrevia dados={doc.texto} />` integrais | — | **Efeito:** a comparação continua no olho, e abaixo de `xl` os textos empilham. **Falta:** tabela "campo / enviado / substituto" com as divergências marcadas e o texto integral em `<details>`. |
| 691 | …/contrato/aditivos/[propostaId] | 1 | aberto | **resolvido** | `aditivos/[propostaId]/page.tsx:42-44`: `abreAcertos ? <p>… <Link href={/financeiro/acertos-taxa/${id}/${propostaId}}>Abrir o acerto das taxas no Financeiro</Link></p> : <p>… Avise o Financeiro.</p>`; os imports mortos `AcertoTaxaFormulario`/`ImpactosTaxaFormulario` foram removidos (`:1-16`) | #160 | **Efeito:** quem abre o Financeiro chega ao acerto das taxas por link, e a Secretaria recebe a orientação no lugar de um beco. Nada falta. |
| 703 | …/aditivos/[propostaId]/alcadas | 1 | parcial | parcial | `aditivos/[propostaId]/alcadas/page.tsx:22`: `VoltarPara` ao aditivo + `h1` genérico; o cabeçalho com aluno e código vem do layout (`matriculas/[id]/layout.tsx:30-43`); não há versão nem link de PDF | (#90/#110, anteriores) | **Efeito:** quem decide a alçada vê aluno e matrícula e pode voltar, mas não sabe qual versão da proposta aprova nem abre o documento. **Falta:** a versão da proposta no cabeçalho e o link para `/api/matriculas/{id}/aditivos/{propostaId}/previa-pdf`. |
| 715 | …/aditivos/[propostaId]/originais/[artefatoId] | 1 | aberto | aberto | `contrato/aditivos/CondicoesFormalizadasFormulario.tsx:14`: `<form>` com `h2`, `p`, `FeedbackAcao` e botão, sem checkbox, motivo ou resumo | — | **Efeito:** as condições contratuais são aplicadas na matrícula com um clique, sem conferência. **Falta:** checkbox de conferência, motivo gravado e lista dos campos que passam a valer, com a vigência formalizada. |
| 729 | …/contrato/aditivos/agenda | 1 | aberto | **parcial** | `aditivos/agenda/ConferenciaAgendaFormulario.tsx:36`: `<CampoFuso name={fuso-${encontro.id}} padrao={encontro.fusoOrigem} />` (pré-preenchido; `setCustomValidity` barra fuso inválido no próprio campo, `src/components/CampoFuso.tsx:96-99`); `:35` mantém a mensagem única "Informe datas, horários e fuso válidos." | #159 | **Efeito:** um identificador inválido é barrado no campo do encontro, mas um fuso válido e errado ainda passa, e as demais falhas continuam sem nomear o encontro. **Falta:** restringir aos fusos suportados pela escola (select) e, na falha, nomear o encontro e o campo. |

**Matrículas — ciclo de vida, desistência e compensações**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 787 | …/desistencia/documentos | 1 | aberto | aberto | `desistencia/documentos/page.tsx:31`: `<li key={doc.id}>{doc.nome}</li>`; `src/server/matricula/desistencia-documental.ts:68`: `select: { id, categoria, nome }`, sem `url` | — | **Efeito:** a "conferência documental" lista nomes que não se abrem, e o operador precisa sair do ERP. **Falta:** exibir a categoria, incluir `url` no select e renderizar link (com fallback textual). |
| 798 | …/desistencia/financeiro | 1 | aberto | **resolvido** | `desistencia/financeiro/page.tsx:33-36`: `rotuloCobranca` → "`TIPO · vencimento · valor`"; usado em `:70` e `:94`; os créditos externos viram "Crédito N" com link (`:95`) | #160 | **Efeito:** o Financeiro vê qual cobrança cada linha ajusta, em vez de um UUID. Nada falta. O UUID não ficou em `title`, mas isso era só um detalhe da recomendação. |
| 799 | …/desistencia/financeiro | 2 | aberto | **resolvido** | `desistencia/financeiro/AcertoContratualFormularios.tsx:83-95`: `<ConfirmarAcao … conferencia="Confirmo os valores acima.">` com "Serão ajustadas N cobranças / Será criado crédito de X"; `ReconferenciaDeltaFormularios.tsx:138-152`: o mesmo padrão; listado em `src/app/confirmacoes-mapa.ts` | #154 | **Efeito:** as duas aplicações exigem diálogo com resumo do impacto e caixa de conferência. Nada falta. |
| 853 | …/compensacoes/[cobrancaId]/periodo-integral | 1 | aberto | aberto | `compensacoes/[cobrancaId]/periodo-integral/PeriodoIntegral.tsx:193-207`: `aplicarRegularizacaoPeriodoIntegral` direto no `onClick` de "Aplicar regularização aprovada" | — | **Efeito:** um clique constitui crédito ou reprograma a cobertura, sem resumo. **Falta:** `ConfirmarAcao` com "será constituído crédito de X" / "cobertura de A a B" e a caixa de conferência. |
| 891 | …/continuidade-mensal | 1 | aberto | aberto | `continuidade-mensal/CondicoesContinuidadeMensal.tsx:125`: "Transcreva o calendário financeiro aplicável"; `:127-131` ID, versão, referência e vigências vazios; `:134` feriados um a um; `:45` `useState<string[]>([])` | — | **Efeito:** o operador redigita o calendário inteiro a cada versão, com risco de vencimento errado. **Falta:** selecionar um calendário cadastrado ou, como paliativo, pré-preencher com a última versão aprovada e aceitar colagem de várias datas. |
| 892 | …/continuidade-mensal | 2 | aberto | **parcial** | `CondicoesContinuidadeMensal.tsx:61-62`: `preparo.setErro("Informe os dias úteis e todos os feriados…")`; `:143` botão; `:147` `<FeedbackAcao erro={preparo.erro} … />` logo após o formulário; `src/components/FeedbackAcao.tsx:20-24` faz `scrollIntoView` + `focus()` na mensagem | #153 | **Efeito:** clicar em "Preparar para revisão" com falta de dados agora rola até o erro, junto do botão, e o anuncia. **Falta:** levar o foco ao campo faltante (dias úteis ou feriado vazio), e não só à mensagem. |
| 905 | …/fechamentos-horas | 1 | parcial | **resolvido** | `fechamentos-horas/page.tsx:35-37`: `alunoId = q.aluno \|\| (await consultarCabecalhoMatricula(usuario, id))?.alunoId`; fora do alcance, a mensagem leva link "Ir para o Financeiro"; `matriculas/[id]/secoes.ts:36` `contextoAluno: true` faz a aba levar `?aluno=` | #160 | **Efeito:** favorito, histórico ou aba abrem a página normalmente, sem o parâmetro. Nada falta. |
| 906 | …/fechamentos-horas | 2 | aberto | **resolvido** | `fechamentos-horas/EmitirFechamento.tsx:24-41`: o botão só abre `<ConfirmarAcao conferencia={\`Confirmo a emissão de ${total} para este período.\`}>` | #154 | **Efeito:** a cobrança real só sai depois de confirmar o valor exibido. Nada falta. |
| 934 | …/indisponibilidade-oferta | 1 | aberto | aberto | `indisponibilidade-oferta/RelatosIndisponibilidadeOferta.tsx:86`: o relato confirmado só tem link para `/termino`; não há link para `/compensacoes/{cobrancaId}` no arquivo nem em `page.tsx:20-21` | — | **Efeito:** depois de confirmar a indisponibilidade, não há caminho para apurar a compensação do aluno. **Falta:** listar as mensalidades cuja cobertura intersecta o período, com "Apurar compensação na mensalidade". |

**Acadêmico — calendário, grades, regras, modalidades, admissões**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 1014 | /academico/admissoes/[id] | 1 | aberto | aberto | `academico/admissoes/[id]/JanelaFormulario.tsx:32`: `<input type="date" required value={limiteEntrada} …>` sem `min` | — | **Efeito:** dá para preparar e aprovar uma janela com limite já vencido. **Falta:** `min` = hoje no `fusoConferido` e `<p role="alert">` "Data no passado…" antes do envio. |
| 1035 | /academico/admissoes/excecoes/[reservaId] | 1 | aberto | aberto | `admissoes/excecoes/[reservaId]/FormularioExcecao.tsx:26`: `<select name="decisao" … defaultValue="rejeitar"><option value="rejeitar">Rejeitar</option>…` | — (a #159 mexeu só em `page.tsx`) | **Efeito:** quem envia sem tocar no select rejeita a exceção por inércia. **Falta:** `defaultValue=""`, `<option value="" disabled>Selecione</option>` e `required`. |
| 1036 | /academico/admissoes/excecoes/[reservaId] | 2 | resolvido | resolvido | `FormularioExcecao.tsx:15-22,27`: `useAcaoCliente` + `<FeedbackAcao erro={acao.erro} />` | (#87) | **Efeito:** a falha de rede ou de sessão aparece como erro, com a instrução certa. Nada falta. |
| 1058 | /academico/calendario/novo | 1 | aberto | aberto | `academico/calendario/novo/PrepararCalendario.tsx:49`: `onClick={() => setPeriodos((a) => a.filter((x) => x.id !== p.id))}` | — | **Efeito:** um clique errado apaga o período sem desfazer. **Falta:** marcar como removido (riscado + "Restaurar") e filtrar só no envio. |
| 1059 | /academico/calendario/novo | 2 | aberto | **parcial** | `PrepararCalendario.tsx:20-21`: `useAvisoAoSair(!salvo && (motivo… \|\| JSON.stringify(periodos) !== …))`; `src/lib/aviso-ao-sair.ts:12-13`: "O clique num link interno do Next … não dispara o evento; interceptá-lo … fica como pendência" | #155 | **Efeito:** F5, fechar a aba ou sair do site pedem confirmação, mas o cenário citado no doc 42 ("Voltar ao calendário" ou Sidebar, que são links internos) ainda perde tudo em silêncio. **Falta:** interceptar a navegação interna com diálogo de confirmação. |
| 1070 | /academico/calendario/[id] | 1 | aberto | aberto | `academico/calendario/[id]/page.tsx:18`: `encontroAgenda.count({ where: { status: "PREVISTO" } })` sem filtro de calendário ou turma; `:42`: `<DecidirCalendario podePublicar={… && !possuiAgenda}>` (bloco de decisão segue, desabilitado); `:39` alerta sem link | — | **Efeito:** depois da primeira grade publicada, "Aprovar e publicar" nunca habilita e o bloco continua oferecendo o botão. **Falta:** quando `possuiAgenda`, trocar o bloco de decisão pela explicação com link para `/replanejamento`. Também falta corrigir a contagem para o escopo do calendário. |
| 1081 | …/calendario/[id]/replanejamento | 1 | aberto | **resolvido** | `calendario/[id]/replanejamento/EditorRevisao.tsx:64-66`: "Sempre montado (docs/42 L1081)" `<SalvarRevisao … desatualizado={alterado \|\| ocupado} />`; `SalvarRevisao.tsx:40-41`: "Confira os ajustes antes de guardar…" + botão `disabled={desatualizado …}` | #155 | **Efeito:** o bloco de salvar fica visível, desabilitado e explica que é preciso conferir de novo. Nada falta. |
| 1102 | …/revisoes/[revisaoId] | 1 | aberto | aberto | `calendario/[id]/revisoes/[revisaoId]/DecidirReplanejamento.tsx:20`: "Aprovar e aplicar conjunto" envia direto; `src/app/confirmacoes-mapa.ts:11-13` põe "aprovar replanejamento" na "Fatia B (ainda sem confirmação)" | — | **Efeito:** a ação que reescreve as datas da agenda dispara com um clique, protegida só por um motivo de 5 caracteres. **Falta:** checkbox "Conferi as datas, os conflitos e as exceções" e `ConfirmarAcao` com "N turmas, M encontros, K exceções". |
| 1103 | …/revisoes/[revisaoId] | 2 | resolvido | resolvido | `DecidirReplanejamento.tsx:14-15,19`: `useAcaoCliente({ idempotente: false })` + `<FeedbackAcao erro={acao.erro} />` | (#87) | **Efeito:** a falha mostra a instrução de conferir antes de repetir. Nada falta. |
| 1126 | /academico/grades/nova | 1 | aberto | **resolvido** | `academico/grades/nova/PrepararGrade.tsx:13`: `fusoInicial = fusoInicialDeEntrada(institucional, preferência)`; `PrepararGradeFormulario.tsx:28,61`: `<CampoFuso valor={fuso} … sugestoes={FUSOS_DA_GRADE} />`; `src/components/CampoFuso.tsx:96-99`: `setCustomValidity(validadeDoFuso(texto))` | #159 | **Efeito:** o fuso vem pré-preenchido com o institucional, e "America/Sao Paulo" ou "GMT-3" são barrados no próprio campo antes do envio. Nada falta no comportamento. O controle é um input validado com datalist, e não o `<select>` sugerido; foi uma escolha deliberada, para aceitar turmas fora da sede. |
| 1156 | /academico/regras/[nivelId] | 1 | aberto | aberto | `regras/[nivelId]/Formularios.tsx:64`: `onClick={() => { mudou(); setQuantidade(q => q - 1); }}` sem confirmação; campos continuam `defaultValue` (`:56-62`) | — | Efeito: um clique em "Remover última avaliação" ainda apaga 5 campos e 4 caixas da avaliação em silêncio, e readicionar não traz nada de volta. Falta confirmação ("Remover a avaliação {n}?…") ou campos controlados que preservem o digitado. |
| 1182 | …/regras/turmas/[turmaId]/historica | 1 | resolvido | resolvido | `historica/page.tsx:41`: `rounded bg-gray-50 p-3` | (#67) | Efeito: no tema escuro, a "Fotografia conferida" fica legível. Nada a fazer. |
| 1183 | …/regras/turmas/[turmaId]/historica | 2 | aberto | **resolvido** | `ConferenciaRegraHistorica.tsx:96-102`: `useAcaoCliente({ idempotente: false })`, `if (d?.tipo === "incerto") acao.setErro(MSG_DECISAO_INCERTA)`; `<FeedbackAcao erro sucesso>` (`:113`) | #153 | Efeito: se a decisão falhar no transporte, o gestor vê em vermelho que ela não foi confirmada, em vez de nada. Nada a fazer. |
| 1184 | …/regras/turmas/[turmaId]/historica | 3 | parcial | parcial | `ConferenciaRegraHistorica.tsx:104-111`: `<fieldset>` sem `<legend>`; `<select name="decisao" aria-label="Decisão da conferência">` e `<CampoTexto … aria-label="Motivo da decisão">` sem `<label>` visível e sem classe | — (aria-label da #84) | Efeito: o leitor de tela anuncia os campos, mas quem enxerga vê controles crus, sem rótulo, fora do design system. Falta `<fieldset><legend>Decisão desta conferência</legend>`, `<label className="block">` visível e `className="block w-full rounded border p-2"`. |
| 1204 | /academico/modalidades/[id]/quantidade | 1 | resolvido | resolvido | `AlterarQuantidadeAulas.tsx:17,20`: `tentativa = useRef<{ assinatura; chave }>`, chave nova só quando a assinatura muda | (#85) | Efeito: reenviar depois de uma falha de rede não cria uma segunda proposta. Nada a fazer. |
| 1205 | /academico/modalidades/[id]/quantidade | 2 | resolvido | resolvido | `AlterarQuantidadeAulas.tsx:18,20-21`: `previaAcao`/`acao.executar(...)` + `<FeedbackAcao erro>` | (#85) | Efeito: uma exceção vira mensagem de erro junto do botão. Nada a fazer. |
| 1218 | …/quantidade/propostas/[propostaId] | 1 | aberto | aberto | `DecidirQuantidadeAulas.tsx:14`: `onClick={() => decidir(true)}` direto, sem caixa "Conferi as {n} turmas" nem diálogo; `src/app/confirmacoes-mapa.ts:11-13` põe "aprovar … quantidade de aulas" na fatia B, "ainda sem confirmação" | — | Efeito: um clique em "Aprovar e aplicar" muda a quantidade de aulas de todas as turmas, sem pedir confirmação nem dizer quantas são. Falta checkbox obrigatório "Conferi as {n} turmas impactadas" e `<ConfirmarAcao>` com o resumo (fatia B da E1). |
| 1219 | …/quantidade/propostas/[propostaId] | 2 | parcial | **resolvido** | `DecidirQuantidadeAulas.tsx:13`: `acao.executar(…, aprovar ? "Alteração aprovada e aplicada." : "Proposta rejeitada.")`, depois `router.refresh()`; o `window.location.reload()` saiu. Depois do refresh, `page.tsx:12` mostra "Aplicada por {decisor} em …" | #153 | Efeito: a página não recarrega inteira, e o estado aplicado fica escrito na tela. Nada a fazer. |
| 1230 | /academico/indisponibilidades | 1 | aberto | aberto | `indisponibilidades/SolicitarAusencia.tsx:39`: `<select name="professorId" required>{professores.map(…)}</select>` sem `<option value="">`; o nome escolhido não aparece perto do envio | — | Efeito: o primeiro professor em ordem alfabética continua pré-selecionado, e a ausência pode ir para a pessoa errada. Falta `<option value="">Selecione o professor</option>` e o nome escolhido em destaque acima do botão. |
| 1231 | /academico/indisponibilidades | 2 | aberto | aberto | `indisponibilidades/DecisaoAusencia.tsx:27`: `disabled={ocupado \|\| !impactoHash \|\| motivo.trim().length < 5}`, sem texto quando `!impactoHash` | — | Efeito: o botão "Aprovar indisponibilidade" fica apagado sem dizer por quê. Falta a frase "A conferência de impacto expirou…" e um botão "Atualizar conferência" (`router.refresh()`). |
| 1244 | /academico/reposicoes | 1 | aberto | **resolvido** | `academico/reposicoes/page.tsx:27,34-53`: `EscolherMatricula` com `<form method="get" role="search">`, lista de matrículas encontradas (link `?matriculaId=`) e link "Abrir a lista de alunos" | #160 | Efeito: quem chega pelo índice consegue buscar e abrir a matrícula na própria tela. Nada a fazer. |
| 1256 | …/reposicoes/correcoes/[reposicaoId] | 1 | aberto | aberto | `CorrecoesConclusaoReposicao.tsx:140`: `Horário da validação (UTC)<input name="validadaEm" type="datetime-local">`; `isoUtc` (`:67`) e `:124-125` ("informe a validação em UTC") | — | Efeito: o operador ainda converte de cabeça para UTC, e um horário local digitado grava até 3 h deslocado. Falta aceitar a entrada no fuso de exibição (CampoFuso), converter no cliente e mostrar a equivalência (`PreviaConversao`). |

**Acadêmico — avaliações, correções e equivalências**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 1314 | /academico/avaliacoes/[alocacaoId]/[codigo] | 1 | aberto | **resolvido** | `[codigo]/page.tsx:44-47`: `<LancarNotas fuso={fusoEntrada} …>` sem `key` e sem `<form method="get">`; `[codigo]/Formularios.tsx:45-54,71`: `useState(fusoInicial)` + `<CampoFuso valor={fuso} onChange={trocarFuso}>` | #155 | Efeito: trocar o fuso não recarrega a página nem apaga as notas e os comentários digitados. Resíduo sem impacto na UI: o ramo "Fuso inválido" (`page.tsx:23`) continua para `?fuso=` digitado à mão na URL. |
| 1315 | /academico/avaliacoes/[alocacaoId]/[codigo] | 2 | aberto | **resolvido** | `Formularios.tsx:41,61-68,87`: `useAcaoCliente` + `<FeedbackAcao erro={acao.erro} sucesso={acao.sucesso}>` (erro em `role="alert"` vermelho, sucesso em verde); sem `key` de versão, o refresh não remonta o formulário | #153 + #155 | Efeito: "Versão já alterada" (vermelho) e "Versão registrada" (verde) ficam distintos, e a confirmação continua na tela depois de salvar. Nada a fazer. |
| 1327 | …/[codigo]/designacao | 1 | aberto | **resolvido** | `designacao/page.tsx:31-33`: `<FormularioDesignacao …>` sem `key` e sem form GET; `designacao/Formulario.tsx:33,37,44,72`: motivo e termo controlados, `router.replace(\`?busca=…\`, { scroll: false })` | #155 | Efeito: buscar professor não apaga o motivo digitado. Nada a fazer. |
| 1365 | …/[alocacaoId]/fechamento | 1 | resolvido | resolvido | `fechamento/page.tsx:63,85`, `ConfirmarFechamento.tsx:44`, `ExcecaoFrequencia.tsx:112,118`: só `amber-200/700`, `green-200`, mapeados em `tailwind.config.ts:49,51` | (#67) | Efeito: pendências e avisos legíveis no escuro. Nada a fazer. |
| 1389 | /academico/correcoes/[lancamentoId] | 1 | aberto | **resolvido** | `correcoes/[lancamentoId]/page.tsx:25-27`: `<ProporCorrecao …>` sem `key`; `Formularios.tsx:16-24,33`: `useAcaoCliente` + `<FeedbackAcao erro sucesso>` | #153 + #155 | Efeito: proposta recusada aparece em vermelho, a aceita em verde, e a confirmação sobrevive ao refresh. Nada a fazer. |
| 1399 | …/correcoes/[lancamentoId]/[propostaId] | 1 | aberto | **parcial** | `[propostaId]/page.tsx:19`: `Mudança para a turma {i.turmaDestino} — executada`; `src/server/avaliacoes/impactos-legiveis.ts:8` devolve só `{ id, status, turmaDestino }`; o checkbox de `Formularios.tsx:48` continua "Conferi … impactos apresentados" | #160 | Efeito: o decisor deixou de ver UUID e vê a turma de destino, mas ainda aprova sem saber a origem, a data e o caso a revisar. Falta turma de origem, data e link de cada item para `/academico/correcoes/revisoes/<casoId>`. |
| 1400 | …/correcoes/[lancamentoId]/[propostaId] | 2 | aberto | **parcial** | `Formularios.tsx:41-44,50`: erro e sucesso separados (`FeedbackAcao`); mas `[propostaId]/page.tsx:21` `{d.podeDecidir && <DecidirCorrecao …/>}` desmonta no refresh, e `:20` só exibe o genérico "Pode já ter sido decidida, ter uma versão…" | #153 | Efeito: o erro agora aparece em vermelho, mas a confirmação "Correção aprovada e aplicada." some no refresh, e a página não diz o que aconteceu. Falta redirecionar para `/academico/correcoes/<lancamentoId>` com banner do server component, ou ao menos mostrar a decisão registrada na página. |
| 1411 | /academico/correcoes/revisoes/[casoId] | 1 | aberto | aberto | `ResolucaoRevisaoProgressao.tsx:26,34`: `casos: { id: string }[]`; `:164`: `{previa.casos.length} … casos serão incluídos`; `:183`: `{proposta.casos.length} … incluído(s)` | — | Efeito: quem propõe e quem aprova continua decidindo um lote sem ver quais casos. Falta trazer aluno, turma e data de cada caso do servidor e listá-los na prévia e no histórico. |
| 1437 | /academico/equivalencias/[propostaId] | 1 | aberto | aberto | `AcoesEquivalencia.tsx:58`: `horarioCompativel: true` fixo; `:90`: `<input type="checkbox" required …/>` sem `name`; `page.tsx:82`: turmas só por `textoTurma` (código/nome) | — | Efeito: a pessoa atesta compatibilidade de horário sem ver o horário de nenhuma das turmas, e o atestado é fixo no envio. Falta exibir `diasHorario` de origem e destino e derivar `horarioCompativel` do checkbox, com `name`. |
| 1438 | /academico/equivalencias/[propostaId] | 2 | aberto | **resolvido** | `AcoesEquivalencia.tsx:29-30,82,93`: `decisao`/`execucao = useAcaoCliente(…)`, cada uma com `<FeedbackAcao erro sucesso>` | #153 | Efeito: "Transferência efetivada" (verde) e "Autorização já utilizada" (vermelho) deixam de ser idênticos. Nada a fazer. |

**Acadêmico — recuperações**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 1540 | /academico/recuperacoes/planos/[propostaId] | 1 | parcial | **resolvido** | `planos/[propostaId]/Formularios.tsx:32-36`: `Horario` com `<CampoFuso padrao={fusoInstitucional ?? ""}>` (datalist) e `<PreviaConversao local fuso fusoExibicao>`; `page.tsx:44` passa `fusoExibicao` | #159 | Efeito: antes de enviar, o operador vê "Isso será dd/mm hh:mm em {fuso de exibição}" sempre que digita em outro fuso. Observação: a prévia converte para o fuso de exibição, não para UTC, e cumpre o pedido de "conversão resultante". |
| 1566 | …/planos/[propostaId]/prorrogacoes | 1 | parcial | parcial | `prorrogacoes/Formularios.tsx:13,24`: recebe `prazoAnterior`, mas usa `<Horario …>`, cujo `<input name="dataHora" type="datetime-local" step="0.001" required …>` (`planos/[propostaId]/Formularios.tsx:34`) não tem `min` | (#159 só acrescentou a prévia) | Efeito: o fuso e a prévia estão certos, mas ainda dá para propor prazo anterior ao vigente e só descobrir no erro do servidor. Falta `min` igual ao prazo vigente (convertido para o fuso do campo). |
| 1590 | …/tentativas/[itemReservaId] | 1 | parcial | **resolvido** | `tentativas/[itemReservaId]/page.tsx:31`: `<Realizar … fusoInstitucional={fusoInstitucional} fusoExibicao={fusoExibicao} />`; prévia em `planos/[propostaId]/Formularios.tsx:36` | #159 | Efeito: o professor vê a conversão do horário da realização antes de enviar. Nada a fazer. |
| 1603 | …/tentativas/[itemReservaId]/agenda | 1 | resolvido | resolvido | `tentativas/[itemReservaId]/agenda/Formulario.tsx:28-30`: `{...periodo.propsInicio}`, fim com `min={periodo.min}`, `<CampoFuso padrao={fusoInstitucional ?? ""}>` | (#69/#78) | Efeito: horário publicado no fuso certo; fim anterior ao início é barrado no campo. Nada a fazer. |

**Acadêmico — segundas chamadas**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 1670 | …/segundas-chamadas/[alocacaoId]/[codigoAvaliacao] | 1 | aberto | **resolvido** | `[codigoAvaliacao]/page.tsx:17-24`: `bloqueio` "Nova proposta indisponível", com "A matrícula está {status}…" e link "Registrar a autorização específica" para `…/autorizacoes` (gestão) ou "Peça a autorização à Gestão Pedagógica"; `SegundaChamadaPainel.tsx:66` `{!ativa && bloqueio}` | #160 | Efeito: com matrícula pausada ou encerrada, a pessoa lê o motivo e tem o caminho da autorização. Nada a fazer. |
| 1671 | …/segundas-chamadas/[alocacaoId]/[codigoAvaliacao] | 2 | aberto | **resolvido** | `SegundaChamadaPainel.tsx:57-63`: `if (d?.tipo === "ok") router.refresh()`; `feedback(grupo)` mostra erro ou sucesso só no grupo `item:${id}` que disparou a ação | #153 | Efeito: sem recarga total; a confirmação aparece no card alterado e a rolagem é mantida. Nada a fazer. |
| 1709 | /academico/segundas-chamadas/agendas | 1 | aberto | **parcial** | `agendas/page.tsx:34-35,52`: `lerPagina` + `<Paginacao pagina={pagina} temProxima …>` (página numerada); nenhum `<form>` de busca, data, turma ou situação | #158 | Efeito: a secretaria sabe em que página está, mas ainda folheia a fila às cegas para achar "o aluno X". Falta form GET com `busca` (aluno/matrícula) e `de`/`ate`, propagados nos links de página. |
| 1722 | …/segundas-chamadas/pendentes-agenda | 1 | aberto | **parcial** | `pendentes-agenda/page.tsx:49-56`: `Preparo` só mostra "Preparar agenda inicial" nos itens que a prévia pode seguir; nos demais, o texto do motivo. Para PAUSADA/ENCERRADA (`:53`), o link "Conferir a autorização na prévia" vai para a mesma tela de agenda (`href` de `:50`) | #160 | Efeito: a secretaria não perde mais tempo preenchendo agenda de item sem saldo ou com impedimento, mas nas matrículas pausadas é levada de novo à tela de preparo. Falta, nesse caso, o link para `…/[alocacaoId]/[codigoAvaliacao]/autorizacoes`, que a doc 42 pede. |
| 1747 | …/segundas-chamadas/minhas/[reservaId] | 1 | parcial | parcial | `minhas/[reservaId]/Formulario.tsx:17,30-31`: `FormularioRealizacao({ reservaId, fusoInstitucional })`; `datetime-local` sem `min`/`max`; `page.tsx:18,27`: o fuso do encontro (`fuso`) não vai ao formulário | — | Efeito: o professor pode registrar um horário fora do encontro (ou deslocado pelo fuso) e só ver a recusa do servidor. Falta passar o fuso do encontro como padrão, aplicar `min`/`max` iguais ao intervalo do encontro e mostrar o intervalo válido junto do campo. |
| 1761 | …/propostas/[propostaId]/agenda | 1 | aberto | **resolvido** | `propostas/[propostaId]/agenda/Formulario.tsx:28-29,41`: `CAMPOS_DA_PREVIA = ["professorId","inicioLocal","fimLocal","fusoOrigem"]`; `onChange` limpa a prévia só nesses campos e mostra `AVISO_PREVIA_DESCARTADA` | #155 | Efeito: digitar no motivo ou na evidência não apaga a prévia conferida; quando ela cai, a tela diz por quê. Nada a fazer. |
| 1785 | …/reservas/[reservaId]/cancelamento | 1 | aberto | aberto | `cancelamento/page.tsx:20-27,44`: `Efeito` só dentro do `map` de propostas; `cancelamento/Formulario.tsx:37-40`: origem, data e fuso sem efeito calculado | — | Efeito: quem propõe ainda não sabe se a proposta vai devolver ou consumir a oportunidade do aluno. Falta calcular o efeito ao vivo no formulário (origem + `dataHoraLocal` + regra de antecedência). |
| 1786 | …/reservas/[reservaId]/cancelamento | 2 | parcial | **resolvido** | `cancelamento/Formulario.tsx:16,38-40`: `<CampoFuso padrao={fusoInstitucional ?? ""} onChange={setFuso}>` + `<PreviaConversao local={dataHoraLocal} fuso={fuso} fusoExibicao={fusoExibicao}>`; `page.tsx:40` | #159 | Efeito: o fuso vem preenchido e o instante convertido aparece antes do envio. O "junto com o efeito" depende do L1785, que segue aberto. |
| 1814 | …/reservas/[reservaId]/substituicao | 1 | aberto | **resolvido** | `substituicao/page.tsx:53-55`: `<Formulario …>` sem `key={substitutoId}`; `Formulario.tsx:49,51,53`: `router.replace` mantém o componente montado; evidência e motivo fora de condicional | #155 | Efeito: trocar o professor no select não apaga o motivo nem a evidência. Nada a fazer. |

**Diário de aulas**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 1835 | /diario | 1 | aberto | **resolvido** | `diario/DiarioAulas.tsx:30-40`: `mesclarChamada` preserva `presente`/`observacao`; `:65`: `if (!preenchidos) setRegistros([])`; `:75-77,95-102`: `TrocaPendente` pede confirmação quando sai aluno já preenchido; `:135` | #155 | Efeito: trocar a data não apaga a chamada já feita, e a tela avisa antes de descartar alguém. Nada a fazer. |
| 1863 | /diario/encontros/[id] | 1 | aberto | aberto | `diario/encontros/[id]/page.tsx:21`: `role={ocorrencias.ok && ocorrencias.dado ? undefined : "alert"}` e `className={… ? "text-gray-600" : "text-red-700"}` | — | Efeito: quando há ocorrências, a falha ao carregar a chamada continua um texto cinza que o leitor de tela não anuncia. Falta `role="alert"` e estilo de erro sempre, ou mensagens distintas vindas da resposta. |
| 1864 | /diario/encontros/[id] | 2 | aberto | aberto | `diario/encontros/[id]/page.tsx:24`: `<p role="alert">Há vínculos que precisam de conferência da gestão antes do lançamento.</p>`, sem lista nem ação | — | Efeito: o professor continua travado, sem saber quais vínculos estão pendentes, quem resolve e como pedir. Falta listar os vínculos e dar ação ou link ("Solicitar conferência à gestão" ou a matrícula) com o responsável. |
| 1901 | /diario/encontros/[id]/correcao | 1 | resolvido | resolvido | `CorrecaoAula.tsx:130,131,142,338,365`: `bg-surface`; sem `rose-*`, `amber-900`, `*-800`; `border-blue-200`/`border-green-200` (`:364,366`) agora mapeados (`tailwind.config.ts:49,52`) | (#66/#67) | Efeito: "antes e depois" legível no escuro. Nada a fazer. |
| 1947 | /diario/regularizacoes-gravacao | 1 | resolvido | resolvido | `RegularizacoesGravacao.tsx:21-22`: `bg-surface` | (#66) | Efeito: cartões legíveis no escuro. Nada a fazer. |
| 1989 | /diario/reposicoes/[id]/troca-fonte | 1 | aberto | **resolvido** | `troca-fonte/page.tsx:18,22-25`: `consultarIdentificacaoReposicao` + `<IdentificacaoRegistro rotulo="Aluno e reposição desta troca">` com aluno (link), código da matrícula, produto e "Reposição por gravação da aula de {data} · turma" | #160 | Efeito: quem aprova a troca vê de qual aluno e de qual aula se trata. Ressalva: se a identificação vier `null` (`{identificacao && …}`), a tela volta ao estado antigo sem aviso. |
| 1990 | /diario/reposicoes/[id]/troca-fonte | 2 | resolvido | resolvido | `TrocaFonteReposicao.tsx:66,73,81`: `bg-surface` | (#66) | Efeito: blocos legíveis no escuro. Nada a fazer. |

**Financeiro**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 2014 | /financeiro | 1 | aberto | **resolvido** | `FilaCobranca.tsx:154-157`: `pedirEnvioViaApi` só abre a confirmação; `:420` ("Cobrar"/"Lembrar" da linha) e `:441` (detalhe); `:451-460`: `<ConfirmarAcao titulo="Enviar … para {aluno} pelo WhatsApp?" confirmacao="envio para {primeiro nome}" acao={() => enfileirarCobrancaWhatsApp(...)}>`; `:484-501`: destinatário, número, valor, degrau do template, "não pode ser desfeita" | #154 | Efeito: um clique errado na fila não manda mais cobrança real; o envio exige "Confirmar envio para Ana". Observação: o diálogo descreve o degrau do template e não reproduz o texto literal. |
| 2015 | /financeiro | 2 | resolvido | resolvido | `FilaCobranca.tsx:373`: linha com `<button>`; `:592-599`: `useDialogo(painel, …)`, `role="dialog"`, `aria-modal="true"` | (#89) | Efeito: detalhe da cobrança operável por teclado, com Esc e foco preso. Nada a fazer. |
| 2016 | /financeiro | 3 | aberto | **resolvido** | `FinanceiroPainel.tsx:100`: `onFechar={() => { …; setConfirmarFechamento(true); }}`; `:105-125`: `<ConfirmarAcao titulo="Fechar o mês e marcar as comissões aprovadas como pagas?">` com "{n} comissões aprovadas passam a pagas, total {X}" e "Não há desfazer pela tela" | #154 | Efeito: fechar o mês exige confirmação com quantidade e total. Observação: a competência não é citada, o que não impede o uso. |
| 2017 | /financeiro | 4 | aberto | aberto | `FinanceiroPainel.tsx:427-429`: `.filter(([, v]) => v.trim() !== "" && Number(v) > 0)` seguido de `if (entradas.length === 0) return;` | — | Efeito: cotação inválida continua descartada em silêncio, e o operador acha que salvou. Falta validar cada campo (moeda inválida marcada em vermelho) e mostrar "Nenhuma cotação válida para salvar". |
| 2065 | /financeiro/acertos-cobertura/[matriculaId]/[propostaId] | 1 | parcial | parcial | `acertos-cobertura/ImpactosCoberturaFormulario.tsx:32`: `podePreparar` com 6 condições; `:43`: `disabled={acao.ocupado \|\| !podePreparar}`, sem lista nem contagem de pendências | — (mínimo visível da #121) | Efeito: numa matrícula com muitas mensalidades, o operador continua sem saber qual campo prende o botão. Falta listar as pendências por mensalidade, ou "N de M pendentes" acima do botão, e marcar os cards incompletos. |

**Comercial**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 2201 | /leads/[id] | 1 | resolvido | resolvido | `leads/[id]/FichaLead.tsx:436-439`: `if (!(await executar("interacao", …))) return; setNota(""); … setModal("none")`; o mesmo em `:474-475` e `:500` | (#87) | Efeito: se a action recusar, o painel fica aberto e o texto é preservado. Nada a fazer. |
| 2202 | /leads/[id] | 2 | parcial | **resolvido** | `leads/[id]/FichaLead.tsx:543` `const leitura = confirmado && … ? confirmado.valores : persistido` e `:589` `{leitura[k] \|\| "—"}`. A edição só fecha com sucesso: `:577` `if (await run(...)) { …; setEditar(false); }`. Ao entrar em edição, o rascunho volta ao persistido (`:559` `setF(leitura)`). | #155 | Nada. **Efeito para o usuário:** um resumo recusado ou cancelado não aparece mais como salvo. |
| 2203 | /leads/[id] | 3 | aberto | **resolvido** | `FichaLead.tsx:611-616`: `servidor` é recalculado a cada render a partir de `lead`, e `valores = { ...base, ...edicao }`. Só os campos editados sobrepõem o servidor, e `:644` envia `valores`. | #155 | Nada. **Efeito:** agendar a experimental pela barra e depois clicar "Salvar datas" não sobrescreve mais a data nova com a antiga. |
| 2217 | /leads/[id]/contratacao | 1 | aberto | **resolvido** | `leads/[id]/contratacao/page.tsx:32` `<PreparacaoFormulario key={o.selecionada.id} …>`. A página de cadastros e a de turmas saíram da `key`. `PreparacaoFormulario.tsx:20-21` guarda o aluno e a turma escolhidos no estado. | #155 | Nada obrigatório. A recomendação acessória, carregar as turmas sem trocar de rota, não foi feita. A `versaoEntrada` também saiu da `key`; a agenda conferida para outra versão é invalidada (`:24`). **Efeito:** "Mais turmas" ou "Cadastros anteriores" não apagam mais taxa, valor, motivo e agenda. |
| 2229 | /pipeline | 1 | resolvido | resolvido | `pipeline/KanbanBoard.tsx:396-414`: `<Modal …>` com `<FeedbackAcao erro={acaoPerda.erro} …/>` dentro do modal. `:330` `if (desfecho?.tipo !== "ok") return;` | — (#87/#89) | Opcional: validar no cliente que "Outro" exige observação, antes de enviar. **Efeito:** o erro da perda aparece no próprio modal. |
| 2269 | /empresas | 1 | resolvido | resolvido | `empresas/EmpresasCliente.tsx:177` `<th …>Faturas a receber</th>` | — (#101) | Detalhe de vocabulário: a ficha rotula o mesmo status como "Fechada — a pagar" (`src/lib/labels.ts:455`). **Efeito:** a coluna não diz mais "em aberto" para faturas fechadas. |
| 2281 | /empresas/[id] | 1 | aberto | **parcial** | `empresas/[id]/FichaEmpresa.tsx:201,209` `onClick={() => pedirConfirmacao(f, "pagar"\|"cancelar")}` abre `<ConfirmarAcao>` (`:223-255`). O resumo traz código, competência, nº de cobranças, total e "Não há desfazer". O botão foi renomeado para "Cancelar fatura" (`:211`). Mas `:266-287`: "Inativar empresa" chama `run("contrato", () => salvarEmpresa({… ativo: !empresa.ativo}))` sem confirmar. | #154 | Falta confirmar "Inativar empresa". "Cancelar fatura" continua ao lado de "Registrar pagamento", na mesma `<span className="flex … gap-3">` (`:196`), e não foi para um menu secundário. **Efeito:** pagar ou cancelar fatura não acontece mais por engano; inativar a empresa ainda acontece. |
| 2282 | /empresas/[id] | 2 | aberto | aberto | `src/server/empresas/acoes.ts:99` `export async function fecharFaturaB2B` continua sem chamador em `src/app`. `empresas/[id]/page.tsx:21-24` ainda consulta `listarProdutosParaMatricula()` e `competenciasFaturaveis(id)`, e `FichaEmpresa.tsx:59-60` declara `produtos`/`competencias` sem usar. | — | Falta expor o fechamento por competência ou remover as duas consultas e as props. **Efeito:** o financeiro continua sem gerar fatura pela tela, e a página faz duas consultas à toa. |
| 2295 | /inbox | 1 | aberto | aberto | `inbox/InboxCliente.tsx:784-788` `onChange={(e) => { … if (f) void subirEEnviar(f); }}`. `:751-757` `gravador.onstop = () => { … void subirEEnviar(new File(...)) }`. `:714` `subirEEnviar(file, legenda = "")`. | — (inbox sem mudança desde `6b105093`) | Falta um passo de revisão: prévia, legenda e "Enviar"/"Descartar". **Efeito:** o PDF errado continua indo direto para o cliente. |
| 2296 | /inbox | 2 | aberto | aberto | `InboxCliente.tsx:392` `janela 24h fechada — texto livre pode ser recusado (use template)`. O composer (`:775-830`) não tem seletor de template. | — | Falta o seletor de templates aprovados com a janela fechada, ou uma instrução executável. **Efeito:** o operador continua procurando um envio de template que não existe. |
| 2297 | /inbox | 3 | parcial | parcial | Promessa, `InboxCliente.tsx:538-540`: `await marcarConversaTratada(...)` sem ler o retorno, seguido de `onNota("Promessa registrada — régua pausada até a data.")`. Pagamento, `:601-602`: também não lê `r.ok`, só o `catch`, e anuncia "Pagamento registrado." sem prometer pausa. | — | Falta checar `r.ok` na promessa (e no pagamento) e, na falha, avisar que a régua **não** foi pausada. **Efeito:** a tela ainda pode anunciar "régua pausada" sem a pausa ter acontecido. |
| 2298 | /inbox | 4 | aberto | aberto | `InboxCliente.tsx:967-970` `vincular(...)` chama `vincularContatoWhatsApp` direto. `:440-444` "Registrar opt-out" vai direto no `onClick`. `:430-436` o campo de evidência tem `minLength={12}`, sem texto de ajuda. Não há `desvincular` em `src`. | — | Faltam: confirmar o vínculo com o efeito escrito, oferecer desvincular e escrever "mínimo de 12 caracteres". **Efeito:** um clique errado ainda amarra o histórico a outra pessoa, sem volta pela tela. |
| 2299 | /inbox | 5 | parcial | parcial | A busca é feita no servidor e há aviso de lista limitada (`InboxCliente.tsx:247-252`, #102). A thread ainda corta em 300 mensagens: `src/server/whatsapp/consultas-inbox.ts:130` `mensagens: { orderBy: { criadoEm: "desc" }, take: 300`, sem "carregar anteriores" nem aviso. | — | Falta paginação "carregar mensagens anteriores" na thread, ou ao menos avisar o corte. **Efeito:** conversas longas perdem o começo em silêncio. |
| 2300 | /inbox | 6 | resolvido | resolvido | Não há `bg-white`, `violet-*` nem `amber-300/500` em `inbox/` (grep vazio). | — (#66/#67) | Nada. **Efeito:** os cartões ficam legíveis no tema escuro. |

**Configuração**

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 2324 | /configuracao | 1 | parcial | parcial | Existem `(app)/error.tsx`, `(app)/not-found.tsx` e `(app)/loading.tsx`, este acima do `configuracao/layout.tsx`. Não há `loading.tsx` em `configuracao/` nem nas sub-rotas: `find src/app -name loading.tsx` lista só academico, alunos, financeiro, inbox, leads, pipeline, `(app)` e portal-aluno. `SubTabs.tsx` não mostra indicador de pendência. | — | Falta `loading.tsx` em `configuracao/` (o boundary de `(app)` não cobre a troca entre sub-abas irmãs sob o mesmo layout). `not-found.tsx` por segmento é opcional, porque o de `(app)` cobre. **Efeito:** ao clicar numa sub-aba, a tela anterior continua congelada. |
| 2367 | /configuracao/contratos/novo | 1 | aberto | **parcial** | `configuracao/contratos/ModeloFormulario.tsx:28` `useAvisoAoSair(!salvo && (tocado \|\| JSON.stringify(valor) !== …))`. `src/lib/aviso-ao-sair.ts` registra `beforeunload` e reconhece no próprio comentário: "O clique num link interno do Next … não dispara o evento". | #155 | Falta proteger a navegação interna: o clique numa sub-aba ou num link do menu ainda apaga tudo. Também falta rascunho persistido (`localStorage`/autosave) com "rascunho recuperado". **Efeito:** F5 e fechar a aba agora pedem confirmação; trocar de sub-aba ainda perde horas de redação. |
| 2368 | /configuracao/contratos/novo | 2 | aberto | **resolvido** | `ModeloFormulario.tsx:51-55`: com divergência, guarda `pendente` e explica. `:98-104` mostra o resumo da tentativa (título, nº de seções), com os botões "Reenviar a proposta anterior" (`reenviarAnterior`, `:38-41`, usa `tentativa.current.entrada` e a mesma chave) e "Descartar a tentativa anterior" (`:42-44`). | #155 | Nada. O resumo mostra só título e nº de seções, mas remete ao histórico. **Efeito:** depois de uma queda, o redator reenvia ou descarta sem precisar recarregar e perder tudo. |
| 2395 | /configuracao/turmas | 1 | aberto | **resolvido** | `configuracao/turmas/TurmasPainel.tsx:127` `aoFechar={() => { if (turmaAlterada) setConfirmandoDescarte(true); else fecharFormulario(); }}`. `:128-135` "Descartar a turma não salva?" com "Descartar alterações"/"Continuar editando". `TurmaFormulario.tsx:122` informa `alterado`. | #155 | Nada. "Cancelar" dentro do formulário fecha direto, mas é uma ação explícita. **Efeito:** clicar no fundo ou apertar Esc não apaga mais a turma preenchida. |
| 2412 | /configuracao/usuarios | 1 | aberto | aberto | `configuracao/usuarios/UsuarioFormulario.tsx:99` `<input id="usuario-senha" type="password" {...register("senha")} …>`, sem `autoComplete`. O `<form>` (`:79`) também não tem. | — | Faltam `autoComplete="new-password"` no campo e, na edição, um clique em "Definir nova senha" antes de habilitar. **Efeito:** o navegador ainda pode preencher a senha do administrador no cadastro de outro usuário. |
| 2428 | /configuracao/paises | 1 | parcial | parcial | `configuracao/paises/PaisesPainel.tsx:41,45` `{ label: "Encerrar", alvo: StatusPais.ENCERRADO, variante: "perigo" }`, sem confirmação. `:25` `_count` continua no tipo, mas as colunas (`:118-123`) são País/Moeda/DDI/Documentos/Status/Ações. | — (#135) | Faltam: confirmação com digitação do nome do país, repetindo produtos, preços e alunos; e as colunas com esses números. **Efeito:** dá para encerrar, sem volta, um mercado com alunos ativos num clique. |
| 2429 | /configuracao/paises | 2 | aberto | **parcial** | Fuso: `PaisFormulario.tsx:107-110` `<CampoFuso …>` mais o erro `errors.fuso`, e `src/server/paises/schema.ts:29` `.refine((fuso) => … fusoIanaValido(fuso), MSG_FUSO_PAIS_INVALIDO)`, validado no servidor (`acoes.ts:49,85` `PaisSchema.parse`). Idioma: `PaisFormulario.tsx:114` continua `<input … placeholder="es">` e `schema.ts:30` `idioma: z.string().min(1)`. | #159 | Falta o idioma: select ou lista fechada, com validação no schema. O erro do idioma já é exibido. **Efeito:** um fuso digitado errado não grava mais; um idioma inválido ainda grava. |
| 2442 | /configuracao/operacao | 1 | parcial | **resolvido** | `OperacaoFormulario.tsx:30`, `PrazosPortalFormulario.tsx:38` e `PrazosEntregaReposicaoFormulario.tsx:26`: todos `<FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />`. `FeedbackAcao` renderiza o erro em `role="alert"` vermelho e o sucesso em `MensagemStatus` verde. | #153 | Nada. **Efeito:** uma falha de gravação não se passa mais por "Configuração salva". |
| 2457 | /configuracao/operacao/avisos-diario | 1 | aberto | **resolvido** | `operacao/avisos-diario/AvisosDiarioFormulario.tsx:30` `<FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />` | #153 | Nada. **Efeito:** erro e sucesso dos avisos do diário ficam distinguíveis. |
| 2469 | /configuracao/migracao | 1 | resolvido | resolvido | `configuracao/migracao/PreparacaoMigracaoPainel.tsx:16,18`: dois `useAcaoCliente`. `:23` mostra `<FeedbackAcao erro={leitura.erro} sucesso={leitura.sucesso} />` logo depois de "Ler arquivo" e outro depois de "Preparar lote". | — (#86) | Nada. **Efeito:** um CSV com delimitador errado aparece como erro, junto do botão. |
| 2483 | /configuracao/migracao/[loteId] | 1 | aberto | aberto | `src/server/migracao/consultas.ts:46` `linhas: { orderBy: { linhaOrigem: "asc" }, select: { … dadosOrigem … } }`, sem `take`. Em `migracao/[loteId]/page.tsx:24`, cada linha tem `<pre …>{JSON.stringify(linha.dadosOrigem, null, 2)}</pre>`, fora de `<details>`. | — | Faltam paginação na consulta e na tela, e o JSON em `<details>` fechado. **Efeito:** um lote grande ainda vira um documento gigante que trava a rolagem. |
| 2484 | /configuracao/migracao/[loteId] | 2 | resolvido | resolvido | Não há `bg-white`, `sky-`, `emerald-` nem `amber-300` em `configuracao/migracao/` (grep vazio). Os `<pre>` usam `bg-gray-50`/`bg-surface`. | — (#67) | Nada. **Efeito:** os blocos de ensaio ficam legíveis no escuro. |
| 2485 | /configuracao/migracao/[loteId] | 3 | aberto | **resolvido** | `EnsaioVinculoMigracao.tsx:31-40`: `useAcaoCliente` e `feedback(alvo)` com `<FeedbackAcao erro=… sucesso=…/>` por bloco. `AplicarCadastroMigracao.tsx:13-17` usa `acao.executar` / `acao.setErro`, e `:21` `<FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-2" />`. | #153 | Nada. **Efeito:** "Ensaio registrado." e uma falha não aparecem mais iguais. |
| 2499 | /configuracao/migracao/presenca/[linhaId] | 1 | aberto | aberto | `migracao/presenca/[linhaId]/PresencaHistorica.tsx:16` `<select name="decisao" …><option value="APROVAR">Aprovar e aplicar</option><option value="REJEITAR">Rejeitar</option></select>`, botão `"Decidir"`, sem confirmação. | — | Faltam: opção vazia padrão, botão com o nome da ação escolhida e confirmação que repita aluno, aula e participação. **Efeito:** preencher o motivo e clicar ainda aplica a presença histórica no diário. |
| 2516 | /configuracao/whatsapp | 1 | aberto | **resolvido** | `configuracao/whatsapp/PoliticaPainel.tsx:116-120` `pedirKill()` só abre a confirmação, e o botão em `:150-155` chama `onClick={pedirKill}`. `:380-403` `<ConfirmarAcao titulo={form.killSwitch ? "Destravar a automação de cobrança?" : "Congelar toda a automação de cobrança?"} …>`, com o texto do que volta a sair. | #154 | Nada. **Efeito:** congelar ou destravar a cobrança automática exige confirmar, nos dois sentidos. |
| 2517 | /configuracao/whatsapp | 2 | aberto | **parcial** | A passagem para ATIVA abre `ConfirmarAcao` nos quatro painéis: `PoliticaPainel.tsx:85` `ativando` e `:406-429`, com remetente, janela, teto e degraus automáticos/em lote. `ComercialPainel.tsx:56-57,78` e `:271-299` mostram o texto da saudação e o número do gestor. `ReguaComercialPainel.tsx:130,155` e `:319-345` incluem `Alcance: só os ${pilotoLeads.length} lead(s) do piloto` ou "GO-LIVE GERAL". | #154 | Falta a **estimativa numérica de alcance**. Na régua de cobrança só há "toda cobrança com degrau … devido" (`PoliticaPainel.tsx:428`), e no go-live geral "todos os leads elegíveis", sem contagem. **Efeito:** ativar o envio real exige confirmar e mostra a configuração, mas não diz quantas pessoas vão receber. |
| 2518 | /configuracao/whatsapp | 3 | aberto | **resolvido** | `TemplatesPainel.tsx:79` `editandoAprovado = original?.statusMeta === "APROVADO"`. `:188-193` mostra o alerta no topo do formulário (`bg-amber-50 … text-amber-800`). `:83-89` faz o Salvar abrir `<ConfirmarAcao titulo="Salvar o template aprovado … e devolvê-lo a rascunho?">` (`:247-265`). | #154 | Nada. **Efeito:** editar um template aprovado avisa antes e exige confirmar que o degrau sai do ar. |

**Público, portal do aluno, home e preferências** (caminhos relativos a `src/app/`)

| L | Rota | # | Status antigo | Status novo | Evidência atual | PR | O que falta |
|---|---|---|---|---|---|---|---|
| 2566 | /pagar/[token] | 1 | resolvido | resolvido | `pagar/[token]/PagarCliente.tsx:50` `{formatarMoeda(valor, moeda)}` | — (#93) | Nada. **Efeito:** o pagador vê "R$ 1.200,50", não "BRL 1.200,5". |
| 2581 | /certificado/[codigo] | 1 | resolvido | resolvido | `certificado/[codigo]/page.tsx:18-19` `border-green-200 bg-green-50` / `text-green-700`, com `green.200` mapeado em `tailwind.config.ts:49` | — (#67) | Nada. **Efeito:** o selo de autenticidade fica legível no escuro. |
| 2593 | /portal (legado) | 1 | parcial | parcial | `src/server/_shared/sessao.ts:153` `if (!alvo.includes(Papel.ALUNO)) redirect("/portal")`. `(portal)/portal/page.tsx` faz `redirect("/portal-aluno")`, e `src/server/portal-aluno/sessao.ts:114` faz `redirect("/portal-aluno/entrar")`. Não há mensagem sobre acesso próprio, só "Entre com o e-mail individual confirmado no seu convite" (`portal-aluno/entrar/page.tsx:29`). | — (#64) | Falta explicar que a área do aluno usa acesso próprio, ou mapear a sessão. **Efeito:** o aluno logado na equipe ainda cai num segundo login sem entender por quê. Já não há erro. |
| 2602 | /portal-aluno | 1 | resolvido | resolvido | `portal-aluno/page.tsx:17` `exigirSessaoPortalAlunoPagina()`, que redireciona, e `portal-aluno/error.tsx` com "Entrar de novo" → `/portal-aluno/entrar` | — (#64) | Nada. **Efeito:** sessão expirada leva ao login, não à tela de erro do Next. |
| 2603 | /portal-aluno | 2 | resolvido | resolvido | `portal-aluno/page.tsx:19` `rounded-lg border bg-surface p-4`; não há `bg-white` em `portal-aluno/`. | — (#66) | Nada. **Efeito:** os cartões ficam legíveis no escuro. |
| 2616 | /portal-aluno/entrar | 1 | resolvido | resolvido | `portal-aluno/entrar/page.tsx:27` `rounded-xl border bg-surface p-7`, sem `shadow-sm` | — (#66) | Nada. **Efeito:** o card de login fica legível no escuro. |
| 2626 | /portal-aluno/ativar | 1 | aberto | aberto | `portal-aluno/ativar/page.tsx:8-14` `const token = useRef("")` mais `window.history.replaceState(…)`. Não usa `sessionStorage`, e o formulário (`:28`) é renderizado mesmo sem token. `:19` `if (!token.current) throw new Error();` → `:25` "Este link não está disponível…". | — | Faltam: guardar o token em `sessionStorage` e, sem token, não mostrar o formulário, com orientação e link para `/portal-aluno/recuperar`. **Efeito:** um F5 queima o link em silêncio e o aluno só descobre depois de digitar a senha. |
| 2627 | /portal-aluno/ativar | 2 | aberto | aberto | `ativar/page.tsx:28` tem um único `<input required minLength={12} maxLength={72} name="senha" type="password" …>`. O texto é só "Crie uma senha que só você conhece." | — | Faltam: a regra "mínimo de 12 caracteres" visível, "Repita a senha" ou mostrar senha, e bloqueio enquanto as duas não coincidirem. **Efeito:** um erro de digitação ainda tranca o aluno fora do portal. |
| 2628 | /portal-aluno/ativar | 3 | resolvido | resolvido | `ativar/page.tsx:28` `rounded-xl border bg-surface p-7`, sem sombra | — (#66) | Nada. **Efeito:** a tela fica legível no escuro. |
| 2639 | /portal-aluno/recuperar | 1 | aberto | aberto | `portal-aluno/recuperar/page.tsx:11-12` `try { await fetch(...) } finally { setEnviando(false); setEnviado(true); }`, sem `catch` e sem conferir `resposta.ok`. | — | Faltam: `setEnviado(true)` só depois de uma resposta ok, e um `catch` com mensagem de falha que mantenha o formulário. **Efeito:** offline ou com erro 500, o aluno vê "pedido enviado" e espera algo que nunca chegou. |
| 2640 | /portal-aluno/recuperar | 2 | resolvido | resolvido | `recuperar/page.tsx:14` `bg-surface`, sem sombra | — (#66) | Nada. **Efeito:** a tela fica legível no escuro. |
| 2651 | /portal-aluno/preferencias | 1 | resolvido | resolvido | `portal-aluno/preferencias-formulario.tsx:21` `rounded border bg-surface p-4` | — (#66) | Nada. **Efeito:** o formulário fica legível no escuro. |
| 2664 | /portal-aluno/resultados | 1 | resolvido | resolvido | `portal-aluno/resultados/page.tsx:82-86` `border-green-200 bg-green-50 text-green-700` / `border-amber-200 bg-amber-50 text-amber-700`. `:58,65` `bg-surface-muted`. Não há `-950`, `-300`, `amber-900` nem `bg-white`. | — (#67) | Nada. **Efeito:** o veredito do nível fica legível no escuro. |
| 2676 | /portal-aluno/reposicoes/[id] | 1 | aberto | **parcial** | `portal-aluno/reposicoes/[id]/page.tsx:56-62` calcula `motivoSemRelato`, por exemplo "O material ainda não foi liberado…" ou "A gravação não está liberada para você…". `relatar-indisponibilidade.tsx:56` `{!podeRelatar && <p …>{motivoSemRelato ?? …}</p>}`. O formulário continua condicionado a `podeRelatar={podeReproduzir}` (`page.tsx:81`, `relatar-indisponibilidade.tsx:55`). | #160 | O bloco vazio deixou de existir: agora explica o motivo e manda procurar a secretaria. Mas o canal de aviso **continua sumindo** exatamente quando a gravação não abre. Falta permitir o relato ao aluno dono da reposição, já que o servidor revalida o vínculo, ou oferecer outro canal na tela. **Efeito:** o aluno entende por que não pode relatar, mas ainda precisa sair do portal para avisar a escola. |
| 2677 | /portal-aluno/reposicoes/[id] | 2 | resolvido | resolvido | `reposicoes/[id]/page.tsx:65,71` `bg-surface` e `:78` `border-amber-200 bg-amber-50`. `entrega-gravacao.tsx:26-27`, `relatar-indisponibilidade.tsx:43` e `video-gravacao.tsx:10` usam `bg-surface`. | — (#66/#67) | Nada. **Efeito:** os blocos ficam legíveis no escuro. |
| 2691 | /home | 1 | resolvido | resolvido | `src/components/Sidebar.tsx:126` `… hidden h-dvh w-56 … md:flex`. `(app)/layout.tsx:20` `<BarraMobile …/>` e `:22` `main … p-4 md:p-8`. | — (#94) | Nada. **Efeito:** o professor usa o sistema no celular sem a sidebar ocupar a tela. |
| 2692 | /home | 2 | resolvido | resolvido | `(app)/home/HomeProfessor.tsx:107,114` `disabled={acao.ocupado}` nos dois botões | — (#87) | Nada. **Efeito:** não saem dois check-ins contraditórios. |
| 2693 | /home | 3 | aberto | aberto | `HomeProfessor.tsx:112-117` `onClick={() => checkin(e.id, false)}` ("Faltou") direto, sem confirmação nem desfazer. | — | Faltam confirmação inline ou "Desfazer" por 10 s, com reversão no servidor. **Efeito:** um toque errado ainda marca o lead como no-show, sem volta pela tela. |
| 2707 | /preferencias | 1 | resolvido | resolvido | `(app)/preferencias/FusoExibicaoFormulario.tsx:24` `rounded border bg-surface p-5` | — (#66) | Nada. **Efeito:** o formulário fica legível no escuro. |

### 7.3 Amostra Média/Baixa (126 de 727)

#### 7.3.1 Resumo

1. **Estimativa nova:** **58,9% dos 727 achados Média/Baixa continuam abertos (IC 95% 50,3–67,5%), ≈ 428 achados (≈ 366–491).** Antes eram 71,1% (IC 63,1–79,2%), ≈ 517 achados.
2. **Queda pareada:** na mesma amostra, a fração estimada que saiu de "aberto" é de **12,2 p.p. (IC 95% 6,4–18,0), ≈ 89 achados.** Os dois intervalos se sobrepõem, mas a diferença pareada exclui zero. Nenhum achado regrediu.
3. **Amostra crua:** eram 17 resolvidos, 18 parciais e 91 abertos. Agora são **32 resolvidos, 18 parciais e 76 abertos.** Ao todo, 19 achados mudaram:
   - 11 passaram de aberto para resolvido;
   - 4 passaram de aberto para parcial;
   - 4 passaram de parcial para resolvido.
4. **Origem das mudanças:**
   - **17 vieram de código novo:**
     - #153, feedback separado: 5 achados (705, 776, 1328, 1687 parcial e 2041);
     - #159, fuso e instante: 5 achados (549, 1037, 1800, e 2652 e 2709 parciais);
     - #158/#161, paginação nos dois sentidos: 3 achados (419, 924 e 1469);
     - #160, identificação do registro: 3 achados (268, 283 e 582);
     - #143, abas do diário: 1 achado (1839).
   - **2 são reclassificações sem código novo** (L270 e L1645). O doc 43 deu "aberto" a títulos `text-xl`/`text-2xl` sem `font-medium` na classe, mas a regra base de `globals.css:143-153` (ganho rápido 9, `e9b1c29d`, anterior ao doc 43) já renderiza h1–h6 com peso 500.
   - **Só pelo código, sem as 2 reclassificações:** 59,8% abertos (IC 51,2–68,4%), ≈ 435 achados.
5. **Sem efeito na amostra:** a #154 (`ConfirmarAcao`) não moveu nenhum achado. A confirmação entrou só na "fatia A" de `src/app/confirmacoes-mapa.ts`, a de efeito externo ou financeiro. As 5 confirmações da amostra continuam abertas:
   - Drawer da ficha do aluno;
   - Cancelar do diário;
   - lote da fila de cobrança;
   - revogar cobertura;
   - "Retirar a conclusão".
6. **Sem efeito na amostra:** a #145 (`Campo` com `aria-invalid`) também não moveu nenhum achado. A #155 só fechou junto com a #153 (L1328) e ficou parcial em 2519.

#### 7.3.2 Contagens por estrato, antes e depois

R = resolvido, P = parcial, A = aberto. A amostra tem 6 achados Média e 3 Baixa por área. A população é o total de achados do estrato no doc 42.

| Área | Média antes R/P/A | Média depois R/P/A | Baixa antes R/P/A | Baixa depois R/P/A | População Média / Baixa |
|---|---|---|---|---|---|
| Alunos e turmas | 2 / 0 / 4 | **3 / 0 / 3** | 1 / 1 / 1 | **2 / 1 / 0** | 26 / 14 |
| Secretaria | 0 / 1 / 5 | **1 / 1 / 4** | 0 / 0 / 3 | 0 / 0 / 3 | 22 / 9 |
| Matrículas — entrada | 0 / 2 / 4 | **2 / 0 / 4** | 1 / 0 / 2 | 1 / 0 / 2 | 34 / 9 |
| Matrículas — contrato | 0 / 1 / 5 | 0 / 1 / 5 | 1 / 0 / 2 | **2 / 0 / 1** | 30 / 16 |
| Matrículas — ciclo | 1 / 2 / 3 | **2 / 2 / 2** | 0 / 0 / 3 | **1 / 0 / 2** | 62 / 12 |
| Acadêmico — base | 0 / 0 / 6 | **1 / 0 / 5** | 0 / 0 / 3 | 0 / 0 / 3 | 56 / 5 |
| Acadêmico — avaliações | 1 / 0 / 5 | **2 / 0 / 4** | 1 / 0 / 2 | 1 / 0 / 2 | 33 / 16 |
| Acadêmico — recuperações | 0 / 1 / 5 | 0 / 1 / 5 | 0 / 1 / 2 | **2 / 0 / 1** | 44 / 19 |
| Acadêmico — segundas chamadas | 1 / 0 / 5 | **2 / 1 / 3** | 1 / 0 / 2 | 1 / 0 / 2 | 33 / 19 |
| Diário de aulas | 1 / 1 / 4 | **2 / 1 / 3** | 0 / 0 / 3 | 0 / 0 / 3 | 44 / 14 |
| Financeiro | 2 / 0 / 4 | **3 / 0 / 3** | 0 / 2 / 1 | 0 / 2 / 1 | 32 / 24 |
| Comercial | 2 / 2 / 2 | 2 / 2 / 2 | 1 / 0 / 2 | 1 / 0 / 2 | 28 / 11 |
| Configuração | 0 / 2 / 4 | 0 / 2 / 4 | 0 / 1 / 2 | 0 / 1 / 2 | 36 / 30 |
| Público e portal | 1 / 0 / 5 | **1 / 2 / 3** | 0 / 1 / 2 | 0 / 1 / 2 | 35 / 14 |
| **Total** | **11 / 12 / 61** (84) | **21 / 13 / 50** (84) | **6 / 6 / 30** (42) | **11 / 5 / 26** (42) | **515 / 212** |

Em negrito, os estratos que mudaram. Comercial e Configuração não mudaram nada.

#### 7.3.3 Estimativa estratificada para os 727 (IC 95%)

| Status | Antes (`6b105093`) | Depois (`e5418550`) | ≈ achados, antes → depois |
|---|---|---|---|
| Resolvido | 12,6% (7,1–18,1%) | **24,9% (17,6–32,1%)** | 92 → **181** |
| Parcial | 16,3% (9,6–22,9%) | **16,2% (9,6–22,8%)** | 118 → **118** |
| Aberto | 71,1% (63,1–79,2%) | **58,9% (50,3–67,5%)** | 517 → **428** |

- **Sem as 2 reclassificações:** resolvido 24,0% (16,8–31,2%), ≈ 174; parcial 16,2%, ≈ 118; aberto 59,8% (51,2–68,4%), ≈ 435.
- **Amostra aleatória simples, sem peso (só referência):** 76/126 = 60,3% abertos (Wald 51,8–68,9%). Antes eram 72,2%.
- **Queda pareada de "aberto":** 12,2 p.p., IC 95% 6,4–18,0%, ≈ 89 achados. É a mesma estimativa estratificada, aplicada à variável "era aberto e deixou de ser".
- **Limites do intervalo:**
  - como no doc 43, um estrato com 0 ou 3 de 3 contribui com variância zero, o que deixa o intervalo otimista;
  - com 6 e 3 achados por estrato, o número de cada área é indicativo, não estimativa.

#### 7.3.4 Padrões entre os que continuam abertos ou parciais

São 94 achados não resolvidos: 76 abertos e 18 parciais. Cada um recebeu até 2 etiquetas; o "(p)" marca os parciais.

| Padrão | Achados | Quantos | O que se repete |
|---|---|---|---|
| **Texto e microcopy** | 257, 408, 420, 445, 645, 654, 718 (p), 829 (p), 869, 937, 1259, 1316, 1441, 1494, 1556 (p), 1617, 1765, 1803, 1854, 1890, 1913 (p), 2082 (p), 2272, 2432, 2652 (p), 2709 (p) | 26 | Rótulos que não dizem o que fazem: "Conferir e submeter" grava direto, "Próximos encontros" para página mais antiga, "se o horário a atingir", "Tentativa" que leva à designação. Também plurais "(s)", jargão ("identificador IANA", "fonte preservada a conferir"), slugs e valores crus (`fornecedor`, `VALIDADORES`, IDs de reserva e consumo) e frases longas sem marcador curto. |
| **Layout e hierarquia** | 257, 270 (p), 378, 381, 420, 434 (p), 536, 551, 603, 693, 778, 829 (p), 1170, 1207, 1368, 1506, 1616, 1723, 1966, 1980, 2079, 2133, 2187 (p), 2458, 2486, 2712 (p) | 26 | Dado concatenado com "·" num `<li>` em vez de tabela ou `<dl>` (551, 1207, 2486, 829); estado crítico sem destaque, como "Prazo vencido", vigente ou expirada e urgência (378, 1616, 1723); fluxo sem andamento de etapas (603, 693); antes e depois só em prosa (1170); `<h1>` duplicado (1980, 2458). |
| **Navegação e becos** | 445, 645, 654, 682, 762 (p), 1047, 1209, 1259, 1300, 1428, 1529, 1617, 1804, 1913 (p), 2079, 2219, 2326 (p), 2553 | 18 | Erro da página como `<p role="alert">` solto, sem `<h1>`, volta nem "Tentar de novo" (762, 1529, 1804, 2079 e, em parte, 381). Falta link para onde se resolve (445, 654, 682, 1300, 1913). Ainda há `window.location.assign` (1209), login sem `callbackUrl` (2553) e paginação só para frente em `/academico/calendario` (1047). |
| **Feedback de ação** | 312, 377, 515, 534, 603, 937, 1316, 1354, 1556 (p), 1605, 1687 (p), 1952, 2430 (p), 2431, 2567, 2606 | 16 | Sucesso que só faz `router.refresh()`, sem mensagem nem `reset()` (1354, 1687 parcial). Mensagem fixa que ignora o modo (1316). Botão desabilitado sem dizer por quê (312, 534, 2431). Formulário que some sem explicação (377, 937). Revisão invalidada em silêncio (515). Resultado no fim da seção, longe da ação (1952). Status errado no público: `/pagar` só tem "pago/aberto" (2567) e o `sair` não confere `ok` (2606). |
| **Validação de campo** | 312, 394, 534, 567, 630, 1157, 1748, 2130, 2206, 2431, 2501, 2652 (p), 2709 (p) | 13 | `<select>` que nasce numa decisão ("Aprovar e aplicar", "Presente") sem opção vazia (2130, 2501); `<select>` que executa a ação no `onChange` (2206); `min`/`max`/`pattern`/`title` ausentes (394, 567, 1157, 1748); só `issues[0]` e nada por campo (630); fuso em input + datalist (2652, 2709). |
| **Dados não perdidos** | 242, 879, 1084, 1354, 1687 (p), 1836, 2519 (p) | 7 | Esc, fundo ou Cancelar descartam a edição (242, 1836). Formulário de nova versão não copia a anterior (879, 1084). O `useAvisoAoSair` (#155) cobre só o editor de templates do WhatsApp (2519). |
| **Confirmação** | 242, 1258, 1836, 2018, 2244 | 5 | São a "fatia B" de `confirmacoes-mapa.ts`, ainda sem confirmação: aprovar e enviar lote de cobrança (2018), revogar cobertura (2244), "Retirar a conclusão" como primeira opção do select (1258) e o descarte de edição (242, 1836). |
| **Acessibilidade** | 583, 630, 1980, 2206, 2219, 2272, 2458 | 7 | `role="alert"` por item e resumo sem `role` (583); dois `<h1>` na mesma rota (1980, 2458); falta `aria-current` ou `aria-expanded` (2219, 2272); erro sem `aria-invalid` nem foco (630). |
| **Estado de rota** | 381, 762 (p), 1529, 1804, 2031 (p), 2190 (p) | 6 | Faltam `loading.tsx`/`error.tsx` com o formato do segmento (2031, 2190), e o erro de consulta devolvido como parágrafo (381, 762, 1529, 1804). |
| **Fuso e data** | 394, 778, 1084, 1506, 1616 | 5 | O horário atual não é mostrado ao editar (1084, 394); falta data no título da versão (778); `CampoFuso` repetido em cada item (1506). |
| **Outro** | 2354, 2572, 2584 | 3 | Lista de contratos sem estado da decisão (2354); `/pagar` sem `noindex` (2572); emoji em "Certificado autêntico ✅" (2584). |
| **Mobile** | — | 0 | Nenhum achado da amostra é de mobile. |

**Leitura.**
- **Fecha em lote:** como no doc 43, o que fechou foi o que uma PR transversal resolve em lote:
  - `FeedbackAcao` (#153);
  - `formatarInstanteExibicao` e `CampoFuso` (#159);
  - `Paginacao`/`PaginacaoFila` (#158/#161);
  - `IdentificacaoRegistro` (#160).
- **Continua aberto:** os padrões que exigem decisão tela a tela:
  - texto e rótulo;
  - estrutura da informação, ou seja, tabela em vez de `<li>` com "·";
  - destino dos links;
  - botões desabilitados sem motivo.

  Com as categorias "texto", "layout" e "navegação", eles somam a maior parte dos 94 não resolvidos.
- **Em lote, o que mais renderia:**
  - o cabeçalho de erro com volta e "Tentar de novo" no lugar do `<p role="alert">` solto. São 4 abertos e 1 parcial na amostra, e o doc 43 já contava mais de 30 páginas de `/matriculas/[id]`;
  - a fatia B da confirmação.

#### 7.3.5 Tabela por achado

Na ordem do doc 43 (linha L do doc 42). Os caminhos são relativos a `src/app/(app)/`, salvo os que começam com `app/`, `components/`, `lib/` ou `server/`, que são relativos a `src/`. Na coluna PR:
- "—" quer dizer sem PR nova que mude o status;
- "(antes)" marca a PR que já tinha resolvido antes do doc 43.

| L | Severidade | Área | Veredito antigo | Veredito novo | Evidência atual | PR |
|---|---|---|---|---|---|---|
| 229 | Média | Alunos e turmas | resolvido | resolvido | `alunos/AlunosLista.tsx:141-143` "N–M de T alunos (encontrados) (de X no total)" acima da tabela, com `Paginacao` em `:198` | #92 (antes) |
| 242 | Média | Alunos e turmas | aberto | aberto | `alunos/[id]/FichaAluno.tsx:260` `onClose` do Drawer limpa e fecha sem comparar `ed` com `valoresEd()`; `components/Drawer.tsx:38,46` Esc (useDialogo) e fundo fecham sem guarda | — |
| 257 | Média | Alunos e turmas | aberto | aberto | `alunos/[id]/academico/page.tsx:34-37` lista "Escolha o contrato…", mas sem aviso quando falta `matriculaId` com 2+ vínculos; `academico/MudancasAcademicasPainel.tsx:72` só "Turma atual: {label}" sem contrato | — |
| 268 | Média | Alunos e turmas | aberto | resolvido | `alunos/[id]/agenda-aditivo/page.tsx:17` `IdentificacaoRegistro` "Aluno desta agenda" com nome e link do aluno logo abaixo do `<h1>` (h1 continua genérico em `:16`) | #160 |
| 270 | Baixa | Alunos e turmas | aberto | parcial | `alunos/[id]/agenda-aditivo/page.tsx:16` h1 `text-2xl` sem `font-medium` (peso 500 vem da base em `app/globals.css:143-153`); `:20` link `className="underline"` sem `text-brand-700`. Reclassificação, sem código novo | — (regra base do ganho rápido 9, `e9b1c29d`, anterior ao doc 43) |
| 283 | Baixa | Alunos e turmas | parcial | resolvido | `alunos/[id]/creditos/[creditoId]/page.tsx:32` cobrança de origem por código · tipo · vencimento; `:33` aplicação/decisão remetidas ao acerto, sem UUID; `PropostaUsoCredito.tsx:20-22` cobrança por código; valores com `formatarMoeda` | #160 |
| 312 | Média | Alunos e turmas | aberto | aberto | `alunos/[id]/movimentacoes/NovaPausa.tsx:68` botão "Registrar proposta…" só `disabled={ocupado}`; pendências listadas em `:66` sem aviso junto ao botão | — |
| 326 | Média | Alunos e turmas | resolvido | resolvido | `alunos/[id]/portal/painel.tsx:53` `rotular(SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL, troca.situacao)` | #138 (antes) |
| 327 | Baixa | Alunos e turmas | resolvido | resolvido | `alunos/[id]/portal/painel.tsx:51-53` todos os botões com `botaoClasses` (primário/secundário/perigo) | #114/#135 (antes) |
| 377 | Média | Secretaria | aberto | aberto | `secretaria/reservas/ConferirReserva.tsx:51-57` resultado só em `acao.sucesso` local; `secretaria/reservas/page.tsx:31` desmonta o componente quando `podeConferir` vira falso após o refresh | — |
| 378 | Média | Secretaria | aberto | aberto | `secretaria/reservas/page.tsx:28` " · Prazo vencido" concatenado no fim da linha de prazo/fuso, sem destaque | — |
| 381 | Baixa | Secretaria | aberto | aberto | `secretaria/reservas/page.tsx:14` erro devolve só `VoltarPara` + alerta, sem `<h1>`, sem as `<nav>` e sem "Tente novamente" | — |
| 394 | Baixa | Secretaria | aberto | aberto | `secretaria/reservas/[id]/Formularios.tsx:30` date/time sem `min` nem `defaultValue`; prazo atual só fora do formulário em `secretaria/reservas/[id]/page.tsx:18` | — |
| 408 | Baixa | Secretaria | aberto | aberto | `secretaria/reservas/particulares/[id]/page.tsx:16` `<h1>Resolução da reserva particular</h1>` sem aluno nem matrícula; identificação só via link em `:21` | — |
| 419 | Média | Secretaria | aberto | resolvido | `secretaria/desistencias/page.tsx:32` `PaginacaoFila` com "← Anterior" e "Próxima →" reais (cursor `antes`/`depois` em `server/matricula/desistencia-administrativa-fila.ts:106-107`) | #158, #161 |
| 420 | Média | Secretaria | aberto | aberto | `secretaria/desistencias/page.tsx:27-30` as quatro frases longas continuam sem marcador curto | — |
| 434 | Média | Secretaria | parcial | parcial | `secretaria/envios-portal/ConciliacaoEnvio.tsx:25` botões com `botaoClasses` (primário vs secundário), mas os dois `CampoTexto` seguem `className="block w-full border"` sem raio nem padding | — |
| 445 | Média | Secretaria | aberto | aberto | `secretaria/avisos-agenda/page.tsx:33` `<li>` de avisos só com aluno, canal, situação e data; sem link à matrícula nem referência ao encontro (as pendências têm link) | — |
| 504 | Baixa | Matrículas — entrada | resolvido | resolvido | `matriculas/[id]/reserva/ReservarFormulario.tsx:17` CampoTexto `minLength={5}` exibe "Mínimo 5 caracteres · x/2000" | #121 (antes) |
| 515 | Média | Matrículas — entrada | aberto | aberto | `matriculas/[id]/nova-reserva/Formulario.tsx:29` `invalidar()` zera revisão/conferido sem mensagem; chamado nos campos em `:71-74` | — |
| 534 | Média | Matrículas — entrada | aberto | aberto | `matriculas/[id]/preparacao/DecidirPreco.tsx:23` Aprovar desabilitado por `!podeAprovar` sem motivo; `:22` CampoTexto sem `minLength` (só contador x/2000, sem "mínimo 5") | — |
| 536 | Média | Matrículas — entrada | aberto | aberto | `matriculas/[id]/preparacao/page.tsx:25` link "Pedido de desistência da preparação" logo após o cabeçalho, mesmo estilo de `:59` | — |
| 549 | Média | Matrículas — entrada | parcial | resolvido | `matriculas/[id]/emissao/page.tsx:23` conferência por `formatarInstanteExibicao` com fuso e origem; vencimentos `formatarDataCivil` em `:23` e `:32` | #159 |
| 551 | Média | Matrículas — entrada | aberto | aberto | `matriculas/[id]/emissao/page.tsx:32` plano ainda em `<ul>` com tipo/valor/vencimento/etapa/cobertura/minutos concatenados por "·", sem total | — |
| 567 | Baixa | Matrículas — entrada | aberto | aberto | `matriculas/[id]/pagador/PagadorFormulario.tsx:66` telefone com `pattern` e só placeholder; sem `title` nem texto auxiliar | — |
| 582 | Média | Matrículas — entrada | parcial | resolvido | `matriculas/[id]/entrada-particular/page.tsx:19` "Matrícula {codigo ?? "sem código"}" (sem UUID); vencimento `formatarDataCivil` em `:27` | #160 |
| 583 | Baixa | Matrículas — entrada | aberto | aberto | `matriculas/[id]/entrada-particular/page.tsx:25` `role="alert"` por pendência; resumo em `:20` sem `role` | — |
| 603 | Média | Matrículas — contrato | aberto | aberto | `matriculas/[id]/contrato/page.tsx:30-36` só VoltarPara, h1, links e parágrafo genérico; nenhuma etapa do contrato (prévia/envio/assinatura/aceite) | — |
| 608 | Baixa | Matrículas — contrato | resolvido | resolvido | `matriculas/[id]/page.tsx:10-18` hub "Seções da matrícula"; `matriculas/[id]/layout.tsx:32-41` cabeçalho com link ao hub e abas; `contrato/page.tsx:31` VoltarPara | #90 (antes) |
| 630 | Média | Matrículas — contrato | aberto | aberto | `matriculas/[id]/contrato/previas/[previaId]/participantes/Formulario.tsx:45` só `issues[0]?.message`; erro em `:75` depois do fieldset, sem `aria-invalid` por campo nem foco | — |
| 645 | Baixa | Matrículas — contrato | aberto | aberto | `matriculas/[id]/contrato/originais/[artefatoId]/page.tsx:49-50` PDF com `target="_blank"`; "Baixar auditoria preservada" sem `download` nem formato | — |
| 654 | Média | Matrículas — contrato | aberto | aberto | `matriculas/[id]/contrato/substituicoes/page.tsx:30` frase única; sem `d.fonte.estado` nem link para o original | — |
| 682 | Média | Matrículas — contrato | aberto | aberto | `matriculas/[id]/contrato/aditivos/page.tsx:25-27` nenhum link para `aditivos/agenda` (nem em `Formularios.tsx`); `?agenda=` só lido em `:20` | — |
| 693 | Média | Matrículas — contrato | aberto | aberto | `matriculas/[id]/contrato/aditivos/[propostaId]/page.tsx:33-51` seções em sequência plana; nenhum `AndamentoAditivo` | — |
| 705 | Baixa | Matrículas — contrato | aberto | resolvido | `matriculas/[id]/contrato/aditivos/[propostaId]/alcadas/Formulario.tsx:28` `FeedbackAcao` separa erro (`role="alert"`, vermelho) de sucesso (`role="status"`, verde) | #153 |
| 718 | Média | Matrículas — contrato | parcial | parcial | `matriculas/[id]/contrato/aditivos/[propostaId]/originais/[artefatoId]/page.tsx:68-69` estado rotulado e ambiente teste/produção; `Fornecedor: {processo.fornecedor}` e `{conclusao.fornecedor}` crus | #138 (antes) |
| 762 | Média | Matrículas — ciclo | parcial | parcial | `matriculas/[id]/desistencia/page.tsx:23` ainda `return <p role="alert">` solto, sem h1 nem "Tentar de novo"; o layout `matriculas/[id]/layout.tsx:26` só dá casca quando há cabeçalho; não há `matriculas/[id]/error.tsx` (só o `error.tsx` raiz, que não é acionado porque a página não lança); o mesmo padrão segue em ~20 páginas do lote | — |
| 776 | Média | Matrículas — ciclo | aberto | resolvido | `matriculas/[id]/desistencia/administracao/DecisaoFormulario.tsx:34` usa `FeedbackAcao`: erro em `role="alert"` vermelho (`components/FeedbackAcao.tsx:29`), sucesso em região polite verde (`:36`) | #153 |
| 778 | Baixa | Matrículas — ciclo | aberto | aberto | `matriculas/[id]/desistencia/administracao/page.tsx:32` h3 só "Versão N · registrador"; `server/matricula/desistencia-administrativa.ts` não seleciona `criadoEm` (nenhuma ocorrência) | — |
| 829 | Média | Matrículas — ciclo | parcial | parcial | `matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx:69` status rotulados e valores com `formatarMoeda`, mas o fundamento continua em parágrafos corridos (sem `<dl>`) com IDs crus de reserva, consumo, compra e documento | — |
| 857 | Média | Matrículas — ciclo | resolvido | resolvido | `matriculas/[id]/compensacoes/[cobrancaId]/periodo-integral/PeriodoIntegral.tsx:142` início controlado por `useInicioDoPeriodo` e `min={periodo.min}` no fim | #78 (antes) |
| 869 | Baixa | Matrículas — ciclo | aberto | aberto | `matriculas/[id]/condicoes/CondicoesFormulario.tsx:27` dia de vencimento `min=1 max=31` sem texto sobre meses com menos dias; a ajuda da linha 25 cobre só a cobertura | — |
| 879 | Média | Matrículas — ciclo | aberto | aberto | `matriculas/[id]/condicoes-horas/CondicoesHoras.tsx:23,49-55` preço começa `""` e antecedência, data, hora e cláusulas sem `defaultValue`; nada copiado de `d.versoes[0].regras` | — |
| 924 | Baixa | Matrículas — ciclo | aberto | resolvido | `matriculas/[id]/autorizacoes-comunicacao/page.tsx:32` usa `Paginacao` com "← Anterior · Página N · Próxima →" (`components/Paginacao.tsx:25-27`) | #158 |
| 937 | Média | Matrículas — ciclo | aberto | aberto | `matriculas/[id]/indisponibilidade-oferta/RelatosIndisponibilidadeOferta.tsx:40` `{d.podeRegistrar && <form…>}` sem ramo alternativo; nenhuma explicação quando falso | — |
| 1037 | Média | Acadêmico — base | aberto | resolvido | `academico/admissoes/excecoes/[reservaId]/page.tsx:22-24,38` criação, prazo, encontros e histórico via `formatarInstanteExibicao(…, fusoExibicao, "UTC")` com "(fuso; origem UTC)"; limite de entrada como data civil | #159 |
| 1047 | Média | Acadêmico — base | aberto | aberto | `academico/calendario/page.tsx:29` só link "Versões anteriores" por cursor; sem "Anterior" nem link para a primeira página | — |
| 1084 | Média | Acadêmico — base | aberto | aberto | `academico/calendario/[id]/replanejamento/EditorRevisao.tsx:47-51,56` ao escolher o encontro não aparece data/hora atual; novo ajuste nasce com `data: ""`, `horario: ""` | — |
| 1157 | Média | Acadêmico — base | aberto | aberto | `academico/regras/[nivelId]/Formularios.tsx:23` `replace(",", ".")` troca só a primeira vírgula; `:46,49-50,59` campos `inputMode="decimal"` sem `pattern`/`title` nem validação no `onBlur` | — |
| 1170 | Média | Acadêmico — base | aberto | aberto | `academico/regras/turmas/[turmaId]/page.tsx:21-24` alterações só em prosa ("Campos alterados: …") e dois `ResumoRegra` completos lado a lado, sem destaque nem tabela antes/depois | — |
| 1207 | Média | Acadêmico — base | aberto | aberto | `academico/modalidades/[id]/quantidade/AlterarQuantidadeAulas.tsx:21` impactos em `<li>` com `<strong>`/`<br/>`/`<span>` concatenando causa e pendências; sem tabela nem contador de turmas com pendência | — |
| 1209 | Baixa | Acadêmico — base | aberto | aberto | `academico/modalidades/[id]/quantidade/AlterarQuantidadeAulas.tsx:20` sucesso ainda faz `window.location.assign(...)` | — |
| 1258 | Baixa | Acadêmico — base | aberto | aberto | `academico/reposicoes/correcoes/[reposicaoId]/CorrecoesConclusaoReposicao.tsx:139` "Retirar a conclusão, sem nova fonte" segue como primeira `<option>` do mesmo `<select>`; sem fieldset de radio nem alerta do efeito | — |
| 1259 | Baixa | Acadêmico — base | aberto | aberto | `academico/reposicoes/correcoes/[reposicaoId]/page.tsx:44-46` "Conclusão seguinte" antes de "Conclusão anterior"; sem "Versão N de M"; "Correções anteriores" (`:48`) sem distinção visual | — |
| 1300 | Média | Acadêmico — avaliações | aberto | aberto | `academico/avaliacoes/[alocacaoId]/page.tsx:57,62` `<li>{rótulo}: {n}.</li>` das pendências operacionais e de segunda chamada, sem `<Link>` para resolver | — |
| 1316 | Média | Acadêmico — avaliações | aberto | aberto | `academico/avaliacoes/[alocacaoId]/[codigo]/Formularios.tsx:66` sucesso fixo "Versão registrada. A submissão exige conferência…" mesmo com `modo=rascunho` (`:85`) | — |
| 1328 | Média | Acadêmico — avaliações | aberto | resolvido | `academico/avaliacoes/[alocacaoId]/[codigo]/designacao/Formulario.tsx:75` `FeedbackAcao` (erro `role="alert"` vermelho / sucesso polite verde); `:51` limpa campos sem remontar; `designacao/page.tsx:33` sem `key` de versão | #153, #155 |
| 1342 | Baixa | Acadêmico — avaliações | resolvido | resolvido | `academico/avaliacoes/[alocacaoId]/equivalencia/page.tsx:16` `notFound()` cai em `(app)/not-found.tsx:8-16` dentro do shell; mensagem genérica e volta para /home, sem not-found próprio do segmento | #64 (antes) |
| 1353 | Média | Acadêmico — avaliações | resolvido | resolvido | `academico/avaliacoes/[alocacaoId]/extras/page.tsx:25` e `extras/Formularios.tsx:24` `rotular(HABILIDADE_LABEL, …)` no título e no select | #138 (antes) |
| 1354 | Média | Acadêmico — avaliações | aberto | aberto | `academico/recuperacoes/planos/[propostaId]/Formularios.tsx:23` `if (!r.ok) setErro(r.erro); else router.refresh();` sem sucesso nem `reset()` | — |
| 1368 | Baixa | Acadêmico — avaliações | aberto | aberto | `academico/avaliacoes/[alocacaoId]/fechamento/ExcecaoFrequencia.tsx:21-26` tipo sem `percentual`/`minimoPercentual`; bloco de decisão `:140-157` sem os números (só em `fechamento/page.tsx:75`) | — |
| 1428 | Média | Acadêmico — avaliações | aberto | aberto | `academico/equivalencias/page.tsx:19` sem `matriculaId` só `VoltarPara` + "Selecione uma matrícula…", sem busca nem redirect; `lib/nav.ts` sem `/academico/equivalencias` | — |
| 1441 | Baixa | Acadêmico — avaliações | aberto | aberto | `academico/equivalencias/[propostaId]/page.tsx:94` células "Conferir regra preservada" / "Fonte preservada a conferir" | — |
| 1469 | Baixa | Acadêmico — recuperações | parcial | resolvido | `academico/recuperacoes/page.tsx:31` `<Paginacao>` numerada com "← Anterior" real (`components/Paginacao.tsx:25`); `:29` "Ir para a primeira página" na página vazia | #158 |
| 1494 | Baixa | Acadêmico — recuperações | aberto | aberto | `academico/recuperacoes/correcoes/[notaId]/Formularios.tsx:36` "{n} plano(s) aprovado(s) de recuperação vinculado(s)" | — |
| 1506 | Média | Acadêmico — recuperações | aberto | aberto | `academico/recuperacoes/AgendaPublicada.tsx:27,31` `CampoFuso` e botão "Atualizar situação" por item; instanciado em `designadas/page.tsx:24` sem modo compacto | — |
| 1529 | Média | Acadêmico — recuperações | aberto | aberto | `academico/recuperacoes/planos/autorizacoes-preparacao/page.tsx:14` `alocacaoId` vazio via `lerTexto`; `:19` erro como `<p role="alert">` solto, sem cabeçalho nem volta para os planos | — |
| 1556 | Média | Acadêmico — recuperações | parcial | parcial | `academico/recuperacoes/planos/[propostaId]/autorizacao-reserva/page.tsx:34` situação com `STATUS_MATRICULA_LABEL`; `:36` e `:42` "nas condições atuais" sem motivo específico | #138 (antes) |
| 1605 | Média | Acadêmico — recuperações | aberto | aberto | `academico/recuperacoes/tentativas/[itemReservaId]/agenda/page.tsx:28` `ProporAgenda` sem `PreviaAgenda`; conflitos só em `:37` (pendências após guardar) | — |
| 1616 | Média | Acadêmico — recuperações | aberto | aberto | `academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/page.tsx:36-40` histórico com "Prazo até…" igual para todas, sem vigente/expirada | — |
| 1617 | Média | Acadêmico — recuperações | aberto | aberto | `academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/page.tsx:29` `VoltarPara` href `…/designacao` com rótulo "Tentativa" | — |
| 1645 | Baixa | Acadêmico — recuperações | aberto | resolvido | `designacao/propostas/page.tsx:26` e `PreviaSubstituicao.tsx:28` `<h2 className="text-xl">` sem a classe, mas o peso 500 vem da regra base de `globals.css:143-153` (h1–h6); o título renderiza no padrão da área. Reclassificação, sem código novo | — (regra base do ganho rápido 9, `e9b1c29d`, anterior ao doc 43) |
| 1687 | Média | Acadêmico — segundas chamadas | aberto | parcial | `academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/autorizacoes/Formulario.tsx:27-28,39` sucesso "Realização especial autorizada." via FeedbackAcao (role="status", separado do erro), mas sem `form.reset()`, sem o prazo na mensagem e sem foco na mensagem | #153 |
| 1698 | Baixa | Acadêmico — segundas chamadas | resolvido | resolvido | `lib/labels.ts:278` mapa único `STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL`, usado em `historico/page.tsx:32`, `agendas/page.tsx:13` e `minhas/page.tsx:28` | #138 (antes) |
| 1723 | Média | Acadêmico — segundas chamadas | aberto | aberto | `academico/segundas-chamadas/pendentes-agenda/page.tsx:38` "Prazo atual: ..." segue em texto corrido junto da situação; sem badge de urgência nem filtro `?urgencia` | — |
| 1748 | Média | Acadêmico — segundas chamadas | aberto | aberto | `academico/segundas-chamadas/minhas/[reservaId]/Formulario.tsx:64` nota com `inputMode="decimal"` sem type=number/min/max/step; `onSubmit` (:48-58) não valida a escala nem marca aria-invalid | — |
| 1765 | Baixa | Acadêmico — segundas chamadas | aberto | aberto | `academico/segundas-chamadas/propostas/[propostaId]/agenda/page.tsx:53` mesma frase "Proposta histórica sem referência de calendário; ela pode ser rejeitada, mas exige nova proposta…" | — |
| 1788 | Média | Acadêmico — segundas chamadas | resolvido | resolvido | `academico/segundas-chamadas/reservas/[reservaId]/cancelamento/page.tsx:18` `rotular(STATUS_ENCONTRO_LABEL…)` e `rotular(STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL…)` | #138 (antes) |
| 1800 | Média | Acadêmico — segundas chamadas | aberto | resolvido | `academico/segundas-chamadas/reservas/[reservaId]/remarcacao/Formulario.tsx:54` `CampoFuso` com `padrao={fusoInicial}`, que `page.tsx:61` preenche por `fusoInicialDeEntrada(fusoInstitucional, preferência)`; validação IANA no próprio campo | #159 |
| 1803 | Média | Acadêmico — segundas chamadas | aberto | aberto | `academico/segundas-chamadas/reservas/[reservaId]/remarcacao/Formulario.tsx:56` rótulo "Justificativa de exceção não letiva, se o horário a atingir" inalterado; campo sempre visível | — |
| 1804 | Baixa | Acadêmico — segundas chamadas | aberto | aberto | `academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx:44` ramo de erro devolve `<p role="alert">` solto, sem link "Acadêmico" nem identificação | — |
| 1836 | Média | Diário de aulas | aberto | aberto | `diario/DiarioAulas.tsx:153` Cancelar = `onClick={() => { consulta.current++; setAberto(false); }}` sem confirmação (a #155 só protege a troca de data, :142-143) | — |
| 1839 | Média | Diário de aulas | aberto | resolvido | `diario/layout.tsx:18` sub-seções viram `SubTabs` (secoes.ts); `diario/page.tsx:18` restou um único link `inline-block` | #143 |
| 1854 | Baixa | Diário de aulas | aberto | aberto | `diario/encontros/page.tsx:29` link de paginação ainda "Próximos encontros" | — |
| 1890 | Média | Diário de aulas | aberto | aberto | `diario/encontros/[id]/remarcacao/RemarcacaoParticular.tsx:31` botão "Conferir e submeter proposta" registra direto; conferência só no cartão criado (:37-38) | — |
| 1913 | Média | Diário de aulas | parcial | parcial | `diario/encontros/[id]/gravacao/page.tsx:9,13` `VoltarPara href="/diario"`, mas a mensagem segue sem próximo passo nem link para `/diario/encontros/{id}` | — |
| 1925 | Média | Diário de aulas | resolvido | resolvido | `diario/pendencias/page.tsx:30` `border-amber-200 bg-amber-50 … text-amber-700` (shades mapeadas) | #67 (antes) |
| 1952 | Média | Diário de aulas | aberto | aberto | `diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx:22` `<MensagemStatus texto={feito} />` e `<p role="alert">` continuam no fim da seção, após a lista de propostas | — |
| 1966 | Baixa | Diário de aulas | aberto | aberto | `diario/excecoes-gravacao/page.tsx:28` `<h2>{p.professor} · {exibicao.texto}</h2>` sem turma nem resumo antes do `<details>` (:30) | — |
| 1980 | Baixa | Diário de aulas | aberto | aberto | `diario/reposicoes/ReposicaoDocente.tsx:26,34` `<h1 className="text-xl font-medium">` nos cartões, junto do `<h1>` de `reposicoes/page.tsx:18` | — |
| 2018 | Média | Financeiro | aberto | aberto | `financeiro/FilaCobranca.tsx:236-240,360` "Aprovar e enviar lote" chama `enviarLote` → `aprovarLoteCobranca` direto; ConfirmarAcao (:451) só cobre o envio individual | — |
| 2021 | Média | Financeiro | resolvido | resolvido | `financeiro/FilaCobranca.tsx:646,710` só shades mapeadas (`text-amber-800`, `bg-amber-600`, `bg-success`, `border-danger`); sem `text-red-800`/`text-blue-800`/`-500` fora do mapa (`tailwind.config.ts:48-51`) | #67 (antes) |
| 2031 | Baixa | Financeiro | parcial | parcial | `financeiro/acertos-taxa/` sem `loading.tsx`/`error.tsx`; só os genéricos `(app)/loading.tsx` e `(app)/error.tsx` (sem link "Voltar ao Financeiro") | #64 (antes) |
| 2041 | Média | Financeiro | aberto | resolvido | `financeiro/acertos-taxa/DecisaoTaxa.tsx:37` e `ImpactosTaxaOperacao.tsx:42` usam `FeedbackAcao` (erro `role="alert"` vermelho, sucesso em região polite verde) | #153 |
| 2079 | Média | Financeiro | aberto | aberto | `financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx:27,30` sem versão ou com falha devolve `<p>` solto, sem `VoltarPara`/h1 nem link ao aditivo (cabeçalho só em :36-37) | — |
| 2082 | Baixa | Financeiro | parcial | parcial | `financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx:47` título "Proposta de <instante> · <rótulo>": sem id cru e com data, mas sem autor nem "v<N>" | #160 |
| 2130 | Média | Financeiro | aberto | aberto | `financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx:33` `<select name="decisao">` começa em "Aprovar e aplicar", sem opção vazia nem `required` | — |
| 2133 | Baixa | Financeiro | aberto | aberto | `financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx:116` `CampoTexto` de Motivo/Evidência do complemento sem `className` nem `rows` (CampoTexto não aplica classe padrão) | — |
| 2145 | Média | Financeiro | resolvido | resolvido | `financeiro/permuta/PermutaOperacional.tsx:134,147,155` saldo, limite e valor aplicados com `formatarMoeda` | #93 (antes) |
| 2187 | Média | Comercial | parcial | parcial | `leads/LeadsLista.tsx:116,168-170,189-192` busca, contagem e vazio distinto; `:177-182` `th` estáticos, sem ordenação por coluna | #95 (antes) |
| 2190 | Média | Comercial | parcial | parcial | `leads/(lista)/loading.tsx` e `(app)/error.tsx` ("Tentar de novo"/reset) existem; `leads/[id]/` sem `loading.tsx` próprio (só `layout.tsx`) | #64/#81 (antes) |
| 2206 | Média | Comercial | aberto | aberto | `leads/[id]/FichaLead.tsx:383-394` `<select value="">` executa `moverEtapa` no `onChange` | — |
| 2207 | Média | Comercial | resolvido | resolvido | `leads/[id]/FichaLead.tsx:782-783` `border-blue-200` (mapeado) e título `text-blue-700` | #67 (antes) |
| 2219 | Baixa | Comercial | aberto | aberto | `leads/[id]/contratacao/page.tsx:22` lista de ofertas como `<Link className="underline">` sem destaque nem `aria-current`; seleção só no h2 de :24 | — |
| 2244 | Média | Comercial | aberto | aberto | `carteiras/CoberturasPainel.tsx:25,36` "Revogar" chama `revogar(c.id)` → `revogarCobertura` num clique, sem confirmação | — |
| 2271 | Média | Comercial | resolvido | resolvido | `empresas/EmpresasCliente.tsx:123-178` busca, situação e colunas ordenáveis; `server/empresas/consultas.ts:39-42` `orderBy` da URL, `skip`/`take` | #98/#136 (antes) |
| 2272 | Baixa | Comercial | aberto | aberto | `empresas/EmpresasCliente.tsx:89` toggle `setCriando((v) => !v)` com rótulo fixo "Nova empresa", sem `aria-expanded` | — |
| 2303 | Baixa | Comercial | resolvido | resolvido | `inbox/AtendimentosPainel.tsx:112,127` revisão de falha usa `FeedbackAcao` com erro e sucesso separados | #87 (antes) |
| 2326 | Baixa | Configuração | parcial | parcial | `configuracao/layout.tsx:16-19` h1 "Configuração" e subtítulo fixos (trilha fica no shell, #99); `configuracao/contratos/[codigo]/page.tsx:29` mantém link ad hoc "Todos os modelos" em vez de `VoltarPara` | — |
| 2354 | Média | Configuração | aberto | aberto | `configuracao/contratos/page.tsx:14` só "última versão N, M versões registradas", sem badge de estado; `server/contratos/modelos.ts:50-52` `groupBy` por código sem `decisao` nem ordenação por "aguardando" | — |
| 2430 | Média | Configuração | parcial | parcial | `configuracao/paises/PaisesPainel.tsx:200-202` `checked` ainda vem de `p.produtosOferecidos` (props) e só muda após `router.refresh()`; checkbox desabilitado durante a ação, sem estado otimista | — |
| 2431 | Média | Configuração | aberto | aberto | `configuracao/paises/PaisesPainel.tsx:171-177` "Ativar" só desabilita com `acao.ocupado`; moeda/documento/preço não aparecem na linha nem no `title` | — |
| 2432 | Baixa | Configuração | aberto | aberto | `configuracao/paises/PaisFormulario.tsx:15,151-153` `<option>` renderiza `{v}` direto de `VALIDADORES` (slugs crus `cpf`, `cedula_cr`...) | — |
| 2458 | Baixa | Configuração | aberto | aberto | `configuracao/operacao/avisos-diario/page.tsx:12` `<h1 className="text-2xl">` abaixo do `<h1>` do layout (`configuracao/layout.tsx:16`) | — |
| 2486 | Média | Configuração | aberto | aberto | `configuracao/migracao/[loteId]/page.tsx:24` lista única de linhas; pendências (`text-amber-800`) e colisões (`text-red-700`) no fim de cada `<li>`, sem contadores, filtros nem ordenação | — |
| 2501 | Média | Configuração | aberto | aberto | `configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx:15` select "Participação" abre em `<option value="PRESENTE">`, sem opção vazia; validação em `:14` aceita o padrão | — |
| 2519 | Média | Configuração | parcial | parcial | `configuracao/whatsapp/TemplatesPainel.tsx:59` `useAvisoAoSair` só no editor de templates; Política, Comercial, Números, Avisos da agenda e Régua sem aviso ao sair nem indicador "alterações não salvas" (uma rota por seção desde #100) | #155 |
| 2553 | Média | Público e portal | aberto | aberto | `app/login/page.tsx:33` `router.push("/home")` fixo; `server/_shared/sessao.ts:140,147` `redirect("/login")` sem `callbackUrl` | — |
| 2567 | Média | Público e portal | aberto | aberto | `app/pagar/[token]/PagarCliente.tsx:23-24` `status === "PAGO" ? "pago" : "aberto"`; cancelada/vencida exibida como aberta | — |
| 2572 | Baixa | Público e portal | aberto | aberto | `app/pagar/[token]/page.tsx:1-9` sem `export const metadata` nem `robots`; nenhuma regra noindex em `app/pagar` | — |
| 2584 | Baixa | Público e portal | aberto | aberto | `app/certificado/[codigo]/page.tsx:19` "Certificado autêntico ✅" com emoji, sem ícone Tabler | — |
| 2606 | Média | Público e portal | aberto | aberto | `app/portal-aluno/sair.tsx:8` `await fetch(...)` sem checar `ok` nem `catch`; `router.replace` sempre | — |
| 2652 | Média | Público e portal | aberto | parcial | `app/portal-aluno/preferencias-formulario.tsx:22-23` `CampoFuso` segue input + datalist (rótulos nas opções, sem select/"Outro fuso"); erro virou "Não reconhecemos esse fuso. Escolha um da lista..." (`server/operacao/fuso.ts:14`), mas a dica ainda cita "identificador IANA" | #159 |
| 2682 | Média | Público e portal | resolvido | resolvido | `app/portal-aluno/reposicoes/[id]/page.tsx:65` matrícula via `rotular(STATUS_MATRICULA_LABEL)`; `relatar-indisponibilidade.tsx:53` situação rotulada; consequência da matrícula não ativa em `page.tsx:61` (só para o relato) | #138/#93 (antes), #160 |
| 2709 | Média | Público e portal | aberto | parcial | `preferencias/FusoExibicaoFormulario.tsx:25-26` `CampoFuso` input + datalist (sem select/"Outro"); erro reescrito via `MSG_FUSO_NAO_RECONHECIDO`; dica ainda diz "identificador IANA" | #159 |
| 2712 | Baixa | Público e portal | parcial | parcial | `preferencias/FusoExibicaoFormulario.tsx:27` sucesso via `FeedbackAcao`; botão "Salvar preferência" ainda `variante: "secundario"` | #87 (antes) |

#### 7.3.6 Casos limítrofes e decisões

- **Reclassificações (L270, L1645).** Não houve mudança de código. O doc 43 cobrava `font-medium` na classe, mas a regra base de `globals.css` já dá peso 500 a h1–h6 desde antes da medição. Os dois achados ficaram assim:
  - L1645 pedia só o peso, então passou a resolvido;
  - L270 também pedia cor de marca no link, então ficou parcial.
- **Resolvidos com redação diferente da sugerida:**
  - **L268:** o nome do aluno aparece num bloco `IdentificacaoRegistro` logo abaixo do `<h1>`, e não no próprio `<h1>`.
  - **L582:** o texto que sobra quando falta o código é "sem código", e não "em preparação".
  - **L283:** nenhum UUID aparece mais na tela, mas o id não foi para `title`.

  Nos três casos, o defeito descrito não ocorre mais.
- **L1800 (resolvido) e L2652/L2709 (parciais).** O `CampoFuso` (#159) continua sendo input + datalist, por decisão registrada em `components/CampoFuso.tsx:14-17`.
  - Na remarcação, o defeito era o campo vazio com erro só no servidor. Agora o campo vem pré-preenchido com o fuso da escola ou a preferência e é validado no cliente.
  - No portal e em `/preferencias`, a recomendação era um `<select>` com "Outro fuso". A filtragem do datalist por `value` no Firefox/Safari continua, e a dica ainda diz "identificador IANA".
- **L1469 (resolvido).** Com itens na lista, não há link "Primeira página", mas há "← Anterior" página a página, o que elimina o "só avança".
- **L1342.** Foi mantido resolvido. O 404 fica dentro do shell, mas a mensagem é genérica e volta para `/home`. É limítrofe com parcial.
- **Arquivos tocados sem mudar o veredito:** L515, L879, L937, L1084, L1209, L1836, L2079 e L2082. As PRs #153, #155, #159 e #160 mexeram nesses arquivos por outros motivos, e o defeito apontado não mudou.
- **Vistos de passagem, fora da amostra:**
  - `recuperacoes/page.tsx:27` imprime `{item.estado}` cru;
  - `designadas/page.tsx:23` mostra `i.matriculaId` cru quando falta o código;
  - o emoji ✅ aparece também em `app/pagar/[token]/PagarCliente.tsx:58`.

#### 7.3.7 Como reproduzir

```
node scripts/medicao-ux/amostra.mjs 6 3 42      # a mesma amostra de 126
```

O cálculo usou `estimativaEstratificada` (`scripts/medicao-ux/nucleo.mjs:247`), com as populações por área × severidade de `achadosDoRepositorio()`. Com a coluna "veredito antigo", ele devolve exatamente os 71,1% (63,1–79,2%) do doc 43. Com a coluna "veredito novo", devolve os 58,9% (50,3–67,5%) acima.

### 7.4 Correções a esta medição

Erros ou imprecisões das seções 3–5, achados na remedição. As seções 1–6 não foram reescritas; a correção vale a partir daqui.

- **L1070 (§4.1).** A evidência diz que o botão desabilitado "não remete ao replanejamento". Mas a página já tinha, desde `afc9a42d` (16/09, antes da base), o link "Conferir proposta de novas datas e conflitos" para `/replanejamento` (`calendario/[id]/page.tsx:35`). O status "aberto" continua certo por outro motivo: a contagem de encontros `PREVISTO` segue sem filtro de calendário ou turma (`page.tsx:18`), e o bloco de decisão continua oferecendo o botão desabilitado (`:42`).
- **L577 (§4.1).** A evidência cita só `entrada-particular`. O achado do doc 42 inclui o mesmo link morto para `/financeiro` em `matriculas/[id]/emissao/page.tsx:23`, no ramo EMITIDA, cuja guarda é só SECRETARIA_ACADEMICA (`:13`). Esse link continua lá, e por isso o achado fica parcial depois da #160, e não resolvido.
- **L1059 (§4.1).** "Nenhum `beforeunload`" estava certo em 07/10. A #155 criou o `useAvisoAoSair`, mas ele cobre só F5, fechar a aba e sair do site. O cenário do doc 42 (o link interno "Voltar ao calendário" ou a Sidebar) ainda perde tudo em silêncio, e o próprio código registra isso como pendência (`src/lib/aviso-ao-sair.ts:12-13`). Por isso L1059 conta como parcial, e não como resolvido. O mesmo vale para L2367.
- **L1901 (§4.1).** A evidência diz que as cores fora do mapa foram removidas pela #67. As bordas `border-blue-200` e `border-green-200` continuam em `CorrecaoAula.tsx:364,366`, em vez dos `border-brand-200`/`border-gray-200` pedidos. Elas passam porque `blue.200` e `green.200` foram mapeados em `tailwind.config.ts:49,52` (#67). O status "resolvido" está certo; a evidência é que estava imprecisa.
- **L270 e L1645 (§5.1).** Os dois receberam "aberto" por faltar `font-medium` na classe do título. Mas o peso já vinha da regra base de `globals.css:143-153` (ganho rápido 9, `e9b1c29d`, anterior ao doc 43), que dá peso 500 a h1–h6, como a própria seção 3 registra em "Headings sem `font-medium`". L1645 pedia só o peso e passa a resolvido. L270 também pedia cor de marca no link e fica parcial. É reclassificação, sem código novo; sem ela, a estimativa de abertos seria 59,8% (§7.3).
- **Atribuições erradas a PRs (§3).**
  - A regra global de `focus-visible` (7.4, "✅ (#71)") e o token `--border-control` ("token novo da #71") vieram da #65/#66 (`373dc1de`), e não da #71, que nem toca `globals.css`. A #65 chegou à `main` pelo merge da #66 (doc 44 §3).
  - A trava `responsivo.test.ts`, citada junto da #75 (7.5), nasceu na #94.

  Detalhes no doc 44 §7.1.
- **Ressalvas sem mudança de status.**
  - **L2269:** a coluna virou "Faturas a receber", e não "Faturas a pagar", como recomendado; a ficha usa "Fechada — a pagar" para o mesmo status (`src/lib/labels.ts:455`).
  - **L2229:** a validação no cliente de "Outro exige observação", também recomendada, nunca foi feita.
  - **L2297:** além de o pagamento não prometer pausa, o retorno de `marcarConversaTratada` não é lido nem na promessa nem no pagamento (`InboxCliente.tsx:538-540` e `:600-605`), então uma recusa da action (`ok: false`) passa sem aviso.

### 7.5 O que falta (atualiza a §6)

**Itens da §6 em `e5418550`:**

| Item da §6 | Situação | PR | O que resta |
|---|---|---|---|
| 1. `ConfirmarAcao` nas ações irreversíveis | entregue a fatia A (efeito externo ou financeiro) | #154 | **Fatia B, sem confirmação** (`src/app/confirmacoes-mapa.ts:11-13`): encerrar país, "Faltou" no check-in, vincular contato e opt-out na inbox, aprovar replanejamento, quantidade de aulas e presença histórica, desativar usuário, preço e idioma, e inativar empresa. "Aprovar e enviar lote" da fila de cobrança também vai direto (L2018 da amostra), e `enviarLote` não tem `try/catch`. Na ativação do WhatsApp, falta a estimativa numérica de alcance (L2517) |
| 2. Erro e sucesso separados | entregue | #153 | 40 de 172 fluxos (23%) ainda terminam só em `router.refresh()`, longe da meta de < 10%. O `catch` de `ConferenciaRegraHistorica` e os `window.location.reload()` de `SegundaChamadaPainel` e `DecidirQuantidadeAulas` já foram corrigidos (L1183, L1671, L1219), mas `AlterarQuantidadeAulas.tsx:20` ainda faz `window.location.assign` no sucesso (L1209 da amostra) |
| 3. Não perder o que foi digitado | entregue | #155 | 17 formulários com versão no `key` (exceções `VERSAO_PENDENTE`, de 22 exceções em `formularios-preservados.test.ts`). O aviso ao sair não cobre link interno (L1059, L2367), e não há rascunho persistido. Entre os painéis do WhatsApp, só o editor de templates tem aviso ao sair (L2519) |
| 4. Paginação nos dois sentidos | entregue | #158, #161 | 4 de 37 arquivos ainda só com "Próxima". 26 telas (27 links) de versões e históricos por cursor andam num sentido só, ancoradas como pendência em `paginacao-dois-sentidos.test.ts`. Os 13 `*.int.test.ts` das duas PRs nunca rodaram (issue #162). Faltam filtros em envios do portal (L431) e nas agendas de segunda chamada (L1709) |
| 5. Contraste | entregue | #156, #157 | `--border` e `--brand-border`, decorativos, seguem reprovando. `#fff/--brand` continua na conta do script, sem uso com texto |
| 6. Fuso e instante | entregue | #159 | L1566 (`min` do novo prazo da prorrogação), L1747 (fuso e intervalo do encontro na realização da segunda chamada), L406 (todos os horários no fuso do primeiro) e L1256 (horário da validação ainda em UTC). `fusoIanaValido` (`src/server/operacao/fuso.ts:9`) recusa identificadores como `EST5EDT`. O idioma do país continua texto livre (L2429) |
| 7. Becos sem saída e identificação do registro | entregue | #160 | 66 IDs crus e 12 telas de detalhe sem identificação, com teto na trava (`identificacao-registro.test.ts:378` e `:421`). Continua o link morto de `emissao/page.tsx:23` (L577), falta o caminho para a compensação (L934), e L1399 e L1722 ficaram parciais |
| 8. Portal público | não iniciado | — | `/portal-aluno/ativar` (L2626, L2627), `/portal-aluno/recuperar` (L2639), `/pagar/[token]` só com "pago/aberto" (L2567 da amostra), `/login` sem `callbackUrl` (L2553 da amostra) |
| 9. Consultas e dados no servidor | não iniciado | — | A fila de cobrança continua sem `take` (`listarFilaCobranca`, `src/server/cobrancas/consultas.ts:202`; a #144 trouxe o filtro na URL, não a paginação). Continuam também: o lote de migração sem `take` (L2483), a thread da inbox cortada em 300 mensagens (L2299), a importação de alunos sem deduplicação (L224) e a fila de envios do portal sem filtro de situação (L431). Os demais pontos do item (`/pipeline`, informes de pagamento, cobranças em `listarAlunos`) não foram reconferidos nesta remedição |
| 10. Borda de rota restante | não iniciado | — | `<Suspense>` em 0 e `loading.tsx` em 9, sem mudança; `/configuracao` sem `loading.tsx` (L2324) |
| 11. Média e Baixa | não iniciado | — | A §7.3 remediu a mesma amostra (semente 42), o que mede a evolução pareada. A amostra com outra semente não foi sorteada. **Nota (13/10/2026, depois da #174):** a amostra com outra semente (20261013) foi feita na `main` `4c4f526a` e está na §7.6: 66,8% abertos (IC 58,7–74,9%), com intervalo que se sobrepõe ao da §7.3 |

**Achados Alta ainda abertos (40) e parciais (26), por padrão:**

| Padrão | Abertos | Parciais | O que se repete |
|---|---|---|---|
| Inbox (WhatsApp) | 2295, 2296, 2298 | 2297, 2299 | Anexo e áudio enviados sem revisão; nenhum envio de template com a janela fechada; vínculo de contato e opt-out num clique, sem desvincular; promessa que anuncia "régua pausada" sem ler o retorno; thread cortada em 300 mensagens |
| Portal do aluno (ativar e recuperar) | 2626, 2627, 2639 | 2593, 2676 | Token de ativação só em memória (um F5 queima o link); senha sem regra visível nem confirmação; "pedido enviado" mesmo com falha; segundo login sem explicação; relato de indisponibilidade escondido quando a gravação não abre |
| Confirmação (fatia B e resumo do impacto) | 547, 715, 853, 1058, 1102, 1156, 1218, 2499, 2693 | 309, 531, 2281, 2428, 2517 | "Faltou" no check-in, presença histórica, quantidade de aulas, replanejamento, emissão sem total, condições formalizadas, regularização de período integral, remover período ou avaliação sem desfazer; entre os parciais, efetivar acerto de encerramento, decidir preço, encerrar país, inativar empresa e o alcance da ativação do WhatsApp |
| Lote de migração | 2483 | — | Consulta sem `take` e o JSON de cada linha aberto fora de `<details>` |
| Decidir sem ver o dado | 293, 666, 787, 891, 1411, 1437, 1785, 1864 | 703, 1399, 2065 | Coluna de contrato, comparação de textos, documentos sem link, casos do lote, horário das turmas, efeito do cancelamento, vínculos pendentes; calendário financeiro redigitado a cada versão |
| Carregamento e feedback | 308, 363, 1231, 1863, 2017 | 225, 892, 1400, 2324 | Seções vazias até o clique, erro único fora da tela, botão apagado sem motivo, falha em texto cinza, cotação descartada em silêncio; confirmação que some no refresh |
| Campos e validação | 224, 1014, 1035, 1230, 2412 | 1184, 2429 | Importação que duplica, data no passado aceita, `<select>` que nasce numa decisão ou num professor, senha sem `autoComplete`; idioma do país em texto livre |
| Fuso e instante | 406, 1256 | 729, 1566, 1747 | Horários no fuso do primeiro, entrada em UTC, prazos e intervalos sem `min`/`max` |
| Becos e caminho que falta | 431, 934, 1070, 2282 | 577, 1709, 1722 | Fila sem filtro de situação, compensação sem caminho, publicar calendário que nunca habilita, fechamento de fatura B2B sem tela; link morto da emissão, agendas sem busca, link de autorização errado |
| Não perder o digitado | — | 1059, 2367 | O aviso ao sair não cobre link interno |
| **Total** | **40** | **26** | |

**Issues.** Abertas: #141 (só a parte B2, ordenação com acento no Postgres, que depende de collation), #152 e #162. Fechadas: #139 (pela #147), #140 (pela #148) e #142 (pela #150). Ver doc 44 §4.

**Métrica de fluxo.** As métricas da 7.7 (cliques até concluir uma matrícula, tempo até o primeiro sinal, reenvios após erro) continuam **sem medição**. Dependem de um operador real e de cronômetro, e devem ser feitas antes de declarar a auditoria encerrada.

### 7.6 Amostra Média/Baixa com nova semente (main `4c4f526a`)

Item 11 da §6. Código medido: `origin/main` em `4c4f526a` (merge da #174). Depois da §7 entraram na `main` as PRs #171–#174 (guards de página, portal público, moeda e borda de rota). Por isso esta amostra mede a `main` atual, e não a `e5418550` da §7.3.

O UAT não foi aberto e o app não foi rodado. Todos os vereditos são por leitura de código, como na §7.

#### 7.6.1 Resumo

1. **Estimativa com a semente nova:** **66,8% dos 727 achados Média/Baixa continuam abertos (IC 95% 58,7–74,9%), ≈ 486 achados (≈ 427–544).** Os resolvidos são 18,3% (11,7–24,9%), ≈ 133, e os parciais 14,9% (8,9–20,9%), ≈ 109.
2. **Comparação com a §7.3** (semente 42, remedida na `e5418550`): lá a estimativa era de 58,9% abertos (IC 50,3–67,5%), ≈ 428.
   - **Os intervalos se sobrepõem**, entre 58,7% e 67,5%. A diferença pontual de 7,9 p.p. não basta para afirmar que as duas amostras medem frações diferentes.
   - Não é amostra pareada: 105 dos 126 achados são outros. Por isso não há diferença pareada.
   - A estimativa central da semente nova é mais alta, mesmo medindo um código mais novo. Uma hipótese, que não foi medida: os 126 achados da semente 42 estavam listados linha a linha no doc 43, e várias PRs de #153 a #161 citam esses achados. Assim, a semente 42 pode ter recebido mais correção do que a média da população.
   - **Para planejar:** usar as duas estimativas centrais, ≈ 430 a 490 achados abertos, como ordem de grandeza, e não um número único.
3. **Amostra crua:** 25 resolvidos, 19 parciais e 82 abertos. Numa amostra aleatória simples sem peso, só como referência, seriam 65,1% abertos (Wald 56,8–73,4%).
4. **Sobreposição com a semente 42:** 21 dos 126 achados coincidem (L312, 326, 378, 381, 408, 419, 603, 1047, 1157, 1209, 1316, 1687, 1788, 1854, 2244, 2303, 2354, 2553, 2567, 2606 e 2712). Eles entram na estimativa e estão marcados com ¹ na tabela 7.6.6.
   - 19 mantêm o veredito da §7.3.5.
   - 2 passaram de aberto para resolvido com a #172: L2553 (`callbackUrl` no login) e L2567 (`/pagar` com todos os status).
   - **Os 105 novos:** 19 resolvidos, 17 parciais e 69 abertos. A estimativa estratificada só com eles dá 68,0% abertos (IC 59,4–76,7%). Os 21 repetidos (6 resolvidos, 2 parciais e 13 abertos), portanto, não explicam a diferença em relação à §7.3.
5. **Efeito das PRs #171–#174 na amostra:**
   - **#172** (portal público) resolveu 4 achados: L2553, L2567, L2570 e L2629.
   - **#174** (borda de rota) levou 4 achados a parcial: L602, L1505, L1544 e L1764. O `loading.tsx` e o `error.tsx` novos de `/matriculas/[id]` e `/academico` cobrem por herança. Mas o erro de consulta continua sendo devolvido pela página como `<p role="alert">` solto, e o loading da área não reaparece na navegação dentro do segmento.
   - **#171** (guards) e **#173** (moeda) não moveram nenhum achado da amostra.
6. **Abertos por severidade** (estratificado): Média 68,7% (IC 59,2–78,2%) e Baixa 62,1% (IC 46,5–77,7%).

#### 7.6.2 Método

- **Sorteio:** `node scripts/medicao-ux/amostra.mjs 6 3 20261013`, com 6 Média e 3 Baixa por área, ou 126 de 727. A semente 20261013 é a data da medição. O gerador e a alocação são os mesmos da §5; só muda a semente.
- **Veredito:** para cada achado, li a linha do doc 42 e o código atual (o arquivo citado ou o que o substituiu). O critério é o da §2 e da §7.3:
  - **resolvido:** o defeito descrito não ocorre mais;
  - **parcial:** uma parte da recomendação foi feita, ou só uma das telas citadas foi corrigida;
  - **aberto:** o defeito continua.
- **Regra herdada da §7.4:** título sem `font-medium` na classe não é defeito, porque a regra base de `app/globals.css` já dá peso 500 a h1–h6.
- **Achados repetidos:** os 21 que já estavam na semente 42 foram conferidos de novo na `4c4f526a`, e não copiados da §7.3.5.
- **Estimativa:** `estimativaEstratificada` (`scripts/medicao-ux/nucleo.mjs:247`), com as populações por área × severidade de `achadosDoRepositorio()`. É o mesmo cálculo da §7.3. Para conferir, o script refeito com as contagens "depois" da §7.3.2 devolve exatamente 58,9% (50,3–67,5%).
- **Etiquetas de padrão:** cada achado aberto ou parcial recebeu até 2 etiquetas, da mesma lista da §7.3.4.

#### 7.6.3 Contagens por estrato

R = resolvido, P = parcial, A = aberto. São 6 achados Média e 3 Baixa por área. Com essa alocação, o número de cada área é indicativo, não estimativa.

| Área | Média R / P / A | Baixa R / P / A | População Média / Baixa |
|---|---|---|---|
| Alunos e turmas | 2 / 1 / 3 | 1 / 0 / 2 | 26 / 14 |
| Secretaria | 2 / 1 / 3 | 0 / 0 / 3 | 22 / 9 |
| Matrículas — entrada | 1 / 1 / 4 | 0 / 0 / 3 | 34 / 9 |
| Matrículas — contrato | 1 / 1 / 4 | 0 / 0 / 3 | 30 / 16 |
| Matrículas — ciclo | 2 / 0 / 4 | 1 / 1 / 1 | 62 / 12 |
| Acadêmico — base | 0 / 0 / 6 | 2 / 0 / 1 | 56 / 5 |
| Acadêmico — avaliações | 0 / 0 / 6 | 1 / 0 / 2 | 33 / 16 |
| Acadêmico — recuperações | 0 / 2 / 4 | 0 / 1 / 2 | 44 / 19 |
| Acadêmico — segundas chamadas | 1 / 1 / 4 | 0 / 1 / 2 | 33 / 19 |
| Diário de aulas | 0 / 2 / 4 | 0 / 0 / 3 | 44 / 14 |
| Financeiro | 0 / 1 / 5 | 1 / 1 / 1 | 32 / 24 |
| Comercial | 2 / 1 / 3 | 2 / 1 / 0 | 28 / 11 |
| Configuração | 1 / 2 / 3 | 1 / 0 / 2 | 36 / 30 |
| Público e portal | 3 / 0 / 3 | 1 / 1 / 1 | 35 / 14 |
| **Total** | **15 / 13 / 56** (84) | **10 / 6 / 26** (42) | **515 / 212** |

#### 7.6.4 Estimativa estratificada para os 727 (IC 95%) e comparação

| Status | Semente 42, §7.3 (`e5418550`) | Semente 20261013 (`4c4f526a`) | ≈ achados, 42 → 20261013 |
|---|---|---|---|
| Resolvido | 24,9% (17,6–32,1%) | **18,3% (11,7–24,9%)** | 181 → **133** |
| Parcial | 16,2% (9,6–22,8%) | **14,9% (8,9–20,9%)** | 118 → **109** |
| Aberto | 58,9% (50,3–67,5%) | **66,8% (58,7–74,9%)** | 428 → **486** |

- **Os intervalos se sobrepõem nos três status.** No "aberto", a faixa comum vai de 58,7% a 67,5%.
- **Só os 105 novos:** resolvido 17,0% (9,7–24,4%), parcial 14,9% (8,6–21,2%) e aberto 68,0% (59,4–76,7%), ≈ 495.
- **Limites:**
  - como na §7.3, um estrato com 0 ou 3 de 3 (ou 0 ou 6 de 6) contribui com variância zero, o que deixa o intervalo otimista;
  - as duas amostras foram medidas em `main` diferentes (`e5418550` e `4c4f526a`). A comparação mistura, portanto, a variação de amostragem com o efeito das PRs #171–#174. Na amostra nova, esse efeito é pequeno: 4 achados resolvidos e 4 parciais (§7.6.1, item 5).

#### 7.6.5 Padrões entre os abertos e parciais

São 101 achados não resolvidos: 82 abertos e 19 parciais. Cada um recebeu até 2 etiquetas; o "(p)" marca os parciais.

| Padrão | Abertos | Parciais | Achados | O que se repete |
|---|---|---|---|---|
| **Layout e hierarquia** | 20 | 3 | 244 (p), 298, 378, 407, 535, 580, 603, 717, 765, 841, 1049, 1072, 1378, 1379, 1424, 1697, 1902, 2045 (p), 2104, 2106, 2354, 2605, 2712 (p) | Estado ou etapa que não aparece: contrato sem etapa (603, 717), desistência sem estado ao lado do link (765), modelo sem estado da decisão (2354) e "Prazo vencido" sem destaque (378). Também: motivo inteiro em `whitespace-pre-wrap` (1049, 2106), cartões onde caberia tabela (407, 1697), resultado longe do botão (1902, 1072) e lista sem filtro (1378) |
| **Texto e microcopy** | 17 | 3 | 299, 408, 435 (p), 788, 804 (p), 841, 1316, 1329, 1424, 1530, 1568, 1632, 1675, 1852, 1854, 2104, 2158 (p), 2270, 2415, 2607 | Registro sem aluno ou matrícula (408, 1424, 2104) e IDs crus (2158). Também: mensagem que não diz a causa ("Confira a versão…, prazo…, data…", 1568; "(usuário inativo)", 1329), rótulo enganoso (1675, 1854, 2270 "Colaboradores" que conta matrículas), sufixo de fuso repetido por linha (435, 2415) e "Q165" vindo do servidor (804) |
| **Validação de campo** | 17 | 2 | 312, 432, 474, 520, 694, 733, 923, 1157, 1318, 1672, 1840 (p), 1868, 1976, 2129, 2131, 2142, 2218, 2470, 2488 (p) | Validação só no servidor ou só no submit: um erro por vez (2131, 2488), mensagem única para seis campos (2129) e erro depois do botão (2218). Também: opções que o servidor vai recusar (474, 923, 1672), `<select>` que nasce em "Aprovar e compensar" (2142), botão de recusa que pula o `required` (432) e `FormData` sem o submitter, que manda "Pedir correção" como conclusão (1976) |
| **Feedback de ação** | 15 | 4 | 311, 312, 520, 535, 552, 1303, 1316, 1367, 1568, 1672, 1687 (p), 1840 (p), 2019, 2218, 2248 (p), 2505, 2522 (p), 2606, 2681 | Botão desabilitado sem dizer por quê (311, 520, 1840). Também: sucesso só com `router.refresh()` (552, 1367), "Sair" e vídeo que falham em silêncio (2606, 2681) e mensagem sem estilo (2505) |
| **Navegação e becos** | 15 | 3 | 381, 550, 680, 719, 730, 765, 1047, 1115, 1209, 1303, 1518, 1620 (p), 1776, 1801, 1852, 1854, 1963 (p), 2246 (p) | Falta o caminho para destravar (550, 680, 1303); volta errada (`VoltarPara href="/alunos"`, 730). Também: paginação só para frente fora de `Paginacao` (1047, 1620), links e abas sem estilo nem `aria-current` (1115, 1801, 1963) e `window.location.assign` (1209) |
| **Acessibilidade** | 8 | 2 | 396, 552, 1115, 1194, 1491, 1805, 1902, 1904, 1963 (p), 2522 (p) | `<main>` dentro de `<main>` (1194); `role="status"` estático (396) ou ausente (1491); `aria-live` no painel inteiro (1904); checkbox desabilitado sem descrição (1805) |
| **Estado de rota** | 3 | 5 | 381, 532 (p), 602 (p), 1505 (p), 1518, 1544 (p), 1764 (p), 1776 | O erro de consulta continua devolvido pela página como `<p role="alert">` solto. Os `error.tsx` da #174 só pegam exceção, não o `return` da página. O loading da área não reaparece na navegação interna |
| **Fuso e data** | 5 | 1 | 407, 435 (p), 501, 1530, 2415, 2500 | Data em UTC forçado (2500), vigência que não aparece (1530), prazo sem o tempo restante (501) |
| **Confirmação** | 5 | 0 | 325, 1479, 2019, 2142, 2244 | Só L2244 (revogar cobertura) está na fatia B de `confirmacoes-mapa.ts`. Os outros quatro estão fora das fatias A e B: aprovar a troca de e-mail que revoga sessões (325), oficializar a nota de recuperação (1479), decidir pedido de desconto sem motivo (2019) e aprovar compensação de permuta, que abate mensalidades (2142) |
| **Outro** | 5 | 0 | 925, 1378, 1976, 1992, 2354 | Decisão que depende do `submitter` (1976, 1992); `<strong>` no nome (925) |
| **Dados não perdidos** | 1 | 0 | 923 | Evidência digitada perdida quando o servidor recusa o responsável já autorizado |
| **Mobile** | 1 | 0 | 2605 | Cabeçalho do portal do aluno com links colados e área de toque pequena |

**Leitura.**
- **Onde está o grosso:** os três padrões com mais abertos são Layout e hierarquia (20), Texto e microcopy (17) e Validação de campo (17). Feedback de ação e Navegação e becos vêm logo atrás, com 15 cada. É o mesmo quadro da §7.3.4, com uma diferença: a validação de campo pesa mais aqui (19 de 101, contra 13 de 94).
- **Validação de campo:** em geral, o defeito é o servidor recusar o que a tela deixou escolher. Isso se resolve tela a tela, não com um componente.
- **Confirmação:** a amostra nova acha quatro ações sem confirmação que não estão em nenhuma das fatias de `confirmacoes-mapa.ts`. Uma delas (2142) tem efeito financeiro, que é o critério da fatia A.
- **Em lote, o que mais renderia:** o mesmo da §7.3.4. O cabeçalho de erro com volta e "Tentar de novo" no lugar do `<p role="alert">` devolvido pela página aparece em 8 achados (381, 532, 602, 1518, 1776, e em parte 1505, 1544 e 1764). A #174 criou os `error.tsx`, mas as páginas continuam fazendo `return <p role="alert">` antes de qualquer exceção.

#### 7.6.6 Tabela por achado

Na ordem do doc 42. Os caminhos são relativos a `src/app/(app)/`, salvo os que começam com `app/`, `components/`, `lib/` ou `server/`, que são relativos a `src/`. O ¹ marca os 21 achados que também estão na amostra da semente 42.

| L | Área | Severidade | Veredito | Evidência atual |
|---|---|---|---|---|
| 228 | Alunos e turmas | Média | resolvido | `alunos/ImportarAlunosModal.tsx:67` usa `Modal` (`components/Modal.tsx`: `role="dialog"`, `aria-modal`, Esc e foco preso e devolvido) |
| 244 | Alunos e turmas | Média | parcial | `alunos/[id]/FichaAluno.tsx:189,505` "Outro" sem observação agora é barrado no cliente com foco; o painel (`:476-509`) ainda não lista as matrículas que serão encerradas |
| 311 | Alunos e turmas | Média | aberto | `alunos/[id]/movimentacoes/MovimentacoesPainel.tsx:140` "Aplicar proposta aprovada" desabilitado por `!podeAprovar`; o aviso de `:136` só existe dentro do bloco de decisão |
| 312 ¹ | Alunos e turmas | Média | aberto | `alunos/[id]/movimentacoes/NovaPausa.tsx:68` botão só `disabled={ocupado}`; pendências em `:66` sem aviso junto ao botão |
| 325 | Alunos e turmas | Média | aberto | `alunos/[id]/portal/painel.tsx:53` "Aprovar e aplicar" é submit direto, sem confirmação da revogação, colado em "Rejeitar" |
| 326 ¹ | Alunos e turmas | Média | resolvido | `alunos/[id]/portal/painel.tsx:53` `rotular(SITUACAO_TROCA_EMAIL_PORTAL_ALUNO_LABEL, …)` |
| 246 | Alunos e turmas | Baixa | resolvido | `alunos/[id]/FichaAluno.tsx:532` cartão de turma sugerida usa `text-blue-700`; não há `text-blue-800` em `(app)` |
| 298 | Alunos e turmas | Baixa | aberto | `alunos/[id]/financeiro/page.tsx:141-151` links de três fluxos por matrícula seguem soltos, sem seção nem agrupamento por contrato |
| 299 | Alunos e turmas | Baixa | aberto | `alunos/[id]/financeiro/page.tsx:151` link da secretaria ainda usa `{m.codigo}` sem fallback; `:142` já usa "sem código" |
| 367 | Secretaria | Média | resolvido | `secretaria/CondicoesEncerramento.tsx:32,110` tipos via `rotular(TIPO_COBRANCA_LABEL)`, sem "Q165"; `SecretariaPainel.tsx:51,66` status rotulado e datas com `formatarDataCivil` |
| 378 ¹ | Secretaria | Média | aberto | `secretaria/reservas/page.tsx:28` " · Prazo vencido" concatenado no fim da linha de prazo e fuso, sem destaque |
| 407 | Secretaria | Média | aberto | `secretaria/reservas/particulares/[id]/page.tsx:21` `<ul>` plano "professor · início — fim · fuso", sem agrupar por dia e repetindo data e fuso |
| 419 ¹ | Secretaria | Média | resolvido | `secretaria/desistencias/page.tsx:32` `PaginacaoFila` com "Anterior" e "Próxima" (#158/#161) |
| 432 | Secretaria | Média | aberto | `secretaria/envios-portal/ConciliacaoEnvio.tsx` "Não autorizar" é `type="button"` e chama `decidir(…, false)` sem validar o motivo `required minLength={5}` |
| 435 | Secretaria | Média | parcial | `secretaria/envios-portal/page.tsx:29` finalidade com `rotular(FINALIDADE_TOKEN_PORTAL_ALUNO_LABEL)`; o sufixo "(horário exibido em X; origem UTC)" continua duas vezes por item |
| 381 ¹ | Secretaria | Baixa | aberto | `secretaria/reservas/page.tsx:14` erro devolve só `VoltarPara` e `<p role="alert">`, sem `<h1>`, sem as `<nav>` e sem "Tentar de novo" |
| 396 | Secretaria | Baixa | aberto | `secretaria/reservas/[id]/page.tsx:17` e `particulares/[id]/page.tsx:17` mantêm `role="status"` em parágrafo estático do servidor |
| 408 ¹ | Secretaria | Baixa | aberto | `secretaria/reservas/particulares/[id]/page.tsx:16` `<h1>` sem aluno nem matrícula; identificação só pelo link de `:22` |
| 474 | Matrículas — entrada | Média | aberto | `matriculas/nova/page.tsx:31,46` `listarTurmasAbertas()` sem argumentos; o filtro só tira turmas lotadas, sem filtrar por produto ou nível |
| 517 | Matrículas — entrada | Média | resolvido | `matriculas/[id]/nova-reserva/Formulario.tsx:79,82-83` pagador e tipos com `rotular`; valores com `formatarMoeda` |
| 532 | Matrículas — entrada | Média | parcial | `matriculas/[id]/preparacao/page.tsx:17` erro segue como `<p role="alert">` solto, sem "Tentar de novo"; o cabeçalho e as abas do `[id]/layout.tsx` dão a volta |
| 535 | Matrículas — entrada | Média | aberto | `matriculas/[id]/preparacao/page.tsx:49` impedimento é `<p>` cru, sem `role`, sem cor, e o formulário some |
| 550 | Matrículas — entrada | Média | aberto | `matriculas/[id]/emissao/page.tsx:29` "Nenhum documento anexado" sem lista dos exigidos nem link para anexar |
| 580 | Matrículas — entrada | Média | aberto | `matriculas/[id]/entrada-particular/page.tsx:22-24` itens na ordem do servidor; "exigido" e "confirmado" na mesma frase, sem destaque |
| 501 | Matrículas — entrada | Baixa | aberto | `matriculas/[id]/reserva/page.tsx:18,21` só a data absoluta do prazo, sem o tempo restante |
| 520 | Matrículas — entrada | Baixa | aberto | `matriculas/[id]/nova-reserva/Formulario.tsx:86` botão desabilitado por checkbox ou motivo curto, sem dizer qual falta |
| 552 | Matrículas — entrada | Baixa | aberto | `matriculas/[id]/emissao/ConfirmarEmissao.tsx:17` sucesso só faz `router.refresh()`, sem mensagem nem foco |
| 602 | Matrículas — contrato | Média | parcial | `matriculas/[id]/loading.tsx` e `error.tsx` existem, mas `contrato/page.tsx:25` ainda devolve `<p role="alert">` solto quando a consulta falha |
| 603 ¹ | Matrículas — contrato | Média | aberto | `matriculas/[id]/contrato/page.tsx:32-36` título, links e parágrafo; nenhuma etapa do contrato |
| 669 | Matrículas — contrato | Média | resolvido | `matriculas/[id]/layout.tsx:32-41` cabeçalho com código, aluno e estado acima de `substituicoes/[propostaId]` (o `<h1>` de `:29` segue genérico) |
| 680 | Matrículas — contrato | Média | aberto | `matriculas/[id]/contrato/aditivos/page.tsx:27` sem original, mostra só `<p role="status">{d.impedimento}</p>`, sem caminho para destravar |
| 717 | Matrículas — contrato | Média | aberto | `matriculas/[id]/contrato/aditivos/[propostaId]/originais/[artefatoId]/page.tsx:61-74` seções condicionais em sequência, sem indicador de etapa |
| 730 | Matrículas — contrato | Média | aberto | `matriculas/[id]/contrato/aditivos/agenda/page.tsx:11` `VoltarPara href="/alunos"` |
| 694 | Matrículas — contrato | Baixa | aberto | `matriculas/[id]/contrato/aditivos/Formularios.tsx:88-89` checkbox sem `name` (igual à base) e "Aprovar" como `<option disabled={superada}>` |
| 719 | Matrículas — contrato | Baixa | aberto | `matriculas/[id]/contrato/aditivos/[propostaId]/originais/[artefatoId]/page.tsx:23,55` paginação aninhada com quatro parâmetros, sem âncora nem indicação do bloco |
| 733 | Matrículas — contrato | Baixa | aberto | `matriculas/[id]/contrato/aditivos/agenda/ConferenciaAgendaFormulario.tsx:36-37` sem contador nem "selecionar todos"; botão só desabilitado por `pendente` |
| 765 | Matrículas — ciclo | Média | aberto | `matriculas/[id]/desistencia/page.tsx:27-28` links "Conferir documentos e assinaturas" e "Consultar decisão administrativa" sem estado da etapa |
| 788 | Matrículas — ciclo | Média | aberto | `matriculas/[id]/desistencia/documentos/page.tsx:36,38` "Processo {i + 1}" e "Referência externa registrada." sem o valor; o DTO segue booleano |
| 828 | Matrículas — ciclo | Média | resolvido | `matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx:69` erro e sucesso da decisão dentro do `<article>` de cada revisão (`alvo === decidir:<id>`) |
| 841 | Matrículas — ciclo | Média | aberto | `matriculas/[id]/compensacoes/[cobrancaId]/CompensacaoCobertura.tsx:96-101` cartão da proposta sem data nem autor |
| 907 | Matrículas — ciclo | Média | resolvido | `matriculas/[id]/fechamentos-horas/PrepararFechamento.tsx:54` `CampoFuso` pré-preenchido e validado no cliente (#159) |
| 923 | Matrículas — ciclo | Média | aberto | `matriculas/[id]/autorizacoes-comunicacao/AutorizacoesFormulario.tsx:40` `responsaveis.map` ainda oferece quem já está autorizado |
| 804 | Matrículas — ciclo | Baixa | parcial | `matriculas/[id]/desistencia/financeiro/page.tsx` sem "Q165"/"Q121" fixos, mas mostra o impedimento do servidor "…memória contratual Q165." (`server/matricula/desistencia-reconferencia-delta-consulta.ts:71`) |
| 925 | Matrículas — ciclo | Baixa | aberto | `matriculas/[id]/autorizacoes-comunicacao/AutorizacoesFormulario.tsx:41` nome do responsável continua em `<strong>` |
| 939 | Matrículas — ciclo | Baixa | resolvido | `matriculas/[id]/indisponibilidade-oferta/RelatosIndisponibilidadeOferta.tsx:22,37` instante em pt-BR com "UTC" e `AvisoFusoNaoConfigurado` uma vez no topo |
| 1047 ¹ | Acadêmico — base | Média | aberto | `academico/calendario/page.tsx:29` só "Versões anteriores" por cursor; sem "Anterior" nem volta à primeira página |
| 1049 | Acadêmico — base | Média | aberto | `academico/calendario/page.tsx:26` motivo inteiro em `whitespace-pre-wrap`, sem truncar |
| 1072 | Acadêmico — base | Média | aberto | `academico/calendario/[id]/page.tsx:35` link do replanejamento continua depois da lista de períodos não letivos (`:31-34`) |
| 1115 | Acadêmico — base | Média | aberto | `academico/grades/page.tsx:41` `<nav>` "Pendentes / Incluir histórico" sem `aria-current` nem estilo do filtro ativo |
| 1157 ¹ | Acadêmico — base | Média | aberto | `academico/regras/[nivelId]/Formularios.tsx:23` `replace(",", ".")` troca só a primeira vírgula; nenhum `pattern` no arquivo |
| 1194 | Acadêmico — base | Média | aberto | `academico/modalidades/quantidade/page.tsx:9` e `[id]/quantidade/page.tsx:9-10` ainda abrem `<main>` dentro do `<main>` do layout |
| 1005 | Acadêmico — base | Baixa | resolvido | `academico/admissoes/page.tsx:21` usa `STATUS_TURMA_LABEL`, tipado `Record<StatusTurma, string>` (`lib/labels.ts:263`): status novo sem rótulo não compila |
| 1026 | Acadêmico — base | Baixa | resolvido | `academico/admissoes/excecoes/page.tsx:13` `h1 text-2xl` recebe peso 500 da regra base de `app/globals.css` (como L1645 na §7.4) |
| 1209 ¹ | Acadêmico — base | Baixa | aberto | `academico/modalidades/[id]/quantidade/AlterarQuantidadeAulas.tsx:20` sucesso ainda faz `window.location.assign(...)` |
| 1303 | Acadêmico — avaliações | Média | aberto | `academico/avaliacoes/[alocacaoId]/page.tsx:49-50` links de extras e planos ainda condicionados a `consolidado.ok`, sem motivo junto |
| 1316 ¹ | Acadêmico — avaliações | Média | aberto | `academico/avaliacoes/[alocacaoId]/[codigo]/Formularios.tsx:66` sucesso fixo "…exige conferência…" mesmo com `modo=rascunho` |
| 1367 | Acadêmico — avaliações | Média | aberto | `academico/avaliacoes/[alocacaoId]/fechamento/ConfirmarFechamento.tsx:38-40,56` sucesso só faz `reset()` e `refresh()`; `FeedbackAcao` sem `sucesso` |
| 1378 | Acadêmico — avaliações | Média | aberto | `academico/correcoes/page.tsx:13,24` lê só `pagina`; lista sem filtro por tipo, por caso preparado nem contagem |
| 1379 | Acadêmico — avaliações | Média | aberto | `academico/correcoes/page.tsx:27` "Situação na correção… Situação atual…" em texto corrido, sem destaque quando divergem |
| 1424 | Acadêmico — avaliações | Média | aberto | `academico/equivalencias/page.tsx:42` cabeçalho e cartões sem aluno nem código da matrícula |
| 1290 | Acadêmico — avaliações | Baixa | resolvido | `academico/avaliacoes/Identificacao.tsx:5` usa `IdentificacaoRegistro`, que mostra "sem código" no lugar do UUID (#160) |
| 1318 | Acadêmico — avaliações | Baixa | aberto | `academico/avaliacoes/[alocacaoId]/[codigo]/Formularios.tsx:82` nota em texto livre `maxLength={100}`, sem faixa da escala no cliente |
| 1329 | Acadêmico — avaliações | Baixa | aberto | `academico/avaliacoes/[alocacaoId]/[codigo]/designacao/page.tsx:28` " (usuário inativo)" concatenado, sem dizer o que fazer |
| 1479 | Acadêmico — recuperações | Média | aberto | `academico/recuperacoes/[realizacaoId]/Formularios.tsx:45-47` "Oficializar esta versão" é opção do select e vai no submit, sem checkbox de conferência |
| 1491 | Acadêmico — recuperações | Média | aberto | `academico/recuperacoes/correcoes/[notaId]/Formularios.tsx:35-38` resultado da conferência renderizado sem `role="status"` |
| 1505 | Acadêmico — recuperações | Média | parcial | `academico/loading.tsx` cobre a entrada na área, mas `recuperacoes/designadas` não tem `loading.tsx`; aba e paginação por query string seguem sem sinal |
| 1518 | Acadêmico — recuperações | Média | aberto | `academico/recuperacoes/planos/page.tsx:22,28` `alocacaoId = ""` vai à consulta; o erro sai como `<p role="alert">` sem cabeçalho nem link |
| 1530 | Acadêmico — recuperações | Média | aberto | `academico/recuperacoes/planos/autorizacoes-preparacao/page.tsx:31` "Prazo até…" sem dizer se está vigente, expirada ou consumida |
| 1544 | Acadêmico — recuperações | Média | parcial | `academico/loading.tsx` cobre a entrada vinda de outra seção; `recuperacoes/planos/[propostaId]` segue sem `loading.tsx` na volta de agenda e designação |
| 1568 | Acadêmico — recuperações | Baixa | aberto | `academico/recuperacoes/planos/[propostaId]/prorrogacoes/page.tsx:38` "Aprovação indisponível. Confira a versão…, prazo…, data… e situação…": quatro hipóteses, sem a causa |
| 1620 | Acadêmico — recuperações | Baixa | parcial | `academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/page.tsx:32` situação rotulada; `:42` "Autorizações mais antigas" segue só para frente, enquanto as irmãs usam `Paginacao` |
| 1632 | Acadêmico — recuperações | Baixa | aberto | `academico/recuperacoes/tentativas/[itemReservaId]/designacao/page.tsx:36` "Mostrando os primeiros 50 professores" sem o total e sem limpar a busca |
| 1672 | Acadêmico — segundas chamadas | Média | aberto | `academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/page.tsx:17` `podePropor` checa só vínculo e matrícula; com saldo 0 o formulário de proposta continua |
| 1675 | Acadêmico — segundas chamadas | Média | aberto | `academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/FormularioOcorrencia.tsx:35` texto fala em cancelamento, mas `tipos` (`:11-14`) só tem Falta e Impedimento |
| 1687 ¹ | Acadêmico — segundas chamadas | Média | parcial | `academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/autorizacoes/Formulario.tsx:27-28,39` sucesso via `FeedbackAcao`, mas sem `reset()`, sem o prazo na mensagem e sem foco |
| 1697 | Acadêmico — segundas chamadas | Média | aberto | `academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/historico/page.tsx:31-36` histórico em cartões `<article>`, sem tabela, filtro nem contador |
| 1788 ¹ | Acadêmico — segundas chamadas | Média | resolvido | `academico/segundas-chamadas/reservas/[reservaId]/cancelamento/page.tsx:18` `rotular(STATUS_ENCONTRO_LABEL…)` e `rotular(STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL…)` |
| 1801 | Acadêmico — segundas chamadas | Média | aberto | `academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx:90-91` "Primeira página" e "Propostas anteriores" sem `className`, sem cor nem sublinhado |
| 1764 | Acadêmico — segundas chamadas | Baixa | parcial | `academico/error.tsx` e `academico/loading.tsx` cobrem `propostas/[propostaId]/agenda` por herança; navegando dentro de `segundas-chamadas` o loading da área não reaparece |
| 1776 | Acadêmico — segundas chamadas | Baixa | aberto | `academico/segundas-chamadas/propostas/[propostaId]/designacao/page.tsx:29` falha da consulta devolve `<p role="alert">` solto, sem título nem volta |
| 1805 | Acadêmico — segundas chamadas | Baixa | aberto | `academico/segundas-chamadas/reservas/[reservaId]/remarcacao/Formulario.tsx:49` checkbox `disabled={decisao !== "aprovar"}` sem texto da dependência |
| 1840 | Diário de aulas | Média | parcial | `diario/DiarioAulas.tsx:151` lista vazia agora explicada com `EstadoVazio`; `:153` conteúdo vazio e turma não escolhida desabilitam "Salvar aula" sem explicar |
| 1852 | Diário de aulas | Média | aberto | `diario/encontros/page.tsx:26` link só com `PREVISTO && fim <= agora`; quando falha, nenhum motivo |
| 1902 | Diário de aulas | Média | aberto | `diario/encontros/[id]/correcao/CorrecaoAula.tsx:377` `<Impactos>` no fim do return, longe do botão de `:367`, sem rolagem nem foco |
| 1963 | Diário de aulas | Média | parcial | `diario/excecoes-gravacao/page.tsx:35` passou a `PaginacaoFila`; as abas de `:22` seguem sem classe nem `aria-current` |
| 1976 | Diário de aulas | Média | aberto | `diario/reposicoes/ReposicaoDocente.tsx:36,40` `new FormData(form)` sem o submitter não traz `operacao`; "Pedir correção" cai em concluir, e o `formNoValidate` anula o `minLength` |
| 1992 | Diário de aulas | Média | aberto | `diario/reposicoes/[id]/troca-fonte/TrocaFonteReposicao.tsx:87` `aprovar` ainda vem de `submitter?.getAttribute("value")`, com rejeição como fallback |
| 1854 ¹ | Diário de aulas | Baixa | aberto | `diario/encontros/page.tsx:29` link de paginação ainda diz "Próximos encontros" |
| 1868 | Diário de aulas | Baixa | aberto | `diario/encontros/[id]/PublicarGravacao.tsx:19,41` URL colada barrada pelo `pattern`; o handler faz `return` silencioso, sem extrair o ID |
| 1904 | Diário de aulas | Baixa | aberto | `diario/encontros/[id]/correcao/CorrecaoAula.tsx:122` `aria-live="polite"` no painel de impactos inteiro |
| 2019 | Financeiro | Média | aberto | `financeiro/FinanceiroPainel.tsx:306,313` Aprovar e Rejeitar chamam `onDecidir(a.id, true/false)` direto, sem campo de motivo |
| 2104 | Financeiro | Média | aberto | `financeiro/desistencias/page.tsx:22` linha mostra só `{m.codigo ?? "Matrícula"} · Pedido {versao}`, sem aluno, valor nem data |
| 2129 | Financeiro | Média | aberto | `financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx:22,30` moeda com `uppercase` só visual e validada por `/^[A-Z]{3}$/`; uma mensagem genérica para seis campos |
| 2131 | Financeiro | Média | aberto | `financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx:45-52` `propostaValida` ainda devolve só a primeira falha |
| 2142 | Financeiro | Média | aberto | `financeiro/permuta/PermutaOperacional.tsx:161` select `aprovar` nasce em "Aprovar e compensar", sem opção vazia |
| 2158 | Financeiro | Média | parcial | `financeiro/recebimentos/page.tsx:22,25` valor e data formatados; seguem `Matrícula {r.matriculaId}` e `Cobrança {v.cobrancaId}` crus |
| 2045 | Financeiro | Baixa | parcial | `financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx` `h3` agora `font-medium`; a `<table>` de impacto segue sem classe nem `scope` |
| 2105 | Financeiro | Baixa | resolvido | `financeiro/desistencias/page.tsx:23` `PaginacaoFila` com "Anterior" e "Próxima" (#158/#161) |
| 2106 | Financeiro | Baixa | aberto | `financeiro/desistencias/page.tsx:22` motivo inteiro em `whitespace-pre-wrap`, sem limite de linhas |
| 2204 | Comercial | Média | resolvido | `leads/[id]/FichaLead.tsx:267,287,369,570,637` `FeedbackAcao` em cada seção, junto da ação que falha |
| 2218 | Comercial | Média | aberto | `leads/[id]/contratacao/PreparacaoFormulario.tsx:26-29,53` validações só no submit e erro em `<p role="alert">` depois do botão |
| 2244 ¹ | Comercial | Média | aberto | `carteiras/CoberturasPainel.tsx` "Revogar" chama `revogar(c.id)` → `revogarCobertura` num clique, sem confirmação |
| 2246 | Comercial | Média | parcial | `carteiras/page.tsx:18-26` lista paginada com total (sem corte silencioso em 100); continua sem busca e sem filtro por vendedor ou período |
| 2270 | Comercial | Média | aberto | `server/empresas/consultas.ts:62` `colaboradores: e._count.matriculas` conta matrículas; coluna "Colaboradores" em `empresas/EmpresasCliente.tsx:175` |
| 2302 | Comercial | Média | resolvido | `inbox/InboxCliente.tsx:158-160,260` lista `w-full md:w-80`, escondida no celular quando há thread, com volta "Conversas" |
| 2220 | Comercial | Baixa | resolvido | `leads/[id]/contratacao/AgendaParticularFormulario.tsx:37` fuso por `CampoFuso`, validado no cliente (#159) |
| 2248 | Comercial | Baixa | parcial | `carteiras/CoberturasPainel.tsx` "Fim" com `min` do início (`useInicioDoPeriodo`); o erro segue fora do `<form>`, sem foco nem rolagem |
| 2303 ¹ | Comercial | Baixa | resolvido | `inbox/AtendimentosPainel.tsx:127` revisão de falha usa `FeedbackAcao` com erro e sucesso separados |
| 2354 ¹ | Configuração | Média | aberto | `configuracao/contratos/page.tsx:14` só "última versão N, M versões registradas", sem estado da decisão |
| 2370 | Configuração | Média | resolvido | `configuracao/contratos/ModeloFormulario.tsx:95` envio com `botaoClasses({ tamanho: "lg" })`; não há mais `bg-black` |
| 2470 | Configuração | Média | aberto | `configuracao/migracao/PreparacaoMigracaoPainel.tsx:22` regra do ID de aluno só no clique de "Preparar lote"; os selects não marcam coluna já usada |
| 2488 | Configuração | Média | parcial | `configuracao/migracao/[loteId]/AplicarVinculoMigracao.tsx:90` fuso por `CampoFuso`; `:62` ainda `setErro(erros[0])`, um erro por vez no rodapé (`:103`) |
| 2500 | Configuração | Média | aberto | `configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx:13` datas forçadas em `timeZone:"UTC"` com sufixo " UTC", inclusive no select da aula |
| 2522 | Configuração | Média | parcial | `configuracao/whatsapp/ReguaComercialPainel.tsx:103-115` só a resposta mais recente vale (controle de corrida); segue sem debounce, sem "buscando"/"nenhum lead" e sem `role="combobox"` (`:285-300`) |
| 2402 | Configuração | Baixa | resolvido | `configuracao/turmas/ImportarTurmasModal.tsx:5` usa `Modal`; nenhum `shadow-*` em `configuracao/turmas` |
| 2415 | Configuração | Baixa | aberto | `configuracao/usuarios/UsuariosPainel.tsx:32,99` "(horário exibido em X; origem UTC)" repetido em cada linha de "Último acesso" |
| 2505 | Configuração | Baixa | aberto | `configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx` três `<p role="alert">` sem classe e `<MensagemStatus texto={ok} />` sem estilo |
| 2553 ¹ | Público e portal | Média | resolvido | `app/login/page.tsx:45` volta para `callbackUrl` interno; `server/_shared/sessao.ts:133-141,158,165` o guard monta o login com volta (#172) |
| 2567 ¹ | Público e portal | Média | resolvido | `app/pagar/[token]/quadro.ts:64-77` quadro próprio para link inválido ou expirado, paga, cancelada, vencida e pendente (#172) |
| 2605 | Público e portal | Média | aberto | `app/portal-aluno/page.tsx:19` dois links sublinhados com `ml-4` e "Sair" com a mesma aparência (`sair.tsx`), sem área de toque |
| 2606 ¹ | Público e portal | Média | aberto | `app/portal-aluno/sair.tsx:8` `await fetch(...)` sem checar `ok` nem `catch`; `router.replace` sempre |
| 2629 | Público e portal | Média | resolvido | `app/portal-aluno/ativar/page.tsx:25,99` "e-mail validado" é sucesso via `FeedbackAcao`, separado do erro (#172) |
| 2681 | Público e portal | Média | aberto | `app/portal-aluno/reposicoes/[id]/video-gravacao.tsx:18,20` `onError` no `<video>` com a fonte em `<source>` filho; o handler não dispara |
| 2570 | Público e portal | Baixa | resolvido | `app/pagar/[token]/requisicao.ts:15,18` mensagem própria em vez de `corpo.erro`; `PagarCliente.tsx:36,41` botão vira "Tentar de novo" e `FeedbackAcao` (#172) |
| 2607 | Público e portal | Baixa | aberto | `app/portal-aluno/page.tsx:19` vazio diz só "Não há reposições para este acesso." |
| 2712 ¹ | Público e portal | Baixa | parcial | `preferencias/FusoExibicaoFormulario.tsx:27` sucesso via `FeedbackAcao`; botão "Salvar preferência" segue `variante: "secundario"` |

#### 7.6.7 Casos limítrofes e decisões

- **Resolvidos por um caminho diferente do sugerido:**
  - **L669:** o `<h1>` da proposta de substituição continua genérico. O código e o aluno aparecem no cabeçalho do `[id]/layout.tsx`, acima dele. É o mesmo critério do L268 na §7.3.6.
  - **L1005:** não há fallback (`?? t.status`), mas `STATUS_TURMA_LABEL` é `Record<StatusTurma, string>`. Um status novo sem rótulo não compila, então o "undefined" na tela não acontece.
  - **L2220 e L907:** o fuso usa `CampoFuso` (input + datalist), e não um `<select>`. Mesmo assim, o erro de digitação é barrado no cliente, que era o defeito.
  - **L2567:** `quadro.ts` trata link inválido ou expirado, paga, cancelada, vencida e pendente. Uma cobrança `PENDENTE` com vencimento já passado, ainda não marcada como `ATRASADO`, aparece como pendente. Isso depende de como o status é gravado no servidor, e não da tela.
- **L1026:** reclassificação, com o mesmo critério de L1645 na §7.4.
- **Parciais pela borda de rota (L1505, L1544, L1764):**
  - o `academico/loading.tsx` e o `academico/error.tsx` da #174 cobrem a rota por herança;
  - mas o loading só reaparece quando muda o filho direto de `/academico`, e não na troca de query string nem na navegação dentro de `recuperacoes/…` ou `segundas-chamadas/…`;
  - L1764 pedia `loading.tsx` e `error.tsx` no segmento. O erro ficou coberto e o loading, em parte.
- **L1976 está pior do que o doc 42 descreve.** `new FormData(evento.currentTarget)` sem o submitter não leva o `operacao` do botão (`ReposicaoDocente.tsx:36,40`). Assim, "Pedir correção ao aluno" também cai em concluir a reposição.
- **L694:** o checkbox de conferência é `required` desde a base (`1ca53675`). O defeito que o achado aponta, sem `name` e com "Aprovar" como `<option disabled>`, continua igual.
- **L2246 (parcial):** a lista de coberturas passou a ter paginação com total, então o corte silencioso em 100 acabou. Busca e filtro por vendedor ou período continuam ausentes.
- **L2522 (parcial):** a busca do piloto ganhou controle de corrida ("só a resposta mais recente vale"). Faltam debounce, o estado "buscando/nenhum" e a semântica de combobox.
- **Vistos de passagem, fora do defeito do achado:**
  - a tabela de impacto de `financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx` (L2045) imprime `{c.tipo}` cru;
  - em `academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/page.tsx:17`, o bloqueio novo explica vínculo e matrícula inativos, mas não o saldo zerado do L1672.

#### 7.6.8 Como reproduzir

```
git checkout 4c4f526a
node scripts/medicao-ux/amostra.mjs 6 3 20261013   # a amostra nova de 126
node scripts/medicao-ux/amostra.mjs 6 3 42         # para conferir a sobreposição (21 linhas)
```

A estimativa usa `estimativaEstratificada` (`scripts/medicao-ux/nucleo.mjs:247`) sobre as contagens da tabela 7.6.3, com as populações de `achadosDoRepositorio()`, como na §7.3.7.
