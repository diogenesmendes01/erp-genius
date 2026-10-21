# Incremento 579 — exceção de calendário e acesso ao histórico de remarcações

## Entrega

Q19 foi integrada à remarcação de segunda chamada. A proposta registra a justificativa específica, o calendário publicado, a versão, o fuso institucional e os períodos não letivos afetados. A decisão independente exige autorização explícita da exceção quando há período afetado. Não basta aprovar genericamente a remarcação, e a rejeição não autoriza exceções.

O servidor e a migration 122 reconferem a referência de calendário. Mudanças entre proposta e decisão impedem aplicação e exigem nova proposta. A referência canônica dos períodos vem do helper SQL, evitando comparação divergente por ordenação de identificadores. Aprovações continuam aplicando remarcação na mesma transação, com as proteções da migration 121 preservadas.

Colunas novas permanecem nulas para registros anteriores. Eles não foram reinterpretados: decisões existentes continuam no histórico; propostas pendentes sem conferência não podem receber nova aprovação, embora possam ser rejeitadas.

A consulta de remarcações agora navega por todo o histórico usando a versão por reserva como cursor, com vinte itens por página e validação do pertencimento do cursor. A página oferece retorno à primeira página. O teste inclui uma nova versão inserida entre a leitura das duas páginas.

Foi criada a fila `/academico/segundas-chamadas/agendas`, acessível pelo menu acadêmico a Secretaria, Gerência Pedagógica e Administração. Ela permite encontrar a reserva e abrir sua remarcação sem expor notas, evidências ou informações financeiras. A fila também possui paginação e rótulos legíveis para os estados.

## Validação

- Migration `20260915122000_excecao_nao_letiva_remarcacao_segunda_chamada` aplicada somente ao banco local descartável. Prisma validate e geração do cliente concluídos. Não editar migrations 121/122 já aplicadas.
- **49 integrações aprovadas**, zero falhas e zero pendências, no arquivo de segunda chamada. Evidência: `docs/validacao-integrada-579-2026-09-15.json`.
- Os cenários novos cobrem exceção justificada com autorização explícita, tentativa direta no banco sem a autorização, imutabilidade da justificativa, mudança de calendário antes da aprovação, paginação com nova versão concorrente e acesso da Secretaria sem ampliação de dados. Professor e usuário inativo não recebem a fila administrativa.
- **10 testes unitários/SSR aprovados**, zero falhas. Evidência: `docs/validacao-unitaria-579-2026-09-15.json`.
- Lint direcionado sem erros/avisos e build de produção aprovado: `docs/validacao-build-579-2026-09-15.log`. Após o build houve apenas ajuste textual na apresentação de registros históricos para distinguir propostas pendentes de decisões já preservadas.

## Limites

Não houve navegação interativa nem envio de comunicação externa. A paginação da fila administrativa tem teste SSR e validação de cursor/permissão em integração; seu limite de vinte reservas ainda não recebeu cenário integrado com múltiplas páginas. A paginação das propostas de remarcação recebeu esse cenário.

A bateria global do incremento 574 precede estas alterações. Esta rodada cobre segunda chamada e as telas indicadas, não todos os módulos do ERP. Q164 e as demais pendências da SPEC continuam abertas. Não houve implantação ou importação de dados reais; o objetivo integral permanece em andamento.
