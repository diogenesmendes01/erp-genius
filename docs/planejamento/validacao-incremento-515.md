# Incremento 515 — confirmação da falta de oferta

15/09/2026. Implementação com agentes Terra e validação pelo orquestrador.

O relato de falta de oferta recebe confirmação ou recusa independente da Gerência Pedagógica/Administração. A decisão é única e imutável, preserva justificativa/evidência e impede autoaprovação mesmo com acúmulo de papéis. Repetir a mesma decisão não duplica registros; decisão divergente exige tratamento próprio, sem sobrescrever o histórico.

A interface permite registrar relatos, consultar páginas do histórico e confirmar conforme a permissão do usuário. Financeiro consulta sem registrar. A prévia mensal passa a identificar falta de oferta confirmada ou relato ainda pendente quando o intervalo se sobrepõe à cobertura consultada. Relato recusado não fica pendente. Ausência de relato não comprova oferta disponível.

## Limites

Ainda faltam fechamento/correção de intervalos e integração à emissão recorrente. Nenhuma confirmação apaga cobranças ou reprograma cobertura. O controle impede a prévia de anunciar emissão autorizada, mas ainda não existe emissor recorrente operacional. Sem ensaio interativo da interface, produção ou serviços externos reais.

## Verificação

Regressão com 41 testes de integração aprovada (`validacao-integracao-515-2026-09-15.json`). Os seis casos específicos de indisponibilidade também foram revalidados separadamente; não são seis casos adicionais à regressão. A rodada anterior teve uma falha na projeção `podeRegistrar`, corrigida antes da repetição aprovada. Migração 770 aplicada somente ao banco descartável.

A revisão independente encontrou seleção incorreta da última versão aprovada na prévia: uma condição futura podia impedir a condição ainda vigente. A seleção agora usa o início da próxima cobertura e desempata por versão. O cenário mensal completo foi revalidado com condição futura aprovada, preservando condição vigente, vencimento e cobranças (`validacao-vigencia-515-2026-09-15.json`: um caso executado, 34 não selecionados). ESLint focado e build final aprovados após essas correções (`validacao-build-515-2026-09-15.log`).

Na interface, erros usam alerta acessível e sucesso usa mensagem de status. A revisão de banco não encontrou bypass de independência/imutabilidade no escopo examinado. Isto não representa auditoria integral do ERP.
