import parse, { getLength, TokenFormat, TokenType } from '../parser';
import type { Token } from '../parser';
import render, { isEmoji } from '../render';
import type { TextRange, Model } from './types';
import History, { HistoryEntry } from './history';
import { getTextRange, rangeToLocation, setDOMRange, setRange } from './range';
import { getInputEventText, getText, toggleFormat, updateFromInputEvent } from './update';
import { insertText, removeText, replaceText, setFormat, setLink } from '../formatting';
import type { TokenFormatUpdate, TextRange as Rng } from '../formatting';
import Shortcuts from './shortcuts';
import type { ShortcutHandler } from './shortcuts';
import { isElement } from './utils';

const enum DiffActionType {
    Insert = 'insert',
    Remove = 'remove',
    Replace = 'replace',
    Compose = 'compose'
}

export interface EditorOptions {
    /** Значение по умолчанию для редактора */
    value?: string;
    shortcuts?: Record<string, ShortcutHandler<Editor>>;
}

interface EditorEventDetails {
    editor: Editor;
}

export interface EditorEvent<T = EditorEventDetails> extends CustomEvent<T> {}
type MaybePromise<T> = T | Promise<T>;

interface PickLinkOptions {
    /**
     * Функция, которая на вход принимает текущую ссылку, если она есть, и должна
     * вернуть новую ссылку или Promise, который вернёт ссылку
     */
    url: (currentUrl: string) => MaybePromise<string | null>,

    /**
     * Диапазон, для которого нужно выставить ссылку. Если не указан,
     * берётся текущий диапазон
     */
    range?: TextRange;
}

const defaultPickLinkOptions: PickLinkOptions = {
    url: cur => prompt('Введите ссылку', cur)
};

export default class Editor {
    public shortcuts: Shortcuts<Editor>;
    public history: History<Model>;

    private _model: Model = [];
    /**
     * Модель, которая накапливает изменения в режиме композиции.
     * Если есть это свойство, значит, мы сейчас находимся в режиме композиции
     * */
    private composition: Model | null = null;
    /** Диапазон, который сейчас будет обновляться на событие ввода */
    private startRange: TextRange | null = null;
    private pendingText: string | undefined;
    private caret: TextRange = [0, 0];
    private focused = false;
    private expectEnter = false;

    /**
     * @param element Контейнер, в котором будет происходить редактирование
     */
    constructor(public element: HTMLElement, public options: EditorOptions = {}) {
        const value = options.value || '';
        this.model = parse(sanitize(value));
        this.history = new History({
            compactActions: [DiffActionType.Insert, DiffActionType.Remove]
        });
        this.shortcuts = new Shortcuts<Editor>(this);
        this.setup();
        this.history.push(this.model, 'init', this.caret);
    }

    private onKeyDown = (evt: KeyboardEvent) => {
        if (!evt.defaultPrevented) {
            this.shortcuts.handle(evt);
        }
        this.waitExpectedEnter(evt);
    }

    private onCompositionStart = () => {
        this.expectEnter = false;
        this.composition = this.model;
    }

    private onCompositionEnd = () => {
        if (this.composition) {
            const range = getTextRange(this.element)!;
            this.updateModel(
                this.composition,
                DiffActionType.Compose,
                range
            );
            this.setSelection(range[0], range[1]);
            this.composition = null;
        }
    }

    private onBeforeInput = (evt: InputEvent) => {
        this.startRange = null;
        if (evt.getTargetRanges) {
            const ranges = evt.getTargetRanges();
            if (ranges.length) {
                this.startRange = rangeToLocation(this.element, evt.getTargetRanges()[0] as Range);
            }
        }

        if (!this.startRange) {
            this.startRange = getTextRange(this.element)!;
        }

        // В Chrome при замене спеллчекера в событии `input` будет отсутствовать
        // текст, на который делается замена. Поэтому мы запомним его тут
        // и прокинем в событии `input`
        this.pendingText = evt.inputType === 'insertReplacementText' ? getInputEventText(evt) : undefined;

        if ((evt.inputType === 'insertLineBreak' || evt.inputType === 'insertParagraph') && evt.data == null) {
            // В Chrome если сразу после написания текста нажать Shift+Enter,
            // в событии 'beforeinput' будет тип insertLineBreak | insertParagraph,
            // а в 'input' будет 'insertText' и пустое значение. Обработаем эту ситуацию, чтобы
            // запустился waitExpectedEnter
            evt.preventDefault();
        }
    }

