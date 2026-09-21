# Cobertura global auditável — incremento 497

Data: 15/09/2026. Este registro não estima porcentagem global. A matriz abaixo usa os macrorequisitos REQ-01–18 como denominador auditável de acompanhamento, mas não como peso de percentual: contar Q01–Q154, arquivos, migrations ou testes produziria uma porcentagem enganosa.

## Denominador disponível

O denominador macro explícito é **18 requisitos REQ-01 a REQ-18** na tabela central da [SPEC](../specs/erp-educacional.md). Eles não têm peso igual; esta matriz não calcula porcentagem.

Resultado deste levantamento documental preliminar: **14 frentes com entregas parciais descritas e 4 sem evidência suficiente de fechamento**. Isto não significa 14/18 do trabalho implementado: cada frente possui capacidades, integrações e critérios próprios. A auditoria integral do código por requisito ainda não foi executada nesta matriz. Ausência de comprovação de conclusão não significa ausência de implementação.

| REQ | Estado | Evidência atual / lacuna | Próxima prova faltante |
|---|---|---|---|
| 01 B01 | Parcial | `implementacao-b01.md` registra vínculo por matrícula, cobertura, pausa e retomada; ainda declara consumidores globais/múltiplos vínculos pendentes. | Jornada por matrícula com todos consumidores. |
| 02 B02 | Parcial | Recebimentos, créditos e acertos têm fluxos próprios no B01; devolução/encerramento integral não é comprovado pela matriz atual. | Cenário integrado de encerramento, crédito e devolução. |
| 03 F07.1 | Parcial | Calendário e exceções possuem increments/evidências; a SPEC mantém impactos globais pendentes. | Aprovação/aplicação global com impactos. |
| 04 F07.2 | Parcial | Grade, encontros e reservas constam em B01/F07; não há prova central de todos limites/fusos. | Cenário ponta a ponta de geração/publicação. |
| 05 F07.3 | Parcial | Remarcações/cancelamentos específicos existem; mudanças globais completas continuam declaradas pendentes. | Aplicação coletiva revalidada. |
| 06 F07.4 | Parcial | Diário, Q23–25 e regularização tiveram incrementos; SPEC registra gravação/correção integral pendentes. | Conclusão oficial de aula com todos efeitos. |
| 07 F07.5 | Parcial | Cobertura, pausa e recorrência possuem código B01; encerramento proporcional completo não tem evidência atual única. | Encerramento por matrícula com acerto. |
| 08 F07.6 | Parcial | Reposições, cotas e recuperação possuem evidências 371–394. | Ocorrências, impactos e portal restantes. |
| 09 F07.7 | Parcial | Identidade/rotas e Drive tiveram incrementos; SPEC limita integração e ensaio operacional. | Reprodução/entrega real autorizada. |
| 10 P01 | Parcial | Particular, reservas e entrada por hora constam no B01. | Fechamento mensal e saldo completo. |
| 11 P02 | Sem evidência suficiente | SPEC define permuta; esta auditoria não encontrou relatório atual de entrega integral. | Matriz/validação própria de P02. |
| 12 N01 | Sem evidência suficiente | Há infraestrutura/menções a WhatsApp, sem evidência central de avisos consolidados. | Fluxo de aviso com tentativa/falha. |
| 13 M01 | Sem evidência suficiente | SPEC define migração, mas não há evidência de ensaio/conciliação global. | Inventário e ensaio rastreável. |
| 14 V01 | Sem evidência suficiente | Regressões locais existem; SPEC diz que não substituem homologação. | Homologação integrada documentada. |
| 15 COM01 | Parcial | Preparação, reserva, emissão e ativação têm testes em `reserva-vaga.int.test.ts`; desistência/jornada completa seguem pendentes. | Fluxo comercial completo por matrícula. |
| 16 DCT01 | Parcial | Modelos, prévias e PDF têm código/evidência; Q117 original 496 é limitado. | Ensaio UI e cadeia documental completa. |
| 17 DCT02 | Parcial | Conferência, processo, evidências, aceite e Q116 parcial existem; fornecedor/assinatura operacional pendem. | Integração de assinatura e conciliação real. |
| 18 DCT03 | Parcial | Proposta, decisão, participantes e original de aditivo têm evidência 496. | Formalização, alçadas, vigência e aplicação. |

## Evidência atual que pode ser afirmada

- A capa da SPEC registra o incremento 496: original de aditivo Q117, proposta/conferência revalidadas, interface e PDF privado; também declara pendentes a assinatura, formalização e aplicação. Ver [SPEC central](../specs/erp-educacional.md) e [validação 496](validacao-incremento-496.md).
- A mesma SPEC declara regressão histórica e explicitamente adverte que testes aprovados não comprovam requisitos pendentes ou homologação operacional.
- `docs/planejamento/corpos-entrada-comercial-contrato.md` divide comercial/documentos em COM01 e DCT01–03, mas é uma proposta de escopo e não um painel de cobertura.

## Matriz necessária para responder percentuais

Criar uma linha por capacidade verificável, não por número Q, com: frente, capacidade, requisito(s), estado (`não iniciada`, `parcial`, `implementada`, `validada`, `homologada`), evidência de código/migration/teste e limitações. A equipe de implementação deve definir e publicar o critério de contagem, sem exigir uma nova aprovação do usuário para organizar o acompanhamento. Separar cobertura de critérios de aceite de estimativa de esforço restante; não converter esta lista de macrofrentes em porcentagem de produto pronto.
