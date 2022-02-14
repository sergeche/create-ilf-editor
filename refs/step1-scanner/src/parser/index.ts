import ParserState from './state';
import type { Token } from './types';
import newline from './newline';

export default function parse(text: string): Token[] {
    const state = new ParserState(text);

    while (state.hasNext()) {
        newline(state) || state.consumeText();
    }

    state.flushText();
    return state.tokens;
}

export { TokenType, TokenFormat } from './types';
export type { Emoji, Token, TokenHashTag, TokenLink, TokenMention, TokenText } from './types';