    private onInput = (evt: InputEvent) => {
        this.expectEnter = false;
        const nextModel = updateFromInputEvent(this.composition || this.model, this.startRange!, evt, this.pendingText);
        if (this.composition) {
            // Находимся в режиме композиции: накапливаем изменения
            this.composition = nextModel;
        } else {
            // Обычное изменение, сразу применяем результат к UI
            const range = getTextRange(this.element)!;
            this.updateModel(
                nextModel,
                getDiffTypeFromEvent(evt),
                range
            );
            this.setSelection(range[0], range[1]);
        }
        this.pendingText = undefined;
    }

    private onSelectionChange = () => {
        const range = getTextRange(this.element);
        if (range) {
            this.saveSelection(range);
        }
    }

    private onClick = (evt: MouseEvent) => {
        if (isEmoji(evt.target as Node)) {
            // Кликнули на эмоджи, будем позиционировать каретку относительно
            // него
            const elem = evt.target as HTMLElement;
            const rect = elem.getBoundingClientRect();
            const center = rect.left + rect.width * 0.6;
            const range = document.createRange();
            if (evt.clientX < center) {
                range.setStartBefore(elem);
                range.setEndBefore(elem);
            } else {
                range.setStartAfter(elem);
                range.setEndAfter(elem);
            }

            setDOMRange(range);
        }
    }

    private onFocus = () => {
        this.focused = true;
        document.addEventListener('selectionchange', this.onSelectionChange);
    }

    private onBlur = () => {
        this.focused = false;
        document.removeEventListener('selectionchange', this.onSelectionChange);
    }

    get model(): Model {
        return this._model;
    }

    set model(value: Model) {
        if (this._model !== value) {
            this._model = value;
            this.render();
        }
    }

    /**
     * Настраивает редактор для работы. Вынесено в отдельный метод для удобного
     * переопределения
     */
    setup(): void {
        const { element } = this;

        element.contentEditable = 'true';
        element.translate = false;

        // Чек-лист для проверки ввода
        // * Пишем текст в позицию
        // * Выделяем текст и начинаем писать новый
        // * Удаление в пустой строке (Backspace)
        // * Долго зажимаем клавишу (е → ё)
        // * Автозамена при написании текста (Safari)
        // * Пишем текст в китайской раскладке
        // * Автоподстановка слов (iOS, Android)
        // * Punto Switcher
        // * Изменение форматирования из тачбара на Маке
        // * Замена правописания
        element.addEventListener('keydown', this.onKeyDown);
        element.addEventListener('compositionstart', this.onCompositionStart);
        element.addEventListener('compositionend', this.onCompositionEnd);
        element.addEventListener('beforeinput', this.onBeforeInput);
        element.addEventListener('input', this.onInput as (evt: Event) => void);
        element.addEventListener('click', this.onClick);
        element.addEventListener('focus', this.onFocus);
        element.addEventListener('blur', this.onBlur);

        const { shortcuts } = this.options;

        if (shortcuts) {
            this.shortcuts.registerAll(shortcuts);
        }
    }

    /**
     * Вызывается для того, чтобы удалить все связи редактора с DOM.
     */
    dispose(): void {
        this.element.removeEventListener('keydown', this.onKeyDown);
        this.element.removeEventListener('compositionstart', this.onCompositionStart);
        this.element.removeEventListener('compositionend', this.onCompositionEnd);
        this.element.removeEventListener('beforeinput', this.onBeforeInput);
        this.element.removeEventListener('input', this.onInput as (evt: Event) => void);
        this.element.removeEventListener('click', this.onClick);
        this.element.removeEventListener('focus', this.onFocus);
        this.element.removeEventListener('blur', this.onBlur);
        document.removeEventListener('selectionchange', this.onSelectionChange);
    }

    /**
     * Вставляет текст в указанную позицию
     */
    insertText(pos: number, text: string): Model {
        text = sanitize(text);
        const result = this.updateModel(
            insertText(this.model, pos, text),
            DiffActionType.Insert,
            [pos, pos + text.length]
        );
        this.setSelection(pos + text.length);
        return result;
    }

    /**
     * Удаляет указанный диапазон текста
     */
    removeText(from: number, to: number): Model {
        const result = this.updateModel(
            removeText(this.model, from, to - from),
            DiffActionType.Remove,
            [from, to]);

        this.setSelection(from);
        return result;
    }

