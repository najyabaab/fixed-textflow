import type { FormField } from './commandParser'

interface FormResult {
  submitted: boolean
  values: Record<string, string | boolean | string[]>
}

export const FormModal = {
  async show(fields: FormField[], snippetName: string): Promise<FormResult> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div')
      overlay.className = 'tf-form-overlay'
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `

      const modal = document.createElement('div')
      modal.className = 'tf-form-modal'
      modal.style.cssText = `
        background: #fff; border-radius: 12px; padding: 24px;
        max-width: 480px; width: 90%; max-height: 80vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      `

      const title = document.createElement('h2')
      title.textContent = snippetName || 'Fill in fields'
      title.style.cssText = 'margin: 0 0 20px; font-size: 18px; font-weight: 600; color: #1a1a1a;'

      const form = document.createElement('form')
      form.onsubmit = (e) => e.preventDefault()

      const fieldElements: Record<string, HTMLElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = {}

      for (const field of fields) {
        const wrapper = document.createElement('div')
        wrapper.style.cssText = 'margin-bottom: 16px;'

        const label = document.createElement('label')
        label.textContent = field.label || field.name
        label.style.cssText = 'display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555;'

        wrapper.appendChild(label)

        if (field.type === 'button') {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.textContent = String(field.content || field.label || 'Button')
          btn.style.cssText = `
            width: 100%; padding: 10px 16px; border: none; border-radius: 8px;
            background: #4f46e5; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500;
          `
          btn.onclick = () => {
            if (field.formatter === 'alert') {
              alert(String(field.default || field.label))
            }
          }
          wrapper.appendChild(btn)
          fieldElements[field.name] = btn
        } else if (field.type === 'toggle') {
          const toggleWrap = document.createElement('div')
          toggleWrap.style.cssText = 'display: flex; align-items: center; gap: 8px;'

          const checkbox = document.createElement('input')
          checkbox.type = 'checkbox'
          checkbox.checked = field.default === true || field.default === 'yes' || field.default === 'true'
          checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;'

          toggleWrap.appendChild(checkbox)
          wrapper.appendChild(toggleWrap)
          fieldElements[field.name] = checkbox
        } else if (field.type === 'menu') {
          const select = document.createElement('select')
          if (field.multiple) select.multiple = true
          select.style.cssText = `
            width: 100%; padding: 8px 12px; border: 1px solid #ddd;
            border-radius: 8px; font-size: 14px; background: #fafafa;
            ${field.multiple ? 'min-height: 100px;' : ''}
          `

          for (const opt of field.options || []) {
            const option = document.createElement('option')
            option.value = opt
            option.textContent = opt
            if (opt === field.default) option.selected = true
            select.appendChild(option)
          }

          wrapper.appendChild(select)
          fieldElements[field.name] = select
        } else if (field.type === 'date') {
          const input = document.createElement('input')
          input.type = 'date'
          input.value = String(field.default || '')
          input.style.cssText = `
            width: 100%; padding: 8px 12px; border: 1px solid #ddd;
            border-radius: 8px; font-size: 14px; background: #fafafa;
          `

          wrapper.appendChild(input)
          fieldElements[field.name] = input
        } else if (field.type === 'paragraph') {
          const textarea = document.createElement('textarea')
          textarea.placeholder = field.placeholder || ''
          textarea.value = String(field.default || '')
          textarea.rows = field.rows || 3
          textarea.style.cssText = `
            width: 100%; padding: 8px 12px; border: 1px solid #ddd;
            border-radius: 8px; font-size: 14px; background: #fafafa;
            resize: vertical; min-height: 60px;
          `

          wrapper.appendChild(textarea)
          fieldElements[field.name] = textarea
        } else {
          const input = document.createElement('input')
          input.type = 'text'
          input.placeholder = field.placeholder || ''
          input.value = String(field.default || '')
          input.style.cssText = `
            width: 100%; padding: 8px 12px; border: 1px solid #ddd;
            border-radius: 8px; font-size: 14px; background: #fafafa;
          `

          wrapper.appendChild(input)
          fieldElements[field.name] = input
        }

        form.appendChild(wrapper)
      }

      const buttonRow = document.createElement('div')
      buttonRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;'

      const cancelBtn = document.createElement('button')
      cancelBtn.type = 'button'
      cancelBtn.textContent = 'Cancel'
      cancelBtn.style.cssText = `
        padding: 8px 16px; border: 1px solid #ddd; border-radius: 8px;
        background: #fff; cursor: pointer; font-size: 14px;
      `
      cancelBtn.onclick = () => {
        overlay.remove()
        resolve({ submitted: false, values: {} })
      }

      const submitBtn = document.createElement('button')
      submitBtn.type = 'submit'
      submitBtn.textContent = 'Insert'
      submitBtn.style.cssText = `
        padding: 8px 16px; border: none; border-radius: 8px;
        background: #4f46e5; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500;
      `

      buttonRow.appendChild(cancelBtn)
      buttonRow.appendChild(submitBtn)

      form.appendChild(buttonRow)
      modal.appendChild(title)
      modal.appendChild(form)
      overlay.appendChild(modal)
      document.body.appendChild(overlay)

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove()
          resolve({ submitted: false, values: {} })
        }
      })

      submitBtn.onclick = () => {
        const values: Record<string, string | boolean | string[]> = {}
        let valid = true

        for (const field of fields) {
          const el = fieldElements[field.name]

          if (field.type === 'button') {
            values[field.name] = field.content || field.name
          } else if (field.type === 'toggle') {
            values[field.name] = (el as HTMLInputElement).checked
          } else if (field.type === 'menu') {
            const select = el as HTMLSelectElement
            if (field.multiple) {
              values[field.name] = Array.from(select.selectedOptions).map(o => o.value)
            } else {
              values[field.name] = select.value
            }
          } else if (field.type === 'date') {
            values[field.name] = (el as HTMLInputElement).value
          } else if (field.type === 'paragraph') {
            values[field.name] = (el as HTMLTextAreaElement).value
          } else {
            values[field.name] = (el as HTMLInputElement).value
          }

          if (field.required && !values[field.name]) {
            valid = false
            el.style.borderColor = '#ef4444'
          }
        }

        if (valid) {
          overlay.remove()
          resolve({ submitted: true, values })
        }
      }
    })
  },
}

export default FormModal
