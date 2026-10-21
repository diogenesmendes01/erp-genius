"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EtapaLead, Temperatura } from "@prisma/client";
import { Drawer } from "@/components/Drawer";
import { Botao, botaoClasses } from "@/components/Botao";
import { Chip } from "@/components/Chip";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { formatarMoeda } from "@/lib/dinheiro";
import { ETAPA_LABEL, MOTIVO_PERDA_LABEL, TEMPERATURA_CLS, TEMPERATURA_LABEL } from "@/lib/labels";
import { atribuirDono, definirTemperatura, agendarExperimental, enviarProposta, registrarNotaInterna } from "@/server/comercial/acoes";
import { registrarLinkPagamento } from "@/server/matricula/acoes";
import { destinoDoArraste } from "@/server/crm/etapas";
import type { CapacidadeCrm } from "@/server/crm/permissoes";
import type { DetalheOportunidade, ItemHistorico } from "@/server/crm/historico";
import { ModalPerda } from "./ModalPerda";
import { DadosOportunidade, DatasOportunidade, DocumentosOportunidade, InteracaoOportunidade, ResumoOportunidade } from "./EdicaoOportunidade";
import { FUSO_PADRAO } from "./CartaoOportunidade";
import { formatarDiaDaEscola, formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

type Aba = "oportunidade" | "detalhes" | "atividade";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "oportunidade", rotulo: "Oportunidade" },
  { id: "detalhes", rotulo: "Detalhes" },
  { id: "atividade", rotulo: "Atividade" },
];

const CAMPO = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm max-sm:min-h-11";

type Props = {
  oportunidade: DetalheOportunidade;
  historico: ItemHistorico[];
  capacidades: CapacidadeCrm[];
  vendedores: { id: string; nome: string }[];
  /** Países operacionais, para editar os dados da oportunidade. */
  paises?: { id: string; nome: string }[];
  aoFechar: () => void;
  /** Fuso institucional: regras e datas civis (follow-up); o padrão é o do CartaoOportunidade. */
  fuso?: string;
  /** Fuso pessoal de exibição dos instantes; sem ele (ou inválido), o institucional. */
  preferenciaFusoExibicao?: string | null;
  abaInicial?: Aba;
};

/** Instante (criação, histórico, experimental): fuso pessoal de exibição; sem ele, o da escola. */
const dataHora = (d: Date | string, preferencia: string | null, fuso: string) => formatarInstanteExibicao(d, preferencia, fuso).texto;
/**
 * O follow-up é data civil gravada no fuso da escola: sai como dia, sem hora e sem fuso pessoal (como no cartão).
 * Fuso inválido não derruba o painel: cai no dia UTC, como os instantes caem no fallback do helper.
 */
const diaCivil = (d: Date | string, fuso: string) => formatarDiaDaEscola(d, fuso);

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-200 py-2 text-sm">
      <dt className="text-gray-600">{rotulo}</dt>
      <dd className="text-right text-gray-900">{children}</dd>
    </div>
  );
}

