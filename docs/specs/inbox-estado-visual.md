# Inbox E1.4 — Avatar, BadgeEstado e estado visual (#309)

Contrato da Task4 do plano02 e índice aprovados. Esta task entrega os produtores;
ItemConversa (Task7), cabeçalho (Task10) e painel (Task13) os integrarão. Sem tela
própria: o aceite app × protótipo dos novos usos entra na Task7, em três tamanhos
e dois temas. Não se presume homologação visual dos futuros consumidores.

Avatar mantém fundo suave da marca, texto da marca, tamanhos32/40/48 e raios
anteriores quando não recebe tom. O tom opcional usa classes literais dos oito
tokens avatar; tomDoAvatar calcula FNV-1a do id e retorna1–8. Os tamanhos44 e132
usam texto14/600 e44/500 com tracking−0,01em, respectivamente. Quadrado44 usa
rounded-lg; quadrado132 usa raio34. O seloIA opcional tem19px, ícone10, fundoIA,
borda2 da superfície e deslocamento−3px. A presença do selo não liga IA na E1.

iniciais considera a primeira letra Unicode da primeira e da última palavra que
tenham letras. Emoji e palavras só numéricas são ignorados, inclusive sem cortar
pares surrogate; ausência de letras renderiza #. A correção das iniciais vale
para o componente compartilhado; suas cores e medidas legadas não mudam.

BadgeEstado aceita tom, children, ponto (padrão true), tracejado e ícone. Tem
altura20, padding horizontal7, raio6, texto11 e gap5. Ponto6 usa a cor corrente.
Peso600 quando há ponto ou tom diferente de neutro; setor neutro sem ponto usa400.
Tracejado usa borda dashed do token de linha e texto neutro, sem fundo.

estadoVisualItem é puro e usa agora explícito. Ordem: estado → setor → prazo →
Sem nome → Na fila. Com responsável mostra Com você ou primeiro nome; encerrado
mostra Encerrado; sem responsável aberto mostra Na fila tracejado no fim. Grupo
não recebe badges. O setor usa os rótulos existentes. Prazo usa prazoEstourado da
E0, só estritamente no passado e não em grupo/encerrado; minutos vencidos são
floor com mínimo1. Até29min fica sem-resposta, a partir de30min fica atraso.
O texto converte60min em1h e125min em2h5min. Sem nome aparece apenas sem letra.
A prévia nula vira string vazia; o avatar usa hash do contato; seloIa é false naE1.

estadoVisualCabecalho fornece o status automático existente, o estado por
responsável/grupo/encerramento e subtítulo setor · número. Nenhuma regra de
permissão, consulta, schema, transporte ou prazo foi alterada.

Os mapas CLASSES_TOM, PONTO_TOM e TEXTO_TOM cobrem ia, aprovacao, handoff, humano,
sem-resposta, atraso e neutro com tokens existentes da306. Não foi necessário
relaxar travas globais nem acrescentar exceção de fundo; estado-visual.ts não é
um componente.tsx e os consumidores ficam dentro das superfícies previstas.

Verificações e pendências estão no quadro único e em output/inbox-309-report.md.
