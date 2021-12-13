import * as fs from 'fs';

export class IODevice {
  constructor(man, params) {
    this.params = params ?? {};
    if(params == null) {
      this.params.notPassed = true;
    }
    this.manager = man;
    this.output = 0;
  }
  onTrigger() {}
  get value() {
    return this.output;
  }
}

export const devices = {}
devices.none = IODevice;
devices.tty = class extends IODevice {
  constructor(...a) {
    super(...a);
    this.lastKey = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', key => {
      if(key === '\u0003') process.exit();
      this.lastKey = key;
    });
  }
  onTrigger() {
    switch(this.manager.value) {
      case 0xfffe:
        console.log('\x1B[2J');
        break;
      case 0xffff:
        this.output = this.lastKey.charCodeAt(0) & 0b1111111;
        break;
      default:
        io.stdout.write(String.fromCharCode(this.manager.value & 0b1111111))
    }
  }
}


export class IOManager {
  constructor() {
    this.value = 0;  
    this.connectDevice(IODevice, {}, 0);
  }
  connectDevice(device, params, port = 0) {
    if(device == null) throw new Error('No device');
    if(typeof device === 'string') {
      device = devices[device]
    }
    this.device = new device(this, params);
    return this;
  }
}

class Registers extends Uint8Array {
  constructor(initialState) {
    if(initialState != null) {
      super([0,0,0,0].map((v,i) => initialState[i] ?? v));
    } else {
      super([0,0,0,0]);
    }
  }
  set a(v) { this[0] = v; }
  set b(v) { this[1] = v; }
  set c(v) { this[2] = v; }
  set d(v) { this[3] = v; }
  get a() { return this[0]; }
  get b() { return this[1]; }
  get c() { return this[2]; }
  get d() { return this[3]; }
}

export class MMU {
  constructor(rom) {
    this.rom = new Uint16Array(0x8000).fill(0);
    this.ram = new Uint16Array(0x8000).fill(0);
    if(rom) this.load(rom);
    //console.log(Array.from(this.rom).map(v => v.toString(16)).join(','));
    console.log('MMU init done');
  }
  load(rom) {
    console.log('Processing ROM data (size = ' + rom.length + ')')
    for(let i = 0; i < rom.length; i++) {
      const v = rom[i];
      if(!(i & 1)) this.rom[i] = 0;
      this.rom[i >> 1] |= rom[i] << ((i & 1) ? 0 : 8);
    };
  }
  read(a) {
    return ((a & 0x8000) ? this.ram : this.rom)[a & 0x7fff];
  }
  write(a,v) {
    if(!(a & 0x8000)) return;
    this.ram[a & 0x7fff] = v;
  }
}

export const ALU_ADD = 0;
export const ALU_SUB = 1;
export const ALU_MUL = 2;
export const ALU_CMP = 3;

export default class C3State {
  constructor(param) {
    if((param.rom == null) && param.path && !(param.sandboxed || param.safe)) {
      param.rom = new Uint8Array(fs.readFileSync(param.path));
    }
    this.manager = new IOManager();
    this.reg = new Registers(param.initialState ?? param.registers);
    this.mmu = new MMU(param.rom);
    this.flags = {
      carry: false,
      zero: false,
    }
    this.pc = 0;
    this.sp = 0xffff;
    this.state = 0;
  }
  step() {
    if(this.state) return;
    const opcode = this.mmu.read(this.pc++);
    const sel = !!(opcode & 0x80);
    const reg = opcode & 0x60;
    const instr = opcode & 0x1f;
    if(instr === 0x00) {
      return 1; //nop only takes no cycles except fetch
    } else {
      if(!sel) {
        switch(instr) {
          case 0x01: //RST
            this.pc = 0;
            this.reg = new Registers();
            return 3;
          case 0x02: //STOP
            this.state = 1;
            return 3;
          case 0x04: //SWAP
            const swap = this.reg.a;
            this.reg.a = this.reg[reg];
            this.reg[reg] = swap;
            return 3;
          case 0x05: //LD r,A
          case 0x06: //LD r,B
          case 0x07: //LD r,C
          case 0x08: //LD r,D
            this.reg[reg] = this.reg[instr-0x05];
            return 2;
          case 0x09: //LD r,[PC++]
            this.reg[reg] = this.mmu.read(this.pc++);
            return 3;
          case 0x0A: //LD A,[r]
            this.reg.a = this.mmu.read(this.reg[reg]);
            return 3;
          case 0x0B:
            this.mmu.write(this.reg[reg], this.reg.a);
            return 2;
          case 0x0C: //ADD A,r
          case 0x0D: //SUB A,r
          case 0x0E: //MUL A,r
          case 0x0F: //CMP A,r
            let aluA = this.reg.a;
            let aluB = this.reg[reg];
            let aluOperation = instr - 0x0B;
            switch(aluOperation) {
              case ALU_ADD:
                aluA += aluB;
                this.flags.carry = aluA > 0xffff;
                break;
              case ALU_SUB:
                aluA -= aluB;
                this.flags.carry = aluA < 0;
                break;
              case ALU_MUL:
                aluA *= aluB;
                break;
              case ALU_CMP:
                this.flags.carry = false;
                if(aluA > aluB) {
                  aluA = 2;
                  this.flags.carry = true;
                } else if(aluA < aluB) {
                  aluA = 1;
                }
            }
            this.reg.a = aluA & 0xffff;
            this.flags.zero = (this.reg.a == 0);
            return 3;
          case 0x10: // JP r
            this.pc = this.reg[reg];
            return 2;
          case 0x11: // JP Z,r
          case 0x12: // JP NZ,r
          case 0x13: // JP C,r
          case 0x14: // JP NC,r
            if(this.flags[(instr >= 0x13) ? 'carry' : 'zero'] ^ (1-(instr & 1))) {
              this.pc = this.reg[reg];
            }
            return 2;
          case 0x15: //IO_HALT
            this.state = 2;
            return 3;
          case 0x16: //IO_TRIG
            this.manager.device.onTrigger();
            return 3;
          case 0x17: //IO_READ
            this.reg[reg] = this.manager.device.output;
            return 3;
          case 0x18: //IO_WRT
            this.manager.value = this.reg[reg];
            return 3;
          default:
            break;
        }
      } else {
        switch(instr) {
          case 0x01: //PUSH r
            this.mmu.write(this.sp--, this.reg[reg]);
            return 3;
          case 0x02: //POP r
            this.reg[reg] = this.mmu.read(++this.sp);
            return 3;
          case 0x03: //CALL r
            this.mmu.write(this.sp--, this.pc);
            this.pc = this.reg[reg];
            return 3;
          case 0x04: //RET
            this.pc = this.mmu.read(++this.sp);
            return 3;
          default:
            break;
        }
      }
      return 3; //invalid instruction wastes all two full cycles
    }
  }
}

