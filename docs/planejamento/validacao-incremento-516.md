# Incremento 516 — consulta de indisponibilidade e Q156

15/09/2026. Implementação e revisão com agentes Terra, integração pelo orquestrador.

O loader agora recusa matrícula inexistente e datas fora dos anos 0001–9999. A projeção de confirmações positivas tem limite de 20 registros e sinaliza `temMais`; as consultas de existência não dependem desse corte. Uma confirmação positiva não fica escondida por relatos pendentes anteriores. Ausência de relato continua sem comprovar oferta disponível.

O teste de isolamento usa duas matrículas reais do mesmo aluno. Um novo caso executa duas confirmações simultâneas e exige uma decisão e um evento. O runner falhou inicialmente ao resolver duas importações dinâmicas mockadas de NextAuth; apenas nesse caso a sessão foi fixada no guard inicial. A ação continua executando as transações reais, locks e reconsulta de papel ativo. Os demais testes mantêm o caminho habitual de autenticação simulada.

A tela preserva início/fim como datas civis e mostra os instantes de registro/decisão no fuso institucional validado. Na ausência de configuração, identifica explicitamente UTC. Sem ensaio interativo de interface.

## Evidências

- Dez integrações aprovadas em `docs/validacao-integracao-516-2026-09-15.json`, incluindo paginação limitada, escopo, datas, confirmação independente e concorrência.
- ESLint focado aprovado.
- Build aprovado: `docs/validacao-build-516-2026-09-15.log`.
- Sem migração nova, produção, assinatura externa ou envio de mensagens.

## Decisões e próximos requisitos

Q156 aprovada pelo usuário e incorporada à FIN-02.1: Secretaria/gestão propõe o fim da falta de oferta; outra pessoa da Gestão Pedagógica/Administração aprova. O fluxo ainda precisa ser implementado como fatos que preservam o histórico, sem reativar matrícula ou cobrar automaticamente. Q157 continua aguardando resposta sobre correção de relato confirmado.

A revisão das fontes de oferta encontrou alocações, agendas e reservas com conferências próprias. A validação de nova admissão não pode ser reutilizada literalmente na recorrência: aplica janela de entrada, enquanto o aluno já contratado continua estudando. Emissão mensal ainda depende de integrar contrato, cobertura, oferta aplicável e ajustes de pausa/compensação; este incremento não conclui FIN-02 ou a SPEC integral.
