const {test} = require('node:test');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const vm = require('node:vm');
const bundle = esbuild.buildSync({entryPoints:['src/rules.ts'], bundle:true, format:'cjs', platform:'node', write:false});
const sandbox = {module:{exports:{}},exports:{}};
vm.runInNewContext(bundle.outputFiles[0].text,sandbox);
const {ruleWeight,matchesFolder,movedPath} = sandbox.module.exports;
const settings = () => ({manual:[], exclusions:[], folders:[{path:'Work',weight:20,recursive:true},{path:'Work/Sub',weight:40,recursive:true}]});
test('all notes including future notes inherit folder rule',()=>{for(const name of ['A','B','New']) assert.equal(ruleWeight(`Work/${name}.md`,settings()),20);});
test('deepest rule wins regardless of rule order',()=>{const s=settings();s.folders.reverse();assert.equal(ruleWeight('Work/Sub/A.md',s),40);});
test('folder boundary prevents prefix collisions',()=>assert.equal(ruleWeight('Workshop/A.md',settings()),undefined));
test('non-recursive rule only matches direct children',()=>{assert.equal(matchesFolder('Work/Sub/A.md','Work',false),false);assert.equal(matchesFolder('Work/A.md','Work',false),true);});
test('root rule and deeper folder precedence',()=>{const s=settings();s.folders.push({path:'/',weight:5,recursive:true});assert.equal(ruleWeight('A.md',s),5);assert.equal(ruleWeight('Work/A.md',s),20);});
test('manual zero is an override even for excluded notes',()=>{const s=settings();s.exclusions=['Work/A.md'];s.manual=[{id:'Work/A.md',weight:0}];assert.equal(ruleWeight('Work/A.md',s),0);});
test('excluded notes return to automatic calculation',()=>{const s=settings();s.exclusions=['Work/A.md'];assert.equal(ruleWeight('Work/A.md',s),undefined);});
test('rename moves descendants but not similarly named siblings',()=>{assert.equal(movedPath('Work/Sub/A.md','Work','New'),'New/Sub/A.md');assert.equal(movedPath('Workshop/A.md','Work','New'),'Workshop/A.md');assert.equal(movedPath('Work','Work','New'),'New');});
test('removing child rule falls back to parent',()=>{const s=settings();s.folders.pop();assert.equal(ruleWeight('Work/Sub/A.md',s),20);});
const mainBundle = esbuild.buildSync({entryPoints:['src/main.ts'],bundle:true,format:'cjs',platform:'browser',external:['obsidian'],write:false});
const host={module:{exports:{}},exports:{},require:(name)=>{assert.equal(name,'obsidian');return {Notice:class {},Plugin:class {},PluginSettingTab:class {},AbstractInputSuggest:class {}};}};
vm.runInNewContext(mainBundle.outputFiles[0].text,host);
const Plugin=host.module.exports.default;
test('global and local graphs update; new nodes inherit; unload restores weights',()=>{
 const plugin=new Plugin();plugin.settings={...settings(),fwdMultiplier:1,bwdMultiplier:1,lettersPerWt:0,fwdTree:false};
 const node=id=>({id,weight:7,forward:{},reverse:{}});
 const global={nodes:[node('Work/A.md')],changed(){this.redraws=(this.redraws||0)+1;}};
 const local={nodes:[node('Work/Sub/B.md')],changed(){this.redraws=(this.redraws||0)+1;}};
 plugin.app={workspace:{getLeavesOfType:type=>[{view:{renderer:type==='graph'?global:local}}]},vault:{}};
 plugin.recalculateSize();assert.equal(global.nodes[0].weight,20);assert.equal(local.nodes[0].weight,40);assert.equal(global.redraws,1);
 global.nodes.push(node('Work/New.md'));plugin.recalculateSize();assert.equal(global.nodes[1].weight,20);
 plugin.onunload();assert.equal(global.nodes[0].weight,7);assert.equal(local.nodes[0].weight,7);assert.equal(global.nodes[1].weight,7);
});
test('closed or uninitialized graph views are safe',()=>{const plugin=new Plugin();plugin.settings=settings();plugin.app={workspace:{getLeavesOfType:()=>[{view:{}},{view:{renderer:{}}}]}};assert.doesNotThrow(()=>plugin.recalculateSize());});
function fixture() {
 const plugin=new Plugin();
 plugin.settings={...settings(),fwdMultiplier:1,bwdMultiplier:1,lettersPerWt:1,fwdTree:false};
 let reads=0;
 const node={id:'Other/A.md',weight:7,forward:{},reverse:{}};
 const renderer={nodes:[node],changed(){this.redraws=(this.redraws||0)+1;}};
 plugin.app={workspace:{getLeavesOfType:type=>type==='graph'?[{view:{renderer}}]:[]},vault:{getFileByPath(){reads++;return {extension:'md',stat:{size:10}};}}};
 return {plugin,node,renderer,reads:()=>reads};
}
test('unchanged fallback checks reuse calculated weights and avoid redraws',()=>{
 const f=fixture();f.plugin.recalculateSize();f.plugin.recalculateSize();f.plugin.recalculateSize();
 assert.equal(f.reads(),1);assert.equal(f.renderer.redraws,1);
});
test('replacement nodes with identical topology receive cached weights',()=>{
 const f=fixture();f.plugin.recalculateSize();f.renderer.nodes=[{...f.node,weight:3}];f.plugin.recalculateSize();
 assert.equal(f.reads(),1);assert.equal(f.renderer.nodes[0].weight,10);
 f.plugin.onunload();assert.equal(f.renderer.nodes[0].weight,3);
});
test('in-place link edits invalidate topology cache',()=>{
 const f=fixture();f.plugin.recalculateSize();f.node.reverse['B.md']={};f.plugin.recalculateSize();
 assert.equal(f.reads(),2);assert.equal(f.node.weight,11);
});
test('saved settings invalidate cached weights',async()=>{
 const f=fixture();f.plugin.saveData=async()=>{};f.plugin.recalculateSize();
 f.plugin.settings.manual.push({id:f.node.id,weight:50});await f.plugin.saveSettings();assert.equal(f.node.weight,50);
});
test('malformed renderer nodes are skipped without writes or repeated errors',()=>{
 const f=fixture();f.renderer.nodes.push({id:'invalid'});
 assert.doesNotThrow(()=>f.plugin.recalculateSize());assert.equal(f.node.weight,7);
 assert.doesNotThrow(()=>f.plugin.recalculateSize());assert.equal(f.reads(),0);
});
test('redraw failure restores changed weights and quarantines renderer',()=>{
 const f=fixture();let calls=0;f.renderer.changed=()=>{calls++;throw Error('API changed');};
 f.plugin.recalculateSize();assert.equal(f.node.weight,7);
 f.plugin.recalculateSize();assert.equal(calls,1);assert.doesNotThrow(()=>f.plugin.onunload());
});
test('background checks do no graph work and resume on next check',()=>{
 const f=fixture();host.document={hidden:true};
 try {f.plugin.recalculateSize();assert.equal(f.reads(),0);host.document.hidden=false;f.plugin.recalculateSize();assert.equal(f.reads(),1);} finally {delete host.document;}
});
test('deep cyclic link graphs use iterative traversal without stack overflow',()=>{
 const f=fixture();f.plugin.settings.fwdTree=true;f.plugin.settings.lettersPerWt=0;
 let last=f.node;
 for(let i=0;i<12000;i++){const child={id:`chain/${i}.md`,weight:1,forward:{},reverse:{}};last.forward[child.id]={target:child};last=child;}
 last.forward[f.node.id]={target:f.node};f.plugin.recalculateSize();assert.equal(f.node.weight,12000);
});
test('vault event bursts coalesce and invalidate content-based weights',()=>{
 const f=fixture();let scheduled=0,callback;
 host.window={setTimeout(fn){scheduled++;callback=fn;return scheduled;},clearTimeout(){}};
 try {
  f.plugin.recalculateSize();
  f.plugin.invalidate();f.plugin.invalidate();f.plugin.invalidate();
  assert.equal(scheduled,1);assert.equal(f.reads(),1);
  callback();assert.equal(f.reads(),2);
 } finally {delete host.window;}
});
test('unload cancels queued graph updates',()=>{
 const f=fixture();let callback,cancelled;
 host.window={setTimeout(fn){callback=fn;return 42;},clearTimeout(id){cancelled=id;}};
 try {f.plugin.schedule();f.plugin.onunload();assert.equal(cancelled,42);callback();assert.equal(f.reads(),0);} finally {delete host.window;}
});
