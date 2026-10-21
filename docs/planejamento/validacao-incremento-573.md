# Incremento 573 — histórico administrativo de reservas de segunda chamada

Criada consulta e página próprias para a Gestão Pedagógica/Administração. A consulta percorre todas as reservas do vínculo/matrícula/turma/avaliação, inclusive reservas anteriores da mesma proposta. Mostra estado, reserva e autoria, encontro, ocorrência com data do fato e do registro, motivo/evidência e realização com autoria/evidência. Não confunde realização com nota oficial nem interpreta impedimento histórico como resolvido.

O cursor precisa pertencer ao mesmo escopo; ordenação usa data da reserva e ID como desempate, com páginas de 20 registros. A consulta revalida a gestão ativa após o bloqueio do contexto. Não libera este histórico administrativo a professor ou vendedor, nem inclui dados financeiros. A interface oferece retorno, primeira página e reservas anteriores, exibindo datas no fuso institucional informado pelo servidor.

## Evidências e limites

Duas integrações direcionadas aprovadas em `docs/validacao-historico-573-2026-09-15.json`: preservação de impedimento após nova reserva da mesma proposta, consulta por cursor, rejeição de cursor de outra avaliação, professor/vendedor/inativo negados, acesso administrativo e realização sem nota inventada. Lint aprovado. A inspeção do código da página encontrou links com interpolação escapada; foram corrigidos antes da validação final. Build final com TypeScript aprovado em `docs/validacao-build-final-573-2026-09-15.log`.

Não houve ensaio interativo nem validação visual em navegador. O teste de cursor cobre passagem entre duas reservas; a fronteira de 20 registros não foi exercitada nesta rodada. A revisão adicional de exportações não encontrou falha concreta, mas não comprova auditoria integral de todos os papéis e endpoints. Sem migrations, produção, envios ou dados reais.

Q164 segue pendente; não foi implementada resolução presumida do impedimento. Proteção completa e alterações de encontros PREVISTO continuam na fila. SPEC geral permanece incompleta.
