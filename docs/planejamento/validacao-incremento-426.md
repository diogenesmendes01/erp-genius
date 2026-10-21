# Incremento 426 — persistência e revisão do fechamento acadêmico

Data: 14/09/2026. Implementação local; objetivo integral permanece ativo.

## Implementado

- `FechamentoAcademico` registra versões por matrícula/nível, vínculo de referência, regra, snapshot, fontes, frequência, elegibilidade e autoria. Histórico protegido contra alteração e exclusão.
- Revisão e confirmação por Gestão Pedagógica/Administração. Q154 não acrescenta uma segunda aprovação somente para confirmar o resultado; as aprovações de notas permanecem independentes.
- Conferência do vínculo mais recente, hash de fontes e versão anterior. Resultado pendente não é gravado; resultado completo insuficiente pode ser finalizado sem liberar progressão. Correção posterior invalida a atualidade da versão anterior e permite novo fechamento, preservando ambos.
- Frequência agregada dos vínculos históricos da mesma matrícula e nível, sem duplicação. Legados ambíguos e sobreposições exigem conferência. Encontros futuros não criam presença/falta e impedem fechamento prematuro.
- Tela de revisão e confirmação com resultados por habilidade, mínimos, frequência, pendências e indicação da atualidade do último fechamento.
- Teste real de transferência sucessiva A→B→C, preservando referências e composição sem criar lançamento duplicado.

## Evidências

- Migração `20260915019000_fechamento_academico` aplicada somente ao PostgreSQL local descartável pelo setup de integração. Prisma Client gerado; comparação banco/schema vazia.
- **10/10 integrações** de fechamento, frequência por nível e aproveitamento: `docs/validacao-fechamento-integrado-426-2026-09-14.json`.
- Suíte de fechamento ampliada e repetida: **4/4**, incluindo bloqueio de update/delete, acesso administrativo, atualidade estável e versão 2 após correção preservando a versão 1. `docs/validacao-fechamento-versoes-426-2026-09-14.json`.
- Frequência: primeira rodada 2/3 por matcher interpolado incorretamente na expectativa do teste; corrigido o matcher, **3/3**, sem alterar produção para acomodar a falha. Relatórios `docs/validacao-frequencia-nivel-426-2026-09-14.json` e `docs/validacao-frequencia-nivel-426-corrigido-2026-09-14.json`.
- ESLint direcionado, TypeScript e build completo aprovados. Nova rota dinâmica de fechamento; 62 páginas estáticas geradas. Não houve validação visual em navegador.

## Ainda necessário

A exceção independente de frequência não está integrada nesta persistência. Aprovação e execução de progressão ainda precisam exigir o fechamento suficiente e atual; correções após progressão precisam de pendência de revisão. O portal ainda apresenta acompanhamento parcial e precisa incorporar a leitura segura do fechamento. Recuperação após aproveitamento possui lógica, mas ainda exige cenário próprio de integração. Esses itens impedem declarar Q154 e a SPEC integralmente concluídos. Não houve operação em produção nem envio externo.
