import { Papel } from "@prisma/client";
import Link from "next/link";
import { exigirSessaoPagina } from "@/server/_shared";
import { prisma } from "@/lib/prisma";
import { Aviso } from "@/components/Aviso";
import { AvisoFusoNaoConfigurado } from "@/components/AvisoFusoNaoConfigurado";
import { botaoClasses } from "@/components/Botao";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { listarItensAgenda } from "@/server/crm/mensagens-agendadas";
import { listarNotificacoes } from "@/server/crm/notificacoes";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { fusoExibicaoDoUsuario, listarItensLista, listarResponsaveisPossiveis, obterTarefa } from "@/server/crm/tarefas-consulta";
import { AgendaTarefas } from "./AgendaTarefas";
import { CalendarioTarefas } from "./CalendarioTarefas";
import { ListaTarefas } from "./ListaTarefas";
import { PainelTarefa } from "./PainelTarefa";
import { SinoNotificacoes } from "./SinoNotificacoes";
import { VISOES, dataValida, hrefTarefas, intervaloDaVisao, type Visao } from "./visao";

type Params = Record<string, string | string[] | undefined>;
const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function TarefasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL, Papel.VENDEDOR, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  const params = await searchParams;
  const podeEquipe = capacidadesCrm(usuario.papeis).has("tarefas.equipe");
  const equipe = podeEquipe && primeiro(params.escopo) === "equipe";
  const pedida = primeiro(params.visao);
  const visao: Visao = VISOES.some((v) => v.id === pedida) ? (pedida as Visao) : "lista";
  const idAberto = primeiro(params.t).trim();

  const agora = new Date();
  const [config, fusoPreferido] = await Promise.all([
    prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    fusoExibicaoDoUsuario(usuario),
  ]);
  const fusoEscola = config?.fusoInstitucional ?? "UTC";
  const fusoExibicao = resolverFusoExibicao(fusoPreferido, fusoEscola);
  const hoje = dataCivilInstitucional(agora, fusoEscola);
  const dataPedida = primeiro(params.data);
  const data = dataValida(dataPedida) ? dataPedida : hoje;
  const intervalo = intervaloDaVisao(visao, data, hoje);

  const novo = idAberto === "nova";
  const [itens, notificacoes, tarefaAberta, responsaveis] = await Promise.all([
    visao === "lista" ? listarItensLista(usuario, intervalo, equipe) : listarItensAgenda(usuario, intervalo, equipe),
    listarNotificacoes(usuario),
    idAberto && !novo ? obterTarefa(usuario, idAberto) : Promise.resolve(null),
    idAberto ? listarResponsaveisPossiveis(usuario) : Promise.resolve([]),
  ]);

  const url = { visao, data: visao === "lista" ? undefined : data, escopo: equipe ? "equipe" : undefined };
  return (
    <>
      {!config?.fusoInstitucional && <AvisoFusoNaoConfigurado className="mb-3" />}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Visão" className="flex flex-wrap gap-2">
            {VISOES.map((v) => (
              <Link key={v.id} href={hrefTarefas({ ...url, visao: v.id, data: v.id === "lista" ? undefined : data })} aria-current={v.id === visao ? "page" : undefined}
                className={`inline-flex min-h-8 items-center rounded-full border border-border-soft px-3 text-sm max-sm:min-h-11 ${v.id === visao ? "border-transparent bg-brand-bg text-brand-800" : "text-gray-600 hover:bg-highlight"}`}>{v.rotulo}</Link>
            ))}
          </nav>
          {podeEquipe && (
            <nav aria-label="Escopo" className="flex gap-2">
              <Link href={hrefTarefas({ ...url, escopo: undefined })} aria-current={!equipe ? "page" : undefined} className={`inline-flex min-h-8 items-center rounded-full border border-border-soft px-3 text-sm max-sm:min-h-11 ${!equipe ? "border-transparent bg-brand-bg text-brand-800" : "text-gray-600 hover:bg-highlight"}`}>Minhas</Link>
              <Link href={hrefTarefas({ ...url, escopo: "equipe" })} aria-current={equipe ? "page" : undefined} className={`inline-flex min-h-8 items-center rounded-full border border-border-soft px-3 text-sm max-sm:min-h-11 ${equipe ? "border-transparent bg-brand-bg text-brand-800" : "text-gray-600 hover:bg-highlight"}`}>Equipe</Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SinoNotificacoes notificacoes={notificacoes} fusoExibicao={fusoExibicao} fusoEscola={fusoEscola} />
          <Link href={hrefTarefas({ ...url, t: "nova" })} className={botaoClasses({ variante: "primario", tamanho: "lg" })}>Nova tarefa</Link>
        </div>
      </div>

      {visao === "lista" && <ListaTarefas itens={itens} agora={agora.toISOString()} fusoEscola={fusoEscola} fusoExibicao={fusoExibicao} params={url} />}
      {(visao === "dia" || visao === "semana") && <AgendaTarefas visao={visao} data={data} hoje={hoje} itens={itens} fusoEscola={fusoEscola} fusoExibicao={fusoExibicao} params={url} />}
      {visao === "mes" && <CalendarioTarefas data={data} hoje={hoje} itens={itens} fusoEscola={fusoEscola} params={url} />}

      {idAberto && !novo && !tarefaAberta && <Aviso tom="atencao" className="mt-3">Tarefa não encontrada ou fora do seu escopo.</Aviso>}
      {(novo || tarefaAberta) && (
        <PainelTarefa tarefa={tarefaAberta} responsaveis={responsaveis} fusoEscola={fusoEscola} fusoExibicao={fusoExibicao} dataInicial={hoje} params={url} />
      )}
    </>
  );
}
