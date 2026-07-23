import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

export type WalletSession = {
  address: string;
  network: string;
  networkPassphrase: string;
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

export async function connectWallet(): Promise<WalletSession> {
  const connectionResult = await isConnected();

  if (connectionResult.error) {
    throw new Error(
      apiErrorMessage(
        connectionResult.error,
        "Unable to check the Freighter wallet extension.",
      ),
    );
  }

  if (!connectionResult.isConnected) {
    throw new Error(
      "Freighter wallet was not found. Install or enable the Freighter browser extension.",
    );
  }

  const accessResult = await requestAccess();

  if (accessResult.error) {
    throw new Error(
      apiErrorMessage(
        accessResult.error,
        "Freighter wallet access was rejected.",
      ),
    );
  }

  if (!accessResult.address) {
    throw new Error("Freighter did not return a wallet address.");
  }

  const networkResult = await getNetworkDetails();

  if (networkResult.error) {
    throw new Error(
      apiErrorMessage(
        networkResult.error,
        "Unable to read the active Freighter network.",
      ),
    );
  }

  if (networkResult.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new Error(
      "Please switch Freighter to Stellar Testnet and connect again.",
    );
  }

  return {
    address: accessResult.address,
    network: networkResult.network,
    networkPassphrase: networkResult.networkPassphrase,
  };
}

export async function restoreWallet(): Promise<WalletSession | null> {
  const connectionResult = await isConnected();

  if (connectionResult.error || !connectionResult.isConnected) {
    return null;
  }

  const addressResult = await getAddress();

  if (addressResult.error || !addressResult.address) {
    return null;
  }

  const networkResult = await getNetworkDetails();

  if (
    networkResult.error ||
    networkResult.networkPassphrase !== TESTNET_PASSPHRASE
  ) {
    return null;
  }

  return {
    address: addressResult.address,
    network: networkResult.network,
    networkPassphrase: networkResult.networkPassphrase,
  };
}

export function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}