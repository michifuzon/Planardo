"use client";

import { Check, Minus, Plus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const STAGE = 260;

export default function AvatarCropper({file,onCancel,onConfirm}:{file:File;onCancel:()=>void;onConfirm:(file:File)=>void}){
  const [zoom,setZoom]=useState(1);
  const [offsetX,setOffsetX]=useState(0);
  const [offsetY,setOffsetY]=useState(0);
  const [natural,setNatural]=useState<{w:number;h:number}|null>(null);
  const [saving,setSaving]=useState(false);
  const url=useMemo(()=>URL.createObjectURL(file),[file]);
  const stageRef=useRef<HTMLDivElement>(null);
  const drag=useRef<{x:number;y:number;offX:number;offY:number}|null>(null);

  const cover=natural?Math.max(STAGE/natural.w,STAGE/natural.h):0;
  const dispW=natural?natural.w*cover*zoom:STAGE;
  const dispH=natural?natural.h*cover*zoom:STAGE;
  const maxPanX=Math.max(0,(dispW-STAGE)/2);
  const maxPanY=Math.max(0,(dispH-STAGE)/2);
  const pxX=(offsetX/100)*maxPanX;
  const pxY=(offsetY/100)*maxPanY;

  function clamp(v:number){return Math.max(-100,Math.min(100,v))}

  function onPointerDown(e:React.PointerEvent){
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current={x:e.clientX,y:e.clientY,offX:offsetX,offY:offsetY};
  }
  function onPointerMove(e:React.PointerEvent){
    if(!drag.current)return;
    const dx=e.clientX-drag.current.x, dy=e.clientY-drag.current.y;
    setOffsetX(clamp(drag.current.offX+(maxPanX?(dx/maxPanX)*100:0)));
    setOffsetY(clamp(drag.current.offY+(maxPanY?(dy/maxPanY)*100:0)));
  }
  function onPointerUp(){drag.current=null}

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
      <div className="crop-head"><div><p className="eyebrow">FOTO DE PERFIL</p><h2>Acomodá tu foto</h2></div><button onClick={onCancel}><X/></button></div>
      <p className="crop-hint">Arrastrá la foto para ubicarla dentro del círculo</p>
      <div
        className="crop-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={url}
          alt="Vista previa"
          draggable={false}
          onLoad={(e)=>setNatural({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})}
          style={{width:dispW,height:dispH,transform:`translate(-50%,-50%) translate(${pxX}px,${pxY}px)`}}
        />
      </div>
      <div className="crop-control"><Minus size={16}/><input aria-label="Zoom" type="range" min="1" max="3" step=".01" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><Plus size={16}/></div>
      <button className="create-submit crop-save" disabled={saving} onClick={()=>void crop()}>{saving?"Preparando…":<><Check/> Usar esta foto</>}</button>
    </div>
  </div>
}
