import { ThorClient, HDNode, Transaction, secp256k1 } from '@vechain/sdk-core';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  try {
    const { hash } = JSON.parse(event.body);
    const mnemonic = process.env.MNEMONIC;

    if (!mnemonic) {
      return { statusCode: 500, body: JSON.stringify({ error: 'MNEMONIC secret key not set in Netlify.' }) };
    }

    const client = new ThorClient('https://testnet.vechain.org');
    const hdNode = HDNode.fromMnemonic(mnemonic.split(' '));
    const privateKey = hdNode.derive(0).privateKey;
    const address = hdNode.derive(0).address;

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
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
}
