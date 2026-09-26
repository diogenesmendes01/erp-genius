# Índice da Documentação — ERP Genius

> Ponto de entrada de toda a documentação. Leia nesta ordem para entender o projeto
> do "porquê" ao "como".

> **Implementação em curso:** [B01 — vínculo acadêmico por matrícula](planejamento/implementacao-b01.md). Implementação incremental com validações locais; consultar as evidências recentes abaixo para o alcance por fluxo e as pendências. A existência de múltiplas matrículas não comprova conclusão de todos os fluxos por contrato.

> **Situação geral atual do projeto:** [41 — Entregas, pendências e próximos passos](41-situacao-consolidada-do-projeto.md). Consolida ERP educacional, CRM e WhatsApp após D01–D14. Os relatórios 33/34 e os resultados da auditoria original são históricos.
>
> Evidências da política de acesso: [38 — Implementação de acesso](38-implementacao-acesso-validacao.md).
>
> **Especificação das próximas entregas:** [SPEC central do ERP educacional](specs/erp-educacional.md), com regras, rastreabilidade, integrações e aceite; [matrícula como unidade operacional](specs/matricula-como-unidade-operacional.md) detalha a base de Q102. Especificação não comprova implementação.

> Complemento D13: [39 — Retomada após pausa com aprovação](39-retomada-com-aprovacao.md).
> Complemento D14: [40 — Mudanças acadêmicas com aprovação](40-mudancas-academicas-com-aprovacao.md).

> Atualização 598: [fila administrativa de desistências — implementação, testes e limites](planejamento/validacao-incremento-598.md).

> Atualização 599: [WhatsApp financeiro por matrícula — isolamento, regressões e limites](planejamento/validacao-incremento-599.md).

> Atualização 600: [pagador contratual como destinatário financeiro — comportamento, evidências e limites](planejamento/validacao-incremento-600.md).

> Atualização 601: [indicador de resposta financeira por matrícula — correção e testes](planejamento/validacao-incremento-601.md).

> Atualização 602: [preparação e confirmação de cobrança manual — correção e testes](planejamento/validacao-incremento-602.md).

> Atualização 603: [validação da confirmação manual e recuperação da interface — evidências e limites](planejamento/validacao-incremento-603.md).

> Atualização 604: [ciclo após recomposição e prévia financeira — decisões, implementação e limites](planejamento/validacao-incremento-604.md).

> Atualização 605: [comprovação de oferta Q161 — agenda, confirmação pedagógica e validações](planejamento/validacao-incremento-605.md).

> Atualização 606: [emissão de continuidade mensal — implementação, validação e limites](planejamento/validacao-incremento-606.md).

> Atualização 607: [fontes da continuidade e emissão após recomposição — validações e limites](planejamento/validacao-incremento-607.md).

> Atualização 608: [fila financeira de continuidade — acesso e validação](planejamento/validacao-incremento-608.md).

> [Situação da medição percentual das SPECs](planejamento/percentual-entrega-spec.md): percentual global ainda não auditado.

## Ordem de leitura recomendada

### 1. Entender o produto
| Doc | Conteúdo |
|---|---|
| [41 — Situação consolidada do projeto](41-situacao-consolidada-do-projeto.md) | Estado atual após D01–D14; o que mudou desde o diagnóstico, backlog F01–F20 e limites da validação local |
| [`01-escopo-requisitos.md`](01-escopo-requisitos.md) | O que o sistema precisa fazer · perfis · módulos |
| [`03-roadmap.md`](03-roadmap.md) | Plano de construção em fases (Fase 0 → 3) |
| [`17-glossario.md`](17-glossario.md) | Linguagem ubíqua (termos do domínio) |

