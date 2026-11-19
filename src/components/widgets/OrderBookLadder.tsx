import React, { useMemo } from 'react';
import { useOrderFlowStore } from '../../stores/orderFlowStore';
import { FeedState } from '../../types/orderFlow';

const LEVELS = 20;
const fmtP = (p: number) => p.toFixed(p >= 100 ? 0 : p >= 1 ? 2 : 4);
const fmtQ = (q: number) => q >= 1e3 ? (q/1e3).toFixed(1)+'k' : q.toFixed(2);

const feedColor: Record<FeedState,string> = {
  LIVE:'var(--ot-profit)', CONNECTING:'var(--ot-amber)', RECONNECTING:'var(--ot-amber)',
  DELAYED:'var(--ot-amber)', STALE:'var(--ot-amber)', DISCONNECTED:'var(--ot-loss)',
  ERROR:'var(--ot-loss)', UNSUPPORTED:'var(--ot-text-muted)'
};

const FeedBadge = ({s}:{s:FeedState}) => <span style={{background:feedColor[s],color:'var(--ot-bg-root)',padding:'2px 6px',borderRadius:4,fontSize:10,fontWeight:600,textTransform:'uppercase'}}>{s}</span>;
const Skeleton = () => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:8,padding:'6px 0',opacity:.5}}><div style={{height:16,background:'var(--ot-border)',borderRadius:4}}/><div style={{height:16,background:'var(--ot-border)',borderRadius:4,width:'60%'}}/><div style={{height:8,background:'var(--ot-border)',borderRadius:4}}/></div>;

const LevelRow = ({p,q,c,m,b}:{p:number;q:number;c:number;m:number;b:boolean}) => {
  const s = Math.min(c/m,1);
  return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:8,alignItems:'center',padding:'4px 0',fontSize:12,fontVariantNumeric:'tabular-nums',color:b?'var(--ot-profit)':'var(--ot-loss)'}}><span style={{textAlign:'right'}}>{fmtP(p)}</span><span style={{textAlign:'right'}}>{fmtQ(q)}</span><div style={{position:'relative',height:8}}><div style={{position:'absolute',inset:0,background:b?'linear-gradient(90deg,var(--ot-profit),var(--ot-profit)/0)':'linear-gradient(90deg,var(--ot-loss),var(--ot-loss)/0)',borderRadius:4,transformOrigin:b?'right':'left',transform:`scaleX(${s})`,transition:'transform 100ms linear',willChange:'transform'}}/></div></div>;
};

export const OrderBookLadder = () => {
  const {depth,feedStates} = useOrderFlowStore();
  const bids = useMemo(()=>depth?.bids.slice(0,LEVELS).reverse()??[],[depth]);
  const asks = useMemo(()=>depth?.asks.slice(0,LEVELS)??[],[depth]);
  const maxB = useMemo(()=>bids.reduce((a,b)=>a+b.qty,0)||1,[bids]);
  const maxA = useMemo(()=>asks.reduce((a,b)=>a+b.qty,0)||1,[asks]);
  const spread = depth?((asks[0]?.price??0)-(bids[0]?.price??0)).toFixed(2):'—';
  const fs = Object.values(feedStates)[0]??'DISCONNECTED';

  if(!depth) return <div style={{padding:16,display:'flex',flexDirection:'column',gap:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontWeight:600,fontSize:13}}>Order Book</span><FeedBadge s={fs}/></div><div style={{display:'flex',flexDirection:'column',gap:4}}>{[...Array(LEVELS)].map((_,i)=><Skeleton key={i}/>)}</div></div>;

  let bc=0,ac=0;
  return <div style={{padding:16,display:'flex',flexDirection:'column',gap:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontWeight:600,fontSize:13}}>Order Book</span><FeedBadge s={fs}/></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,fontSize:12}}><div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:8,paddingBottom:6,fontSize:10,textTransform:'uppercase',color:'var(--ot-text-muted)',fontWeight:600}}><span style={{textAlign:'right'}}><b>BIDS</b></span><span style={{textAlign:'right'}}><b>QTY</b></span><b>CUM</b></div><div style={{display:'flex',flexDirection:'column'}}>{bids.map(x=>{bc+=x.qty;return <LevelRow key={x.p} p={x.p} q={x.q} c={bc} m={maxB} b/>})}</div></div><div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:8,paddingBottom:6,fontSize:10,textTransform:'uppercase',color:'var(--ot-text-muted)',fontWeight:600}}><b>ASKS</b><b>QTY</b><b>CUM</b></div><div style={{display:'flex',flexDirection:'column'}}>{asks.map(x=>{ac+=x.qty;return <LevelRow key={x.p} p={x.p} q={x.q} c={ac} m={maxA} b={false}/>})}</div></div></div><div style={{display:'flex',justifyContent:'center',paddingTop:8,fontSize:11,color:'var(--ot-text-muted)',fontVariantNumeric:'tabular-nums'}}><b>Spread:</b> {spread}</div></div>;
};
