// Direct evalExpression test
const SANDBOX_FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  contains: (s: unknown, find: string) => String(s).includes(find),
  upper: (s: unknown) => String(s).toUpperCase(),
}

function evalExpression(input: string, vars: Record<string, unknown>, helpers?: Record<string, (...args: unknown[]) => unknown>): unknown {
    if (!input) return ''
    input = input.trim()
    const allHelpers = helpers || SANDBOX_FUNCTIONS
    input = input.replace(/(?<![<>!=])=(?!=)/g, '==')

    const tokenize = (s: string): { type: string; value: string }[] => {
      const tokens: { type: string; value: string }[] = []
      let i = 0
      while (i < s.length) {
        if (/\s/.test(s[i])) { i++; continue }
        if ('()+-*/%,?:=!<>&|'.includes(s[i])) {
          if (s[i] === '=' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '==' }); i += 2; continue }
          if (s[i] === '!' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '!=' }); i += 2; continue }
          if (s[i] === '!' && s[i + 1] !== '=') { tokens.push({ type: 'op', value: '!' }); i++; continue }
          if (s[i] === '<' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '<=' }); i += 2; continue }
          if (s[i] === '>' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '>=' }); i += 2; continue }
          if (s[i] === '&' && s[i + 1] === '&') { tokens.push({ type: 'op', value: '&&' }); i += 2; continue }
          if (s[i] === '|' && s[i + 1] === '|') { tokens.push({ type: 'op', value: '||' }); i += 2; continue }
          tokens.push({ type: 'op', value: s[i] }); i++; continue
        }
        if (/[\d.]/.test(s[i])) {
          let num = ''
          while (i < s.length && /[\d.eE]/.test(s[i])) num += s[i++]
          if (s[i] === 'x' || s[i] === 'X') { num += s[i++]; while (i < s.length && /[\da-fA-F]/.test(s[i])) num += s[i++] }
          tokens.push({ type: 'num', value: num }); continue
        }
        if ((s[i] === '"' || s[i] === "'") && s[i] === s[i]) {
          const quote = s[i++]; let str = ''
          while (i < s.length && s[i] !== quote) { if (s[i] === '\\') i++; str += s[i++] }
          i++
          tokens.push({ type: 'str', value: str }); continue
        }
        if (/[a-zA-Z_$]/.test(s[i])) {
          let id = ''
          while (i < s.length && /[\w$]/.test(s[i])) id += s[i++]
          if (id === 'true') { tokens.push({ type: 'num', value: '1' }); continue }
          if (id === 'false') { tokens.push({ type: 'num', value: '0' }); continue }
          if (id === 'null') { tokens.push({ type: 'null', value: 'null' }); continue }
          tokens.push({ type: 'id', value: id }); continue
        }
        return []
      }
      return tokens
    }

    let tokens = tokenize(input)
    console.log('Tokens:', JSON.stringify(tokens))

    if (tokens.length === 0) return input

    let pos = 0
    const peek = () => pos < tokens.length ? tokens[pos].value : ''
    const consume = () => pos < tokens.length ? tokens[pos++].value : ''
    const peekType = () => pos < tokens.length ? tokens[pos].type : ''

    const parseExpr = (): unknown => parseCond()
    const parseCond = (): unknown => {
      let left = parseOr()
      if (peek() === '?') { consume(); const trueVal = parseExpr(); if (peek() === ':') { consume(); const falseVal = parseExpr(); return left ? trueVal : falseVal } }
      return left
    }
    const parseOr = (): unknown => { let left = parseAnd(); while (peek() === '||') { consume(); const right = parseAnd(); left = left || right } return left }
    const parseAnd = (): unknown => { let left = parseCompare(); while (peek() === '&&') { consume(); const right = parseCompare(); left = left && right } return left }
    const parseCompare = (): unknown => {
      let left = parseAddSub()
      while (['==', '!=', '<', '>', '<=', '>='].includes(peek())) {
        const op = consume(); const right = parseAddSub()
        if (op === '==') left = left == right
        else if (op === '!=') left = left != right
        else if (op === '<') left = (left as number) < (right as number)
        else if (op === '>') left = (left as number) > (right as number)
        else if (op === '<=') left = (left as number) <= (right as number)
        else if (op === '>=') left = (left as number) >= (right as number)
      }
      return left
    }
    const parseAddSub = (): unknown => { let left = parseMulDiv(); while (peek() === '+' || peek() === '-') { const op = consume(); const right = parseMulDiv(); if (op === '+') left = (left as number) + (right as number); else left = (left as number) - (right as number) } return left }
    const parseMulDiv = (): unknown => { let left = parseUnary(); while (peek() === '*' || peek() === '/' || peek() === '%') { const op = consume(); const right = parseUnary(); if (op === '*') left = (left as number) * (right as number); else if (op === '/') left = (left as number) / (right as number); else if (op === '%') left = (left as number) % (right as number) } return left }
    const parseUnary = (): unknown => { if (peek() === '-') { consume(); return -(parseUnary() as number) }; if (peek() === '!') { consume(); return !parseUnary() }; return parsePrimary() }
    const parsePrimary = (): unknown => {
      if (peek() === '(') { consume(); const val = parseExpr(); if (peek() === ')') consume(); return val }
      if (peekType() === 'num') return parseFloat(consume())
      if (peekType() === 'str') return consume()
      if (peekType() === 'null') { consume(); return null }
      if (peekType() === 'id') {
        const name = consume()
        if (peek() === '(') {
          consume(); const args: unknown[] = []
          console.log(`  Function ${name}(), pos before args: ${pos}, peek: ${peek()}`)
          if (peek() !== ')') {
            const arg1 = parseExpr()
            console.log(`  Arg1: ${JSON.stringify(arg1)}, pos: ${pos}, peek: ${peek()}`)
            args.push(arg1)
            while (peek() === ',') {
              consume();
              const argN = parseExpr()
              console.log(`  ArgN: ${JSON.stringify(argN)}, pos: ${pos}, peek: ${peek()}`)
              args.push(argN)
            }
          }
          if (peek() === ')') consume()
          console.log(`  Args: ${JSON.stringify(args)}`)
          const fn = allHelpers[name] || (name.startsWith('$') ? allHelpers[name] : undefined)
          if (fn) { 
            const result = fn(...args)
            console.log(`  Result: ${JSON.stringify(result)}`)
            return result
          }
          return name
        }
        if (name in vars) return vars[name]
        return name
      }
      return ''
    }

    try { const result = parseExpr(); return result === undefined ? '' : result }
    catch (e) { console.log('Error:', e); return input }
  }

console.log('\n--- contains("hello", "ell") ---')
console.log('Result:', evalExpression('contains("hello", "ell")', {}))
console.log('\n--- upper("hello") ---')
console.log('Result:', evalExpression('upper("hello")', {}))
