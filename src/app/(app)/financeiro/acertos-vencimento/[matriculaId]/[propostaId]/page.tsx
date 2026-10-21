import Link from "next/link";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarVencimentosAditivo } from "@/server/contratos/vencimento-aditivo";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarDiaCivilGravado, formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { VencimentoFormulario } from "./Formulario";
import { formatarDataCivil } from "@/lib/data-civil";
import { VoltarPara } from "@/components/VoltarPara";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ESTADO_PROPOSTA_DECIDIDA_LABEL, rotular } from "@/lib/labels";
import { consultarCabecalhoMatricula } from "@/server/matricula/cabecalho";
import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro";

export default async function Pagina({ params, searchParams }: {
 params: Promise<{ matriculaId: string; propostaId: string }>;
 searchParams: Promise<{ pagina?: string }>;
}) {
 const usuario = await exigirSessaoPagina(Papel.FINANCEIRO);
 const { matriculaId, propostaId } = await params;
 const [versao, preferencia, cabecalho, fusoEscola] = await Promise.all([
   prisma.versaoCondicoesAditivo.findFirst({ where: { matriculaId, propostaId }, select: { id: true } }),
   consultarPreferenciaFusoEquipe(),
   consultarCabecalhoMatricula(usuario, matriculaId),
   fusoDaEscola(),
 ]);
 if (!versao) return <p role="status">Formalize as condições do aditivo antes de preparar o acerto.</p>;
 const pagina = Number((await searchParams).pagina ?? 1);
 const r = await consultarVencimentosAditivo({ matriculaId, versaoCondicoesId: versao.id, pagina });
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 const d = r.dado;
 // Lote 3 do fuso pessoal: registro, aplicação e vigência são instantes — fuso pessoal; sem preferência, o da escola
 // (antes, UTC), com o fuso escrito. Vencimentos são datas civis gravadas: o dia no fuso em que o acerto foi preparado.
 const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, fusoEscola);
 const data = (valor: string, fuso: string) => formatarDiaCivilGravado(valor, fuso);
 const instanteAdministrativo = (valor: string) => { const exibicao = formatarInstanteExibicao(valor, fusoExibicao, fusoEscola); return `${exibicao.texto} (horário exibido em ${exibicao.fuso})`; };
 const vigencia = formatarInstanteExibicao(d.vigenciaInicio, fusoExibicao, fusoEscola);
 return <main className="space-y-5"><VoltarPara href="/financeiro" />
 <h1 className="text-2xl">Acerto do vencimento da primeira mensalidade</h1>
 {/* De quem é o acerto: aluno e matrícula pelo código, não o id da URL (docs/43 §6 item 7). */}
 {cabecalho && <IdentificacaoRegistro rotulo="Aluno e matrícula deste acerto" dados={{ aluno: cabecalho.aluno, alunoHref: `/alunos/${encodeURIComponent(cabecalho.alunoId)}`, matriculaCodigo: cabecalho.codigo, matriculaComplemento: cabecalho.produto }} />}
 <p>Versão contratual {d.versao}</p>
 <p>Vigência aprovada: {vigencia.texto} (horário exibido em {vigencia.fuso}; referência contratual preservada). A aplicação fica disponível a partir desse momento.</p>
 <p>Novo vencimento contratado: {formatarDataCivil(d.alvo.vencimentoProposto)}. {d.alvo.pendencia}</p>
 {d.alvo.podePreparar && <VencimentoFormulario modo="preparar" matriculaId={matriculaId} versaoCondicoesId={versao.id} revisaoHash={d.revisaoHash} />}
 <h2 className="text-xl">Histórico e decisões</h2>
 {!d.propostas.length && <EstadoVazio bloco>Nenhuma proposta de acerto registrada.</EstadoVazio>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
 <h3>Proposta de {instanteAdministrativo(p.criadaEm)} · {rotular(ESTADO_PROPOSTA_DECIDIDA_LABEL, p.estado)}</h3><p>{data(p.vencimentoAnterior,p.fuso)} → {data(p.vencimentoNovo,p.fuso)} ({p.fuso})</p>
 <p>Motivo: {p.motivo}</p><p>Evidência: {p.evidencia}</p>
 {p.decisao && <p>Decisão: {p.decisao.motivo}</p>}
 {p.podeDecidir && <VencimentoFormulario modo="decidir" propostaId={p.id} />}
 {p.podeSolicitarAplicacao && <VencimentoFormulario modo="aplicar" propostaId={p.id} />}
 {p.reconciliacaoAcesso && <p role="status">Atualização de acesso: {p.reconciliacaoAcesso.concluida ? "concluída" : "pendente de processamento"}. Tentativas: {p.reconciliacaoAcesso.tentativas}. {p.reconciliacaoAcesso.erro}</p>}
 {p.aplicadaEm && <p>Aplicado em {instanteAdministrativo(p.aplicadaEm)}.</p>}
 </section>)}
 <nav className="flex gap-4">{d.pagina>1 && <Link href={`?pagina=${d.pagina-1}`}>Anterior</Link>}{d.temProxima && <Link href={`?pagina=${d.pagina+1}`}>Próxima</Link>}</nav>
 </main>;
}
