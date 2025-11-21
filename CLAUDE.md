# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **P12 Genesis Soul-Bound NFT Airdrop Platform** - a Web3-enabled Next.js application with integrated blockchain features for NFT airdrops, gamer/developer power ranking, and cross-chain badge bridging.

## Development Commands

### Running the Application
```bash
# Start both frontend (Next.js on :3000) and backend (Express on :3099) concurrently
npm run dev

# Build for production
npm run build

# Lint the codebase
npm run lint
```

### Development Workflow
- The `dev` command uses `concurrently` to run both:
  - `node backend/server.js` (Backend API on port 3099)
  - `next dev` (Frontend on port 3000)
- Both servers support hot reload during development
- Frontend makes API calls to both the local backend (port 3099) and remote P12 APIs

## Architecture Overview

### Dual-Stack Application Structure

This is a **monorepo with concurrent frontend/backend**:

```
Frontend (Next.js 13.4)          Backend (Express.js)
├── pages/          → Routes     ├── routes/        → API endpoints
├── components/     → UI         ├── controllers/   → Business logic
├── hooks/          → Logic      ├── models/        → MongoDB schemas (Mongoose)
├── store/          → State      ├── middlewares/   → Auth & validation
├── lib/            → API        └── config/        → Database config
├── utils/          → Helpers
└── constants/      → Config
```

**Note**: The MongoDB database connection is currently commented out in `backend/server.js:12`. The backend primarily serves as a file upload and payment processing server, while most data operations use the remote P12 APIs.

### Technology Stack

**Frontend Core**:
- Next.js 13.4.12 (App with Pages Router)
- React 18.2.0
- TypeScript 5.1.6
- TailwindCSS 3.3.3 (with custom config in [tailwind.config.js](tailwind.config.js))
- SWC compiler (fast builds)

**Web3 Integration**:
- **Wagmi 1.4.1** + **Viem 1.10.4** - Primary Web3 library (React hooks for Ethereum)
- **Ethers.js 5.7.2** - Legacy contract interactions
- **SIWE 2.1.4** - Sign-In With Ethereum authentication
- **Particle Network** - Custom wallet connector for social login
- **WalletConnect** - Multi-wallet support

