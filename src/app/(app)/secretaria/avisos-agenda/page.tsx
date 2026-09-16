import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarAvisosAlteracaoAgenda } from "@/server/comunicacoes-agenda/consultas";

const rotulo: Record<string, string> = { PREPARADO: "Preparado", ENVIADO: "Aceito pelo provedor", INCERTO: "Resultado incerto", FALHOU: "Falhou" };

export default async function AvisosAgendaPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { cursor } = await searchParams;
  const resultado = await consultarAvisosAlteracaoAgenda({ cursor });
  if (!resultado.ok || !resultado.dado) return <section><h1 className="text-2xl font-medium">Avisos de alterações na agenda</h1><p role="alert">Não foi possível consultar a fila.</p></section>;
  return <section className="space-y-4"><header><Link href="/secretaria" className="text-sm underline">Voltar a Secretaria</Link><h1 className="text-2xl font-medium">Avisos de alterações na agenda</h1><p className="text-sm text-gray-600">Aceito pelo provedor não confirma entrega. A fila não faz novo envio automático após resultado incerto.</p></header><ul className="space-y-2">{resultado.dado.itens.map(i => <li key={i.id} className="rounded border p-3"><strong>{i.alunoNome}</strong><p>{i.canal} · {rotulo[i.situacao] ?? i.situacao}</p><p className="text-xs text-gray-500">Atualizado: {i.atualizadoEm.toLocaleString("pt-BR")}</p></li>)}</ul>{!resultado.dado.itens.length && <p role="status">Nenhum aviso nesta página.</p>}{cursor && <Link className="underline" href="/secretaria/avisos-agenda">Voltar ao início</Link>}{resultado.dado.proximoCursor && <Link className="underline" href={`/secretaria/avisos-agenda?cursor=${encodeURIComponent(resultado.dado.proximoCursor)}`}>Próxima página</Link>}</section>;
}
