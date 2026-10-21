# Auditoria 609 — alcance do denominador consolidado

## Escopo e método

Esta auditoria compara o denominador de **122** entradas em
[`auditoria-609-consolidada.json`](auditoria-609-consolidada.json) com a fonte
normativa [SPEC-ERP-001](../specs/erp-educacional.md) e as fontes que ela
incorpora. Não reavalia código, não executa homologação e não altera o estado
de nenhum critério individual.

Foram confrontados: os 18 corpos da seção 5 da SPEC, `INV-01..INV-10`, as
regras de acesso da seção 4, `CT-01..CT-12`, a rastreabilidade Q04–Q123, os
aceites `MAT-01..MAT-29`, `DOC-01..DOC-19` e `ACA-01..ACA-34`, além das
decisões e pendências Q155–Q165 registradas depois da consolidação original.

## Situação do inventário regenerado

- Há exatamente **122** registros e nenhuma chave `criterio` duplicada.
- A distribuição por corpo é ACA 34; COM01 6; DCT01 5; DCT02 7; DCT03 5;
  B01 5; B02 5; F07.1–F07.7 31; P01 6; P02 3; N01 4; M01 4; V01 7.
- Todos os 122 registros agora têm `texto`. A versão anterior observada com 54
  textos vazios foi regenerada e não é a base desta conclusão.
- Classificações atuais: 45 `verificado`, 42 `parcial`, 4 `nao_implementado`
  e 31 `nao_auditado`.
- Cada registro só contém `corpo`, `criterio`, `texto`, `status`, `codigo`,
  `testes`, `pendencia` e `justificativa`. Faltam `fonte`, `id_origem`,
  relação de composição e identificador canônico. Assim, 122 é um inventário
  de critérios de corpo, ainda não um denominador normativo demonstravelmente
  completo.

## Requisitos não representados de forma auditável

| Fonte e IDs | Constatação precisa | Reconciliação necessária |
|---|---|---|
| `erp-educacional.md` §§3–4, `INV-01..INV-10` e decisões D01–D14 incorporadas | Matrícula como unidade, separação de fatos, histórico, aprovação independente, idempotência e acesso por ação/registro/campo/condição aparecem distribuídos nos corpos. Não há relação explícita que mostre qual critério prova cada invariante nem se a proteção alcança consultas, exportação, anexo, notificação e trabalho posterior. | Criar matriz `INV/D -> criterios consolidados`; acrescentar um critério transversal canônico somente se nenhum critério atual o suportar. |
| `erp-educacional.md` §8 e `CT-01..CT-12` | Fuso, intervalos, locks, versão, repetição, falha externa e ordenação de eventos são transversais. V01 concentra parte deles, mas o JSON não liga cada CT às evidências de corpo que o compõem. | Criar matriz `CT -> criterios`, permitindo vários testes e corpos para o mesmo cenário. CT não deve inflar o denominador quando apenas compõe critérios existentes. |
| `matricula-como-unidade-operacional.md`, `MAT-01..MAT-29` | Nenhum ID MAT aparece no JSON. `V01.Aceite.7` cita `MAT-17..MAT-29`, mas não estabelece mapeamento individual; `MAT-01..MAT-16` também não possuem destino rastreável. | Registrar `MAT-xx -> criterio(s)` e justificar cada ausência de destino. A falta dessa ligação não prova requisito sem implementação. |
| `documento-contratual.md`, `DOC-01..DOC-19` | COM01/DCT01–03 têm 23 critérios e DOC tem 19, mas nenhum ID DOC aparece no JSON. DOC-17/19 e MAT-28/29 atravessam desistência, reserva e assinatura, sendo especialmente vulneráveis a desaparecer numa leitura por corpo. | Produzir matriz `DOC/Q/MAT -> COM/DCT/B01/B02`; relações muitos-para-muitos devem ser preservadas, não contadas como requisitos novos. |
| `erp-educacional.md` §11, Q04–Q123 | A SPEC já associa Qs a REQ/corpos, porém nenhum Q de origem consta no JSON. Isto impede verificar se um requisito composto foi coberto por todos os corpos necessários. | Registrar `Q-origem` e `criterio_canonico` no manifesto. Um Q pode ter suportes múltiplos sem receber cópias independentes no denominador. |
| `avaliacao-por-habilidades.md`, `ACA-01..ACA-34`, e Q124–Q154 | Os ACA agora trazem texto, mas não carregam a referência Q de origem nem distinguem, no inventário, requisitos aprovados de pontos em refinamento que a SPEC ainda declara. | Mapear `Q124..Q154 -> ACA` e manter pendência de refinamento como estado de requisito/evidência, sem excluir o item do denominador. |
| Q155–Q165, fontes abaixo | Nenhuma ocorrência literal de `Q155` a `Q165` aparece nos 122 textos, justificativas ou pendências. Logo, o denominador não torna auditável a cobertura dessas decisões posteriores. | Acrescentar fontes e critérios canônicos, ou ligar cada Q a critérios existentes com justificativa explícita de equivalência. |

