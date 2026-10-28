"use client";

import { useState } from "react";
import Link from "next/link";
import { hrefConversa } from "@/lib/href-conversa";
import type { ConversaParaAbrir } from "@/server/inbox/atalhos";

import { useRouter } from "next/navigation";
import { EtapaLead, Temperatura } from "@prisma/client";
import { IconPhone, IconSpeakerphone, IconUser } from "@tabler/icons-react";
import { Drawer } from "@/components/Drawer";
import { Avatar } from "@/components/Avatar";
import { BadgeEstado } from "@/components/BadgeEstado";
import { BarraEtapas } from "@/components/BarraEtapas";
import { Botao, botaoClasses } from "@/components/Botao";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { Chip } from "@/components/Chip";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { LinhaCampo } from "@/components/LinhaCampo";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { formatarMoeda } from "@/lib/dinheiro";
import { ETAPA_LABEL, MOTIVO_PERDA_LABEL, TEMPERATURA_LABEL } from "@/lib/labels";
import { atribuirDono, atribuirProfessorExperimental, confirmarPresencaExperimental, definirTemperatura, agendarExperimental, enviarProposta, moverEtapa, registrarNotaInterna } from "@/server/comercial/acoes";
import { registrarLinkPagamento } from "@/server/matricula/acoes";
import { destinoDoArraste, type DestinoArraste } from "@/server/crm/etapas";
import type { CapacidadeCrm } from "@/server/crm/permissoes";
import type { DetalheOportunidade, ItemHistorico } from "@/server/crm/historico";
import { ModalPerda } from "./ModalPerda";
import { SecoesParidadeFunil } from "./SecoesParidadeFunil";
import { DadosOportunidade, DatasOportunidade, DocumentosOportunidade, InteracaoOportunidade, ResumoOportunidade } from "./EdicaoOportunidade";
import { FUSO_PADRAO, Temperatura as SeloTemperatura } from "./CartaoOportunidade";
import { formatarDiaDaEscola, formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { fusoDoCampoLocal } from "@/server/operacao/fuso-entrada";
import { CampoDataHoraLocal } from "@/components/CampoDataHoraLocal";

type Aba = "oportunidade" | "detalhes" | "atividade";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "oportunidade", rotulo: "Oportunidade" },
  { id: "detalhes", rotulo: "Detalhes" },
  { id: "atividade", rotulo: "Atividade" },
];

const CARTAO = "rounded-item border border-gray-200 bg-surface-muted p-3";

type Props = {
  conversa?: ConversaParaAbrir | null;
  oportunidade: DetalheOportunidade;
  historico: ItemHistorico[];
  capacidades: CapacidadeCrm[];
  vendedores: { id: string; nome: string }[];
  professores?: { id: string; nome: string }[];
  paises?: { id: string; nome: string }[];
  aoFechar: () => void;
  fuso?: string;
  preferenciaFusoExibicao?: string | null;
  abaInicial?: Aba;
};

const dataHora = (d: Date | string, preferencia: string | null, fuso: string) => formatarInstanteExibicao(d, preferencia, fuso).texto;
const diaCivil = (d: Date | string, fuso: string) => formatarDiaDaEscola(d, fuso);

function Linha({ rotulo, children, mono = false }: { rotulo: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-200 py-2 text-sm last:border-b-0">
      <dt className="text-gray-600">{rotulo}</dt>
      <dd className={"text-right text-gray-800" + (mono ? " font-mono tabular-nums" : "")}>{children}</dd>
    </div>
  );
}

