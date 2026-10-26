# QA DEV A — Aria na Atividade (#334)

Candidata sobre a composição local b437e13c4bca27e36b006a1896f3571ea95b9d52, branch codex/inbox-e2-334-aria-atividade. Base de publicação ainda será nomeada pelo ROOT. Não homologada: TSC/UNIT global/lint global originais, revisão independente e visual continuam pendentes.

## Entrega e limites

Leitura COMERCIAL + veLead, histórico de outro lead somente com escopo próprio, Pessoa compatível, keyset após filtro até 30 e contador derivado da mesma lista autorizada. Última ação sem efeito comprovado usa rótulo neutro. Publicação válida é soberana; ausência usa padrão 80/50, inválida não vira fallback. Matriz e confiança derivam da configuração canônica, sem modificar configuração global.

Undo usa o wrapper #354 existente. O opt-in interno só admite replay DESFEITA do mesmo autor com Evento comprovado depois das revalidações e locks; nenhum efeito, Evento ou aviso novo. Wrapper/API default global continuam literais. Sem novos roles, schema, migração, dependências, endpoint duplicado, módulos #357 ou alteração do cabeçalho pertencente ao ROOT.

## Validação final do recorte

Executável Node local, TZ UTC, configurações originais, maxWorkers=1. Não houve filtro por nome nem skip deliberado. Os recortes se sobrepõem e não são somados como suíte global.

| Recorte | Sessão / terminal | Resultado observado |
| --- | --- | --- |
| Wrapper Inbox completo + histórico global completo | 8118 / e6ea7f | EXIT 0; 2 arquivos, 66 testes, 290,40 s; heap 1024 |
| Leitura final Aria/contador/configuração | 17035 / ab8d0b | EXIT 0; 1 arquivo, 7 testes, 31,19 s; heap 1024 |
| Regressões Atividade333 + Detalhes + leitura anterior | 71518 / 3786ea | EXIT 0; 3 arquivos, 25 testes, 99,15 s; heap 1024 |
| Guardas completas e consumidores finais | 54043 / 79e5ba | EXIT 0; 26 arquivos, 693 testes, 97,00 s; heap 1024 |
| ESLint whitelist completa | terminal 55e54a, sem sessão pendente | EXIT 0; 23 arquivos, --max-warnings=0; heap 1024 |

As 26 suítes UNIT finais incluem botoes, enums-rotulos, paleta, Botao, confirmacoes, acoes-cliente, campos-texto, formularios-preservados, anuncios, identificacao-registro, fundo-sobre-pagina, estados-vazios, rotulos, rotulos-dominio, texto Aria, SSR/DOM das alterações e resumo, AbaAtividade, PainelContato SSR/interação, useAbaPainel, InboxNovo.interacao, ConfirmarAcao, escopo-decisao-inbox e painel-abas. Detectores e exceções gerais não foram relaxados. Registros fechados: botão Desfazer neutro/sm, vazio exato da issue e mapa central completo ALTERACAO_ARIA_LABEL. Negativos do mapa comprovam especificamente código cru e conjunto incompleto, sem depender apenas de falta de freeze.

SQL usa vitest.integration.config.ts e perfil dev-email, lease exclusiva, um executor por vez, provedores externos zerados no processo. Banco liberado depois do último terminal; ROOT confirmou restore fee897 EXIT 0 com 558 originais/424 hashes. Sem nova SQL depois disso. Os ajustes posteriores foram editoriais/visuais e de paleta; núcleo TX e consulta autorizada permaneceram os mesmos. A revisão independente ainda deverá usar o commit final exato.

## Provas de segurança e suas fronteiras

