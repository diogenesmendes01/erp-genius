# Atualização dos documentos de status (13/10/2026): plano de implementação

> **Para agentes:** sub-skill obrigatória: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** levar para o repositório, numa PR só de documentação, o resultado da análise de 13/10/2026: o que está e o que não está publicado no UAT, a remedição da auditoria de UX e a análise das PRs #63–#161.

**Arquitetura:** três tarefas independentes, cada uma dona de um arquivo, executadas por 3 agentes em paralelo. **Os agentes não mexem no git.** Cada um grava o arquivo final em `<A>/final/`. O integrador faz a tarefa 4: copia os arquivos para a branch `claude/docs-status-20261013`, confere, commita e abre a PR.

**Tecnologia:** Markdown (pt-BR), `git show origin/main:<arquivo>` para conferir o código e `gh` só leitura.

**Fonte (a "spec"):** os relatórios de análise em `<A>/`. `<A>` é a pasta de trabalho local do integrador, fora do repositório. Os relatórios não são versionados; o conteúdo deles está no doc 44 e no doc 43 §7.
- `<A>\publicacao.md`: o que está e o que não está no UAT (#62, #65, branches, Coolify, risco de portar a #62).
- `<A>\prs-063-080.md`, `prs-081-098.md`, `prs-099-117.md`, `prs-118-138.md`, `prs-143-161.md`: análise PR a PR.
- `<A>\alta-01-48.md`, `alta-49-96.md`, `alta-97-145.md`: remedição dos 145 achados Alta.
- `<A>\amostra-media-baixa.md`: remedição da amostra de 126 achados Média/Baixa e a estimativa nova.
- `<A>\metricas-20261013.txt`: saída de `node scripts/medicao-ux/metricas.mjs` na `main` `e5418550`.
- `<A>\issues.tsv`: issues #139 em diante, com estado.

## Restrições globais

- Base medida: `origin/main` em **`e5418550`** (merge da #161). Toda evidência de código é conferida com `git show origin/main:<caminho>`.
- Idioma pt-BR, no mesmo tom dos docs existentes (`docs/43`, `quadro-entregas.md`): tabelas, frases diretas, sem jargão de marketing.
- **Nenhum dado sensível:** sem IP, URL com senha, token ou `DATABASE_URL`. **Nenhum caminho local:** sem `C:\Users`, `AppData`, `scratchpad` nem `analise/raw`.
- **Nada inventado.** Todo número e toda afirmação vêm dos relatórios de `<A>` ou de conferência própria na `main`. O que um relatório marcou como "por leitura de código, não visto rodando" continua com essa ressalva.
- Fatos que valem para os três documentos:
  - Tudo que entra na `main` é publicado automaticamente no **UAT**, o único ambiente; não há produção. O deploy é pelo Coolify, que roda `prisma migrate deploy` antes do app.
  - A **#62** (21 commits, 9 migrations, Q161/Q164/Q157/Q172/Q173/Q174/Q175/Q171/Q176, origem histórica, assinatura e validadores) **não está na `main`**: foi mergeada em `codex/consolidacao-specs-20260916` depois de a #61 levar essa branch para a `main`.
  - A **#65** não entrou na `main` pelo próprio merge, mas o conteúdo chegou pela **#66**.
  - **Achados Alta (145):** antes 37 resolvidos, 21 parciais e 87 abertos; agora **79 resolvidos, 26 parciais e 40 abertos**.
  - **Média/Baixa (727):** antes 71,1% abertos (IC 63,1–79,2%, ≈ 517); agora **58,9% (IC 50,3–67,5%, ≈ 428)**.
  - **Issues abertas:** #141 (só a parte B2, collation com acento no Postgres), #152 e #162. Fechadas: #139 (pela #147), #140 (#148) e #142 (#150).
  - **"Controles sem nome acessível = 69"** no script é **falso positivo**: 61 vêm de `FichaAluno` e `MatriculaFormulario`, que usam o spread `{...campo}` do `Campo`, que o script não segue; 7 são comentários em `Campo`, `CampoFuso` e `CampoTexto`. Sobra **1 candidato em `FichaLead`** para conferir.
- **Seções históricas não são reescritas.** No doc 43 e no quadro, só se **acrescenta**: uma seção nova e notas de ponteiro curtas.

## Foco da revisão

1. **Números iguais nos três documentos:** 79/26/40, 58,9% e o status da #62 têm de bater. Teste: a tarefa 4 compara com grep.
2. **Afirmação de agente copiada como fato sem conferência:** cada tarefa reconfere na `main` as afirmações marcadas como "pendência aberta hoje" antes de escrevê-las. Teste: passo de conferência por amostragem em cada tarefa.
3. **Vazamento de caminho local ou de dado sensível:** teste com grep na tarefa 4 e em cada tarefa.
4. **Seção histórica apagada ou alterada:** teste com `git diff --stat` e `git diff` mostrando só adições, fora das notas de ponteiro.
5. **Markdown quebrado:** tabela com `|` dentro de código sem escape, heading fora de ordem. Teste: contagem de colunas por linha de tabela na tarefa 4.

---

### Tarefa 1: `docs/44-analise-prs-63-161.md` (novo)

**Arquivos:**
- Criar: `<A>\final\44-analise-prs-63-161.md`. O integrador copia para `docs/44-analise-prs-63-161.md`.
- Ler: `<A>\publicacao.md`, `<A>\prs-*.md`, `<A>\issues.tsv`.

**Interfaces:**
- Produz:
  - o arquivo com estes headings de 2º nível, nesta ordem: `## 1. Resumo executivo`, `## 2. Método e limites`, `## 3. O que está e o que não está publicado no UAT`, `## 4. Issues de follow-up`, `## 5. Pendências abertas sem issue`, `## 6. Padrões de processo`, `## 7. Análise por PR`;
  - na §7, as subseções `### 7.1 PRs #63–#80`, `### 7.2 PRs #81–#98`, `### 7.3 PRs #99–#117`, `### 7.4 PRs #118–#138` e `### 7.5 PRs #143–#161`.

  As tarefas 2 e 3 citam o doc 44 por estes números de seção.

- [ ] **Passo 1: montar a §1 e a §2.**
  - **§1, Resumo executivo:** no máximo 15 linhas, em linguagem para o dono do produto. Cobre: 94 PRs, todas mergeadas; #62 não publicada (o que falta ao usuário); #65 publicada via #66; números da remedição; 3 issues abertas; os maiores riscos (testes de integração nunca rodados, PRs com migration sem revisão, merges sem APPROVE).
  - **§2, Método e limites:** fontes (docs 42/43, código da `main` `e5418550`, `gh` das PRs, `metricas.mjs`) e o que **não** foi feito: o UAT não foi aberto, não se sabe qual commit roda no UAT, os testes de integração não rodaram e as telas não foram vistas rodando.
- [ ] **Passo 2: §3, a partir de `publicacao.md`.** Mantenha o resumo executivo, a tabela da #62 por recurso, a #65, as branches, "Como a `main` vai para o UAT" e "Risco de portar a #62". Corte o que for repetição da §1. Tire qualquer IP ou caminho local.
- [ ] **Passo 3: §4, Issues de follow-up.** Tabela `| Issue | Origem | Estado | Fechada por | Situação real |` com #139, #140, #141, #142, #152 e #162. Use os dados de `issues.tsv` e este texto da situação real:
  - #141: B9 resolvido pela #149; B2 (collation/ICU) aberto;
  - #142: fechada pela #150, mas os C7–C9 da R3 da #138 ficaram sem issue;
  - #152: B7, B8 e B9 abertos, sem risco nas páginas atuais;
  - #162: 13 `*.int.test.ts` nunca rodaram e o código já está no UAT.
- [ ] **Passo 4: §5, Pendências abertas sem issue.** Junte as listas "pendências que continuam abertas hoje" dos 5 relatórios de PR, sem duplicatas e agrupadas em: **Operacionais** (#62, redeploy #127, script de reparo #131/#132, testes de integração nunca rodados), **Revisão** (PRs sem APPROVE válido ou sem revisão, com a lista exata), **Código** e **Documentação** (o quadro não foi atualizado desde #132; `docs/04-fase1-dominio.md:35` diz que os validadores "já vêm prontos" e não existem). Cada item tem PR de origem e evidência `arquivo:linha` na `main`. Antes de escrever, reconfira na `main` pelo menos 8 itens ao acaso com `git show origin/main:<arquivo>`; se um não se confirmar, corrija ou tire.
- [ ] **Passo 5: §6, Padrões de processo.** Cubra:
  - o CI só nasceu na #151, em 07/10;
  - autor e revisor são a mesma conta, então todo APPROVE aparece como COMMENT;
  - os merges sem APPROVE, contados por faixa;
  - a regra pós-R3 aprovada pelo usuário;
  - o modo leve de revisão desde a R3 da #154;
  - os 10 heads com tsc ou testes quebrados corrigidos pelo integrador (#143–#161);
  - o quadro de entregas não foi atualizado pelas PRs;
  - corpos de PR divergentes do diff (exemplos).
- [ ] **Passo 6: §7, Análise por PR.** Cole o conteúdo dos 5 relatórios, um por subseção 7.x, **descendo os headings um nível** (`#` vira `###`, `##` vira `####`, `###` vira `#####`). Tire linhas que só falam de caminho local, de `raw/` ou do processo do agente ("baixei os dados em…"). Não resuma: o pedido é análise rica em detalhes.
- [ ] **Passo 7: conferir.**
  - Rode `grep -nE "AppData|C:\\\\Users|scratchpad|analise/raw|raw143|168\.231|DATABASE_URL" <A>\final\44-analise-prs-63-161.md`; o esperado é nenhuma linha.
  - Rode `grep -c "^### 7\." <A>\final\44-analise-prs-63-161.md`; o esperado é 5.
  - Confira que os números "79 resolvidos, 26 parciais, 40 abertos" e "58,9%" aparecem como estão nas Restrições globais.
- [ ] **Passo 8: não commitar.** Avise o integrador com o caminho do arquivo e um resumo de 5 linhas.

### Tarefa 2: `docs/43-medicao-auditoria-ux.md` (acrescentar a §7 e notas)

**Arquivos:**
- Criar: `<A>\final\43-medicao-auditoria-ux.md`, que é o doc 43 inteiro já com as mudanças. Parta de `git show origin/main:docs/43-medicao-auditoria-ux.md`.
- Ler: `<A>\alta-01-48.md`, `alta-49-96.md`, `alta-97-145.md`, `amostra-media-baixa.md` e `metricas-20261013.txt`.

**Interfaces:**
- Consome: as seções do doc 44 (tarefa 1). Cite "doc 44 §3" para publicação e "doc 44 §7" para PRs.
- Produz: a seção nova `## 7. Remedição de 13/10/2026 (main e5418550)`, com `### 7.1 Métricas`, `### 7.2 Achados Alta (145)`, `### 7.3 Amostra Média/Baixa (126 de 727)`, `### 7.4 Correções a esta medição` e `### 7.5 O que falta (atualiza a §6)`.

- [ ] **Passo 1: notas de ponteiro.**
  - Logo abaixo da linha "Data: 07/10/2026…", acrescente: `> **Atualização de 13/10/2026:** remedição na main `e5418550` (depois da #161) na §7. As seções 1–6 abaixo continuam sendo a fotografia de 07/10.`
  - No início da §6, acrescente: `> Em 13/10/2026 os itens 1–7 desta lista já foram entregues (#153–#161); ver §7.5.`
  - Não altere nenhuma outra linha das seções 1–6.
- [ ] **Passo 2: §7.1, Métricas.** Tabela `| Métrica | 07/10 (§3) | 13/10 | Situação |` com estas métricas, comparando a §3 com `metricas-20261013.txt`:
  - paginação só para frente: 31/62 → 4/37;
  - campos de fuso fora do `CampoFuso`: → 0;
  - instantes crus na tela: 8 → 0 pelo critério antigo (1 falso positivo) e 0 pelo critério da trava;
  - `beforeunload`: 0 → 4;
  - `window.confirm`: 1 → 0;
  - `aria-invalid`: 22 → 37;
  - fluxos só com refresh: 41/169 (24%) → 40/172 (23%), longe da meta de < 10%;
  - `<Suspense>`: 0 → 0;
  - `loading.tsx`: 9 → 9;
  - famílias de contraste reprovando: 4 → 3 (#fff/--brand só em usos sem texto, --border e --brand-border decorativos);
  - controles sem nome acessível: "0 reais" → **69 no script, falso positivo** (explique como nas Restrições globais e cite o 1 candidato da `FichaLead`);
  - `<p>Nenhum…` cru: 9 → 10;
  - `outline-none` sem substituto: 42 → 43, com a mesma ressalva de especificidade da §3.
- [ ] **Passo 3: §7.2, Achados Alta.**
  - Abra com a tabela de contagens por faixa e o total (antes 37/21/87, agora 79/26/40) e a lista "o que mudou e por qual PR" (dos 3 relatórios).
  - Depois cole as 3 tabelas por achado, na ordem dos achados, com os agrupamentos de área. Mantenha as colunas dos relatórios.
- [ ] **Passo 4: §7.3, Amostra.** Inclua:
  - a estimativa nova e a anterior;
  - a diferença pareada (12,2 p.p., IC 6,4–18,0);
  - a ressalva de L270/L1645 (59,8% sem elas);
  - a contagem por estrato;
  - os padrões dos que continuam abertos;
  - a tabela por achado de `amostra-media-baixa.md` (§2, §3, §4 e §5 do relatório, com os headings descidos).
- [ ] **Passo 5: §7.4, Correções a esta medição.**
  - **L1070:** o link para o replanejamento já existia; o status "aberto" continua certo por outro motivo.
  - **L577:** o link morto para `/financeiro` continua em `emissao/page.tsx:23`.
  - **L1059:** o aviso ao sair cobre só F5, fechar a aba e sair do site.
  - **L1901:** a evidência diz que as cores sumiram; elas foram mapeadas.
  - **L270 e L1645:** o peso do título já vinha do `globals.css`.
  - **Atribuições erradas a PRs:** o `focus-visible` e o `--border-control` vieram da #65/#66, não da #71; `responsivo.test.ts` veio da #94, não da #75 (ver `prs-063-080.md`).
- [ ] **Passo 6: §7.5, O que falta.**
  - A §6 reescrita como estado atual: itens 1–7 entregues, com PR; os restantes de cada um (fatia B de confirmações, 23% só com refresh, 17 keys com versão, 26 históricos só para trás, 66 IDs crus e 12 telas sem identificação, pendências de fuso 1566/1747/406/1256); itens 8–11 não iniciados.
  - Os achados Alta ainda abertos, agrupados por padrão: inbox, portal do aluno (ativar/recuperar), confirmações ("Faltou", presença histórica, quantidade de aulas), lote de migração.
  - A métrica de fluxo 7.7 depende de um operador real.
- [ ] **Passo 7: conferir.**
  - Rode `diff <(git show origin/main:docs/43-medicao-auditoria-ux.md) <A>\final\43-medicao-auditoria-ux.md | grep '^<' | head`; o esperado é nenhuma linha removida, só adições. Se precisar ajustar uma linha existente, avise o integrador.
  - Rode o mesmo grep de dados sensíveis e caminhos locais da tarefa 1; o esperado é nenhuma linha.
  - Some as contagens das 3 tabelas: tem de dar 145 achados e 79/26/40.
- [ ] **Passo 8: não commitar.** Avise o integrador com o caminho e as contagens.

### Tarefa 3: `docs/planejamento/quadro-entregas.md` e `docs/04-fase1-dominio.md`

**Arquivos:**
- Criar: `<A>\final\quadro-entregas.md`, que é o quadro inteiro já com as mudanças. Parta de `git show origin/main:docs/planejamento/quadro-entregas.md`.
- Criar: `<A>\final\04-fase1-dominio.md`. Parta de `git show origin/main:docs/04-fase1-dominio.md`.
- Ler: `<A>\publicacao.md`, `<A>\prs-118-138.md`, `<A>\prs-143-161.md`, `<A>\issues.tsv`.

**Interfaces:**
- Consome: os números de seção do doc 44 (tarefa 1) e do doc 43 §7 (tarefa 2).
- Produz: a seção nova `## Situação em 13/10/2026 — publicação no UAT e auditoria de UX`, logo depois do título `# Quadro único de entregas`, antes de `## Integração da main na PR #61`.

- [ ] **Passo 1: Publicação.** Quatro pontos:
  - a `main` vai para o UAT pelo Coolify, que roda `migrate deploy` e não espera o CI;
  - o repositório não registra qual commit está no UAT, então isso se confere no painel do Coolify;
  - a **#62 não está publicada**: liste os recursos;
  - a #65 está publicada via #66.

  Termine com: as linhas Q164, Q165, Q167, DCT03 e ACA desta tabela de 18/09 ficaram desatualizadas, porque as decisões de 21/09 foram implementadas na #62, que não foi publicada (doc 44 §3).
- [ ] **Passo 2: Entregas desde a #133.** Tabela `| PR | Entrega | Merge (commit, data) | Verificação | Pendências |` de **#133 a #161**, uma linha por PR. Os números #139–#142, #152 e #162 são issues e não entram na tabela. A coluna "Verificação" traz tsc, suíte e mutações, com os números dos relatórios, e diz se houve APPROVE ou se entrou pela regra pós-R3. Esta tabela cumpre a regra do AGENTS.md: "commit por funcionalidade, com evidências e pendências no quadro único".
- [ ] **Passo 3: Tarefas operacionais pendentes.**
  - rodar os 13 testes de integração (#162), mais `route.int.test.ts` e os `int` da inbox e do diário que nunca rodaram;
  - redeploy da #127;
  - script de reparo dos nomes de contato (#131/#132) no UAT;
  - revisar as migrations da #131 e da #132, que entraram sem revisão (a da #131 tem `UPDATE`);
  - decidir como portar a #62 (recomendação do doc 44 §3);
  - collation com acento (#141 B2), que depende do integrador.
- [ ] **Passo 4: Issues abertas e próximos itens.** Liste #141, #152 e #162, e os itens 8–11 do doc 43 com ponteiro para o doc 43 §7.5.
- [ ] **Passo 5: `docs/04-fase1-dominio.md:35`.** Corrija só a frase "Os comuns já vêm prontos". Diga que os validadores nomeados estão especificados, que estavam no pacote da #62 (não publicado) e que hoje não existem na `main`, com ponteiro para o doc 44 §3. Antes de escrever, confira na `main` que não há `src/lib/validacao.ts` nem validadores `curp`/`cedula_cr`/`dni_ar`: rode `git ls-tree -r --name-only origin/main | grep -i valid` e `git grep -n "cedula_cr\|dni_ar\|curp" origin/main -- src`.
- [ ] **Passo 6: conferir.**
  - O diff do quadro contra a `main` tem de mostrar **só adições**.
  - O diff do doc 04 tem de mostrar só a frase trocada.
  - O grep de dados sensíveis e caminhos locais tem de dar nenhuma linha.
  - Toda PR de #133 a #138 e de #143 a #161 tem de aparecer na tabela; confira com `grep -oE "^\| #1(3[3-9]|4[3-9]|5[0-9]|6[01]) " | sort -u | wc -l`, que deve dar 24 (#133–#138 e #143–#161, sem a #152, que é issue).
- [ ] **Passo 7: não commitar.** Avise o integrador com os caminhos.

### Tarefa 4 (integrador): juntar, conferir, commitar e abrir a PR

**Arquivos:** copiar os 5 arquivos de `<A>\final\` para a branch `claude/docs-status-20261013`, que já foi criada a partir de `origin/main` `e5418550`. São eles: `docs/44-analise-prs-63-161.md`, `docs/43-medicao-auditoria-ux.md`, `docs/planejamento/quadro-entregas.md`, `docs/04-fase1-dominio.md` e este plano, em `docs/superpowers/plans/`.

- [ ] **Passo 1:** copiar e rodar `git diff --stat origin/main` (esperado: 5 arquivos, só `docs/`).
- [ ] **Passo 2:** a consistência dos números. Rode `grep -n "79 resolvidos\|79/26/40\|58,9" docs/44-*.md docs/43-*.md docs/planejamento/quadro-entregas.md`; os três documentos têm de concordar.
- [ ] **Passo 3:** dados sensíveis e caminhos locais. Rode `grep -rnE "AppData|C:\\\\Users|scratchpad|analise/raw|168\.231" docs/`; o esperado é nenhuma linha nova.
- [ ] **Passo 4:** tabelas. Um script node conta as colunas de cada linha `|` de cada tabela e compara com o cabeçalho; não pode haver diferença.
- [ ] **Passo 5:** `git commit` com a mensagem `docs: status de 13/10 — publicação no UAT, remedição da auditoria de UX e análise das PRs #63–#161`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Depois, `push` e `gh pr create` para a `main`, com corpo em pt-BR terminando com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] **Passo 6:** esperar o CI verde e a revisão, pelo fluxo usual.
