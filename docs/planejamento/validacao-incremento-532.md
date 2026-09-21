# Incremento 532 — composição do vencimento financeiro

Implementado `src/server/matricula/continuidade-vencimento-financeiro.ts`: combina cobertura contratual, referência do mês de vencimento (Q160), ajuste do dia inexistente (Q90), calendário financeiro explícito (Q99) e antecedência de emissão (Q64). Preserva preço e cobertura. A memória conserva data original, ajustada e identidade/versão da referência financeira. A antecedência é calculada sobre o vencimento ajustado.

Cinco testes passaram, incluindo fevereiro com vencimento transferido para março, referência do mês anterior, feriado, calendário insuficiente, cobertura irregular e antecedência inválida. Evidência: `docs/validacao-vencimento-financeiro-532-2026-09-15.json`. ESLint dos dois arquivos passou.

Este cálculo ainda não está conectado à prévia pública nem libera emissão. A revisão Terra confirmou os próximos pontos de integração:

- Ampliar regras contratuais em `continuidade-mensal-schema.ts`, preservando leitura das versões antigas explícitas MANTER_DATA.
- Nova migração após 870 para ampliar `conferir_regras_continuidade_completas`, hoje restrita a MANTER_DATA pela migração 840. Preservar aprovação independente e imutabilidade; validar também o calendário no banco.
- Guardar snapshot completo da referência financeira na versão contratual: identidade, versão, descrição, vigência, dias úteis e feriados. Não depender de cadastro mutável para reproduzir o cálculo.
- Adaptar `CondicoesContinuidadeMensal.tsx` para configurar a regra e a referência sem presumir país ou dias úteis. Exibir data original e efetiva na prévia.
- Conectar o cálculo à seleção da condição aprovada em `continuidade-estado-tx.ts`, preservando a comprovação específica da retomada e sem presumir Q161/Q162.
- Testar persistência, rejeições diretas no banco, versões históricas e prévia completa. Futuras cobranças precisarão conservar a memória aplicada.

Não houve alteração de produção, envio externo ou teste de interface. Q161/Q162 continuam pendentes e não foram inferidas.
