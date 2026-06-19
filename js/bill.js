/**
 * @file js/bill.js
 * @description Manages automatic HTML Canvas-drawn invoice/receipt generation, starting/ending segments bracket filter, and download handlers.
 */

import { state } from './state.js';
import { numberToWords } from './utils.js';

/**
 * Renders and downloads a graphic bill/invoice using an HTML Canvas element layout.
 * @param {string} key - Database key matching transaction item.
 */
export function downloadBill(key) {
    const packet = state.allPackets.find(p => p.key === key);
    if (!packet) return;
    if (packet.entryType !== 'courier' && packet.entryType !== 'ticketing') return;

    const canvas = document.createElement('canvas');
    canvas.width = 2417;
    canvas.height = 1157;
    const ctx = canvas.getContext('2d');
    const logo = new Image();
    logo.src = 'fourdirection.png';
    
    logo.onload = () => {
        // Draw background template image onto canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(logo, 0, 0, 2417, 1157);
        
        // Setup font properties
        ctx.fillStyle = '#000000';
        ctx.font = ' 44px Arial';
        ctx.fillText(`${packet.recNo}`, 250, 397);
        ctx.fillText(`${packet.date}`, 1890, 394);

        if (packet.entryType === 'courier') {
            ctx.fillText(`${packet.senderName}`, 570, 490);
            ctx.fillText(`${packet.senderContact}`, 1450, 490);
            ctx.fillText(`${packet.senderAddress}`, 320, 585);
            ctx.fillText(`${packet.receiverAddress}`, 1158, 586);
            ctx.fillText(`${packet.billItem}    ${packet.trackingNumber}`, 150, 865);
        } else if (packet.entryType === 'ticketing') {
            ctx.fillText(`${packet.passengerName}`, 570, 490);
            ctx.fillText(`${packet.passengerContact}`, 1450, 490);

            let fromText = '';
            let toText = '';
            if (packet.flightSegments && packet.flightSegments.length > 0) {
                // Filters airport code strictly inside brackets: e.g. "Abu Dhabi Int'l Airport (AUH)" -> "AUH"
                const extractBracketContent = (str) => {
                    if (!str) return '';
                    const match = str.match(/\(([^)]+)\)/);
                    return match ? match[1].trim() : str.trim();
                };

                const firstSegment = packet.flightSegments[0];
                const lastSegment = packet.flightSegments[packet.flightSegments.length - 1];
                fromText = extractBracketContent(firstSegment.depAirport);
                toText = extractBracketContent(lastSegment.arrAirport);
            }

            ctx.fillText(fromText, 320, 585);
            ctx.fillText(toText, 1158, 586);
            
            const pnrText = packet.pnrNumber || '';
            const remarksText = packet.remarks || '';
            ctx.fillText(`${pnrText}    ${remarksText}`, 150, 865);
        }

        // Draw pricing details and text word representation
        ctx.font = 'bold 58px Arial';
        ctx.fillText(`${packet.price}.00`, 230, 995);
        
        const amountInWords = numberToWords(packet.price);
        ctx.font = '44px Arial';
        ctx.fillText(`${amountInWords} rupees only`, 530, 677);
        
        // Export to binary file and download
        canvas.toBlob((blob) => {
            const link = document.createElement('a');
            link.download = `bill_${packet.recNo}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
        });
    };
}

// Map function to window context for inline HTML references
window.downloadBill = downloadBill;
