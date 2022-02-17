import { test } from 'uvu';
import { equal } from 'uvu/assert';
import parse, { TokenType, TokenFormat } from '../src/parser';
import type { TokenText, TokenLink, Emoji } from '../src/parser';
import type { TokenNewline } from '../src/parser/types';

function text(value: string, emoji?: Emoji[]): TokenText {
    const token: TokenText = {
        type: TokenType.Text,
        format: TokenFormat.None,
        value
    };

    if (emoji) {
        token.emoji = emoji;
    }
    return token;
};

function link(value: string, isEmail = false): TokenLink {
    let link = value;
    if (isEmail) {
        link = `mailto:${link}`;
    } else if (/^\/\//.test(link)) {
        link = `http:${link}`;
    } else if (!/^[a-z0-9+-]+:/i.test(link)) {
        link = `http://${link}`;
    }

    return {
        type: TokenType.Link,
        format: TokenFormat.None,
        value,
        link,
        auto: true
    };
};

function newlineToken(value = '\n'): TokenNewline {
    return {
        type: TokenType.Newline,
        format: TokenFormat.None,
        value
    };
}

/**
 * Стандартная функция для проверки ссылок в различных окружениях
 */
function testUrl(url: string, isEmail = false) {
    const linkToken = link(url, isEmail);

    equal(parse(url), [linkToken], `"${url}" only`);

    equal(parse(`foo ${url} bar`), [
        text('foo '),
        linkToken,
        text(' bar')
    ], `"${url}" in text`);

    // Граница слов
    equal(parse(`;${url}`), [
        text(';'),
        linkToken,
    ], `"${url}" after word bound`);

    // За эмоджи
    equal(parse(`👌🏻${url}`), [
        text('👌🏻', [{ from: 0, to: 4 }]),
        linkToken,
    ], `"${url}" after emoji`);

    // Адрес в скобках
    equal(parse(`(${url})`), [
        text('('),
        linkToken,
        text(')'),
    ], `"${url}" in braces`);

    // Внутри русского текста
    equal(parse(`заходите к нам на сайт ${url} и наслаждайтесь`), [
        text('заходите к нам на сайт '),
        linkToken,
        text(' и наслаждайтесь'),
    ], `"${url}" in Russian text`);

    // Внутри HTML (кавычки)
    equal(parse(`<img src="${url}">`), [
        text('<img src="'),
        linkToken,
        text('">'),
    ], `"${url}" in HTML`);

    equal(parse(`'${url}'`), [
        text('\''),
        linkToken,
        text('\''),
    ], `'${url}' in text`);

    // Знак вопроса в конце предложения
    equal(parse(`Have you seen ${url}?`), [
        text('Have you seen '),
        linkToken,
        text('?'),
    ], `"${url}" before questions sign at the end of sentence`);

    // Знак вопроса в конце предложения + перевод строки
    equal(parse(`Have you seen ${url}?\ntest`), [
        text('Have you seen '),
        linkToken,
        text('?'),
        newlineToken(),
        text('test'),
    ], `"${url}" before questions sign at the end of sentence with newline`);

    // Точка в конце предложения
    equal(parse(`Go to ${url}.`), [
        text('Go to '),
        linkToken,
        text('.'),
    ], `"${url}" before period at the end of sentence`);

    // Внутри скобок и текста
    equal(parse(`Был на сайте (${url}), не понравилось.`), [
        text('Был на сайте ('),
        linkToken,
        text('), не понравилось.'),
    ], `"${url}" in brackets in sentence`);

    // Перед переводом строки
    equal(parse(`${url}\ntest`), [
        linkToken,
        newlineToken(),
        text('test'),
    ], `"${url}" before newline`);
}

test('parse e-mail', () => {
    const emails = [
        'serge.che@gmail.com',
        'some.user@corp.mail.ru',
        'some.user@corp.mail.ru?m=true',

        // https://en.wikipedia.org/wiki/Email_address / Examples / Valid email addresses
        'simple@example.com',
        'very.common@example.com',
        'disposable.style.email.with+symbol@example.com',
        'other.email-with-hyphen@example.com',
        'fully-qualified-domain@example.com',
        'user.name+tag+sorting@example.com',
        'x@example.com',
        'example-indeed@strange-example.com',
        // 'admin@mailserver1'
        // 'example@s.example',
        // '" "@example.org',
        // '"john..doe"@example.org',
        'mailhost!username@example.org',
        'user%example.com@example.org',
        'user-@example.org',
        'ok.ru@mail.ru'
    ];

    for (const email of emails) {
        testUrl(email, true);
    }
});

