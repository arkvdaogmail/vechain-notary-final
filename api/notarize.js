import { ThorClient } from '@vechain/sdk-network';
import { HDNode, Transaction, secp256k1 } from '@vechain/sdk-core';
import 'dotenv/config';

export default async function handler(request, response) {
  // For Netlify, the request body is a string
  const body = JSON.parse(request.body);
  const { hash } = body;

  if (request.method !== 'POST' || !hash) {
    return response.status(400).json({ error: 'Invalid request' });
  }

  try {
    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
      throw new Error('Mnemonic phrase is not set in environment variables.');
    }

    const client = new ThorClient('https://testnet.vechain.org');
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

    const tx = new Transaction(txBody);
    const signingHash = tx.getSigningHash();
    const signature = secp256k1.sign(signingHash, privateKey);
    tx.signature = signature;

    const rawTx = '0x' + tx.encode().toString('hex');
    const txResponse = await client.transactions.sendTransaction(rawTx);

    return response.status(200).json({ success: true, txId: txResponse.id });

  } catch (error) {
    return response.status(500).json({ success: false, error: error.message });
  }
}
