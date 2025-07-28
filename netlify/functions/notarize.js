import { ThorClient } from '@vechain/sdk-network';
import { cry, Transaction, secp256k1 } from '@vechain/sdk-core';

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
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing hash.' }) };
    }
    if (!mnemonic) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server Error: MNEMONIC key not set.' }) };
    }

    // Connect to VeChain
    const client = new ThorClient('https://testnet.vechain.org');
    
    // **THE FIX IS HERE:** We use 'cry.mnemonic' which is a more robust way to handle the key.
    const privateKey = cry.mnemonic.toPrivateKey(mnemonic.split(' '));
    const address = cry.secp256k1.deriveAddress(privateKey);

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
      gas: 21000,
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
