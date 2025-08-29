import { RpcProvider, hash, num } from 'starknet';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { exchangeRateService } from './exchangeRateService';
import { paystackService } from './paystackService';
import { WatcherState } from '../models/WatcherState';
import { ProcessedEvent } from '../models/ProcessedEvent';
import { BankAccount } from '../models/BankAccount';
import { SENDPAY_CONTRACT_ADDRESS } from '../lib/constants';

interface WithdrawalEvent {
  withdrawal_id: string;
  user: string;
  amount: string;
  token_address: string;
  bank_account: string;
  bank_name: string;
  account_name: string;
  timestamp: number;
  block_number: number;
  status: string;
}

export class ContractEventWatcher {
  private provider: RpcProvider | null = null;
  private contractAddress: string | null = null;
  private isWatching: boolean = false;
  private lastProcessedBlock: number = 0;
  private pollingHandle: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs = 10000;
  private readonly lookbackBlocks = 30;
  private readonly reorgBackoffBlocks = 5;
  private readonly watcherKey = 'withdrawal-watcher';
  private readonly withdrawalKey = num.toHex(hash.starknetKeccak('sendpay::sendpay::WithdrawalProcessed'));

  constructor() {
    const rpcUrl = process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
    const address = process.env.SENDPAY_CONTRACT_ADDRESS || SENDPAY_CONTRACT_ADDRESS || '';

    if (rpcUrl && address) {
      this.provider = new RpcProvider({ nodeUrl: rpcUrl });
      this.contractAddress = address;
      console.log('📝 Contract Event Watcher initialized (starknet.js polling)');
    } else {
      console.warn('⚠️ STARKNET_RPC_URL or SENDPAY_CONTRACT_ADDRESS not set. Event watcher will not start.');
    }
  }

  async startWatching() {
    if (this.isWatching) return;
    if (!this.provider || !this.contractAddress) return;

    this.isWatching = true;

    try {
      const latest = await this.provider.getBlock('latest');
      const dbState = await WatcherState.findOne({ key: this.watcherKey });
      const fallback = Math.max(0, (latest.block_number || 0) - this.lookbackBlocks);
      this.lastProcessedBlock = dbState ? Math.max(0, dbState.lastProcessedBlock - this.reorgBackoffBlocks) : fallback;

      await this.processRange(this.lastProcessedBlock, latest.block_number || this.lastProcessedBlock);
      await this.saveCheckpoint(latest.block_number || this.lastProcessedBlock);

      this.pollingHandle = setInterval(async () => {
        try {
          const current = await this.provider!.getBlock('latest');
          const currentNum = current.block_number || 0;
          if (currentNum > this.lastProcessedBlock) {
            await this.processRange(this.lastProcessedBlock + 1, currentNum);
            await this.saveCheckpoint(currentNum);
            this.lastProcessedBlock = currentNum;
          }
        } catch (err) {
          console.error('Watcher polling error:', err);
        }
      }, this.pollIntervalMs);

      console.log('✅ Contract event watcher started (from block', this.lastProcessedBlock, ')');
    } catch (error) {
      console.error('❌ Failed to start event watcher:', error);
      this.isWatching = false;
    }
  }

  stopWatching() {
    if (!this.isWatching) return;
    if (this.pollingHandle) clearInterval(this.pollingHandle);
    this.pollingHandle = null;
    this.isWatching = false;
    console.log('🛑 Contract event watcher stopped');
  }

  private async saveCheckpoint(blockNumber: number) {
    await WatcherState.findOneAndUpdate(
      { key: this.watcherKey },
      { lastProcessedBlock: blockNumber },
      { upsert: true }
    );
  }

  private async isEventProcessed(txHash: string, logIndex: number, withdrawalId?: string) {
    const existing = await ProcessedEvent.findOne({ txHash, logIndex });
    if (existing) return true;
    if (withdrawalId) {
      const byWid = await ProcessedEvent.findOne({ withdrawalId });
      if (byWid) return true;
    }
    return false;
  }

  private async markEventProcessed(txHash: string, logIndex: number, withdrawalId?: string) {
    await ProcessedEvent.create({ txHash, logIndex, withdrawalId });
  }

