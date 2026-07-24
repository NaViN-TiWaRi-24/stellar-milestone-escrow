import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCQGR5ASUDD5BBOWPVU5TNXUH675HSRFHXGWNFT4CPXVQMFZFKX5V2ET",
  }
} as const

export type DataKey = {tag: "NextProjectId", values: void} | {tag: "Project", values: readonly [u64]} | {tag: "UserProjects", values: readonly [string]};


export interface Project {
  asset: string;
  client: string;
  escrowed_amount: i128;
  freelancer: string;
  id: u64;
  milestones: Array<Milestone>;
  released_amount: i128;
  status: ProjectStatus;
  title: string;
  total_amount: i128;
}


export interface Milestone {
  amount: i128;
  deadline: u64;
  id: u32;
  status: MilestoneStatus;
  title: string;
  work_reference: string;
}

export const EscrowError = {
  1: {message:"InvalidAmount"},
  2: {message:"InvalidDeadline"},
  3: {message:"EmptyMilestones"},
  4: {message:"MilestoneTotalMismatch"},
  5: {message:"ProjectNotFound"},
  6: {message:"Unauthorized"},
  7: {message:"InvalidProjectState"},
  8: {message:"InvalidMilestoneState"},
  9: {message:"AlreadyFunded"},
  10: {message:"AlreadyPaid"},
  11: {message:"MilestoneNotFound"},
  12: {message:"EmptyWorkReference"},
  13: {message:"InsufficientEscrow"},
  14: {message:"ArithmeticOverflow"},
  15: {message:"InvalidParticipant"}
}

export type ProjectStatus = {tag: "Created", values: void} | {tag: "Accepted", values: void} | {tag: "Funded", values: void} | {tag: "Active", values: void} | {tag: "Completed", values: void} | {tag: "Cancelled", values: void} | {tag: "RefundRequested", values: void} | {tag: "Refunded", values: void};




export interface MilestoneInput {
  amount: i128;
  deadline: u64;
  title: string;
}


export type MilestoneStatus = {tag: "Pending", values: void} | {tag: "Submitted", values: void} | {tag: "Approved", values: void} | {tag: "Paid", values: void};







