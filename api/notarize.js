export async function handler(event) {
  try {
    // This is a dummy engine. It always succeeds.
    const dummyTxId = "success-from-dummy-engine-12345";
    return { 
      statusCode: 200, 
      body: JSON.stringify({ success: true, txId: dummyTxId }) 
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ success: false, error: 'The dummy engine itself failed.' }) 
    };
  }
}
