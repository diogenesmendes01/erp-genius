# Incremento 517 — término aprovado de falta de oferta (Q156)

15/09/2026. Banco, ações e interface implementados por agentes Terra, revisão e integração pelo orquestrador.

Secretaria/Gestão Pedagógica/Administração propõe o último dia indisponível de um relato positivo ainda aberto. Outra pessoa da Gestão Pedagógica/Administração aprova ou rejeita, com motivo e evidências. A aprovação registra o fim efetivo sem atualizar o relato original, reativar matrícula ou emitir/ajustar cobranças. Uma rejeição permite nova proposta. Intervalo originalmente fechado exige o fluxo de correção, ainda pendente em Q157.

Proposta e decisão são fatos imutáveis em tabelas próprias. Guards no banco e ações revalidam papéis ativos, impedem autoaprovação mesmo com acúmulo de papéis e serializam por calendário/matrícula/relato. Cada relato permite uma proposta pendente; depois de aprovado não aceita novo término. Repetições idênticas não duplicam proposta, decisão ou evento.

A consulta de indisponibilidade usa o fim aprovado de forma inclusiva: no último dia o relato ainda é considerado, no seguinte deixa de atingir aquele intervalo. Outros relatos sobrepostos continuam independentes. O histórico mostra o término aprovado e preserva a informação original. A ausência de relato aplicável não comprova disponibilidade de oferta nem autoriza emissão recorrente.

Interface em `/matriculas/[id]/indisponibilidade-oferta/[registroId]/termino`, com conferência de vínculo matrícula/relato, permissão para propor/decidir, histórico paginado, chave de repetição e instantes no fuso institucional. Financeiro consulta, sem propor ou decidir.

## Validação

- Migração 780 aplicada somente ao banco descartável; Prisma gerado.
- Quinze integrações aprovadas em três arquivos: `docs/validacao-integracao-517-2026-09-15.json`.
- Cenário mensal com contrato, ativação e prévia revalidado: um caso executado e 34 não selecionados, `docs/validacao-continuidade-517-2026-09-15.json`.
- ESLint focado e build aprovados (`docs/validacao-build-517-2026-09-15.log`).
- Testes simultâneos fixam apenas a sessão inicial para evitar a limitação conhecida do mock de importação de NextAuth. Transações, locks, regras e guard fresco dentro da ação permanecem reais.

## Limites

Sem ensaio interativo da interface, provedor real, produção ou efeito financeiro automático. Q157 ainda aguarda decisão. Emissão recorrente, compensação dos dias e regularização de cobranças continuam necessárias para concluir FIN-02 e a SPEC integral. Q156 não autoriza substituir uma data de término já aprovada por outra.
