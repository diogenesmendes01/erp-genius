"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PrioridadeTarefa, TipoTarefa } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Drawer } from "@/components/Drawer";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { PRIORIDADE_TAREFA_LABEL, STATUS_TAREFA_LABEL, TIPO_TAREFA_LABEL } from "@/lib/labels";
import type { Resultado } from "@/server/_shared/resultado";
import type { TarefaLista } from "@/server/crm/mensagens-agendadas";
import { assumirTarefa, cancelarTarefa, concluirTarefa, criarTarefa, editarTarefa, reabrirTarefa } from "@/server/crm/tarefas-acoes";
import { camposAlterados, type CamposFormulario } from "./edicao";
import { horaNoFuso, hrefTarefas, textoHora, type ParamsTarefas } from "./visao";

const CONTROLE = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm max-sm:min-h-11";
const DURACOES = [15, 30, 45, 60, 90] as const;
const LEMBRETES: { valor: string; rotulo: string }[] = [
  { valor: "", rotulo: "Sem lembrete" },
  { valor: "0", rotulo: "Na hora" },
  { valor: "10", rotulo: "10 minutos antes" },
  { valor: "30", rotulo: "30 minutos antes" },
  { valor: "60", rotulo: "1 hora antes" },
];

type Props = {
  /** Null = nova tarefa. */
  tarefa: TarefaLista | null;
  /** Vazio quando o usuário não gerencia equipe: a tarefa fica sempre com ele. */
  responsaveis: { id: string; nome: string }[];
  fusoEscola: string;
  fusoExibicao: string;
  dataInicial: string;
  params: ParamsTarefas;
};

/** Painel lateral da tarefa. Salva no botão "Salvar" (não a cada tecla) e envia a `versao` lida. */
export function PainelTarefa(props: Props) {
  // Outra tarefa (deep link ?t=) recomeça o formulário; salvar a mesma não apaga o que está na tela.
  return <FormularioTarefa key={props.tarefa?.id ?? "nova"} {...props} />;
}

