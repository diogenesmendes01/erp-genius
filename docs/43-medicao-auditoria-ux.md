# Medição da auditoria de UI/UX (doc 42) — quanto foi resolvido

Data: 07/10/2026. Código medido: `origin/main` em `6b105093` (depois da #138). Linha de base: `1ca53675`, o `main` que a auditoria leu. O merge da auditoria (`9bd583d2`) já continha a #64, então não serve de base. Escopo: as PRs #64–#138 (ganhos rápidos 1–24 e projetos E1–E8).

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
