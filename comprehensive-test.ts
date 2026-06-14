import CommandParser from './src/content/modules/commandParser'
import { CommandExecutor } from './src/content/modules/commandExecutor'
import type { ExecutorContext } from './src/content/modules/commandExecutor'

function makeContext(extraVars: Record<string, unknown> = {}, formValues: Record<string, string | boolean | string[]> = {}): ExecutorContext {
  return {
    formValues,
    variables: { url: '', title: '', selection: '', trigger: 'test', ...extraVars },
    snippets: {},
    clipboardText: 'clipped',
    currentSnippetShortcut: 'test',
    siteData: {},
    userData: {},
  }
}

interface TestCase {
  name: string
  content: string
  expected: string | RegExp
}

const formulaTests: TestCase[] = [
  { name: 'addition', content: '{= 2 + 3}', expected: '5' },
  { name: 'subtraction', content: '{= 10 - 4}', expected: '6' },
  { name: 'multiplication', content: '{= 3 * 4}', expected: '12' },
  { name: 'division', content: '{= 10 / 2}', expected: '5' },
  { name: 'modulo', content: '{= 10 % 3}', expected: '1' },
  { name: 'parens', content: '{= (1 + 2) * 3}', expected: '9' },
  { name: 'precedence', content: '{= 2 + 3 * 4}', expected: '14' },
  { name: 'unary-neg', content: '{= -5 + 3}', expected: '-2' },
  { name: 'unary-not', content: '{= !0}', expected: 'true' },
  { name: 'eq-true', content: '{if: 2=2}Y{endif}', expected: 'Y' },
  { name: 'eq-false', content: '{if: 1=2}Y{else}N{endif}', expected: 'N' },
  { name: 'neq-true', content: '{if: 1 != 2}Y{endif}', expected: 'Y' },
  { name: 'lt-true', content: '{if: 1 < 2}Y{endif}', expected: 'Y' },
  { name: 'gt-true', content: '{if: 2 > 1}Y{endif}', expected: 'Y' },
  { name: 'lte-true', content: '{if: 2 <= 2}Y{endif}', expected: 'Y' },
  { name: 'gte-true', content: '{if: 2 >= 2}Y{endif}', expected: 'Y' },
  { name: 'and-true', content: '{if: 1=1 && 2=2}Y{endif}', expected: 'Y' },
  { name: 'and-false', content: '{if: 1=1 && 1=2}Y{else}N{endif}', expected: 'N' },
  { name: 'or-true', content: '{if: 1=2 || 2=2}Y{endif}', expected: 'Y' },
  { name: 'or-false', content: '{if: 1=2 || 2=3}Y{else}N{endif}', expected: 'N' },
  { name: 'not', content: '{if: !0}Y{endif}', expected: 'Y' },
  { name: 'ternary-true', content: '{= 1=1 ? "yes" : "no"}', expected: 'yes' },
  { name: 'ternary-false', content: '{= 1=2 ? "yes" : "no"}', expected: 'no' },
  { name: 'var-simple', content: '{= x}', expected: '42', ctx: { x: 42 } },
  { name: 'var-expr', content: '{= x + 1}', expected: '43', ctx: { x: 42 } },
  { name: 'var-string', content: '{= name}', expected: 'Alice', ctx: { name: 'Alice' } },
  { name: 'upper', content: '{= upper("hello")}', expected: 'HELLO' },
  { name: 'lower', content: '{= lower("HELLO")}', expected: 'hello' },
  { name: 'len-string', content: '{= len("hello")}', expected: '5' },
  { name: 'contains-true', content: '{= contains("hello", "ell")}', expected: 'true' },
  { name: 'if-fn-true', content: '{= if(1=1, "a", "b")}', expected: 'a' },
  { name: 'if-fn-false', content: '{= if(1=2, "a", "b")}', expected: 'b' },
  { name: 'time-date', content: '{time: YYYY-MM-DD}', expected: /^\d{4}-\d{2}-\d{2}$/ },
  { name: 'time-year', content: '{time: YYYY}', expected: '2026' },
  { name: 'clipboard', content: 'x{clipboard}x', expected: 'xclippedx' },
]

const blockTests: TestCase[] = [
  { name: 'run-simple', content: '{run:x = 42}{endrun}{= x}', expected: '42' },
  { name: 'run-multi', content: '{run:x = 10; y = 20}{endrun}{= x + y}', expected: '30' },
  { name: 'run-inline-expr', content: '{run: x = 42}{endrun}The answer is {= x}', expected: 'The answer is 42' },
  { name: 'repeat-count', content: '{repeat: 3}A{endrepeat}', expected: 'AAA' },
  { name: 'repeat-index', content: '{repeat: 3}@index{endrepeat}', expected: '123' },
  { name: 'repeat-i', content: '{repeat: 3}@i{endrepeat}', expected: '012' },
  { name: 'if-simple', content: '{if: 1=1}A{endif}', expected: 'A' },
  { name: 'if-else', content: '{if: 1=2}A{else}B{endif}', expected: 'B' },
  { name: 'if-elseif', content: '{if: 1=2}A{elseif: 2=2}B{else}C{endif}', expected: 'B' },
  { name: 'if-elseif-false', content: '{if: 1=2}A{elseif: 2=3}B{else}C{endif}', expected: 'C' },
  { name: 'repeat-eq-index', content: '{repeat: 3}{= @index}{endrepeat}', expected: '123' },
  { name: 'repeat-eq-i', content: '{repeat: 3}{= @i}{endrepeat}', expected: '012' },
  { name: 'set-var', content: '{set: x = 42}{= x}', expected: '42' },
  { name: 'set-then-expr', content: '{set: x = 10}{set: y = 20}{= x + y}', expected: '30' },
]

