import type { classificarAlteracoesAditivo } from "@/server/contratos/aditivo-impactos";

const grupos = { CADASTRAL: "Cadastro", FINANCEIRO: "Financeiro", CONTRATUAL: "Regime contratual", ACADEMICO: "Agenda acadêmica" };
const tipos = { TEXT: "Texto", EMAIL: "E-mail", DINHEIRO: "Valor e moeda", DATA: "Data", MINUTOS: "Duração em minutos", MOEDA: "Moeda", REGIME: "Regime de cobrança", AGENDA: "Agenda e disponibilidade" };
export function ImpactosPainel({ classificacao }: { classificacao: ReturnType<typeof classificarAlteracoesAditivo> }) {
  return <section className="space-y-3 rounded border p-4"><h2 className="text-xl">Alterações e requisitos para aplicação</h2>
    <p>Áreas envolvidas: {classificacao.grupos.map(g => grupos[g]).join(", ")}.</p>
    <p>A classificação identifica o tratamento necessário. A aprovação desta proposta documental não confirma que os efeitos operacionais e suas aprovações já foram resolvidos.</p>
    {classificacao.impactos.map(i => <article key={i.campo} className="space-y-1 rounded border p-3"><h3 className="font-medium">{i.rotulo}</h3>
      <p>{grupos[i.grupo]} · {tipos[i.tipo]}</p><p className="whitespace-pre-wrap">Anterior: {i.anterior}</p><p className="whitespace-pre-wrap">Novo: {i.novo}</p>
      {i.pendencias.map(p => <p key={p}>{p}</p>)}
    </article>)}
    <p>Os valores acima preservam o texto da proposta. A validação de valores, períodos, moeda e agenda precisa ser concluída antes de produzir efeitos nos demais módulos.</p>
  </section>;
}
