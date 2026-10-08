// Aviso ao sair do editor de templates do WhatsApp (docs/43 §6 item 3): o formulário aberto só conta como
// alteração não salva quando difere do template de origem (ou do formulário vazio, num template novo). Fica
// fora do TemplatesPainel para a mudança lá ser de uma linha (a PR paralela do ConfirmarAcao mexe no painel).

/** Os campos editáveis de um template (os mesmos do formulário do painel). */
export type CamposTemplate = { id?: string; nome: string; corpo: string; idioma: string; categoria: string };

/** O formulário vazio de um template novo (o mesmo FORM_VAZIO do painel). */
export const TEMPLATE_VAZIO: CamposTemplate = { nome: "", corpo: "", idioma: "es", categoria: "utility" };

/** Categoria como o formulário a mostra: só "marketing" fica; o resto é "utility". */
const categoriaDoFormulario = (categoria: string) => (categoria === "marketing" ? "marketing" : "utility");

/**
 * O formulário aberto tem alteração não salva? Sem formulário, não. Editando um template, compara com ele
 * (pelo id); template novo, com o vazio. Um id que sumiu da lista (outra pessoa apagou) conta como alterado.
 */
export function templateAlterado(form: CamposTemplate | null, templates: readonly CamposTemplate[]): boolean {
  if (!form) return false;
  const origem = form.id ? templates.find((t) => t.id === form.id) : TEMPLATE_VAZIO;
  if (!origem) return true;
  return form.nome !== origem.nome || form.corpo !== origem.corpo || form.idioma !== origem.idioma
    || categoriaDoFormulario(form.categoria) !== categoriaDoFormulario(origem.categoria);
}
