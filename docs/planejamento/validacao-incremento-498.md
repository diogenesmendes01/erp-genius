# Incremento 498 — classificação dos efeitos do aditivo

Data: 15/09/2026. O incremento anterior integrou a conferência interna do original e passou nas verificações; foi progresso. Meta integral ativa.

## Entrega

`classificarAlteracoesAditivo` classifica todas as origens aplicáveis em cadastro, financeiro, regime contratual e agenda acadêmica. Identifica o tipo de informação necessário: texto, e-mail, dinheiro/moeda, data, minutos, regime ou agenda. Mudança de regime explicita a necessidade de tratar os efeitos financeiro e acadêmico.

O mapa é exaustivo em relação ao enum de origens. Campos derivados de aditivo, desconhecidos, duplicados ou entradas vazias são recusados. A classificação preserva ordem, rótulos e valores anteriores/novos sem interpretar textos como números ou datas e sem mutar o snapshot recebido.

A consulta autorizada da proposta calcula essa projeção a partir do snapshot íntegro. A tela de detalhes mostra a natureza de cada alteração e os requisitos para sua aplicação, junto dos valores preservados. A classificação não é salva por cima de documentos ou conferências anteriores; não altera hashes, aprovações, cobranças ou agenda.

## Validação

- Quatro unitários aprovados: `docs/validacao-impactos-aditivo-unitarios-498-2026-09-15.json`.
- **22/22 integrações aprovadas**: `docs/validacao-impactos-aditivo-498-2026-09-15.json`, incluindo a projeção cadastral no fluxo público e os testes anteriores de escopo, integridade e conferência.
- TypeScript, lint e build aprovados; `docs/validacao-build-498-2026-09-15.log`.
- Sem migração, envio externo, publicação em produção ou ensaio interativo no navegador nesta etapa.

## Limites e sequência

Esta é uma classificação para revisão, não a persistência de valores tipados, um cálculo financeiro ou uma prova de alçada cumprida. As mensagens descrevem requisitos do fluxo; não consultam decisões específicas de cada impacto. Os cenários financeiros, de regime e agenda são cobertos pelo classificador puro, não por uma aplicação operacional ainda inexistente.

Próxima etapa: valores tipados e efeitos versionados vinculados à proposta e à matrícula, com a origem contratual e vigência preservadas, seguidos das aprovações aplicáveis e integração com formalização/aplicação. Não converter automaticamente o campo textual `novo` em dinheiro, cobertura ou agenda. Não reescrever condições de entrada já aceitas, cobranças ou recebimentos históricos. Assinatura operacional, cadeia de aditivos aplicados e demais requisitos da SPEC continuam pendentes.
