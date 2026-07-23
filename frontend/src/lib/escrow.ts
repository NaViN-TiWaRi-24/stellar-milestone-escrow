import { signTransaction } from "@stellar/freighter-api";
import type { Project, Client } from "milestone-escrow";

const rpcUrl = import.meta.env.VITE_STELLAR_RPC_URL;
const networkPassphrase = import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE;
const contractId = import.meta.env.VITE_ESCROW_CONTRACT_ID;
const transactionTimeoutSeconds = 60;

export type WriteTransactionStatus =
  | "preparing"
  | "waiting-for-signature"
  | "submitting";

export type WriteStatusCallback = (status: WriteTransactionStatus) => void;

export type ProjectWriteReceipt = {
  project: Project;
  transactionHash: string;
};

type ProjectTransaction = Awaited<ReturnType<Client["accept_project"]>>;

function requireConfiguration(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing frontend configuration: ${name}`);
  }

  return value;
}

async function createEscrowClient(
  publicKey: string,
  onStatusChange?: WriteStatusCallback,
) {
  const { Client: EscrowClient } = await import("milestone-escrow");
  const trackedSignTransaction: typeof signTransaction = async (...args) => {
    onStatusChange?.("waiting-for-signature");
    const signedTransaction = await signTransaction(...args);
    onStatusChange?.("submitting");
    return signedTransaction;
  };

  return new EscrowClient({
    contractId: requireConfiguration(
      contractId,
      "VITE_ESCROW_CONTRACT_ID",
    ),
    networkPassphrase: requireConfiguration(
      networkPassphrase,
      "VITE_STELLAR_NETWORK_PASSPHRASE",
    ),
    rpcUrl: requireConfiguration(rpcUrl, "VITE_STELLAR_RPC_URL"),
    publicKey,
    signTransaction: onStatusChange ? trackedSignTransaction : signTransaction,
  });
}

function getTransactionHash(
  response: { sendTransactionResponse?: { hash?: string } },
): string {
  const hash = response.sendTransactionResponse?.hash;
  if (!hash) {
    throw new Error(
      "The transaction completed without returning a transaction hash.",
    );
  }
  return hash;
}

async function executeProjectWrite(
  publicKey: string,
  buildTransaction: (
    client: Client,
  ) => Promise<ProjectTransaction>,
  onStatusChange?: WriteStatusCallback,
): Promise<ProjectWriteReceipt> {
  try {
    onStatusChange?.("preparing");
    const client = await createEscrowClient(publicKey, onStatusChange);
    const transaction = await buildTransaction(client);
    const response = await transaction.signAndSend();

    if (response.result.isErr()) {
      throw new Error(response.result.unwrapErr().message);
    }

    return {
      project: response.result.unwrap(),
      transactionHash: getTransactionHash(response),
    };
  } catch (error) {
    console.error("Escrow contract write failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unable to complete the transaction on Stellar Testnet.");
  }
}

export async function getUserProjectIds(publicKey: string): Promise<bigint[]> {
  try {
    const client = await createEscrowClient(publicKey);
    const transaction = await client.get_user_projects({ user: publicKey });
    return transaction.result;
  } catch (error) {
    console.error("Failed to load user projects:", error);
    throw new Error(
      "Unable to load your projects from Stellar Testnet. Please try again.",
    );
  }
}

export async function getUserProjects(publicKey: string): Promise<Project[]> {
  try {
    const client = await createEscrowClient(publicKey);
    const idsTransaction = await client.get_user_projects({ user: publicKey });

    return await Promise.all(
      idsTransaction.result.map(async (projectId) => {
        const transaction = await client.get_project({ project_id: projectId });
        if (transaction.result.isErr()) {
          throw new Error(transaction.result.unwrapErr().message);
        }
        return transaction.result.unwrap();
      }),
    );
  } catch (error) {
    console.error("Failed to load project details:", error);
    throw new Error(
      "Unable to load project details from Stellar Testnet. Please try again.",
    );
  }
}

export type CreateProjectRequest = {
  client: string;
  freelancer: string;
  asset: string;
  title: string;
  totalAmount: bigint;
  milestones: Array<{
    title: string;
    amount: bigint;
    deadline: bigint;
  }>;
  onStatusChange?: WriteStatusCallback;
};

export type CreateProjectReceipt = {
  projectId: bigint;
  transactionHash: string;
};

export async function createProject(
  request: CreateProjectRequest,
): Promise<CreateProjectReceipt> {
  try {
    request.onStatusChange?.("preparing");
    const client = await createEscrowClient(
      request.client,
      request.onStatusChange,
    );
    const transaction = await client.create_project(
      {
        client: request.client,
        freelancer: request.freelancer,
        asset: request.asset,
        title: request.title,
        total_amount: request.totalAmount,
        milestone_inputs: request.milestones.map((milestone) => ({
          title: milestone.title,
          amount: milestone.amount,
          deadline: milestone.deadline,
        })),
      },
      { timeoutInSeconds: transactionTimeoutSeconds },
    );
    const response = await transaction.signAndSend();
    if (response.result.isErr()) {
      throw new Error(response.result.unwrapErr().message);
    }
    return {
      projectId: response.result.unwrap(),
      transactionHash: getTransactionHash(response),
    };
  } catch (error) {
    console.error("Failed to create escrow project:", error);
    if (error instanceof Error) throw error;
    throw new Error("Unable to create the project on Stellar Testnet.");
  }
}

export function acceptProject(
  projectId: bigint,
  freelancer: string,
  onStatusChange?: WriteStatusCallback,
) {
  return executeProjectWrite(
    freelancer,
    (client) =>
      client.accept_project(
        { project_id: projectId, freelancer },
        { timeoutInSeconds: transactionTimeoutSeconds },
      ),
    onStatusChange,
  );
}

export function fundProject(
  projectId: bigint,
  clientAddress: string,
  onStatusChange?: WriteStatusCallback,
) {
  return executeProjectWrite(
    clientAddress,
    (client) =>
      client.fund_project(
        { project_id: projectId, client: clientAddress },
        { timeoutInSeconds: transactionTimeoutSeconds },
      ),
    onStatusChange,
  );
}

export function submitMilestone(
  projectId: bigint,
  milestoneId: number,
  freelancer: string,
  workReference: string,
  onStatusChange?: WriteStatusCallback,
) {
  return executeProjectWrite(
    freelancer,
    (client) =>
      client.submit_milestone(
        {
          project_id: projectId,
          milestone_id: milestoneId,
          freelancer,
          work_reference: workReference,
        },
        { timeoutInSeconds: transactionTimeoutSeconds },
      ),
    onStatusChange,
  );
}

export function approveMilestone(
  projectId: bigint,
  milestoneId: number,
  clientAddress: string,
  onStatusChange?: WriteStatusCallback,
) {
  return executeProjectWrite(
    clientAddress,
    (client) =>
      client.approve_milestone(
        {
          project_id: projectId,
          milestone_id: milestoneId,
          client: clientAddress,
        },
        { timeoutInSeconds: transactionTimeoutSeconds },
      ),
    onStatusChange,
  );
}

export function releaseMilestonePayment(
  projectId: bigint,
  milestoneId: number,
  clientAddress: string,
  onStatusChange?: WriteStatusCallback,
) {
  return executeProjectWrite(
    clientAddress,
    (client) =>
      client.release_milestone_payment(
        {
          project_id: projectId,
          milestone_id: milestoneId,
          client: clientAddress,
        },
        { timeoutInSeconds: transactionTimeoutSeconds },
      ),
    onStatusChange,
  );
}

export function cancelProject(
  projectId: bigint,
  clientAddress: string,
  onStatusChange?: WriteStatusCallback,
) {
  return executeProjectWrite(
    clientAddress,
    (client) =>
      client.cancel_project(
        { project_id: projectId, client: clientAddress },
        { timeoutInSeconds: transactionTimeoutSeconds },
      ),
    onStatusChange,
  );
}

export function requestRefund(
  projectId: bigint,
  clientAddress: string,
  onStatusChange?: WriteStatusCallback,
) {
  return executeProjectWrite(
    clientAddress,
    (client) =>
      client.request_refund(
        { project_id: projectId, client: clientAddress },
        { timeoutInSeconds: transactionTimeoutSeconds },
      ),
    onStatusChange,
  );
}

export function approveRefund(
  projectId: bigint,
  freelancer: string,
  onStatusChange?: WriteStatusCallback,
) {
  return executeProjectWrite(
    freelancer,
    (client) =>
      client.approve_refund(
        { project_id: projectId, freelancer },
        { timeoutInSeconds: transactionTimeoutSeconds },
      ),
    onStatusChange,
  );
}
