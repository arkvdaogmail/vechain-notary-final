// In file: api/lookup.js

import { ThorClient } from "@vechain/sdk-network";

// Helper function for success responses
const buildSuccessResponse = (res, data) => {
  res.status(200).json({ success: true, data });
};

// Helper function for error responses
const buildErrorResponse = (res, statusCode, message, details = null) => {
  res.status(statusCode).json({ success: false, error: { message, details } });
};

// The main handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return buildErrorResponse(res, 405, 'Method Not Allowed');
  }

  const { action, payload } = req.body;

  const fromAddress = process.env.VECHAIN_FROM_ADDRESS;
  const nodeUrl = process.env.VECHAIN_NODE_URL;
  const privateKey = process.env.VECHAIN_PRIVATE_KEY; // Using the key directly

  if (!fromAddress || !nodeUrl || !privateKey) {
    return buildErrorResponse(res, 500, 'Server Configuration Error', 'An environment variable is missing.');
  }

  const thorClient = new ThorClient(nodeUrl);

  // --- ACTION: NOTARIZE ---
  if (action === 'notarize') {
    // This part will be added back later if needed.
    // For now, we focus on making the lookup work.
    return buildErrorResponse(res, 501, 'Notarize action not implemented in this version.');
  }

  // --- ACTION: LOOKUP ---
  if (action === 'lookup') {
    try {
      const query = payload;
      if (!query || !query.startsWith('0x')) {
        return buildErrorResponse(res, 400, 'Invalid query parameter.');
      }

      let transactions = [];
      if (query.length === 66) { // It's a TX ID
        const tx = await thorClient.transactions.getTransaction(query);
        if (tx) transactions.push(tx);
      } else { // It's a data hash
        const response = await thorClient.transactions.getTransactions({
          range: { unit: 'block', from: 0, to: (await thorClient.blocks.getBestBlock()).number },
          criteriaSet: [{ sender: fromAddress, data: query }],
          order: 'desc',
        });
        if (response && response.transactions) transactions = response.transactions;
      }

      if (transactions.length === 0) {
        return buildSuccessResponse(res, []);
      }

      const formattedTxs = transactions.map(tx => ({
        id: tx.id,
        hash: tx.clauses[0]?.data || 'N/A',
        timestamp: tx.blockTimestamp,
        blockNumber: tx.blockNumber,
        origin: tx.origin,
      }));

      return buildSuccessResponse(res, formattedTxs);

    } catch (error) {
      return buildErrorResponse(res, 500, 'Lookup API failed.', error.message);
    }
  }

  return buildErrorResponse(res, 400, 'Invalid action specified.');
}

