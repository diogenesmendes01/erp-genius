# Incremento 449 — regra publicada e reposição na simulação

Data: 14/09/2026. Meta integral ativa.

A fixture de Q23 agora publica uma regra por preparação/aprovação independentes antes de criar a turma, que recebe a regra automaticamente. O teste da revisão pública confere o mínimo dessa versão nas duas apurações, o resultado insuficiente/suficiente e a estabilidade do hash ao repetir a conferência sem alterar dados. O percentual da fixture não define a configuração de produção.

Outro cenário persiste uma reposição por gravação autorizada, designação docente, entrega e conclusão válidas. A revisão calcula a frequência original com uma regularização e a simulada com uma presença, mantendo uma única aula contabilizada. Sinaliza conferência da reposição e preserva a conclusão e a chamada originais.

## Evidências e limites

- Oito integrações aprovadas em `docs/validacao-regras-reposicao-449-2026-09-14.json`.
- TypeScript, lint do arquivo e diff check aprovados. Apenas testes/documentação alterados; build aprovado no incremento 448.
- Este cenário de reposição cobre gravação válida. Outras ocorrências e a aplicação definitiva ainda precisam de validação combinada.
- Q23 ainda não possui decisão/publicação, projeção efetiva, integração financeira/material completa, casos persistidos nem interface. Nenhuma implantação em produção foi feita.
