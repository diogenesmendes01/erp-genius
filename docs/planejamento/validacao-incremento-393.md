# Incremento 393 — portal compilado e reposições

Data: 14/09/2026.

O build passou após separar as três ações administrativas do módulo interno de identidade. Foram geradas 61 páginas estáticas, com rotas dinâmicas de portal e painel administrativo. Compilação não substitui homologação no navegador nem configuração do serviço de e-mail.

A integração em `../validacao-reposicoes-393-2026-09-14.json` teve 14 aprovações e uma falha. Passaram agenda regular, exceção não letiva/Q34, regularização particular e por gravação, correção de frequência e comparação de períodos SQL/aplicação. A falha vinha da fixture que atribuía o agendamento a um gerente pedagógico sem papel de Secretaria; foi corrigida para usar Secretaria e o caso direcionado passou, sem alterar a autorização do produto.

Vinte e sete testes unitários de período, vigência, política, sessão e rotas passaram. A regressão ampliada seguinte é registrada separadamente no incremento 394. Segunda chamada e entrega de reposições pelo portal continuam em desenvolvimento; não há prova de conclusão integral da SPEC.
