import { ThorClient, cry, Transaction, secp256k1 } from '@vechain/sdk-core';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  try {
    const { hash } = JSON.parse(event.body);
    const privateKeyHex = process.env.VECHAIN_PRIVATE_KEY;

    if (!privateKeyHex) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server Error: VECHAIN_PRIVATE_KEY not set.' }) };
    }

    const privateKey = Buffer.from(privateKeyHex.slice(2), 'hex');
    const address = cry.secp256k1.deriveAddress(privateKey);
    
    const client = new ThorClient('https://testnet.vechain.org');
    const bestBlock = await client.blocks.getBestBlock();
    const genesisBlock = await client.blocks.getGenesisBlock();

    const txBody = {
      chainTag: parseInt(genesisBlock.id.slice(-2), 16),
      blockRef: bestBlock.id.slice(0, 18),
      expiration: 32,
      clauses: [{ to: address, value: '0x0', data: hash }],
      gasPriceCoef: 0,
      gas: 21000,
      dependsOn: null,
      nonce: Date.now(),
    };

    const tx = new Transaction(txBody);
    tx.signature = secp256k1.sign(tx.getSigningHash(), privateKey);
    const { id } = await client.transactions.sendTransaction('0x' + tx.encode().toString('hex'));

    return { statusCode: 200, body: JSON.stringify({ txId: id }) };
  } catch (error) {
    console.error('Backend Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
