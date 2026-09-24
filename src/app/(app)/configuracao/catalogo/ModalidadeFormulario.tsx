"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Segmento } from "@prisma/client";
import { ModalidadeSchema, type ModalidadeInput } from "@/server/catalogo/schema";
import { criarModalidade, editarModalidade } from "@/server/catalogo/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

const SEGMENTOS: { value: Segmento; label: string }[] = [
  { value: Segmento.ADULTO, label: "Adulto" },
  { value: Segmento.KIDS, label: "Kids" },
  { value: Segmento.TEENS, label: "Teens" },
  { value: Segmento.EMPRESA, label: "Empresa" },
];

export interface ModalidadeParaEditar {
  id: string;
  nome: string;
  segmento: Segmento;
  frequencia: string;
  horasAula: number;
  duracaoPorNivel: string;
  aulasPorNivel: number | null;
  minimoAbrir: number;
}

export function ModalidadeFormulario({
  modalidade,
  onClose,
}: {
  modalidade?: ModalidadeParaEditar;
  onClose: () => void;
}) {
  const router = useRouter();
  // Sem chave de idempotência: criarModalidade cria outro registro a cada chamada — a falha de rede
  // manda conferir a página antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ModalidadeInput>({
    resolver: zodResolver(ModalidadeSchema),
    defaultValues: modalidade ?? {
      nome: "",
      segmento: Segmento.ADULTO,
      frequencia: "",
      horasAula: 2,
      duracaoPorNivel: "",
      aulasPorNivel: null,
      minimoAbrir: 1,
    },
  });

  async function onSubmit(data: ModalidadeInput) {
    const d = await acao.executar<unknown>(() => modalidade
      ? editarModalidade(modalidade.id, data)
      : criarModalidade(data));
    if (d?.tipo !== "ok") return;
    router.refresh();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-gray-200 bg-surface p-5">
      <h3 className="mb-4 text-sm font-medium">
        {modalidade ? `Editar modalidade — ${modalidade.nome}` : "Nova modalidade"}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="modalidade-nome">Nome</label>
          <input id="modalidade-nome" {...register("nome")} placeholder="Regular" className={inputCls} aria-invalid={errors.nome ? true : undefined} aria-describedby={errors.nome ? "modalidade-nome-erro" : undefined} />
          {errors.nome && <p id="modalidade-nome-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.nome.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="modalidade-segmento">Segmento</label>
          <select id="modalidade-segmento" {...register("segmento")} className={inputCls}>
            {SEGMENTOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="modalidade-frequencia">Frequência</label>
          <input id="modalidade-frequencia" {...register("frequencia")} placeholder="1x/semana" className={inputCls} aria-invalid={errors.frequencia ? true : undefined} aria-describedby={errors.frequencia ? "modalidade-frequencia-erro" : undefined} />
          {errors.frequencia && (
            <p id="modalidade-frequencia-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.frequencia.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="modalidade-horas-aula">Horas/aula</label>
          <input id="modalidade-horas-aula" type="number" step="0.5" {...register("horasAula")} className={inputCls} aria-invalid={errors.horasAula ? true : undefined} aria-describedby={errors.horasAula ? "modalidade-horas-aula-erro" : undefined} />
          {errors.horasAula && (
            <p id="modalidade-horas-aula-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.horasAula.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="modalidade-duracao-por-nivel">Duração por nível</label>
          <input id="modalidade-duracao-por-nivel" {...register("duracaoPorNivel")} placeholder="3 meses" className={inputCls} aria-invalid={errors.duracaoPorNivel ? true : undefined} aria-describedby={errors.duracaoPorNivel ? "modalidade-duracao-por-nivel-erro" : undefined} />
          {errors.duracaoPorNivel && (
            <p id="modalidade-duracao-por-nivel-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.duracaoPorNivel.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="modalidade-aulas-por-nivel">Aulas por nível (opcional)</label>
          <input id="modalidade-aulas-por-nivel" type="number" {...register("aulasPorNivel")} placeholder="12" className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600" htmlFor="modalidade-minimo-abrir">Mínimo para abrir</label>
          <input id="modalidade-minimo-abrir" type="number" {...register("minimoAbrir")} className={inputCls} aria-invalid={errors.minimoAbrir ? true : undefined} aria-describedby={errors.minimoAbrir ? "modalidade-minimo-abrir-erro" : undefined} />
          {errors.minimoAbrir && (
            <p id="modalidade-minimo-abrir-erro" role="alert" className="mt-1 text-xs text-red-600">{errors.minimoAbrir.message}</p>
          )}
        </div>
      </div>

      <FeedbackAcao erro={acao.erro} className="mt-4" />

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={acao.ocupado}
          className="rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
        >
          {acao.ocupado ? "Salvando…" : "Salvar modalidade"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
