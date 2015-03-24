import crypto from 'crypto';

export function isRequestAuthorized(secret, payload, headerSignature) {
    let hmac = crypto.createHmac('sha1', secret);
    hmac.update(JSON.stringify(payload));
    let calculatedSignature = `sha1=${hmac.digest('hex')}`;
    return (headerSignature === calculatedSignature) ? true : false;
}
