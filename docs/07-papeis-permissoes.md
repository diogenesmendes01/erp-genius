# Papéis e Permissões — ERP Genius

> O modelo de acesso do sistema. Vale para todas as fases.

## Princípio: a escola é uma só (sem divisão por país)

Os papéis **não são ligados a país nem região**. A distribuição geográfica de leads
acontece no **Meta Ads**, fora do sistema. Dentro do ERP, o acesso tem **duas camadas**:

1. **Função (role):** o que o papel permite fazer.
2. **Propriedade (row-level):** quais registros a pessoa enxerga.
   - **Vendedor:** só os leads que **adicionou ou que foram designados** a ele.
   - **Professor:** só as **turmas dele**.
   - Demais papéis enxergam a operação inteira dentro da sua função.

> Uma pessoa pode acumular vários papéis (papel é barato). Em time pequeno, o ADM
> pode acumular Gerente Pedagógico, etc.

## Os papéis (V1)

| Papel | O que faz | O que vê |
|---|---|---|
| **ADM** | Tudo: configuração, preços/estudos de mercado, liga/desliga países, regras, exceções de progressão | Tudo |
| **Gerente Comercial** | Supervisiona o comercial; **aprova descontos acima do limite** do vendedor; relatórios da equipe | Funil e relatórios de vendas (global) |
| **Gerente Pedagógico** | **Autoridade acadêmica**: define regras de progressão, abre turmas, aloca professores, **revisa exceções** de avanço | Acadêmico (global) |
| **Vendedor** | Negocia, coleta dados, gera link/transferência, gera contrato, envia DocuSign | **Apenas seus leads** (próprios/designados) |
| **Financeiro** | Confere transferências, mensalidades, inadimplência | Financeiro (global) |
| **Secretaria Acadêmica** | **Execução operacional**: papelada, documentos, **aloca aluno em turma**, mantém cadastro | Alunos/matrículas (global) |
| **Professor** | Dá aula, lança **notas e frequência** | **Suas turmas** |
| **Aluno** | 🔜 **V2** — portal do aluno (fora do escopo do V1) | Seus próprios dados |

## Decide vs. Executa (acadêmico)

Separação importante para não confundir "quem digita" com "quem decide":

- **Gerente Pedagógico = decide** (progressão, currículo, professores↔turmas).
- **Secretaria Acadêmica = executa** (aloca, registra, organiza papelada).
- **Professor = insere dados** (notas, frequência) que alimentam a decisão.

## Regra de progressão de nível (A1 → A2 → …)

- **Padrão: automática**, calculada por **frequência (faltas) + notas**.
- **Exceções / casos-limite:** revisadas manualmente pelo **ADM** ou **Gerente Pedagógico**.
- O sistema tem, portanto, uma **regra de avanço** que promove automaticamente e
  **sinaliza as exceções** para revisão humana (detalhar na Fase 3 — Acadêmico).

## Aprovação de desconto (gancho do comercial)

- **Limite de desconto em % POR usuário** (`limiteDescontoPct`) — **não** valor fixo (% funciona em qualquer moeda;
  "$20" não faz sentido entre ₡25.000 e $50). Ex.: João 5% · Mariana 10% · Gerente Comercial 20% · **Admin sem limite**.
- Acima do limite → **envia para aprovação** do Gerente Comercial ou Admin (tela de Aprovações).
- Mesmo que todos comecem em 10%, o campo por usuário permite **diferenciar depois**.

## Modelo de dados (acesso)

> ⚠️ **No schema atual (V0)** o multi-papel é um **array de enum** em `Usuario.papeis: Papel[]`
> — **não** existe tabela `UsuarioPapel` (essa é a evolução **V2**, quando surgir escopo por
> país; ver [`02`](02-arquitetura.md) e [`11`](11-modelo-de-dados.md)). O bloco abaixo descreve
> o destino V2, não o atual.

```
Usuario     (id, nome, email, senhaHash, ativo, limiteDescontoPct, papeis: Papel[])  # null = sem limite (Admin)
# enum Papel: ADMINISTRADOR · GERENTE_COMERCIAL · VENDEDOR · GERENTE_PEDAGOGICO · PROFESSOR · FINANCEIRO · SECRETARIA_ACADEMICA
# V2: extrair para UsuarioPapel(usuarioId, papelId) quando houver escopo por país
Lead        (..., vendedorDonoId)               # define a visibilidade do vendedor
Turma       (..., professorId)                  # define a visibilidade do professor
```
