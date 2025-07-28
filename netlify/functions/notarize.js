import { ThorClient } from '@vechain/sdk-network';
import { HDNode, Transaction, secp256k1 } from '@vechain/sdk-core';

export async function handler(event) {
  // Ensure this is a POST request
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { hash } = JSON.parse(event.body);
    const mnemonic = process.env.MNEMONIC;

    // Check for missing data
    if (!hash) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing hash in request body.' }) };
    }
    if (!mnemonic) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: MNEMONIC not set.' }) };
    }

    // Connect to VeChain
    const client = new ThorClient('https://testnet.vechain.org');
    
    // Create wallet from your secret phrase
    const hdNode = HDNode.fromMnemonic(mnemonic.split(' '));
    const privateKey = hdNode.derive(0).privateKey;
    const address = hdNode.derive(0).address;

    // Get latest blockchain data to build the transaction
    const bestBlock = await client.blocks.getBestBlock();
    const genesisBlock = await client.blocks.getGenesisBlock();

    // Build the transaction body
    const txBody = {
      chainTag: parseInt(genesisBlock.id.slice(-2), 16),
      blockRef: bestBlock.id.slice(0, 18),
      expiration: 32,
      clauses: [{ to: address, value: '0x0', data: hash }],
      gasPriceCoef: 0,
      gas: 21000, // Standard gas limit
      dependsOn: null,
      nonce: Date.now(),
    };

    // Sign and send the transaction
    const tx = new Transaction(txBody);
    tx.signature = secp256k1.sign(tx.getSigningHash(), privateKey);
    const { id } = await client.transactions.sendTransaction('0x' + tx.encode().toString('hex'));

    // Success! Return the transaction ID
    return { statusCode: 200, body: JSON.stringify({ txId: id }) };

  } catch (error) {
    // If anything fails, return a detailed error message
    console.error('Backend Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
