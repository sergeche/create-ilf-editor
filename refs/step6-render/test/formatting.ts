import { test } from 'uvu';
import { equal } from 'uvu/assert';
import parse, { TokenType, TokenFormat } from '../src/parser';
import type { Token, TokenLink, TokenText } from '../src/parser';
import { insertText, removeText, setFormat, slice, cutText, setLink, replaceText } from '../src/formatting';
import { createToken as token } from '../src/formatting/utils';

type StringFormat = [TokenFormat, string];

const formats: StringFormat[] = [
    [TokenFormat.Bold, 'b'],
    [TokenFormat.Italic, 'i'],
    [TokenFormat.Underline, 'u'],
    [TokenFormat.Strike, 's'],
    [TokenFormat.Monospace, 'm'],
];

function textToken(value: string, format: TokenFormat = TokenFormat.None): TokenText {
    return {
        type: TokenType.Text,
        format,
        value
    };
};


/** Возвращает строковое представление формата */
function getFormat(format: TokenFormat): string {
    return formats.reduce((acc, f) => {
        if (format & f[0]) {
            acc += f[1];
        }

        return acc;
    }, '');
}

/**
 * Строковое представление токенов
 */
export function repr(tokens: Token[]): string {
    return tokens.map(t => {
        const format = getFormat(t.format);
        let out = format ? `<${format}>${t.value}</${format}>` : t.value;

        if (t.type === TokenType.Link) {
            out = `<a href="${t.link}">${out}</a>`;
        }

        return out;
    }).join('');
}

function text(tokens: Token[]): string {
    return tokens.map(t => t.value).join('');
}

