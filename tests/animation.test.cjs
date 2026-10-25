const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const esbuild = require('esbuild');
const bundle = esbuild.buildSync({entryPoints:['src/main.ts'],bundle:true,format:'cjs',platform:'browser',external:['obsidian'],write:false});
const host={setTimeout,clearTimeout,performance,window:{setTimeout,clearTimeout},module:{exports:{}},exports:{},require:()=>({Notice:class{},Plugin:class{},PluginSettingTab:class{},AbstractInputSuggest:class{}})};
vm.runInNewContext(bundle.outputFiles[0].text,host);
const Plugin=host.module.exports.default;
const node=id=>({id,weight:1,forward:{},reverse:{}});
function fixture() {
 const plugin=new Plugin();
 plugin.settings={manual:[],exclusions:[],folders:[{path:'Work',weight:80,recursive:true}],fwdMultiplier:1,bwdMultiplier:1,lettersPerWt:1,fwdTree:false};
 let nativeCalls=0;
 // Obsidian 1.14.5 setData replaces every weight on each timelapse step,
 // then queues (rather than immediately paints) a render. No proprietary code.
 const prototype={setData(data,marker){
  assert.equal(this,renderer);nativeCalls++;
  this.nodes=data.nodes??this.nodes;
  for(const n of this.nodes)n.weight=data.weight;
  this.changed();return marker;
 }};
 const renderer=Object.assign(Object.create(prototype),{nodes:[node('Work/A.md'),node('Other/B.md')],redraws:0,changed(){this.redraws++;}});
 plugin.app={workspace:{getLeavesOfType:type=>type==='graph'?[{view:{renderer}}]:[]},vault:{getFileByPath:()=>({extension:'md',stat:{size:10}})}};
 return {plugin,renderer,prototype,nativeCalls:()=>nativeCalls};
}
test('timelapse frames preserve fixed and cached automatic sizes without polling',async()=>{
 const f=fixture();await f.plugin.recalculateSize();
 const marker={};
 for(let frame=0;frame<120;frame++){
  assert.equal(f.renderer.setData({weight:frame%7},marker),marker);
  assert.deepEqual(f.renderer.nodes.map(n=>n.weight),[80,10],'weights visible to the next frame must not oscillate');
 }
 assert.equal(f.nativeCalls(),120);
 f.plugin.onunload();assert.deepEqual(f.renderer.nodes.map(n=>n.weight),[0,0]);
 assert.equal(f.renderer.setData,f.prototype.setData);assert.equal(Object.hasOwn(f.renderer,'setData'),false);
});
test('newly revealed nodes respect folder, manual zero, subfolder and exception rules',async()=>{
 const f=fixture();f.plugin.settings.manual=[{id:'Work/Zero.md',weight:0}];
 f.plugin.settings.exclusions=['Work/Excluded.md'];
 f.plugin.settings.folders.push({path:'Work/Sub',weight:40,recursive:true});
 await f.plugin.recalculateSize();
 const fresh=['Work/New.md','Work/Zero.md','Work/Sub/Child.md','Work/Excluded.md'].map(node);
 f.renderer.setData({nodes:fresh,weight:2});
 assert.deepEqual(fresh.map(n=>n.weight),[80,0,40,2]);
 await f.plugin.recalculateSize();assert.deepEqual(fresh.map(n=>n.weight),[80,0,40,10]);
 f.renderer.setData({weight:3});assert.deepEqual(fresh.map(n=>n.weight),[80,0,40,10]);
 f.plugin.onunload();assert.ok(fresh.every(n=>n.weight===3));
});
test('unloading preserves a later wrapper and retained observer becomes inert',async()=>{
 const f=fixture();await f.plugin.recalculateSize();
 const observed=f.renderer.setData;
 const later=function(...args){return observed.apply(this,args);};f.renderer.setData=later;
 f.plugin.onunload();assert.equal(f.renderer.setData,later);
 f.renderer.setData({weight:4});assert.ok(f.renderer.nodes.every(n=>n.weight===4));
});
test('closing a graph removes its observer and restores native weights',async()=>{
 const f=fixture();await f.plugin.recalculateSize();f.renderer.setData({weight:5});
 f.plugin.app.workspace.getLeavesOfType=()=>[];await f.plugin.recalculateSize();
 assert.equal(f.renderer.setData,f.prototype.setData);assert.ok(f.renderer.nodes.every(n=>n.weight===5));
 assert.equal(f.plugin.graphHooks.size,0);f.plugin.onunload();
});
test('native setData exceptions propagate without applying sizes',async()=>{
 const f=fixture();const failure=Error('native failure');
 const original=function(){throw failure;};f.renderer.setData=original;
 await f.plugin.recalculateSize();
 assert.throws(()=>f.renderer.setData({weight:2}),error=>error===failure);
 f.plugin.onunload();assert.equal(f.renderer.setData,original);
});
test('malformed animation update detaches observer and restores sizes without breaking native return',async()=>{
 const f=fixture();await f.plugin.recalculateSize();const prior=f.renderer.nodes[0];
 const bad=node('Bad.md');bad.forward=null;
 assert.equal(f.renderer.setData({nodes:[prior,bad],weight:2},'result'),'result');
 assert.equal(prior.weight,2);assert.equal(f.renderer.setData,f.prototype.setData);
 assert.equal(f.plugin.failed.has(f.renderer),true);f.plugin.onunload();
});
test('animation interrupts a chunked update without rolling visible sizes back',async()=>{
 const saved={setTimeout:host.setTimeout,clearTimeout:host.clearTimeout,window:host.window,performance:host.performance};
 const queue=[];let tick=0,cursor=0;
 const enqueue=fn=>{queue.push({fn,cancelled:false});return queue.length;};
 const cancel=id=>{if(queue[id-1])queue[id-1].cancelled=true;};
 host.setTimeout=enqueue;host.clearTimeout=cancel;host.window={setTimeout:enqueue,clearTimeout:cancel};host.performance={now:()=>tick++};
 const step=()=>{const task=queue[cursor++];if(task&&!task.cancelled)task.fn();};
 const drain=()=>{let count=0;while(cursor<queue.length){assert.ok(++count<10000);step();}};
 try {
  const f=fixture();f.renderer.nodes=Array.from({length:3000},(_,i)=>node(`Work/${i}.md`));
  const first=f.plugin.recalculateSize();drain();await first;
  const inFlight=f.plugin.recalculateSize();
  f.renderer.setData({weight:3});
  let count=0;
  while(cursor<queue.length){
   assert.ok(++count<10000);step();
   assert.ok(f.renderer.nodes.every(n=>n.weight===80),'an obsolete job must not expose native weights');
  }
  await inFlight;assert.equal(f.plugin.failed.has(f.renderer),false);
  f.plugin.onunload();assert.ok(f.renderer.nodes.every(n=>n.weight===3));
 } finally {Object.assign(host,saved);}
});
test('animation preserves the most recent saved rule and hidden updates do no sizing work',async()=>{
 const f=fixture();f.plugin.saveData=async()=>{};
 await f.plugin.recalculateSize();f.plugin.settings.folders[0].weight=50;await f.plugin.saveSettings();
 f.renderer.setData({weight:2});assert.equal(f.renderer.nodes[0].weight,50);
 host.document={hidden:true};
 try {f.renderer.setData({weight:4});assert.ok(f.renderer.nodes.every(n=>n.weight===4));}
 finally {delete host.document;}
 await f.plugin.recalculateSize();assert.deepEqual(f.renderer.nodes.map(n=>n.weight),[50,10]);
 f.plugin.onunload();assert.ok(f.renderer.nodes.every(n=>n.weight===4));
});
test('a node revealed during yielded cleanup is not restored as a detached node',async()=>{
 const f=fixture();await f.plugin.recalculateSize();
 const count=f.renderer.nodes.length;
 const update=f.plugin.updateGraphs();
 // Validation, cached calculation and application each yield once per node.
 // The next yield is inside cleanup; inject a native frame at that boundary.
 for(let i=0;i<3*count+1;i++)assert.equal(update.next().done,false);
 const added=node('Work/New.md');
 f.renderer.setData({nodes:[...f.renderer.nodes,added],weight:4});
 let steps=0;while(!update.next().done)assert.ok(++steps<100);
 assert.equal(added.weight,80);assert.equal(f.plugin.originals.has(added),true);
 f.plugin.onunload();assert.equal(added.weight,4);
});
