import * as pathlib from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import C3 from './c3sim.mjs';

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
      type: 'array',
      default: [0, 0, 0, 0]
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
    .option('D', {
      describe: 'Initial D register state',
      type: 'number',
    })
    .option('device', {
      alias: 'd',
      describe: 'Type of device to connect',
      type: 'string',
      default: 'ttyBasic',
    })
    .option('debug', {
      alias: 'b',
      describe: 'Log register state',
      type: 'boolean',
      default: false
    })
    .parse();
  return {
    debug: argv.debug,
    device: argv.device,
    path: pathlib.resolve(process.cwd(), argv._[0]),
    initialState: Array.from({...argv.state, length:4}, v => v ?? 0).map((longVal,i) => {
      let shortVal = argv[['A','B','C','D'][i]];
      return parseInt(shortVal ?? longVal);
    })
  };
}
const arg = parseArgs();

console.log('Loading file: ' + arg.path);
console.log('Registers: ' + arg.initialState.join(', '));

console.log('Starting cpu');
const state = new C3(arg);
console.log('Initializing device ('+arg.device+')');
state.manager.connectDevice(arg.device);
let cycles = 0;
while(true) {
  if(arg.debug) state.log();
  cycles += state.step();
  if(state.state === 1) {
    break;
  }
}
console.log('\n\nExecution stopped ('+cycles+' cpu cycles)');