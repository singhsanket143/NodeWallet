import dotenv from 'dotenv';
import { createApp } from './app';
import {getShard1Client, getShard2Client, closePrismaClients} from './shared/database/prisma-clients';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = createApp();

//Intialise prisma clients
async function initializeDatabase(): Promise<void> {
    try {
        getShard1Client();
        getShard2Client();
    }catch(error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
}

initializeDatabase().then(() => {
    
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received');
    await closePrismaClients();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received');
    await closePrismaClients();
    process.exit(0);
});