import { instanteDaGrade } from "@/server/agenda/grade";
import { fusoIanaValido } from "@/server/operacao/fuso";

export function textoPreviaConversao(local: string, fuso: string, fusoExibicao: string): string | null {
  const origem: string = fuso.trim(), destino: string = fusoExibicao.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local) || !fusoIanaValido(origem) || !fusoIanaValido(destino) || origem === destino) return null;
  let instante: Date;
  try {
    instante = instanteDaGrade(local.slice(0, 10), local.slice(11, 16), origem);
  } catch (e: unknown) {
    return e instanceof Error && /amb[ií]guo|inexistente/.test(e.message)
      ? `Esse horário não existe ou se repete em ${origem} por causa da mudança de horário; escolha outro antes de enviar.`
      : null;
  }
  const texto: string = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: destino }).format(instante);
  return `Isso será ${texto} em ${destino}, o fuso em que a tela exibe os horários.`;
}

export function PreviaConversao({ local, fuso, fusoExibicao, className = "text-sm text-gray-600" }: { local: string; fuso: string; fusoExibicao: string; className?: string }) {
  const texto: string | null = textoPreviaConversao(local, fuso, fusoExibicao);
  return texto ? <p className={className}>{texto}</p> : null;
}
