import { TokenFormat, TokenType } from './types';
import type ParserState from './state';
import { Codes, isBound, isNumber, isUnicodeAlpha, last } from './utils';

export default function parseHashtag(state: ParserState): boolean {
    if (atHashtagBound(state)) {
        const { pos } = state;
        if (state.consume(Codes.Hash)) {
            if (state.consumeWhile(isHashtagName) || isBound(state.peek())) {
                const value = state.substring(pos);
                state.push({
                    type: TokenType.HashTag,
                    format: TokenFormat.None,
                    value,
                });
                return true;
            }
        }

        state.pos = pos;
    }

    return false;
}

/**
 * Проверяет, находимся ли мы на границе для хэштегов. В отличие от других токенов,
 * хэштэги можно сцеплять вместе
 */
function atHashtagBound(state: ParserState): boolean {
    if (state.atWordBound()) {
        return true;
    }

    if (!state.hasPendingText()) {
        const lastToken = last(state.tokens);
        if (lastToken) {
            return lastToken.type === TokenType.HashTag;
        }
    }

    return false;
}

function isHashtagName(ch: number): boolean {
    return ch === Codes.Underscore || isNumber(ch) || isUnicodeAlpha(ch);
}