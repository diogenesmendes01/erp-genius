# Escopo e Requisitos — ERP Genius

> Documento vivo. Vamos refinar conforme decidir detalhes de cada módulo.

## Objetivo

Centralizar a gestão da Escola Genius em um único sistema web, reduzindo
controles manuais (planilhas soltas, papel) e automatizando o que for possível,
especialmente o atendimento comercial via WhatsApp.

## Perfis de usuário (papéis)

> ℹ️ Visão inicial (5 perfis). O modelo evoluiu para **7 papéis** — a referência autoritativa é
> [`07-papeis-permissoes.md`](07-papeis-permissoes.md): **Administrador · Gerente Comercial ·
> Vendedor · Gerente Pedagógico · Professor · Financeiro · Secretaria Acadêmica**.

- **Administrador** — acesso total, configura o sistema.
- **Secretaria** — cadastra alunos, matrículas, turmas.
- **Financeiro** — mensalidades, pagamentos, inadimplência.
- **Professor** — lança notas e frequência das suas turmas.
- **Vendedor/Comercial** — gerencia leads e funil de vendas.

## Módulo 1 — Alunos e Matrículas (MVP)

- Cadastro de aluno (dados pessoais, documentos, foto).
- Cadastro de responsáveis e vínculo com o aluno.
- Turmas e séries (ano letivo, turno, capacidade).
- Matrícula do aluno em uma turma.
- Histórico de matrículas por aluno.
- Busca e listagem de alunos com filtros.

## Módulo 2 — Financeiro

- Plano de mensalidades por aluno/turma.
- Geração de cobranças (boletos/mensalidades).
- Registro de pagamentos.
- Controle de inadimplência (quem deve, há quanto tempo).
- Relatórios: receita prevista x recebida, inadimplência.

## Módulo 3 — Acadêmico + Equipe

- Lançamento de notas por disciplina/período.
- Frequência (presença/falta).
- Geração de boletim.
- Calendário escolar.
- Cadastro de professores e funcionários.
- Atribuição de professores a turmas/disciplinas.

## Módulo 4 — Vendas / CRM + WhatsApp

- Cadastro de leads (interessados em matrícula).
- Funil de vendas (etapas: novo, contato, visita, proposta, matriculado).
- Atribuição de leads a vendedores.
- Follow-up e histórico de interações.
- **Automação WhatsApp**: mensagens automáticas de boas-vindas,
  follow-up de leads, lembretes — via WhatsApp Business API.
- Conversão de lead em aluno matriculado (integra com Módulo 1).

## Requisitos não-funcionais

- Acesso por navegador (desktop e celular).
- Login seguro com controle de permissão por papel.
- Dados na nuvem com backup.
- Em português (pt-BR).

## Decisões pendentes (a conversar)

- Quantos alunos/usuários aproximadamente? (dimensiona infraestrutura)
- Já usam algum sistema/planilha hoje que precisamos importar?
- Emissão de boleto: qual banco/gateway? (ex: PagSeguro, Asaas, Stripe)
- WhatsApp: já tem conta WhatsApp Business API ou número comercial?
- Há orçamento previsto para hospedagem e serviços (WhatsApp, boletos)?