function FormularioTarefa({ tarefa, responsaveis, fusoEscola, fusoExibicao, dataInicial, params }: Props) {
  const router = useRouter();
  // Nova tarefa: criarTarefa recebe chave de idempotência (#166), e o reenvio depois de um resultado incerto
  // devolve a tarefa já criada (sem segundo lembrete). Tarefa existente: as ações usam a `versao` e ficam
  // sem chave. `tarefa` não muda na vida do formulário (PainelTarefa troca o key).
  const acao = useAcaoCliente({ idempotente: !tarefa });
  const tentativa = useChaveIdempotencia();
  const aberta = !tarefa || tarefa.status === "ABERTA";
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoTarefa>(tarefa?.tipo ?? "LIGACAO");
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? "");
  const [dataCivil, setDataCivil] = useState(tarefa ? (tarefa.dataCivil ?? "") : dataInicial);
  const [hora, setHora] = useState(tarefa?.inicioEm ? horaNoFuso(tarefa.inicioEm, tarefa.fusoOrigem) : "");
  const [duracao, setDuracao] = useState<number>(tarefa?.duracaoMin ?? 30);
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>(tarefa?.prioridade ?? "NORMAL");
  const [lembrete, setLembrete] = useState(tarefa?.lembreteAntecedenciaMin == null ? "" : String(tarefa.lembreteAntecedenciaMin));
  const [responsavel, setResponsavel] = useState(tarefa ? (tarefa.responsavelId ?? "") : "__eu__");
  const [resultado, setResultado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);

  const fechar = () => router.replace(hrefTarefas({ ...params, t: undefined }));
  const horaNaEscola = tarefa?.inicioEm ? textoHora(tarefa.inicioEm, fusoExibicao, fusoEscola) : null;

  async function salvar() {
    const base: CamposFormulario = {
      titulo, tipo, descricao, duracaoMin: duracao as 15 | 30 | 45 | 60 | 90, prioridade,
      dataCivil: dataCivil || null, hora: hora || null,
      lembreteAntecedenciaMin: (lembrete === "" ? null : Number(lembrete)) as 0 | 10 | 30 | 60 | null,
    };
    const d = await acao.executar(async (): Promise<Resultado<unknown>> => {
      if (!tarefa) {
        return criarTarefa({
          ...base,
          ...(responsaveis.length && responsavel !== "__eu__" ? { responsavelId: responsavel || null } : {}),
          chaveIdempotencia: tentativa.atual,
        });
      }
      const mudouResponsavel = responsaveis.length > 0 && responsavel !== (tarefa.responsavelId ?? "");
      const lida: CamposFormulario = {
        titulo: tarefa.titulo, tipo: tarefa.tipo, descricao: tarefa.descricao ?? "",
        duracaoMin: tarefa.duracaoMin as CamposFormulario["duracaoMin"], prioridade: tarefa.prioridade,
        dataCivil: tarefa.dataCivil, hora: tarefa.inicioEm ? horaNoFuso(tarefa.inicioEm, tarefa.fusoOrigem) : null,
        lembreteAntecedenciaMin: tarefa.lembreteAntecedenciaMin as CamposFormulario["lembreteAntecedenciaMin"],
      };
      return editarTarefa(tarefa.id, tarefa.versao, { ...camposAlterados(lida, base), ...(mudouResponsavel ? { responsavelId: responsavel || null } : {}) });
    }, tarefa ? "Tarefa salva." : "Tarefa criada.");
    if (!tarefa) tentativa.depoisDo(d);
    if (d?.tipo === "ok") {
      router.refresh();
      if (!tarefa) fechar();
    }
  }

  async function simples(f: () => ReturnType<typeof assumirTarefa>, sucesso: string) {
    const d = await acao.executar(f, sucesso);
    if (d?.tipo === "ok") router.refresh();
  }

  return (
    <>
      <Drawer open onClose={fechar} title={tarefa ? tarefa.titulo : "Nova tarefa"} largura="w-full max-sm:max-w-none sm:max-w-xl md:w-[40%]">
        {tarefa && (
          <p className="mb-3 text-sm text-gray-600">
            {STATUS_TAREFA_LABEL[tarefa.status]}
            {tarefa.status === "CONCLUIDA" && tarefa.resultado ? ` · ${tarefa.resultado}` : ""}
            {tarefa.status === "CANCELADA" && tarefa.motivoCancelamento ? ` · ${tarefa.motivoCancelamento}` : ""}
          </p>
        )}
        <div className="space-y-3">
          <Campo rotulo="Título" obrigatorio>{(c) => <input {...c} type="text" maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={!aberta} className={CONTROLE} />}</Campo>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo="Tipo">{(c) => (
              <select {...c} value={tipo} onChange={(e) => setTipo(e.target.value as TipoTarefa)} disabled={!aberta} className={CONTROLE}>
                {Object.entries(TIPO_TAREFA_LABEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            )}</Campo>
            <Campo rotulo="Prioridade">{(c) => (
              <select {...c} value={prioridade} onChange={(e) => setPrioridade(e.target.value as PrioridadeTarefa)} disabled={!aberta} className={CONTROLE}>
                {Object.entries(PRIORIDADE_TAREFA_LABEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            )}</Campo>
            <Campo rotulo="Data">{(c) => <input {...c} type="date" value={dataCivil} onChange={(e) => setDataCivil(e.target.value)} disabled={!aberta} className={CONTROLE} />}</Campo>
            <Campo rotulo="Hora" dica="No horário da escola.">{(c) => <input {...c} type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={!aberta} className={CONTROLE} />}</Campo>
            <Campo rotulo="Duração">{(c) => (
              <select {...c} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} disabled={!aberta} className={CONTROLE}>
                {DURACOES.map((m) => <option key={m} value={m}>{m} minutos</option>)}
              </select>
            )}</Campo>
            <Campo rotulo="Lembrete" dica="Exige data e hora.">{(c) => (
              <select {...c} value={lembrete} onChange={(e) => setLembrete(e.target.value)} disabled={!aberta} className={CONTROLE}>
                {LEMBRETES.map((l) => <option key={l.valor} value={l.valor}>{l.rotulo}</option>)}
              </select>
            )}</Campo>
          </div>
          {horaNaEscola?.dica && <p className="text-xs text-gray-600">Para você: {horaNaEscola.hora}. {horaNaEscola.dica}.</p>}
          {responsaveis.length > 0 && (
            <Campo rotulo="Responsável">{(c) => (
              <select {...c} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} disabled={!aberta} className={CONTROLE}>
                {!tarefa && <option value="__eu__">Eu</option>}
                <option value="">Fila do setor</option>
                {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            )}</Campo>
          )}
          <Campo rotulo="Descrição">{(c) => <CampoTexto {...c} rows={3} maxLength={2000} value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={!aberta} className={CONTROLE} />}</Campo>
        </div>

        <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />

        <div className="mt-4 flex flex-wrap gap-2">
          {aberta && <Botao onClick={salvar} disabled={acao.ocupado} aria-busy={acao.ocupado || undefined}>{acao.ocupado ? "Salvando…" : "Salvar"}</Botao>}
          {tarefa && aberta && !tarefa.responsavelId && <Botao variante="secundario" disabled={acao.ocupado} onClick={() => simples(() => assumirTarefa(tarefa.id), "Tarefa assumida.")}>Assumir</Botao>}
          {tarefa?.status === "CONCLUIDA" && <Botao variante="secundario" disabled={acao.ocupado} onClick={() => simples(() => reabrirTarefa(tarefa.id, tarefa.versao), "Tarefa reaberta.")}>Reabrir</Botao>}
        </div>

        {tarefa && aberta && (
          <div className="mt-6 space-y-3 border-t border-gray-200 pt-4">
            <Campo rotulo="Resultado" dica="Opcional. Em tarefas de contato com oportunidade, entra no histórico.">{(c) => <CampoTexto {...c} rows={2} maxLength={2000} value={resultado} onChange={(e) => setResultado(e.target.value)} className={CONTROLE} />}</Campo>
            <Botao variante="secundario" disabled={acao.ocupado} onClick={() => simples(() => concluirTarefa(tarefa.id, tarefa.versao, resultado), "Tarefa concluída.")}>Concluir</Botao>
            <Campo rotulo="Motivo do cancelamento">{(c) => <input {...c} type="text" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={CONTROLE} />}</Campo>
            <Botao variante="perigo" disabled={acao.ocupado || !motivo.trim()} onClick={() => setCancelando(true)}>Cancelar tarefa</Botao>
          </div>
        )}
      </Drawer>
      {cancelando && tarefa && (
        <ConfirmarAcao
          titulo={`Cancelar a tarefa "${tarefa.titulo}"?`}
          confirmacao="cancelamento"
          idempotente={false}
          acao={() => cancelarTarefa(tarefa.id, tarefa.versao, motivo)}
          aoConcluir={() => { setCancelando(false); router.refresh(); }}
          aoCancelar={() => setCancelando(false)}
        >
          A tarefa sai da agenda e dos lembretes. Ela continua no histórico com o motivo informado.
        </ConfirmarAcao>
      )}
    </>
  );
}
