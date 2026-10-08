import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarDesignacoesAvaliacao } from "@/server/avaliacoes/designacao";
import { IdentificacaoAvaliacao } from "../../../Identificacao";
import { FormularioDesignacao } from "./Formulario";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";

export default async function DesignacaoPage({ params, searchParams }: {
  params: Promise<{ alocacaoId: string; codigo: string }>; searchParams: Promise<{ pagina?: string; busca?: string }>;
}) {
  await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const { alocacaoId, codigo } = await params, s = await searchParams, p = Number(s.pagina ?? 1);
  const [r, preferencia] = await Promise.all([
    consultarDesignacoesAvaliacao({ alocacaoId, codigoAvaliacao: codigo, busca: s.busca ?? "", pagina: Number.isInteger(p) && p > 0 && p <= 100000 ? p : 1 }),
    consultarPreferenciaFusoEquipe(),
  ]);
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
  return <section className="space-y-4">
    <VoltarPara href={`/academico/avaliacoes/${encodeURIComponent(alocacaoId)}/${encodeURIComponent(codigo)}`} para="Avaliação" />
    <h1 className="text-2xl font-medium">Avaliador designado — {d.titulo}</h1>
    <IdentificacaoAvaliacao dados={d.identificacao} />
    <p>{d.atual?.professor ? `Último professor designado: ${d.atual.professor.nome}${d.atual.professor.ativo ? "" : " (usuário inativo)"}.` : "Sem designação vigente."}</p>
    <p>A designação se limita a esta avaliação e mantém o professor titular da turma e a autoria dos registros anteriores.</p>
    {d.podeAlterar ? <>
      {/* A busca de professor mora no formulário (docs/43 §6 item 3, docs/42 L1327): sem formulário GET de página e sem
          key de versão ou busca, buscar ou receber a versão nova não remonta o formulário nem apaga o motivo. */}
      <FormularioDesignacao alocacaoId={alocacaoId} codigoAvaliacao={codigo} versaoEsperada={d.versaoEsperada} atualId={d.atual?.professor?.id ?? null} professores={d.professores} busca={d.busca} refinarBusca={d.refinarBusca} />
    </> : <p role="status">Avaliação oficializada: a designação da pendência foi encerrada. O histórico permanece disponível.</p>}
    <h2 className="text-xl font-medium">Histórico de designações</h2>
    {!d.historico.length && <EstadoVazio bloco>Nenhuma designação registrada.</EstadoVazio>}
    {d.historico.map(h => <article key={h.id} className="space-y-2 rounded border p-3"><h3 className="font-medium">Versão {h.versao} — {h.professor?.nome ?? "Designação revogada"}</h3><p>Registrada por {h.gestor.nome} em {formatarInstanteExibicao(h.criadaEm, fusoExibicao, "UTC").texto} ({fusoExibicao}; origem UTC).</p><p className="whitespace-pre-wrap">{h.motivo}</p></article>)}
    <nav aria-label="Páginas de designações" className="flex gap-4">{d.pagina > 1 && <Link href={`?busca=${encodeURIComponent(d.busca)}&pagina=${d.pagina - 1}`}>Anterior</Link>}<span>Página {d.pagina}</span>{d.temProxima && <Link href={`?busca=${encodeURIComponent(d.busca)}&pagina=${d.pagina + 1}`}>Próxima</Link>}</nav>
  </section>;
}
