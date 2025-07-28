export default async function handler(request, response) {
  try {
    // This dummy engine ignores the request and just sends a success message.
    const txId = "dummy-transaction-id-12345";
    return response.status(200).json({ success: true, txId: txId });
  } catch (error) {
    return response.status(500).json({ success: false, error:
