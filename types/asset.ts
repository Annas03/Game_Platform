export interface GameAsset {
  id: number;
  name: string;
  image: string;
  icon: string;
  owner: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
}