- Leitor convidado vê histórico, sem receber decisão; responsável D1 fora da carteira conserva autorização contextual. Outro usuário, convite expirado, finalidade não comercial e atendimento sem lead não recebem o módulo.
- Mais de 100 ações ocultas não esgotam o limite: 105 ocultas antes de 31 visíveis, empate resolvido por ID, lista final de 30 e contador 29. Última ação oculta, Pessoa incompatível e SIMULADA não vazam no resumo.
- Publicada 75/55 prevalece sobre rascunho; ausência projeta somente 80/50; publicação inválida lança erro. Última SUGERIDA não afirma que mudou a etapa.
- Undo concorrente pelo mesmo autor mantém efeito/Evento de efeito e aviso uma vez; replay emite zero. Outro autor, Evento ausente/posterior de outro autor, papel revogado durante espera real, troca de Pessoa e rebind da tarefa recusam. Proteção de alteração humana preservada.
- As esperas usam PostgreSQL real com holders/observação e liberação em finally. Não se afirma ausência geral de deadlocks nem linearizabilidade global de ACL.
- Rollback: falha de evento.create injetada por Proxy no núcleo dentro de transação PostgreSQL real; efeito, status e Eventos revertidos, NOTIFY zero. Esse caso não é falha SQL espontânea nem execução integral da action pública. Os demais controles de autorização/replay passam pelo wrapper público real.
- ConfirmarAcao real: Voltar sem chamada, duplo clique, SSE próprio antes do ACK, A→B→A, desmontar/reabrir, identidade mudada, revogação conhecida e falhas de negócio/transporte. Sem retry automático ou hook/noop artificial.

## Negativos preservados e TDD

Logs privados e terminais permanecem no output do próprio A. Módulo ausente ad6382 é bootstrap, não prova causal de regra. RED causal de puros a5dcf0 teve 2 falhas/1 controle; leitura inicial 71307/8c0a02 teve 3 falhas/1 controle; replay 66415/9896e7 teve 1 falha/27 controles; UI 6ebfff teve 17 falhas/12 controles; DTO 88875/e4491e teve 1 falha/5 controles; resumo fcd5d6 teve 4 falhas/5 controles. Controles adicionais escritos após o primeiro patch são qualificados como regressões adversariais, não reclassificados como RED causal.

Guarda inicial 88774/29bb5b EXIT 1:460/463, falhas de registros botão/vazio e switch de enum fora do mapa central. Primeiro ampliado 5198/fbfe23 EXIT 0:25/686. Complemento de fidelidade e06ef2 EXIT 1:11 falhas/11 controles; o teste SSR corrigiu também o prefixo do classname Tabler para o nome realmente instalado, sem atribuir essa expectativa à produção. GREEN 70d2fa EXIT 0:5/39. Paleta 32693/704401 EXIT 1:692/693 porque warning-solid/danger-solid/warning-text não são utilitários do Tailwind atual. Corrigidos para bg-amber-600, bg-danger e text-amber-700, sem CSS/config/parser. O terminal final 54043/79e5ba é o recibo posterior dessa correção.

Textos neutros também tiveram RED 39a61b EXIT 1:3 falhas/9 controles → GREEN 3adac7 EXIT 0:3/26. Leitura final 32790/0054bd EXIT 1:2 falhas/5 controles → GREEN 17035/ab8d0b. Não se reatribui verde ao source anterior.

## Evidências e pendências

SPEC: inbox-aria-atividade.md. Sourceproof privado comprova wrapper global literal, chamada global com três argumentos e pins de configuração/dependências/perfil/client. O recibo final privado registra commit, paths e hashes dos logs. Per-run hashes de todas as fontes intermediárias não foram capturados; não há alegação de reconstrução byte a byte de cada WIP RED. Logs terminais e hashes finais são preservados.

Blueprint offline: output/inbox-334-blueprint-visual-v1-private.json, versão 2, SHA256 f488cab79959967cd2e4ad0fd5e3f4f415059fc566ff65e0ca24cc9e9678c5db. Inclui Gerente, Admin, responsável D1 fora de carteira, leitor convidado e contexto oculto; IDs novos próprios, dados fictícios e nenhuma intenção pendente externa. Não aplicado, não é captura. Visual APP/PROTO original em 360/820/1440, claro/escuro, exige ambiente e aplicação controlados pelo ROOT.

Permanecem pendentes: gates originais coordenados, QA independente no SHA final, build/CI e aceite visual anexado ao PR. Nenhuma PR, push, servidor, browser ou build iniciado pelo DEV nesta frente.