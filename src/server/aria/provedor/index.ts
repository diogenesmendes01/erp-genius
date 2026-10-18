import { criarProvedorAnthropic, clientePadrao } from "./anthropic";
import { provedorSimulado } from "./simulado";
import { type ModelosIA, type ProvedorIA } from "./tipos";

export * from "./tipos";
export { provedorSimulado } from "./simulado";
export { criarProvedorAnthropic, clientePadrao, type ClienteMensagens } from "./anthropic";

export function chaveConfigurada(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim().length > 0;
}

export function escolherProvedor(modelos: ModelosIA): ProvedorIA {
  if (!chaveConfigurada()) return provedorSimulado;
  return criarProvedorAnthropic(clientePadrao(), modelos);
}
