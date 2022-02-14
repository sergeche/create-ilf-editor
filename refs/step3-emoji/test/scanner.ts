import { test } from 'uvu';
import { equal } from 'uvu/assert';
import parse, { TokenType, TokenFormat } from '../src/parser';

test('Hello World', () => {
    equal(parse('hello\nworld'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: 'hello',
    }, {
        type: TokenType.Newline,
        format: TokenFormat.None,
        value: '\n',
    }, {
        type: TokenType.Text,
        format: TokenFormat.None,
        value: 'world',
    }]);
});

test.run();