export function PainelOportunidade({ oportunidade: op, historico, capacidades, vendedores, paises = [], aoFechar, fuso = FUSO_PADRAO, preferenciaFusoExibicao = null, abaInicial = "oportunidade" }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const acao = useAcaoCliente({ idempotente: false });
  // A nota interna recebe chave de idempotência (#166): o reenvio depois de um resultado incerto não grava uma
  // segunda nota. Por isso ela tem executor próprio; as outras ações do painel seguem sem chave.
  const acaoNota = useAcaoCliente({ idempotente: true });
  const tentativaNota = useChaveIdempotencia();
  const [perda, setPerda] = useState(false);
  const [dataExp, setDataExp] = useState("");
  const [novoDono, setNovoDono] = useState("");
  const [motivoDono, setMotivoDono] = useState("");
  const [confirmaDono, setConfirmaDono] = useState(false);
  const [link, setLink] = useState("");
  const [nota, setNota] = useState("");

  const pode = (c: CapacidadeCrm) => capacidades.includes(c);
  const podeMover = pode("funil.mover");
  const podeAtribuir = pode("funil.atribuir");
  const encerrada = op.etapa === EtapaLead.MATRICULADO || op.etapa === EtapaLead.PERDIDO;
  const podeAgendar = podeMover && destinoDoArraste(op.etapa, EtapaLead.EXPERIMENTAL_AGENDADA).tipo === "acao";
  const podeProposta = podeMover && destinoDoArraste(op.etapa, EtapaLead.PROPOSTA).tipo === "acao";
  const podePerder = podeMover && destinoDoArraste(op.etapa, EtapaLead.PERDIDO).tipo === "acao";
  const podeContratar = podeMover && (op.etapa === EtapaLead.PROPOSTA || op.etapa === EtapaLead.AGUARDANDO_MATRICULA);
  const taxa = op.taxaMatricula;
  const taxaAberta = !!taxa && (taxa.status === "PENDENTE" || taxa.status === "ATRASADO");

  async function rodar(f: () => ReturnType<typeof enviarProposta>, sucesso: string, depois?: () => void) {
    acaoNota.limpar();
    const d = await acao.executar(f, sucesso);
    if (d?.tipo === "ok") {
      router.refresh();
      depois?.();
    }
  }

  async function registrarNota() {
    acao.limpar();
    const d = await acaoNota.executar(() => registrarNotaInterna(op.id, { nota, chaveIdempotencia: tentativaNota.atual }), "Nota registrada.");
    tentativaNota.depoisDo(d);
    if (d?.tipo === "ok") {
      router.refresh();
      setNota("");
    }
  }

  return (
    <>
      <Drawer
        open
        onClose={aoFechar}
        title={op.nome}
        largura="w-full max-sm:max-w-none sm:max-w-2xl md:w-[45%]"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-brand-bg px-2 py-0.5 font-medium text-brand-800">{ETAPA_LABEL[op.etapa]}</span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${TEMPERATURA_CLS[op.temperatura]}`}>{TEMPERATURA_LABEL[op.temperatura]}</span>
          {op.codigo && <span className="text-gray-600">{op.codigo}</span>}
        </div>

        <div role="tablist" aria-label="Seções da oportunidade" className="mb-4 flex gap-1 border-b border-gray-200">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`aba-${a.id}`}
              aria-selected={aba === a.id}
              aria-controls={`painel-${a.id}`}
              onClick={() => setAba(a.id)}
              className={
                "min-h-10 border-b-2 px-3 text-sm max-sm:min-h-11 " +
                (aba === a.id ? "border-brand-600 font-medium text-brand-800" : "border-transparent text-gray-600 hover:bg-highlight")
              }
            >{a.rotulo}</button>
          ))}
        </div>

        <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mb-3" />

        {aba === "oportunidade" && (
          <div role="tabpanel" id="painel-oportunidade" aria-labelledby="aba-oportunidade" className="space-y-5">
            <dl>
              <Linha rotulo="Valor previsto">{op.valorPrevisto && op.moeda ? formatarMoeda(op.valorPrevisto, op.moeda) : "Não informado"}</Linha>
              <Linha rotulo="Próximo passo">{op.proximaAcao ?? "Sem próximo passo"}</Linha>
              {op.dataExperimental && <Linha rotulo="Experimental">{dataHora(op.dataExperimental, preferenciaFusoExibicao, fuso)}</Linha>}
              {op.etapa === EtapaLead.PERDIDO && op.motivoPerda && <Linha rotulo="Motivo da perda">{MOTIVO_PERDA_LABEL[op.motivoPerda]}</Linha>}
              <Linha rotulo="Responsável">
                {podeAtribuir ? (
                  <select
                    aria-label="Responsável"
                    className={CAMPO}
                    value={novoDono || op.dono?.id || ""}
                    disabled={acao.ocupado}
                    onChange={(e) => setNovoDono(e.target.value)}
                  >
                    {!op.dono && <option value="">Sem responsável</option>}
                    {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                ) : (op.dono?.nome ?? "Sem responsável")}
              </Linha>
            </dl>

            {podeAtribuir && novoDono && novoDono !== op.dono?.id && (
              <div className="grid gap-2">
                <label className="grid gap-1 text-sm text-gray-700">
                  <span>Motivo da troca de responsável</span>
                  <CampoTexto rows={2} maxLength={300} className={CAMPO} value={motivoDono} onChange={(e) => setMotivoDono(e.target.value)} />
                </label>
                <div>
                  <Botao variante="secundario" disabled={!motivoDono.trim() || acao.ocupado} onClick={() => setConfirmaDono(true)}>
                    Atribuir responsável
                  </Botao>
                </div>
              </div>
            )}

            {podeMover && !encerrada && (
              <div className="grid gap-1 text-sm text-gray-700">
                <span id="rotulo-temperatura">Temperatura</span>
                <div role="group" aria-labelledby="rotulo-temperatura" className="flex flex-wrap gap-2">
                  {Object.values(Temperatura).map((t) => (
                    <Chip
                      key={t}
                      selecionado={op.temperatura === t}
                      onClick={() => { if (op.temperatura !== t) void rodar(() => definirTemperatura(op.id, t), "Temperatura atualizada."); }}
                    >{TEMPERATURA_LABEL[t]}</Chip>
                  ))}
                </div>
              </div>
            )}

            {podeAgendar && (
              <div className="grid gap-2">
                <label className="grid gap-1 text-sm text-gray-700">
                  <span>Data e hora da experimental</span>
                  <input type="datetime-local" className={CAMPO} value={dataExp} disabled={acao.ocupado} onChange={(e) => setDataExp(e.target.value)} />
                </label>
                <div>
                  <Botao
                    variante="secundario"
                    disabled={!dataExp || acao.ocupado}
                    onClick={() => rodar(() => agendarExperimental(op.id, { dataISO: new Date(dataExp).toISOString() }), "Experimental agendada.")}
                  >Agendar experimental</Botao>
                </div>
              </div>
            )}

            {taxaAberta && podeMover && (
              <div className="grid gap-2 rounded-md border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-800">Taxa de matrícula pendente</p>
                {taxa!.linkPagamento && (
                  <p className="break-all text-xs text-gray-600">Link atual: {taxa!.linkPagamento}</p>
                )}
                <input aria-label="Link ou código de pagamento enviado" className={CAMPO} placeholder="Link ou código de pagamento enviado" value={link} disabled={acao.ocupado} onChange={(e) => setLink(e.target.value)} />
                <div>
                  <Botao
                    variante="secundario"
                    disabled={!link.trim() || acao.ocupado}
                    onClick={() => rodar(() => registrarLinkPagamento(taxa!.cobrancaId, link), "Link de pagamento registrado.", () => setLink(""))}
                  >Registrar link de pagamento</Botao>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {podeProposta && (
                <Botao disabled={acao.ocupado} onClick={() => rodar(() => enviarProposta(op.id), "Proposta enviada.")}>Enviar proposta</Botao>
              )}
              {podeContratar && (
                <Link href={`/oportunidades/${op.id}/contratacao`} className={botaoClasses({ variante: "primario" })}>Preparar contratação</Link>
              )}
              {podePerder && (
                <Botao variante="perigo" disabled={acao.ocupado} onClick={() => setPerda(true)}>Marcar como perdida</Botao>
              )}
            </div>
          </div>
        )}

        {aba === "detalhes" && (
          <div role="tabpanel" id="painel-detalhes" aria-labelledby="aba-detalhes" className="space-y-4">
            <dl>
              <Linha rotulo="Tipo">{op.b2b ? "Empresa (B2B)" : "Pessoa física"}</Linha>
              <Linha rotulo="País">{op.pais ?? "Não informado"}</Linha>
              <Linha rotulo="Criada em">{dataHora(op.criadoEm, preferenciaFusoExibicao, fuso)}</Linha>
              {op.proximoFollowUp && <Linha rotulo="Próximo follow-up">{diaCivil(op.proximoFollowUp, fuso)}</Linha>}
            </dl>
            {op.pessoaId && (
              <p className="text-sm">
                <Link className="text-brand-700 underline" href={`/contatos/${op.pessoaId}`}>Abrir contato</Link>
              </p>
            )}
            <DadosOportunidade oportunidade={op} podeEditar={podeMover} paises={paises} />
            <ResumoOportunidade oportunidade={op} podeEditar={podeMover} />
            <DatasOportunidade oportunidade={op} podeEditar={podeMover} fuso={fuso} />
            <DocumentosOportunidade oportunidade={op} podeEditar={podeMover} />
          </div>
        )}

        {aba === "atividade" && (
          <div role="tabpanel" id="painel-atividade" aria-labelledby="aba-atividade" className="space-y-4">
            {podeMover && <InteracaoOportunidade oportunidadeId={op.id} />}
            {podeMover && (
              <div className="grid gap-2">
                <label className="grid gap-1 text-sm text-gray-700">
                  <span>Nota interna (a equipe vê; o contato não)</span>
                  <CampoTexto rows={3} maxLength={2000} className={CAMPO} value={nota} disabled={acao.ocupado || acaoNota.ocupado} onChange={(e) => setNota(e.target.value)} />
                </label>
                <FeedbackAcao erro={acaoNota.erro} sucesso={acaoNota.sucesso} />
                <div>
                  <Botao
                    variante="secundario"
                    disabled={!nota.trim() || acao.ocupado || acaoNota.ocupado}
                    onClick={() => void registrarNota()}
                  >Registrar nota</Botao>
                </div>
              </div>
            )}
            {historico.length === 0 ? (
              <EstadoVazio>Nenhuma atividade registrada.</EstadoVazio>
            ) : (
              <ol className="grid gap-0">
                {[...historico].reverse().map((i) => (
                  <li key={i.id} className="border-b border-gray-200 py-2 text-sm">
                    <p className="text-gray-900">{i.rotulo}</p>
                    <p className="text-xs text-gray-600">{dataHora(i.em, preferenciaFusoExibicao, fuso)}{i.autor ? ` · ${i.autor}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Drawer>

      {perda && <ModalPerda oportunidadeId={op.id} nome={op.nome} aoFechar={() => setPerda(false)} />}

      {confirmaDono && (
        <ConfirmarAcao
          titulo={`Passar ${op.nome} para ${vendedores.find((v) => v.id === novoDono)?.nome ?? "outro responsável"}?`}
          confirmacao="troca de responsável"
          idempotente={false}
          acao={() => atribuirDono(op.id, novoDono, motivoDono.trim())}
          aoConcluir={() => {
            setConfirmaDono(false);
            setNovoDono("");
            setMotivoDono("");
            acao.setSucesso("Responsável atualizado.");
            router.refresh();
          }}
          aoCancelar={() => setConfirmaDono(false)}
        >
          <p>A carteira desta oportunidade passa para o novo responsável, junto com o atendimento comercial aberto.</p>
          <p>Mensagens pendentes do responsável anterior são canceladas. Comissões já geradas não mudam. Motivo: {motivoDono.trim()}</p>
        </ConfirmarAcao>
      )}
    </>
  );
}
