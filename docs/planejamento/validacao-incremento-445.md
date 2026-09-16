# Incremento 445 — preparação versionada de correção de aula

Data: 14/09/2026. Meta integral ativa. Q23 continua em implementação.

Foram adicionadas as ações `revisarCorrecaoAula` e `proporCorrecaoAula`, snapshots tipados e o modelo `PropostaCorrecaoAula`. A migração 203 foi aplicada somente ao banco descartável. A proposta guarda o estado anterior, alteração, autor, motivo, evidência, versão, hashes e chave de repetição. Não atualiza diário, presença ou encontro.

A revisão exige AULA MINISTRADO encerrada, diário coerente e registros com matrícula/classificação identificadas. Gestão ativa pode preparar; professor precisa continuar responsável e vinculado. A alteração recebe IDs dos registros, sem permitir troca de aluno/contrato, inclusão ou omissão de registros; presença é derivada da classificação. A fonte de gravação existente permanece no snapshot (última exceção aprovada, quando houver); ausência de fonte não é preenchida artificialmente.

Banco e serviço conferem identidade, versão e autorização. A proposta é imutável. Ações recusam estado obsoleto, reaproveitamento indevido de chave e proposta sem mudança. Duas propostas concorrentes da mesma versão não são aceitas juntas.

## Evidências

- Cinco testes de integração: `docs/validacao-correcao-aula-445-2026-09-14.json`. Cobrem preservação da fonte, replay, permissões, saída do professor, estado/versão antigos, identidade da chamada, no-op, concorrência e SQL inválido/imutabilidade.
- Três testes unitários em `correcao-aula-schema.test.ts`: identidade, classificação e rejeição de alterações estruturais.
- TypeScript, lint direcionado, diff check e build aprovados; 62 páginas estáticas.

## Integrações obrigatórias seguintes

Ainda não existe decisão/aplicação desta proposta nem interface para o usuário. Falta a fonte oficial versionada de gravação da aula e sua substituição aprovada, a projeção efetiva para todos os leitores, a conferência de dependências de reposição/frequência/financeiro/fechamento, casos de revisão e a proteção geral contra alteração direta das tabelas originais após conclusão. Não declarar Q23 funcional de ponta a ponta com base nestes testes. Nenhuma implantação em produção foi realizada.
