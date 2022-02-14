export type Bracket = 'curly' | 'square' | 'round';

export enum TokenType {
    /** Обычный текстовый фрагмент */
    Text = 'text',

    /** Ссылка на внешний ресурс */
    Link = 'link',

    /** Упоминание: @user_name */
    Mention = 'mention',

    /** Хэштэг: #hashtag */
    HashTag = 'hashtag',

    /** Перенос строки */
    Newline = 'newline'
}

export enum TokenFormat {
    None = 0,

    /** Жирный текст */
    Bold = 1 << 0,

    /** Курсивный текст */
    Italic = 1 << 1,

    /** Подчёркнутый текст */
    Underline = 1 << 2,

    /** Перечёркнутый текст */
    Strike = 1 << 3,

    /** Моноширинный текст */
    Monospace = 1 << 4,
}

export type Token = TokenText | TokenLink | TokenMention | TokenHashTag | TokenNewline;

export interface TokenBase {
    /** Тип токена */
    type: TokenType;

    /** Текстовое содержимое токена */
    value: string;

    /** Текущий формат токена */
    format: TokenFormat;

    /** Список эмоджи внутри значения токена */
    emoji?: Emoji[];
}

export interface TokenText extends TokenBase {
    type: TokenType.Text;
}

export interface TokenLink extends TokenBase {
    type: TokenType.Link;

    /** Значение ссылки */
    link: string;

    /**
     * Флаг, означающий, что ссылка была автоматически распознана в тексте,
     * а не добавлена пользователем.
     */
    auto: boolean;
}

export interface TokenMention extends TokenBase {
    type: TokenType.Mention;
}

export interface TokenHashTag extends TokenBase {
    type: TokenType.HashTag;
}

export interface TokenNewline extends TokenBase {
    type: TokenType.Newline;
}

export interface Emoji {
    /** Начало эмоджи в родительском токене */
    from: number;
    /** Конец эмоджи в родительском токене */
    to: number;
    /** Фактический эмоджи для указанного диапазона. Используется для текстовых эмоджи (алиасов) */
    emoji?: string;
}
