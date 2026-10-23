import { Aviso } from "@/components/Aviso";

/** Sinalização obrigatória do driver SIMULADO (ASSINATURA_DRIVER=simulado) em toda tela que envia ou cancela. */
export function AvisoAssinaturaSimulada() {
  return <Aviso tom="atencao" titulo="Integração de assinatura SIMULADA">
    Nenhum documento é enviado ao cliente nem a um serviço de assinatura real. O processo fica registrado como
    Simulado, em ambiente de teste, e não comprova envio, assinatura ou aceite.
  </Aviso>;
}
