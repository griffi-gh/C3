import * as pathlib from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv))
	.usage('$0 <path> [args]')
	.command('<path> [args]', '', (yargs) => {
	  yargs.positional('path', {
	    describe: 'Path to C3 binary file to run',
	    type: 'string',
	    default: 'http://www.google.com'
	  })
  })
  .demandCommand()
  .help()
  .option('A',{
	  describe: 'Initial A register state',
	  type: 'number'
	})
  .option('B',{
	  describe: 'Initial B register state',
	  type: 'number'
	})
  .option('C',{
	  describe: 'Initial C register state',
	  type: 'number'
	})
  .option('D',{
	  describe: 'Initial D register state',
	  type: 'number'
	})
	.parse();
const path = pathlib.resolve(process.cwd(), argv._[0]);
console.log(path,JSON.stringify(argv,null,2))