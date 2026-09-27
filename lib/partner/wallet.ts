/**
 * Partner Wallet Service
 * 
 * Handles wallet operations, transactions, and payouts
 */

import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db-service';
import { 
  PartnerWallet, 
  WalletTransaction, 
  Payout,
  TransactionType,
  TransactionCategory,
  BankAccount 
} from './types';

const WALLETS_COLLECTION = 'partner_wallets';
const TRANSACTIONS_COLLECTION = 'wallet_transactions';
const PAYOUTS_COLLECTION = 'partner_payouts';

// ============================================
// Wallet Operations
// ============================================

/**
 * Create a new wallet for a partner
 */
export async function createWallet(partnerId: string): Promise<PartnerWallet> {
  const collection = await getCollection(WALLETS_COLLECTION);
  
  const wallet: PartnerWallet = {
    id: new ObjectId().toString(),
    partnerId,
    balance: {
      available: 0,
      pending: 0,
      held: 0,
    },
    currency: 'INR',
    bankAccounts: [],
    minimumPayout: 1000,
    autoPayout: {
      enabled: false,
      threshold: 10000,
      frequency: 'weekly',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await collection.insertOne({
    ...wallet,
    _id: new ObjectId(wallet.id),
  });
  
  return wallet;
}

/**
 * Get wallet by partner ID
 */
export async function getWalletByPartnerId(partnerId: string): Promise<PartnerWallet | null> {
  const collection = await getCollection(WALLETS_COLLECTION);
  const wallet = await collection.findOne({ partnerId });
  
  if (!wallet) {
    return null;
  }
  
  return normalizeWallet(wallet);
}

/**
 * Get wallet by ID
 */
export async function getWalletById(walletId: string): Promise<PartnerWallet | null> {
  const collection = await getCollection(WALLETS_COLLECTION);
  const wallet = await collection.findOne({ _id: new ObjectId(walletId) });
  
  if (!wallet) {
    return null;
  }
  
  return normalizeWallet(wallet);
}

/**
 * Normalize wallet document from database
 */
function normalizeWallet(doc: any): PartnerWallet {
  return {
    id: doc._id.toString(),
    partnerId: doc.partnerId,
    balance: doc.balance,
    currency: doc.currency,
    bankAccounts: doc.bankAccounts || [],
    defaultBankAccountId: doc.defaultBankAccountId,
    minimumPayout: doc.minimumPayout,
    autoPayout: doc.autoPayout,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  };
}

// ============================================
// Transaction Operations
// ============================================

/**
 * Create a wallet transaction
 */
export async function createTransaction(
  walletId: string,
  partnerId: string,
  type: TransactionType,
  category: TransactionCategory,
  amount: number,
  description: string,
  options?: {
    orderId?: string;
    payoutId?: string;
    notes?: string;
    environment?: 'live' | 'test';
    paymentReference?: string;
    paymentMethod?: string;
  }
): Promise<WalletTransaction> {
  const walletsCollection = await getCollection(WALLETS_COLLECTION);
  const transactionsCollection = await getCollection(TRANSACTIONS_COLLECTION);
  
  // Get current wallet balance
  const wallet = await walletsCollection.findOne({ _id: new ObjectId(walletId) });
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  // Calculate new balance based on transaction type
  let balanceUpdate: any = {};
  let balanceAfter = 0;
  
  switch (type) {
    case 'credit':
      if (category === 'order_commission') {
        // Commission goes to pending first
        balanceUpdate = { 'balance.pending': wallet.balance.pending + amount };
        balanceAfter = wallet.balance.available + wallet.balance.pending + amount;
      } else {
        // Bonuses etc go directly to available
        balanceUpdate = { 'balance.available': wallet.balance.available + amount };
        balanceAfter = wallet.balance.available + amount + wallet.balance.pending;
      }
      break;
      
    case 'debit':
      balanceUpdate = { 'balance.available': wallet.balance.available - amount };
      balanceAfter = wallet.balance.available - amount;
      break;
      
    case 'hold':
      balanceUpdate = { 
        'balance.available': wallet.balance.available - amount,
        'balance.held': wallet.balance.held + amount 
      };
      balanceAfter = wallet.balance.available - amount;
      break;
      
    case 'release':
      balanceUpdate = { 
        'balance.held': wallet.balance.held - amount,
        'balance.available': wallet.balance.available + amount 
      };
      balanceAfter = wallet.balance.available + amount;
      break;
  }
  
  // Create transaction
  const transaction: WalletTransaction = {
    id: new ObjectId().toString(),
    walletId,
    partnerId,
    type,
    category,
    environment: options?.environment || 'live',
    amount,
    balanceAfter,
    orderId: options?.orderId,
    payoutId: options?.payoutId,
    paymentReference: options?.paymentReference,
    paymentMethod: options?.paymentMethod,
    description,
    notes: options?.notes,
    status: type === 'hold' ? 'active' : 'completed',
    createdAt: new Date(),
    processedAt: new Date(),
  };
  
  // Update wallet balance
  await walletsCollection.updateOne(
    { _id: new ObjectId(walletId) },
    { 
      $set: { 
        ...balanceUpdate, 
        updatedAt: new Date() 
      } 
    }
  );
  
  // Insert transaction
  await transactionsCollection.insertOne({
    ...transaction,
    _id: new ObjectId(transaction.id),
  });
  
  return transaction;
}

/**
 * Move pending balance to available (after order delivery + return window)
 */
export async function releasePendingBalance(
  walletId: string,
  partnerId: string,
  amount: number,
  orderId: string
): Promise<WalletTransaction> {
  const walletsCollection = await getCollection(WALLETS_COLLECTION);
  
  // Update wallet
  await walletsCollection.updateOne(
    { _id: new ObjectId(walletId) },
    { 
      $inc: { 
        'balance.pending': -amount,
        'balance.available': amount 
      },
      $set: { updatedAt: new Date() }
    }
  );
  
  // Create transaction
  return createTransaction(
    walletId,
    partnerId,
    'credit',
    'order_commission',
    0, // No new amount, just recording the release
    `Commission released for order ${orderId}`,
    { orderId }
  );
}

/**
 * Get transactions for a wallet
 */
export async function getWalletTransactions(
  walletId: string,
  options?: {
    type?: TransactionType;
    category?: TransactionCategory;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    limit?: number;
  }
): Promise<{ transactions: WalletTransaction[]; total: number }> {
  const collection = await getCollection(TRANSACTIONS_COLLECTION);
  
  const filter: any = { walletId };
  
  if (options?.type) {
    filter.type = options.type;
  }
  
  if (options?.category) {
    filter.category = options.category;
  }
  
  if (options?.fromDate || options?.toDate) {
    filter.createdAt = {};
    if (options.fromDate) {
      filter.createdAt.$gte = options.fromDate;
    }
    if (options.toDate) {
      filter.createdAt.$lte = options.toDate;
    }
  }
  
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const skip = (page - 1) * limit;
  
  const [transactions, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  
  return {
    transactions: transactions.map(normalizeTransaction),
    total,
  };
}

function normalizeTransaction(doc: any): WalletTransaction {
  return {
    id: doc._id.toString(),
    walletId: doc.walletId,
    partnerId: doc.partnerId,
    type: doc.type,
    category: doc.category,
    amount: doc.amount,
    balanceAfter: doc.balanceAfter,
    orderId: doc.orderId,
    payoutId: doc.payoutId,
    description: doc.description,
    notes: doc.notes,
    status: doc.status,
    createdAt: new Date(doc.createdAt),
    processedAt: doc.processedAt ? new Date(doc.processedAt) : undefined,
    processedBy: doc.processedBy,
  };
}

// ============================================
// Payout Operations
// ============================================

/**
 * Create a payout request
 */
export async function createPayoutRequest(
  partnerId: string,
  walletId: string,
  amount: number,
  bankAccountId: string,
  notes?: string
): Promise<Payout> {
  const walletsCollection = await getCollection(WALLETS_COLLECTION);
  const payoutsCollection = await getCollection(PAYOUTS_COLLECTION);
  
  // Get wallet
  const wallet = await walletsCollection.findOne({ _id: new ObjectId(walletId) });
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  // Validate balance
  if (wallet.balance.available < amount) {
    throw new Error('Insufficient balance');
  }
  
  // Validate minimum payout
  if (amount < wallet.minimumPayout) {
    throw new Error(`Minimum payout amount is ₹${wallet.minimumPayout}`);
  }
  
  // Get bank account
  const bankAccount = wallet.bankAccounts.find((ba: BankAccount) => ba.id === bankAccountId);
  if (!bankAccount) {
    throw new Error('Bank account not found');
  }
  
  // Create payout
  const payout: Payout = {
    id: new ObjectId().toString(),
    partnerId,
    walletId,
    amount,
    bankAccountId,
    bankAccount: {
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber.slice(-4).padStart(bankAccount.accountNumber.length, '*'),
      ifsc: bankAccount.ifsc,
    },
    status: 'pending_approval',
    notes,
    requestedAt: new Date(),
  };
  
  // Debit amount from available balance
  await walletsCollection.updateOne(
    { _id: new ObjectId(walletId) },
    { 
      $inc: { 'balance.available': -amount },
      $set: { updatedAt: new Date() }
    }
  );
  
  // Insert payout
  await payoutsCollection.insertOne({
    ...payout,
    _id: new ObjectId(payout.id),
  });
  
  // Create transaction
  await createTransaction(
    walletId,
    partnerId,
    'debit',
    'payout',
    amount,
    `Payout request - ${payout.id}`,
    { payoutId: payout.id, notes }
  );
  
  return payout;
}

/**
 * Approve a payout request
 */
export async function approvePayout(
  payoutId: string,
  approvedBy: string
): Promise<Payout> {
  const collection = await getCollection(PAYOUTS_COLLECTION);
  
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(payoutId), status: 'pending_approval' },
    { 
      $set: { 
        status: 'approved',
        approvedAt: new Date(),
        approvedBy,
      } 
    },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    throw new Error('Payout not found or already processed');
  }
  
  return normalizePayout(result);
}

/**
 * Reject a payout request
 */
export async function rejectPayout(
  payoutId: string,
  rejectedBy: string,
  reason: string
): Promise<Payout> {
  const payoutsCollection = await getCollection(PAYOUTS_COLLECTION);
  const walletsCollection = await getCollection(WALLETS_COLLECTION);
  
  // Get payout
  const payout = await payoutsCollection.findOne({ 
    _id: new ObjectId(payoutId), 
    status: 'pending_approval' 
  });
  
  if (!payout) {
    throw new Error('Payout not found or already processed');
  }
  
  // Refund the amount back to wallet
  await walletsCollection.updateOne(
    { _id: new ObjectId(payout.walletId) },
    { 
      $inc: { 'balance.available': payout.amount },
      $set: { updatedAt: new Date() }
    }
  );
  
  // Update payout status
  const result = await payoutsCollection.findOneAndUpdate(
    { _id: new ObjectId(payoutId) },
    { 
      $set: { 
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy,
        rejectionReason: reason,
      } 
    },
    { returnDocument: 'after' }
  );
  
  // Create refund transaction
  await createTransaction(
    payout.walletId,
    payout.partnerId,
    'credit',
    'payout',
    payout.amount,
    `Payout rejected - refund: ${reason}`,
    { payoutId }
  );
  
  return normalizePayout(result);
}

/**
 * Complete a payout (mark as processed)
 */
export async function completePayout(
  payoutId: string,
  transactionId: string
): Promise<Payout> {
  const collection = await getCollection(PAYOUTS_COLLECTION);
  
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(payoutId), status: 'approved' },
    { 
      $set: { 
        status: 'completed',
        processedAt: new Date(),
        completedAt: new Date(),
        transactionId,
      } 
    },
    { returnDocument: 'after' }
  );
  
  if (!result) {
    throw new Error('Payout not found or not in approved status');
  }
  
  return normalizePayout(result);
}

