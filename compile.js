"use strict";
const fs = require('fs');

//const isNum = v => isNaN(parseInt(v));
const isNum = s => (typeof(s)=="number") || (!!(+s==s && s.length));

const BANK_SIZE = 0x80;
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

const compiled = new Uint8Array(ROM_SIZE).fill(0);

let bankOffset = 0;
let ptr = 0;
let bank = 0;
let banks = 1;
function handlePtrChange() {
  if((ptr-bankOffset) > BANK_SIZE) {
    throw new Error('Too much data in one bank!');
  }
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
  compiled[ptr++] = parseInt(v);
  process.stdout.write(`(${(parseInt(v&0xFF).toString(16))}) `);
  handlePtrChange();
}
function jumpTo(bank=0, addr=0) {
  bank = parseInt(bank);
  addr = parseInt(addr);
  if((bank < 0) || (bank > 0xFF)) {
    throw new Error('Bank out of bounds');
    return;
  }
  banks = Math.max(banks, bank+1);
  bankOffset = bank * BANK_SIZE;
  ptr = bankOffset + addr;
  handlePtrChange();
}
jumpTo();

const file = fs.readFileSync('PROGRAM.c3asm','utf8');
const lines = file.split('\n');
lines.forEach((v,i) => {
  let cmd = v.trim().replace('\r','');
  if(cmd.length < 1) return;
  cmd = cmd.split(' ');
  let args = cmd.splice(1,cmd.length).join(' ').split(',').map(v=>v.trim());
  cmd = cmd[0];

  let debugstr = cmd+' '+args.join(',');
  process.stdout.write(debugstr+(' '.repeat(Math.max(0,32-debugstr.length)))+' \t=> ');

  switch(cmd) {
    case '#BANK':
      jumpTo(args[0] || (bank + 1),args[1]);
      break;
    case 'NOP':
      for(let i=0; i<parseInt(args[0]|0); i++) {
        pushOpcode(0,0,false);
      }
      break;
    case 'BANK':
      if(1){
        let map = {
          "RAM": 3,
          "ROM": 4,
        };
        pushOpcode(map[args[0].toUpperCase().trim()],args[1]);
      }
      break;
    case 'LD':
      if(1){
        let a = args[0];
        let b = args[1];
        if(!isNum(a) && isNum(b)) {
          pushOpcode(9,a); // LD R,V
          pushData(b);
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
    case 'DB':
      for(const d of args) {
        pushData(d);
      }
      break;
    case '//':
    case 'REM':
      break;
    default:
      throw new Error('Invalid instruction: ' + cmd);
  }
  console.log('');
});

//REMOVE UNNEEDED BANKS
let _compiled = compiled.slice(0,banks*BANK_SIZE);
fs.writeFileSync('PROGRAM.c3bin', Buffer.from(_compiled));

console.log('\nDone.');