# Fluxo de bugs — GitHub Issues + Projects

## Onde

Tudo no repositório do GitHub: **Issues** para reportar, **Projects** para acompanhar.
Não existe outra ferramenta. Bug, código e PR de correção ficam no mesmo lugar.

## Como abrir

1. Issues → New issue → template **Bug**.
2. Preencha todos os campos. Os obrigatórios travam o envio se vazios.
3. Anexe evidência: print, vídeo curto ou o trace do Playwright (arquivo `.zip` da pasta
   `test-results/`). Arraste para o campo de texto.
4. Nunca cole senha, token nem dado real de aluno na issue.
5. Se o roteiro marcou o cenário com 🐞 X#, cite o X# no título ou no primeiro parágrafo: a
   auditoria já tem a causa provável com arquivo e linha, e isso economiza o tempo do dev.

## Um bom relatório de bug

- **Título**: `[Módulo] O que acontece, em uma linha`. Ex.: `[Financeiro] Desconto de 12% aplicado direto por vendedor com limite 10%`.
- **Versão**: o `sha` de `/api/health` do UAT no momento do teste.
- **Passos**: numerados, do login até o erro, com o papel e o apelido do usuário (VEND-A, GP-2).
  Alguém que nunca viu o sistema tem de conseguir repetir.
- **Esperado vs obtido**: duas frases separadas.
- **ID do roteiro**: o cenário de `03-roteiro-testes-manuais.md` (ex.: `FIN-12`). Se não veio do
  roteiro, escreva "exploratório".
- **Severidade** (escolha uma):
  - **Crítico**: impede um fluxo principal (login, contratação, pagamento, lançamento de nota) ou
    corrompe dados. Sem contorno.
  - **Alto**: fluxo principal funciona com contorno, ou regra de negócio errada com impacto
    financeiro, acadêmico ou de permissão.
  - **Médio**: funcionalidade secundária errada, validação faltando, dado errado na tela.
  - **Baixo**: texto, alinhamento, cosmético.

## Etiquetas

Aplicadas pelo template e ajustadas pelo gestor:

| Grupo | Etiquetas |
|---|---|
| Tipo | `bug` |
| Severidade | `sev:critico`, `sev:alto`, `sev:medio`, `sev:baixo` |
| Módulo | `mod:acesso`, `mod:config`, `mod:crm`, `mod:inbox`, `mod:matricula`, `mod:alunos`, `mod:portal`, `mod:academico`, `mod:diario`, `mod:financeiro`, `mod:empresas`, `mod:aria` |
| Situação | `decisao-pendente` (comportamento ainda não decidido pelo PO), `nao-reproduz`, `duplicada`, `mapeado-auditoria` (tem X# na auditoria) |

Crie as etiquetas uma vez em Settings → Labels do repositório.

## Quadro (GitHub Projects)

Colunas, da esquerda para a direita:

| Coluna | Quem move | Significado |
|---|---|---|
| Novo | QA (automático ao abrir) | Aberto, ninguém olhou |
| Em análise | Gestor | Confirmado ou aguardando decisão |
| Corrigindo | Dev | Em desenvolvimento, PR aberto |
| Pronto para reteste | Dev | Deploy feito em UAT (conferir o `sha` em `/api/health`) |
| Fechado | QA | Reteste passou. Se falhou, volta para "Corrigindo" com comentário |

Regra: só o QA fecha. Um bug fechado sem reteste volta a abrir.

## Divergências doc × código

Quando o roteiro marca "decisão pendente (R#)", **não abra bug**. Registre o observado na planilha
do ciclo. Quando o gestor decidir, a decisão vira ou um bug (código errado) ou uma correção de doc
ou de SPEC (doc errado), e o roteiro é atualizado.

Se você encontrar uma divergência nova que não está na auditoria, abra a issue normalmente e
marque com `decisao-pendente`.

## Bloqueadores

Quando o roteiro marca 🛑 B#, não abra bug: o problema já está descrito em
`auditoria-consolidada.md` §2 com quem resolve. Marque o cenário como Bloqueado (B#) e siga.