/**
 * Get payouts for a partner
 */
export async function getPartnerPayouts(
  partnerId: string,
  options?: {
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ payouts: Payout[]; total: number }> {
  const collection = await getCollection(PAYOUTS_COLLECTION);
  
  const filter: any = { partnerId };
  
  if (options?.status) {
    filter.status = options.status;
  }
  
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;
  
  const [payouts, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  
  return {
    payouts: payouts.map(normalizePayout),
    total,
  };
}

/**
 * Get pending payouts for admin
 */
export async function getPendingPayouts(
  options?: { page?: number; limit?: number }
): Promise<{ payouts: Payout[]; total: number }> {
  const collection = await getCollection(PAYOUTS_COLLECTION);
  
  const filter = { status: 'pending_approval' };
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;
  
  const [payouts, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ requestedAt: 1 }) // Oldest first
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  
  return {
    payouts: payouts.map(normalizePayout),
    total,
  };
}

function normalizePayout(doc: any): Payout {
  return {
    id: doc._id.toString(),
    partnerId: doc.partnerId,
    walletId: doc.walletId,
    amount: doc.amount,
    bankAccountId: doc.bankAccountId,
    bankAccount: doc.bankAccount,
    status: doc.status,
    notes: doc.notes,
    adminNotes: doc.adminNotes,
    transactionId: doc.transactionId,
    requestedAt: new Date(doc.requestedAt),
    approvedAt: doc.approvedAt ? new Date(doc.approvedAt) : undefined,
    approvedBy: doc.approvedBy,
    processedAt: doc.processedAt ? new Date(doc.processedAt) : undefined,
    completedAt: doc.completedAt ? new Date(doc.completedAt) : undefined,
    rejectedAt: doc.rejectedAt ? new Date(doc.rejectedAt) : undefined,
    rejectedBy: doc.rejectedBy,
    rejectionReason: doc.rejectionReason,
  };
}

// ============================================
// Bank Account Operations
// ============================================

/**
 * Add bank account to wallet
 */
export async function addBankAccount(
  walletId: string,
  bankAccount: Omit<BankAccount, 'id' | 'verified' | 'createdAt'>
): Promise<BankAccount> {
  const collection = await getCollection(WALLETS_COLLECTION);
  
  const newBankAccount: BankAccount = {
    ...bankAccount,
    id: new ObjectId().toString(),
    verified: false,
    createdAt: new Date(),
  };
  
  await collection.updateOne(
    { _id: new ObjectId(walletId) } as any,
    { 
      $push: { bankAccounts: newBankAccount },
      $set: { updatedAt: new Date() }
    } as any
  );
  
  // If this is the first bank account, make it default
  const wallet = await collection.findOne({ _id: new ObjectId(walletId) });
  if (wallet && wallet.bankAccounts.length === 1) {
    await collection.updateOne(
      { _id: new ObjectId(walletId) },
      { $set: { defaultBankAccountId: newBankAccount.id } }
    );
  }
  
  return newBankAccount;
}

/**
 * Verify a bank account
 */
export async function verifyBankAccount(
  walletId: string,
  bankAccountId: string
): Promise<void> {
  const collection = await getCollection(WALLETS_COLLECTION);
  
  await collection.updateOne(
    { _id: new ObjectId(walletId), 'bankAccounts.id': bankAccountId },
    { 
      $set: { 
        'bankAccounts.$.verified': true,
        'bankAccounts.$.verifiedAt': new Date(),
        updatedAt: new Date()
      } 
    }
  );
}

/**
 * Set default bank account
 */
export async function setDefaultBankAccount(
  walletId: string,
  bankAccountId: string
): Promise<void> {
  const collection = await getCollection(WALLETS_COLLECTION);
  
  await collection.updateOne(
    { _id: new ObjectId(walletId) },
    { 
      $set: { 
        defaultBankAccountId: bankAccountId,
        updatedAt: new Date()
      } 
    }
  );
}

// Export wallet service
export const walletService = {
  createWallet,
  getWalletByPartnerId,
  getWalletById,
  createTransaction,
  releasePendingBalance,
  getWalletTransactions,
  createPayoutRequest,
  approvePayout,
  rejectPayout,
  completePayout,
  getPartnerPayouts,
  getPendingPayouts,
  addBankAccount,
  verifyBankAccount,
  setDefaultBankAccount,
};
