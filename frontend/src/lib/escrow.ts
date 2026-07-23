import type { Project } from "milestone-escrow";
import { signTransaction } from "@stellar/freighter-api";

const rpcUrl = import.meta.env.VITE_STELLAR_RPC_URL;
const networkPassphrase = import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE;
const contractId = import.meta.env.VITE_ESCROW_CONTRACT_ID;

function requireConfiguration(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing frontend configuration: ${name}`);
  }

  return value;
}

async function createEscrowClient(publicKey: string) {
  const { Client } = await import("milestone-escrow");

  return new Client({
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
    signTransaction,
  });
}
export async function getUserProjectIds(
  publicKey: string,
): Promise<bigint[]> {
  try {
    const client = await createEscrowClient(publicKey);
    const transaction = await client.get_user_projects({
      user: publicKey,
    });

    return transaction.result;
  } catch (error) {
    console.error("Failed to load user projects:", error);

    throw new Error(
      "Unable to load your projects from Stellar Testnet. Please try again.",
    );
  }
}
export async function getUserProjects(
  publicKey: string,
): Promise<Project[]> {
  try {
    const client = await createEscrowClient(publicKey);
    const idsTransaction = await client.get_user_projects({
      user: publicKey,
    });

    const projects = await Promise.all(
      idsTransaction.result.map(async (projectId) => {
        const projectTransaction = await client.get_project({
          project_id: projectId,
        });

        if (projectTransaction.result.isErr()) {
          const contractError = projectTransaction.result.unwrapErr();
          throw new Error(contractError.message);
        }

        return projectTransaction.result.unwrap();
      }),
    );

    return projects;
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
  onStatusChange?: (
    status: "preparing" | "waiting-for-signature" | "submitting",
  ) => void;
};

export type CreateProjectReceipt = {
  projectId: bigint;
  transactionHash: string;
};

export async function createProject(
  request: CreateProjectRequest,
): Promise<CreateProjectReceipt> {
  try {
    const { Client } = await import("milestone-escrow");
    const trackedSignTransaction: typeof signTransaction = async (...args) => {
      request.onStatusChange?.("waiting-for-signature");
      const signedTransaction = await signTransaction(...args);
      request.onStatusChange?.("submitting");
      return signedTransaction;
    };
    const client = new Client({
      contractId: requireConfiguration(
        contractId,
        "VITE_ESCROW_CONTRACT_ID",
      ),
      networkPassphrase: requireConfiguration(
        networkPassphrase,
        "VITE_STELLAR_NETWORK_PASSPHRASE",
      ),
      rpcUrl: requireConfiguration(rpcUrl, "VITE_STELLAR_RPC_URL"),
      publicKey: request.client,
      signTransaction: trackedSignTransaction,
    });

    request.onStatusChange?.("preparing");
    const assembledTransaction = await client.create_project(
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
      {
        timeoutInSeconds: 60,
      },
    );

    const sentTransaction =
      await assembledTransaction.signAndSend();

    if (sentTransaction.result.isErr()) {
      const contractError = sentTransaction.result.unwrapErr();
      throw new Error(contractError.message);
    }

    const transactionHash =
      sentTransaction.sendTransactionResponse?.hash;

    if (!transactionHash) {
      throw new Error(
        "The transaction completed without returning a transaction hash.",
      );
    }

    return {
      projectId: sentTransaction.result.unwrap(),
      transactionHash,
    };
  } catch (error) {
    console.error("Failed to create escrow project:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Unable to create the project on Stellar Testnet.",
    );
  }
}
