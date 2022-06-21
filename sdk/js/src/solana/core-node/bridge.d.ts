/* tslint:disable */
/* eslint-disable */
/**
* @param {string} program_id
* @param {string} payer
* @param {string} emitter
* @param {string} message
* @param {number} nonce
* @param {Uint8Array} msg
* @param {string} consistency
* @returns {any}
*/
export function post_message_ix(program_id: string, payer: string, emitter: string, message: string, nonce: number, msg: Uint8Array, consistency: string): any;
/**
* @param {string} program_id
* @param {string} payer
* @param {string} signature_set
* @param {Uint8Array} vaa
* @returns {any}
*/
export function post_vaa_ix(program_id: string, payer: string, signature_set: string, vaa: Uint8Array): any;
/**
* @param {string} program_id
* @param {string} payer
* @param {Uint8Array} vaa
* @returns {any}
*/
export function update_guardian_set_ix(program_id: string, payer: string, vaa: Uint8Array): any;
/**
* @param {string} program_id
* @param {string} payer
* @param {Uint8Array} vaa
* @returns {any}
*/
export function set_fees_ix(program_id: string, payer: string, vaa: Uint8Array): any;
/**
* @param {string} program_id
* @param {string} payer
* @param {Uint8Array} vaa
* @returns {any}
*/
export function transfer_fees_ix(program_id: string, payer: string, vaa: Uint8Array): any;
/**
* @param {string} program_id
* @param {string} payer
* @param {string} spill
* @param {Uint8Array} vaa
* @returns {any}
*/
export function upgrade_contract_ix(program_id: string, payer: string, spill: string, vaa: Uint8Array): any;
/**
* @param {string} program_id
* @param {string} payer
* @param {number} guardian_set_index
* @param {any} guardian_set
* @param {string} signature_set
* @param {Uint8Array} vaa_data
* @returns {any}
*/
export function verify_signatures_ix(program_id: string, payer: string, guardian_set_index: number, guardian_set: any, signature_set: string, vaa_data: Uint8Array): any;
/**
* @param {string} bridge
* @param {number} index
* @returns {Uint8Array}
*/
export function guardian_set_address(bridge: string, index: number): Uint8Array;
/**
* @param {Uint8Array} data
* @returns {any}
*/
export function parse_guardian_set(data: Uint8Array): any;
/**
* @param {string} bridge
* @returns {Uint8Array}
*/
export function state_address(bridge: string): Uint8Array;
/**
* @param {Uint8Array} data
* @returns {any}
*/
export function parse_state(data: Uint8Array): any;
/**
* @param {string} bridge
* @returns {Uint8Array}
*/
export function fee_collector_address(bridge: string): Uint8Array;
/**
* @param {string} program_id
* @param {Uint8Array} vaa
* @returns {Uint8Array}
*/
export function claim_address(program_id: string, vaa: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} data
* @returns {any}
*/
export function parse_posted_message(data: Uint8Array): any;
/**
* @param {Uint8Array} data
* @returns {any}
*/
export function parse_vaa(data: Uint8Array): any;
/**
* Initialize Javascript logging and panic handler
*/
export function init(): void;
/**
*/
export class Hash {
  free(): void;
/**
* Create a new Hash object
*
* * `value` - optional hash as a base58 encoded string, `Uint8Array`, `[number]`
* @param {any} value
*/
  constructor(value: any);
/**
* Return the base58 string representation of the hash
* @returns {string}
*/
  toString(): string;
/**
* Checks if two `Hash`s are equal
* @param {Hash} other
* @returns {boolean}
*/
  equals(other: Hash): boolean;
/**
* Return the `Uint8Array` representation of the hash
* @returns {Uint8Array}
*/
  toBytes(): Uint8Array;
}
/**
* A directive for a single invocation of a Solana program.
*
* An instruction specifies which program it is calling, which accounts it may
* read or modify, and additional data that serves as input to the program. One
* or more instructions are included in transactions submitted by Solana
* clients. Instructions are also used to describe [cross-program
* invocations][cpi].
*
* [cpi]: https://docs.solana.com/developing/programming-model/calling-between-programs
*
* During execution, a program will receive a list of account data as one of
* its arguments, in the same order as specified during `Instruction`
* construction.
*
* While Solana is agnostic to the format of the instruction data, it has
* built-in support for serialization via [`borsh`] and [`bincode`].
*
* [`borsh`]: https://docs.rs/borsh/latest/borsh/
* [`bincode`]: https://docs.rs/bincode/latest/bincode/
*
* # Specifying account metadata
*
* When constructing an [`Instruction`], a list of all accounts that may be
* read or written during the execution of that instruction must be supplied as
* [`AccountMeta`] values.
*
* Any account whose data may be mutated by the program during execution must
* be specified as writable. During execution, writing to an account that was
* not specified as writable will cause the transaction to fail. Writing to an
* account that is not owned by the program will cause the transaction to fail.
*
* Any account whose lamport balance may be mutated by the program during
* execution must be specified as writable. During execution, mutating the
* lamports of an account that was not specified as writable will cause the
* transaction to fail. While _subtracting_ lamports from an account not owned
* by the program will cause the transaction to fail, _adding_ lamports to any
* account is allowed, as long is it is mutable.
*
* Accounts that are not read or written by the program may still be specified
* in an `Instruction`'s account list. These will affect scheduling of program
* execution by the runtime, but will otherwise be ignored.
*
* When building a transaction, the Solana runtime coalesces all accounts used
* by all instructions in that transaction, along with accounts and permissions
* required by the runtime, into a single account list. Some accounts and
* account permissions required by the runtime to process a transaction are
* _not_ required to be included in an `Instruction`s account list. These
* include:
*
* - The program ID &mdash; it is a separate field of `Instruction`
* - The transaction's fee-paying account &mdash; it is added during [`Message`]
*   construction. A program may still require the fee payer as part of the
*   account list if it directly references it.
*
* [`Message`]: crate::message::Message
*
* Programs may require signatures from some accounts, in which case they
* should be specified as signers during `Instruction` construction. The
* program must still validate during execution that the account is a signer.
*/
export class Instruction {
  free(): void;
}
/**
*/
export class Instructions {
  free(): void;
/**
*/
  constructor();
/**
* @param {Instruction} instruction
*/
  push(instruction: Instruction): void;
}
/**
*/
export class Message {
  free(): void;
/**
* The id of a recent ledger entry.
*/
  recent_blockhash: Hash;
}
/**
*/
export class Pubkey {
  free(): void;
/**
* Create a new Pubkey object
*
* * `value` - optional public key as a base58 encoded string, `Uint8Array`, `[number]`
* @param {any} value
*/
  constructor(value: any);
/**
* Return the base58 string representation of the public key
* @returns {string}
*/
  toString(): string;
/**
* Check if a `Pubkey` is on the ed25519 curve.
* @returns {boolean}
*/
  isOnCurve(): boolean;
/**
* Checks if two `Pubkey`s are equal
* @param {Pubkey} other
* @returns {boolean}
*/
  equals(other: Pubkey): boolean;
/**
* Return the `Uint8Array` representation of the public key
* @returns {Uint8Array}
*/
  toBytes(): Uint8Array;
/**
* Derive a Pubkey from another Pubkey, string seed, and a program id
* @param {Pubkey} base
* @param {string} seed
* @param {Pubkey} owner
* @returns {Pubkey}
*/
  static createWithSeed(base: Pubkey, seed: string, owner: Pubkey): Pubkey;
/**
* Derive a program address from seeds and a program id
* @param {any[]} seeds
* @param {Pubkey} program_id
* @returns {Pubkey}
*/
  static createProgramAddress(seeds: any[], program_id: Pubkey): Pubkey;
/**
* Find a valid program address
*
* Returns:
* * `[PubKey, number]` - the program address and bump seed
* @param {any[]} seeds
* @param {Pubkey} program_id
* @returns {any}
*/
  static findProgramAddress(seeds: any[], program_id: Pubkey): any;
}
export class SystemInstruction {
  free(): void;
/**
* @param {Pubkey} from_pubkey
* @param {Pubkey} to_pubkey
* @param {BigInt} lamports
* @param {BigInt} space
* @param {Pubkey} owner
* @returns {Instruction}
*/
  static createAccount(from_pubkey: Pubkey, to_pubkey: Pubkey, lamports: BigInt, space: BigInt, owner: Pubkey): Instruction;
/**
* @param {Pubkey} from_pubkey
* @param {Pubkey} to_pubkey
* @param {Pubkey} base
* @param {string} seed
* @param {BigInt} lamports
* @param {BigInt} space
* @param {Pubkey} owner
* @returns {Instruction}
*/
  static createAccountWithSeed(from_pubkey: Pubkey, to_pubkey: Pubkey, base: Pubkey, seed: string, lamports: BigInt, space: BigInt, owner: Pubkey): Instruction;
/**
* @param {Pubkey} pubkey
* @param {Pubkey} owner
* @returns {Instruction}
*/
  static assign(pubkey: Pubkey, owner: Pubkey): Instruction;
/**
* @param {Pubkey} pubkey
* @param {Pubkey} base
* @param {string} seed
* @param {Pubkey} owner
* @returns {Instruction}
*/
  static assignWithSeed(pubkey: Pubkey, base: Pubkey, seed: string, owner: Pubkey): Instruction;
/**
* @param {Pubkey} from_pubkey
* @param {Pubkey} to_pubkey
* @param {BigInt} lamports
* @returns {Instruction}
*/
  static transfer(from_pubkey: Pubkey, to_pubkey: Pubkey, lamports: BigInt): Instruction;
/**
* @param {Pubkey} from_pubkey
* @param {Pubkey} from_base
* @param {string} from_seed
* @param {Pubkey} from_owner
* @param {Pubkey} to_pubkey
* @param {BigInt} lamports
* @returns {Instruction}
*/
  static transferWithSeed(from_pubkey: Pubkey, from_base: Pubkey, from_seed: string, from_owner: Pubkey, to_pubkey: Pubkey, lamports: BigInt): Instruction;
/**
* @param {Pubkey} pubkey
* @param {BigInt} space
* @returns {Instruction}
*/
  static allocate(pubkey: Pubkey, space: BigInt): Instruction;
/**
* @param {Pubkey} address
* @param {Pubkey} base
* @param {string} seed
* @param {BigInt} space
* @param {Pubkey} owner
* @returns {Instruction}
*/
  static allocateWithSeed(address: Pubkey, base: Pubkey, seed: string, space: BigInt, owner: Pubkey): Instruction;
/**
* @param {Pubkey} from_pubkey
* @param {Pubkey} nonce_pubkey
* @param {Pubkey} authority
* @param {BigInt} lamports
* @returns {Array<any>}
*/
  static createNonceAccount(from_pubkey: Pubkey, nonce_pubkey: Pubkey, authority: Pubkey, lamports: BigInt): Array<any>;
/**
* @param {Pubkey} nonce_pubkey
* @param {Pubkey} authorized_pubkey
* @returns {Instruction}
*/
  static advanceNonceAccount(nonce_pubkey: Pubkey, authorized_pubkey: Pubkey): Instruction;
/**
* @param {Pubkey} nonce_pubkey
* @param {Pubkey} authorized_pubkey
* @param {Pubkey} to_pubkey
* @param {BigInt} lamports
* @returns {Instruction}
*/
  static withdrawNonceAccount(nonce_pubkey: Pubkey, authorized_pubkey: Pubkey, to_pubkey: Pubkey, lamports: BigInt): Instruction;
/**
* @param {Pubkey} nonce_pubkey
* @param {Pubkey} authorized_pubkey
* @param {Pubkey} new_authority
* @returns {Instruction}
*/
  static authorizeNonceAccount(nonce_pubkey: Pubkey, authorized_pubkey: Pubkey, new_authority: Pubkey): Instruction;
}
