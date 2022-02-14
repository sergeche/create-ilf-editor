import { test } from 'uvu';
import { equal } from 'uvu/assert';
import parse, { TokenType, TokenFormat } from '../src/parser';

test('parse basic emoji', () => {
    equal(parse('a✊b'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: 'a✊b',
        emoji: [{ from: 1, to: 2 }]
    }]);

    equal(parse('a✊ba✊ba✊b'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: 'a✊ba✊ba✊b',
        emoji: [
            { from: 1, to: 2 },
            { from: 4, to: 5 },
            { from: 7, to: 8 }
        ]
    }]);

    equal(parse('😃✊😃'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: '😃✊😃',
        emoji: [
            { from: 0, to: 2 },
            { from: 2, to: 3 },
            { from: 3, to: 5 }
        ]
    }]);

    // keycap-последовательность
    equal(parse('12️⃣'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: '12️⃣',
        emoji: [{ from: 1, to: 4 }]
    }]);

    // эмоджи с указанием тона кожи
    equal(parse('👍🏽 🧒🏼'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: '👍🏽 🧒🏼',
        emoji: [
            { from: 0, to: 4 },
            { from: 5, to: 9 }
        ]
    }]);

    // комбинированные эмоджи
    equal(parse('👩🏼👩🏼‍🦰🤦🏼‍♀️'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: '👩🏼👩🏼‍🦰🤦🏼‍♀️',
        emoji: [
            { from: 0, to: 4 },
            { from: 4, to: 11 },
            { from: 11, to: 18 }
        ]
    }]);
});

test('parse text smileys', () => {
    equal(parse(':)'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: ':)',
        emoji: [{ from: 0, to: 2, emoji: '🙂' }]
    }]);

    equal(parse(':))))'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: ':))))',
        emoji: [{ from: 0, to: 2, emoji: '🙂' }]
    }]);

    // не парсим смайлик, если не на границе слова
    equal(parse('a:)'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: 'a:)'
    }]);

    equal(parse(':)a'), [{
        type: TokenType.Text,
        format: TokenFormat.None,
        value: ':)a'
    }]);
});

test.run();