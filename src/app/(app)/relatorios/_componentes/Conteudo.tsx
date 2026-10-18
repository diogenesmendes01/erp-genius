import type { Carga } from "./carregar";
import { AbaVisao } from "./AbaVisao";
import { AbaFunil } from "./AbaFunil";
import { AbaEquipe } from "./AbaEquipe";
import { AbaAria } from "./AbaAria";
import { AbaConversas } from "./AbaConversas";
import { AbaAtividades } from "./AbaAtividades";
import type { ParamsRelatorio } from "./formato";

export function Conteudo({ carga, params, ehGestao }: { carga: Carga; params: ParamsRelatorio; ehGestao: boolean }) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const d = carga.dados as any;
  const a = carga.anterior as any;
  switch (carga.aba) {
    case "visao": return <AbaVisao pipeline={d.pipeline} atendimento={d.atendimento} params={params} />;
    case "funil": return <AbaFunil dados={d} anterior={a} params={params} />;
    case "equipe": return <AbaEquipe linhas={d} anterior={a} params={params} />;
    case "aria": return <AbaAria dados={d} anterior={a} />;
    case "conversas": return <AbaConversas dados={d} anterior={a} mostrarAria={ehGestao} />;
    case "atividades": return <AbaAtividades dados={d} anterior={a} mostrarAria={ehGestao} />;
  }
}
