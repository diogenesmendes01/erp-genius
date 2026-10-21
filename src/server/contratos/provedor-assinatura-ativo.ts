import { ErroRegra } from "@/server/_shared";
import type { ProvedorAssinatura } from "./provedor-assinatura";
import { armazemSimuladoPrisma, criarProvedorSimulado } from "./provedor-assinatura-simulado";

// Qual driver de assinatura vale, por `ASSINATURA_DRIVER` (mesmo espírito de WHATSAPP_LIVE, do provedor
// simulado da Aria e de PAGAMENTO_SIMULADO: nada é ligado sem valor explícito no ambiente).
//   vazio      → sem integração: as telas seguem no registro manual do documento assinado.
//   "simulado" → driver SIMULADO. Nada sai do ERP; o processo fica com fornecedor SIMULADO e ambiente
//                SANDBOX, as telas mostram o aviso e o banco impede efeito contratual real. Aceito também
//                com NODE_ENV=production (é o build do UAT), mas avisa no log.
//   outro      → erro alto: o fornecedor real (Q155) ainda não tem driver.

export type DriverAssinatura = { tipo: "MANUAL" } | { tipo: "SIMULADO" };

let avisouProducao = false;

export function lerDriverAssinatura(env: Record<string, string | undefined> = process.env): DriverAssinatura {
  const driver = env.ASSINATURA_DRIVER?.trim().toLowerCase();
  if (!driver) return { tipo: "MANUAL" };
  if (driver === "simulado") {
    if (env.NODE_ENV === "production" && !avisouProducao) {
      avisouProducao = true;
      console.warn("[assinatura] ASSINATURA_DRIVER=simulado: envio e cancelamento de assinatura usam o driver SIMULADO. Nenhum documento é enviado a cliente; processos ficam como SIMULADO/SANDBOX.");
    }
    return { tipo: "SIMULADO" };
  }
  console.error(`[assinatura] ASSINATURA_DRIVER="${driver}" não é reconhecido (aceitos: vazio ou "simulado").`);
  throw new ErroRegra("A integração de assinatura eletrônica está mal configurada. Avise a administração do sistema; o fornecedor real (Q155) ainda não possui driver.");
}

let simulado: ProvedorAssinatura | null = null;

/** Driver ativo, ou `null` quando não há integração (registro manual). */
export function provedorAssinaturaAtivo(env: Record<string, string | undefined> = process.env): ProvedorAssinatura | null {
  const driver = lerDriverAssinatura(env);
  if (driver.tipo === "MANUAL") return null;
  return simulado ??= criarProvedorSimulado(armazemSimuladoPrisma());
}