    /**
     * Заменяет текст в указанном диапазоне `from:to` на новый
     */
    replaceText(from: number, to: number, text: string): Model {
        text = sanitize(text);
        const nextModel = replaceText(this.model, from, to - from, text);
        const result = this.updateModel(nextModel, DiffActionType.Replace, [from, to]);
        this.setSelection(from + text.length);
        return result;
    }

    /**
     * Ставит фокус в редактор
     */
    focus(): void {
        this.element.focus();
        this.setSelection(this.caret[0], this.caret[1]);
    }

    /**
     * Обновляет форматирование у указанного диапазона
     */
    updateFormat(format: TokenFormat | TokenFormatUpdate, from: number, to = from): Model {
        const result = this.updateModel(
            setFormat(this.model, format, from, to - from),
            'format',
            [from, to]
        );
        setRange(this.element, from, to);
        return result;
    }

    /**
     * Переключает указанный формат у заданного диапазона текста
     */
    toggleFormat(format: TokenFormat, from?: number, to?: number): Model {
        if (from == null) {
            const range = this.getSelection();
            from = range[0];
            to = range[1];
        } else if (to == null) {
            to = from;
        }

        const model = toggleFormat(this.model, format, from, to);
        const result = this.updateModel(
            model,
            'format',
            [from, to]
        );

        setRange(this.element, from, to);
        return result;
    }

    /**
     * Выбрать ссылку для указанного диапазона
     * @param callback Функция, которая на вход примет текущую ссылку в указанном
     * диапазоне (если она есть), и должна вернуть новую ссылку. Если надо убрать
     * ссылку, функция должна вернуть пустую строку
     */
    pickLink(options: PickLinkOptions = defaultPickLinkOptions): void {
        const [from, to] = options.range || this.getSelection();
        const token = this.tokenForPos(from);
        const currentUrl = token?.type === TokenType.Link ? token.link : '';

        const result = options.url(currentUrl);
        if (result && typeof result === 'object' && result.then) {
            result.then(nextUrl => {
                if (nextUrl !== currentUrl) {
                    this.setLink(nextUrl, from, to);
                }
            });
        } else if (result !== currentUrl) {
            this.setLink(result as string, from, to);
        }
    }

    /**
     * Ставит ссылку на `url` на указанный диапазон. Если `url` пустой или равен
     * `null`, удаляет ссылку с указанного диапазона
     */
    setLink(url: string | null, from: number, to = from): Model {
        if (url) {
            url = url.trim();
        }

        const range: Rng = [from, to - from];
        const updated = setLink(this.model, url, range[0], range[1]);

        const result = this.updateModel(updated, 'link', [from, to]);
        setRange(this.element, range[0], range[0] + range[1]);
        return result;
    }

    /**
     * Отменить последнее действие
     */
    undo(): HistoryEntry<Model> | void {
        if (this.history.canUndo) {
            const entry = this.history.undo();
            if (entry) {
                this.updateModel(entry.state, false);
                const { current } = this.history;
                if (current) {
                    const range = current.caret || current.range;
                    if (range) {
                        this.setSelection(range[0], range[1]);
                    }
                }
                return entry;
            }
        }
    }

    /**
     * Повторить последнее отменённое действие
     */
    redo(): HistoryEntry<Model> | void {
        if (this.history.canRedo) {
            const entry = this.history.redo();
            if (entry) {
                this.updateModel(entry.state, false);
                const range = entry.caret || entry.range;
                if (range) {
                    this.setSelection(range[0], range[1]);
                }
                return entry;
            }
        }
    }

    /**
     * Возвращает токен для указанной позиции
     * @param tail В случае, если позиция `pos` указывает на границу токенов,
     * при `tail: true` вернётся токен слева от границы, иначе справа
     */
    tokenForPos(pos: number, tail?: boolean): Token | void {
        let offset = 0;
        let len = 0;
        const { model } = this;
        for (let i = 0, token: Token; i < model.length; i++) {
            token = model[i];
            len = offset + token.value.length;
            if (pos >= offset && (tail ? pos <= len : pos < len)) {
                return token;
            }
            offset += token.value.length;
        }

        if (offset === pos) {
            // Указали самый конец строки — вернём последний токен
            return model[model.length - 1];
        }
    }

    /**
     * Возвращает текущее выделение в виде текстового диапазона
     */
    getSelection(): TextRange {
        return this.caret;
    }

    /**
     * Указывает текущее выделение текста или позицию каретки
     */
    setSelection(from: number, to = from): void {
        [from, to] = this.normalizeRange([from, to]);
        this.saveSelection([from, to]);
        setRange(this.element, from, to);
    }

