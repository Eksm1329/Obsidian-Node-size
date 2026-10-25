const {test} = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const vm = require('node:vm');
const bundle = esbuild.buildSync({entryPoints:['src/rules.ts'], bundle:true, format:'cjs', platform:'node', write:false});
const sandbox = {module:{exports:{}},exports:{}};
vm.runInNewContext(bundle.outputFiles[0].text,sandbox);
const {ruleWeight,matchesFolder,movedPath} = sandbox.module.exports;
const settings = () => ({manual:[], exclusions:[], folders:[{path:'Work',weight:20,recursive:true},{path:'Work/Sub',weight:40,recursive:true}]});
test('all notes including future notes inherit folder rule',async()=>{for(const name of ['A','B','New']) assert.equal(ruleWeight(`Work/${name}.md`,settings()),20);});
test('deepest rule wins regardless of rule order',async()=>{const s=settings();s.folders.reverse();assert.equal(ruleWeight('Work/Sub/A.md',s),40);});
test('folder boundary prevents prefix collisions',()=>assert.equal(ruleWeight('Workshop/A.md',settings()),undefined));
test('non-recursive rule only matches direct children',async()=>{assert.equal(matchesFolder('Work/Sub/A.md','Work',false),false);assert.equal(matchesFolder('Work/A.md','Work',false),true);});
test('root rule and deeper folder precedence',async()=>{const s=settings();s.folders.push({path:'/',weight:5,recursive:true});assert.equal(ruleWeight('A.md',s),5);assert.equal(ruleWeight('Work/A.md',s),20);});
test('manual zero is an override even for excluded notes',async()=>{const s=settings();s.exclusions=['Work/A.md'];s.manual=[{id:'Work/A.md',weight:0}];assert.equal(ruleWeight('Work/A.md',s),0);});
test('excluded notes return to automatic calculation',async()=>{const s=settings();s.exclusions=['Work/A.md'];assert.equal(ruleWeight('Work/A.md',s),undefined);});
test('rename moves descendants but not similarly named siblings',async()=>{assert.equal(movedPath('Work/Sub/A.md','Work','New'),'New/Sub/A.md');assert.equal(movedPath('Workshop/A.md','Work','New'),'Workshop/A.md');assert.equal(movedPath('Work','Work','New'),'New');});
test('removing child rule falls back to parent',async()=>{const s=settings();s.folders.pop();assert.equal(ruleWeight('Work/Sub/A.md',s),20);});
const mainBundle = esbuild.buildSync({entryPoints:['src/main.ts'],bundle:true,format:'cjs',platform:'browser',external:['obsidian'],write:false});
const host={setTimeout,clearTimeout,performance,window:{setTimeout,clearTimeout},module:{exports:{}},exports:{},require:(name)=>{assert.equal(name,'obsidian');return {Notice:class {},Plugin:class {},PluginSettingTab:class {},AbstractInputSuggest:class {}};}};
vm.runInNewContext(mainBundle.outputFiles[0].text,host);
const Plugin=host.module.exports.default;
test('global and local graphs update; new nodes inherit; unload restores weights',async()=>{
 const plugin=new Plugin();plugin.settings={...settings(),fwdMultiplier:1,bwdMultiplier:1,lettersPerWt:0,fwdTree:false};
 const node=id=>({id,weight:7,forward:{},reverse:{}});
 const global={nodes:[node('Work/A.md')],changed(){this.redraws=(this.redraws||0)+1;}};
 const local={nodes:[node('Work/Sub/B.md')],changed(){this.redraws=(this.redraws||0)+1;}};
 plugin.app={workspace:{getLeavesOfType:type=>[{view:{renderer:type==='graph'?global:local}}]},vault:{}};
 await plugin.recalculateSize();assert.equal(global.nodes[0].weight,20);assert.equal(local.nodes[0].weight,40);assert.equal(global.redraws,1);
 global.nodes.push(node('Work/New.md'));await plugin.recalculateSize();assert.equal(global.nodes[1].weight,20);
 plugin.onunload();assert.equal(global.nodes[0].weight,7);assert.equal(local.nodes[0].weight,7);assert.equal(global.nodes[1].weight,7);
});
test('closed or uninitialized graph views are safe',async()=>{const plugin=new Plugin();plugin.settings=settings();plugin.app={workspace:{getLeavesOfType:()=>[{view:{}},{view:{renderer:{}}}]}};assert.doesNotThrow(()=>plugin.recalculateSize());});
function fixture() {
 host.window ??= {setTimeout,clearTimeout};
 const plugin=new Plugin();
 plugin.settings={...settings(),fwdMultiplier:1,bwdMultiplier:1,lettersPerWt:1,fwdTree:false};
 let reads=0;
 const node={id:'Other/A.md',weight:7,forward:{},reverse:{}};
 const renderer={nodes:[node],changed(){this.redraws=(this.redraws||0)+1;}};
 plugin.app={workspace:{getLeavesOfType:type=>type==='graph'?[{view:{renderer}}]:[]},vault:{getFileByPath(){reads++;return {extension:'md',stat:{size:10}};}}};
 return {plugin,node,renderer,reads:()=>reads};
}
test('unchanged fallback checks reuse calculated weights and avoid redraws',async()=>{
 const f=fixture();await f.plugin.recalculateSize();await f.plugin.recalculateSize();await f.plugin.recalculateSize();
 assert.equal(f.reads(),1);assert.equal(f.renderer.redraws,1);
});
test('replacement nodes with identical topology receive cached weights',async()=>{
 const f=fixture();await f.plugin.recalculateSize();f.renderer.nodes=[{...f.node,weight:3}];await f.plugin.recalculateSize();
 assert.equal(f.reads(),1);assert.equal(f.renderer.nodes[0].weight,10);
 f.plugin.onunload();assert.equal(f.renderer.nodes[0].weight,3);
});
test('in-place link edits invalidate topology cache',async()=>{
 const f=fixture();await f.plugin.recalculateSize();f.node.reverse['B.md']={};await f.plugin.recalculateSize();
 assert.equal(f.reads(),2);assert.equal(f.node.weight,11);
});
test('saved settings invalidate cached weights',async()=>{
 const f=fixture();f.plugin.saveData=async()=>{};await f.plugin.recalculateSize();
 f.plugin.settings.manual.push({id:f.node.id,weight:50});await f.plugin.saveSettings();assert.equal(f.node.weight,50);
});
test('malformed renderer nodes are skipped without writes or repeated errors',async()=>{
 const f=fixture();f.renderer.nodes.push({id:'invalid'});
 assert.doesNotThrow(()=>f.plugin.recalculateSize());assert.equal(f.node.weight,7);
 assert.doesNotThrow(()=>f.plugin.recalculateSize());assert.equal(f.reads(),0);
});
test('redraw failure restores changed weights and quarantines renderer',async()=>{
 const f=fixture();let calls=0;f.renderer.changed=()=>{calls++;throw Error('API changed');};
 await f.plugin.recalculateSize();assert.equal(f.node.weight,7);
 await f.plugin.recalculateSize();assert.equal(calls,1);assert.doesNotThrow(()=>f.plugin.onunload());
});
test('background checks do no graph work and resume on next check',async()=>{
 const f=fixture();host.document={hidden:true};
 try {await f.plugin.recalculateSize();assert.equal(f.reads(),0);host.document.hidden=false;await f.plugin.recalculateSize();assert.equal(f.reads(),1);} finally {delete host.document;}
});
test('deep cyclic link graphs use iterative traversal without stack overflow',async()=>{
 const f=fixture();f.plugin.settings.fwdTree=true;f.plugin.settings.lettersPerWt=0;
 let last=f.node;
 for(let i=0;i<12000;i++){const child={id:`chain/${i}.md`,weight:1,forward:{},reverse:{}};last.forward[child.id]={target:child};last=child;}
 last.forward[f.node.id]={target:f.node};await f.plugin.recalculateSize();assert.equal(f.node.weight,12000);
});
test('vault event bursts coalesce and invalidate content-based weights',async()=>{
 const f=fixture();let scheduled=0,callback;
 host.window={setTimeout(fn){scheduled++;callback=fn;return scheduled;},clearTimeout(){}};
 try {
  await f.plugin.recalculateSize();
  f.plugin.invalidate();f.plugin.invalidate();f.plugin.invalidate();
  assert.equal(scheduled,1);assert.equal(f.reads(),1);
  callback();await f.plugin.whenIdle();assert.equal(f.reads(),2);
 } finally {delete host.window;}
});
test('unload cancels queued graph updates',async()=>{
 const f=fixture();let callback,cancelled;
 host.window={setTimeout(fn){callback=fn;return 42;},clearTimeout(id){cancelled=id;}};
 try {f.plugin.schedule();f.plugin.onunload();assert.equal(cancelled,42);callback();assert.equal(f.reads(),0);} finally {delete host.window;}
});
const settingsBundle=esbuild.buildSync({entryPoints:['src/settings-data.ts'],bundle:true,format:'cjs',platform:'browser',write:false});
const settingsHost={module:{exports:{}},exports:{}};
vm.runInNewContext(settingsBundle.outputFiles[0].text,settingsHost);
const {readSettings}=settingsHost.module.exports;
test('invalid and unknown saved values cannot poison settings',async()=>{
 const s=readSettings(JSON.parse('{"__proto__":{"polluted":true},"fwdMultiplier":-1,"lettersPerWt":"10","manual":{},"folders":[null,{"path":"Work","weight":-10}],"exclusions":[3,null,"Work/A.md"]}'));
 assert.equal(s.fwdMultiplier,1);assert.equal(s.lettersPerWt,0);assert.equal(s.manual.length,0);assert.equal(s.folders.length,0);
 assert.equal(s.exclusions.length,1);assert.equal(s.polluted,undefined);assert.equal(Object.prototype.polluted,undefined);
});
test('valid legacy settings survive normalization with independent snapshots',async()=>{
 const original={...settings(),fwdTree:true,fwdMultiplier:2,manual:[{id:'Work/A.md',weight:0}]};
 const a=readSettings(original),b=readSettings(original);a.folders[0].weight=99;
 assert.equal(b.folders[0].weight,20);assert.equal(b.manual[0].weight,0);assert.equal(b.fwdTree,true);
});
test('unreadable settings stop loading and cannot be overwritten',async()=>{
 const p=new Plugin();let writes=0;p.loadData=async()=>{throw Error('invalid JSON');};p.saveData=async()=>{writes++;};
 await p.loadSettings();await p.saveSettings();assert.equal(writes,0);assert.equal(p.stopped,true);
});
test('concurrent saves preserve order and snapshot each edit',async()=>{
 const f=fixture();const saved=[];let release;
 f.plugin.saveData=async value=>{saved.push(value);if(saved.length===1) await new Promise(resolve=>{release=resolve;});};
 f.plugin.settings.fwdMultiplier=2;const first=f.plugin.saveSettings();
 f.plugin.settings.fwdMultiplier=3;const second=f.plugin.saveSettings();
 await Promise.resolve();assert.equal(saved.length,1);assert.equal(saved[0].fwdMultiplier,2);
 release();await Promise.all([first,second]);assert.equal(saved[1].fwdMultiplier,3);
});
test('failed save is handled and does not prevent later successful save',async()=>{
 const f=fixture();let calls=0;f.plugin.saveData=async()=>{if(++calls===1)throw Error('disk full');};
 await f.plugin.saveSettings();assert.equal(f.plugin.writeFailed,true);
 await f.plugin.saveSettings();assert.equal(calls,2);assert.equal(f.plugin.writeFailed,false);
});
test('indexed rules preserve precedence across thousands of sibling folders',async()=>{
 const s=settings();for(let i=0;i<10000;i++)s.folders.push({path:`Many/F${i}`,recursive:true,weight:i%100});
 const index=new sandbox.module.exports.RuleIndex(s);
 for(let i=0;i<10000;i++)assert.equal(index.weight(`Many/F${i}/Nested/A.md`),i%100);
 assert.equal(index.weight('Work/Sub/A.md'),40);assert.equal(index.weight('Many/F10000/A.md'),undefined);
});
test('throwing renderer accessors cannot break graph updates or unloading',async()=>{
 const f=fixture();f.plugin.app.workspace.getLeavesOfType=()=>[{view:{get renderer(){throw Error('closing view');}}}];
 assert.doesNotThrow(()=>f.plugin.recalculateSize());assert.doesNotThrow(()=>f.plugin.onunload());
});
test('removed graph nodes are restored and released',async()=>{
 const f=fixture();await f.plugin.recalculateSize();assert.equal(f.node.weight,10);
 f.renderer.nodes=[];await f.plugin.recalculateSize();assert.equal(f.node.weight,7);assert.equal(f.plugin.originals.size,0);
});
test('unexpected leading separators cannot trap rule lookup in a loop',async()=>{
 const index=new sandbox.module.exports.RuleIndex(settings());
 assert.equal(index.weight('/Unexpected.md'),undefined);assert.equal(index.weight('/'),undefined);
});
function multiFixture(tree=false) {
 host.window ??= {setTimeout,clearTimeout};
 const plugin=new Plugin();plugin.settings={manual:[],folders:[],exclusions:[],fwdMultiplier:1,bwdMultiplier:1,lettersPerWt:1,fwdTree:tree};
 const nodes=['A','B','C','D'].map(id=>({id:`Work/${id}.md`,weight:7,forward:{},reverse:{}}));
 const sizes=new Map(nodes.map(n=>[n.id,10]));const reads=[];
 const renderer={nodes,changed(){}};
 plugin.app={workspace:{getLeavesOfType:type=>type==='graph'?[{view:{renderer}}]:[]},vault:{getFileByPath(id){reads.push(id);return {extension:'md',stat:{size:sizes.get(id)}};}}};
 plugin.saveData=async()=>{};
 const link=(a,b)=>{nodes[a].forward[nodes[b].id]={target:nodes[b]};nodes[b].reverse[nodes[a].id]={};};
 const update=async path=>{host.window={setTimeout(){return 1;}};try{plugin.invalidate(path);await plugin.recalculateSize();}finally{delete host.window;}};
 return {plugin,nodes,sizes,reads,link,update};
}
test('text edit recalculates only the edited automatic note',async()=>{
 const f=multiFixture();await f.plugin.recalculateSize();f.reads.length=0;f.sizes.set(f.nodes[1].id,20);await f.update(f.nodes[1].id);
 assert.deepEqual(f.reads,[f.nodes[1].id]);assert.equal(f.nodes[1].weight,20);assert.equal(f.nodes[0].weight,10);
});
test('folder rule edit leaves unrelated automatic notes cached',async()=>{
 const f=multiFixture();f.nodes[0].id='Fixed/A.md';f.plugin.settings.folders=[{path:'Fixed',weight:20,recursive:true}];
 await f.plugin.recalculateSize();f.reads.length=0;f.plugin.settings.folders[0].weight=40;await f.plugin.saveSettings();
 assert.equal(f.nodes[0].weight,40);assert.equal(f.reads.length,0);
});
test('fixed notes do not enumerate links or read contents even in tree mode',async()=>{
 const f=multiFixture(true);f.plugin.settings.folders=[{path:'Work',weight:25,recursive:true}];
 const forbidden=new Proxy({}, {ownKeys(){throw Error('fixed links must not be scanned');}});
 for(const n of f.nodes){n.forward=forbidden;n.reverse=forbidden;}
 await f.plugin.recalculateSize();await f.plugin.recalculateSize();await f.update(f.nodes[0].id);
 assert.equal(f.reads.length,0);assert.ok(f.nodes.every(n=>n.weight===25));
});
test('local link edits recalculate endpoints but not unrelated notes',async()=>{
 const f=multiFixture();await f.plugin.recalculateSize();f.reads.length=0;f.link(0,1);await f.plugin.recalculateSize();
 assert.deepEqual(f.reads,[f.nodes[0].id,f.nodes[1].id]);assert.equal(f.nodes[0].weight,11);assert.equal(f.nodes[1].weight,11);
});
test('tree edits propagate to ancestors through fixed intermediates, preserving unrelated caches',async()=>{
 const f=multiFixture(true);f.link(0,1);f.plugin.settings.manual=[{id:f.nodes[1].id,weight:50}];
 await f.plugin.recalculateSize();f.reads.length=0;f.link(1,2);await f.plugin.recalculateSize();
 assert.equal(f.nodes[0].weight,12);assert.equal(f.nodes[1].weight,50);assert.equal(f.nodes[2].weight,11);
 assert.ok(!f.reads.includes(f.nodes[3].id));
 delete f.nodes[1].forward[f.nodes[2].id];delete f.nodes[2].reverse[f.nodes[1].id];await f.plugin.recalculateSize();assert.equal(f.nodes[0].weight,11);
});
test('same-degree tree rewiring invalidates ancestors and detects off-screen descendants',async()=>{
 const f=multiFixture(true);f.link(0,1);f.link(1,2);
 const renderer={nodes:[f.nodes[0]],changed(){}};
 f.plugin.app.workspace.getLeavesOfType=type=>type==='graph'?[{view:{renderer}}]:[];
 await f.plugin.recalculateSize();assert.equal(f.nodes[0].weight,12);
 delete f.nodes[1].forward[f.nodes[2].id];f.nodes[1].forward[f.nodes[3].id]={target:f.nodes[3]};f.link(3,2);
 f.plugin.topologyRevision++; // Simulate metadata resolution for an in-place same-degree rewire.
 await f.plugin.recalculateSize();assert.equal(f.nodes[0].weight,13);
});
test('removing a rule and adding an exception restores automatic weights',async()=>{
 const f=multiFixture();f.plugin.settings.folders=[{path:'Work',weight:80,recursive:true}];await f.plugin.recalculateSize();
 f.plugin.settings.exclusions=[f.nodes[0].id];await f.plugin.saveSettings();assert.equal(f.nodes[0].weight,10);assert.equal(f.nodes[1].weight,80);
 f.plugin.settings.folders=[];await f.plugin.saveSettings();assert.ok(f.nodes.every(n=>n.weight===10));
});
const calculatorBundle=esbuild.buildSync({entryPoints:['src/calculator.ts'],bundle:true,format:'cjs',platform:'browser',external:['obsidian'],write:false});
const calculatorHost={module:{exports:{}},exports:{},require:host.require};
vm.runInNewContext(calculatorBundle.outputFiles[0].text,calculatorHost);
const FullCalculator=calculatorHost.module.exports.default;
test('incremental results match full recalculation through mixed graph and settings edits',async()=>{
 for(const tree of [false,true]) {
  const f=multiFixture(tree);f.link(0,1);f.link(1,2);f.link(2,0);
  for(let step=0;step<40;step++) {
   const a=step%4,b=(step*3+1)%4;
   if(step%5===0){f.plugin.settings.manual=step%10===0?[{id:f.nodes[a].id,weight:20}]:[];await f.plugin.saveSettings();}
   else if(step%5===1){f.sizes.set(f.nodes[a].id,step+30);await f.update(f.nodes[a].id);}
   else if(step%5===2){if(a!==b)f.link(a,b);}
   else if(step%5===3){delete f.nodes[a].forward[f.nodes[b].id];delete f.nodes[b].reverse[f.nodes[a].id];}
   else {f.plugin.settings.bwdMultiplier=step%3;await f.plugin.saveSettings();}
   await f.plugin.recalculateSize();const calculator=new FullCalculator(f.plugin.app,f.plugin.settings);
   for(const node of f.nodes)assert.equal(node.weight,calculator.calcNodeWeight(node),`tree=${tree}, step=${step}, node=${node.id}`);
  }
 }
});

