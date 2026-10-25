# Interruptor global da Aria no Inbox — #359 / D4

## Contrato

A faixa existente oferece um interruptor somente quando `SituacaoAriaInbox.podeGerenciar` é verdadeira, derivada da capacidade global `pausar`: Administrador e Gerente Comercial. Ele pausa/reativa a Aria globalmente. Não altera o modo operacional, o responsável ou a pausa de uma conversa; não cancela sugestões/intencoes nem implementa #355/#356/#357.

ATIVA e SHADOW preservam suas faixas e textos. O interruptor usa `aria-checked={!pausada}` inclusive no ensaio; SHADOW continua “Aria em ensaio”. DESLIGADA continua sem faixa. A trilha visual mede36×20px e o Botao canônico preserva o alvo de toque mínimo44px. A região mantém nome, título vivo separado das contagens e Gerenciar com NextLink/prefetch=false.

Pausar abre Modal canônico com motivo obrigatório aparado, entre1e500caracteres. Cancelar/Escape não executam ação e o foco retorna ao gatilho; o campo recebe foco ao abrir. Busy bloqueia fechamento e o executor impede duplo clique. Reativar não pede motivo. Erros e transporte incerto preservam o motivo e permitem retry idêntico. Estado checked não é otimista: vem do resumo fresco. ACK atual aciona a recarga já existente de lista/painel, sem novo fetch/polling/SSE. Mudança de modo/pausa/capacidade encerra o controlador local; ACK antigo não fecha nova abertura nem recarrega/foca outra geração. A conversa/rascunho não é remontada.

## Servidor e locks

APIs existentes `pausarAria({motivo})` e `reativarAria()` preservadas. Depois do precheck autenticado, a TX usa o upsert singleton legado e lock AgenteIA FOR UPDATE. O ator é relido por `tx.usuario.findUnique` após o lock; usuário ausente/inativo ou sem capacidade pausar é recusado antes de qualquer efeito. Não usa a sessão memoizada como autorização final. Não adiciona lock ConfigIA/ConfiguracaoOperacional/Atendimento, advisory ou conexão global dentro da TX.

Já pausada: somente o último Evento AriaPausada do agregado AgenteIA/aria, do MESMO autor e motivo trim idêntico permite retorno ok sem escrita/evento novo. Outro autor/motivo continua recusado. Já reativada: mesmo critério de autor do último AriaReativada; ausência de histórico e outro autor continuam recusados. Reutiliza `ultimoEventoDoAutor` após lock; sem chave/contrato genérico novo. A flag idempotente do cabeçalho /aria é a única mudança ali.

O trigger345 publica aria.global após mudança real de estado/pausadoEm no commit; retry sem update não publica outra mudança. Rollback não publica. O consumidor atual recarrega resumo/painel; falha503 conserva dados conhecidos. O upsert ConfigIA legado do leitor de orçamento não foi expandido pela mutação.

## Validação e limites

TDD e recibos em `output/inbox-359-report.md`. Cobertura real Modal/hook/cliente, mapa exato três botões com mutantes e permissões/estado/avisos nativos. Integração autorizada só no perfil ci-integracao492, sete provedores vazios no executor. Lease liberada após terminal; fixtures finais permanecem e não se presume restore503.

Entrega DEV não encerra a issue: QA independente, TypeScript/gates globais originais e build/aceite visual do integrador continuam pendentes. Aceite visual:1440×900,1024×768,390×844, claro/escuro, switch ligado/desligado e diálogo de motivo comparados com o protótipo. Nenhum servidor/captura/provedor/envio real executado pelo DEV.

Revisão R1: o Campo canônico do motivo integra o manifesto nominal em campos-mapa.ts, com arquivo/rótulo/obrigatoriedade/controle exatos. Guardas completas e mutantes de registro ausente, rótulo e obrigatoriedade protegem o contrato; nenhuma exceção/parser genérico foi ampliado. Runtime e integração permanecem literais da entrega original. Gates originais distinguem fonte b7a e filha no relatório e recibos.
