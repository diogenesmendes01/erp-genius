import type { DriverWhatsApp, SessaoNumero } from "@prisma/client";
import { RECURSOS_MOTOR, recursoDisponivel, type RecursoMotor } from "@/components/conversa/recursos-canal";
import { ErroRegra } from "@/server/_shared/sessao";

type EstadoNumero = { driver: DriverWhatsApp; ativo: boolean; sessao: SessaoNumero };

export const MSG_NUMERO_INATIVO = "Este número está inativo.";
export const MSG_MOTOR_DESCONECTADO = "O WhatsApp deste número não está conectado agora. Reconecte o número e tente de novo.";

/** Recursos que o número executa agora: número ativo, sessão CONECTADO e driver que os libera (encaminhar inclusive: message.forward). */
export function capacidadesDoNumero(n: EstadoNumero): RecursoMotor[] {
  if (!n.ativo || n.sessao !== "CONECTADO") return [];
  return RECURSOS_MOTOR.filter((r) => recursoDisponivel(n.driver, r));
}

/**
 * Trava única das ações do Inbox que dependem do motor: recusa com ErroRegra, sem I/O, quando o número está inativo,
 * não é MOTOR ou a sessão não está CONECTADO. Cada ação confere antes o driver com a própria mensagem de canal.
 */
export function exigirMotorConectado(n: EstadoNumero): void {
  if (!n.ativo) throw new ErroRegra(MSG_NUMERO_INATIVO);
  if (n.driver !== "MOTOR") throw new ErroRegra("Este canal não executa esta ação.");
  if (n.sessao !== "CONECTADO") throw new ErroRegra(MSG_MOTOR_DESCONECTADO);
}
