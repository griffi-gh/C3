"use strict";
let filename = (process.argv.slice(2).join(' ') || 'PROGRAM.c3asm');
const fs = require('fs');

//const isNum = v => isNaN(parseInt(v));
const isNum = s => (typeof(s)=="number") || (!!(+s==s && s.length));

const ROM_SIZE = 0x8000;

const REG_MAP = {a: 0, b: 1, c: 2, d: 3};
const ALU_OP = {add:0, sub: 1, mul: 2, cmp: 3}

function regIndex(r) {
  return REG_MAP[r.trim().toLowerCase()] | 0;
}

function assembleOpcode(o,h,e) {
  //[E][HH][OOOOO]
  //E - Extended set (NYI)
  //H - High Bits (Register select)
  //O - Opcode
  if(typeof(h)=='string') h = regIndex(h);
  return o|(h<<5)||(e<<7);
}

const compiled = new Uint16Array(ROM_SIZE).fill(0);

let ptr = 0;
function handlePtrChange() {
  if(ptr >= ROM_SIZE) {
    throw new Error('Out of bounds');
  }
}
function pushOpcode(o,h,e) {
  if(typeof(h)=='string') h = regIndex(h);
  compiled[ptr++] = assembleOpcode(o,h,e);
  process.stdout.write(`(${(e|0).toString(2)} ${(h|0).toString(16)} ${(o|0).toString(16)}) `);
  handlePtrChange();
}
function pushData(v) {
  if(Array.isArray(v)){
    for(const x of v) {
      pushData(x);
    }
    return;
  }
  compiled[ptr++] = parseInt(v);
  process.stdout.write(`(${(parseInt(v&0xFFFF).toString(16))}) `);
  handlePtrChange();
}
function jumpTo(addr) {
  ptr = parseInt(addr);
  handlePtrChange();
}
jumpTo();

const file = fs.readFileSync(filename,'utf8');
const lines = file.split('\n');
const labels = {};
lines.forEach((v,i) => {
  let l = v.trim().replace('\r','');
  if(l[0]==':') {
    let [name,addr] = l.split(' ');
    if(addr) {
      name = name.slice(1);
      labels[name] = parseInt(addr);
      console.log(`Found static label ${name} at address ${labels[name]}`)
    }
  }
});
lines.forEach((v,i) => {
  let cmd = v.trim().replace('\r','');
  if(cmd.length < 1) return;
  cmd = cmd.split(' ');
  let args = cmd.splice(1,cmd.length).join(' ').split(',').map(v=>v.trim());
  cmd = cmd[0];

  let debugstr = cmd+' '+args.join(',');
  process.stdout.write(debugstr+(' '.repeat(Math.max(0,32-debugstr.length)))+' \t=> ');

  switch(cmd) {
    case '#AT':
    case '#ADDR':
      jumpTo(args[0]);
      break;
    case 'NOOP':
    case 'NOP':
      for(let i=0; i<parseInt(args[0]|0); i++) {
        pushOpcode(0,0,false);
      }
      break;
    case 'RST':
    case 'RESET':
      pushOpcode(1,0);
      break;
    case 'STOP':
    case 'STP':
    case 'HCF':
      pushOpcode(2,0);
      break;
    case 'LOAD':
    case 'LD':
      if(1){
        let a = args[0];
        let b = args[1];
        if(!isNum(a) && (isNum(b) || b.startsWith(':'))) {
          // LD R,V
          pushOpcode(9,a);
          //b = b.toLowerCase();
          let data = parseInt(labels[b.slice(1)] || b);
          pushData(data);
        } else {
          let acond = false;
          if(a.startsWith('[') && a.endsWith(']')){
            acond = true;
            if(regIndex(b)===0) {
              let r = a.substring(1,a.length-1);
              pushOpcode(11,r);
            } else {
              throw new Error("Only A can be used as source register in LD [R],A instruction");
              return;
            }
          }
          if(b.startsWith('[') && b.endsWith(']')){
            if(acond) {
              throw new Error("Cannot load from (mem) to (mem)");
              return;
            }
            if(regIndex(a)===0) {
              let r = b.substring(1,b.length-1);
              pushOpcode(10,r);
            } else {
              throw new Error("Only A can be used as target register in LD A,[R] instruction");
              return;
            }
          } else if(!acond) {
            pushOpcode(5+regIndex(b),a); // LD R,R
          }
        }
      }
      break;
    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'CMP':
      if(1){
        let a = args[0];
        let b = args[1];
        let opcode = 12+ALU_OP[cmd.toLowerCase()];
        if(b && (regIndex(a)!==0)) {
          throw new Error("Only A register can be used as target!");
          return;
        }
        pushOpcode(opcode, b ? b : a);
      }
      break;
    case 'DATA':
    case 'DB':
      for(const d of args) {
        pushData(d|0);
      }
      break;
    case 'STRING':
    case 'STR':
      if(args[0].startsWith('"') && args[args.length-1].endsWith('"')) {
        pushData(args.join(' ').slice(1,-1).split(''));
      } else {
        throw new Error("Fucked up string.");
      }
      break;
    case 'JUMP':
    case 'JMP':
    case 'JP':
      switch(args[0].toUpperCase()){
        case 'Z':
          pushOpcode(17,args[1]);
          break;
        case '!Z':
        case 'NZ':
          pushOpcode(18,args[1]);
          break;
        default:
          pushOpcode(16,args[0]);
      }
      break;
    case '//':
    case 'REM':
      break;
    default:
      if(cmd.startsWith('//')) break;
      if(cmd.startsWith(':')) {
        if(args[0]) jumpTo(parseInt(args[0]));
        labels[cmd.slice(1)] = ptr;
        break;
      }
      throw new Error('Invalid instruction: ' + cmd);
  }
  console.log('');
});

//let _compiled = compiled.slice(0,filesize);
let _compiled = new Uint8Array(compiled.length*2); //temporary shit
let i = 0;
for(const v of compiled) {
  _compiled[i++] = v>>8;
  _compiled[i++] = v&0xFF;
}
let saveTo = filename.replace('.c3asm','') + '.c3bin';
fs.writeFileSync(saveTo, Buffer.from(_compiled));

console.log('\nDone. ('+saveTo+')');