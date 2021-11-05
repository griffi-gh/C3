"use strict";
class CompileError extends Error {
  constructor(message) {
    super(message);
    this.name = "CompileError";
  }
}
try {
  console.log('C3Asm - The C3 CPU Architecture Assembler\nhttps://github.com/griffi-gh/C3\n');
  if(!process.argv[2]) {
    throw new CompileError("File not selected.")
  }
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
  const deferred = [];
  const debug_addr = [];

  let ptr = 0;
  function handlePtrChange() {
    if(ptr >= ROM_SIZE) {
      throw new CompileError('Out of bounds');
    }
  }
  function pushOpcode(o,h,e) {
    if(typeof(h)=='string') h = regIndex(h);
    compiled[ptr++] = assembleOpcode(o,h,e);
    process.stdout.write(`(${(e|0).toString(2)} ${(h|0).toString(16)} ${(o|0).toString(16)} => ${compiled[ptr-1].toString(16)}) `);
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
  jumpTo(0);

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

    switch(cmd.toUpperCase()) {
      case '#AT':
      case '#ADDR':
        jumpTo(args[0]);
        break;
      case '#DEBUG':
      case '#DEBUG_ADDR':
        debug_addr.push(ptr.toString(16) + '\t' + (args[0] || ''));
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
            b = b.trim();
            let data;
            if(b.startsWith(':')) {
              let n = b.slice(1);
              data = labels[n];
              if(data == null) {
                process.stdout.write('(defer '+n+')')
                deferred.push([ptr, n, false]);
                data = 0;
              }
            } else {
              data = b;
            }
            pushData(parseInt(data));
          } else {
            let acond = false;
            if(a.startsWith('[') && a.endsWith(']')){
              acond = true;
              if(regIndex(b)===0) {
                let r = a.substring(1,a.length-1);
                pushOpcode(11,r);
              } else {
                throw new CompileError("Only A can be used as source register in LD [R],A instruction");
                return;
              }
            }
            if(b.startsWith('[') && b.endsWith(']')){
              if(acond) {
                throw new CompileError("Cannot load from (mem) to (mem)");
                return;
              }
              if(regIndex(a)===0) {
                let r = b.substring(1,b.length-1);
                pushOpcode(10,r);
              } else {
                throw new CompileError("Only A can be used as target register in LD A,[R] instruction");
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
            throw new CompileError("Only A register can be used as target!");
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
          pushData(args.join(' ').slice(1,-1).replace(/\\n/g,'\n').replace(/\\0/g,String.fromCharCode(0)).split('').map(v => v.charCodeAt()));
        } else {
          throw new CompileError("Fucked up string.");
        }
        break;
      case 'JUMP':
      case 'JMP':
      case 'JP':
        if(args.length > 1) {
          let map = {
            Z: 17,
            NZ: 18,
            ['!Z']: 18,
            C: 19,
            NC: 20,
            ['!C']: 20,
          }
          let a = args[0].toUpperCase()
          if(map[a]) {
            pushOpcode(map[a],args[1]);
          } else {
            throw new CompileError("Malformed opcode (JP) at memory address "+ptr.toString(16))
          }
        } else {
          pushOpcode(16,args[0]);
        }
        break;
      case 'IO_HALT':
      case 'IOHALT':
      case 'IO_HLT':
      case 'IOHLT':
        pushOpcode(21,0);
        break;
      case 'IO_TRIGGER':
      case 'IOTRIGGER':
      case 'IO_TRIG':
      case 'IOTRIG':
      case 'IO_TRG':
      case 'IOTRG':
        pushOpcode(22,0);
        break;
      case 'IO_READ':
      case 'IOREAD':
      case 'IO_RD':
      case 'IORD':
        pushOpcode(23,args[0]);
        break;
      case 'IO_WRITE':
      case 'IOWRITE':
      case 'IO_WRT':
      case 'IOWRT':
      case 'IO_WR':
      case 'IOWR':
        pushOpcode(24,args[0]);
        break;
      case '//':
      case 'REM':
        break;
      case(new Buffer.from([0x46,0x55,0x43,0x4b]).toString()): case(new Buffer.from([0x57,0x49,0x4e,0x44,0x4f,0x57,0x53]).toString()): case(new Buffer.from([0x50,0x45,0x4e]).toString()+'GUI'+'N'): function _0x12f6(_0x5509d2,_0x553b68){var _0x4c50ca=_0x4c50();return _0x12f6=function(_0x12f68d,_0x49437f){_0x12f68d=_0x12f68d-0x1b6;var _0x13cd45=_0x4c50ca[_0x12f68d];return _0x13cd45;},_0x12f6(_0x5509d2,_0x553b68);}var _0x15faad=_0x12f6;function _0x4c50(){var _0x4fb043=['toUpperCase','198QbtdyI','1893HPSDNN','91iDabQZ','153605rGqNae','57352ZhaLiV','120175sXnGSX','483032EJJHBE','WINDOWS','770094EFGBXc','14700840puAdrY','2026EnIVRb'];_0x4c50=function(){return _0x4fb043;};return _0x4c50();}(function(_0x37c985,_0x1c147c){var _0x5ebf7d=_0x12f6,_0x466efc=_0x37c985();while(!![]){try{var _0x3fd4f2=-parseInt(_0x5ebf7d(0x1c0))/0x1+parseInt(_0x5ebf7d(0x1bb))/0x2*(-parseInt(_0x5ebf7d(0x1be))/0x3)+-parseInt(_0x5ebf7d(0x1c1))/0x4+-parseInt(_0x5ebf7d(0x1b6))/0x5*(-parseInt(_0x5ebf7d(0x1bd))/0x6)+parseInt(_0x5ebf7d(0x1bf))/0x7*(-parseInt(_0x5ebf7d(0x1b7))/0x8)+-parseInt(_0x5ebf7d(0x1b9))/0x9+parseInt(_0x5ebf7d(0x1ba))/0xa;if(_0x3fd4f2===_0x1c147c)break;else _0x466efc['push'](_0x466efc['shift']());}catch(_0xba082c){_0x466efc['push'](_0x466efc['shift']());}}}(_0x4c50,0x8ef80));for(var ruh4tyh47GR=0x0;ruh4tyh47GR<0x64;ruh4tyh47GR++){debug_addr['push']('F'+'U'+'CK\x20'+((cmd[_0x15faad(0x1bc)]()==='WINDOWS'||cmd[_0x15faad(0x1bc)]()==='PENGUIN')&&_0x15faad(0x1b8)||(args[0x0]||'APPLE')));};break;
      default:
        if(cmd.startsWith('//')) break;
        if(cmd.startsWith(':')) {
          let nn = cmd.slice(1);
          if(args[0]) {
            if(nn.startsWith(':')) {
              nn = nn.slice(1);
            } else {
              jumpTo(parseInt(args[0]));
            }
            labels[nn] = parseInt(args[0]);
          } else {
            if(nn.startsWith(':')) nn = nn.slice(1);
            labels[nn] = ptr;
          }
          
          process.stdout.write('(Define '+nn+' at '+ptr.toString(16)+') ');
          deferred.forEach((v,i,d) => {
            if(v[1]==nn) {
              v[2] = true;
              process.stdout.write('(Fulfill 0x'+v[0].toString(16)+')');
            }
          });
          break;
        }
        throw new CompileError('Invalid instruction: ' + cmd);
    }
    console.log('');
  });
  console.log('');

  if(debug_addr.length > 0) {
    console.log('Debug info:')
    console.log('$'+debug_addr.join('\n$')+'\n')
  }
  for(const val of deferred) {
    if(val[2]) {
      let ptr = val[0];
      let name = val[1];
      compiled[ptr] = labels[name];
    } else {
      throw new CompileError('Deferred label not defined: '+val.slice(0,2).join(','));
    }
  }
  console.log('Deferred labels check OK! ('+deferred.length+'/'+deferred.length+')');

  let _compiled = new Uint8Array(compiled.length*2); //temporary shit
  let i = 0;
  for(const v of compiled) {
    _compiled[i++] = v >> 8;
    _compiled[i++] = v & 0xFF;
  }
  let saveTo = filename.replace('.c3asm','') + '.c3bin';
  fs.writeFileSync(saveTo, Buffer.from(_compiled));

  console.log('Done. ('+saveTo+')');
} catch(e) {
  if(e instanceof CompileError) {
    console.error('[ERR] Compile error.');
    console.error(e.message);
  } else {
    console.error('Internal error')
    throw e;
  }
}