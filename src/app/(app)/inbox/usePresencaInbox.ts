"use client";
import {useCallback,useEffect} from "react";
import {montarPresencaInbox,interagirPresencaInbox} from "@/lib/presenca-inbox-cliente";
/** React capture também recebe eventos dos portais desta árvore; nenhum conteúdo é coletado. */
export function usePresencaInbox(usuarioId:string){
 useEffect(()=>montarPresencaInbox(usuarioId),[usuarioId]);
 return useCallback((e:{isTrusted:boolean})=>{if(e.isTrusted&&document.visibilityState==="visible")interagirPresencaInbox();},[]);
}
