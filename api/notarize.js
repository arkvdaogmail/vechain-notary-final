// api/notarize.js - FINAL CORRECTED VERSION

import { ThorClient } from "@vechain/sdk-network";
import { buildErrorResponse, buildSuccessResponse } from "../_utils/response-builder";
import { TransactionHandler, secp256k1, cry } from "@vechain/sdk-core";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return buildErrorResponse(res, 405, 'Method Not Allowed');
    }

    try {
        // --- THE FIX IS HERE ---
        // We ensure the private key from environment variables is handled correctly.
        const privateKeyString = process.env.VECHAIN_PRIVATE_KEY;
        if (!privateKeyString) {
            return buildErrorResponse(res, 500, 'Server Config Error', 'VECHAIN_PRIVATE_KEY is not set.');
        }
        
        // The SDK expects a raw hex string for the private key, without the mnemonic phrase.
        // We will derive the private key from the mnemonic.
        const privateKeyBytes = cry.mnemonic.toPrivateKey(privateKeyString.split(' '));
        const account = cry.secp256k1.deriveAddress(privateKeyBytes);
        
        const thorClient = new ThorClient(process.env.VECHAIN_NODE_URL || "https://testnet.vechain.org/" );

        const { hash } = req.body;
        if (!hash || typeof hash !== 'string' || !hash.startsWith('0x')) {
            return buildErrorResponse(res, 400, 'Invalid or missing hash parameter.');
        }

        const clauses = [{ to: account, value: '0x0', data: hash }];
        const gasResult = await thorClient.gas.estimateGas(clauses, account);
        const blockRef = await thorClient.blocks.getBestBlockRef();
        const chainTag = await thorClient.thor.getChainTag();
        
        const body = {
            clauses,
            gas: gasResult.totalGas,
            blockRef,
            chainTag,
            gasPriceCoef: 128,
            expiration: 32,
            dependsOn: null,
            nonce: Date.now(),
        };

        const rawTransaction = TransactionHandler.encode(body, false);
        const signature = cry.secp256k1.sign(TransactionHandler.signingHash(body), privateKeyBytes);
        
        const signedTx = {
            raw: rawTransaction,
            signature: signature,
            origin: account
        };

        const { id } = await thorClient.transactions.sendTransaction(signedTx);

        return buildSuccessResponse(res, {
            message: "Transaction sent successfully!",
            transactionId: id
        });

    } catch (error) {
        console.error("Notarize API Runtime Error:", error);
        return buildErrorResponse(res, 500, 'API execution failed.', { message: error.message });
    }
}
