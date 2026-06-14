import {
  parseLiveValidationArgs,
  printLiveValidationHelp,
  printLiveValidationTable,
  runLiveValidations,
} from './lib/live-validation.mjs'

const args = process.argv.slice(2)
const options = parseLiveValidationArgs(args)

if (options.help) {
  printLiveValidationHelp()
  process.exit(0)
}

const results = await runLiveValidations(options)

if (options.json) {
  console.log(JSON.stringify(results, null, 2))
} else {
  printLiveValidationTable(results)
}

const failed = results.some((result) => !result.pass)
process.exit(failed ? 1 : 0)
