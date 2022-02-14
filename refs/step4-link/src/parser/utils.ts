import { TokenType } from './types';
import type { Emoji, Token, TokenLink } from './types';
import type ParserState from './state';

export const Codes = {
    // Formatting
    /** * */
    Asterisk: 42,
    /** _ */
    Underscore: 95,
    /** ` */
    BackTick: 96,
    /** ~ */
    Tilde: 126,

    // Punctuation
    /** ! */
    Exclamation: 33,
    /** "" */
    DoubleQuote: 34,
    /** ' */
    SingleQuote: 39,
    /** , */
    Comma: 44,
    /** . */
    Dot: 46,
    /** : */
    Colon: 58,
    /** ; */
    SemiColon: 59,
    /** ? */
    Question: 63,
    /** ( */
    RoundBracketOpen: 40,
    /** ) */
    RoundBracketClose: 41,
    /** [ */
    SquareBracketOpen: 91,
    /** ] */
    SquareBracketClose: 93,
    /** { */
    CurlyBracketOpen: 123,
    /** } */
    CurlyBracketClose: 125,
    /** `<` */
    LeftAngle: 60,
    /** `>` */
    RightAngle: 62,
    /** - */
    Hyphen: 45,
    /** &ndash; */
    EnDash: 0x02013,
    /** &mdash; */
    EmDash: 0x02014,

    // Whitespace
    Tab: 9, // \t
    Space: 32, //
    NBSP: 160, // &nbsp;

    // New line
    /** `\n` */
    NewLine: 10, // \n
    /** `\r` */
    Return: 13,
    /** `\f` */
    LineFeed: 12,

    // Special
    /** = */
    Equal: 61,
    /** / */
    Slash: 47,
    /** \ */
    BackSlash: 92,
    /** | */
    Pipe: 124,
    /** ^ */
    Caret: 94,
    /** % */
    Percent: 37,
    /** & */
    Ampersand: 38,
    /** + */
    Plus: 43,
    /** @ */
    At: 64,
    /** # */
    Hash: 35,
}

/**
 * Символы для логических границ текста (скобки и кавычки)
 */
const boundPunctuation = new Set<number>([
    Codes.DoubleQuote, Codes.SingleQuote, Codes.SemiColon,
    Codes.RoundBracketOpen, Codes.RoundBracketClose,
    Codes.SquareBracketOpen, Codes.SquareBracketClose,
    Codes.CurlyBracketOpen, Codes.CurlyBracketClose,
]);

export function isBoundPunctuation(ch: number): boolean {
    return boundPunctuation.has(ch);
}

export function isWhitespace(ch: number): boolean {
    return ch === Codes.Space
        || ch === Codes.NBSP
        || ch === Codes.Tab;
}

export function isNewLine(ch: number): boolean {
    return ch === Codes.NewLine
        || ch === Codes.Return
        || ch === Codes.LineFeed;
}

export function isBound(ch?: number): boolean {
    return ch === undefined
        || ch !== ch /* NaN */
        || isNewLine(ch)
        || isWhitespace(ch)
}

export function isDelimiter(ch?: number): boolean {
    return isBound(ch)
        || isBoundPunctuation(ch!);
}

/**
 * Проверяет, является ли указанный символ стандартным идентификатором: латинские
 * символы, цифры подчёркивание и дефис
 */
export function isIdentifier(ch: number): boolean {
    return ch === Codes.Underscore
        || ch === Codes.Hyphen
        || isAlphaNumeric(ch);
}

/**
 * Вернёт `true` если из текущей позиции удалось поглотить правильный идентификатор
 */
export function consumeIdentifier(state: ParserState): boolean {
    // Идентификатор обязательно должен начинаться с латинского символа
    if (state.consume(isAlpha)) {
        state.consumeWhile(isIdentifier);
        return true;
    }

    return false;
}

/**
 * Вернёт последний элемент указанного массива
 */
export function last<T>(arr: T[]): T | undefined {
    if (arr.length > 0) {
        return arr[arr.length - 1];
    }
    return;
}

/**
 * Конвертация указанной стоки в список кодов символов
 */
export function toCode(str: string, ignoreCase?: boolean): number[] {
    const result: number[] = [];
    for (let i = 0; i < str.length; i++) {
        result.push(ignoreCase ? asciiToUpper(str.codePointAt(i)!) : str.codePointAt(i)!);
    }

    return result;
}

/**
 * Вернёт `true` если указанный код соответствует числу
 */
export function isNumber(code: number): boolean {
    return code > 47 && code < 58;
}

/**
 * Вернёт `true` если указанный код соответствует латинским символам от A до Z
 */
export function isAlpha(code: number): boolean {
    code &= ~32; // quick hack to convert any char code to uppercase char code
    return code >= 65 && code <= 90;
}

/**
 * Вернёт `true` если указанный код соответствует числу или символам A-Z
 */
export function isAlphaNumeric(code: number): boolean {
    return isNumber(code) || isAlpha(code);
}

/**
 * Вернёт `true` если указанный код соответствует ординарной или двойной кавычке
 */
