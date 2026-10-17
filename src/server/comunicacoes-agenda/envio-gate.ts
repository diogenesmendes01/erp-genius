/** Habilitação operacional do envio de avisos de alteração de agenda. Lida no worker e no
 * cron de agenda e também no despachante geral do WhatsApp: o cron geral drena a mesma
 * fila e, sem esta conferência, enviaria avisos de agenda com o envio desligado. */
export const envioAvisosAgendaHabilitado = () => process.env.COMUNICACOES_AGENDA_ENVIO_ENABLED === "true";

/** Motivo gravado pelo despachante na intenção de aviso de agenda retida com o envio de
 * agenda desligado (revisão R1 do #209, C2). O status não muda (PENDENTE/ADIADA): o motivo
 * só explica, na fila operacional e na saúde do canal, por que o aviso não sai. */
export const MOTIVO_ENVIO_AGENDA_DESLIGADO = "envio_agenda_desligado";
