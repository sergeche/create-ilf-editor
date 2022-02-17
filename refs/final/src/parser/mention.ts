import { TokenFormat, TokenType } from './types';
import type ParserState from './state';
import { Codes, consumeIdentifier, isDelimiter } from './utils';

export default function parseMention(state: ParserState): boolean {
    if (state.atWordBound()) {
        const { pos } = state;
        if (state.consume(Codes.At)) {
            // Разрешаем поглотить самостоятельный символ `@`, чтобы показывать
            // его в редакторе и при необходимости вывести автокомплит
            if (consumeIdentifier(state) || isDelimiter(state.peek())) {
                state.push({
                    type: TokenType.Mention,
                    format: TokenFormat.None,
                    value: state.substring(pos),
                });
                return true;
            }
        }

        state.pos = pos;
    }

    return false;
}