export function PainelOportunidade({ oportunidade: op, historico, capacidades, vendedores, professores = [], paises = [], aoFechar, fuso = FUSO_PADRAO, preferenciaFusoExibicao = null, abaInicial = "oportunidade", conversa }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const acao = useAcaoCliente({ idempotente: false });
  const acaoNota = useAcaoCliente({ idempotente: true });
  const tentativaNota = useChaveIdempotencia();
  const acaoLink = useAcaoCliente({ idempotente: true });
  const tentativaLink = useChaveIdempotencia();
  const [perda, setPerda] = useState(false);
  const [dataExp, setDataExp] = useState("");
  const [professorAgendar, setProfessorAgendar] = useState("");
  const [professorAtual, setProfessorAtual] = useState(op.professorExperimental?.id ?? "");
  const fusoExperimental = fusoDoCampoLocal(preferenciaFusoExibicao, fuso);
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
    acaoLink.limpar();
    const d = await acao.executar(f, sucesso);
    if (d?.tipo === "ok") {
      router.refresh();
      depois?.();
    }
  }

  async function registrarLink() {
    acao.limpar();
    acaoNota.limpar();
    const d = await acaoLink.executar(() => registrarLinkPagamento(taxa!.cobrancaId, link, { chaveIdempotencia: tentativaLink.atual }), "Link de pagamento registrado.");
    tentativaLink.depoisDo(d);
    if (d?.tipo === "ok") {
      router.refresh();
      setLink("");
    }
  }

  async function registrarNota() {
    acao.limpar();
    acaoLink.limpar();
    const d = await acaoNota.executar(() => registrarNotaInterna(op.id, { nota, chaveIdempotencia: tentativaNota.atual }), "Nota registrada.");
    tentativaNota.depoisDo(d);
    if (d?.tipo === "ok") {
      router.refresh();
      setNota("");
    }
  }

  function escolherEtapa(etapa: EtapaLead, destino: DestinoArraste) {
    if (!podeMover || acao.ocupado) return;
    if (destino.tipo === "nenhum") return;
    if (destino.tipo === "recusar") {
      acao.limpar();
      acao.setErro(destino.motivo);
      return;
    }
    if (destino.tipo === "acao") {
      acao.limpar();
      if (destino.acao === "marcarPerdido") setPerda(true);
      else if (destino.acao === "enviarProposta") void rodar(() => enviarProposta(op.id), "Proposta enviada.");
      else if (destino.acao === "prepararContratacao") router.push(`/oportunidades/${op.id}/contratacao`);
      return;
    }
    void rodar(() => moverEtapa(op.id, etapa), "Etapa atualizada.");
  }

  return (
    <>
      <Drawer
        open
        onClose={aoFechar}
        title={op.nome}
        largura="w-full max-sm:max-w-none sm:max-w-2xl md:w-[45%]"
      >
        <div className="mb-4 flex items-start gap-3">
          <Avatar nome={op.nome} tamanho={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-gray-900">{op.nome}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {op.codigo && <span className="font-mono text-xs tabular-nums text-gray-600">#{op.codigo}</span>}
              <BadgeEstado tom="brand" ponto>{ETAPA_LABEL[op.etapa]}</BadgeEstado>
              <SeloTemperatura temperatura={op.temperatura} />
            </div>
            {conversa && <div className="mt-2 flex flex-wrap gap-2">
              <Link href={hrefConversa(conversa.atendimentoId)} className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>Abrir conversa</Link>
              {conversa.aberta && <Link href={hrefConversa(conversa.atendimentoId, { agendar: true })} className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>Agendar mensagem</Link>}
            </div>}
          </div>
        </div>

        <div role="tablist" aria-label="Seções da oportunidade" className="mb-4 flex border-b border-gray-200 px-1">
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
                "flex h-[38px] flex-1 items-center justify-center border-b-2 text-[13px] font-semibold transition-colors " +
                (aba === a.id ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800")
              }
            >{a.rotulo}</button>
          ))}
        </div>

        <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mb-3" />

        {aba === "oportunidade" && (
          <div role="tabpanel" id="painel-oportunidade" aria-labelledby="aba-oportunidade" className="space-y-3">
            <BarraEtapas etapa={op.etapa} podeMover={podeMover} ocupado={acao.ocupado} aoEscolher={escolherEtapa} />
            <div className={CARTAO}>
            <dl>
              <Linha rotulo="Valor previsto" mono>{op.valorPrevisto && op.moeda ? formatarMoeda(op.valorPrevisto, op.moeda) : "Não informado"}</Linha>
              <Linha rotulo="Próximo passo">{op.proximaAcao ?? "Sem próximo passo"}</Linha>
              {op.dataExperimental && <Linha rotulo="Experimental" mono>{dataHora(op.dataExperimental, preferenciaFusoExibicao, fuso)}</Linha>}
              {op.etapa === EtapaLead.PERDIDO && op.motivoPerda && <Linha rotulo="Motivo da perda">{MOTIVO_PERDA_LABEL[op.motivoPerda]}</Linha>}
              <Linha rotulo="Responsável">
                {podeAtribuir ? (
                  <select
                    aria-label="Responsável"
                    className={CONTROLE_CAMPO}
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
                  <CampoTexto rows={2} maxLength={300} className={CONTROLE_CAMPO} value={motivoDono} onChange={(e) => setMotivoDono(e.target.value)} />
                </label>
                <div>
                  <Botao variante="secundario" disabled={!motivoDono.trim() || acao.ocupado} onClick={() => setConfirmaDono(true)}>
                    Atribuir responsável
                  </Botao>
                </div>
              </div>
            )}
            </div>

            {podeMover && !encerrada && (
              <div className={CARTAO + " grid gap-1 text-sm text-gray-700"}>
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
              <div className={CARTAO + " grid gap-2"}>
                <label className="grid gap-1 text-sm text-gray-700">
                  <span>Data e hora da experimental</span>
                  <CampoDataHoraLocal fuso={fusoExperimental} className={CONTROLE_CAMPO} value={dataExp} disabled={acao.ocupado} onChange={(e) => setDataExp(e.target.value)} />
                </label>
                <label className="grid gap-1 text-sm text-gray-700">
                  <span>Professor da experimental</span>
                  <select aria-label="Professor da experimental" className={CONTROLE_CAMPO} value={professorAgendar} disabled={acao.ocupado} onChange={(e) => setProfessorAgendar(e.target.value)}>
                    <option value="">Sem professor</option>
                    {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </label>
                <div>
                  <Botao
                    variante="secundario"
                    disabled={!dataExp || acao.ocupado}
                    onClick={() => rodar(() => agendarExperimental(op.id, { dataLocal: dataExp, fuso: fusoExperimental, ...(professorAgendar ? { professorId: professorAgendar } : {}) }), "Experimental agendada.")}
                  >Agendar experimental</Botao>
                </div>
              </div>
            )}

            {podeMover && op.etapa === EtapaLead.EXPERIMENTAL_AGENDADA && (
              <div className={CARTAO + " grid gap-2"}>
                <label className="grid gap-1 text-sm text-gray-700">
                  <span>Professor da experimental</span>
                  <select
                    aria-label="Professor da experimental"
                    className={CONTROLE_CAMPO}
                    value={professorAtual}
                    disabled={acao.ocupado}
                    onChange={(e) => {
                      const professorId = e.target.value;
                      setProfessorAtual(professorId);
                      if (professorId && professorId !== op.professorExperimental?.id) {
                        void rodar(() => atribuirProfessorExperimental(op.id, professorId), "Professor da experimental atualizado.");
                      }
                    }}
                  >
                    <option value="">Sem professor</option>
                    {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </label>
                {op.dataExperimental && !op.experimentalConfirmadaEm && (
                  <div>
                    <Botao
                      variante="secundario"
                      disabled={acao.ocupado}
                      onClick={() => rodar(() => confirmarPresencaExperimental(op.id), "Presença na experimental confirmada.")}
                    >Confirmar presença</Botao>
                  </div>
                )}
              </div>
            )}

            {taxaAberta && podeMover && (
              <div className={CARTAO + " grid gap-2"}>
                <p className="text-sm font-medium text-gray-800">Taxa de matrícula pendente</p>
                {taxa!.linkPagamento && (
                  <p className="break-all text-xs text-gray-600">Link atual: {taxa!.linkPagamento}</p>
                )}
                <input aria-label="Link ou código de pagamento enviado" className={CONTROLE_CAMPO} placeholder="Link ou código de pagamento enviado" value={link} disabled={acao.ocupado || acaoLink.ocupado} onChange={(e) => setLink(e.target.value)} />
                <div>
                  <Botao
                    variante="secundario"
                    disabled={!link.trim() || acao.ocupado || acaoLink.ocupado}
                    onClick={() => void registrarLink()}
                  >Registrar link de pagamento</Botao>
                </div>
                <FeedbackAcao erro={acaoLink.erro} sucesso={acaoLink.sucesso} />
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
            <SecoesParidadeFunil oportunidade={op} podeEditarPrevisao={podeMover && !encerrada} podeTarefas={pode("tarefas.ver")} podeVerEmpresa={pode("funil.ver") || pode("comissoes.estornar")} />
          </div>
        )}

        {aba === "detalhes" && (
          <div role="tabpanel" id="painel-detalhes" aria-labelledby="aba-detalhes" className="space-y-3">
            <div className={CARTAO}>
            <dl>
              <Linha rotulo="Tipo">{op.b2b ? "Empresa (B2B)" : "Pessoa física"}</Linha>
              <Linha rotulo="País">{op.pais ?? "Não informado"}</Linha>
              <Linha rotulo="Criada em" mono>{dataHora(op.criadoEm, preferenciaFusoExibicao, fuso)}</Linha>
              {op.proximoFollowUp && <Linha rotulo="Próximo follow-up" mono>{diaCivil(op.proximoFollowUp, fuso)}</Linha>}
            </dl>
            {op.telefoneE164 && <LinhaCampo icone={<IconPhone size={18} />} rotulo="Telefone" valor={op.telefoneE164} mono />}
            <LinhaCampo icone={<IconUser size={18} />} rotulo="Responsável" valor={op.dono?.nome ?? "Sem responsável"} />
            {op.origemCampanha && <LinhaCampo icone={<IconSpeakerphone size={18} />} rotulo="Campanha" valor={op.origemCampanha} />}
            {op.pessoaId && (
              <p className="text-sm">
                <Link className="text-brand-700 underline" href={`/contatos?c=${encodeURIComponent(op.pessoaId)}`}>Abrir contato</Link>
              </p>
            )}
            </div>
            <DadosOportunidade oportunidade={op} podeEditar={podeMover} paises={paises} />
            <ResumoOportunidade oportunidade={op} podeEditar={podeMover} />
            <DatasOportunidade oportunidade={op} podeEditar={podeMover} fuso={fuso} preferenciaFusoExibicao={preferenciaFusoExibicao} professores={professores} />
            <DocumentosOportunidade oportunidade={op} podeEditar={podeMover} />
          </div>
        )}

        {aba === "atividade" && (
          <div role="tabpanel" id="painel-atividade" aria-labelledby="aba-atividade" className="space-y-4">
            {podeMover && <InteracaoOportunidade oportunidadeId={op.id} />}
            {podeMover && (
              <div className={CARTAO + " grid gap-2"}>
                <label className="grid gap-1 text-sm text-gray-700">
                  <span>Nota interna (a equipe vê; o contato não)</span>
                  <CampoTexto rows={3} maxLength={2000} className={CONTROLE_CAMPO} value={nota} disabled={acao.ocupado || acaoNota.ocupado} onChange={(e) => setNota(e.target.value)} />
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
