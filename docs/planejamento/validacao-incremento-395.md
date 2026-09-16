# Incremento 395 — configuração do portal e proteção de cotas

Data: 14/09/2026.

A página de configuração operacional recebeu formulário administrativo para os quatro prazos do portal: sessão, convite, recuperação e validação do novo e-mail. Campos começam vazios quando não configurados, exigem valores completos válidos e não alteram expirações já emitidas. A ação confere Administração ativa dentro da transação, preserva outras configurações e registra os valores anteriores/novos.

A suíte de configuração teve 14 testes de integração aprovados, incluindo os novos prazos, limites, preservação e recusa da Secretaria. Relatório: `../validacao-configuracao-portal-395-2026-09-14.json`. Lint dos arquivos alterados passou; formulário ainda sem homologação visual.

A migration `20260915010000_transicao_beneficio_reposicao` foi aplicada apenas ao banco de teste. O rascunho 181 foi abandonado, sem aplicação. O snapshot existente é imutável e novas versões começam no fim do período anterior. Se a referência da nova regra difere, o primeiro intervalo começa na vigência e conserva o fim ancorado, sem adiar a mudança para mais um período. A primeira entrada mantém a cota do período atual.

Cinco testes de integração de agenda/período passaram, incluindo rejeição de UPDATE/DELETE e tentativa de recriar saldo por SQL: `../validacao-beneficio-395-2026-09-14.json`. Ainda falta ampliar a prova da transição com reservas antigas e concluir cancelamento/remarcação/UI. Segunda chamada e entrega de atividades seguem com os agentes. Não declarar conclusão da SPEC a partir desta validação localizada; a última regressão ampliada é a 394.
