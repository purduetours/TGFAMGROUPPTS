import {handle} from '../worker.mjs';
import {supabaseLedger} from '../supabase.mjs';

export function onRequest(context){
 return handle(context.request,{...context.env,ASSETS:{fetch:()=>context.next()}},supabaseLedger(context.env));
}
