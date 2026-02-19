import React from 'react';
interface Props{onExport:(format:string)=>void;loading?:boolean;error?:string;success?:boolean}
export default function BOMExport({onExport,loading,error,success}:Props):JSX.Element{
return(
<div style={{padding:16,display:'flex',gap:12,alignItems:'center'}}>
<button role="button" aria-label="Export as CSV" onClick={()=>onExport('csv')} disabled={loading} style={{padding:'8px 16px',backgroundColor:'#4CAF50',color:'white',border:'none',borderRadius:4}}>CSV</button>
<button role="button" aria-label="Export as PDF" onClick={()=>onExport('pdf')} disabled={loading} style={{padding:'8px 16px',backgroundColor:'#2196F3',color:'white',border:'none',borderRadius:4}}>PDF</button>
<button role="button" aria-label="Export deployment cards" onClick={()=>onExport('cards')} disabled={loading} style={{padding:'8px 16px',backgroundColor:'#FF9800',color:'white',border:'none',borderRadius:4}}>Cards</button>
{loading&&<div data-testid="progress">Exporting...</div>}
{error&&<div style={{color:'#F44336'}}>{error}</div>}
{success&&<div style={{color:'#4CAF50'}}>Export successful!</div>}
</div>
);}
