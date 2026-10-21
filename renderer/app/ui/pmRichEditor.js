// Keep the existing report storage/export format while editing rendered text.
function childrenText(node) {
  return [...node.childNodes].reduce((result, child) => {
    const block = child.nodeType === Node.ELEMENT_NODE && ['DIV', 'P', 'UL', 'OL'].includes(child.tagName);
    return result + (block && result && !result.endsWith('\n') ? '\n' : '') + toReportText(child);
  }, '');
}

function toReportText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\u00a0/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  if (['script', 'style', 'iframe'].includes(tag)) return '';
  const content = childrenText(node);
  if (['b', 'strong'].includes(tag)) return `[b]${content}[/b]`;
  if (['i', 'em'].includes(tag)) return `[i]${content}[/i]`;
  if (tag === 'u') return `[u]${content}[/u]`;
  if (tag === 'li') return `[*] ${content.trim()}\n`;
  if (tag === 'ul' || tag === 'ol') return `[list]\n${content}[/list]\n`;
  if (tag === 'div' || tag === 'p') return `${content}\n`;
  return content;
}

export function initPmRichEditors(root, renderText) {
  root.querySelectorAll('.pmReportBbToolbar').forEach(toolbar => {
    const textarea = document.getElementById(toolbar.dataset.target);
    if (!textarea || textarea.dataset.richEditor) return;
    textarea.dataset.richEditor = 'true';
    textarea.hidden = true;
    const editor = document.createElement('div');
    editor.id = `${textarea.id}Editor`;
    editor.className = 'pmReportRichEditor';
    editor.contentEditable = 'true';
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('aria-label', textarea.id.includes('Done') ? 'Wykonane działania' : 'Plan na kolejny okres');
    editor.dataset.placeholder = 'Wpisz tekst. Zaznacz fragment, aby go sformatować.';
    editor.innerHTML = renderText(textarea.value);
    textarea.after(editor);
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Formatowanie tekstu');
    const commands = { b: 'bold', i: 'italic', u: 'underline', list: 'insertUnorderedList', item: 'removeFormat' };
    const labels = { b: 'Pogrubienie (Ctrl+B)', i: 'Kursywa (Ctrl+I)', u: 'Podkreślenie (Ctrl+U)', list: 'Lista punktowana', item: 'Usuń formatowanie' };
    let range;
    const saveRange = () => {
      const selection = window.getSelection();
      if (selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
        range = selection.getRangeAt(0).cloneRange();
      }
    };
    const updateButtons = () => {
      if (document.activeElement !== editor) return;
      saveRange();
      toolbar.querySelectorAll('[data-bb]').forEach(button => {
        const key = button.dataset.bb;
        if (key !== 'item') button.setAttribute('aria-pressed', String(document.queryCommandState(commands[key])));
      });
    };
    const serialize = () => childrenText(editor).replace(/\n+$/, '');
    const commit = () => {
      textarea.value = serialize();
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      updateButtons();
    };
    toolbar.querySelectorAll('[data-bb]').forEach(button => {
      button.title = labels[button.dataset.bb];
      button.setAttribute('aria-label', labels[button.dataset.bb]);
      if (button.dataset.bb === 'item') button.textContent = 'Wyczyść format';
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => {
        editor.focus();
        const selection = window.getSelection();
        if (range && editor.contains(range.commonAncestorContainer)) {
          selection.removeAllRanges(); selection.addRange(range);
        }
        document.execCommand('styleWithCSS', false, false);
        document.execCommand(commands[button.dataset.bb], false);
        commit();
      });
    });
    editor.addEventListener('input', commit);
    editor.addEventListener('paste', event => {
      event.preventDefault();
      document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
      commit();
    });
    editor.addEventListener('drop', event => event.preventDefault());
    editor.addEventListener('keyup', updateButtons);
    editor.addEventListener('mouseup', updateButtons);
    editor.addEventListener('blur', saveRange);
    document.addEventListener('selectionchange', updateButtons);
    // Also sync programmatic changes and older report drafts without disturbing the caret.
    textarea.addEventListener('input', () => {
      if (serialize() !== textarea.value) editor.innerHTML = renderText(textarea.value);
    });
  });
}
