import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarOrigemContratualHistorica } from "@/server/contratos/origem-historica";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { ROTULOS_ORIGEM, type OrigemCampo } from "@/server/contratos/campos";
import { DecidirOrigemHistorica, RegistrarOrigemHistorica } from "./Formularios";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
 await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA);
 const { id } = await params;
 const [r, preferencia] = await Promise.all([consultarOrigemContratualHistorica({ matriculaId: id }), consultarPreferenciaFusoEquipe()]);
 if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível" : r.erro}</p>;
 const d = r.dado;
 const fusoExibicao = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");
 const instante = (valor: string) => { const e = formatarInstanteExibicao(valor, fusoExibicao, "UTC"); return `${e.texto} (${e.fuso}; origem UTC)`; };
 return <main className="space-y-5"><Link href={`/matriculas/${encodeURIComponent(id)}/contrato/aditivos`} className="underline">Voltar aos aditivos</Link>
 <h1 className="text-2xl">Origem contratual histórica · {d.matricula.aluno}</h1>
 <section className="space-y-2 rounded border p-4"><h2 className="text-xl">Como funciona</h2>
  <p>Contrato legado assinado fora do sistema: quem prepara envia o PDF assinado e transcreve as condições; outro administrador abre o PDF, relê a transcrição e registra a conferência declarando os hashes conferidos. Aprovada, a origem passa a ser a fonte contratual dos aditivos desta matrícula.</p>
  <p>Aditivos sobre a origem histórica não alteram taxa de matrícula, vencimento da primeira mensalidade nem adiantamento: são fatos de entrada já vividos. Uma matrícula nunca tem contrato assinado no sistema e origem histórica ao mesmo tempo.</p>
 </section>
 {d.podeRegistrar ? <RegistrarOrigemHistorica matriculaId={id} moeda={d.matricula.moeda} regime={d.matricula.regime} /> : <p role="status">{d.impedimento}</p>}
 <h2 className="text-xl">Registros</h2>
 {!d.propostas.length && <p>Nenhuma origem histórica registrada.</p>}
 {d.propostas.map(p => <section key={p.id} className="space-y-2 rounded border p-4">
  <h3>Origem {p.id} · {p.estado}</h3>
  <p>Referência {p.referencia} · assinado em {p.assinadoEm.slice(0, 10)} · registrada por {p.preparadaPor} em {instante(p.criadaEm)}</p>
  <p>Motivo: {p.motivo}</p>
  <a className="block underline" href={`/api/matriculas/${encodeURIComponent(id)}/origem-historica/${encodeURIComponent(p.id)}/pdf`} target="_blank" rel="noopener noreferrer">Abrir PDF assinado preservado</a>
  <p className="font-mono text-sm break-all">SHA-256 do PDF: {p.pdfHash}</p>
  <p className="font-mono text-sm break-all">Hash da transcrição: {p.transcricaoHash}</p>
  <h4>Condições transcritas</h4>
  <ul className="list-disc pl-5">{p.campos.map(c => <li key={c.origem}>{ROTULOS_ORIGEM[c.origem as OrigemCampo] ?? c.origem}: {c.valor}</li>)}</ul>
  {p.decisao && <p>{p.decisao.aprovada ? "Aprovada" : "Rejeitada"} por {p.decisao.decisor} em {instante(p.decisao.decididaEm)}: {p.decisao.motivo}</p>}
  {p.podeDecidir && <DecidirOrigemHistorica propostaId={p.id} />}
 </section>)}
 </main>;
}
