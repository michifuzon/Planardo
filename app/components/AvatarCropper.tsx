"use client";

import { Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function AvatarCropper({file,onCancel,onConfirm}:{file:File;onCancel:()=>void;onConfirm:(file:File)=>void}){
  const [zoom,setZoom]=useState(1);
  const [offsetX,setOffsetX]=useState(0);
  const [offsetY,setOffsetY]=useState(0);
  const [saving,setSaving]=useState(false);
  const url=useMemo(()=>URL.createObjectURL(file),[file]);
  useEffect(()=>()=>URL.revokeObjectURL(url),[url]);

  async function crop(){
    setSaving(true);
    const img=new Image();
    img.src=url;
    await img.decode();
    const size=512;
    const canvas=document.createElement("canvas");
    canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("No se pudo preparar la imagen");
    const scale=Math.max(size/img.naturalWidth,size/img.naturalHeight)*zoom;
    const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
    const maxX=Math.max(0,(width-size)/2),maxY=Math.max(0,(height-size)/2);
    const x=(size-width)/2+(offsetX/100)*maxX;
    const y=(size-height)/2+(offsetY/100)*maxY;
    ctx.drawImage(img,x,y,width,height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",.9));
    if(!blob)throw new Error("No se pudo recortar la imagen");
    onConfirm(new File([blob],"avatar.webp",{type:"image/webp"}));
    setSaving(false);
  }

  return <div className="modal-backdrop crop-backdrop">
    <div className="crop-modal edge">
      <div className="crop-head"><div><p className="eyebrow">FOTO DE PERFIL</p><h2>Ajustá tu foto</h2></div><button onClick={onCancel}><X/></button></div>
      <div className="crop-stage">
        <img src={url} alt="Vista previa" style={{transform:`translate(${offsetX/2}%,${offsetY/2}%) scale(${zoom})`}}/>
        <span className="crop-mask"/>
      </div>
      <div className="crop-control"><Minus/><input aria-label="Zoom" type="range" min="1" max="3" step=".01" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><Plus/></div>
      <label className="crop-axis"><span>Horizontal</span><input type="range" min="-100" max="100" value={offsetX} onChange={e=>setOffsetX(Number(e.target.value))}/></label>
      <label className="crop-axis"><span>Vertical</span><input type="range" min="-100" max="100" value={offsetY} onChange={e=>setOffsetY(Number(e.target.value))}/></label>
      <button className="create-submit crop-save" disabled={saving} onClick={()=>void crop()}>{saving?"Preparando…":<><Check/> Usar esta foto</>}</button>
    </div>
  </div>
}
