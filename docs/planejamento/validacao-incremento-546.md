# Incremento 546 — histórico de autorizações de preparação

A gestão consulta o histórico por vínculo acadêmico, com motivo, autoria, data, prazo e quantidade de propostas vinculadas. A página usa paginação de 20 registros, permite avançar e retornar à primeira página e mantém a identificação da matrícula/turma. A entrada permanece disponível à gestão mesmo quando o vínculo não permite conceder uma nova autorização.

A consulta autentica e reconfere o gestor na transação; não exige matrícula ativa para ler fatos históricos. Filtra pelo vínculo solicitado e projeta apenas campos de apresentação. Não retorna snapshot, hash ou dados internos de autorização. A leitura usa uma transação com snapshot consistente para os registros daquela página.

Teste integrado aprovado em `docs/validacao-historico-preparacao-546-2026-09-15.json`: rejeição docente, 21 autorizações distribuídas em duas páginas sem repetição, identificação de proposta vinculada, ausência de campos internos e isolamento de outro vínculo. Um cenário aprovado, 92 não selecionados. ESLint e build aprovados (`docs/validacao-build-546-2026-09-15.log`).

Limites: não houve ensaio interativo. Ainda faltam cenários adicionais de encerramento e conferência de ponta a ponta de Q151; esta consulta não concede qualquer autorização nem reativa matrícula. Sem operação de produção.
