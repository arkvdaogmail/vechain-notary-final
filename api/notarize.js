import { ThorClient } from '@vechain/sdk-network';
import { HDNode, Transaction, secp256k1 } from '@vechain/sdk-core';
import 'dotenv/config';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { hash } = request.body;
  if (!hash) {
    return response.status(400).json({ error: 'Hash is required' });
  }

  try {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
      throw new Error('Mnemonic phrase is not set in environment variables.');
    }

    const nodeUrl = 'https://testnet.vechain.org';
    const client = new ThorClient(nodeUrl);

    const hdNode = HDNode.fromMnemonic(mnemonic.split(' '));
    const privateKey = hdNode.derive(0).privateKey;
    const senderAddress = hdNode.derive(0).address;

    const bestBlock = await client.blocks.getBestBlock();
    const genesisBlock = await client.blocks.getGenesisBlock();

    const txBody = {
      chainTag: parseInt(genesisBlock.id.slice(-2), 16),
      blockRef: bestBlock.id.slice(0, 18),
      expiration: 32,
      clauses: [{ to: senderAddress, value: '0x0', data: hash }],
      gasPriceCoef: 0,
      gas: 21000,
      dependsOn: null,
      nonce: Math.floor(Math.random() * 1000000000),
    };

    const transaction = new Transaction(txBody);
    const signingHash = transaction.getSigningHash();
    const signature = secp256k1.sign(signingHash, privateKey);
    transaction.signature = signature;

    const rawTransaction = '0x' + transaction.encode().toString('hex');
    const txResponse = await client.transactions.sendTransaction(rawTransaction);

    return response.status(200).json({ success: true, txId: txResponse.id });

  } catch (error) {
    console.error('Backend Error:', error);
    return response.status(500).json({ success: false, error: error.message });
  }
}
