import React, { useEffect, useState } from 'react';
import { APPROVED_GAME_ART } from '../ui/gameArtwork';
import { INITIAL_PRODUCTS } from '../data/catalog';
import type { CraftedProduct, AdventuringParty } from '../types/game';
export function AssetToken({id,label,size=48}:{id:string;label:string;size?:number}) {
 const art=APPROVED_GAME_ART[id],[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[id]);
 return <span data-art-id={id} data-art-status={art&&!failed?'mapped':'unavailable'} title={art?.alt??`${label}: artwork unavailable`} className="inline-flex shrink-0 align-middle rounded-lg bg-[#F1E4C6] overflow-hidden items-center justify-center" style={{width:size,height:size}}>{art&&!failed?<img className="w-full h-full object-contain" src={art.src} alt={label} loading="lazy" onError={()=>setFailed(true)}/>:<span role="img" aria-label={`${label}: artwork unavailable`} className="text-slate-800 text-xs">?</span>}</span>;
}
export function ProductArtwork({product}:{product:CraftedProduct}) {
 const initial=INITIAL_PRODUCTS.find(p=>p.id===product.id),authored=initial&&initial.formulaSignature===product.formulaSignature&&JSON.stringify(initial.recipeComponents)===JSON.stringify(product.recipeComponents);
 return authored?<AssetToken id={product.id} label={product.name} size={80}/>:<div className="space-y-1" data-product-art="shared-composition"><AssetToken id={`product_category:${product.category}`} label={`${product.name}: shared category symbol`} size={64}/><div className="flex flex-wrap gap-1">{product.recipeComponents.map((id,i)=><AssetToken key={`${id}:${i}`} id={id} label={`Recipe component ${id}`} />)}</div><p className="text-xs text-slate-400">Shared category &amp; actual recipe symbols; no bespoke crafted portrait.</p></div>;
}
export function PartyPortraits({party}:{party:AdventuringParty}) {
 return <details><summary className="min-h-[48px] py-3 cursor-pointer">Meet {party.name}</summary><div className="space-y-3"><AssetToken id={party.id} label={`${party.name}: group overview`} size={208}/><div className="flex flex-wrap gap-3">{party.members.map((m,i)=><figure className="space-y-1 max-w-[12rem]" key={`${i}:${m.name}`}><AssetToken id={`member:${party.id}:${i}:${m.name}`} label={`${m.name}, ${m.role}`} size={80}/><figcaption className="text-sm">{m.name} · {m.role}</figcaption></figure>)}</div></div></details>;
}
