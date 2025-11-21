import { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { GameAsset, WalletState } from '@/types/asset';

const AssetDashboard: NextPage = () => {
  const [assets, setAssets] = useState<GameAsset[]>([]);
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: null,
  });
  const [showOnlyOwned, setShowOnlyOwned] = useState(false);
  const [loading, setLoading] = useState(true);

  const mockWallets = [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    '0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03',
  ];

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch('/mock-assets.json');
        const data = await response.json();
        setAssets(data);
      } catch (error) {
        console.error('Error fetching assets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, []);

  const handleConnectWallet = () => {
    const randomAddress = mockWallets[Math.floor(Math.random() * mockWallets.length)];
    setWallet({
      isConnected: true,
      address: randomAddress,
    });
  };

  const handleDisconnectWallet = () => {
    setWallet({
      isConnected: false,
      address: null,
    });
    setShowOnlyOwned(false);
  };

  const filteredAssets =
    showOnlyOwned && wallet.address
      ? assets.filter((asset) => asset.owner.toLowerCase() === wallet.address?.toLowerCase())
      : assets;

  const isOwnedByUser = (asset: GameAsset): boolean => {
    if (!wallet.address) return false;
    return asset.owner.toLowerCase() === wallet.address.toLowerCase();
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-xl text-white">Loading assets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="mb-4 text-center text-4xl font-bold text-white">Game Asset Dashboard</h1>
          <p className="mb-6 text-center text-gray-300">Browse and manage your in-game assets</p>

          <div className="mb-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {!wallet.isConnected ? (
              <button
                onClick={handleConnectWallet}
                className="transform rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:from-purple-700 hover:to-pink-700"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="rounded-lg border-2 border-purple-500 bg-gray-800 px-6 py-3 font-semibold text-white">
                  Connected: {formatAddress(wallet.address!)}
                </div>
                <button
                  onClick={handleDisconnectWallet}
                  className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:bg-red-700"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {wallet.isConnected && (
            <div className="mb-4 flex items-center justify-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-gray-700 bg-gray-800 px-4 py-2 transition-colors hover:border-purple-500">
                <input
                  type="checkbox"
                  checked={showOnlyOwned}
                  onChange={(e) => setShowOnlyOwned(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500"
                />
                <span className="font-medium text-white">Show only my assets</span>
              </label>
              <span className="text-gray-400">({filteredAssets.filter((asset) => isOwnedByUser(asset)).length} owned)</span>
            </div>
          )}

          <div className="text-center text-gray-400">
            Showing {filteredAssets.length} of {assets.length} assets
          </div>
        </div>

        {filteredAssets.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAssets.map((asset) => {
              const isOwned = isOwnedByUser(asset);
              return (
                <div
                  key={asset.id}
                  className={`transform overflow-hidden rounded-lg bg-gray-800 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                    isOwned ? 'shadow-purple-500/50 ring-4 ring-purple-500 ring-opacity-75' : 'hover:ring-2 hover:ring-gray-600'
                  }`}
                >
                  <div className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="text-8xl drop-shadow-lg filter">{asset.icon || '🎮'}</div>
                    {isOwned && (
                      <div className="absolute right-2 top-2 z-10 rounded-full bg-purple-600 px-2 py-1 text-xs font-bold text-white">
                        OWNED
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="mb-2 truncate text-lg font-bold text-white">{asset.name}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">ID:</span>
                        <span className="font-mono text-gray-300">#{asset.id}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Owner:</span>
                        <span
                          className={`font-mono ${isOwned ? 'font-semibold text-purple-400' : 'text-gray-300'}`}
                          title={asset.owner}
                        >
                          {formatAddress(asset.owner)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="mb-4 text-xl text-gray-400">No assets found</div>
            <p className="text-gray-500">
              {showOnlyOwned ? 'You do not own any assets yet.' : 'No assets available in the marketplace.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetDashboard;
