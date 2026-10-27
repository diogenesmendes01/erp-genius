export type CamposTemplate = { id?: string; nome: string; corpo: string; idioma: string; categoria: string };

export const TEMPLATE_VAZIO: CamposTemplate = { nome: "", corpo: "", idioma: "es", categoria: "utility" };

const categoriaDoFormulario = (categoria: string) => (categoria === "marketing" ? "marketing" : "utility");

export function templateAlterado(form: CamposTemplate | null, templates: readonly CamposTemplate[]): boolean {
  if (!form) return false;
  const origem = form.id ? templates.find((t) => t.id === form.id) : TEMPLATE_VAZIO;
  if (!origem) return true;
  return form.nome !== origem.nome || form.corpo !== origem.corpo || form.idioma !== origem.idioma
    || categoriaDoFormulario(form.categoria) !== categoriaDoFormulario(origem.categoria);
}
