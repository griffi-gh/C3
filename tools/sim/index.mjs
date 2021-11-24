import * as pathlib from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

function parseArgs(a = process.argv) {
  const argv = yargs(hideBin(process.argv))
    .usage('$0 <path> [args]')
    .command('<path> [args]', '', yargs => yargs.positional('path', {
        describe: 'Path to C3 binary file to run',
        type: 'string',
        default: null,
        demand: true
      })
    )
    .demandCommand()
    .help()
    .alias('version','v')
    .alias('help','h')
    .option('state',{
      alias: 's',
      describe: 'Initial register state',
      type: 'string',
      default: '0,0,0,0'
    })
    .option('A',{
      describe: 'Initial A register state',
      type: 'number',
    })
    .option('B',{
      describe: 'Initial B register state',
      type: 'number',
    })
    .option('C',{
      describe: 'Initial C register state',
      type: 'number',
    })
    .option('D',{
      describe: 'Initial D register state',
      type: 'number',
    })
    .parse();
  return {
    path: pathlib.resolve(process.cwd(), argv._[0]),
    initialState: Array.from({...(argv.state.split(',')),length:4}, v => v??0).map((longVal,i) => {
      let shortVal = argv[['A','B','C','D'][i]];
      return (shortVal ?? longVal)|0;
    })
  };
}
const arg = parseArgs();

class IODevice {
  constructor() {}
  io_trig() {}
  io_read() { return 0; }
}

class IOManager {
  constructor() {
    this.device = new IODevice();
    this.value = 0;  
  }
}

console.log('Loading file: ' + arg.path);
console.log('Registers: ' + arg.initialState.join(', '));