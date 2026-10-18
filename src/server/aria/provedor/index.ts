import { provedorSimulado } from "./simulado";
import { ErroProvedorIA, type ModelosIA, type ProvedorIA } from "./tipos";

export * from "./tipos";
export { provedorSimulado } from "./simulado";

export function chaveConfigurada(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim().length > 0;
}

// O ramo com chave passa a usar criarProvedorAnthropic na Task 4.
export function escolherProvedor(_modelos: ModelosIA): ProvedorIA {
  if (!chaveConfigurada()) return provedorSimulado;
  throw new ErroProvedorIA("SEM_DRIVER");
}
