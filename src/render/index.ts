import { isAutoLink, isCustomLink } from '../formatting/utils';
import type { Emoji, Token, TokenHashTag, TokenLink, TokenMention, TokenText } from '../parser';
import { TokenFormat, TokenType } from '../parser';

type ClassFormat = [type: TokenFormat, value: string];
type ReconcileStateStack = [elem: HTMLElement, pos: number];

const formats: ClassFormat[] = [
    [TokenFormat.Bold, 'bold'],
    [TokenFormat.Italic, 'italic'],
    [TokenFormat.Monospace, 'monospace'],
    [TokenFormat.Strike, 'strike'],
    [TokenFormat.Underline, 'underline'],
];

const tokenTypeClass: Record<TokenType, string> = {
    [TokenType.HashTag]: 'hashtag',
    [TokenType.Link]: 'link',
    [TokenType.Mention]: 'mention',
    [TokenType.Text]: '',
    [TokenType.Newline]: 'newline',
}

export default function render(elem: HTMLElement, tokens: Token[]): void {
    const lineState = new ReconcileState(elem);
    const line = () => lineState.elem('div');
    const state = new ReconcileState(line());
    const finalizeLine = () => {
        if (state.pos === 0) {
            // Пустая строка, оставляем <br>, чтобы строка отобразилась
            state.elem('br');
        }
        state.trim();
    };

    // На случай непредвиденных модификаций дерева убедимся, что у первой строки
    // всегда отсутствует атрибут data-raw
    state.container.removeAttribute('data-raw');

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type === TokenType.Newline) {
            // Переход на новую строку
            finalizeLine();
            state.prepare(line());
            state.container.setAttribute('data-raw', token.value);
        } else {
            i = renderTokens(tokens, i, state);
        }
    }

    finalizeLine();
    lineState.trim();
}

/**
 * Функция для отрисовки списка токенов в указанном стэйте
 * @param tokens Список токенов для отрисовки
 * @param i Позиция токена, с которой начать отрисовку
 * @param state Текущий стэйт для согласования отрисовки
 * @returns
 */
function renderTokens(tokens: Token[], i: number, state: ReconcileState): number {
    const token = tokens[i];
    if (!token.value) {
        // Скорее всего sticky-токен, пропускаем
        return i;
    }

    const groupEnd = nextInGroup(tokens, i);
    if (groupEnd !== i) {
        // Можем схлопнуть несколько токенов в один
        const baseFormat = token.format;
        state.enter(renderTokenContainer(token, state));

        while (i <= groupEnd) {
            const innerToken = tokens[i];
            if (innerToken.format === baseFormat) {
                renderText(innerToken, state);
            } else {
                const innerElem = state.elem('span');
                innerElem.className = formatClassNames(innerToken.format);
                renderTextToken(innerElem, innerToken, state);
            }
            i++;
        }

        state.exit();
        return groupEnd;
    }

    if (token.type === TokenType.Newline) {
        state.text(token.value);
    } else if (isPlainText(token)) {
        renderText(token, state);
    } else {
        const elem = renderTokenContainer(token, state);
        renderTextToken(elem, token, state);
    }

    return i;
}

function renderTextToken(target: HTMLElement, token: Token, state: ReconcileState): void {
    state.enter(target);
    renderText(token, state);
    state.exit();
}

/**
 * Отрисовка текстового содержимого в указанном контейнере с учётом наличия эмоджи
 * внутри токена
 */
function renderText(token: Token, state: ReconcileState): void {
    let { value, emoji } = token;

    if (emoji && token.format & TokenFormat.Monospace) {
        // Для monospace не делаем замену текстовых эмоджи: уберём их из списка
        emoji = emoji.filter(isEmojiSymbol);
    }

    if (emoji?.length) {
        // Есть эмоджи, нужно назбить текстовый узел на фрагменты и заменить эмоджи
        // на элементы
        let offset = 0;

        emoji.forEach(emojiToken => {
            const text = value.slice(offset, emojiToken.from);
            const rawEmoji = value.slice(emojiToken.from, emojiToken.to);
            const emoji = emojiToken.emoji || rawEmoji;

            if (text) {
                state.text(text);
            }

            state.emoji(emoji, rawEmoji);
            offset = emojiToken.to;
        });

        const tail = value.slice(offset);
        if (tail) {
            state.text(tail);
        }
    } else {
        state.text(value);
    }
}

