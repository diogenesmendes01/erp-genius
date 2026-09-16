import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarTelaAutorizacoesComunicacaoAcademica } from "@/server/comunicacoes-agenda/autorizacoes";
import { AutorizacoesFormulario } from "./AutorizacoesFormulario";

export default async function AutorizacoesComunicacaoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
  const { id } = await params;
  try {
    const tela = await consultarTelaAutorizacoesComunicacaoAcademica({ matriculaId: id });
    return <section className="space-y-5"><Link href="/secretaria" className="underline">Voltar à Secretaria</Link>
      <header><h1 className="text-2xl font-medium">Destinatários acadêmicos · {tela.matricula.codigo ?? "Matrícula em preparação"}</h1><p>{tela.matricula.alunoNome}</p><p className="text-sm text-gray-600">Ser responsável ou pagador não autoriza avisos. Registre evidência explícita para cada matrícula.</p></header>
      <AutorizacoesFormulario matriculaId={id} responsaveis={tela.responsaveis} historico={tela.historico.itens.map((item) => ({ ...item, vigenteEm: item.vigenteEm.toISOString(), revogadaEm: item.revogadaEm?.toISOString() ?? null }))} />
    </section>;
  } catch { return <p role="alert">Não foi possível consultar as autorizações desta matrícula.</p>; }
}