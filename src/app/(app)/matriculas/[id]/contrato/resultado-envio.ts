/** Mensagem da tela após o envio/conciliação integrados (contrato ou aditivo). Frase do fluxo, não rótulo do
 * estado (o rótulo é ESTADO_ENVIO_ASSINATURA_LABEL): diz o que o resultado significa e o próximo passo. */
const MENSAGEM_RESULTADO_ENVIO: Readonly<Record<string, string>> = Object.freeze({
  ENVIADO: "Documento registrado no serviço de assinatura. Isso ainda não comprova assinatura nem aplica condições.",
  ENVIO_INCERTO: "O serviço não confirmou a criação. Não repita o envio: concilie o resultado antes de prosseguir.",
  PREPARADO: "O serviço confirmou que nada foi criado. Revise a pendência antes de enviar novamente.",
});

export const mensagemResultadoEnvio = (estado: string | undefined) =>
  MENSAGEM_RESULTADO_ENVIO[estado ?? ""] ?? "Resultado registrado. Confira o estado do envio.";
