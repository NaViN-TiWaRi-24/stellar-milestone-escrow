import type { Project } from "milestone-escrow";

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