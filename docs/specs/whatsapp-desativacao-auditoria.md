# WhatsApp — auditoria de desativação e exclusão (#418)

Dependência técnica descoberta na Integração da PR416. O logout do motor persistia DESCONECTADO antes da transação administrativa. A releitura fresca desta transação então suprimia NumeroWhatsAppDesconectado, deixando somente Desativado/Excluido; uma falha posterior também deixava a sessão previamente alterada fora do rollback administrativo.

A ação administrativa solicita somente o comando externo `solicitarLogoutMotor({providerRef})`. Este comando faz o POST e propaga o erro do motor, sem ler/gravar o banco. A transação administrativa conserva a releitura fresca, confirma estado/inativação/exclusão e registra os eventos com autor na mesma transação. Não volta ao snapshot anterior ao logout. A API existente `desconectarNumeroMotor` mantém seu contrato de comando mais sincronização local; desconectar explicitamente continua registrando o evento pela ação administrativa, sem duplicação pelo helper.

Não há schema, migração, dependência, permissão ou integração externa nova. Motor inexistente conserva a tolerância administrativa atual; indisponibilidade recusa a operação. Repetir desativação/exclusão não recria eventos ou logout. Conexão concorrente observada antes da transação continua determinando o `de` do evento. Se a gravação do evento final falha, estado e eventos locais são revertidos. O efeito externo de um logout não pode ser revertido pela transação local; os testes usam exclusivamente motor simulado.

Evidências ROOT, sem filtro de nome/skips:

- Reprodução original4084/87c6a3: arquivo completo28 testes,27 positivos/uma falha,107,50s.
- RED reforçado34808/f35559: arquivo completo32 testes,25 positivos/sete falhas causais,130,60s. Inclui desativação/exclusão, contagem/autor/payload, releitura CAIU durante resposta do motor e rollback dos dois eventos/estado.
- RED unitário2da5a1: três casos falham pela ausência da nova função; oito passam. Não é uma reprodução adicional do defeito de produção.
- GREENdc059b:11 UNIT completos e lint4 estrito, saída0. GREEN15687/6924fa:dois arquivos completos/40 INT (administração e processamento de sessão),146,20s,maxWorkers1,saída0, banco descartável integracao487. Restaurado c82270,saída0,424 hashes/snapshot494.
- Fonte dos quatro arquivos preservada por hash no fast-forward da base239 para main ae56c00f (#417), prova9c98cf. Os40 INT são nominais à mesma fonte backend, sem nova execução depois desse fast-forward. TSC90998/c4c4a0 e lint global36395/dca4ff (zero erros/40 avisos herdados), saída0 na nova composição.

Regressão global91717/006c1a:saída0,926 arquivos/7.313 testes,242,24s,maxWorkers2,sem filtro de casos ou skips; configuração unitária exclui INT. QA independente, PR, CI e merge ainda pendentes. Nenhuma mensagem real, chamada ao motor real ou deploy foi feito nos testes.