const multiCommandTests: TestCase[] = [
  { name: 'multi-set-and-expr', content: '{set:x=1}{set:y=2}{= x + y}', expected: '3' },
  { name: 'multi-set-if-expr', content: '{set:x=42}{if: x=42}yes{endif}', expected: 'yes' },
  { name: 'multi-set-expr-text', content: 'x={set:x=5}{= x}y={= x}', expected: 'x=5y=5' },
  { name: 'multi-if-expr', content: '{if: 1=1}{set:x=10}{= x}{endif}', expected: '10' },
  { name: 'multi-expr-if-expr', content: '{= 2+2}{if: 1=1}{= 3+3}{endif}', expected: '46' },
  { name: 'multi-repeat-expr', content: '{repeat: 3}{set:acc=0}{= acc}{endrepeat}', expected: '000' },
  { name: 'multi-if-else-expr', content: '{if: 1=2}A{else}{= 42}{endif}', expected: '42' },
  { name: 'multi-run-expr', content: '{run:x = {= 20 + 1}}{endrun}{= x}', expected: '21' },
  { name: 'multi-nested-combo', content: '{repeat: 2}{if: @i=0}{= first}{else}{= second}{endif}{endrepeat}', expected: 'firstsecond' },
]

const nestedTests: TestCase[] = [
  { name: 'nested-if-in-if', content: '{if: 1=1}{if: 2=2}A{endif}{endif}', expected: 'A' },
  { name: 'nested-repeat-in-if', content: '{if: 1=1}{repeat: 2}B{endrepeat}{endif}', expected: 'BB' },
  { name: 'nested-if-in-repeat', content: '{repeat: 3}{if: 1=1}C{endif}{endrepeat}', expected: 'CCC' },
  { name: 'nested-run-in-if', content: '{if: 1=1}{run:x=5}{endrun}{= x}{endif}', expected: '5' },
  { name: 'nested-run-in-repeat', content: '{repeat: 2}{run:x={= @index}}{endrun}{= x}{endrepeat}', expected: '12' },
]

const formTests: TestCase[] = [
  { name: 'formtext-value', content: '{formtext: name=field}', expected: 'hello', form: { field: 'hello' } },
  { name: 'formtext-override-default', content: '{formtext: name=field; default=world}', expected: 'hi', form: { field: 'hi' } },
  { name: 'formtext-mixed-value', content: 'Hello {formtext: name=name}!', expected: 'Hello Alice!', form: { name: 'Alice' } },
  { name: 'formmenu-selected', content: '{formmenu: name=color; red; green; blue}', expected: 'green', form: { color: 'green' } },
  { name: 'formtoggle-on', content: '{formtoggle: name=flag}', expected: 'yes', form: { flag: true } },
  { name: 'form-toggle-block-on', content: '{formtoggle: name=flag}visible{endformtoggle}', expected: 'visible', form: { flag: true } },
  { name: 'formmenu-mixed-value', content: 'You picked {formmenu: name=color; red; green; blue}', expected: 'You picked blue', form: { color: 'blue' } },
]

const edgeTests: TestCase[] = [
  { name: 'empty-expr', content: '{= }', expected: '' },
  { name: 'mixed-spacing', content: '{= 1+2  * 3}', expected: '7' },
  { name: 'floats', content: '{= 1.5 + 2.5}', expected: '4' },
  { name: 'repeat-zero', content: '{repeat: 0}A{endrepeat}', expected: '' },
  { name: 'repeat-hundred', content: '{repeat: 100}X{endrepeat}', expected: new Array(101).join('X') },
  { name: 'repeat-over-limit', content: '{repeat: 200}X{endrepeat}', expected: new Array(101).join('X') },
]

const allTests = [...formulaTests, ...blockTests, ...multiCommandTests, ...nestedTests, ...formTests, ...edgeTests]

async function run() {
  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const tc of allTests) {
    const ctx = makeContext((tc as any).ctx || {}, (tc as any).form || {})
    try {
      const result = await CommandExecutor.execute(tc.content, ctx)
      const actual = result.content
      const match = tc.expected instanceof RegExp ? tc.expected.test(actual) : actual === tc.expected
      if (match) {
        passed++
        process.stdout.write('.')
      } else {
        failed++
        failures.push(`${tc.name}: "${tc.content}" → ${JSON.stringify(actual)} (expected ${tc.expected})`)
        process.stdout.write('F')
      }
    } catch (e: any) {
      failed++
      failures.push(`${tc.name}: "${tc.content}" → EXCEPTION: ${e.message}`)
      process.stdout.write('E')
    }
  }

  console.log(`\n\n${passed}/${allTests.length} passed, ${failed} failed`)
  if (failures.length > 0) {
    console.log('\nFailures:')
    for (const f of failures) console.log('  ' + f)
  }
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(1) })