test('handle invalid email', () => {
    // Не e-mail
    equal(parse('Abc.example.com'), [
        link('Abc.example.com')
    ]);

    equal(parse('A@b@c@example.com'), [
        text('A@b@c@example.com')
    ]);

    equal(parse('a"b(c)d,e:f;g<h>i[j\\k]l@example.com'), [
        text('a"b(c)d,e:f;g<h>i[j\\k]'),
        link('l@example.com', true)
    ]);

    equal(parse('just"not"right@example.com'), [
        text('just"not"'),
        link('right@example.com', true),
    ]);

    equal(parse('1234567890123456789012345678901234567890123456789012345678901234+x@example.com'), [
        text('1234567890123456789012345678901234567890123456789012345678901234+x@example.com'),
    ]);
});

test('parse url', () => {
    const urls = [
        'http://vk.co.uk',
        'https://mobile.jira.com/browse/HGD-10584',
        'https://incrussia.ru/news/fake-zoom/',
        'group_calls2.messenger.ok.ru.msk',
        'http://s9500ebtc04.sk.roskazna.local/viewLog.html?buildTypeId=id12skiao_LibCades&buildId=130',
        'https://some.build-server.ru/viewType.html?buildTypeId=NewWeb_MainSh_Messenger&branch_NewWeb_MainSh=%3Cdefault%3E',
        '//m.ok.ru',
        'ftp://m.ok.ru:80',
        'skype://raquelmota1977?chat',
        'magnet:?xt=urn:btih5dee65101db281ac9c46344cd6b175cdcad53426&dn=name',
        'дом.рф',
        'www.google.com',
        'www.google.com:8000',
        'www.google.com/?key=value',
        'github.io',
        'https://127.0.0.1:8000/somethinghere',
        'http://dummyimage.com/50',
        'FTP://GOOGLE.COM',
        'WWW.ДОМ.РФ',
        'youtube.com/watch?v=pS-gbqbVd8c',
        'en.c.org/a_(b)',
        'https://ka.wikipedia.org/wiki/მთავარი_გვერდი',
        'http://username:password@example.com',
        'github.com/minimaxir/big-list-of-naughty-strings/blob/master/blns.txt',
        'http://a/%%30%30',
        'http://ok.ru/#myanchor',
        '中国.中国',
        'xn--90adear.xn--p1ai',
        'https://vk.com/@superappkit-web-sdk',
        'https://ok.ru/#/foo/bar',
        'https://ok.ru/?a:b=c|d',
        'https://ok.ru/foo/bar..5',
    ];

    for (const url of urls) {
        testUrl(url, false);
    }

    // Отдельно парсим хитрую ссылку с кавычками, так как проверка на ординарные
    // кавычки всё поломает
    equal(parse('foo https://www.tutorialspoint.com/how-to-use-xpath-in-selenium-webdriver-to-grab-svg-elements#:~:text=To%20create%20a%20xpath%20for,name()%3D\'svg\'%5D.&text=Here%2C%20data%2Dicon%20is%20an,child%20of%20the%20svg%20tagname bar'), [
        text('foo '),
        link('https://www.tutorialspoint.com/how-to-use-xpath-in-selenium-webdriver-to-grab-svg-elements#:~:text=To%20create%20a%20xpath%20for,name()%3D\'svg\'%5D.&text=Here%2C%20data%2Dicon%20is%20an,child%20of%20the%20svg%20tagname'),
        text(' bar'),
    ]);

    equal(parse('https://www.example.com/file/6lhB89Sk5K6IQ/✅sample?a=1%3A638'), [
        link('https://www.example.com/file/6lhB89Sk5K6IQ/✅sample?a=1%3A638'),
    ]);
});

test.only('handle invalid url', () => {
    console.log(parse('ok.ru:3002️⃣'));

    equal(parse('/var/tmp/foo_bar.cf'), [
        text('/var/tmp/foo_bar.cf'),
    ]);

    equal(parse('/ok.ru'), [
        text('/ok.ru'),
    ]);
});

test.run();