export interface Client {
  /**
   * Construct and simulate a get_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_project: ({project_id}: {project_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

  /**
   * Construct and simulate a fund_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  fund_project: ({project_id, client}: {project_id: u64, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

  /**
   * Construct and simulate a accept_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  accept_project: ({project_id, freelancer}: {project_id: u64, freelancer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

  /**
   * Construct and simulate a approve_refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_refund: ({project_id, freelancer}: {project_id: u64, freelancer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

  /**
   * Construct and simulate a cancel_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_project: ({project_id, client}: {project_id: u64, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

  /**
   * Construct and simulate a create_project transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_project: ({client, freelancer, asset, title, total_amount, milestone_inputs}: {client: string, freelancer: string, asset: string, title: string, total_amount: i128, milestone_inputs: Array<MilestoneInput>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a request_refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  request_refund: ({project_id, client}: {project_id: u64, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

  /**
   * Construct and simulate a submit_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_milestone: ({project_id, milestone_id, freelancer, work_reference}: {project_id: u64, milestone_id: u32, freelancer: string, work_reference: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

  /**
   * Construct and simulate a approve_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_milestone: ({project_id, milestone_id, client}: {project_id: u64, milestone_id: u32, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

  /**
   * Construct and simulate a get_user_projects transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_user_projects: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a release_milestone_payment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  release_milestone_payment: ({project_id, milestone_id, client}: {project_id: u64, milestone_id: u32, client: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Project>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAAAAAAAAAAADU5leHRQcm9qZWN0SWQAAAAAAAABAAAAAAAAAAdQcm9qZWN0AAAAAAEAAAAGAAAAAQAAAAAAAAAMVXNlclByb2plY3RzAAAAAQAAABM=",
        "AAAAAQAAAAAAAAAAAAAAB1Byb2plY3QAAAAACgAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAZjbGllbnQAAAAAABMAAAAAAAAAD2VzY3Jvd2VkX2Ftb3VudAAAAAALAAAAAAAAAApmcmVlbGFuY2VyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAKbWlsZXN0b25lcwAAAAAD6gAAB9AAAAAJTWlsZXN0b25lAAAAAAAAAAAAAA9yZWxlYXNlZF9hbW91bnQAAAAACwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADVByb2plY3RTdGF0dXMAAAAAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAAMdG90YWxfYW1vdW50AAAACw==",
        "AAAAAQAAAAAAAAAAAAAACU1pbGVzdG9uZQAAAAAAAAYAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAD01pbGVzdG9uZVN0YXR1cwAAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAAOd29ya19yZWZlcmVuY2UAAAAAABA=",
        "AAAABAAAAAAAAAAAAAAAC0VzY3Jvd0Vycm9yAAAAAA8AAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAABAAAAAAAAAA9JbnZhbGlkRGVhZGxpbmUAAAAAAgAAAAAAAAAPRW1wdHlNaWxlc3RvbmVzAAAAAAMAAAAAAAAAFk1pbGVzdG9uZVRvdGFsTWlzbWF0Y2gAAAAAAAQAAAAAAAAAD1Byb2plY3ROb3RGb3VuZAAAAAAFAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAAGAAAAAAAAABNJbnZhbGlkUHJvamVjdFN0YXRlAAAAAAcAAAAAAAAAFUludmFsaWRNaWxlc3RvbmVTdGF0ZQAAAAAAAAgAAAAAAAAADUFscmVhZHlGdW5kZWQAAAAAAAAJAAAAAAAAAAtBbHJlYWR5UGFpZAAAAAAKAAAAAAAAABFNaWxlc3RvbmVOb3RGb3VuZAAAAAAAAAsAAAAAAAAAEkVtcHR5V29ya1JlZmVyZW5jZQAAAAAADAAAAAAAAAASSW5zdWZmaWNpZW50RXNjcm93AAAAAAANAAAAAAAAABJBcml0aG1ldGljT3ZlcmZsb3cAAAAAAA4AAAAAAAAAEkludmFsaWRQYXJ0aWNpcGFudAAAAAAADw==",
        "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",
        "AAAAAAAAAAAAAAAMZnVuZF9wcm9qZWN0AAAAAgAAAAAAAAAKcHJvamVjdF9pZAAAAAAABgAAAAAAAAAGY2xpZW50AAAAAAATAAAAAQAAA+kAAAfQAAAAB1Byb2plY3QAAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
        "AAAAAAAAAAAAAAAOYWNjZXB0X3Byb2plY3QAAAAAAAIAAAAAAAAACnByb2plY3RfaWQAAAAAAAYAAAAAAAAACmZyZWVsYW5jZXIAAAAAABMAAAABAAAD6QAAB9AAAAAHUHJvamVjdAAAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
        "AAAAAAAAAAAAAAAOYXBwcm92ZV9yZWZ1bmQAAAAAAAIAAAAAAAAACnByb2plY3RfaWQAAAAAAAYAAAAAAAAACmZyZWVsYW5jZXIAAAAAABMAAAABAAAD6QAAB9AAAAAHUHJvamVjdAAAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
        "AAAAAAAAAAAAAAAOY2FuY2VsX3Byb2plY3QAAAAAAAIAAAAAAAAACnByb2plY3RfaWQAAAAAAAYAAAAAAAAABmNsaWVudAAAAAAAEwAAAAEAAAPpAAAH0AAAAAdQcm9qZWN0AAAAB9AAAAALRXNjcm93RXJyb3IA",
        "AAAAAAAAAAAAAAAOY3JlYXRlX3Byb2plY3QAAAAAAAYAAAAAAAAABmNsaWVudAAAAAAAEwAAAAAAAAAKZnJlZWxhbmNlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAADHRvdGFsX2Ftb3VudAAAAAsAAAAAAAAAEG1pbGVzdG9uZV9pbnB1dHMAAAPqAAAH0AAAAA5NaWxlc3RvbmVJbnB1dAAAAAAAAQAAA+kAAAAGAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
        "AAAAAAAAAAAAAAAOcmVxdWVzdF9yZWZ1bmQAAAAAAAIAAAAAAAAACnByb2plY3RfaWQAAAAAAAYAAAAAAAAABmNsaWVudAAAAAAAEwAAAAEAAAPpAAAH0AAAAAdQcm9qZWN0AAAAB9AAAAALRXNjcm93RXJyb3IA",
        "AAAAAAAAAAAAAAAQc3VibWl0X21pbGVzdG9uZQAAAAQAAAAAAAAACnByb2plY3RfaWQAAAAAAAYAAAAAAAAADG1pbGVzdG9uZV9pZAAAAAQAAAAAAAAACmZyZWVsYW5jZXIAAAAAABMAAAAAAAAADndvcmtfcmVmZXJlbmNlAAAAAAAQAAAAAQAAA+kAAAfQAAAAB1Byb2plY3QAAAAH0AAAAAtFc2Nyb3dFcnJvcgA=",
        "AAAAAAAAAAAAAAARYXBwcm92ZV9taWxlc3RvbmUAAAAAAAADAAAAAAAAAApwcm9qZWN0X2lkAAAAAAAGAAAAAAAAAAxtaWxlc3RvbmVfaWQAAAAEAAAAAAAAAAZjbGllbnQAAAAAABMAAAABAAAD6QAAB9AAAAAHUHJvamVjdAAAAAfQAAAAC0VzY3Jvd0Vycm9yAA==",
        "AAAAAAAAAAAAAAARZ2V0X3VzZXJfcHJvamVjdHMAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAABg==",
        "AAAAAAAAAAAAAAAZcmVsZWFzZV9taWxlc3RvbmVfcGF5bWVudAAAAAAAAAMAAAAAAAAACnByb2plY3RfaWQAAAAAAAYAAAAAAAAADG1pbGVzdG9uZV9pZAAAAAQAAAAAAAAABmNsaWVudAAAAAAAEwAAAAEAAAPpAAAH0AAAAAdQcm9qZWN0AAAAB9AAAAALRXNjcm93RXJyb3IA" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_project: this.txFromJSON<Result<Project>>,
        fund_project: this.txFromJSON<Result<Project>>,
        accept_project: this.txFromJSON<Result<Project>>,
        approve_refund: this.txFromJSON<Result<Project>>,
        cancel_project: this.txFromJSON<Result<Project>>,
        create_project: this.txFromJSON<Result<u64>>,
        request_refund: this.txFromJSON<Result<Project>>,
        submit_milestone: this.txFromJSON<Result<Project>>,
        approve_milestone: this.txFromJSON<Result<Project>>,
        get_user_projects: this.txFromJSON<Array<u64>>,
        release_milestone_payment: this.txFromJSON<Result<Project>>
  }
}