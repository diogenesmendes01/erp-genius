# Incremento 511 — base contratual da continuidade mensal

15/09/2026. Implementação com agentes Terra, revisão e testes pelo orquestrador.

A continuidade automática exige transcrição explícita da condição contratada, vinculada ao documento confirmado da matrícula. Secretaria/Administração prepara uma versão; outra pessoa da Administração confere antes de aprovar. Preparar ou aprovar essa transcrição não emite mensalidade, não renova um contrato sem previsão e não modifica valores já cobrados.

O planejamento mantém cobertura e vencimento independentes. A próxima cobertura vem do período anterior e da referência contratual; o próximo vencimento avança a referência de vencimento, preservando o dia contratado quando o mês seguinte não o possui. A antecedência de emissão é obrigatória e configurável, sem valor presumido. A regra de próximo dia útil exige calendário financeiro e permanece fora desta base de cálculo.

## Dependências para emissão efetiva

Ainda é necessário registrar e conferir disponibilidade da escola para o intervalo, respeitar pausas/retomadas e compensações, impedir sobreposição com cobranças inclusive suspensas/canceladas e persistir a emissão única com memória de cálculo. Matrícula ativa ou aulas previstas não substituem comprovação da oferta. A automação não deve ser ligada antes desses requisitos.

## Verificação

Cinco testes de integração aprovados em `docs/validacao-continuidade-511-2026-09-15.json`: preparação e decisão independente, histórico preservado, leitura financeira sem acesso docente, parâmetros/fonte documental, concorrência e proteções no banco. Sete testes do planejador aprovados em `docs/validacao-planejamento-mensal-511-2026-09-15.json`, incluindo mês bissexto, ciclo contratual, antecedência e vencimento separado da cobertura. TypeScript, lint focado e build aprovados; log em `docs/validacao-build-511-2026-09-15.log`.

A migração 740 foi aplicada somente ao banco descartável. O teste da transcrição semeia um contrato confirmado; não comprova assinatura externa. Ainda não há interface desta configuração, emissão recorrente ou calendário financeiro de dias úteis. Não houve alteração em produção ou envio externo. A base e o planejador não representam entrega da recorrência operacional completa.
