import { PrismaClient, Prisma } from "../../generated/prisma/client";
import { Transaction, TransactionStatus } from "../types/shared-types";


export class TransactionRepository {

    //Create a new transaction record
    async create(fromUser: bigint, 
        toUser: bigint, 
        amount: bigint, 
        idempotencyKey: string, 
        tx: Prisma.TransactionClient): Promise<Transaction> {
        const transactionEntity = await tx.transaction.create({
            data: {
                from_user: fromUser,
                to_user: toUser,
                amount: amount,
                status: TransactionStatus.PENDING,
                idempotency_key: idempotencyKey
            }
        });
        return this.mapToTransaction(transactionEntity);
    }

    async findById(transactionId: bigint, 
        tx: PrismaClient | Prisma.TransactionClient): Promise<Transaction | null> {
        const transactionEntity = await tx.transaction.findUnique({
            where: {
                id: transactionId
            }
        });
        return transactionEntity ? this.mapToTransaction(transactionEntity) : null;
    }

    async findByIdempotencyKey(
        idempotencyKey: string, 
        tx: PrismaClient | Prisma.TransactionClient): Promise<Transaction | null> {
        const transactionEntity = await tx.transaction.findUnique({
            where: {
                idempotency_key: idempotencyKey
            }
        });
        return transactionEntity ? this.mapToTransaction(transactionEntity) : null;
    }
    
    async updateStatus(transactionId: bigint,
         status: TransactionStatus, 
         tx: PrismaClient | Prisma.TransactionClient): Promise<Transaction | null> {
        const transactionEntity = await tx.transaction.update({
            where: {
                id: transactionId
            },
            data: {
                status: status
            }
        });
        return this.mapToTransaction(transactionEntity);
    }

    //Get the transaction history for a user
    //Check both shards since a user can be a sender and a receiver
    async getHistory(userId: bigint, 
        client1: PrismaClient,
        client2: PrismaClient,
        ): Promise<Transaction[]> {
        const [transactions1, transactions2] = await Promise.all([
            client1.transaction.findMany({
                where: {
                   OR: [
                    { from_user: userId },
                    { to_user: userId }
                   ]
                },
                orderBy: {
                    created_at: 'desc' }
            }),
            client2.transaction.findMany({
                where: {
                    OR: [
                        { from_user: userId },
                        { to_user: userId }
                       ]
                },
                orderBy: {
                    created_at: 'desc'
                }
            })
        ]);
       
        const allTransactions = [...transactions1.map(t  => this.mapToTransaction(t)), 
            ...transactions2.map(t => this.mapToTransaction(t))];
        
        //sort by created_at in descending order
        return allTransactions.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }


    
    //Map Prisma Model to Transaction Domain Model
    private mapToTransaction(entity: {
        id: bigint;
        from_user: bigint;
        to_user: bigint;
        amount: bigint;
        status: string | TransactionStatus;
        idempotency_key: string;
        created_at: Date;
    }): Transaction {
        const status = entity.status as TransactionStatus;
        return {
            id: BigInt(entity.id.toString()),
            from_user: BigInt(entity.from_user.toString()),
            to_user: BigInt(entity.to_user.toString()),
            amount: BigInt(entity.amount.toString()),
            status: status,
            idempotency_key: entity.idempotency_key,
            created_at: entity.created_at
        }
    }
}