# Incremento 609 — auditoria de aceite e regressão atual

## Estado

Auditoria em andamento. Este incremento não declara entrega integral nem percentual global da SPEC. O inventário preliminar reúne 122 critérios e mantém referências para inspeção independente.

## Evidência executada

- Regressão unitária atual: 1.214 testes aprovados, zero falhas e zero pendentes. Relatório: `docs/validacao-unitaria-609-2026-09-16.json`.
- Regressão de integração: execução 28347 invalidada por alteração de node_modules durante a execução (Vitest deixou de encontrar suppress-warnings.cjs). Processo encerrado com código 1. Não há aprovação global; requer nova execução com dependências estabilizadas.
- Consolidador `scripts/consolidar-auditoria-spec.py` valida identificadores únicos, estados, texto e existência dos caminhos de código/testes antes de gerar JSON e Markdown. A primeira execução identificou três referências inexistentes no levantamento comercial; referências corrigidas após revisão pelo auditor. Consolidação final executada com sucesso: 122 critérios com texto e caminhos válidos.

## Lacunas comprovadas em leitura

- P02: não localizada implementação de acordo/contrapartida/compensação por permuta.
- N01: identidade possui callback de entrega e referência explícita a futuro despachante Resend; isso não prova integração real com o fornecedor.
- F07.7, revogação: rotas retornam o stream original após autorização inicial. Próxima requisição confere novamente, mas não há interrupção por revogação do stream já aberto.
- F07.7, versão: adaptador confere metadados e Range, mas não vincula os trechos à mesma revisão do conteúdo no Drive.

## Revisões da auditoria

Ausência de um único teste abrangente não prova falta de implementação: conjuntos de testes pertinentes podem sustentar um critério. Inspeção incompleta usa `nao_auditado`; `parcial` requer identificar a parcela que falta. Alegação inicial de ausência do portal acadêmico foi contestada e corrigida após inspeção dos serviços/tela/testes existentes. Não usar contagens preliminares como percentual definitivo.

## Continuidade

Concluir o processo de integração sem iniciar outro em paralelo; revisar falhas reais. Reconciliar ampliações e requisitos transversais com os critérios originais. Corrigir lacunas funcionais e manter separadas a validação local e as homologações reais de serviços.
