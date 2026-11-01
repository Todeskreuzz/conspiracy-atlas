/** Crypto wallets for supporting the project. The owner accepts crypto only; each address is checked character by character. */
export const DONATION_WALLETS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', network: 'Bitcoin', address: 'bc1qvd4qdrtp6vp34y2tp5nntaxh8s7gdtcl6cleg0' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', network: 'Ethereum (ERC-20)', address: '0x65Bc22A06395f366433FA9B79CD9E356d161f09B' },
  { id: 'sol', name: 'Solana', symbol: 'SOL', network: 'Solana', address: 'EE34aTZx8UtMoEaLY5vJtkH1nLPkKyGVtZ3QMwBrfNPW' },
] as const;
