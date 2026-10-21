# Incremento 398 — prazo independente da correção

2026-09-14. Foi identificado e corrigido o bloqueio indevido de uma resposta à correção quando o prazo da primeira entrega já havia terminado. A escrita agora verifica o prazo da etapa pendente e sua própria prorrogação, considerando apenas a parte das indisponibilidades posterior à abertura dessa etapa. Permissões de matrícula e indisponibilidade ativa continuam exigidas.

Teste novo comprova criação da versão 2, vínculo à solicitação de correção, prazo próprio e mudança da solicitação para RESPONDIDA. A conclusão pedagógica não é automática.

Validação: portal 4 testes e integração de frequência 3 testes passaram (docs/validacao-etapas-398-2026-09-14.json). Antes, suite permissões 8 e portal 3 passaram (docs/validacao-regressao-398-2026-09-14.json). O primeiro comando citou frequência no diretório errado, portanto esse primeiro relatório não a inclui; o segundo comando usou o caminho correto. TypeScript e lint dos dois arquivos alterados passaram.

A consulta/interface ainda está sendo alinhada ao prazo por etapa pelo agente. Segunda chamada179 aguarda revisão final e integração; ciclo185 aguarda guard sem perda de invariantes. Não é conclusão da SPEC inteira.
