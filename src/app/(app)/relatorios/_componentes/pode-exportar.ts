import { exigirCapacidade } from "@/server/_shared/capacidades";

export async function podeExportar(usuario: Parameters<typeof exigirCapacidade>[0]): Promise<boolean> {
  try {
    await exigirCapacidade(usuario, "dados.exportar_leads");
    return true;
  } catch {
    return false;
  }
}
