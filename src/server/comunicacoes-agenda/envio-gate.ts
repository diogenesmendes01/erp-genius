/** Habilitação operacional do envio de avisos de alteração de agenda. Lida no worker e no
 * cron de agenda e também no despachante geral do WhatsApp: o cron geral drena a mesma
 * fila e, sem esta conferência, enviaria avisos de agenda com o envio desligado. */
export const envioAvisosAgendaHabilitado = () => process.env.COMUNICACOES_AGENDA_ENVIO_ENABLED === "true";
