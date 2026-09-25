import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarPropostaEquivalencia } from "@/server/avaliacoes/equivalencia-consulta";
import { ConteudoRegraAvaliacaoSchema } from "@/server/avaliacoes/regra-schema";
import { AcoesEquivalencia } from "./AcoesEquivalencia";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";

type Habilidade = "FALA" | "COMPREENSAO_ORAL" | "LEITURA" | "ESCRITA";
const nomesHabilidade: Record<Habilidade, string> = {
  FALA: "Comunicação oral",
  COMPREENSAO_ORAL: "Compreensão oral",
  LEITURA: "Leitura",
  ESCRITA: "Escrita",
};
const textoTurma = (turma: { codigo: string | null; nome: string | null }) => turma.codigo ?? turma.nome ?? "Turma sem identificação";
const ehObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === "object" && valor !== null && !Array.isArray(valor);
const ehHabilidade = (valor: unknown): valor is Habilidade => typeof valor === "string" && valor in nomesHabilidade;
const texto = (valor: unknown) => typeof valor === "string" ? valor : null;
const chaveRequisito = (codigo: string, habilidade: string) => `${codigo}\u0000${habilidade}`;
const nota = (valor: string) => valor.replace(".", ",");
const nomeTipoFonte = (tipo: "REGULAR" | "RECUPERACAO" | "APROVEITAMENTO") => tipo === "RECUPERACAO" ? "Recuperação por habilidade" : tipo === "APROVEITAMENTO" ? "Aproveitamento de transferência anterior" : "Avaliação regular";

function avaliacoesDaRegra(snapshot: Record<string, unknown>, campo: "regraOrigem" | "regraDestino") {
  const regra = ehObjeto(snapshot[campo]) ? snapshot[campo] : null;
  const conteudo = regra && ehObjeto(regra) ? regra.conteudo : null;
  const validado = ConteudoRegraAvaliacaoSchema.safeParse(conteudo);
  return new Map(validado.success ? validado.data.avaliacoes.map((avaliacao) => [avaliacao.codigo, avaliacao.titulo]) : []);
}

function resumoPedagogico(snapshot: unknown, mapeamentos: unknown) {
  const raiz = ehObjeto(snapshot) ? snapshot : {};
  const avaliacoesOrigem = avaliacoesDaRegra(raiz, "regraOrigem");
  const avaliacoesDestino = avaliacoesDaRegra(raiz, "regraDestino");
  const fontes = Array.isArray(raiz.fontesOficiais) ? raiz.fontesOficiais.flatMap((fonte, indice) => {
    if (!ehObjeto(fonte)) return [];
    const referenciaId = texto(fonte.referenciaId), habilidade = fonte.habilidade, valorNota = texto(fonte.nota);
    const codigoAvaliacao = texto(fonte.codigoAvaliacao);
    if (!referenciaId || !ehHabilidade(habilidade) || !valorNota) return [];
    const tipo = fonte.tipoFonte === "APROVEITAMENTO" ? "APROVEITAMENTO" as const : fonte.tipoFonte === "RECUPERACAO" || codigoAvaliacao === null ? "RECUPERACAO" as const : "REGULAR" as const;
    return [{ referenciaId, ordem: indice + 1, habilidade, nota: valorNota,
      tipo,
      avaliacao: tipo === "RECUPERACAO" ? `Recuperação de ${nomesHabilidade[habilidade]}` : `${avaliacoesOrigem.get(codigoAvaliacao ?? "") ?? "Avaliação"} (${codigoAvaliacao})`,
    }];
  }) : [];
  const itens = ehObjeto(raiz.projecao) && Array.isArray(raiz.projecao.itens) ? raiz.projecao.itens.flatMap((item, indice) => {
    if (!ehObjeto(item)) return [];
    const codigoAvaliacao = texto(item.codigoAvaliacao), habilidade = item.habilidade, peso = texto(item.pesoAvaliacao);
    if (!codigoAvaliacao || !ehHabilidade(habilidade) || !peso) return [];
    return [{ chave: chaveRequisito(codigoAvaliacao, habilidade), ordem: indice + 1, habilidade, peso,
      avaliacao: `${avaliacoesDestino.get(codigoAvaliacao) ?? "Avaliação"} (${codigoAvaliacao})` }];
  }) : [];
  const fontesPorId = new Map(fontes.map((fonte) => [fonte.referenciaId, fonte]));
  const itensPorChave = new Map(itens.map((item) => [item.chave, item]));
  const mapa = Array.isArray(mapeamentos) ? mapeamentos.flatMap((item) => {
    if (!ehObjeto(item)) return [];
    const referenciaFonteId = texto(item.referenciaFonteId), codigoAvaliacaoDestino = texto(item.codigoAvaliacaoDestino), habilidadeDestino = item.habilidadeDestino;
    if (!referenciaFonteId || !codigoAvaliacaoDestino || !ehHabilidade(habilidadeDestino)) return [];
    const fonte = fontesPorId.get(referenciaFonteId);
    const requisito = itensPorChave.get(chaveRequisito(codigoAvaliacaoDestino, habilidadeDestino));
    return [{ fonte: fonte ?? null, requisito: requisito ?? { ordem: null, habilidade: habilidadeDestino, peso: null, avaliacao: `${avaliacoesDestino.get(codigoAvaliacaoDestino) ?? "Avaliação"} (${codigoAvaliacaoDestino})` } }];
  }) : [];
  const estadoHash = texto(raiz.estadoHash);
  return { fontes, itens, mapa, estadoHash: estadoHash && /^[a-f0-9]{64}$/.test(estadoHash) ? estadoHash : null };
}