function emojiText(token: Token): string[] {
    return token.emoji.map(e => token.value.substring(e.from, e.to));
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

test('insert text', () => {
    const tokens = [
        textToken('hello', TokenFormat.Italic),
        textToken(' '),
        textToken('world', TokenFormat.Bold)
    ];

    const t1 = insertText(tokens, 0, 'aaa');
    equal(text(t1), 'aaahello world');
    equal(t1.length, 3);
    equal(repr(t1), '<i>aaahello</i> <b>world</b>');

    const t2 = insertText(t1, 8, 'bbb');
    equal(text(t2), 'aaahellobbb world');
    equal(t2.length, 3);
    equal(repr(t2), '<i>aaahellobbb</i> <b>world</b>');

    const t3 = insertText(t2, 12, 'ccc');
    equal(text(t3), 'aaahellobbb cccworld');
    equal(t3.length, 3);
    equal(repr(t3), '<i>aaahellobbb</i> ccc<b>world</b>');

    const t4 = insertText(t3, 20, 'ddd');
    equal(text(t4), 'aaahellobbb cccworldddd');
    equal(t4.length, 3);
    equal(repr(t4), '<i>aaahellobbb</i> ccc<b>worldddd</b>');
});

test('insert text into empty string', () => {
    const t1 = insertText([], 0, 'hello world');
    equal(text(t1), 'hello world');
    equal(t1.length, 1);
    equal(repr(t1), 'hello world');
});

test('remove text', () => {
    const tokens = [
        token('aaa', TokenFormat.Italic),
        token(' '),
        token('bbb', TokenFormat.Bold),
        token(' ccc '),
        token('ddd', TokenFormat.Underline),
    ];

    const t1 = removeText(tokens, 0, 4);
    equal(text(t1), 'bbb ccc ddd');
    equal(t1.length, 3);
    equal(repr(t1), '<b>bbb</b> ccc <u>ddd</u>');

    const t2 = removeText(t1, 1, 2);
    equal(text(t2), 'b ccc ddd');
    equal(t2.length, 3);
    equal(repr(t2), '<b>b</b> ccc <u>ddd</u>');

    const t3 = removeText(t2, 4, 3);
    equal(t3.length, 3);
    equal(repr(t3), '<b>b</b> cc<u>dd</u>');

    const t4 = removeText(tokens, 2, 13);
    equal(t4.length, 1);
    equal(repr(t4), '<i>aa</i>');
});

test('change format', () => {
    const tokens = [token('aa bb cc dd')];
    equal(text(tokens), 'aa bb cc dd');

    const t1 = setFormat(tokens, { add: TokenFormat.Bold }, 3, 5);
    equal(t1.length, 3);
    equal(repr(t1), 'aa <b>bb cc</b> dd');

    const t2 = setFormat(t1, { add: TokenFormat.Italic }, 0, 5);
    equal(t2.length, 4);
    equal(repr(t2), '<i>aa </i><bi>bb</bi><b> cc</b> dd');

    const t3 = setFormat(t2, { remove: TokenFormat.Italic }, 0, 9);
    equal(t3.length, 3);
    equal(repr(t3), 'aa <b>bb cc</b> dd');

    const t4 = setFormat(t3, { remove: TokenFormat.Bold }, 0, 9);
    equal(t4.length, 1);
    equal(repr(t4), 'aa bb cc dd');
});

test('slice tokens', () => {
    const tokens = [
        token('12'),
        token('34', TokenFormat.Bold),
        token('56', TokenFormat.Italic),
        token('78')
    ];

    const t1 = slice(tokens, 0, 2);
    equal(repr(t1), '12');

    const t2 = slice(tokens, 2, -2);
    equal(repr(t2), '<b>34</b><i>56</i>');

    const t3 = slice(tokens, 3, 5);
    equal(repr(t3), '<b>4</b><i>5</i>');

    const t4 = slice(tokens, -3);
    equal(repr(t4), '<i>6</i>78');

    equal(slice(tokens, 0, 0), []);
    equal(slice(tokens, 1, 1), []);
    equal(slice(tokens, 8, 8), []);
    equal(slice([], 0, 0), []);

    const t5 = slice(parse('@aaa'), 0, 4);
    equal(t5[0].type, TokenType.Mention);
});

test('cut text', () => {
    const tokens = [
        token('12'),
        token('34', TokenFormat.Bold),
        token('56', TokenFormat.Italic),
        token('78')
    ];

    let result = cutText(tokens, 3, 5);
    equal(repr(result.cut), '<b>4</b><i>5</i>');
    equal(repr(result.tokens), '12<b>3</b><i>6</i>78');

    result = cutText(tokens, 2, 6);
    equal(repr(result.cut), '<b>34</b><i>56</i>');
    equal(repr(result.tokens), '1278');
});

test('handle emoji in string', () => {
    const tokens = parse('aaa 😍 bbb 😘😇 ccc 🤷🏼‍♂️ ddd');
    let text = tokens[0] as TokenText;
    equal(tokens.length, 1);
    equal(text.type, TokenType.Text);
    equal(text.emoji, [
        { from: 4, to: 6 },
        { from: 11, to: 13 },
        { from: 13, to: 15 },
        { from: 20, to: 27 }
    ]);
    equal(emojiText(text), ['😍', '😘', '😇', '🤷🏼‍♂️']);

    // Добавляем текст
    const tokens2 = insertText(tokens, 13, 'foo 😈 bar');
    text = tokens2[0] as TokenText;
    equal(tokens2.length, 1);
    equal(text.value, 'aaa 😍 bbb 😘foo 😈 bar😇 ccc 🤷🏼‍♂️ ddd');
    equal(emojiText(text), ['😍', '😘', '😈', '😇', '🤷🏼‍♂️']);

    // Удаляем текст
    const tokens3 = removeText(tokens2, 2, 14);
    text = tokens3[0] as TokenText;
    equal(tokens3.length, 1);
    equal(text.value, 'aa 😈 bar😇 ccc 🤷🏼‍♂️ ddd');
    equal(emojiText(text), ['😈', '😇', '🤷🏼‍♂️']);

    // Удаляем текст с позицией внутри эмоджи
    const tokens3_1 = removeText(tokens2, 5, 7);
    text = tokens3_1[0] as TokenText;
    equal(tokens3_1.length, 1);
    equal(text.value, 'aaa foo 😈 bar😇 ccc 🤷🏼‍♂️ ddd');
    equal(emojiText(text), ['😈', '😇', '🤷🏼‍♂️']);

    // Получаем фрагмент
    // NB: правая граница попадает на середину эмоджи
    const tokens4 = slice(tokens3_1, 0, 9);
    text = tokens4[0] as TokenText;
    equal(tokens4.length, 1);
    equal(text.value, 'aaa foo 😈');
    equal(emojiText(text), ['😈']);

    // Вырезаем фрагмент
    // NB: правая граница попадает на середину эмоджи
    const tokens5 = cutText(tokens3_1, 4, 9);
    text = tokens5.cut[0] as TokenText;
    equal(tokens5.cut.length, 1);
    equal(tokens5.tokens.length, 1);

    equal(text.value, 'foo 😈');
    equal(emojiText(text), ['😈']);

    equal(tokens5.tokens[0].value, 'aaa  bar😇 ccc 🤷🏼‍♂️ ddd');
    equal(emojiText(tokens5.tokens[0] as TokenText), ['😇', '🤷🏼‍♂️']);
});

test('edit edge cases', () => {
    let tokens = [
        token('foo '),
        token('bar', TokenFormat.Bold | TokenFormat.Italic),
        token(' ', TokenFormat.Bold),
        token(' baz',),
    ];

    // Удаляем текст на границе форматов
    const t1 = removeText(tokens, 8, 1);
    equal(repr(t1), 'foo <bi>bar</bi><b> </b>baz');

    const t2 = removeText(t1, 7, 1);
    equal(repr(t2), 'foo <bi>bar</bi>baz');

    // Меняем формат у неразрывного токена
    tokens = parse('foo @bar');
    const t3 = setFormat(tokens, { add: TokenFormat.Bold }, 6);
    equal(repr(t3), 'foo <b>@bar</b>');

    // Дописываем текст к ссылке
    tokens = parse('test mail.ru');
    const t4_1 = insertText(tokens, 12, '?');
    equal(types(t4_1), [TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(t4_1), ['test ', 'mail.ru', '?']);

    const t4_2 = insertText(t4_1, 13, 'a');
    equal(types(t4_2), [TokenType.Text, TokenType.Link]);
    equal(values(t4_2), ['test ', 'mail.ru?a']);

    // Удаление текста после ссылки
    const t5_1 = setLink(parse('[asd ]'), 'ok.ru', 1, 3);
    equal(types(t5_1), [TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(t5_1), ['[', 'asd', ' ]']);

    const t5_2 = removeText(t5_1, 4, 1);
    equal(types(t5_2), [TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(t5_2), ['[', 'asd', ']']);
});

test('set link', () => {
    let link: TokenLink;
    const url = 'https://tamtam.chat';
    const url2 = 'https://ok.ru';
    let tokens = setFormat(parse('regular bold mail.ru'), { add: TokenFormat.Bold }, 8, 4);

    const t1 = setLink(tokens, url, 0, 7);
    link = t1[0] as TokenLink;
    equal(types(t1), [TokenType.Link, TokenType.Text, TokenType.Text, TokenType.Text, TokenType.Link]);
    equal(values(t1), ['regular', ' ', 'bold', ' ', 'mail.ru']);
    equal(link.auto, false);
    equal(link.value, 'regular');
    equal(link.link, url);

    // Добавляем ссылку двум словам с разным форматом
    const t2 = setLink(tokens, url, 0, 12);
    equal(types(t2), [TokenType.Link, TokenType.Link, TokenType.Text, TokenType.Link]);
    equal(values(t2), ['regular ', 'bold', ' ', 'mail.ru']);
    link = t2[0] as TokenLink;
    equal(link.auto, false);
    equal(link.value, 'regular ');
    equal(link.format, TokenFormat.None);

    link = t2[1] as TokenLink;
    equal(link.auto, false);
    equal(link.value, 'bold');
    equal(link.format, TokenFormat.Bold);

    // Добавляем ссылку поверх другой ссылки
    const t3 = setLink(t2, url2, 3, 7);
    equal(types(t3), [TokenType.Link, TokenType.Link, TokenType.Link, TokenType.Link, TokenType.Text, TokenType.Link]);
    equal(values(t3), ['reg', 'ular ', 'bo', 'ld', ' ', 'mail.ru']);

    link = t3[0] as TokenLink;
    equal(link.value, 'reg');
    equal(link.link, url);
    equal(link.format, TokenFormat.None);

    link = t3[1] as TokenLink;
    equal(link.value, 'ular ');
    equal(link.link, url2);
    equal(link.format, TokenFormat.None);

    link = t3[2] as TokenLink;
    equal(link.value, 'bo');
    equal(link.link, url2);
    equal(link.format, TokenFormat.Bold);

    link = t3[3] as TokenLink;
    equal(link.value, 'ld');
    equal(link.link, url);
    equal(link.format, TokenFormat.Bold);

    // Удаление ссылки
    const t4 = setLink(t3, null, 0, 10);
    equal(types(t4), [TokenType.Text, TokenType.Text, TokenType.Link, TokenType.Text, TokenType.Link]);
    equal(values(t4), ['regular ', 'bo', 'ld', ' ', 'mail.ru']);

    // Ссылка поверх сплошного токена: удаляем его, заменяем на ссылку
    tokens = parse('text1 @user text2');
    const t5 = setLink(tokens, url, 2, 12);
    equal(types(t5), [TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(t5), ['te', 'xt1 @user te', 'xt2']);
});

test('edit link', () => {
    let tokens = setLink(parse('aa bb cc'), 'https://ok.ru', 3, 2);
    equal(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(tokens), ['aa ', 'bb', ' cc']);

    tokens = insertText(tokens, 5, 'd');
    equal(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(tokens), ['aa ', 'bb', 'd cc']);

    tokens = insertText(tokens, 4, 'e');
    equal(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(tokens), ['aa ', 'beb', 'd cc']);

    tokens = insertText(tokens, 3, 'f');
    equal(types(tokens), [TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(tokens), ['aa f', 'beb', 'd cc']);

    // Целиком удаляем ссылку, выходя за её пределы справа
    const t1 = setLink(parse('foo bar'), '@foo', 0, 3);
    const t2 = removeText(t1, 0, 4);
    equal(types(t2), [TokenType.Text]);
    equal(values(t2), ['bar']);
    // console.log(tokens);
});

test('insert text before link', () => {
    let tokens = parse('https://ok.ru');
    equal(types(tokens), [TokenType.Link]);
    equal(values(tokens), ['https://ok.ru']);

    tokens = insertText(tokens, 0, 'a');
    equal(types(tokens), [TokenType.Text]);
    equal(values(tokens), ['ahttps://ok.ru']);

    tokens = insertText(tokens, 1, ' ');
    equal(types(tokens), [TokenType.Text, TokenType.Link]);
    equal(values(tokens), ['a ', 'https://ok.ru']);
});

test('insert text before custom link', () => {
    let tokens = setLink(parse('foo'), 'ok.ru', 0, 3);
    equal(types(tokens), [TokenType.Link]);
    equal(values(tokens), ['foo']);

    tokens = insertText(tokens, 0, 'a');
    equal(types(tokens), [TokenType.Text, TokenType.Link]);
    equal(values(tokens), ['a', 'foo']);
});

test('insert text inside link at format bound', () => {
    let tokens = setLink(parse('foo bar baz'), 'ok.ru', 0, 11);
    tokens = setFormat(tokens, TokenFormat.Bold, 4, 3);

    tokens = insertText(tokens, 7, 'a');
    equal(types(tokens), [TokenType.Link, TokenType.Link, TokenType.Link]);
    equal(values(tokens), ['foo ', 'bara', ' baz']);
});

test.run();