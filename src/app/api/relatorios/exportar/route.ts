import { randomUUID } from "node:crypto";
import { Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao, ErroAutenticacao, ErroPermissao, registrarEvento } from "@/server/_shared";
import { exigirCapacidade } from "@/server/_shared/capacidades";
import { ETAPA_LABEL, MOTIVO_PERDA_LABEL, rotular } from "@/lib/labels";
import { escopoRelatorio, filtroOportunidade, type EscopoRelatorio } from "@/server/relatorios/escopo";
import { periodoDoFiltro, type FiltroPeriodo } from "@/server/relatorios/periodo";
import { fusoDaEscola, metricasAtendimento } from "@/server/relatorios/atendimento";
import { metricasPipeline } from "@/server/relatorios/pipeline";
import { metricasFunil } from "@/server/relatorios/funil";
import { desempenhoEquipe } from "@/server/relatorios/equipe";
import { metricasAriaEquipe } from "@/server/relatorios/aria";
import { metricasAtividades } from "@/server/relatorios/atividades";
import { detalharMetrica, lerChaveDetalhe, type FiltrosDetalhe } from "@/server/relatorios/detalhe";
import { gerarCsv } from "@/server/relatorios/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ABAS = ["pipeline", "funil", "atendimento", "equipe", "aria", "atividades", "detalhe"] as const;
type Aba = (typeof ABAS)[number];
type Linhas = (string | number | null)[][];
type Tabela = { colunas: string[]; linhas: Linhas };

class ErroRequisicao extends Error {}

const pct = (v: number | null) => (v == null ? null : Math.round(v * 1000) / 10);
const moedas = (xs: { moeda: string; valor: number }[]) => xs.map((x) => `${x.moeda} ${x.valor}`).join(" | ");

function lerFiltros(p: URLSearchParams, fuso: string): FiltrosDetalhe {
  const tipo = (p.get("periodo") ?? "30D") as FiltroPeriodo["tipo"];
  if (!["HOJE", "7D", "30D", "PERSONALIZADO"].includes(tipo)) throw new ErroRequisicao("Período inválido.");
  let periodo;
  try {
    periodo = periodoDoFiltro({ tipo, de: p.get("de") ?? undefined, ate: p.get("ate") ?? undefined }, fuso);
  } catch (erro) {
    throw new ErroRequisicao(erro instanceof Error ? erro.message : "Período inválido.");
  }
  const temperatura = p.get("temperatura");
  if (temperatura && !(Object.values(Temperatura) as string[]).includes(temperatura)) throw new ErroRequisicao("Temperatura inválida.");
  const autor = p.get("autor");
  if (autor && autor !== "ARIA" && autor !== "EQUIPE") throw new ErroRequisicao("Autor inválido.");
  return {
    periodo,
    responsavelId: p.get("responsavel") || undefined,
    origem: p.get("origem") || undefined,
    temperatura: (temperatura || undefined) as Temperatura | undefined,
    autor: (autor || undefined) as "ARIA" | "EQUIPE" | undefined,
    busca: p.get("busca")?.trim().slice(0, 100) || undefined,
  };
}

/** Só o que foi filtrado, para a trilha: a busca é texto livre (pode ser nome/telefone), então vai só o tamanho. */
function filtrosRegistrados(p: URLSearchParams, f: FiltrosDetalhe, aba: Aba, chave: string | null) {
  const campos = {
    periodo: p.get("periodo") ?? "30D",
    de: p.get("de"),
    ate: p.get("ate"),
    responsavel: f.responsavelId,
    origem: f.origem,
    temperatura: f.temperatura,
    autor: f.autor,
    chave: aba === "detalhe" ? chave : null,
    busca: aba === "detalhe" && f.busca ? { aplicada: true, caracteres: f.busca.length } : null,
  };
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v));
}

