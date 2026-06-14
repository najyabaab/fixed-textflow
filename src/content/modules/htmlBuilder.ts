export const HtmlBuilder = {
  wrapHtml(text: string): string {
    const escaped = this.escapeHtml(text)
    const withBreaks = escaped
      .replace(/\n{3,}/g, '<br><br>')
      .replace(/\n/g, '<br>')
    return `<meta charset="utf-8"><div style="font-family: inherit; font-size: inherit; line-height: inherit; color: inherit;">${withBreaks}</div>`
  },

  wrapHtmlWithStyles(text: string, element: Element): string {
    const styles = window.getComputedStyle(element)
    const escaped = this.escapeHtml(text)
    const withBreaks = escaped
      .replace(/\n{3,}/g, '</div><div style="margin-top: 1em;">')
      .replace(/\n/g, '<br>')
    const family = styles.fontFamily
    const size = styles.fontSize
    const color = styles.color
    const lineHeight = styles.lineHeight
    return `<meta charset="utf-8"><div style="font-family:${family};font-size:${size};color:${color};line-height:${lineHeight};white-space:pre-wrap">${withBreaks}</div>`
  },

  textToHtml(text: string): string {
    return this.escapeHtml(text)
      .replace(/\n/g, '<br>')
      .replace(/  /g, '&nbsp; ')
  },

  escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  },

  buildClipboardData(text: string, element: Element): { text: string; html: string } {
    return {
      text,
      html: this.wrapHtmlWithStyles(text, element),
    }
  },

  wrapHtmlFragment(html: string): string {
    return `<meta charset="utf-8">${html}`
  },
}

export default HtmlBuilder
