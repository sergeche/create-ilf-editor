import type ParserState from './state';
import { TokenFormat, TokenType } from './types';
import { Codes } from './utils';

export default function parseNewline(state: ParserState): boolean {
    const { pos } = state;
    if (consumeNewline(state)) {
        state.push({
            type: TokenType.Newline,
            format: TokenFormat.None,
            value: state.substring(pos),
        });
        return true;
    }
    return false;
}

export function consumeNewline(state: ParserState): boolean {
    if (state.consume(Codes.Return)) {
        // Поглощаем \r либо \r\n, как в Windows
        state.consume(Codes.NewLine);
        return true;
    }

    return state.consume(Codes.NewLine) || state.consume(Codes.LineFeed);
}
