"use client";
import {useCallback,useEffect} from "react";
import {montarPresencaInbox,interagirPresencaInbox} from "@/lib/presenca-inbox-cliente";
export function usePresencaInbox(usuarioId:string){
 useEffect(()=>montarPresencaInbox(usuarioId),[usuarioId]);
 return useCallback((e:{isTrusted:boolean})=>{if(e.isTrusted&&document.visibilityState==="visible")interagirPresencaInbox();},[]);
}
