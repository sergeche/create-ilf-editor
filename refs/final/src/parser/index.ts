import ParserState from './state';
import type { Token } from './types';
import emoji from './emoji';
import textEmoji from './text-emoji';
import mention from './mention';
import hashtag from './hashtag';
import link from './link';
import newline from './newline';

export default function parse(text: string): Token[] {
    const state = new ParserState(text);

    while (state.hasNext()) {
        newline(state)
            || emoji(state) || textEmoji(state)
            || mention(state) || hashtag(state)
            || link(state)
            || state.consumeText();
    }

    state.flushText();
    return state.tokens;
}

export { normalize, getText, getLength } from './utils';
export { TokenType, TokenFormat } from './types';
export type { Emoji, Token, TokenHashTag, TokenLink, TokenMention, TokenText } from './types';
