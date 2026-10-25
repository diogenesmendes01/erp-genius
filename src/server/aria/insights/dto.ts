import { normalizarInsight, type AnaliseInsight } from "./saida";

export interface LeituraInsightAutorizada {
  autorizado: boolean;
  capacidadeAtualizar: boolean;
  indisponivel: boolean;
  emCurso: { id: string; estado: "PROCESSANDO" | "INCERTO" } | null;
  ultima: { id: string; geradoEm: Date; simulada: boolean; resultadoJson: unknown } | null;
  novasMensagens: number;
  contextoAlterado: boolean;
}
export interface InsightPainel {
  podeAtualizar: boolean;
  podeDescartarIncerta: boolean;
  estado: "vazio" | "pronto" | "gerando" | "incerto" | "indisponivel";
  geracaoEmCursoId: string | null;
  ultima: { geracaoId: string; geradoEm: string; simulada: boolean; analise: AnaliseInsight } | null;
  novasMensagens: number;
  contextoAlterado: boolean;
}

/** Projeção pura; o produtor deve autorizar ANTES de buscar a geração e calcular a base. */
export function projetarInsightPainel(entrada: LeituraInsightAutorizada): InsightPainel | null {
  if (!entrada.autorizado) return null;
  const analise = entrada.ultima ? normalizarInsight(entrada.ultima.resultadoJson) : null;
  if (entrada.ultima && !analise) throw new Error("Análise de Insights inválida.");
  const estado: InsightPainel["estado"] = entrada.emCurso?.estado === "INCERTO" ? "incerto"
    : entrada.emCurso ? "gerando" : entrada.indisponivel ? "indisponivel"
      : entrada.ultima ? "pronto" : "vazio";
  return {
    podeAtualizar: entrada.capacidadeAtualizar && !entrada.indisponivel && !entrada.emCurso,
    podeDescartarIncerta: entrada.capacidadeAtualizar && estado === "incerto",
    estado,
    geracaoEmCursoId: entrada.emCurso?.id ?? null,
    ultima: entrada.ultima && analise ? {
      geracaoId: entrada.ultima.id,
      geradoEm: entrada.ultima.geradoEm.toISOString(),
      simulada: entrada.ultima.simulada,
      analise,
    } : null,
    novasMensagens: entrada.novasMensagens,
    contextoAlterado: entrada.contextoAlterado,
  };
}
