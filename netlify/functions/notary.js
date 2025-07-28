// netlify/functions/notary.js - The All-in-One Function

import { ThorClient, VechainProvider } from "@vechain/sdk-network";
import { TransactionHandler, cry } from "@vechain/sdk-core";

// Helper function for success responses
const buildSuccessResponse = (data) => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ success: true, data }),
});

// Helper function for error responses
const buildErrorResponse = (statusCode, message, details = null) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ success: false, error: { message, details } }),
});


// The main handler for all API requests
export async function handler(event, context) {
  if (event.httpMethod !== 'POST' ) {
    return buildErrorResponse(405, 'Method Not Allowed');
  }

  const body = JSON.parse(event.body);
  const { action, payload } = body;

  const fromAddress = process.env.VECHAIN_FROM_ADDRESS;
  const nodeUrl = process.env.VECHAIN_NODE_URL;
  const mnemonicString = process.env.VECHAIN_PRIVATE_KEY;

  if (!fromAddress || !nodeUrl || !mnemonicString) {
    return buildErrorResponse(500, 'Server Configuration Error', 'An environment variable is missing.');
  }

  const thorClient = new ThorClient(nodeUrl);

  // --- ACTION: NOTARIZE ---
  if (action === 'notarize') {
    try {
      const hash = payload;
      if (!hash || !hash.startsWith('0x')) {
        return buildErrorResponse(400, 'Invalid hash parameter.');
      }

      const privateKeyBytes = cry.mnemonic.toPrivateKey(mnemonicString.split(' '));
      const account = cry.secp256k1.deriveAddress(privateKeyBytes);
      const provider = new VechainProvider(thorClient, undefined, false);

      const clauses = [{ to: account, value: '0x0', data: hash }];
      const gasResult = await thorClient.gas.estimateGas(clauses, account);
      const blockRef = await thorClient.blocks.getBestBlockRef();
      
      const txBody = {
          clauses,
          gas: gasResult.totalGas,
          blockRef,
          chainTag: await thorClient.thor.getChainTag(),
          gasPriceCoef: 128,
          expiration: 32,
          nonce: Date.now(),
      };

      const rawTransaction = TransactionHandler.encode(txBody, false);
      const signature = cry.secp256k1.sign(TransactionHandler.signingHash(txBody), privateKeyBytes);
      
      const signedTx = { raw: rawTransaction, signature: signature, origin: account };
      const sentTx = await provider.sendTransaction(signedTx);

      return buildSuccessResponse({
          message: "Transaction sent successfully!",
          transactionId: sentTx.id
      });

    } catch (error) {
      return buildErrorResponse(500, 'Notarize API failed.', error.message);
    }
  }

  // --- ACTION: LOOKUP ---
  if (action === 'lookup') {
    try {
      const query = payload;
      if (!query || !query.startsWith('0x')) {
        return buildErrorResponse(400, 'Invalid query parameter.');
      }

      let transactions = [];
      if (query.length === 66) {
          const tx = await thorClient.transactions.getTransaction(query);
          if (tx) transactions.push(tx);
      } else {
          const response = await thorClient.transactions.getTransactions({
              range: { unit: 'block', from: 0, to: (await thorClient.blocks.getBestBlock()).number },
              criteriaSet: [{ sender: fromAddress, data: query }],
              order: 'desc',
          });
          if (response && response.transactions) transactions = response.transactions;
      }

      if (transactions.length === 0) {
          return buildSuccessResponse([]);
      }

      const formattedTxs = transactions.map(tx => ({
          id: tx.id,
          hash: tx.clauses[0]?.data || 'N/A',
          timestamp: tx.blockTimestamp,
          blockNumber: tx.blockNumber,
          origin: tx.origin,
      }));

      return buildSuccessResponse(formattedTxs);

    } catch (error) {
      return buildErrorResponse(500, 'Lookup API failed.', error.message);
    }
  }

  return buildErrorResponse(400, 'Invalid action specified.');
}
