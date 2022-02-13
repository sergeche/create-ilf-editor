import type { Token } from '../parser';
import { TokenFormat } from '../parser';
import { removeText, replaceText, setFormat, setLink, slice } from '../formatting';
import type { TokenFormatUpdate } from '../formatting';
import { isCustomLink, tokenForPos } from '../formatting/utils';
import type { TextRange, Model } from './types';

const skipInputTypes = new Set([
    'insertOrderedList',
    'insertUnorderedList',
    'deleteOrderedList',
    'deleteUnorderedList'
]);

export function toggleFormat(model: Model, format: TokenFormat, from: number, to: number): Model {
    let source: Token | undefined;
    if (from !== to) {
        const fragment = slice(model, from, to);
        source = fragment[0];
    } else {
        const pos = tokenForPos(model, from, 'start');
        if (pos.index !== -1) {
            source = model[pos.index];
        }
    }

    if (source) {
        const update: TokenFormatUpdate = source.format & format
            ? { remove: format }
            : { add: format };

        return setFormat(model, update, from, to - from);
    }

    return model;
}

export function applyFormatFromFragment(model: Model, fragment: Model, offset = 0): Model {
    fragment.forEach(token => {
        const len = token.value.length;
        if (token.format) {
            model = setFormat(model, { add: token.format }, offset, len);
        }

        if (isCustomLink(token)) {
            model = setLink(model, token.link, offset, len);
        }

        offset += len;
    });

    return model;
}

export function updateFromInputEvent(model: Model, range: TextRange, evt: InputEvent, inputText?: string): Model {
    if (skipInputTypes.has(evt.inputType)) {
        evt.preventDefault();
        return model;
    }

    const [from, to] = range;

    if (evt.inputType.startsWith('format')) {
        // Применяем форматирование: скорее всего это Safari с тачбаром
        switch (evt.inputType) {
            case 'formatBold':
                model = toggleFormat(model, TokenFormat.Bold, from, to);
                break;
            case 'formatItalic':
                model = toggleFormat(model, TokenFormat.Italic, from, to);
                break;
            case 'formatUnderline':
                model = toggleFormat(model, TokenFormat.Underline, from, to);
                break;
            case 'formatStrikeThrough':
                model = toggleFormat(model, TokenFormat.Strike, from, to);
                break;
        }

        // evt.preventDefault();
        return model;
    }

    if (evt.inputType.startsWith('insert')) {
        // В Chrome в событии `input` на действие insertReplacementText при
        // замене спеллчекера будет отсутствовать информация о заменяемом текст.
        // Поэтому текст пробрасывается снаружи
        const text = getInputEventText(evt) || inputText;
        return text
            ? replaceText(model, from, to - from, text)
            : model;
    }

    if (evt.inputType.startsWith('delete')) {
        return removeText(model, from, to - from);
    }

    console.warn('unknown action type', evt.inputType);
    return model;
}

/**
 * Возвращает текстовое содержимое указанных токенов
 */
export function getText(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

export function getInputEventText(evt: InputEvent): string {
    if (evt.inputType === 'insertParagraph' || evt.inputType === 'insertLineBreak') {
        return '\n';
    }

    if (evt.data != null) {
        return evt.data;
    }

    // Расширение для Safari, используется. например, для подстановки
    // нового значения на длинное нажатие клавиши (е → ё)
    if (evt.dataTransfer) {
        return evt.dataTransfer.getData('text/plain');
    }

    return '';
}
