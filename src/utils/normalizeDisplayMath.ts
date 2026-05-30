/**
 * remark-math / micromark treat `$$expr$$` on a single line as inline math
 * (mathText). Display math (mathFlow) requires newlines around the expression:
 *
 * $$
 * expr
 * $$
 *
 * @see https://github.com/micromark/micromark-extension-math#syntax
 */
export function normalizeDisplayMath(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*)\$\$\s*([\s\S]+?)\s*\$\$(\s*)$/)
      if (!match) return line

      const [, indent, body] = match
      if (body.includes('$$')) return line

      const expr = body.trim()
      if (!expr) return line

      return `${indent}$$\n${expr}\n${indent}$$`
    })
    .join('\n')
}
