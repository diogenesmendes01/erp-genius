"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIPO_COBRANCA_LABEL } from "@/lib/labels";
import { formatarMoeda, formatarValores } from "@/lib/dinheiro";
import { REGUA } from "@/server/cobrancas/regua";
import type { FilaCobrancaItem, DashsCobranca } from "@/server/cobrancas/consultas";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import { registrarCobrancaWhatsApp } from "@/server/financeiro/acoes";
import { registrarPromessaPagamento, bloquearAcesso, desbloquearAcesso } from "@/server/cobrancas/acoes";
import { PagamentoModal } from "@/components/PagamentoModal";

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50";

type Filtro = "aVencer" | "emAtraso" | "bloquear" | "promessas" | null;

// Cor do chip do degrau por tipo de ação (lembrar=preventivo, cobrar=atraso, bloquear=crítico).
function chipCls(item: FilaCobrancaItem): string {
  if (item.precisaBloqueio) return "bg-red-100 text-red-700";
  if (item.acessoBloqueado) return "bg-red-100 text-red-700";
  if (item.estado === "promessa") return "bg-blue-100 text-blue-700";
  if (item.estado === "concluida") return "bg-gray-100 text-gray-500";
  if (item.tipoAcao === "lembrar") return "bg-green-100 text-green-700";
  if (item.tipoAcao === "cobrar") return "bg-amber-100 text-amber-700";
  if (item.tipoAcao === "bloquear") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

// Rótulo curto da próxima ação na linha (ex.: "D+7 · cobrar · há 7d").
function rotuloAcaoCurto(item: FilaCobrancaItem): string {
  if (item.precisaBloqueio) return `bloqueio pendente · há ${item.diasAtraso}d`;
  if (item.acessoBloqueado) return "acesso bloqueado";
  if (item.estado === "promessa" && item.promessaAte) {
    return `promessa · paga ${new Date(item.promessaAte).toLocaleDateString("pt-BR")}`;
  }
  if (item.estado === "concluida") return "régua concluída";
  if (item.estado === "futuro") return "a vencer";
  if (!item.passo) return "—";
  const quando =
    item.diasAtraso > 0 ? `há ${item.diasAtraso}d` : item.diasAtraso < 0 ? `em ${-item.diasAtraso}d` : "hoje";
  const verbo = item.tipoAcao === "lembrar" ? "lembrar" : item.tipoAcao === "bloquear" ? "bloquear" : "cobrar";
  return `${item.passo} · ${verbo} · ${quando}`;
}

function mensagem(modelo: ModeloWhatsapp, nome: string, valor: string): string {
  const m: Record<ModeloWhatsapp, string> = {
    amigavel: `Olá ${nome}! 😊 Passando para lembrar da sua mensalidade de ${valor}. Qualquer dúvida, estou à disposição!`,
    vencida: `Olá ${nome}, notamos que a cobrança de ${valor} está vencida. Consegue regularizar?`,
    firme: `Olá ${nome}, sua cobrança de ${valor} está em atraso. Precisamos regularizar para manter seu acesso às aulas.`,
    dados: `Olá ${nome}! Seguem os dados para pagamento de ${valor}. Pode me confirmar quando efetuar?`,
    promessa: `Olá ${nome}, podemos combinar uma data para o pagamento de ${valor}?`,
  };
  return m[modelo];
}

function linkWa(telefone: string, texto: string): string {
  return `https://wa.me/${telefone.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

function valorDevido(item: FilaCobrancaItem): number {
  return item.saldo > 0 ? item.saldo : item.valorNegociado;
}

export function FilaCobranca({
  itens,
  dashs,
  podeOperar,
  podeBloquear,
}: {
  itens: FilaCobrancaItem[];
  dashs: DashsCobranca;
  podeOperar: boolean;
  podeBloquear: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [busca, setBusca] = useState("");
  const [fPais, setFPais] = useState("");
  const [fTurma, setFTurma] = useState("");
  const [aberta, setAberta] = useState<FilaCobrancaItem | null>(null);
  const [pagar, setPagar] = useState<FilaCobrancaItem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  const paisesOpts = useMemo(() => [...new Set(itens.map((i) => i.pais))].sort(), [itens]);
  const turmasOpts = useMemo(
    () => [...new Set(itens.map((i) => i.turma).filter((t): t is string => !!t))].sort(),
    [itens],
  );

  const filtrados = useMemo(() => {
    let arr = itens;
    if (filtro === "aVencer") arr = arr.filter((i) => i.estado !== "promessa" && i.diasAtraso <= 0);
    else if (filtro === "emAtraso") arr = arr.filter((i) => i.estado !== "promessa" && i.diasAtraso > 0);
    else if (filtro === "bloquear") arr = arr.filter((i) => i.precisaBloqueio);
    else if (filtro === "promessas") arr = arr.filter((i) => i.estado === "promessa");
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((i) => i.aluno.nome.toLowerCase().includes(q) || (i.codigo ?? "").toLowerCase().includes(q));
    if (fPais) arr = arr.filter((i) => i.pais === fPais);
    if (fTurma) arr = arr.filter((i) => i.turma === fTurma);
    return [...arr].sort((a, b) => a.prioridade - b.prioridade || b.diasAtraso - a.diasAtraso);
  }, [itens, filtro, busca, fPais, fTurma]);

  async function run(p: Promise<{ ok: boolean; erro?: string }>, msg?: string) {
    setErro(null);
    setNota(null);
    const r = await p;
    if (!r.ok) setErro(r.erro ?? "Erro.");
    else {
      if (msg) setNota(msg);
      router.refresh();
    }
  }

  async function enviar(item: FilaCobrancaItem, textoOverride?: string) {
    if (!item.passo || !item.template) return;
    const texto = textoOverride ?? mensagem(item.template as ModeloWhatsapp, item.aluno.nome, formatarMoeda(valorDevido(item), item.moeda));
    if (item.aluno.telefone) window.open(linkWa(item.aluno.telefone, texto), "_blank");
    await run(registrarCobrancaWhatsApp(item.id, item.template as ModeloWhatsapp, item.passo), "Envio registrado.");
    setAberta(null);
  }

  const DASHS: { chave: Filtro; label: string; valor: string; cls: string }[] = [
    { chave: "aVencer", label: "A vencer", valor: String(dashs.aVencer), cls: "text-green-700" },
    { chave: "emAtraso", label: "Em atraso", valor: String(dashs.emAtraso), cls: "text-amber-700" },
    { chave: "bloquear", label: "Bloquear", valor: String(dashs.bloquear), cls: "text-red-700" },
    { chave: "promessas", label: "Promessas", valor: String(dashs.promessas), cls: "text-blue-700" },
  ];

  return (
    <div>
      {erro && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {nota && <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{nota}</p>}

      {/* Mini-dashs = filtros da régua */}
      <div className="mb-1 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {DASHS.map((d) => (
          <button
            key={d.label}
            onClick={() => setFiltro((f) => (f === d.chave ? null : d.chave))}
            className={
              "rounded-lg border bg-surface p-3 text-left transition " +
              (filtro === d.chave ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200 hover:border-gray-300")
            }
          >
            <div className={"text-2xl font-medium " + d.cls}>{d.valor}</div>
            <div className="text-xs text-gray-500">{d.label}</div>
          </button>
        ))}
        <div className="rounded-lg border border-gray-200 bg-surface p-3">
          <div className="text-lg font-medium text-gray-800">{formatarValores(dashs.recebidoHoje)}</div>
          <div className="text-xs text-gray-500">Recebido hoje</div>
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Cartões filtram a fila ·{" "}
        {filtro ? (
          <button className="text-brand-700 hover:underline" onClick={() => setFiltro(null)}>
            limpar filtro
          </button>
        ) : (
          <>ordenada por prioridade</>
        )}
      </p>

      {/* Busca + filtros de navegação (volume) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno ou código…"
          className="w-48 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <select
          value={fPais}
          onChange={(e) => setFPais(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Todos os países</option>
          {paisesOpts.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={fTurma}
          onChange={(e) => setFTurma(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Todas as turmas</option>
          {turmasOpts.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-gray-400">{filtrados.length} de {itens.length}</span>
      </div>

      {/* Lista magra */}
      {filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Nada nesta visão.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          {filtrados.map((item) => (
            <div
              key={item.id}
              className="cursor-pointer border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50"
              onClick={() => setAberta(item)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-800">{item.aluno.nome}</span>
                <span className="text-sm font-medium text-gray-800">{formatarMoeda(valorDevido(item), item.moeda)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="truncate text-xs text-gray-500">
                  {item.turma ?? "sem turma"} · {item.pais}
                  {item.acessoBloqueado && <span className="ml-1 text-red-600">· acesso bloqueado</span>}
                  {item.tentativas > 1 && <span className="ml-1 text-amber-600">· {item.tentativas}ª cobrança</span>}
                </span>
                <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className={"rounded-md px-2 py-0.5 text-[11px] " + chipCls(item)}>{rotuloAcaoCurto(item)}</span>
                  <AcaoRapida
                    item={item}
                    podeOperar={podeOperar}
                    podeBloquear={podeBloquear}
                    onEnviar={() => enviar(item)}
                    onBloquear={() => run(bloquearAcesso(item.matriculaId), "Acesso bloqueado.")}
                  />
                  <span className="text-gray-300">›</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {aberta && (
        <DrawerDetalhe
          item={aberta}
          podeOperar={podeOperar}
          podeBloquear={podeBloquear}
          onClose={() => setAberta(null)}
          onEnviar={(texto) => enviar(aberta, texto)}
          onPagar={() => { setPagar(aberta); setAberta(null); }}
          onPromessa={(ate) => run(registrarPromessaPagamento(aberta.id, ate), "Promessa registrada.").then(() => setAberta(null))}
          onBloquear={() => run(bloquearAcesso(aberta.matriculaId), "Acesso bloqueado.").then(() => setAberta(null))}
          onDesbloquear={() => run(desbloquearAcesso(aberta.matriculaId), "Acesso desbloqueado.").then(() => setAberta(null))}
        />
      )}

      {pagar && (
        <PagamentoModal
          cobrancaId={pagar.id}
          alunoNome={pagar.aluno.nome}
          moeda={pagar.moeda}
          valorEsperado={pagar.valorNegociado}
          jaRecebido={pagar.valorRecebido}
          saldoRestante={pagar.saldo}
          onClose={() => setPagar(null)}
          onDone={() => { setPagar(null); router.refresh(); }}
          onErro={setErro}
        />
      )}
    </div>
  );
}

function AcaoRapida({
  item,
  podeOperar,
  podeBloquear,
  onEnviar,
  onBloquear,
}: {
  item: FilaCobrancaItem;
  podeOperar: boolean;
  podeBloquear: boolean;
  onEnviar: () => void;
  onBloquear: () => void;
}) {
  // Bloqueio pendente vence o resto: independe do passo da régua (review §1).
  if (item.acessoBloqueado) return <span className="text-[11px] text-gray-400">bloqueado</span>;
  if (item.precisaBloqueio) {
    if (!podeBloquear) return <span className="text-[11px] text-gray-400">aguarda gerente</span>;
    return (
      <button className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50" onClick={onBloquear}>
        Aprovar bloqueio
      </button>
    );
  }
  if (item.estado !== "acao_devida" || !item.passo) return null;
  if (!podeOperar) return null;
  const label = item.tipoAcao === "lembrar" ? "Lembrar" : "Cobrar";
  return (
    <button className={btnSec} onClick={onEnviar}>
      {label}
    </button>
  );
}

function DrawerDetalhe({
  item,
  podeOperar,
  podeBloquear,
  onClose,
  onEnviar,
  onPagar,
  onPromessa,
  onBloquear,
  onDesbloquear,
}: {
  item: FilaCobrancaItem;
  podeOperar: boolean;
  podeBloquear: boolean;
  onClose: () => void;
  onEnviar: (texto: string) => void;
  onPagar: () => void;
  onPromessa: (ate: string) => void;
  onBloquear: () => void;
  onDesbloquear: () => void;
}) {
  const venc = new Date(item.vencimento);
  const textoSugerido =
    item.template && item.estado === "acao_devida"
      ? mensagem(item.template as ModeloWhatsapp, item.aluno.nome, formatarMoeda(valorDevido(item), item.moeda))
      : "";
  const [texto, setTexto] = useState(textoSugerido);
  const [promessaData, setPromessaData] = useState("");
  const [mostrarPromessa, setMostrarPromessa] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <span className="text-sm font-medium">Detalhe da cobrança</span>
          <button className="text-gray-400 hover:text-gray-700" onClick={onClose}>✕</button>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-medium">{item.aluno.nome}</span>
            {item.diasAtraso > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Em atraso</span>}
            {item.acessoBloqueado && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Acesso bloqueado</span>}
            {item.tentativas > 1 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{item.tentativas}ª cobrança</span>}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {item.turma ?? "sem turma"} · {item.pais} · {item.codigo}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-medium text-gray-800">{formatarMoeda(valorDevido(item), item.moeda)}</span>
            <span className="text-xs text-gray-500">
              {TIPO_COBRANCA_LABEL[item.tipo as keyof typeof TIPO_COBRANCA_LABEL] ?? item.tipo}
              {item.competencia ? ` ${item.competencia}` : ""} · vence {venc.toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>

        {/* Ação de hoje — bloqueio pendente tem precedência (review §1) */}
        {item.precisaBloqueio ? (
          <div className="mx-5 mb-4 rounded-md bg-red-50 p-3">
            <div className="mb-2 text-xs font-medium text-red-800">
              Bloqueio de acesso · {item.diasAtraso} dias de atraso
            </div>
            <div className="text-sm text-gray-700">
              O bloqueio de acesso à aula precisa de aprovação gerencial.
              <div className="mt-3 flex flex-wrap gap-2">
                {podeBloquear ? (
                  <button className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700" onClick={onBloquear}>
                    Aprovar bloqueio de acesso
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">Aguardando aprovação do Gerente Comercial / Admin.</span>
                )}
                {podeOperar && item.template && (
                  <button className={btnSec} onClick={() => onEnviar(texto)}>Enviar cobrança no WhatsApp</button>
                )}
              </div>
            </div>
          </div>
        ) : item.estado === "acao_devida" && item.passo ? (
          <div className="mx-5 mb-4 rounded-md bg-amber-50 p-3">
            <div className="mb-2 text-xs font-medium text-amber-800">
              Ação de hoje · {item.rotuloAcao}
              {item.atrasadaNaAcao && <span className="ml-1 font-normal">(atrasada)</span>}
            </div>
            <textarea
              className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-brand-500"
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            {podeOperar && (
              <button className={btnPri + " mt-2"} onClick={() => onEnviar(texto)}>
                Enviar no WhatsApp
              </button>
            )}
          </div>
        ) : null}
        {item.estado === "promessa" && item.promessaAte && (
          <div className="mx-5 mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
            Promessa de pagamento até {new Date(item.promessaAte).toLocaleDateString("pt-BR")} — fora da fila até lá.
          </div>
        )}

        {/* Régua (linha do tempo) */}
        <div className="px-5 pb-4">
          <div className="mb-2 text-xs font-medium text-gray-600">Régua de cobrança</div>
          <ol className="relative ml-1 border-l border-gray-200 pl-4">
            {REGUA.map((deg) => {
              const feito = item.passosFeitos.includes(deg.passo);
              const atual = item.passo === deg.passo && item.estado === "acao_devida";
              const data = new Date(venc.getTime() + deg.offsetDias * 86400000);
              const cor = feito ? "bg-green-500" : atual ? "bg-amber-500" : deg.tipo === "bloquear" ? "border border-red-400 bg-surface" : "border border-gray-300 bg-surface";
              return (
                <li key={deg.passo} className="mb-2.5">
                  <span className={"absolute -left-[7px] mt-1 h-3 w-3 rounded-full " + cor} />
                  <div className={"text-xs " + (atual ? "font-medium text-amber-700" : feito ? "text-gray-700" : "text-gray-400")}>
                    {deg.rotulo}
                    {deg.tipo === "bloquear" && !feito && <span className="text-red-500"> (aprovação)</span>}
                    <span className="text-gray-400"> · {data.toLocaleDateString("pt-BR")}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Ações secundárias */}
        <div className="border-t border-gray-200 px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {podeOperar && <button className={btnSec} onClick={onPagar}>Registrar pagamento</button>}
            {podeOperar && (
              <button className={btnSec} onClick={() => setMostrarPromessa((v) => !v)}>Promessa de pagamento</button>
            )}
            {podeBloquear && item.acessoBloqueado && (
              <button className={btnSec} onClick={onDesbloquear}>Desbloquear acesso</button>
            )}
          </div>
          {mostrarPromessa && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="date"
                className="rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
                value={promessaData}
                onChange={(e) => setPromessaData(e.target.value)}
              />
              <button
                className={btnPri}
                disabled={!promessaData}
                onClick={() => onPromessa(promessaData)}
              >
                Registrar promessa
              </button>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>
              {item.aluno.telefone ?? "sem telefone"}
              {item.tentativas > 0 && ` · ${item.tentativas} tentativa(s)`}
              {item.ultimaCobrancaEm && ` · último ${new Date(item.ultimaCobrancaEm).toLocaleDateString("pt-BR")}`}
            </span>
            <Link href={`/alunos/${item.aluno.id}/financeiro`} className="text-brand-700 hover:underline">
              Ver ficha →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
