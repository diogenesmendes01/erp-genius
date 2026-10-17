# Decisões do dono do produto — 17/10/2026

Registro das decisões tomadas pelo dono do produto em 17/10/2026. O resumo e o estado de cada item ficam no
[quadro único](quadro-entregas.md), seção "Decisões do dono 17/10/2026".

## Q7 — estorno de comissão

- **Decisão:** o estorno de comissão continua **manual**, feito por FINANCEIRO ou ADMINISTRADOR, com motivo
  obrigatório e auditoria.
- **Descartado por enquanto:** o estorno automático no cancelamento da matrícula. O motivo são os casos de borda:
  desistência dentro do prazo, troca de turma e reativação.
- **Para avaliar no futuro:** uma sugestão automática de estorno que o Financeiro confirma. Não está no escopo atual.
- **Consequência:** a pendência bloqueante da Q7 no bloco F2-I (gate da Task 35) fica resolvida a favor do que o PR
  já entrega: estorno manual com a matriz da Task 4. A Task 35 continua no PR.

## Q6 — versão do React no Inbox novo

- **Decisão:** a Fase 3 fica no React 18.3.
- **Depois:** a migração para o React 19 vira um PR separado, depois das Fases 3 e 4.
- Registro detalhado: [decisao-react-inbox.md](decisao-react-inbox.md).

## LC-D02 × doc 36 — quem vê a conversa da linha comercial

- **Decisão:** vale a LC-D02 ([SPEC-ERP-005](../specs/whatsapp-linha-comercial.md)). O dono da linha vê todas as
  conversas da própria linha. O painel e o cockpit do lead de outro vendedor continuam fechados.
- **Doc 36 atualizado:** a leitura de que "o dono do número não recebe histórico de outro vendedor" passa a ser "o
  dono da linha vê a conversa da linha; dados do lead e funil de outra carteira continuam fechados"
  ([doc 36](../36-politica-de-acesso-aprovada.md), seção "Linha comercial do WhatsApp").
- **Consequência:** o `c265d904` (teste `inbox.int.test.ts`, "lead de OUTRO vendedor vinculado ao número de A não
  vaza o cockpit": thread visível, com `lead` e `contato.leadId` nulos) recebe o aval do produto e não precisa ser
  revertido.

## Fuso horário — apelidos legados

- **Decisão:** `US/Eastern` deixa de ser sugerido e é trocado por `America/New_York`. Apelidos legados (`US/*`,
  `Brazil/*`) não existem num Postgres sem `tzdata-legacy`, e o trigger `validar_fuso_exibicao_266` recusa qualquer
  UPDATE da linha de `Usuario` ou `ContaPortalAluno` que guarde um deles.
- **Implementação (branch `claude/decisoes-dono-17-10`):**
  - As sugestões das telas de preferência (equipe e portal do aluno) trazem `America/New_York`.
  - Ao salvar a preferência, o servidor troca o apelido pelo nome canônico IANA, com um mapa pequeno e explícito
    (`APELIDOS_FUSO_LEGADOS` e `FusoPreferenciaSchema` em `src/server/operacao/fuso.ts`, com teste unitário).
  - A migration de dados `20261017150000_fuso_exibicao_canonico` converte os valores já gravados em
    `Usuario."fusoExibicao"` e `ContaPortalAluno."fusoExibicao"` com o mesmo mapa. Fusos de origem e snapshots
    (`fusoOrigem`, `fusoReferencia` etc.) não mudam, porque são registros históricos.
  - `fuso-exibicao.int.test.ts` passa a usar `America/New_York` no caso que gravava `US/Eastern` direto no banco.
    Ele ganha um caso que salva `US/Eastern` pela action e confere `America/New_York`.

## Transferência e `AULA_FORA_DE_VINCULO_CONFERIDO`

- **Decisão:** a transferência não deve travar o fechamento do nível.
- A implementação está em outro PR, que precisa da validação da secretaria acadêmica. Este registro só cita a
  decisão.
