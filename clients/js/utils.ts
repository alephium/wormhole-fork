// This function should be called after pattern matching on all possible options
// of an enum (union) type, so that typescript can derive that no other options
// are possible.  If (from JavaScript land) an unsupported argument is passed
// in, this function just throws. If the enum type is extended with new cases,
// the call to this function will then fail to compile, drawing attention to an
// unhandled case somewhere.
export function impossible(a: never): any {
    throw new Error(`Impossible: ${a}`)
}
