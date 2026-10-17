import type { DriverWhatsApp, SessaoNumero } from "@prisma/client";
import { recursoDisponivel, type RecursoMotor } from "@/components/conversa/recursos-canal";

const RECURSOS: readonly RecursoMotor[] = ["editar", "apagar", "reagir", "enquete", "figurinha", "gif", "localizacao", "cartaoContato",
  "responderCitando", "confirmacaoLeitura", "digitando", "grupoEnviar", "grupoGerir", "bloquear"];

/** Recursos que o número executa agora: número ativo, sessão CONECTADO e driver que os libera. "Encaminhar" não é RecursoMotor. */
export function capacidadesDoNumero(n: { driver: DriverWhatsApp; ativo: boolean; sessao: SessaoNumero }): RecursoMotor[] {
  if (!n.ativo || n.sessao !== "CONECTADO") return [];
  return RECURSOS.filter((r) => recursoDisponivel(n.driver, r));
}
