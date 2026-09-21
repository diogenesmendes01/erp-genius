# Q22 — Avisos internos de pendências do diário

## Requisito aprovado

Fonte: Q22 em `docs/planejamento/f07-agenda-aulas.md`, em conjunto com Q07 e Q24. A pendência nasce após o término previsto da aula. A aula permanece Prevista até cumprir os requisitos de conclusão. O professor recebe pendências e lembretes no ERP; a Gestão Pedagógica acompanha o painel e recebe alerta quando vencer o prazo. Prazo de regularização e intervalo de lembretes são configuráveis, sem valores numéricos presumidos. A rotina não cria reposição, presença, conclusão ou cobrança.

## Contrato da implementação

- Abranger encontros de finalidade AULA, no estado PREVISTO, cujo término já chegou. Preservar encontros ministrados, cancelados e de outras finalidades.
- Apresentar o encontro, turma ou identificação genérica da particular, professor e pendências necessárias à conclusão. Não incluir ficha do aluno, dados financeiros, contatos pessoais ou identificador externo de gravação.
- Professor consulta apenas encontros sob atribuição vigente ou designação específica de Q24. Autoria histórica não restitui acesso de escrita depois do desligamento. Gestão Pedagógica/Administração acompanha o conjunto; papel de gestão sozinho não permite preencher o diário de outra pessoa.
- Administração configura prazo de regularização e intervalo de lembretes em minutos, positivos e completos. Ausência de configuração não inventa prazo nem emite lembretes; o painel ainda indica as pendências existentes e a configuração necessária.
- O prazo usa o término do encontro como referência. O primeiro aviso ao responsável fica disponível a partir desse término; os posteriores respeitam o intervalo. O alerta à gestão começa no vencimento do prazo. As datas exibem a referência de fuso do encontro.
- Os avisos ficam dentro do ERP e são reconciliados ao consultar o painel. Não há envio por WhatsApp/e-mail nem contratação de serviço. Esta entrega não promete execução em segundo plano quando ninguém consulta o sistema.
- Persistir o ciclo por encontro/destinatário/tipo de aviso. Repetição da consulta no mesmo intervalo não duplica avisos. A passagem de vários intervalos sem consulta não cria uma fila retroativa de mensagens.
- A consulta revalida papel, atribuição, configuração e situação da aula. Conclusão, cancelamento ou perda da atribuição interrompem os avisos aplicáveis, preservando os registros do ciclo. Encerrar o aviso não significa concluir a aula.
- Alterar a configuração recalcula os próximos avisos das pendências atuais; não modifica o término previsto, a conclusão, presenças ou efeitos financeiros. Registrar autoria e valores anterior/novo da configuração.

## Critérios de verificação

Configuração ausente e inválida; administração atual; docente autorizado e outro docente; designação vigente/revogada; acompanhamento da gestão antes/depois do vencimento; repetição e avanço do intervalo; resolução da aula; paginação; ausência de dados pessoais e de efeitos financeiros/acadêmicos. Verificação renderizada é distinta de homologação interativa.

## Estado

Implementação local e testes do incremento 592 concluídos para o painel descrito: 11 casos dirigidos dentro de uma rodada de 75 integrações, três testes de renderização, tipos, lint e build aprovados. [Evidências e limites](../planejamento/validacao-incremento-592.md). Sem homologação interativa, execução em produção ou serviço de avisos em segundo plano. A reconciliação fecha até vinte ciclos obsoletos do usuário por acesso, filtrando as fontes inválidas antes do limite; fontes resolvidas deixam de aparecer no painel mesmo antes dessa limpeza persistida.