export function isQuote(ch: number): boolean {
    return ch === Codes.SingleQuote || ch === Codes.DoubleQuote;
}

/**
 * All unicode character set alpha like
 */
export function isUnicodeAlpha(code: number): boolean {
    return isAlpha(code)
        || code >= 880 && code <= 1023   // Greek and Coptic
        || code >= 1024 && code <= 1279  // Cyrillic
        || code >= 1280 && code <= 1327  // Cyrillic Supplementary
        || code >= 1328 && code <= 1423  // Armenian
        || code >= 1424 && code <= 1535  // Hebrew
        || code >= 1536 && code <= 1791  // Arabic
        || code >= 19968 && code <= 40959 // Chinese
        || code >= 1792 && code <= 1871  // Syriac
        || code >= 1920 && code <= 1983  // Thaana
        || code >= 2304 && code <= 2431  // Devanagari
        || code >= 2432 && code <= 2559  // Bengali
        || code >= 2560 && code <= 2687  // Gurmukhi
        || code >= 2688 && code <= 2815  // Gujarati
        || code >= 2816 && code <= 2943  // Oriya
        || code >= 2944 && code <= 3071  // Tamil
        || code >= 3072 && code <= 3199  // Telugu
        || code >= 3200 && code <= 3327  // Kannada
        || code >= 3328 && code <= 3455  // Malayalam
        || code >= 3456 && code <= 3583  // Sinhala
        || code >= 3584 && code <= 3711  // Thai
        || code >= 3712 && code <= 3839  // Lao
        || code >= 3840 && code <= 4095  // Tibetan
        || code >= 4096 && code <= 4255  // Myanmar
        || code >= 4256 && code <= 4351  // Georgian
        || code >= 4352 && code <= 4607  // Hangul Jamo
        || code >= 4608 && code <= 4991  // Ethiopic
        || code >= 5024 && code <= 5119  // Cherokee
        || code >= 5120 && code <= 5759  // Unified
        || code >= 5760 && code <= 5791  // Ogham
        || code >= 5792 && code <= 5887  // Runic
        || code >= 5888 && code <= 5919  // Tagalog
        || code >= 5920 && code <= 5951  // Hanunoo
        || code >= 5952 && code <= 5983  // Buhid
        || code >= 5984 && code <= 6015  // Tagbanwa
        || code >= 6016 && code <= 6143  // Khmer
        || code >= 6144 && code <= 6319  // Mongolian
        || code >= 6400 && code <= 6479  // Limbu
        || code >= 6480 && code <= 6527; // Tai Le
}

/**
 * Если указанный код является символом a-z, конвертирует его в верхний регистр
 */
export function asciiToUpper(ch: number): number {
    return ch >= 97 && ch <= 122 ? ch & ~32 : ch;
}

/**
 * Нормализация списка токенов: объединяет несколько смежных токенов в один, если
 * это возможно
 */
export function normalize(tokens: Token[]): Token[] {
    return joinSimilar(filterEmpty(tokens));
}

/**
 * Возвращает строковое содержимое указанных токенов
 */
export function getText(tokens: Token[]): string {
    return tokens.map(token => token.value).join('');
}

/**
 * Возвращает длину форматированного текста
 */
export function getLength(tokens: Token[]): number {
    return tokens.reduce((acc, token) => acc + token.value.length, 0);
}

/**
 * Удаляет пустые токены из указанного списка
 */
function filterEmpty(tokens: Token[]): Token[] {
    return tokens.filter(token => token.value);
}

/**
 * Объединяет соседние токены, если это можно сделать безопасно
 */
function joinSimilar(tokens: Token[]): Token[] {
    return tokens.reduce((out, token) => {
        let prev = out[out.length - 1];
        if (prev && allowJoin(prev, token)) {
            prev = { ...prev };

            if (token.emoji) {
                const nextEmoji = shiftEmoji(token.emoji, prev.value.length);
                prev.emoji = prev.emoji ? prev.emoji.concat(nextEmoji) : nextEmoji;
            }

            prev.value += token.value;
            out[out.length - 1] = prev;
        } else {
            out.push(token);
        }

        return out;
    }, [] as Token[]);
}

/**
 * Проверяет, можно ли объединить два указанных токена в один
 */
function allowJoin(token1: Token, token2: Token): boolean {
    if (token1.type === token2.type && token1.format === token2.format) {
        return (token1.type === TokenType.Link && token1.link === (token2 as TokenLink).link && isCustomLink(token1) && isCustomLink(token2))
            || token1.type === TokenType.Text;
    }
    return false;
}

function shiftEmoji(emoji: Emoji[], offset: number): Emoji[] {
    return emoji.map(e => ({
        ...e,
        from: e.from + offset,
        to: e.to + offset
    }));
}

/**
 * Проверяет, что указанный токен является пользовательской ссылкой, то есть
 * ссылка отличается от содержимого токена
 */
function isCustomLink(token: Token): token is TokenLink {
    return token.type === TokenType.Link && !token.auto;
}