  private async processRange(fromBlock: number, toBlock: number) {
    if (!this.provider || !this.contractAddress) return;

    const keyFilter = [[], [this.withdrawalKey]];

    let continuationToken: string | undefined = undefined;

    do {
      const res = await this.provider.getEvents({
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        address: this.contractAddress,
        keys: keyFilter as any,
        chunk_size: 50,
        continuation_token: continuationToken
      } as any);

      continuationToken = (res as any).continuation_token;
      const events = (res as any).events || [];

      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const txHash = ev.transaction_hash as string;
        const logIndex = i;
        const parsed = this.parseWithdrawalEventFromData(ev.data || [], ev.block_number);

        if (await this.isEventProcessed(txHash, logIndex, parsed.withdrawal_id)) {
          continue;
        }

        try {
          await this.processWithdrawalEvent(parsed, txHash);
          await this.markEventProcessed(txHash, logIndex, parsed.withdrawal_id);
        } catch (err) {
          console.error('Event processing error:', err);
        }
      }
    } while (continuationToken);
  }

  private parseU256(lowHex: string, highHex: string): string {
    const low = BigInt(lowHex || '0x0');
    const high = BigInt(highHex || '0x0');
    return (high << 128n | (low & ((1n << 128n) - 1n))).toString();
  }

  private parseU64(hex: string): number {
    return Number(BigInt(hex || '0x0'));
  }

  private parseWithdrawalEventFromData(data: string[], fallbackBlockNumber: number): WithdrawalEvent {
    const wid = this.parseU256(data[0], data[1]);
    const user = data[2];
    const amount = this.parseU256(data[3], data[4]);
    const token = data[5];
    const bankAccount = data[6];
    const bankName = data[7];
    const accountName = data[8];
    const ts = this.parseU64(data[9]);
    const blk = this.parseU64(data[10]) || fallbackBlockNumber || 0;
    const status = data[11] || 'pending';

    return {
      withdrawal_id: wid,
      user,
      amount,
      token_address: token,
      bank_account: bankAccount,
      bank_name: bankName,
      account_name: accountName,
      timestamp: ts,
      block_number: blk,
      status
    };
  }

  async processWithdrawalEvent(eventData: WithdrawalEvent, transactionHash: string) {
    try {
      const user = await User.findOne({ cavosWalletAddress: (eventData.user || '').toLowerCase() });
      if (!user) return;

      const exchangeRate = await exchangeRateService.getUSDToNGNRate();
      const amountUSD = Number(eventData.amount) / 1e6;
      const amountNGN = amountUSD * exchangeRate;

      const transaction = await Transaction.findOneAndUpdate(
        { starknetTxHash: transactionHash, type: 'withdrawal' },
        {
          userId: user._id,
          type: 'withdrawal',
          amount: amountUSD,
          amountNGN,
          currency: 'USD',
          status: this.mapStatus(eventData.status),
          starknetTxHash: transactionHash,
          blockNumber: eventData.block_number,
          description: `Withdrawal to ${eventData.bank_name} - ${eventData.account_name}`,
          reference: `WD_${eventData.withdrawal_id}`,
          metadata: {
            withdrawalId: eventData.withdrawal_id,
            tokenAddress: eventData.token_address,
            bankAccount: eventData.bank_account,
            bankName: eventData.bank_name,
            accountName: eventData.account_name,
            contractEvent: true
          },
          processedAt: new Date()
        },
        { upsert: true, new: true }
      );

      await User.findByIdAndUpdate(user._id, { $inc: { balanceUSD: -amountUSD, balanceNGN: -amountNGN } });
      await this.triggerPaystackPayout(transaction, user);
    } catch (error) {
      console.error('Error processing withdrawal event:', error);
    }
  }

  private mapStatus(contractStatus: string): string {
    switch (contractStatus) {
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private async triggerPaystackPayout(transaction: any, user: any) {
    try {
      const bankAccount = await this.getBankAccountFromMetadata(transaction.metadata);
      if (!bankAccount) return;

      const payoutResult = await paystackService.initiatePayout({
        bankCode: bankAccount.bankCode,
        accountNumber: bankAccount.accountNumber,
        amount: transaction.amountNGN,
        beneficiaryName: bankAccount.accountName,
        narration: `SendPay withdrawal - ${transaction.reference}`,
        reference: transaction.reference
      });

      await Transaction.findByIdAndUpdate(transaction._id, {
        metadata: {
          ...transaction.metadata,
          paystackPayoutId: payoutResult.data.id,
          paystackTransferCode: payoutResult.data.transfer_code,
          payoutInitiated: true,
          payoutStatus: payoutResult.data.status
        }
      });
    } catch (error: any) {
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'failed',
        metadata: { ...transaction.metadata, payoutError: error.message }
      });
    }
  }

  private async getBankAccountFromMetadata(metadata: any) {
    if (metadata && metadata.bankAccount && metadata.accountName) {
      // Try to fetch actual bank code from saved accounts
      const account = await BankAccount.findOne({ accountNumber: metadata.bankAccount });
      return {
        bankCode: account?.bankCode || '044',
        accountNumber: metadata.bankAccount,
        accountName: metadata.accountName,
        bankName: metadata.bankName || account?.bankName || ''
      };
    }
    return null;
  }

  getStatus() {
    return {
      isWatching: this.isWatching,
      lastProcessedBlock: this.lastProcessedBlock,
      mode: this.provider && this.contractAddress ? 'starknet' : 'disabled',
      contractAddress: this.contractAddress || 'Not configured'
    };
  }

  async getHealth() {
    if (!this.provider) {
      return { ok: false, message: 'provider not configured' };
    }
    try {
      const latest = await this.provider.getBlock('latest');
      const latestNum = latest.block_number || 0;
      return {
        ok: true,
        latestBlock: latestNum,
        lastProcessedBlock: this.lastProcessedBlock,
        lag: Math.max(0, latestNum - this.lastProcessedBlock)
      };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }
}

export const contractEventWatcher = new ContractEventWatcher();
