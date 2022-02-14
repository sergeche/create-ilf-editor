import './style.css';
import { Editor, TokenFormat } from '.';

declare global {
    interface Window {
        editor: Editor;
    }
}

const editorElem = document.querySelector<HTMLDivElement>('#editor')!
const editor = new Editor(editorElem, {
    value: 'Hello 😇 world!',
    shortcuts: {
        'Cmd+Z': editor => editor.undo(),
        'Cmd+Y': editor => editor.redo(),
        'Cmd+Shift+Z': editor => editor.redo(),
        'Cmd+B': editor => editor.toggleFormat(TokenFormat.Bold),
        'Cmd+I': editor => editor.toggleFormat(TokenFormat.Italic),
        'Cmd+U': editor => editor.toggleFormat(TokenFormat.Strike),
        'Cmd+Shift+C': editor => editor.toggleFormat(TokenFormat.Monospace),
        'Ctrl+L': editor => editor.pickLink(),
    }
});

window['editor'] = editor;