    /**
     * Заменяет текущее значение редактора на указанное. При этом полностью
     * очищается история изменений редактора
     */
    setValue(value: string | Model, selection?: TextRange): void {
        if (typeof value === 'string') {
            value = parse(sanitize(value));
        }

        if (!selection) {
            const len = getText(value).length;
            selection = [len, len];
        }

        this.model = value;

        if (this.focused) {
            this.setSelection(selection[0], selection[1]);
        } else {
            this.saveSelection(this.normalizeRange(selection));
        }

        this.history.clear();
        this.history.push(this.model, 'init', this.caret);
    }

    /**
     * Возвращает текущее текстовое значение модели редактора
     */
    getText(tokens = this.model): string {
        return getText(tokens);
    }

    /**
     * Сохраняет указанный диапазон в текущей записи истории в качестве последнего
     * известного выделения
     */
    private saveSelection(range: TextRange): void {
        this.caret = range;
        this.history.saveCaret(range);
    }

    /**
     * Обновляет значение модели редактора с добавлением записи в историю изменений
     * @param value Новое значение модели
     * @param action Название действия, которое привело к изменению истории, или
     * `false`, если не надо добавлять действие в историю
     * @param range Диапазон выделения, который нужно сохранить в качестве текущего
     * в записи в истории
     */
    private updateModel(value: Model, action: string | false, range?: TextRange): Model {
        if (value !== this.model) {
            if (typeof action === 'string' && range) {
                this.history.push(value, action, range);
            }
            this.model = value;
        }

        return this.model;
    }


    private render(): void {
        render(this.element, this.model);
    }

    private normalizeRange([from, to]: TextRange): TextRange {
        const maxIx = getLength(this.model);
        return [clamp(from, 0, maxIx), clamp(to, 0, maxIx)];
    }

    private waitExpectedEnter(evt: KeyboardEvent): void {
        if (!this.expectEnter && !evt.defaultPrevented && evt.key === 'Enter') {
            this.expectEnter = true;
            requestAnimationFrame(() => {
                if (this.expectEnter) {
                    this.expectEnter = false;
                    this.insertOrReplaceText(getTextRange(this.element)!, '\n');
                    retainNewlineInViewport(this.element);
                }
            });
        }
    }

    private insertOrReplaceText(range: TextRange, text: string): Model {
        return isCollapsed(range)
            ? this.insertText(range[0], text)
            : this.replaceText(range[0], range[1], text);
    }
}

function isCollapsed(range: TextRange): boolean {
    return range[0] === range[1];
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Вспомогательная функция, которая при необходимости подкручивает вьюпорт
 * к текущему переводу строки
 */
function retainNewlineInViewport(element: Element): void {
    const sel = window.getSelection();
    const r = sel?.getRangeAt(0);

    if (!r?.collapsed) {
        return;
    }

    let rect = r.getClientRects().item(0);
    if ((!rect || !rect.height) && isElement(r.startContainer)) {
        const target = getScrollTarget(r);
        if (target) {
            rect = target.getBoundingClientRect();
        }
    }

    if (rect && rect.height > 0) {
        // Есть прямоугольник, к которому можем прицепиться: проверим, что он видим
        // внутри элемента и если нет, подскроллимся к нему
        const parentRect = element.getBoundingClientRect();
        if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
            // Курсор за пределами вьюпорта
            element.scrollTop += rect.top - (parentRect.top + parentRect.height / 2);
        }
    }
}

/**
 * Вернёт элемент, к которому нужно подскроллится.
 */
function getScrollTarget(r: Range): Element | void {
    let target = r.startContainer.childNodes[r.startOffset];
    if (target?.nodeName === 'BR') {
        return target as Element;
    }

    target = r.startContainer.childNodes[r.startOffset - 1];
    if (target?.nodeName === 'BR') {
        return target as Element;
    }
}

function getDiffTypeFromEvent(evt: InputEvent): DiffActionType | string {
    const { inputType } = evt;
    if (inputType.startsWith('insert')) {
        return DiffActionType.Insert;
    }

    if (inputType.startsWith('delete')) {
        return DiffActionType.Remove;
    }

    if (inputType.startsWith('format')) {
        return 'format';
    }

    return 'update';
}

function sanitize(text: string, nowrap?: boolean): string {
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x00/g, ' ');
    return nowrap
        ? text.replace(/(\r\n?|\n)/g, ' ')
        : text.replace(/\r\n?/g, '\n');
}