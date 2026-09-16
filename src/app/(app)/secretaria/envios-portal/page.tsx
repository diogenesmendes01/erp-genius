import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarFilaEnviosPortalAluno } from "@/server/portal-aluno/fila-envios";
import { ConciliacaoEnvio } from "./ConciliacaoEnvio";

const rotulo: Record<string, string> = { PREPARADO: "Preparado", ENVIADO: "Aceito pelo provedor", INCERTO: "Resultado incerto", CANCELADO: "Cancelado", FALHOU: "Falhou" };

export default async function EnviosPortalPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { cursor } = await searchParams;
  const resultado = await consultarFilaEnviosPortalAluno({ cursor });
  if (!resultado.ok || !resultado.dado) return <section><h1 className="text-2xl font-medium">Envios de acesso ao portal</h1><p role="alert">Não foi possível consultar a fila.</p></section>;
  const { itens, proximoCursor } = resultado.dado;
  return <section className="space-y-4"><header><Link href="/secretaria" className="text-sm underline">Voltar a Matrículas</Link><h1 className="text-2xl font-medium">Envios de acesso ao portal</h1><p className="text-sm text-gray-600">Aceito pelo provedor não confirma entrega. Resultado incerto exige conciliação; esta tela não reenvia automaticamente.</p></header><ul className="space-y-2">{itens.map(i => <li key={i.id} className="rounded border p-3"><strong>{i.alunoNome}</strong><p>{i.finalidade.replaceAll("_", " ")} · {rotulo[i.situacao] ?? i.situacao}</p><p className="text-xs text-gray-500">Atualizado: {i.atualizadoEm.toLocaleString("pt-BR")}</p>{(i.situacao === "INCERTO" || i.conciliacao) && <ConciliacaoEnvio item={i}/>}</li>)}</ul>{!itens.length && <p role="status">Nenhuma solicitação nesta página.</p>}{cursor && <Link className="underline" href="/secretaria/envios-portal">Voltar ao início</Link>}{proximoCursor && <Link className="underline" href={`/secretaria/envios-portal?cursor=${encodeURIComponent(proximoCursor)}`}>Próxima página</Link>}</section>;
}
