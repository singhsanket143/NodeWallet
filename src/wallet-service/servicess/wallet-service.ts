import {Wallet, LedgerType} from '../../shared/types/shared-types';
import {ShardResolver} from '../../shared/database/shard-resolver';
import {connectionManager} from '../../shared/database/connection-manager';
import {WalletRepository} from '../../shared/repositories/wallet-repository';
import {LedgerRepository} from '../../shared/repositories/ledger-repository';

//Business Logic for wallet operations
export class WalletService {

    private walletRepository: WalletRepository;
    private ledgerRepository: LedgerRepository;

    constructor() {
        this.walletRepository = new WalletRepository();
        this.ledgerRepository = new LedgerRepository();
    }

    //Create a wallet for a user
    //1. Detemine sahrd from userId
    //2. Start transaction on that shard
    //3. Check if wallet already exists
    //4. Create Wallet
    async createWallet(userId: bigint): Promise<Wallet> {
        const shardId = ShardResolver.getShardId(userId);
        
        return await connectionManager.executeInTransaction(shardId, async (tx) => {

            const existingWallet = await this.walletRepository.findByUserId(userId, tx);
            if(existingWallet){
                throw new Error('Wallet already exists');
            }

            return await this.walletRepository.create(userId, tx);
        });
    }
    
    //Get Wallet
    //1. Detemine shard
    //2. Use shard client
    //3. Read wallet

    async getWallet(userId: bigint): Promise<Wallet | null> {
        const shardId = ShardResolver.getShardId(userId);
        const client = connectionManager.getClient(shardId);
        
        return await this.walletRepository.findByUserId(userId, client);
    }

    //Add Money
    //1. Validate amount is positive
    //2. Detemine shard
    //3. Start db transaction
    //4. Lock wallet row
    //5. Compute new balance
    //6. Update with version lock
    //7. Optionally, create a new ledger entry if linked to a transaction

    async addMoney(
        userId: bigint,
        amount: bigint,
        transactionId?: bigint,
    ): Promise<Wallet> {

        if(amount <= 0){
            throw new Error('Amount must be positive');
        }

        const shardId = ShardResolver.getShardId(userId);

        return await connectionManager.executeInTransaction(shardId, async (tx) => {

            //lock wallet row to prevent concurrent modifications
            const wallet = await this.walletRepository.findByUserIdWithLock(userId, tx);

            if(!wallet){
                throw new Error('Wallet not found');
            }

            //Update balance with optimistic locking
            const newBalance = wallet.balance + amount;
            const updatedWallet = await this.walletRepository.updateBalance(wallet.id, newBalance, wallet.version, tx);
            
            if(!updatedWallet){
                throw new Error('Concurrent modification detected');
            }

            if(transactionId){
                await this.ledgerRepository.create(userId, transactionId, amount, LedgerType.CREDIT, tx);
            }
            
            return updatedWallet;
        });
    }

    //Debit and credit
    //These methods used by saga
    //They accept an existing transaction client (tx)
    //That means the saga step controls the transaction boundary
    //They also create ledger entries
    async debit(
        userId: bigint,
        amount: bigint,
        transactionId: bigint,
        tx: any,
    ): Promise<Wallet |  null> {
        
        //Debit with lock (tx already in the transaction   )
        const updatedWallet = await this.walletRepository.debit(userId, amount, tx);

        if(updatedWallet){

            await this.ledgerRepository.create(userId, transactionId, amount, LedgerType.DEBIT, tx);
        }
        return updatedWallet;
    }

    async credit(
        userId: bigint,
        amount: bigint,
        transactionId: bigint,
        tx: any,
    ): Promise<Wallet> {

        const wallet = await this.walletRepository.findByUserIdWithLock(userId, tx);
        if(!wallet){
            throw new Error('Wallet not found');
        }

       const updatedWallet = await this.walletRepository.credit(userId, amount, tx);
       if(!updatedWallet){
        throw new Error('Concurrent modification detected');
       }

     await this.ledgerRepository.create(userId, transactionId, amount, LedgerType.CREDIT, tx);
     return updatedWallet;
    }

}