export default async function PropostaEquivalenciaPage({ params }: { params: Promise<{ propostaId: string }> }) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA);
  const { propostaId } = await params;
  const [resultado, preferencia] = await Promise.all([
    consultarPropostaEquivalencia({ propostaId }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const proposta = resultado.dado;
  const pedagogica = proposta.visao === "PEDAGOGICA" ? resumoPedagogico(proposta.snapshot, proposta.mapeamentos) : null;
  const decisao = proposta.decisao;
  const estado = proposta.estado === "PENDENTE" ? "Aguardando decisão" : proposta.estado === "APROVADA" ? "Autorizada para execução" : proposta.estado === "APLICADA" ? "Transferência efetivada" : "Rejeitada";
  const preferenciaFusoExibicao = (preferencia.ok ? preferencia.dado?.fusoExibicao : null) ?? null;
  const fusoExibicao = resolverFusoExibicao(preferenciaFusoExibicao, "America/Sao_Paulo");

  return <section className="space-y-5">
    <VoltarPara href="/academico" />
    <header className="space-y-2">
      <h1 className="text-2xl font-medium">Proposta de aproveitamento em transferência</h1>
      <p>{proposta.matricula.codigo ?? "Matrícula sem código"} · {textoTurma(proposta.turmaOrigem)} → {textoTurma(proposta.turmaDestino)}</p>
      <p>Versão {proposta.versao} · preparada em {formatarInstanteExibicao(proposta.criadaEm, preferenciaFusoExibicao, "America/Sao_Paulo").texto} (horário exibido em {fusoExibicao}).</p>
      <p className="whitespace-pre-wrap">Motivo informado: {proposta.motivo}</p>
      <p role="status">Estado atual: {estado}.</p>
    </header>

    {pedagogica && <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-medium">Fontes e mapeamento pedagógico</h2>
      <p>Use esta visão para conferir a avaliação, a habilidade, a nota e o peso envolvidos. Identificadores técnicos não são exibidos.</p>
      <h3 className="font-medium">Fontes oficializadas</h3>
      {pedagogica.fontes.length ? <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Fontes oficializadas da proposta</caption><thead><tr><th>Tipo</th><th>Avaliação ou recuperação</th><th>Habilidade</th><th>Nota</th></tr></thead><tbody>{pedagogica.fontes.map((fonte) => <tr key={fonte.referenciaId}><td>{nomeTipoFonte(fonte.tipo)}</td><td>{fonte.avaliacao}</td><td>{nomesHabilidade[fonte.habilidade]}</td><td>{nota(fonte.nota)}</td></tr>)}</tbody></table></div> : <p>Nenhuma fonte oficial foi preservada nesta proposta.</p>}
      <h3 className="font-medium">Mapa escolhido</h3>
      {pedagogica.mapa.length ? <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Mapa entre requisitos de destino e fontes oficializadas</caption><thead><tr><th>Avaliação de destino</th><th>Habilidade</th><th>Peso</th><th>Fonte indicada</th></tr></thead><tbody>{pedagogica.mapa.map((item, indice) => <tr key={`${item.requisito.avaliacao}-${item.fonte?.referenciaId ?? "preservada"}-${indice}`}><td>{item.requisito.avaliacao}</td><td>{nomesHabilidade[item.requisito.habilidade]}</td><td>{item.requisito.peso ? nota(item.requisito.peso) : "Conferir regra preservada"}</td><td>{item.fonte ? `${nomeTipoFonte(item.fonte.tipo)}: ${item.fonte.avaliacao} · ${nomesHabilidade[item.fonte.habilidade]} · nota ${nota(item.fonte.nota)}` : "Fonte preservada a conferir"}</td></tr>)}</tbody></table></div> : <p>Nenhuma fonte foi indicada; os requisitos permanecem pendentes para acompanhamento.</p>}
      {pedagogica.itens.length > pedagogica.mapa.length && <p role="status">Há requisito(s) de destino sem fonte indicada nesta proposta.</p>}
    </section>}

    <section className="space-y-2 rounded border p-4">
      <h2 className="text-xl font-medium">Decisão e execução</h2>
      {decisao ? <><p>{decisao.aprovada ? "Decisão autorizada" : "Decisão de rejeição"} em {formatarInstanteExibicao(decisao.decididaEm, preferenciaFusoExibicao, "America/Sao_Paulo").texto} (horário exibido em {fusoExibicao}).</p><p className="whitespace-pre-wrap">Motivo: {decisao.motivo}</p>{decisao.aplicacao && <p>Aplicada em {formatarInstanteExibicao(decisao.aplicacao.aplicadaEm, preferenciaFusoExibicao, "America/Sao_Paulo").texto} (horário exibido em {fusoExibicao}).</p>}</> : <p>Aguardando uma decisão independente da gestão.</p>}
      {proposta.visao === "EXECUCAO" && <p>A Secretaria recebe apenas os dados necessários para efetivar a autorização, sem as fontes e o mapa pedagógico.</p>}
    </section>

    <AcoesEquivalencia propostaId={proposta.id} estadoHash={pedagogica?.estadoHash ?? null} podeDecidir={proposta.podeDecidir} decisaoId={decisao?.id ?? null} podeExecutar={proposta.podeExecutar} />
    {!proposta.podeDecidir && proposta.estado === "PENDENTE" && proposta.visao === "PEDAGOGICA" && <p role="status">A proposta aguarda outra pessoa autorizada da gestão para decidir.</p>}
    {!proposta.podeExecutar && proposta.estado === "APROVADA" && <p role="status">A proposta foi autorizada. A execução será feita pela Secretaria ou Administração, após nova conferência do serviço.</p>}
  </section>;
}
