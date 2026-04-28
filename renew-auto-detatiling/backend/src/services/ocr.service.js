const prisma = require("../config/prisma");

/**
 * OCR Integration Module
 * Handles receipt data extraction and validation matching.
 */
class OcrService {
  /**
   * Process a receipt image (Placeholder for actual OCR logic)
   */
  async processReceipt(paymentId, imageUrl) {
    // In a real implementation, we would call AWS Textract or Google Vision here.
    // For now, we simulate extraction with mock data or just log the intent.
    
    console.log(`[OCR] Processing receipt for payment ${paymentId}: ${imageUrl}`);
    
    // Simulate some delay
    // await new Promise(r => setTimeout(r, 1000));

    return {
      extractedAmount: null,
      referenceNumber: null,
      extractedDate: null,
      confidence: 0,
      rawText: "OCR processing pending real API integration"
    };
  }

  /**
   * Validate extracted data against payment record
   */
  async validateOcrMatch(paymentId, ocrData) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) throw new Error("Payment not found");

    const amountMatch = ocrData.extractedAmount ? Number(ocrData.extractedAmount) === Number(payment.amount) : null;
    const refMatch = ocrData.referenceNumber ? ocrData.referenceNumber === payment.referenceNumber : null;

    const isMatch = amountMatch && refMatch;
    
    const mismatchDetails = [];
    if (amountMatch === false) mismatchDetails.push(`Amount mismatch: Extracted ${ocrData.extractedAmount} vs Input ${payment.amount}`);
    if (refMatch === false) mismatchDetails.push(`Reference mismatch: Extracted ${ocrData.referenceNumber} vs Input ${payment.referenceNumber}`);

    // Store OCR Result
    return await prisma.ocrResult.create({
      data: {
        paymentId,
        extractedAmount: ocrData.extractedAmount,
        referenceNumber: ocrData.referenceNumber,
        extractedDate: ocrData.extractedDate,
        confidence: ocrData.confidence,
        rawText: ocrData.rawText,
        isMatch,
        status: isMatch ? "MATCH" : "MISMATCH",
        mismatchDetails: mismatchDetails.join("; ")
      }
    });
  }
}

module.exports = new OcrService();
