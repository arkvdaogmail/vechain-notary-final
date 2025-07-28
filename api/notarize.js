import { ThorClient } from '@vechain/sdk-network';
import { HDNode, Transaction, secp256k1 } from '@vechain/sdk-core';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { hash } = body;

    const mnemonic = process.env.MNEMONIC;
    if (!mnemonic) {
      throw new Error('Mnemonic not set');
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

    const rawTx = '0x' + tx.encode().toString('hex');
    const { id } = await client.transactions.sendTransaction(rawTx);

    return { statusCode: 200, body: JSON.stringify({ success: true, txId: id }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
}
