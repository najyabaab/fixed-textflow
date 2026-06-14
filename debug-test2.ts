import { CommandExecutor } from './src/content/modules/commandExecutor'
import type { ExecutorContext } from './src/content/modules/commandExecutor'
import Parser from './src/content/modules/commandParser'

async function main() {
const ctx: ExecutorContext = {
  formValues: {}, variables: { url: '', title: '', selection: '', trigger: 'test' },
  snippets: {}, clipboardText: 'clipped', siteData: {}, userData: {},
}

async function test(content: string) {
  const r = await CommandExecutor.execute(content, ctx)
  console.log(`"${content}" → ${JSON.stringify(r.content)}`)
}

await test('{= contains("hello", "ell")}')
await test('{= 2 + 3}')
await test('{= 1=2 ? "a" : "b"}')
await test('{if: 1=2}A{elseif: 2=2}B{else}C{endif}')

let text = '{if: 1=2}A{elseif: 2=2}B{else}C{endif}'
const blocks = Parser.parseBlocks(text)
console.log(`\n--- ${text} ---`)
console.log(JSON.stringify(blocks.map(b => ({
  cmd: b.command,
  condition: b.args.raw,
  elseifs: b.elseifs?.map(e => e.condition),
  elseifContent: b.elseifs?.map(e => e.content),
  elseContent: b.elseContent,
  content: b.content
})), null, 2))
}
main().catch(e => console.error(e))
