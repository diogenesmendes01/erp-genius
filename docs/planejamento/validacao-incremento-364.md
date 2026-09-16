# Incremento 364 — Pendências operacionais do resultado, 14/09/2026

O acompanhamento autorizado do vínculo consulta correções regulares e de recuperação sem decisão, planos aguardando decisão, planos aprovados sem disponibilização e habilidades reservadas sem realização/cancelamento. Usa matrícula, alocação e regra conferidas, incluindo nível nas fontes de recuperação. O carregador é interno e chamado após a autorização e os bloqueios do consolidado.

A tela de avaliações exibe as contagens e distingue revisão de nota, preparação do plano e execução. Correção pendente conserva a nota oficial; uma decisão remove a pendência de decisão, mantendo o histórico. Cancelamento parcial pela escola retira somente as habilidades não realizadas da contagem de reservas; realização já feita continua aguardando nota/conferência quando aplicável. O relógio não remove reservas nem presume realização.

## Evidências

- Suíte de avaliações com 57 integrações aprovada: [relatório](../validacao-pendencias-364-2026-09-14.json).
- Acrescentado teste de aprovação/disponibilização do plano e conferências de correção de recuperação; quatro cenários direcionados aprovados, 54 não selecionados: [complemento](../validacao-pendencias-364-complemento-2026-09-14.json). Total atual: 58 testes no arquivo, sem nova execução integral após esse complemento.
- Testes verificam nota preservada até decisão, remoção da pendência após rejeição/aprovação, outro contrato do mesmo aluno sem herdar a pendência, revogação de acesso, plano antes/depois de aprovação e disponibilização, realização parcial e cancelamento do restante.
- 839 unitários em 91 arquivos aprovados, build com TypeScript/52 páginas e lint direcionado aprovados. Após o build, somente testes foram complementados.

## Limites e continuidade

Essas contagens não são uma declaração de prontidão para fechamento. Não agregam o nível entre vínculos, não substituem decisão de equivalência, não resolvem impactos de correções já aplicadas e não comprovam o cumprimento integral de planos ainda sem reservas. O estado permanece acompanhamento, sem botão de fechamento ou aprovação de progressão.

Para cumprir Q154, ainda é necessário reunir fontes completas, resolver pendências obrigatórias e persistir a confirmação versionada pela gestão. A integração de notas/frequência na aprovação e execução da progressão segue pendente. Não houve migration, produção, envio externo ou homologação interativa.

