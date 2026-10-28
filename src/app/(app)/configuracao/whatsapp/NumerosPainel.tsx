"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconQrcode, IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import type { NumeroConfig, ResponsavelTriagem } from "@/server/whatsapp/consultas";
import { salvarSetoresNumero } from "@/server/whatsapp/acoes-numero";
import { SETORES, podeTriarSetores, type Setor } from "@/server/whatsapp/setor";
import {
  conectarNumeroQr,
  consultarSessaoNumero,
  desativarNumeroWhatsApp,
  desconectarNumero,
  excluirNumeroWhatsApp,
  parearNumeroPorCodigo,
  reativarNumeroWhatsApp,
  salvarNumeroWhatsApp,
} from "@/server/whatsapp/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Chip } from "@/components/Chip";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { Modal } from "@/components/Modal";
import { executarAcaoCliente, useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { AlteracaoPendente } from "@/components/AlteracaoPendente";
import { useAvisoAoSair } from "@/lib/aviso-ao-sair";
import { numeroAlterado, setoresAlterados } from "./alteracoes-pendentes";
import { DRIVER_WHATSAPP_LABEL, FINALIDADE_NUMERO_LABEL, SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";

import { Switch } from "@/components/ui/switch";
import { CampoSelect } from "@/components/ui/select";
import { CampoCombobox } from "@/components/ui/combobox";
const btnPri = botaoClasses({ tamanho: "md" });
const btnSec = botaoClasses({ variante: "secundario", tamanho: "sm" });
const btnPerigo = botaoClasses({ variante: "perigo", tamanho: "sm" });
const inputCls = "w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500";

const SESSAO_BADGE: Record<string, { label: string; cls: string }> = {
  CONECTADO: { label: "conectado", cls: "bg-green-100 text-green-700" },
  AGUARDANDO_QR: { label: "aguardando QR", cls: "bg-amber-100 text-amber-700" },
  CAIU: { label: "sessão caiu", cls: "bg-red-100 text-red-700" },
  DESCONECTADO: { label: "desconectado", cls: "bg-surface-muted text-gray-600" },
};

interface FormNumero {
  id?: string;
  telefoneE164: string;
  rotulo: string;
  finalidade: "COBRANCA" | "VENDAS" | "AGENDA";
  donoId: string;
}

const FORM_VAZIO: FormNumero = {
  telefoneE164: "",
  rotulo: "",
  finalidade: "COBRANCA",
  donoId: "",
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
  const acao = useAcaoCliente({ idempotente: false });
  const [qrDe, setQrDe] = useState<NumeroConfig | null>(null);
  const [desconectando, setDesconectando] = useState<NumeroConfig | null>(null);
  const [desativando, setDesativando] = useState<NumeroConfig | null>(null);
  const [excluindo, setExcluindo] = useState<NumeroConfig | null>(null);
  const sujo = numeroAlterado(form, numeros);
  useAvisoAoSair(sujo);

  async function salvar() {
    if (!form) return;
    const dados = form;
    const d = await acao.executar(() => salvarNumeroWhatsApp(dados), "Número salvo.");
    if (d?.tipo !== "ok") return;
    setForm(null);
    router.refresh();
  }

  async function reativar(n: NumeroConfig) {
    const d = await acao.executar(() => reativarNumeroWhatsApp(n.id), `${n.rotulo} reativado. Conecte de novo por QR ou código.`);
    if (d?.tipo === "ok") router.refresh();
  }

  function concluido(mensagem: string) {
    setDesativando(null);
    setExcluindo(null);
    if (form?.id && form.id === excluindo?.id) setForm(null);
    acao.setSucesso(mensagem);
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
                    {!n.ativo && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-gray-500">inativo</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {n.driver !== "MOTOR" && (
                      <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-gray-600">
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
                <div className="flex flex-wrap items-center gap-2">
                  {n.driver === "MOTOR" && n.ativo && (
                    <button type="button" className={btnSec} onClick={() => setQrDe(n)}>
                      <span className="flex items-center gap-1">
                        <IconQrcode className="h-3.5 w-3.5" /> Conectar
                      </span>
                    </button>
                  )}
                  {n.driver === "MOTOR" && n.sessao !== "DESCONECTADO" && (
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
                      })
                    }
                  >
                    <span className="flex items-center gap-1">
                      <IconPencil className="h-3.5 w-3.5" /> Editar
                    </span>
                  </button>
                  <button
                    type="button"
                    className={botaoClasses({ variante: n.ativo ? "perigo" : "fantasma", tamanho: "sm" })}
                    disabled={acao.ocupado}
                    onClick={() => {
                      acao.limpar();
                      if (n.ativo) setDesativando(n);
                      else void reativar(n);
                    }}
                  >
                    {n.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    className={btnPerigo}
                    disabled={acao.ocupado}
                    onClick={() => {
                      acao.limpar();
                      setExcluindo(n);
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <IconTrash className="h-3.5 w-3.5" /> Excluir
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
              <CampoSelect value={form.finalidade} onChange={(e) => setForm({ ...form, finalidade: e.target.value as FormNumero["finalidade"] })} className={inputCls + " mt-1"} opcoes={[{ valor: "COBRANCA", rotulo: "Cobrança" }, { valor: "VENDAS", rotulo: "Vendas" }, { valor: "AGENDA", rotulo: "Agenda institucional" }]} />
            </label>
            <label className="text-xs text-gray-600">
              Dono da conversa (vendas)
              <CampoCombobox value={form.donoId} onChange={(e) => setForm({ ...form, donoId: e.target.value })} className={inputCls + " mt-1"} vazio={"— sem dono —"} opcoes={vendedores.map((v) => ({ valor: String(v.id), rotulo: v.nome }))} />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-end gap-3">
            <AlteracaoPendente sujo={sujo} />
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
      {desativando && (
        <ConfirmarAcao
          titulo={`Desativar o número ${desativando.rotulo}?`}
          confirmacao={`desativação de ${desativando.rotulo}`}
          idempotente
          acao={() => desativarNumeroWhatsApp(desativando.id)}
          aoConcluir={() => concluido(`${desativando.rotulo} desativado.`)}
          aoCancelar={() => setDesativando(null)}
        >
          <p>
            {desativando.rotulo} ({desativando.telefoneE164}) é desconectado do WhatsApp e para de enviar e receber
            mensagens. Mensagens na fila ou agendadas por este número não saem: falham como remetente inativo.
          </p>
          <p>O número continua nesta lista; para voltar a usá-lo, clique em &quot;Ativar&quot; e conecte de novo.</p>
        </ConfirmarAcao>
      )}
      {excluindo && (
        <ConfirmarAcao
          titulo={`Excluir o número ${excluindo.rotulo}?`}
          confirmacao={`exclusão de ${excluindo.rotulo}`}
          idempotente
          acao={() => excluirNumeroWhatsApp(excluindo.id)}
          aoConcluir={() => concluido(`${excluindo.rotulo} excluído.`)}
          aoCancelar={() => setExcluindo(null)}
        >
          <p>
            {excluindo.rotulo} ({excluindo.telefoneE164}) é desconectado do WhatsApp, para de enviar e receber e sai
            desta tela. Mensagens na fila ou agendadas por este número não saem.
          </p>
          <p>
            Conversas, mensagens e o histórico continuam guardados. Para usar este telefone de novo, cadastre-o em
            &quot;Novo número&quot;: o cadastro antigo volta com o histórico.
          </p>
        </ConfirmarAcao>
      )}
      {qrDe && <QrModal numero={qrDe} onClose={() => { setQrDe(null); router.refresh(); }} />}
    </section>
  );
}

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
  const acao = useAcaoCliente({ idempotente: true });

  function alternar(s: Setor) {
    setSetores((atual) => (atual.includes(s) ? atual.filter((x) => x !== s) : SETORES.filter((x) => x === s || atual.includes(x))));
  }

  const elegiveis = responsaveis.filter((u) => podeTriarSetores(u.papeis, setores));
  const triagemValida = elegiveis.some((u) => u.id === triagem) ? triagem : "";
  const sujo = setoresAlterados(setores, setores.length >= 2 ? triagemValida : "", numero);
  useAvisoAoSair(sujo);

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
            <Switch checked={setores.includes(s)} onCheckedChange={() => alternar(s)} />
            {SETOR_ATENDIMENTO_LABEL[s]}
          </label>
        ))}
      </div>
      {setores.length >= 2 && (
        <label className="mt-3 block text-xs text-gray-600">
          Responsável pela triagem
          <CampoCombobox value={triagemValida} onChange={(e) => setTriagem(e.target.value)} className={inputCls + " mt-1 sm:max-w-xs"} vazio={"— Administrador —"} opcoes={elegiveis.map((u) => ({ valor: String(u.id), rotulo: u.nome }))} />
        </label>
      )}
      <div className="mt-3 flex items-center justify-end gap-3">
        <AlteracaoPendente sujo={sujo} />
        <button type="button" className={btnPri} disabled={acao.ocupado || setores.length === 0} onClick={salvar}>
          {acao.ocupado ? "Salvando…" : "Salvar setores"}
        </button>
      </div>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mt-3" />
    </div>
  );
}

function QrModal({ numero, onClose }: { numero: NumeroConfig; onClose: () => void }) {
  const [aba, setAba] = useState<"QR" | "Código">("QR");
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [telefone, setTelefone] = useState(numero.telefoneE164);
  const [estado, setEstado] = useState<string>(numero.sessao);
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
    const t = setTimeout(() => void pedirQr(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (estado === "CONECTADO") return;
    const t = setInterval(async () => {
      const d = await executarAcaoCliente(() => consultarSessaoNumero(numero.id), { idempotente: false });
      if (d.tipo !== "ok") return;
      setEstado(d.dado!.sessao);
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
