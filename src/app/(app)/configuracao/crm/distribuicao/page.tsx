import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { setoresDoUsuario } from "@/server/crm/setores-papel";
import { setoresEditaveis } from "@/server/crm-config/distribuicao";
import { SETOR_ATENDIMENTO_LABEL } from "@/lib/labels";
import { SetorPainel } from "./SetorPainel";

export default async function Pagina() {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  const setores = setoresEditaveis(usuario.papeis);
  const [prazos, usuarios] = await Promise.all([
    prisma.prazoRespostaSetor.findMany(),
    prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, papeis: true }, orderBy: { nome: "asc" } }),
  ]);
  return (
    <section aria-labelledby="titulo-secao">
      <h2 id="titulo-secao" className="text-lg font-semibold">Distribuição e SLA</h2>
      <p className="mt-1 text-sm text-gray-600">Como os atendimentos novos são atribuídos e em quanto tempo a primeira resposta é esperada. Carteira do lead vem antes da regra do setor.</p>
      <div className="mt-4 grid gap-4">
        {setores.map((s) => {
          const c = prazos.find((x) => x.finalidade === s);
          // Mostra o prazo gravado como está (ex.: Pedagógico 24 h); só sem linha cai no padrão 60.
          const prazo = c?.minutos ?? 60;
          return <SetorPainel key={s} finalidade={s} rotulo={SETOR_ATENDIMENTO_LABEL[s]} regra={c?.regraDistribuicao ?? "MANUAL"}
            participantesIds={c?.participantesIds ?? []} prazo={prazo}
            alertarResponsavel={c?.alertarResponsavel ?? true} alertarGerente={c?.alertarGerente ?? false} contarSoNoHorario={c?.contarSoNoHorario ?? true}
            candidatos={usuarios.filter((u) => setoresDoUsuario(u.papeis).includes(s)).map((u) => ({ id: u.id, nome: u.nome }))} />;
        })}
      </div>
    </section>
  );
}
