import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTelaAutorizacoesComunicacaoAcademica } from "@/server/comunicacoes-agenda/autorizacoes";
import { AutorizacoesFormulario } from "./AutorizacoesFormulario";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { Paginacao } from "@/components/Paginacao";
import { hrefLista, lerPagina, type ParametrosUrl } from "@/lib/pagina-url";

export default async function AutorizacoesComunicacaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { id } = await params;
  const pagina = lerPagina(await searchParams);
  // A consulta e a preparação dos dados ficam no try (falha → o mesmo alerta de antes); o JSX é montado
  // fora dele (react-hooks/error-boundaries: try/catch não pega erro de renderização).
  let dados;
  try {
    const [tela, preferencia] = await Promise.all([
      consultarTelaAutorizacoesComunicacaoAcademica({ matriculaId: id, pagina }),
      consultarPreferenciaFusoEquipe(),
    ]);
    dados = {
      tela,
      historico: tela.historico.itens.map((item) => ({ ...item, vigenteEm: item.vigenteEm.toISOString(), revogadaEm: item.revogadaEm?.toISOString() ?? null })),
      fusoExibicao: (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null,
    };
  } catch { return <p role="alert">Não foi possível consultar as autorizações desta matrícula.</p>; }
  const { tela, historico, fusoExibicao } = dados;
  return <section className="space-y-5"><VoltarPara href="/secretaria" />
      <header><h1 className="text-2xl font-medium">Destinatários acadêmicos · {tela.matricula.codigo ?? "Matrícula em preparação"}</h1><p>{tela.matricula.alunoNome}</p><p className="text-sm text-gray-600">Ser responsável ou pagador não autoriza avisos. Registre evidência explícita para cada matrícula.</p></header>
      <AutorizacoesFormulario matriculaId={id} responsaveis={tela.responsaveis} historico={historico} preferenciaFusoExibicao={fusoExibicao} />
      <Paginacao pagina={pagina} temProxima={tela.historico.temProxima} href={(p) => hrefLista(`/matriculas/${encodeURIComponent(id)}/autorizacoes-comunicacao`, { pagina: p })} rotulo="Páginas do histórico" />
    </section>;
}