### 2. Entender o domínio (regras de negócio)
| Doc | Conteúdo |
|---|---|
| [`04-fase1-dominio.md`](04-fase1-dominio.md) | País como espinha dorsal · validação · preços · moeda |
| [`05-fase1-fluxo-matricula.md`](05-fase1-fluxo-matricula.md) | Matrícula como máquina de estados |
| [`06-fase1-catalogo-cursos.md`](06-fase1-catalogo-cursos.md) | Modalidades · níveis (CEFR) · turmas · Pré A1 |
| [`08-comercial-crm-whatsapp.md`](08-comercial-crm-whatsapp.md) | CRM · funis PF/B2B · origem · comissão · automação (Fase 1+) |
| [`07-papeis-permissoes.md`](07-papeis-permissoes.md) | Os 7 papéis · função + propriedade (row-level) |
| Política de acesso — referência histórica ao doc 36 | Arquivo ausente na conferência de 10/09/2026; pendência registrada na SPEC central. Consultar as decisões disponíveis no [doc 37](37-detalhamento-operacional-do-acesso.md) e os complementos/evidências nos [docs 38](38-implementacao-acesso-validacao.md)–[40](40-mudancas-academicas-com-aprovacao.md) |
| [37 — Detalhamento operacional do acesso](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/37-detalhamento-operacional-do-acesso.md) | **Especificação:** nove decisões respondidas, capacidades ligadas ao código, campos, pagamentos a conferir, comissão percentual/fixa, cobertura e critérios de aceite |
| [35 — Referências de mercado](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/35-referencias-de-mercado-escopos-e-permissoes.md) | Fontes oficiais e propostas que fundamentam a política de acesso |
| [`10-regras-sistema.md`](10-regras-sistema.md) | Regras cross-cutting · máquinas de estado · permissões · jobs |

### 3. Entender a técnica
| Doc | Conteúdo |
|---|---|
| [`02-arquitetura.md`](02-arquitetura.md) | Stack · monólito modular · modelagem por eventos |
| [`11-modelo-de-dados.md`](11-modelo-de-dados.md) | **Referência estrutural parcial:** precisa incorporar as entidades de D01–D14; schema e migrações são canônicos |
| [`12-catalogo-de-eventos.md`](12-catalogo-de-eventos.md) | Todo evento de domínio (tipo · gatilho · payload · autor) |
| [`13-convencoes-codigo.md`](13-convencoes-codigo.md) | Fronteiras de módulo · Server Actions · Zod · padrão de Evento |
| [`18-design-system.md`](18-design-system.md) | Tokens · dark mode · tipografia · ícones · estilo flat |
| [`14-estrategia-de-testes.md`](14-estrategia-de-testes.md) | O que testar e como |
| [33 — Diagnóstico do projeto](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/33-diagnostico-projeto-papeis-erp-crm-whatsapp.md) | Inventário inicial e prioridades para ERP educacional, CRM e WhatsApp; complementado pela auditoria 34 |
| [34 — Auditoria profunda: documentação versus código](C:/Users/Mendes/.codex/worktrees/de19/erp-genius/docs/34-auditoria-profunda-documentacao-vs-codigo.md) | Falhas reproduzidas, verificações executadas e limitações; referência do estado auditado, distinta da política desejada |

