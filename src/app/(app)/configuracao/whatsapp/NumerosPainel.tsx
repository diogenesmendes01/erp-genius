"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconQrcode, IconPencil, IconPlus, IconX } from "@tabler/icons-react";
import type { NumeroConfig, ResponsavelTriagem } from "@/server/whatsapp/consultas";
import { salvarSetoresNumero } from "@/server/whatsapp/acoes-numero";
import { SETORES, podeTriarSetores, type Setor } from "@/server/whatsapp/setor";
import { conectarNumeroQr, consultarSessaoNumero, desconectarNumero, parearNumeroPorCodigo, salvarNumeroWhatsApp } from "@/server/whatsapp/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Chip } from "@/components/Chip";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Modal } from "@/components/Modal";
import { executarAcaoCliente, useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { DRIVER_WHATSAPP_LABEL, FINALIDADE_NUMERO_LABEL, SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";

// TELA DO NÚMERO (doc 26 §Camada 0/E3): cadastro, estado da sessão no motor WhatsApp, conexão por QR ou
// código de pareamento e desconexão. Todo número novo nasce MOTOR (sem escolha de driver). Soft-delete via ativo.

const btnPri = botaoClasses({ tamanho: "md" });
const btnSec = botaoClasses({ variante: "secundario", tamanho: "sm" });
const inputCls = "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500";

const SESSAO_BADGE: Record<string, { label: string; cls: string }> = {
  CONECTADO: { label: "conectado", cls: "bg-green-100 text-green-700" },
  AGUARDANDO_QR: { label: "aguardando QR", cls: "bg-amber-100 text-amber-700" },
  CAIU: { label: "sessão caiu", cls: "bg-red-100 text-red-700" },
  DESCONECTADO: { label: "desconectado", cls: "bg-gray-100 text-gray-600" },
};

interface FormNumero {
  id?: string;
  telefoneE164: string;
  rotulo: string;
  finalidade: "COBRANCA" | "VENDAS" | "AGENDA";
  donoId: string;
  ativo: boolean;
}

const FORM_VAZIO: FormNumero = {
  telefoneE164: "",
  rotulo: "",
  finalidade: "COBRANCA",
  donoId: "",
  ativo: true,
};

export function NumerosPainel({
  numeros,
  vendedores,
  responsaveis = [],
}: {
  numeros: NumeroConfig[];
  vendedores: { id: string; nome: string }[];
  responsaveis?: ResponsavelTriagem[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormNumero | null>(null);
  // salvarNumeroWhatsApp não recebe chave de idempotência (sem id, cada envio cria um número):
  // resultado incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  const [qrDe, setQrDe] = useState<NumeroConfig | null>(null);
  const [desconectando, setDesconectando] = useState<NumeroConfig | null>(null);

  async function salvar() {
    if (!form) return;
    const dados = form;
    const d = await acao.executar(() => salvarNumeroWhatsApp(dados), "Número salvo.");
    if (d?.tipo !== "ok") return;
    setForm(null);
    router.refresh();
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Números</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Cada número conecta ao WhatsApp pelo motor: leia o QR ou use o código de pareamento.
          </p>
        </div>
        <button type="button" className={btnPri} onClick={() => setForm(FORM_VAZIO)}>
          <span className="flex items-center gap-1">
            <IconPlus className="h-4 w-4" /> Novo número
          </span>
        </button>
      </div>

      {numeros.length === 0 && !form ? (
        <EstadoVazio bloco className="mt-4">Nenhum número cadastrado — o canal começa aqui.</EstadoVazio>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
          {numeros.map((n) => {
            const badge = SESSAO_BADGE[n.sessao] ?? SESSAO_BADGE.DESCONECTADO;
            return (
              <div key={n.id} className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{n.rotulo}</span>
                    <span className="text-xs text-gray-500">{n.telefoneE164}</span>
                    {!n.ativo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">inativo</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {n.driver !== "MOTOR" && (
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-600">
                        {rotular(DRIVER_WHATSAPP_LABEL, n.driver)}
                      </span>
                    )}
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">
                      {rotular(FINALIDADE_NUMERO_LABEL, n.finalidade).toLowerCase()}
                    </span>
                    {n.driver === "MOTOR" && (
                      <span className={"rounded-full px-1.5 py-0.5 " + badge.cls}>{badge.label}</span>
                    )}
                    {n.setores.map((st) => (
                      <span key={st} className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">
                        {SETOR_ATENDIMENTO_LABEL[st].toLowerCase()}
                      </span>
                    ))}
                    {n.donoNome && <span className="text-gray-500">dono: {n.donoNome}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.driver === "MOTOR" && n.ativo && (
                    <button type="button" className={btnSec} onClick={() => setQrDe(n)}>
                      <span className="flex items-center gap-1">
                        <IconQrcode className="h-3.5 w-3.5" /> Conectar
                      </span>
                    </button>
                  )}
                  {n.driver === "MOTOR" && n.ativo && n.sessao !== "DESCONECTADO" && (
                    <button type="button" className={btnSec} onClick={() => setDesconectando(n)}>
                      Desconectar
                    </button>
                  )}
                  <button
                    type="button"
                    className={btnSec}
                    onClick={() =>
                      setForm({
                        id: n.id,
                        telefoneE164: n.telefoneE164,
                        rotulo: n.rotulo,
                        finalidade: n.finalidade as FormNumero["finalidade"],
                        donoId: n.donoId ?? "",
                        ativo: n.ativo,
                      })
                    }
                  >
                    <span className="flex items-center gap-1">
                      <IconPencil className="h-3.5 w-3.5" /> Editar
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">{form.id ? "Editar número" : "Novo número"}</span>
            <button className="text-gray-400 hover:text-gray-700" onClick={() => setForm(null)} aria-label="Fechar">
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-gray-600">
              Telefone (E.164)
              <input
                className={inputCls + " mt-1"}
                placeholder="+50688887777"
                value={form.telefoneE164}
                onChange={(e) => setForm({ ...form, telefoneE164: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-600">
              Rótulo
              <input
                className={inputCls + " mt-1"}
                placeholder="Cobrança · Vendas — Ana"
                value={form.rotulo}
                onChange={(e) => setForm({ ...form, rotulo: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-600">
              Finalidade
              <select
                className={inputCls + " mt-1"}
                value={form.finalidade}
                onChange={(e) => setForm({ ...form, finalidade: e.target.value as FormNumero["finalidade"] })}
              >
                <option value="COBRANCA">Cobrança</option>
                <option value="VENDAS">Vendas</option>
                <option value="AGENDA">Agenda institucional</option>
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Dono da conversa (vendas)
              <select
                className={inputCls + " mt-1"}
                value={form.donoId}
                onChange={(e) => setForm({ ...form, donoId: e.target.value })}
              >
                <option value="">— sem dono —</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-brand-600"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Número ativo
            </label>
            <button type="button" className={btnPri} disabled={acao.ocupado} onClick={salvar}>
              {acao.ocupado ? "Salvando…" : "Salvar número"}
            </button>
          </div>
        </div>
      )}
      {form?.id && numeros.some((n) => n.id === form.id) && (
        <SetoresNumeroEditor
          key={form.id}
          numero={numeros.find((n) => n.id === form.id)!}
          responsaveis={responsaveis}
        />
      )}
      {/* Logo abaixo do "Salvar número" — e no mesmo lugar depois que o formulário fecha no sucesso. */}
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />

      {desconectando && (
        <ConfirmarAcao
          titulo={`Desconectar o número ${desconectando.rotulo}?`}
          confirmacao={`desconexão de ${desconectando.rotulo}`}
          idempotente={false}
          acao={() => desconectarNumero(desconectando.id)}
          aoConcluir={() => { setDesconectando(null); router.refresh(); }}
          aoCancelar={() => setDesconectando(null)}
        >
          O número deixa de enviar e receber mensagens até ser pareado de novo por QR ou código. Mensagens
          pendentes ficam na fila e saem depois da reconexão.
        </ConfirmarAcao>
      )}
      {qrDe && <QrModal numero={qrDe} onClose={() => { setQrDe(null); router.refresh(); }} />}
    </section>
  );
}

// Setores atendidos e responsável pela triagem (doc 02 E3): o número pode servir vários setores;
// a triagem só existe com 2+ setores (null = administrador, Q2).
export function SetoresNumeroEditor({
  numero,
  responsaveis,
}: {
  numero: Pick<NumeroConfig, "id" | "setores" | "triagemResponsavelId">;
  responsaveis: ResponsavelTriagem[];
}) {
  const router = useRouter();
  const [setores, setSetores] = useState<Setor[]>(numero.setores);
  const [triagem, setTriagem] = useState<string>(numero.triagemResponsavelId ?? "");
  // Operação de "definir o conjunto": repetir é inofensivo.
  const acao = useAcaoCliente({ idempotente: true });

  function alternar(s: Setor) {
    setSetores((atual) => (atual.includes(s) ? atual.filter((x) => x !== s) : SETORES.filter((x) => x === s || atual.includes(x))));
  }

  // Só quem tem papel de um dos setores marcados (mesma regra que salvarSetoresNumero aplica no servidor).
  const elegiveis = responsaveis.filter((u) => podeTriarSetores(u.papeis, setores));
  const triagemValida = elegiveis.some((u) => u.id === triagem) ? triagem : "";

  async function salvar() {
    const d = await acao.executar(
      () => salvarSetoresNumero({ numeroId: numero.id, setores, triagemResponsavelId: setores.length >= 2 && triagemValida ? triagemValida : null }),
      "Setores salvos.",
    );
    if (d?.tipo === "ok") router.refresh();
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-surface p-4">
      <span className="text-sm font-medium">Setores atendidos</span>
      <div className="mt-2 flex flex-wrap gap-4">
        {SETORES.map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-brand-600"
              checked={setores.includes(s)}
              onChange={() => alternar(s)}
            />
            {SETOR_ATENDIMENTO_LABEL[s]}
          </label>
        ))}
      </div>
      {setores.length >= 2 && (
        <label className="mt-3 block text-xs text-gray-600">
          Responsável pela triagem
          <select className={inputCls + " mt-1 sm:max-w-xs"} value={triagemValida} onChange={(e) => setTriagem(e.target.value)}>
            <option value="">— Administrador —</option>
            {elegiveis.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-3 flex justify-end">
        <button type="button" className={btnPri} disabled={acao.ocupado || setores.length === 0} onClick={salvar}>
          {acao.ocupado ? "Salvando…" : "Salvar setores"}
        </button>
      </div>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />
    </div>
  );
}

// Modal de conexão: abas "QR" e "Código". O poll de 5 s consulta a sessão e troca o QR quando ele muda.
function QrModal({ numero, onClose }: { numero: NumeroConfig; onClose: () => void }) {
  const [aba, setAba] = useState<"QR" | "Código">("QR");
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [telefone, setTelefone] = useState(numero.telefoneE164);
  const [estado, setEstado] = useState<string>(numero.sessao);
  // conectarNumeroQr/parearNumeroPorCodigo não recebem chave de idempotência: resultado incerto manda conferir.
  const acao = useAcaoCliente({ idempotente: false });

  async function pedirQr() {
    const d = await acao.executar(() => conectarNumeroQr(numero.id));
    if (d?.tipo !== "ok") return;
    setQr(d.dado!.qrBase64);
    setEstado(d.dado!.estado);
    if (d.dado!.erro) acao.setErro(d.dado!.erro);
  }

  async function pedirCodigo() {
    const d = await acao.executar(() => parearNumeroPorCodigo(numero.id, telefone));
    if (d?.tipo !== "ok") return;
    setCodigo(d.dado!.codigoPareamento);
    setEstado(d.dado!.estado);
    if (d.dado!.erro) acao.setErro(d.dado!.erro);
  }

  useEffect(() => {
    // Agendado (não síncrono no corpo do effect): satisfaz react-hooks/set-state-in-effect.
    const t = setTimeout(() => void pedirQr(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll do estado a cada 5s enquanto o modal está aberto e não conectou.
  useEffect(() => {
    if (estado === "CONECTADO") return;
    const t = setInterval(async () => {
      // Poll só-leitura: falha (de negócio ou de rede) é ignorada — o próximo tique tenta de novo.
      // Fora do useAcaoCliente para não travar/limpar os botões a cada 5s.
      const d = await executarAcaoCliente(() => consultarSessaoNumero(numero.id), { idempotente: false });
      if (d.tipo !== "ok") return;
      setEstado(d.dado!.sessao);
      // Só troca o QR quando o motor devolve um novo (o QR do WhatsApp gira a cada ~20 s).
      if (d.dado!.qrBase64) setQr((atual) => (atual === d.dado!.qrBase64 ? atual : d.dado!.qrBase64));
      if (d.dado!.codigoPareamento) setCodigo((atual) => (atual === d.dado!.codigoPareamento ? atual : d.dado!.codigoPareamento));
    }, 5000);
    return () => clearInterval(t);
  }, [estado, numero.id]);

  const badge = SESSAO_BADGE[estado] ?? SESSAO_BADGE.DESCONECTADO;

  return (
    <Modal titulo={`Conectar ${numero.rotulo}`} aoFechar={onClose} bloquearFechamento={acao.ocupado}>
      <div className="flex gap-2">
        {(["QR", "Código"] as const).map((a) => (
          <Chip key={a} selecionado={aba === a} onClick={() => setAba(a)}>
            {a}
          </Chip>
        ))}
      </div>
      {aba === "QR" ? (
        <p className="mt-3 text-xs text-gray-500">
          No celular do número: WhatsApp → aparelhos conectados → conectar aparelho.
        </p>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          No celular do número: WhatsApp → aparelhos conectados → conectar com número de telefone, e digite o código.
        </p>
      )}
      <div className="mt-3 flex min-h-64 flex-col items-center justify-center gap-3 rounded-md border border-gray-200 bg-surface p-3">
        {estado === "CONECTADO" ? (
          <p className="text-sm text-green-700">Conectado! O número já envia e recebe por aqui.</p>
        ) : aba === "QR" ? (
          qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR de conexão" className="h-56 w-56" />
          ) : (
            <p className="text-sm text-gray-400">{acao.ocupado ? "Gerando QR…" : "Sem QR — tente atualizar."}</p>
          )
        ) : (
          <>
            <label className="w-full text-xs text-gray-600">
              Telefone do número (E.164)
              <input className={inputCls + " mt-1"} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </label>
            {codigo ? (
              <p className="font-mono text-2xl tracking-widest text-gray-800">{codigo}</p>
            ) : (
              <p className="text-sm text-gray-400">{acao.ocupado ? "Gerando código…" : "Gere o código de pareamento."}</p>
            )}
          </>
        )}
      </div>
      <FeedbackAcao erro={acao.erro} className="mt-2" />
      <div className="mt-3 flex items-center justify-between">
        <span className={"rounded-full px-2 py-0.5 text-[11px] " + badge.cls}>{badge.label}</span>
        <div className="flex items-center gap-2">
          <button type="button" className={btnSec} onClick={onClose}>Fechar</button>
          {aba === "QR" ? (
            <button type="button" className={btnSec} disabled={acao.ocupado || estado === "CONECTADO"} onClick={pedirQr}>
              Atualizar QR
            </button>
          ) : (
            <button type="button" className={btnSec} disabled={acao.ocupado || estado === "CONECTADO" || !telefone.trim()} onClick={pedirCodigo}>
              Gerar código
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