async function tabela(aba: Aba, f: FiltrosDetalhe, e: EscopoRelatorio, chave: string | null): Promise<Tabela> {
  if (aba === "pipeline") {
    const m = await metricasPipeline(f, e);
    return {
      colunas: ["Indicador", "Valor"],
      linhas: [
        ["Valor em pipeline", moedas(m.valorPipeline)], ["Abertas sem valor", m.semValor], ["Abertas", m.abertas], ["Criadas no período", m.criadas],
        ["Ganhas", m.ganhas], ["Conversão (%)", pct(m.conversao)], ["Ticket médio", moedas(m.ticketMedio)], ["Ciclo médio (dias)", m.cicloMedioDias],
      ],
    };
  }
  if (aba === "funil") {
    const m = await metricasFunil(f, e);
    const linhas: Linhas = [
      ...m.etapas.map((x): (string | number | null)[] => ["Etapa", rotular(ETAPA_LABEL, x.etapa), x.chegaram, x.agora, pct(x.conversaoProxima), x.tempoMedioDias]),
      ...m.perdas.map((x): (string | number | null)[] => ["Perda", rotular(MOTIVO_PERDA_LABEL, x.motivo), x.quantidade, null, null, null]),
    ];
    return { colunas: ["Tipo", "Etapa ou motivo", "Chegaram ou perdidas", "Agora", "Conversão para a próxima (%)", "Tempo médio na etapa (dias)"], linhas };
  }
  if (aba === "atendimento") {
    const m = await metricasAtendimento(f, e);
    return {
      colunas: ["Indicador", "Valor"],
      linhas: [["Conversas", m.conversas], ["Primeira resposta média (min)", m.primeiraRespostaMediaMin], ["Prazo estourado", m.prazoEstourado], ["Fora do horário (%)", m.foraDoHorarioPct],
        ...m.volume.map((v): (string | number | null)[] => [`Volume ${v.dia} (Aria / equipe)`, `${v.aria} / ${v.equipe}`])],
    };
  }
  if (aba === "equipe") {
    const m = await desempenhoEquipe(f, e);
    return {
      colunas: ["Nome", "Oportunidades", "Ganhas", "Conversão (%)", "Valor ganho", "Primeira resposta média (min)", "Tarefas concluídas", "Comissão", "Meta (%)"],
      linhas: m.map((x) => [x.nome, x.oportunidades, x.ganhas, pct(x.conversao), moedas(x.valorGanho), x.primeiraRespostaMediaMin, x.tarefasConcluidas, moedas(x.comissao), x.meta.pct]),
    };
  }
  if (aba === "aria") {
    const m = await metricasAriaEquipe(f, e);
    const lado = (n: string, l: typeof m.aria): (string | number | null)[] => [n, l.atendimentos, pct(l.conversao), l.primeiraRespostaMediaMin, l.perdidosSemResposta];
    return {
      colunas: ["Lado", "Atendimentos", "Conversão (%)", "Primeira resposta média (min)", "Perdidos sem resposta"],
      linhas: [lado("Aria", m.aria), lado("Equipe", m.equipe), ["Taxa de handoff (%)", pct(m.taxaHandoff), null, null, null], ["Sugestões aprovadas (%)", pct(m.sugestoesAprovadas), null, null, null], ["Etapas avançadas pela Aria", m.etapasAvancadasAria, null, null, null]],
    };
  }
  if (aba === "atividades") {
    const m = await metricasAtividades(f, e);
    return {
      colunas: ["Dia", "Tarefas criadas", "Tarefas concluídas"],
      linhas: [...m.porDia.map((d): (string | number | null)[] => [d.dia, d.criadas, d.concluidas]), ["Total", m.tarefasCriadas, null], ["Concluídas (%)", pct(m.tarefasConcluidasPct), null], ["Mensagens agendadas", m.mensagensAgendadas, null]],
    };
  }
  const k = lerChaveDetalhe(chave);
  if (!k) throw new ErroRequisicao("Chave do detalhe inválida.");
  const d = await detalharMetrica(k, f, e);
  return {
    colunas: ["Nome", "Etapa", "Responsável", "Valor", "Moeda", "Dias desde a criação"],
    linhas: d.itens.map((i) => [i.nome, rotular(ETAPA_LABEL, i.etapa), i.responsavel, i.valor, i.moeda, i.diasDesdeCriacao]),
  };
}

const mesmoEscopo = (a: EscopoRelatorio, b: EscopoRelatorio) =>
  a.tipo === b.tipo && (a.tipo === "TUDO" || JSON.stringify([...a.ids].sort()) === JSON.stringify([...(b as { ids: string[] }).ids].sort()));

export async function GET(req: Request) {
  try {
    const usuario = await exigirSessao();
    await exigirCapacidade(usuario, "dados.exportar_leads");
    const p = new URL(req.url).searchParams;
    const aba = p.get("aba") as Aba;
    if (!ABAS.includes(aba)) throw new ErroRequisicao("Aba não encontrada.");
    const chave = p.get("chave");
    const escopo = await escopoRelatorio(usuario);
    const f = lerFiltros(p, await fusoDaEscola());
    const { colunas, linhas } = await tabela(aba, f, escopo, chave);
    const csv = gerarCsv(colunas, linhas);

    // Recheca depois de gerar: permissão revogada, usuário trocado ou escopo mudado no meio invalidam o arquivo.
    const atual = await exigirSessao();
    await exigirCapacidade(atual, "dados.exportar_leads");
    if (atual.id !== usuario.id) throw new ErroPermissao();
    const escopoAtual = await escopoRelatorio(atual);
    if (!mesmoEscopo(escopo, escopoAtual)) throw new ErroPermissao("O acesso aos registros mudou durante a exportação. Gere um novo arquivo.");
    if (aba === "detalhe") {
      const itens = (await detalharMetrica(lerChaveDetalhe(chave)!, f, escopoAtual)).itens.map((i) => i.id);
      const permitidos = await prisma.oportunidade.count({ where: { AND: [{ id: { in: itens } }, filtroOportunidade(escopoAtual)] } });
      if (permitidos !== itens.length) throw new ErroPermissao("O acesso aos registros mudou durante a exportação. Gere um novo arquivo.");
    }

    await prisma.$transaction(async (tx) =>
      registrarEvento(tx, {
        tipo: "DadosExportados", agregadoTipo: "Exportacao", agregadoId: randomUUID(), autorId: atual.id,
        payload: { conjunto: `relatorio:${aba}`, quantidade: linhas.length, colunas, filtros: filtrosRegistrados(p, f, aba, chave), finalidade: "exportacao_de_relatorio" },
      }),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-${aba}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (erro) {
    if (erro instanceof ErroAutenticacao) return Response.json({ erro: "Não autenticado." }, { status: 401 });
    if (erro instanceof ErroPermissao) return Response.json({ erro: erro.message }, { status: 403 });
    if (erro instanceof ErroRequisicao) return Response.json({ erro: erro.message }, { status: 400 });
    return Response.json({ erro: "Não foi possível gerar o arquivo." }, { status: 500 });
  }
}