### 4. Construir
| Doc | Conteúdo |
|---|---|
| [SPEC-ERP-001 — Operação educacional](specs/erp-educacional.md) | Especificação central: invariantes, acesso, 14 entregas, estados, integrações, migração, rastreabilidade Q/D e validação |
| [SPEC-ERP-002 — Matrícula como unidade operacional](specs/matricula-como-unidade-operacional.md) | Base B01/Q102, negociações, entrada, reserva, admissão e cobranças iniciais: relações, isolamento, aprovação, migração e critérios MAT-01–MAT-29 |
| [Corpos comerciais e documentais](planejamento/corpos-entrada-comercial-contrato.md) | Quatro propostas COM01/DCT01–DCT03 para revisão: preparação/reserva, modelos/PDF, assinatura e aditivos. Complementam os 14 corpos originais; 18 propostas no total, sem issues criadas |
| [SPEC-ERP-003 — Documento contratual](specs/documento-contratual.md) | PDF, assinatura, governança, signatários, substituição e aditivos; estados, versões, operações e critérios DOC-01–DOC-19. Conteúdo/parâmetros dos modelos e integração em refinamento |
| [Refinamento da entrada comercial e contrato](planejamento/entrada-comercial-e-contrato.md) | Q103–Q123 respondidas: origem, reservas/admissão, cadastro, cobrança inicial, modelos, assinatura, aditivos e responsável da nova negociação. Q121 define desistência conforme avanço formal. Q122 define cliente/responsáveis primeiro e escola depois quando exigida; nenhuma pergunta sem resposta no bloco |
| [Refinamento da progressão acadêmica](planejamento/progressao-academica.md) | Q124–Q154 respondidas; Q134 define limite por habilidade e Q135 define aprovação independente e Q136 define prazo a partir da disponibilização; Q137 define consumo de tentativas; Q138 veda exceções de nota; Q139 limita a entrega ao registro de avaliações externas; Q140 define publicação independente pela gestão; Q141 preserva regras de turmas em andamento; Q142 exige conferência independente por avaliação; Q143 libera acompanhamento oficial ao aluno; Q144 exige correção com aprovação independente; Q145 mantém atendimento dos responsáveis pela equipe; Q146 define segunda chamada separada; Q147 limita segunda chamada por avaliação; Q148 define consumo de segunda chamada; Q149 define prazo da segunda chamada; Q150 autoriza extras com aprovação independente; Q151 define pausa/encerramento; Q152 define designação docente limitada; Q153 define equivalência aprovada; Q154 define fechamento pela gestão; revisão técnica e corpo adicional pendentes; corpo adicional ainda em refinamento |
| [SPEC-ERP-004 — Avaliação por habilidades](specs/avaliacao-por-habilidades.md) | Regras Q124–Q154, critérios ACA-01–ACA-34: notas, etapas, pesos, mínimos, frequência e recuperação; limites por habilidade definidos; autorização e início do prazo definidos; fechamento definido em Q154; revisão técnica pendente |
| [Corpos das próximas entregas e revisão de integração](planejamento/revisao-integracao-corpos-entregas.md) | 14 corpos para revisão antes das issues; escopo, permissões, dependências e aceite após Q100–Q102. Planejamento, sem implementação comprovada |
| [SPEC-ERP-005 — Linha comercial do WhatsApp](specs/whatsapp-linha-comercial.md) | Número de VENDAS como espelho do WhatsApp do vendedor: atendimento único por conversa, acesso dono/gerente/admin, lead automático ou "Criar lead", histórico de 30 dias; critérios LC-01–LC-15. Aprovada 26/09/2026; Fases 0–4 codificadas, testes ainda sem execução |
| [`09-fase0-telas.md`](09-fase0-telas.md) | Especificação tela por tela da Fase 0 (UX) |
| [`24-cobrancas-regua-fluxo.md`](24-cobrancas-regua-fluxo.md) | Redesenho de Cobranças: régua + cérebro/braço + dash/lista/detalhe |
| [`25-motor-de-risco-cobranca.md`](25-motor-de-risco-cobranca.md) | **Spec V2 (não implementado)**: motor de risco do aluno — score explicável + faseamento |
| [`26-whatsapp-v1.md`](26-whatsapp-v1.md) | **Especificação original:** WhatsApp bimotor, régua e inbox; implementação parcial e situação operacional no doc 41 |
| [`27-comercial-automacoes-ia.md`](27-comercial-automacoes-ia.md) | **Especificação C1–C5 e IA:** cadências têm implementação; isso não significa todas as ondas ou IA entregues. Situação no doc 41 |
| [`28-whatsapp-auditoria-gaps.md`](28-whatsapp-auditoria-gaps.md) | **Auditoria pré-implementação**: 34 gaps/decisões pendentes dos docs 26/27, mapeados por marco |
| [`29-whatsapp-integracao-codigo.md`](29-whatsapp-integracao-codigo.md) | **Mapa de integração**: o que reusa, o que muda (arquivo:linha), fluxos, projeções e as 10 regras anti-duplicação |
| [`30-whatsapp-spec-implementacao.md`](30-whatsapp-spec-implementacao.md) | **Spec mestre (em implementação)**: decisões S1–S10, modelo de dados final, contratos e etapas E1–E6 |
| [`31-whatsapp-go-live.md`](31-whatsapp-go-live.md) | **Go-live (E5)**: deploy VPS (compose app+Evolution+Caddy), cron/despachante, health, backup+restore, rollout e runbooks |
| [`32-comercial-c1-c2-piloto-baileys.md`](32-comercial-c1-c2-piloto-baileys.md) | **Piloto C1/C2 no Baileys (pré-WABA)**: bloqueadores, portões, matriz de cenários, rollout, aceite, stop/rollback e migração p/ WABA |
| [`16-plano-execucao.md`](16-plano-execucao.md) | **Plano mestre** de documentação + implementação (checklist) |
| [`15-decisoes-adr.md`](15-decisoes-adr.md) | Log de decisões e pendências em aberto |

## Convenções da documentação
- **Idioma:** pt-BR.
- **Numeração:** os arquivos `04`–`06` mantêm a numeração legada ("Fase 1") no nome; o
  conteúdo segue válido — a **sequência de construção** autoritativa é o [`03-roadmap.md`](03-roadmap.md).
- **Estrutura implementada:** o [`schema.prisma`](../prisma/schema.prisma) e as migrações descrevem a estrutura existente; o doc [`11`](11-modelo-de-dados.md) deve acompanhá-la. Para comportamento futuro aprovado, consultar a [SPEC central](specs/erp-educacional.md): ausência no schema/código é lacuna de implementação, não revogação do requisito.
