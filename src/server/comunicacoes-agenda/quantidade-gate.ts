/** Q38 de quantidade só pode alcançar provedores após habilitação operacional explícita. */
export const envioQuantidadeAulasHabilitado = () => process.env.COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED === "true";
