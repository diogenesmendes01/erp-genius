import { exigirCapacidade } from "@/server/_shared/capacidades";

/** Exportar CSV exige `dados.exportar_leads` (relida do banco); sem ela o botão nem aparece. A rota confere de novo. */
export async function podeExportar(usuario: Parameters<typeof exigirCapacidade>[0]): Promise<boolean> {
  try {
    await exigirCapacidade(usuario, "dados.exportar_leads");
    return true;
  } catch {
    return false;
  }
}
