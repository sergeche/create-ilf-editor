import { test } from 'uvu';
import { equal } from 'uvu/assert';
import parse, { TokenType, TokenFormat } from '../src/parser';
import type { Token, TokenLink, TokenText, TokenHashTag } from '../src/parser';
import { insertText, removeText, setFormat } from '../src/formatting';

function emojiText(token: Token): string[] {
    return token.emoji.map(e => token.value.substring(e.from, e.to));
}

function types(tokens: Token[]): TokenType[] {
    return tokens.map(t => t.type);
}

function values(tokens: Token[]): string[] {
    return tokens.map(t => t.value);
}

test('solid: link', () => {
    const source = parse('http://ok.ru mail.ru ');
    source.push({
        type: TokenType.Link,
        format: 0,
        link: 'https://tamtam.chat',
        auto: false,
        value: 'Чат'
    });
    let link = source[2] as TokenLink;

    equal(link.type, TokenType.Link);
    equal(link.link, 'http://mail.ru');
    equal(link.value, 'mail.ru');

    // Модификация текста авто-ссылки: должны обновить и ссылку
    const t1 = insertText(source, 17, '123');
    link = t1[2] as TokenLink;
    equal(t1.length, 5);
    equal(link.type, TokenType.Link);
    equal(link.link, 'http://mail123.ru');
    equal(link.value, 'mail123.ru');

    // Модификация текста ссылки пользовательской ссылки: должны оставить ссылку
    const t2 = insertText(source, 23, '123😈');
    link = t2[4] as TokenLink;
    equal(t2.length, 5);
    equal(link.type, TokenType.Link);
    equal(link.link, 'https://tamtam.chat');
    equal(link.value, 'Ча123😈т');
    equal(emojiText(link), ['😈']);

    // Удаляем символ, из-за чего ссылка становится невалидной
    const t3 = removeText(source, 17, 1);
    const text = t3[1] as TokenText;
    equal(t3.length, 3);
    equal(text.type, TokenType.Text);
    equal(text.value, ' mailru ');

    // Удаляем содержимое кастомной ссылки: должны удалить сам токен
    const t4 = removeText(source, 21, 3);
    equal(types(t4), [TokenType.Link, TokenType.Text, TokenType.Link, TokenType.Text]);
    equal(values(t4), ['http://ok.ru', ' ', 'mail.ru', ' ']);

    // Удаляем пересечение токенов
    const t5 = removeText(source, 7, 9);
    link = t5[0] as TokenLink;
    equal(link.link, 'http://l.ru');
    equal(link.value, 'http://l.ru');
    equal(types(t5), [TokenType.Link, TokenType.Text, TokenType.Link]);
    equal(values(t5), ['http://l.ru', ' ', 'Чат']);

    // Меняем формат у части строгой ссылки: меняем формат у всей ссылки
    const t6 = setFormat(source, { add: TokenFormat.Bold }, 7, 2);
    link = t6[0] as TokenLink;
    equal(link.link, 'http://ok.ru');
    equal(link.value, 'http://ok.ru');
    equal(link.format, TokenFormat.Bold);
    equal(types(t6), [TokenType.Link, TokenType.Text, TokenType.Link, TokenType.Text, TokenType.Link]);
    equal(values(t6), ['http://ok.ru', ' ', 'mail.ru', ' ', 'Чат']);
});

test('hashtag', () => {
    const source = parse('#foo #bar #baz');
    let hashtag = source[0] as TokenHashTag;
    equal(hashtag.type, TokenType.HashTag);
    equal(hashtag.value, '#foo');

    const t1 = insertText(source, 4, '123');
    hashtag = t1[0] as TokenHashTag;
    equal(hashtag.type, TokenType.HashTag);
    equal(hashtag.value, '#foo123');
    equal(types(t1), [TokenType.HashTag, TokenType.Text, TokenType.HashTag, TokenType.Text, TokenType.HashTag]);
    equal(values(t1), ['#foo123', ' ', '#bar', ' ', '#baz']);

    // Удаляем символ, из-за чего хэштэг становится невалидным
    const t2 = removeText(source, 5, 1);
    equal(types(t2), [TokenType.HashTag, TokenType.Text, TokenType.HashTag]);
    equal(values(t2), ['#foo', ' bar ', '#baz']);

    // Удаляем диапазон, два хэштэга сливаются в один
    const t3 = removeText(source, 3, 3);
    equal(types(t3), [TokenType.HashTag, TokenType.Text, TokenType.HashTag]);
    equal(values(t3), ['#fobar', ' ', '#baz']);

    // Меняем форматирование у диапазона: так как хэштэг — это сплошной
    // токен
    const t4 = setFormat(source, { add: TokenFormat.Bold }, 3, 3);
    equal(types(t4), [TokenType.HashTag, TokenType.Text, TokenType.HashTag, TokenType.Text, TokenType.HashTag]);
    equal(values(t4), ['#foo', ' ', '#bar', ' ', '#baz']);
    equal(t4.map(t => t.format), [TokenFormat.Bold, TokenFormat.Bold, TokenFormat.Bold, TokenFormat.None, TokenFormat.None]);
});