**State Management**:
- **Recoil 0.7.7** - Global state atoms and selectors (see [Architecture: State Management](#state-management-recoil))
- **React-Query (@tanstack/react-query 4.32.6)** - Async data fetching and caching

**Backend**:
- Express.js 4.21.1
- Mongoose 8.8.3 (MongoDB ODM)
- JWT (jsonwebtoken 9.0.2) - Token-based authentication
- Cloudinary 2.5.1 - Image storage
- SendGrid (@sendgrid/mail 8.1.4) - Email service

### State Management (Recoil)

The application uses **Recoil** for global state with a feature-based organization:

**State Organization** (`store/`):
- `user/` - User profile, JWT tokens, social media connections
- `web3/` - Wallet connection state, BABT holder status
- `dashboard/` - Power levels, user metrics
- `arcana/` - Arcana game voting and verification
- `gamer/`, `developer/` - Role-specific state
- `collab/`, `invite/`, `ranking/`, `poster/` - Feature modules

**Key Patterns**:
- **Atoms**: Independent state pieces (e.g., `userInfoAtom`, `accessTokenAtom`)
- **Selectors**: Derived/computed state (e.g., `userTelegramSelector`, `aspectaIdSelector`)
- **Reset Pattern**: `useResetRecoilState()` for logout flows
- **Multi-Address Support**: Each wallet address maintains separate JWT tokens (up to 10 concurrent addresses)

**Example** ([store/user/state.ts](store/user/state.ts)):
```typescript
export const userInfoAtom = atom<UserInfo>({ key: 'userInfo', default: undefined });
export const accessTokenAtom = atom<string>({ key: 'accessToken', default: '' });
export const userTelegramSelector = selector({ ... }); // Derived state
```

### Web3 Wallet Connection Architecture

**Supported Wallets** (configured in [connectors/index.ts](connectors/index.ts)):
1. MetaMask
2. TokenPocket
3. BitKeep (via `window.bitkeep?.ethereum`)
4. **Particle Network** - Custom connector with social login (see [connectors/particalAuth.ts](connectors/particalAuth.ts))
5. WalletConnect (Project ID: `af716327386d5071687fc3727a00e321`)

**Configuration** ([constants/index.ts](constants/index.ts)):
- `PARTICLE_PROJECT_ID`, `PARTICLE_CLIENT_KEY`, `PARTICLE_SERVER_KEY`, `PARTICLE_APP_ID`
- `WALLETCONNECT_PROJECT_ID`

**Custom Particle Connector**:
- Lazy loads Particle libraries via dynamic imports
- Handles events: `accountsChanged`, `chainChanged`, `disconnect`
- Supports chain switching with hex conversion

**Provider Hierarchy** ([components/layout/index.tsx](components/layout/index.tsx)):
```typescript
<WagmiConfig config={config}>     // Web3 connectivity
  <RecoilRoot>                    // Global state
    <QueryClientProvider>         // Async data
      <LayoutHeader />
      {children}
    </QueryClientProvider>
  </RecoilRoot>
</WagmiConfig>
```

### Authentication Flow (SIWE + JWT)

**Multi-Step Authentication**:

1. **User connects wallet** via Wagmi connectors
2. **SIWE message generation** ([hooks/useSignInWithEthereum.ts](hooks/useSignInWithEthereum.ts)):
   ```typescript
   const message = new SiweMessage({
     domain: window.location.host,
     address,
     statement: 'Sign in with Ethereum to the app.',
     uri: window.location.origin,
     version: '1',
     chainId,
     expirationTime: new Date(Date.now() + 864e5 * 7).toISOString()  // 7 days
   });
   ```
3. **Message signature** via wallet provider (MetaMask, etc.)
4. **Backend authentication** (`POST /auth/login` on P12 NestJS API):
   - Verifies SIWE signature
   - Returns `{ accessToken, userInfo }`
5. **Token storage** ([utils/authorization.ts](utils/authorization.ts)):
   - Stored in localStorage under `ACCESS_TOKENS` key
   - Supports multiple addresses (max 10), each with own JWT
   - Type: `Array<{ address: string; accessToken: string }>`
6. **API authorization** ([lib/request-nest.ts](lib/request-nest.ts)):
   - Request interceptor adds `Authorization: Bearer <token>` header
   - Token selected based on current Wagmi account

**Platform Types**:
- `Platform.USER` - General users (voting, airdrops)
- `Platform.DEVELOPER` - Steam game developers
- Affects permissions and available features

### Frontend-Backend Interaction

**Two API Systems**:

1. **Primary: NestJS P12 Platform API** ([lib/api-nest.ts](lib/api-nest.ts))
   - Base URL: `https://platform-api.p12.games` (env: `NEXT_PUBLIC_NEST_API_PREFIX`)
   - Endpoints: Auth, profile, arcana, dashboard, tasks
   - Pattern: RESTful with Bearer token
   - Response format: `{ code: number, data: T, message?: string }`

2. **Legacy: Airdrop Server API** ([lib/api.ts](lib/api.ts))
   - Base URL: `https://p12-airdrop-server.p12.games` (env: `NEXT_PUBLIC_API_PREFIX`)
   - Endpoints: Airdrop features, rankings, collabs, gamer info
   - Different response structure

**Request Interceptor Pattern** ([lib/request-nest.ts](lib/request-nest.ts)):
```typescript
const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_NEST_API_PREFIX,
  timeout: 10_000,
});

instance.interceptors.request.use((config) => {
  const token = getAccessToken();  // From localStorage based on current address
  config.headers.Authorization = token ? 'Bearer ' + token : '';
  return config;
});
```

**Data Fetching Pattern** (React-Query + Recoil):
```typescript
useQuery(['fetch_user_info', accessToken], () => fetchUserInfo(), {
  select: (data) => (data.code === 200 ? data.data : undefined),
  onSuccess: (data) => setUserInfo(data),  // Update Recoil atom
  enabled: !!address && !!accessToken,     // Conditional fetching
});
```

### Custom Hooks Organization

**Feature-Based Hooks** ([hooks/](hooks/)):

- `user.ts` - User data fetching, login/logout, global state orchestration
  - `useFetchGlobalData()` - Orchestrates multiple data fetches on login
  - `useLogoutCallback()` - Resets Recoil state + disconnects wallet
  - `useMutationLogin()` - SIWE login mutation
- `useSignInWithEthereum.ts` - SIWE message creation
- `useSteamSignIn.ts` - Steam OAuth integration
- `useContract.ts` - Smart contract interactions (BABT, Badge Bridge)
- `bridge.ts` - Cross-chain badge bridging
- `arcana.ts` - Arcana voting and game features
- `gamer.tsx` - Gamer-specific features
- `developer.ts` - Developer features
- `collab.ts` - Collaboration events
- `ranking.ts` - Leaderboard data
- `dashboard/` - Power level tracking, task status

**Hook Patterns**:
- **Mutation hooks**: Use React-Query's `useMutation` for POST/PUT operations
- **Query hooks**: Use `useQuery` with Recoil state updates in `onSuccess`
- **Orchestration hooks**: Combine multiple mutations/queries (e.g., `useFetchGlobalData`)
- **Reset hooks**: Use `useResetRecoilState` for cleanup (e.g., `useRemoveGlobalState`)

### Smart Contract Integration

**ABIs Location**: [abis/](abis/)
- Contract ABIs for BABT, Badge Bridge, Collab contracts
- TypeScript type definitions generated from ABIs

**Contract Hooks** ([hooks/useContract.ts](hooks/useContract.ts)):
```typescript
export const useBABTContract = (chainId?: number) => {
  // Returns contract instance for BABT (Binance Account Bound Token)
};
```

**Supported Chains**:
- BSC Mainnet (Chain ID: 56) - Primary chain
- BSC Testnet (Chain ID: 97)
- Polygon - For badge bridging

**Contract Addresses** ([constants/addresses.ts](constants/addresses.ts)):
- BABT contract addresses per chain
- Badge Bridge contract addresses
- Collab contract addresses

**Network Switching** ([components/arcana/ArcanaSwitchNetwork.tsx](components/arcana/ArcanaSwitchNetwork.tsx)):
- Custom modal for network switching prompts
- Automatically switches for supported wallets

### Page Routing Structure

**Next.js File-Based Routing** ([pages/](pages/)):

- `/` - Home page with arcana banner and ranking
- `/dashboard` - User dashboard (3 tabs: Arcana, Gamer, Developer)
- `/arcana/[[...address]]` - Arcana voting features (optional address param)
- `/gamer` - Gamer ranking and features
- `/gamer/[address]` - Individual gamer profile
- `/developer` - Developer features
- `/collab/[id]` - Collaboration event details
- `/collab/qatar2022.tsx` - Special event page
- `/ranking/[tab]` - Ranking leaderboards (dynamic tabs)
- `/bridge` - Cross-chain badge bridge
- `/auth/steam.tsx` - Steam authentication callback

**Layout Pattern**:
```typescript
type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactNode;
};
```
- Pages can define custom layouts
- Default layout in [components/layout/index.tsx](components/layout/index.tsx)

### Environment Variables

**Required Frontend Variables** (`.env`):
```bash
NEXT_PUBLIC_COLLAB_CHAIN_ID=56              # BSC Mainnet
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-LCZBVYC9TZ
NEXT_PUBLIC_NEST_API_PREFIX=https://platform-api.p12.games
NEXT_PUBLIC_API_PREFIX=https://p12-airdrop-server.p12.games
NEXT_PUBLIC_PARTICLE_PROJECT_ID=<from Particle dashboard>
NEXT_PUBLIC_PARTICLE_CLIENT_KEY=<from Particle dashboard>
NEXT_PUBLIC_PARTICLE_SERVER_KEY=<from Particle dashboard>
NEXT_PUBLIC_PARTICLE_APP_ID=<from Particle dashboard>
RECOIL_DUPLICATE_ATOM_KEY_CHECKING_ENABLED=false
```

**Backend Variables** (typically in `.env` or deployment config):
- `MONGO_URI` - MongoDB connection (currently not used)
- `JWT_SECRET` - JWT signing secret
- `COOKIE_EXPIRES_TIME` - Session duration
- `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `SENDGRID_API_KEY`, `SENDGRID_EMAIL`

### Image Optimization

**Next.js Image Domains** ([next.config.js](next.config.js:4-12)):
- `cdn.galaxy.eco`
- `cdn1.p12.games`, `cdn.p12.games`
- `cdn.galxe.com`, `cdn-2.galxe.com`
- `d257b89266utxb.cloudfront.net`

Images from these domains can be optimized via Next.js `<Image>` component.

## Important Development Patterns

### Multi-Address Wallet Support

The application maintains **separate JWT tokens for each connected wallet address**:

- Tokens stored in localStorage as array: `Array<{ address: string; accessToken: string }>`
- Max 10 concurrent addresses supported
- Token selection based on current Wagmi account
- On account switch, the corresponding token is automatically selected

**Implementation** ([utils/authorization.ts](utils/authorization.ts)):
```typescript
export const getAccessToken = () => {
  const address = getCurrentAddress(); // From Wagmi
  const tokens = getLocalStorage('ACCESS_TOKENS', []);
  return tokens.find(t => t.address === address)?.accessToken;
};
```

### Conditional Data Fetching

Always use `enabled` flag in React-Query to prevent unnecessary API calls:

```typescript
useQuery(queryKey, queryFn, {
  enabled: !!address && !!accessToken,  // Only fetch when connected & authenticated
  onSuccess: (data) => setRecoilState(data),
});
```

### Logout Pattern

**Complete Logout** ([hooks/user.ts](hooks/user.ts)):
1. Reset all Recoil atoms via `useResetRecoilState`
2. Disconnect Wagmi wallet via `useDisconnect`
3. Clear localStorage tokens
4. Navigate to home page

```typescript
export const useLogoutCallback = () => {
  const removeGlobalState = useRemoveGlobalState();  // Resets all Recoil atoms
  const { disconnect } = useDisconnect();

  return useCallback(() => {
    removeGlobalState();
    disconnect?.();
    // Optionally: router.push('/')
  }, [disconnect, removeGlobalState]);
};
```

### Analytics Integration

**React GA4** tracking is integrated throughout the app:

```typescript
import ReactGA from 'react-ga4';

ReactGA.event({
  category: EventCategory.Global,
  action: EventName.ConnectWallet,
  label: walletType,
});
```

**Tracking ID**: `G-LCZBVYC9TZ` (configured in `.env`)

### TypeScript Path Aliases

**Configured in [tsconfig.json](tsconfig.json:17-19)**:
```json
{
  "paths": {
    "@/*": ["./*"]
  }
}
```

**Usage**: Import any file from root using `@/`:
```typescript
import { fetchUserInfo } from '@/lib/api-nest';
import { userInfoAtom } from '@/store/user/state';
```

### Code Quality Tools

- **ESLint** - [.eslintrc.json](.eslintrc.json) with TypeScript and Next.js rules
- **Prettier** - [.prettierrc.js](.prettierrc.js) with Tailwind plugin
- **Husky** - Git hooks for pre-commit checks ([.husky/](.husky/))

## Key Features

### Power Level System
- Aggregates scores from multiple sources: Arcana voting, Steam Gamer achievements, Steam Developer metrics
- Real-time updates via `useFetchUserPowerLevel` hook
- Displayed in header when user is authenticated
- Stored in Recoil atoms: `steamDeveloperPowerAtom`, `steamGamerPowerAtom`, `arcanaPowerAtom`

### Referral/Invite System
- Invitation codes with history tracking
- Invitation count monitoring
- Integrated into user profile
- State managed via `store/invite/` atoms

### Multi-Role Support
The platform supports three distinct user roles:
1. **Gamer** - P12 Arcana participant, Steam gamer
2. **Developer** - Steam game developer with verified games
3. **User** - General participant in voting/airdrop

Each role has:
- Separate ranking leaderboards
- Role-specific features and dashboards
- Different NFT (SBT) claim eligibility

### Cross-Chain Badge Bridge
- Transfer badges between BSC and Polygon
- Transaction history with pagination
- Status tracking (pending → processing → confirmed)
- Gas estimation and fee display

### Social Media Integration
Users can connect multiple social accounts:
- **Telegram** - Username, avatar, verification status
- **Aspecta** - Verification for Aspecta ID
- **Twitter, Discord** - Text field links

Stored in `UserInfo.socialMedias: Array<{ source: string; ... }>`

## Security Considerations

### Authentication Security
- **SIWE**: Proves wallet ownership without passwords
- **JWT**: Stateless tokens with 7-day expiration
- **Multi-Address**: Separate tokens per wallet address
- **Role-Based**: Server-side role checking via middleware

### Frontend Security
- No private keys stored (only JWT tokens in localStorage)
- Message signing delegated to wallet providers (MetaMask, etc.)
- Wallet disconnection clears all Recoil state
- HTTP-only cookies for backend sessions

### Contract Security
- Contract address validation before interactions
- Bytecode verification against expected ABIs
- Transaction slippage protection (for future features)
- Gas estimation before writes

## Common Development Tasks

### Adding a New API Endpoint

1. Define the API function in [lib/api-nest.ts](lib/api-nest.ts):
   ```typescript
   export const fetchNewFeature = (params: NewFeatureParams) =>
     request.post<any, Response<NewFeatureData>>('/feature/endpoint', params);
   ```

2. Create types in [lib/types-nest.ts](lib/types-nest.ts):
   ```typescript
   export type NewFeatureParams = { ... };
   export type NewFeatureData = { ... };
   ```

3. Create a custom hook in [hooks/](hooks/):
   ```typescript
   export const useMutationNewFeature = () => {
     return useMutation(fetchNewFeature, {
       onSuccess: (data) => { /* Update Recoil state */ },
     });
   };
   ```

### Adding a New Recoil Atom

1. Create in appropriate feature folder under [store/](store/):
   ```typescript
   // store/newFeature/state.ts
   export const newFeatureAtom = atom<NewFeatureType>({
     key: 'newFeature',
     default: initialValue,
   });
   ```

2. Export from [store/index.ts](store/index.ts)

3. Use in components:
   ```typescript
   const [newFeature, setNewFeature] = useRecoilState(newFeatureAtom);
   ```

4. Add reset hook to `useRemoveGlobalState()` in [hooks/user.ts](hooks/user.ts) if it should clear on logout

### Adding a New Smart Contract

1. Add ABI file to [abis/](abis/)
2. Update [abis/index.ts](abis/index.ts) with exports
3. Add contract addresses to [constants/addresses.ts](constants/addresses.ts)
4. Create hook in [hooks/useContract.ts](hooks/useContract.ts):
   ```typescript
   export const useNewContract = (chainId?: number) => {
     const contractAddress = NEW_CONTRACT_ADDRESSES[chainId || DEFAULT_CHAIN_ID];
     const contract = useContract({
       address: contractAddress,
       abi: NewContractABI,
     });
     return contract;
   };
   ```

### Testing Wallet Connections Locally

For local development without connecting real wallets:
- Use Wagmi's mock connectors (see Wagmi docs)
- Or implement a mock wallet provider (see [docs/blockchain-features.md](docs/blockchain-features.md) Task #25)
- Test SIWE flow with signature mocking

## Known Issues & Quirks

- **MongoDB Database**: Connection is commented out in [backend/server.js](backend/server.js:12). The backend primarily handles file uploads and payments, not as primary data store.
- **React Strict Mode**: Disabled in [next.config.js](next.config.js:14) (`reactStrictMode: false`). This may hide potential issues with useEffect double-invocation.
- **Recoil Duplicate Atoms**: Warning is suppressed via environment variable. Ensure no actual duplicate atom keys exist.
- **Wagmi Version**: Using v1.4.1 (not v2). Migration to Wagmi v2 would require significant refactoring.
- **Multiple API Systems**: Two separate API clients exist. Be aware which one you're using for new features.

## Additional Resources

- **Blockchain Tasks**: See [docs/blockchain-features.md](docs/blockchain-features.md) for detailed Web3 feature tasks (2-hour sprint breakdown)
- **Wagmi Documentation**: https://wagmi.sh/react/getting-started
- **Recoil Documentation**: https://recoiljs.org/docs/introduction/getting-started
- **SIWE Specification**: https://eips.ethereum.org/EIPS/eip-4361
- **Particle Network**: https://docs.particle.network/
