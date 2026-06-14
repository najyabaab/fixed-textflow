import Parser from './src/content/modules/commandParser'
import { CommandExecutor } from './src/content/modules/commandExecutor'
import type { ExecutorContext } from './src/content/modules/commandExecutor'

const cmds = Parser.parseAll('{= contains("hello", "ell")}')
console.log('Parsed commands:', JSON.stringify(cmds, null, 2))

// Also check what the full executor produces
const ctx: ExecutorContext = {
  formValues: {}, variables: { url: '', title: '', selection: '', trigger: 'test' },
  snippets: {}, clipboardText: 'clipped', siteData: {}, userData: {},
}
const r = await CommandExecutor.execute('{= contains("hello", "ell")}', ctx)
console.log('\nExecutor result:', JSON.stringify(r))

// Direct evaluateWithSandbox test
const result = await CommandExecutor.evaluateWithSandbox('contains("hello", "ell")', ctx)
console.log('\nevaluateWithSandbox result:', JSON.stringify(result))
