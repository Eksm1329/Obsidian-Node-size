/* Reproducible Node harness, not an Obsidian UI/battery benchmark. */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const BASELINE='289f73730eeb153cb2c27584bbea673ab450939c';

async function worker(bundle,n,tree,profile) {
 const timers=[];let virtualOffset=0;
 const host={setTimeout,clearTimeout,performance:{now:()=>performance.now()+virtualOffset},module:{exports:{}},exports:{},window:{setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}},
  require(name){assert.equal(name,'obsidian');return {Notice:class{constructor(message){throw Error(message);}},Plugin:class{},PluginSettingTab:class{},AbstractInputSuggest:class{}};}};
 vm.runInNewContext(fs.readFileSync(bundle,'utf8'),host);
 const Plugin=host.module.exports.default;
 const nodes=Array.from({length:n},(_,i)=>({id:`Topics/T${Math.floor(i/64)}/Note${i}.md`,weight:1,forward:{},reverse:{}}));
 const connect=(a,b)=>{if(a===b)return;nodes[a].forward[nodes[b].id]={target:nodes[b]};nodes[b].reverse[nodes[a].id]={};};
 for(let i=0;i<n;i++) {
  const start=Math.floor(i/64)*64,len=Math.min(64,n-start);
  connect(i,start+(i-start+1)%len);connect(i,start+(i-start+7)%len);connect(i,start+((i*17+11)%len));
  if(i%8===0)connect(i,start);
  if(i===start && Math.floor(i/64)%2===0 && start+64<n)connect(i,start+64);
 }
 const settings={manual:[],folders:[],exclusions:[],fwdMultiplier:1,bwdMultiplier:1,lettersPerWt:256,fwdTree:tree};
 for(let group=0;group<Math.ceil(n/64);group++)if(profile==='folders'||(profile==='mixed'&&group%5!==0))settings.folders.push({path:`Topics/T${group}`,weight:20,recursive:true});
 const sizes=new Map(nodes.map(node=>[node.id,4096]));let reads=0,redraws=0;
 const renderer={nodes,changed(){redraws++;}};
 const plugin=new Plugin();plugin.settings=settings;plugin.saveData=async()=>{};
 plugin.app={workspace:{getLeavesOfType:type=>type==='graph'?[{view:{renderer}}]:[]},vault:{getFileByPath(id){reads++;return {extension:'md',stat:{size:sizes.get(id)}};}}};
 let blocks=[];
 const measuredMethod=typeof plugin.pump==='function'?'pump':'recalculateSize';
 const measured=plugin[measuredMethod].bind(plugin);
 plugin[measuredMethod]=()=>{const begin=performance.now();const result=measured();blocks.push(performance.now()-begin);return result;};
 global.gc();const initialHeap=process.memoryUsage().heapUsed;
 const output=[];
 async function measure(scenario,action,calls) {
  global.gc();const before=process.memoryUsage().heapUsed;blocks=[];const initialReads=reads,initialRedraws=redraws;
  const begin=performance.now();await action();const elapsed=performance.now()-begin;
  const after=process.memoryUsage().heapUsed;global.gc();const retained=process.memoryUsage().heapUsed;
  output.push({scenario,calls,totalMs:elapsed,maxSyncMs:Math.max(0,...blocks),cpuMs:blocks.reduce((a,b)=>a+b,0),slices:blocks.length,heapGrowthMiB:(after-before)/1048576,
   retainedPluginMiB:(retained-initialHeap)/1048576,processPeakRssMiB:process.resourceUsage().maxRSS/1024,
   contentReads:reads-initialReads,redraws:redraws-initialRedraws,
   digest:crypto.createHash('sha256').update(JSON.stringify(nodes.map(node=>[node.id,node.weight]))).digest('hex')});
 }
 await measure('first',()=>plugin.recalculateSize(),1);
 await measure('idle',async()=>{for(let i=0;i<10;i++){virtualOffset+=2000;await plugin.recalculateSize();}},10);
 await measure('note-edit',async()=>{const id=nodes[1].id;sizes.set(id,8192);plugin.invalidate(id);while(timers.length)timers.shift()();if(plugin.whenIdle)await plugin.whenIdle();},1);
 await measure('folder-edit',()=>{const rule=settings.folders.find(rule=>rule.path==='Topics/T0');if(rule)rule.weight=80;else settings.folders.push({path:'Topics/T0',weight:80,recursive:true});return plugin.saveSettings();},1);
 // Link edits exercise cache correctness in both modes (including exact tree ancestors).
 await measure('link-edit',()=>{const target=Math.min(n-1,128);connect(1,target);return plugin.recalculateSize();},1);
 plugin.onunload();assert.ok(nodes.every(node=>node.weight===1),'unload must restore original weights');
 return output;
}

async function main() {
 if(process.argv[2]==='--worker'){const [, , ,bundle,n,tree,profile]=process.argv;console.log(JSON.stringify(await worker(bundle,Number(n),tree==='tree',profile)));return;}
 const esbuild=require('esbuild');const repo=path.resolve(__dirname,'..');const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'node-size-bench-'));
 const baseline=path.join(scratch,'baseline');fs.mkdirSync(baseline);
 const archive=execFileSync('git',['archive',BASELINE],{cwd:repo,maxBuffer:16*1024*1024});
 execFileSync('tar',['-x','-C',baseline],{input:archive});
 const builds={before:baseline,after:repo};
 const rows=[];const repeats=Number(process.env.BENCH_REPEATS||3);
 try {
  for(const [version,root] of Object.entries(builds))esbuild.buildSync({entryPoints:[path.join(root,'src/main.ts')],tsconfig:path.join(root,'tsconfig.json'),bundle:true,format:'cjs',platform:'browser',external:['obsidian'],nodePaths:[path.join(repo,'node_modules')],outfile:path.join(scratch,version+'.cjs')});
  for(const n of [1000,5000,10000])for(const mode of ['normal','tree'])for(const profile of ['folders','mixed','automatic']) {
   for(let repeat=0;repeat<repeats;repeat++) {
    const results={};
    // Alternate ordering to reduce warm-machine bias; each measurement has its own process.
    for(const version of repeat%2?['after','before']:['before','after']) {
     results[version]=JSON.parse(execFileSync(process.execPath,['--expose-gc',__filename,'--worker',path.join(scratch,version+'.cjs'),String(n),mode,profile],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:180000}));
     for(const row of results[version])rows.push({n,mode,profile,repeat,version,...row});
    }
    assert.deepEqual(results.before.map(r=>r.digest),results.after.map(r=>r.digest),`${n}/${mode}/${profile}: weights differ`);
   }
   console.log(`Verified ${n} nodes / ${mode} / ${profile}`);
  }
  const report={baseline:BASELINE,afterSourceHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(scratch,'after.cjs'))).digest('hex'),node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,repeats,rows};
  fs.mkdirSync(path.join(repo,'benchmarks'),{recursive:true});fs.writeFileSync(path.join(repo,'benchmarks/graphs.json'),JSON.stringify(report,null,2)+'\n');
 } finally {fs.rmSync(scratch,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
