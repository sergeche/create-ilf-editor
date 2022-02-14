import type { Token, TokenText } from './types';
import { TokenFormat, TokenType } from './types';
import { isDelimiter, last, asciiToUpper } from './utils';

type MatchFn = (ch: number) => boolean;

export default class ParserState {
    /** Текущая позиция парсера */
    public pos: number;

    /** Текстовая строка, которую нужно парсить */
    public string: string;

    /** Список распаршенных токенов */
    public tokens: Token[] = [];

    /** Позиция начала накапливаемого текстового фрагмента */
    public textStart = -1;

    /** Позиция конца накапливаемого текстового фрагмента */
    public textEnd = -1;

    /**
     * @param text Строка, которую нужно распарсить
     * @param pos Позиция, с которой нужно начинать парсинг
     */
    constructor(str: string, pos = 0) {
        this.string = str;
        this.pos = pos;
    }

    /**
     * Возвращает *code point* текущего символа парсера без смещения указателя
     */
    peek(): number | undefined {
        return this.string.codePointAt(this.pos);
    }

    /**
     * Возвращает *code point* текущего символа парсера и смещает указатель
     */
    next(): number {
        return this.hasNext() ? this.inc(this.peek()!) : NaN;
    }

    /**
     * Возвращает код предыдущего символа без смещения указателя
     */
    peekPrev(): number {
        // XXX в идеале надо учитывать code points, но пока для текущих требований
        // парсера это не надо
        return this.string.charCodeAt(this.pos - 1);
    }

    /**
     * Вернёт `true` если позиция парсера не находится в конце потока и можно ещё
     * с него считывать данные
     */
    hasNext(): boolean {
        return this.pos < this.string.length;
    }

    /**
     * Проверяет, есть ли аккумулированный текст в состоянии
     */
    hasPendingText(): boolean {
        return this.textStart !== this.textEnd;
    }

    /**
     * Поглощает символ в текущей позиции парсера, если он соответствует `match`.
     * `match` может быть как кодом символа, так и функцией, которая принимает текущий
     * символ и должна вернуть `true` или `false`
     * Вернёт `true` если символ был поглощён
     */
    consume(match: number | MatchFn): boolean {
        const ch = this.peek()!;
        const ok = typeof match === 'function' ? match(ch) : ch === match;

        if (ok) {
            this.inc(ch);
        }

        return ok;
    }

    /**
     * Вызывает функцию `consume` до тех пор, пока текущий символ соответствует
     * условию `match`.
     * Вернёт `true` если было поглощение
     */
    consumeWhile(match: number | MatchFn): boolean {
        const start = this.pos;
        while (this.hasNext() && this.consume(match)) { /* */ }
        return this.pos !== start;
    }

    /**
     * Вернёт `true`, если все коды из `arr` были поглощены из текущей позиции потока
     * @param ignoreCase Игнорировать регистр для латинских символов ASCII-последовательности
     */
    consumeArray(arr: number[], ignoreCase?: boolean): boolean {
        const { pos } = this;
        let ch: number;
        for (let i = 0; i < arr.length; i++) {
            ch = ignoreCase ? asciiToUpper(this.next()) : this.next();
            if (arr[i] !== ch) {
                this.pos = pos;
                return false;
            }
        }

        return true;
    }

    /**
     * Возвращает подстроку по указанным индексам
     */
    substring(from: number, to = this.pos): string {
        return this.string.substring(from, to);
    }

    /**
     * Добавляет указанный токен в вывод
     */
    push(token: Token): void {
        this.flushText();
        this.tokens.push(token);
    }


    /**
     * Поглощает текущий символ как накапливаемый текст
     */
    consumeText(): void {
        if (this.textStart === -1) {
            this.textStart = this.textEnd = this.pos;
        }

        this.next();
        this.textEnd = this.pos;
    }

    /**
     * Записывает накопленный текстовый токен в вывод
     */
    flushText(): void {
        if (this.hasPendingText()) {
            const token: TokenText = {
                type: TokenType.Text,
                format: TokenFormat.None,
                value: this.substring(this.textStart, this.textEnd),
            };

            this.tokens.push(token);
            this.textStart = this.textEnd = -1;
        }
    }

    /**
     * Проверяет, находимся ли мы сейчас на границе слов
     */
    atWordBound(): boolean {
        // Для указанной позиции нам нужно проверить, что предыдущий символ или токен
        // является границей слов
        if (this.pos === 0) {
            return true;
        }

        if (this.hasPendingText()) {
            return isDelimiter(this.peekPrev());
        }

        const lastToken = last(this.tokens);
        return lastToken?.type === TokenType.Newline;
    }

    markPending(textStart: number): void {
        if (!this.hasPendingText()) {
            this.textStart = textStart;
        }
        this.textEnd = this.pos;
    }

    /**
     * Смещает указатель на размер указанного кода символ вправо.
     */
    private inc(code: number): number {
        this.pos += code > 0xffff ? 2 : 1;
        return code;
    }
}
