import { runRecoveryAutomation } from '@/lib/recovery-automation'
/** Legacy cron entry point shares the durable ledger and disabled-by-default settings. */
export type CartRunResult={candidates:number;sent:number;failed:number;dryRun:boolean;
  skipped:{consent:number;noEmail:number;empty:number;capped:number;tooSoon:number;blocked:number};unknown:number}
export async function runCartRecovery(options:{dryRun?:boolean}={}):Promise<CartRunResult>{
  const result=await runRecoveryAutomation({dryRun:options.dryRun ?? false,flow:'cart'})
  return {candidates:result.candidates,sent:result.sent,failed:result.failed,unknown:result.unknown,dryRun:result.dryRun,
    skipped:{consent:0,noEmail:0,empty:0,capped:0,tooSoon:0,blocked:result.skipped}}
}