### Decisões posteriores que exigem fonte no manifesto

| ID | Fonte | Situação de requisito a preservar |
|---|---|---|
| Q155 | [`documento-contratual.md`](../specs/documento-contratual.md) e `planejamento/fornecedor-assinatura-q155.md` | Escolha/homologação de fornecedor, adaptador, worker, webhooks e conciliação externa permanecem pendentes; não inferir fornecedor por infraestrutura interna. |
| Q156–Q159 | [SPEC-ERP-001 §§7](../specs/erp-educacional.md) | Fim da indisponibilidade e tratamento de período integral sem oferta têm efeitos financeiros distintos; Q157 continua sem decisão e não pode ser preenchida por inferência. |
| Q160 | [SPEC-ERP-001 FIN-02.3](../specs/erp-educacional.md) | Vencimento deriva da cobertura nova e referência contratual explícita; contrato legado incompleto exige conferência. |
| Q161–Q162 | [SPEC-ERP-001, decisões 16/09/2026](../specs/erp-educacional.md) e `planejamento/continuidade-q161-q162.md` | Oferta exige agenda/vínculo ou confirmação pedagógica independente; recomposição aplicada estabelece novo ciclo. Combinações de origem sem precedência definida e homologação operacional continuam pendentes. |
| Q163 | `planejamento/validacao-incremento-552.md` | A passagem de pausa para encerramento segue sem resposta; não assumir sobrevivência ou revogação de autorização. |
| Q164 | `planejamento/validacao-incremento-571.md` e SPECs de segunda chamada | A resolução de impedimento escolar permanece pendente e não decorre automaticamente de realização, remarcação ou substituição docente. |
| Q165 | [`acerto-desistencia-q165.md`](acerto-desistencia-q165.md) | A apuração financeira antes da ativação não tem opção aprovada; não presumir retenção, devolução, fórmula de acerto nem alteração de recebimentos. |

## Sobreposições que não devem aumentar o denominador

| Conjunto | Tipo de sobreposição | Regra de contagem |
|---|---|---|
| COM01 com B01, B02, F07.2 e P01 | COM01 organiza a jornada; os demais sustentam identidade, reserva, emissão, recebimento e particular. | Um Q pode ter vários suportes, mas um único requisito canônico. |
| DCT01–DCT03 com `DOC-01..DOC-19` | DCT detalha fluxo; DOC é a tabela fonte de aceite. | Mapear DOC sem criar outro denominador paralelo. |
| MAT-17..MAT-29 com Q103–Q123 | MAT detalha as mesmas decisões comerciais incorporadas nos corpos COM/DCT. | Registrar composição, sem contar MAT e Q como implementações independentes. |
| F07.5, B01, B02, P01 e P02 | Cobertura, cobrança, crédito, particular e permuta compartilham fatos financeiros, mas têm efeitos próprios. | Separar efeitos observáveis e usar `INV-06` como vínculo, não como cópia de aceite. |
| M01, V01, N01 e `CT-01..CT-12` | Migração, validação, aviso e concorrência verificam vários corpos simultaneamente. | Uma execução pode sustentar vários critérios; não exigir teste único nem duplicar CT. |

## Método de reconciliação

1. Congelar os 122 IDs como versão-base e criar manifesto separado de fontes.
2. Para cada requisito, registrar `fonte`, `id_origem`, `texto_origem`,
   `criterio_canonico`, `criterios_consolidados` e `tipo` (`direto`,
   `composto`, `transversal`).
3. Preencher as matrizes `INV`, `D`, `CT`, `MAT`, `DOC`, `ACA`, Q04–Q123 e
   Q155–Q165. Requisito sem destino e critério sem fonte são pendências de
   rastreabilidade, não falhas automáticas de implementação.
4. Criar novo critério apenas quando a matriz provar ausência de cobertura;
   quando houver vários suportes, manter todos e contar um canônico.
5. Distinguir evidência de **implementação** (código, testes locais e
   integrações executadas) de **homologação** (provedor e ambiente reais).
   Homologação não executada é lacuna de evidência externa, jamais prova de
   funcionalidade inexistente. `nao_implementado` requer evidência específica.
6. Publicar totais separados de requisitos canônicos e critérios de suporte,
   preservando relações muitos-para-muitos e evitando inflação por duplicação.

## Conclusão

O inventário regenerado é um índice consistente de 122 critérios de corpo, mas
não fecha o alcance normativo enquanto não relacionar suas fontes e decisões
transversais. A reconciliação proposta incorpora Q155–Q165, preserva pendências
sem criar política por omissão e evita confundir ausência de homologação com
inexistência de funcionalidade.
