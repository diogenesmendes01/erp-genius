import { IconBolt, IconBook, IconCamera, IconFileCheck, IconFileText, IconListCheck, IconMapPin, IconMicrophone, IconPhoto, IconUser, type TablerIcon } from "@tabler/icons-react";
import type { RecursoMotor } from "./recursos-canal";

export type IdItemAnexo = "documento" | "midia" | "camera" | "audio" | "localizacao" | "contato" | "enquete" | "proposta" | "catalogo" | "resposta";
export interface ItemAnexo { readonly id: IdItemAnexo; readonly rotulo: string; readonly icone: TablerIcon; readonly classeIcone: string; readonly recurso?: RecursoMotor }
export const ITENS_ANEXO: readonly ItemAnexo[] = Object.freeze([
 { id: "documento", rotulo: "Documento", icone: IconFileText, classeIcone: "bg-blue-100 text-blue-700" },
 { id: "midia", rotulo: "Fotos e vídeos", icone: IconPhoto, classeIcone: "bg-ai-100 text-ai-700" },
 { id: "camera", rotulo: "Câmera", icone: IconCamera, classeIcone: "bg-red-100 text-red-700" },
 { id: "audio", rotulo: "Áudio", icone: IconMicrophone, classeIcone: "bg-red-100 text-red-700" },
 { id: "localizacao", rotulo: "Localização", icone: IconMapPin, classeIcone: "bg-green-100 text-green-700", recurso: "localizacao" },
 { id: "contato", rotulo: "Contato", icone: IconUser, classeIcone: "bg-blue-100 text-blue-700", recurso: "cartaoContato" },
 { id: "enquete", rotulo: "Enquete", icone: IconListCheck, classeIcone: "bg-orange-100 text-orange-700", recurso: "enquete" },
 { id: "proposta", rotulo: "Proposta", icone: IconFileCheck, classeIcone: "bg-green-100 text-green-700" },
 { id: "catalogo", rotulo: "Catálogo", icone: IconBook, classeIcone: "bg-orange-100 text-orange-700" },
 { id: "resposta", rotulo: "Resposta rápida", icone: IconBolt, classeIcone: "bg-ai-100 text-ai-700" },
]);