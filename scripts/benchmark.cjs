const {performance} = require('node:perf_hooks');
const vm = require('node:vm');
const esbuild = require('esbuild');
const assert = require('node:assert/strict');
const result=esbuild.buildSync({entryPoints:['src/rules.ts'],bundle:true,format:'cjs',write:false});
const context={module:{exports:{}},exports:{}};
vm.runInNewContext(result.outputFiles[0].text,context);
const {RuleIndex,matchesFolder}=context.module.exports;
const settings={manual:[],exclusions:[],folders:Array.from({length:5000},(_,i)=>({path:`Work/F${i}`,weight:i%100,recursive:true}))};
const paths=Array.from({length:5000},(_,i)=>`Work/F${i}/Nested/A.md`);
function previous(path){return settings.folders.filter(r=>matchesFolder(path,r.path,r.recursive)).sort((a,b)=>b.path.split('/').length-a.path.split('/').length)[0]?.weight;}
const begin=performance.now();const old=paths.map(previous);const oldMs=performance.now()-begin;
const indexedBegin=performance.now();const index=new RuleIndex(settings);const current=paths.map(path=>index.weight(path));const indexedMs=performance.now()-indexedBegin;
assert.deepEqual(current,old);
console.log(JSON.stringify({rules:5000,notes:5000,previousMs:Math.round(oldMs),indexedIncludingConstructionMs:Number(indexedMs.toFixed(2)),sameResults:true}));
