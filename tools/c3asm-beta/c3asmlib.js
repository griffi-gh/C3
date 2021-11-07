import path from 'path';

export class CompileError extends Error {
  constructor(message) {
    super(message);
    this.name = "CompileError";
  }
}

export const ROM_SIZE = 0x8000;
export const RAM_SIZE = 0x8000;
export const REG_MAP = { A: 0, B: 1, C: 2, D: 3 };

export function compileString(str, reqPath) {
   const rom = Uint16Array(ROM_SIZE).fill(0);
   let lines = str.replace(/\r/g,'').split('\n').map(v => v.split(';')).flat().map(v => v.trim()).filter(v => v.length > 0);
   lines.forEach((v,i,a) => {
      
   });
}

export function compileFile(filename) {
   filename = path.normalize(filename);
   return compileString(
      fs.readFileSync(filename,'utf8'),
      path.dirname(filename)
   );
}