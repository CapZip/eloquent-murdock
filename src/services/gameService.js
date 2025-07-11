import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import Swal from 'sweetalert2';

// Fetch SOL price from CoinGecko API
export const fetchSolPrice = async () => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana.usd;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    return 100; // Fallback price
  }
};

// Calculate SOL amount from USD bet amount
export const calculateSolAmount = async (usdAmount) => {
  const solPrice = await fetchSolPrice();
  return usdAmount / solPrice;
};

// Start a new game round
export const startGameRound = async (betAmount, difficulty, wallet) => {
  try {
    // Validate wallet is provided
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // If bet amount is 0, it's a demo round
    const isDemo = betAmount === 0;
    
    if (isDemo) {
      const startRound = httpsCallable(functions, 'startRound');
      const result = await startRound({ 
        betAmount: 0, 
        difficulty, 
        walletAddress: wallet.publicKey.toString(),
        isDemo: true 
      });
      return result.data;
    }

    // For real bets, validate wallet
    if (!wallet.signTransaction) {
      throw new Error('Wallet not ready for signing');
    }

    // Calculate SOL amount
    const solAmount = await calculateSolAmount(betAmount);
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

    // Create and send Solana transaction
    const connection = new Connection('https://fittest-icy-field.solana-mainnet.quiknode.pro/6fbfeeff12d8d6537bafad49b437ca821085d17a');
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add transfer instruction to house wallet
    const houseWalletAddress = 'AEVE42Zgo3ywbadnmJweFirz4xcC1r8bKYhLBP8MLjeg';
    const houseWallet = new PublicKey(houseWalletAddress);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: houseWallet,
        lamports: lamports,
      })
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Sign transaction
    const signedTransaction = await wallet.signTransaction(transaction);
    
    // Send transaction
    const signature = await connection.sendRawTransaction(signedTransaction.serialize());
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error('Transaction failed');
    }

    // Call Firebase function to start round with transaction signature
    const startRound = httpsCallable(functions, 'startRound');
    const result = await startRound({ 
      betAmount, 
      difficulty, 
      solAmount,
      transactionSignature: signature,
      walletAddress: wallet.publicKey.toString(),
      isDemo: false 
    });
    
    return result.data;
  } catch (error) {
    console.error('Error starting game round:', error);
    Swal.fire({
      title: 'Game Start Error',
      text: error.message || 'Failed to start game round.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    throw error;
  }
};

// Check if next move results in death
export const checkNextMove = async (gameId, currentPosition, walletAddress = "demo") => {
  try {
    const checkMove = httpsCallable(functions, 'checkNextMove');
    const result = await checkMove({ 
      gameId, 
      currentPosition,
      walletAddress
    });
    return result.data;
  } catch (error) {
    console.error('Error checking next move:', error);
    Swal.fire({
      title: 'Move Check Error',
      text: error.message || 'Failed to check next move.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    throw error;
  }
};

// End game round and get final results
export const endGameRound = async (gameId, finalPosition, walletAddress = "demo") => {
  try {
    const endRound = httpsCallable(functions, 'endRound');
    const result = await endRound({ 
      gameId, 
      finalPosition,
      walletAddress
    });
    return result.data;
  } catch (error) {
    console.error('Error ending game round:', error);
    Swal.fire({
      title: 'Game End Error',
      text: error.message || 'Failed to end game round.',
      icon: 'error',
      confirmButtonText: 'OK'
    });
    throw error;
  }
}; 