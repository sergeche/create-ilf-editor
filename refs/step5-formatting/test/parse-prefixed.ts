import { test } from 'uvu';
import { equal } from 'uvu/assert';
import parse, { TokenType, TokenFormat } from '../src/parser';

test('parse hashtags', () => {
    equal(parse('#foo'), [
        { type: TokenType.HashTag, format: TokenFormat.None, value: '#foo' }
    ]);

    equal(parse('#foo bar'), [
        { type: TokenType.HashTag, format: TokenFormat.None, value: '#foo' },
        { type: TokenType.Text, format: TokenFormat.None, value: ' bar' }
    ]);

    equal(parse('#foo test #1 # #@bar #!attention'), [
        { type: TokenType.HashTag, format: TokenFormat.None, value: '#foo' },
        { type: TokenType.Text, format: TokenFormat.None, value: ' test ' },
        { type: TokenType.HashTag, format: TokenFormat.None, value: '#1' },
        { type: TokenType.Text, format: TokenFormat.None, value: ' # #@bar #!attention' }
    ]);

    // Хэштэги можно писать вместе
    equal(parse('#hello#world'), [
        { type: TokenType.HashTag, format: TokenFormat.None, value: '#hello' },
        { type: TokenType.HashTag, format: TokenFormat.None, value: '#world' },
    ]);

    // Не-латинские хэштэги
    equal(parse('#привет #سلام'), [
        { type: TokenType.HashTag, format: TokenFormat.None, value: '#привет' },
        { type: TokenType.Text, format: TokenFormat.None, value: ' ' },
        { type: TokenType.HashTag, format: TokenFormat.None, value: '#سلام' },
    ]);
});

test('parse mentions', () => {
    equal(parse('@foo bar @1 @ foo@bar'), [
        { type: TokenType.Mention, format: TokenFormat.None, value: '@foo' },
        { type: TokenType.Text, format: TokenFormat.None, value: ' bar @1 ' },
        { type: TokenType.Mention, format: TokenFormat.None, value: '@' },
        { type: TokenType.Text, format: TokenFormat.None, value: ' foo@bar' }
    ]);

    // Игнорируем не-латинские и не начинающиеся с латинского символа упоминания
    equal(parse('@егор @1егор @1foo'), [
        { type: TokenType.Text, format: TokenFormat.None, value: '@егор @1егор @1foo' }
    ]);

    equal(parse('@@ @@foo'), [
        { type: TokenType.Text, format: TokenFormat.None, value: '@@ @@foo' }
    ]);
});

test.run();