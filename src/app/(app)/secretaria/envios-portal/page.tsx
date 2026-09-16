import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFilaEnviosPortalAluno } from "@/server/portal-aluno/fila-envios";
import { decidirReemissaoEnvioIncerto, registrarEvidenciaEnvioIncerto } from "@/server/portal-aluno/conciliacao-envio";

const rotulo: Record<string, string> = { PREPARADO: "Preparado", ENVIADO: "Aceito pelo provedor", INCERTO: "Resultado incerto", CANCELADO: "Cancelado", FALHOU: "Falhou" };

async function registrar(form: FormData) {
  "use server";
  await registrarEvidenciaEnvioIncerto({ solicitacaoId: String(form.get("solicitacaoId") ?? ""), evidencia: String(form.get("evidencia") ?? "") });
}
async function decidir(form: FormData) {
  "use server";
  await decidirReemissaoEnvioIncerto({ conciliacaoId: String(form.get("conciliacaoId") ?? ""), estadoHash: String(form.get("estadoHash") ?? ""), aprovar: form.get("aprovar") === "true", motivo: String(form.get("motivo") ?? "") });
}

export default async function EnviosPortalPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { cursor } = await searchParams;
  const resultado = await consultarFilaEnviosPortalAluno({ cursor });
  if (!resultado.ok || !resultado.dado) return <section><h1 className="text-2xl font-medium">Envios de acesso ao portal</h1><p role="alert">Não foi possível consultar a fila.</p></section>;
  const { itens, proximoCursor } = resultado.dado;
  return <section className="space-y-4"><header><Link href="/secretaria" className="text-sm underline">Voltar a Matrículas</Link><h1 className="text-2xl font-medium">Envios de acesso ao portal</h1><p className="text-sm text-gray-600">Aceito pelo provedor não confirma entrega. Resultado incerto exige conciliação; esta tela não reenvia automaticamente.</p></header><ul className="space-y-2">{itens.map(i => <li key={i.id} className="rounded border p-3"><strong>{i.alunoNome}</strong><p>{i.finalidade.replaceAll("_", " ")} · {rotulo[i.situacao] ?? i.situacao}</p><p className="text-xs text-gray-500">Atualizado: {i.atualizadoEm.toLocaleString("pt-BR")}</p>{i.situacao === "INCERTO" && <form action={registrar} className="mt-2 space-y-1"><input type="hidden" name="solicitacaoId" value={i.id}/><label className="block text-sm">Evidência da conferência{ i.conciliacao ? " atualizada" : "" }<textarea required minLength={5} maxLength={4000} name="evidencia" className="block w-full border" /></label><button className="underline">Registrar evidência</button></form>}{i.conciliacao && <div className="mt-2 text-sm"><p>Conferência {i.conciliacao.versao}: evidência registrada.</p>{!i.conciliacao.decisao && <form action={decidir} className="space-y-1"><input type="hidden" name="conciliacaoId" value={i.conciliacao.id}/><input type="hidden" name="estadoHash" value={i.conciliacao.estadoHash}/><label className="block">Motivo da decisão<textarea required minLength={5} maxLength={4000} name="motivo" className="block w-full border" /></label><button name="aprovar" value="true" className="underline">Autorizar nova emissão</button><button name="aprovar" value="false" className="ml-3 underline">Não autorizar</button></form>}{i.conciliacao.decisao?.aprovada && <p>Nova emissão autorizada{ i.conciliacao.decisao.solicitacaoReemitidaId ? ". A nova solicitação está preparada." : "."}</p>}{i.conciliacao.decisao && !i.conciliacao.decisao.aprovada && <p>Nova emissão não autorizada.</p>}</div>}</li>)}</ul>{!itens.length && <p role="status">Nenhuma solicitação nesta página.</p>}{cursor && <Link className="underline" href="/secretaria/envios-portal">Voltar ao início</Link>}{proximoCursor && <Link className="underline" href={`/secretaria/envios-portal?cursor=${encodeURIComponent(proximoCursor)}`}>Próxima página</Link>}</section>;
}