/**
 * Возвращает список классов форматирования для указанного формата токена
 */
function formatClassNames(format: TokenFormat): string {
    let result = '';
    let glue = '';

    // Укажем классы с форматированием
    formats.forEach(([f, value]) => {
        if (format & f) {
            result += glue + value;
            glue = ' ';
        }
    });

    return result;
}

function joinClassNames(classNames: string[]): string {
    let result = '';
    let glue = '';
    classNames.forEach(cl => {
        if (cl) {
            result += glue + cl;
            glue = ' ';
        }
    });

    return result;
}

/**
 * Добавляет указанный узел `node` в позицию `pos` потомков `elem`
 */
function insertAt<T extends Node>(elem: HTMLElement, child: T, pos: number): T {
    const curChild = elem.childNodes[pos];
    if (curChild) {
        elem.insertBefore(child, curChild);
    } else {
        elem.appendChild(child);
    }

    return child;
}

class ReconcileState {
    /** Указатель на текущую позицию потомка внутри `container` */
    public pos = 0;
    private stack: ReconcileStateStack[] = [];

    constructor(public container: HTMLElement) { }

    /**
     * Ожидает текстовый узел в позиции `pos`. Если его нет, то автоматически создаст
     * со значением `value`, а если есть, то обновит значение на `value`
     */
    text(value: string): Text {
        let node = this.container.childNodes[this.pos];

        if (node?.nodeType === 3) {
            if (node.nodeValue !== value) {
                node.nodeValue = value;
            }
        } else {
            node = document.createTextNode(value);
            insertAt(this.container, node, this.pos);
        }
        this.pos++;
        return node as Text;
    }

    /**
     * Ожидает элемент с именем `name` в текущей позиции. Если его нет, то создаст
     * такой
     */
    elem(name: string): HTMLElement {
        let node = this.container.childNodes[this.pos];

        if (!isElement(node) || node.localName !== name) {
            node = document.createElement(name);
            insertAt(this.container, node, this.pos);
        }
        this.pos++;
        return node as HTMLElement;
    }

    /**
     * Ожидает элемент с указанным эмоджи, при необходимости создаёт или обновляет его
     */
    emoji(actualEmoji: string, rawEmoji: string): Element | void {
        const node = this.container.childNodes[this.pos];
        const next = renderEmoji(actualEmoji, node && isEmoji(node) ? node : undefined);

        if (node !== next) {
            insertAt(this.container, next, this.pos);
        }
        next.setAttribute('data-raw', rawEmoji);
        this.pos++;
        return next;
    }

    save(): void {
        this.stack.push([this.container, this.pos]);
    }

    enter(elem: HTMLElement): void {
        this.save();
        this.prepare(elem);
    }

    exit(): void {
        this.trim();
        this.restore();
    }

    restore(): void {
        const entry = this.stack.pop();
        if (entry) {
            this.container = entry[0];
            this.pos = entry[1];
        }
    }

    /**
     * Удаляет все дочерние элементы контейнера, которые находятся правее точки `pos`
     */
    trim(): void {
        while (this.pos < this.container.childNodes.length) {
            this.container.childNodes[this.pos].remove();
        }
    }

    prepare(container: HTMLElement) {
        this.container = container;
        this.pos = 0;
    }
}

function isElement(node?: Node): node is HTMLElement {
    return node?.nodeType === 1;
}

/**
 * Возвращает позицию элемента, до которого можно сделать единую с элементом
 * в позиции `pos` группу. Используется, например, для того, чтобы сгруппировать
 * в единый `<a>` элемент ссылку с внутренним форматированием
 */
export function nextInGroup(tokens: Token[], pos: number): number {
    const cur = tokens[pos];

    while (pos < tokens.length - 1 && canGroup(cur, tokens[pos + 1])) {
        pos++;
    }

    return pos;
}

