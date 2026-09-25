import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAlcadasAditivo } from "@/server/contratos/aditivo-alcadas";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { FormularioAlcada } from "./Formulario";
import { VoltarPara } from "@/components/VoltarPara";

const nomes = { FINANCEIRA: "Financeira", COMERCIAL: "Comercial", PEDAGOGICA: "Pedagógica" } as const;
const texto = (valor: unknown) => typeof valor === "string" ? valor : "";

export default async function AlcadasAditivoPage({ params }: { params: Promise<{ id: string; propostaId: string }> }) {
  await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL, Papel.GERENTE_PEDAGOGICO);
  const { id: matriculaId, propostaId } = await params;
  const [resultado, preferencia] = await Promise.all([consultarAlcadasAditivo({ matriculaId, propostaId }), consultarPreferenciaFusoEquipe()]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const dado = resultado.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  const vigencia = formatarInstanteExibicao(dado.vigenciaInicio, fusoExibicao, "UTC");
  // O cabeçalho da matrícula (código · aluno · estado) vem do layout de /matriculas/[id]; aqui, o caminho de volta ao aditivo.
  return <div className="space-y-5"><VoltarPara href={`/matriculas/${matriculaId}/contrato/aditivos/${propostaId}`} para="Aditivo" /><h1 className="text-2xl">Alçadas da proposta de aditivo</h1>
    <p>As decisões abaixo tratam os impactos desta proposta. Elas não aplicam condições novas, não alteram horários e não formalizam o aditivo.</p>
    <p>Vigência proposta: {vigencia.texto} (horário exibido em {vigencia.fuso}; referência contratual preservada).</p>
    {dado.superada && <p role="status">Existe uma proposta mais recente; esta versão permanece somente para consulta.</p>}
    {dado.alcadas.length ? dado.alcadas.map(item => <section key={item.alcada} className="space-y-3 rounded border p-4"><h2 className="text-xl">Alçada {nomes[item.alcada]}</h2>
      <dl className="space-y-2">{item.campos.map(campo => <div key={texto(campo.campo)} className="rounded border p-2"><dt className="font-medium">{texto(campo.rotulo)}</dt><dd>Anterior: {texto(campo.anterior)}</dd><dd>Novo: {texto(campo.novo)}</dd></div>)}</dl>
      {item.decisao ? <p role="status">{item.decisao.aprovada ? "Aprovada" : "Rejeitada"}. {item.decisao.motivo}</p> : dado.podeDecidir.includes(item.alcada) ? <FormularioAlcada matriculaId={matriculaId} propostaId={propostaId} propostaHash={dado.propostaHash} alcada={item.alcada} /> : <p role="status">Aguardando decisão da pessoa com a alçada correspondente.</p>}
    </section>) : <p role="status">Não há alçadas adicionais disponíveis para esta proposta.</p>}
  </div>;
}
