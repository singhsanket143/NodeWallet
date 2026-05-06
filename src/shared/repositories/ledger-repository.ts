import { PrismaClient, Prisma } from "../../generated/prisma/client";
import {LedgerEntry, LedgerType} from "../types/shared-types";


//Handle all database operations for ledge entries using Prisma
//Ledger provides an audit trail for all transactions
//Each ledger entry is stored on user's shard
export class LedgerRepository {
    
    async create(userId: bigint, 
        transactionId: bigint, 
        amount: bigint, 
        type: LedgerType, 
        tx: Prisma.TransactionClient): Promise<LedgerEntry> {
       
        const ledgerEntity = await tx.ledger.create({
            data: {
                user_id: userId,
                transaction_id: transactionId,
                amount: amount,
                type: type
            }
        });
        return this.mapToLedgerEntry(ledgerEntity);
    }


    async findById(
        ledgerId: bigint,
        tx: PrismaClient | Prisma.TransactionClient
    ): Promise<LedgerEntry | null> {
        const ledgerEntity = await tx.ledger.findUnique({
            where: {
                id: ledgerId
            }
        });
        return ledgerEntity ? this.mapToLedgerEntry(ledgerEntity) : null;
    }

    async getHistory(
        userId: bigint,
        tx: PrismaClient | Prisma.TransactionClient
    ): Promise<LedgerEntry[]> {
        const ledgerEntities = await tx.ledger.findMany({
            where: {
                user_id: userId
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        return ledgerEntities.map(entity => this.mapToLedgerEntry(entity));
    }

    

    private mapToLedgerEntry(entity: {
        id: bigint;
        user_id: bigint;
        transaction_id: bigint;
        amount: bigint;
        type: string | LedgerType;
        created_at: Date;
    }): LedgerEntry {
        
        const type = entity.type as LedgerType;
        return {
            id: BigInt(entity.id.toString()),
            user_id: BigInt(entity.user_id.toString()),
            transaction_id: BigInt(entity.transaction_id.toString()),
            amount: BigInt(entity.amount.toString()),
            type: type,
            created_at: entity.created_at
        }
    }

}