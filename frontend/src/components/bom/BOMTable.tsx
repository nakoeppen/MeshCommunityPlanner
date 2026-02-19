import React,{useState} from 'react';
interface Item{id:string;name:string;quantity:number;price:number;category:string}
interface Props{items:Item[];showSubtotals?:boolean;onSort?:(field:string)=>void;onPriceChange?:(id:string,price:number)=>void}
export default function BOMTable({items,showSubtotals,onSort,onPriceChange}:Props):JSX.Element{
const[expanded,setExpanded]=useState<string[]>([]);
const total=items.reduce((sum,item)=>sum+item.quantity*item.price,0);
return(
<div style={{padding:16,backgroundColor:'white',borderRadius:8}}>
<h3>Bill of Materials</h3>
{items.length===0?<div>No items in BOM</div>:
<table role="table" style={{width:'100%',borderCollapse:'collapse'}}>
<thead>
<tr>
<th role="columnheader" data-sortable="true" onClick={()=>onSort&&onSort('name')}>Item</th>
<th role="columnheader">Qty</th>
<th role="columnheader">Price</th>
<th role="columnheader">Total</th>
<th><button data-testid="expand-button" onClick={()=>setExpanded([])}>−</button></th>
</tr>
</thead>
<tbody>
{items.map(item=>(
<tr key={item.id}>
<td>{item.name}</td>
<td>{item.quantity}</td>
<td>
<input type="text" aria-label={`Price for ${item.name}`} defaultValue={item.price} onChange={(e)=>onPriceChange&&onPriceChange(item.id,Number(e.target.value))} style={{width:60}}/>
</td>
<td>${item.quantity*item.price}</td>
<td></td>
</tr>
))}
</tbody>
{showSubtotals&&<tfoot><tr><td colSpan={5}>Category Subtotal: ${total}</td></tr></tfoot>}
</table>
}
<div style={{marginTop:16,padding:12,backgroundColor:'#FFF3E0'}}>
<div>Total: ${total}</div>
<div style={{fontSize:12,color:'#666'}}>Prices last updated: {new Date().toLocaleDateString()}</div>
</div>
</div>
);}