/**
 * Вернёт `true`, если два токена можно сгруппировать в один
 */
function canGroup(t1: Token, t2: Token): boolean {
    if (t1 === t2) {
        return true;
    }

    if (t1.type === t2.type) {
        return (t1.type === TokenType.Link && t1.link === (t2 as TokenLink).link)
            || (t1.type === TokenType.Mention && t1.value === t2.value)
            || (t1.type === TokenType.HashTag && t1.value === t2.value);
    }

    return false;
}

/**
 * Отрисовывает контейнер для указанного токена
 */
function renderTokenContainer(token: Token, state: ReconcileState): HTMLElement {
    let elem: HTMLElement;

    // Ссылки рисуем только если нет моноширинного текста
    if (isRenderLink(token)) {
        elem = state.elem('a');
        elem.setAttribute('href', getLink(token));
        elem.setAttribute('target', '_blank');
    } else {
        elem = state.elem('span');
    }

    elem.className = joinClassNames([
        getTokenTypeClass(token),
        formatClassNames(token.format)
    ]);

    return elem;
}

function isEmojiSymbol(emoji: Emoji): boolean {
    return emoji.emoji === undefined;
}

export function isEmoji(elem: Node): elem is HTMLImageElement {
    return elem.nodeType === 1 && elem.nodeName === 'IMG';
}

/**
 * Для указанного эмоджи возвращает имя файла для картинки с эмоджи, которая лежит
 * на CDN портала ok.ru
 */
function emojiFileName(emoji: string): string {
    const codePoints: string[] = [];
    let i = 0;
    let cp = 0;
    while (i < emoji.length) {
        cp = emoji.codePointAt(i)!;
        i += cp > 0xffff ? 2 : 1;

        if (cp !== 0xfe0f && cp !== 0x200d) {
            codePoints.push(cp.toString(16));
        }
    }

    return codePoints.join('-');
}

/**
 * Тестовая функция для проверки вывода эмоджи как картинки
 */
function renderEmoji(emoji: string, elem?: Element) {
    const url = `https://st.mycdn.me/static/emoji/13-1-0/20/${emojiFileName(emoji)}@2x.png`;
    if (!elem) {
        elem = document.createElement('img');
    }

    if (elem.getAttribute('src') !== url) {
        elem.setAttribute('src', url);
        elem.setAttribute('alt', emoji);
    }

    return elem;
}

function getLink(token: Token): string {
    if (token.type === TokenType.HashTag) {
        return token.value;
    }

    if (token.type === TokenType.Link) {
        return token.link;
    }

    return '';
}

/**
 * Возвращает класс для указанного токена
 */
function getTokenTypeClass(token: Token): string {
    if (isAutoLink(token) && (token.format & TokenFormat.Monospace)) {
        return '';
    }

    if (isPrefixedToken(token) && token.value.length === 1) {
        return '';
    }

    if (isRenderLink(token)) {
        let { type } = token;
        if (isCustomLink(token) && token.link[0] === '@') {
            type = TokenType.Mention;
        }

        return type !== TokenType.Link ? `${tokenTypeClass.link} ${tokenTypeClass[type]}` : tokenTypeClass[type];
    }

    return tokenTypeClass[token.type];
}

/**
 * Если указанный токен является ссылкой, вернёт `true`, если его можно нарисовать
 * как ссылку
 */
export function isRenderLink(token: Token): boolean {
    if ((token.format & TokenFormat.Monospace)) {
        // Внутри моноширинного текста разрешаем только «ручные» ссылки либо
        // полные автоссылки (начинаются с протокола)
        return token.type === TokenType.Link && (!token.auto || /^[a-z+]+:\/\//i.test(token.value));
    }

    if (isPrefixedToken(token)) {
        return token.value.length > 1;
    }

    return token.type === TokenType.Link;
}

function isPrefixedToken(token: Token): token is TokenMention | TokenHashTag {
    return token.type === TokenType.Mention
        || token.type === TokenType.HashTag;
}

export function isPlainText(token: Token): token is TokenText {
    return token.type === TokenType.Text && token.format === TokenFormat.None;
}