test('global and local automatic weights remain independent for identical paths',async()=>{
 const f=fixture();const localNode={...f.node,forward:{},reverse:{'Other/B.md':{}}};
 const local={nodes:[localNode],changed(){}};
 f.plugin.app.workspace.getLeavesOfType=type=>[{view:{renderer:type==='graph'?f.renderer:local}}];
 await f.plugin.recalculateSize();await f.plugin.recalculateSize();assert.equal(f.node.weight,10);assert.equal(localNode.weight,11);
});
test('same-length membership replacement evicts the removed ID',async()=>{
 const f=fixture();await f.plugin.recalculateSize();
 f.renderer.nodes=[{...f.node,id:'Other/B.md',weight:1}];await f.plugin.recalculateSize();
 const reads=f.reads();f.renderer.nodes=[f.node];await f.plugin.recalculateSize();assert.equal(f.reads(),reads+1);
});
async function controlledScheduler(run) {
 const saved={setTimeout:host.setTimeout,clearTimeout:host.clearTimeout,performance:host.performance,window:host.window};
 const queue=[];let tick=0;
 const enqueue=fn=>{queue.push({fn,cancelled:false});return queue.length;};
 const cancel=id=>{if(queue[id-1])queue[id-1].cancelled=true;};
 host.setTimeout=enqueue;host.clearTimeout=cancel;host.window={setTimeout:enqueue,clearTimeout:cancel};host.performance={now:()=>tick++};
 let cursor=0;
 const step=()=>{const item=queue[cursor++];if(item&&!item.cancelled)item.fn();return !!item;};
 const drain=async()=>{let count=0;while(cursor<queue.length){assert.ok(++count<10000,'scheduler must finish');step();await Promise.resolve();}};
 try {await run({step,drain,queue});} finally {Object.assign(host,saved);}
}
function largeFixedFixture() {
 const f=fixture();f.plugin.settings.folders=[{path:'Work',weight:20,recursive:true}];
 f.renderer.nodes=Array.from({length:3000},(_,i)=>({id:`Work/${i}.md`,weight:1,forward:{},reverse:{}}));
 return f;
}
test('large jobs yield; an edit cancels partially applied old results',async()=>{
 await controlledScheduler(async({step,drain,queue})=>{
  const f=largeFixedFixture();f.plugin.saveData=async()=>{};
  const old=f.plugin.recalculateSize();assert.ok(queue.length>0);
  while(!f.renderer.nodes.some(n=>n.weight===20)){assert.ok(step());}
  assert.ok(f.renderer.nodes.some(n=>n.weight===1),'application must also be chunked');
  f.plugin.settings.folders[0].weight=80;const latest=f.plugin.saveSettings();
  await drain();await Promise.all([old,latest]);assert.ok(f.renderer.nodes.every(n=>n.weight===80));
  f.plugin.onunload();assert.ok(f.renderer.nodes.every(n=>n.weight===1));
 });
});
test('unload cancels a running job and no queued task writes afterward',async()=>{
 await controlledScheduler(async({drain})=>{
  const f=largeFixedFixture();const running=f.plugin.recalculateSize();f.plugin.onunload();
  await drain();await running;assert.ok(f.renderer.nodes.every(n=>n.weight===1));assert.equal(f.plugin.job,undefined);
 });
});
test('replaced graph during a job retries without quarantining the renderer',async()=>{
 await controlledScheduler(async({drain})=>{
  const f=largeFixedFixture();const first=f.plugin.recalculateSize();
  f.renderer.nodes=f.renderer.nodes.map(n=>({...n,weight:2}));
  await drain();await first;await f.plugin.whenIdle();
  assert.ok(f.renderer.nodes.every(n=>n.weight===20));assert.equal(f.plugin.failed.has(f.renderer),false);
  f.plugin.onunload();assert.ok(f.renderer.nodes.every(n=>n.weight===2));
 });
});
test('tree audit catches silent off-screen same-degree rewiring at the next eligible poll',async()=>{
 const originalClock=host.performance;let time=0;host.performance={now:()=>time};
 try {
  const f=multiFixture(true);f.link(0,1);f.link(1,2);
  const renderer={nodes:[f.nodes[0]],changed(){}};f.plugin.app.workspace.getLeavesOfType=type=>type==='graph'?[{view:{renderer}}]:[];
  await f.plugin.recalculateSize();assert.equal(f.nodes[0].weight,12);
  delete f.nodes[1].forward[f.nodes[2].id];f.nodes[1].forward[f.nodes[3].id]={target:f.nodes[3]};f.link(3,2);
  time=2000;await f.plugin.recalculateSize();assert.equal(f.nodes[0].weight,12);
  time=10001;await f.plugin.recalculateSize();assert.equal(f.nodes[0].weight,13);
 } finally {host.performance=originalClock;}
});
test('component counting is exact for cycles with overlapping descendants',async()=>{
 const f=multiFixture(true);f.link(0,1);f.link(1,0);f.link(0,2);f.link(1,3);f.link(2,3);
 await f.plugin.recalculateSize();const reference=new FullCalculator(f.plugin.app,f.plugin.settings);
 for(const node of f.nodes)assert.equal(node.weight,reference.calcNodeWeight(node));
});
test('hiding the app cancels an in-flight job and it can resume safely',async()=>{
 await controlledScheduler(async({drain})=>{
  const f=largeFixedFixture();const running=f.plugin.recalculateSize();host.document={hidden:true};
  try {
   await drain();await running;assert.ok(f.renderer.nodes.every(n=>n.weight===1));
   host.document.hidden=false;const resumed=f.plugin.recalculateSize();await drain();await resumed;
   assert.ok(f.renderer.nodes.every(n=>n.weight===20));f.plugin.onunload();
  } finally {delete host.document;}
 });
});
test('component counts match full traversal on a seeded directed graph',async()=>{
 const f=multiFixture(true);let seed=7;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
 f.nodes.splice(0,f.nodes.length,...Array.from({length:80},(_,i)=>({id:`Work/${i}.md`,weight:1,forward:{},reverse:{}})));
 for(const node of f.nodes)f.sizes.set(node.id,10);
 for(let i=0;i<220;i++){const a=random()%80,b=random()%80;if(a!==b)f.link(a,b);}
 await f.plugin.recalculateSize();const reference=new FullCalculator(f.plugin.app,f.plugin.settings);
 for(const node of f.nodes)assert.equal(node.weight,reference.calcNodeWeight(node));
});
