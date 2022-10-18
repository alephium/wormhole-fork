import { Parser } from "binary-parser"

const errors = ['Assertion error', 'Offset is outside']

export class P<T> {
    readonly parser: Parser
    constructor(parser: Parser) {
        this.parser = parser
    }

    // Try to parse a buffer with a parser, and return null if it failed due to an
    // assertion error.
    parse(buffer: Buffer): T | null {
        try {
            let result = this.parser.parse(buffer)
            delete result['end']
            return result
        } catch (e: any) {
            if (errors.some(msg => e.message?.includes(msg))) {
                return null
            } else {
                throw e
            }
        }
    }

    or<U>(other: P<U>): P<T | U> {
        let p = new P<T | U>(other.parser);
        p.parse = (buffer: Buffer): T | U | null => {
            return this.parse(buffer) ?? other.parse(buffer)
        }
        return p
    }
}
