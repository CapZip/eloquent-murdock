import { getFunctions, httpsCallable } from 'firebase/functions';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import '../firebase'; // Initialize Firebase first

const functions = getFunctions();
const LAMPORTS_PER_SOL = 1e9;

// Calculate SOL amount from USD bet amount
async function calculateSolAmount(usdAmount) {
  try {
    const getSolPrice = httpsCallable(functions, 'getSolPrice');
    const result = await getSolPrice();
    const solPrice = result.data.price;
    return usdAmount / solPrice;
  } catch (error) {
    console.error('Error calculating SOL amount:', error);
    // Fallback to approximate SOL price
    return usdAmount / 100; // Approximate $100 per SOL
  }
}

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
    const houseWalletAddress = 'StE5xLhTx4TntgpVt4NBSBUtSWWGa1gNoadqrPfVYJj';
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

    // Start game round with confirmed transaction
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
    console.error('Failed to start game round:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to start game. Please try again.';
    
    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      userMessage = 'Insufficient balance. Please check your wallet.';
    } else if (error.message.includes('rate limit') || error.message.includes('too many')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      userMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message.includes('signature') || error.message.includes('transaction')) {
      userMessage = 'Transaction failed. Please try again.';
    } else if (error.message.includes('wallet')) {
      userMessage = 'Wallet not connected. Please connect your wallet.';
    }
    
    throw new Error(userMessage);
  }
};

// Check next move with server verification
export const checkNextMove = async (gameId, currentPosition, walletAddress) => {
  try {
    const checkNextMoveServer = httpsCallable(functions, 'checkNextMove');
    const result = await checkNextMoveServer({ 
      gameId, 
      currentPosition,
      walletAddress 
    });
    return result.data;
  } catch (error) {
    console.error('Failed to check next move:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Move failed. Please try again.';
    
    if (error.message.includes('rate limit') || error.message.includes('too many')) {
      userMessage = 'Too many moves. Please wait a moment.';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      userMessage = 'Network error. Please check your connection.';
    } else if (error.message.includes('game') || error.message.includes('session')) {
      userMessage = 'Game session error. Please restart the game.';
    }
    
    throw new Error(userMessage);
  }
};

// End game round
export const endGameRound = async (gameId, finalPosition, walletAddress) => {
  try {
    const endRound = httpsCallable(functions, 'endRound');
    const result = await endRound({ 
      gameId, 
      finalPosition,
      walletAddress 
    });
    return result.data;
  } catch (error) {
    console.error('Failed to end game round:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to end game. Please try again.';
    
    if (error.message.includes('rate limit') || error.message.includes('too many')) {
      userMessage = 'Too many requests. Please wait a moment.';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      userMessage = 'Network error. Please check your connection.';
    } else if (error.message.includes('game') || error.message.includes('session')) {
      userMessage = 'Game session error. Please restart the game.';
    }
    
    throw new Error(userMessage);
  }
};

// Secure cashout with server-side verification
export const cashOut = async (gameId, walletAddress) => {
  try {
    const cashOutFunction = httpsCallable(functions, 'cashOut');
    const result = await cashOutFunction({ 
      gameId, 
      walletAddress 
    });
    return result.data;
  } catch (error) {
    console.error('Failed to cash out:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Cash out failed. Please try again.';
    
    if (error.message.includes('insufficient') || error.message.includes('balance')) {
      userMessage = 'House wallet has insufficient balance. Please try again later.';
    } else if (error.message.includes('rate limit') || error.message.includes('too many')) {
      userMessage = 'Too many cash out attempts. Please wait a moment.';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      userMessage = 'Network error. Please check your connection.';
    } else if (error.message.includes('already cashed out')) {
      userMessage = 'Game already cashed out.';
    } else if (error.message.includes('game') || error.message.includes('session')) {
      userMessage = 'Game session error. Please restart the game.';
    }
    
    throw new Error(userMessage);
  }
}; 

// Get leaderboard data
export const getLeaderboard = async (limit = 10, timeframe = "all") => {
  try {
    const getLeaderboardFunction = httpsCallable(functions, 'getLeaderboard');
    const result = await getLeaderboardFunction({ 
      limit, 
      timeframe 
    });
    return result.data;
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to fetch leaderboard. Please try again.';
    
    if (error.message && (error.message.includes('rate limit') || error.message.includes('too many'))) {
      userMessage = 'Too many requests. Please wait a moment.';
    } else if (error.message && (error.message.includes('network') || error.message.includes('connection'))) {
      userMessage = 'Network error. Please check your connection.';
    }
    
    throw new Error(userMessage);
  }
}; 