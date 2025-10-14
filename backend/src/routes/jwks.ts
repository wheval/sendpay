import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// Helper: build JWK from PEM public key (RS256)
function pemToJwk(pem: string, kid: string = 'sendpay-key-1') {
  try {
    const publicKey = crypto.createPublicKey(pem);
    const jwk = publicKey.export({ format: 'jwk' }) as any;
    
    return {
      kty: 'RSA',
      use: 'sig',
      kid: kid,
      alg: 'RS256',
      n: jwk.n,
      e: jwk.e
    };
  } catch (error) {
    console.error('Error converting PEM to JWK:', error);
    return null;
  }
}

// Helper: get the JWK from any source
function getJwk() {
  // First try explicit JWKS JSON
  const jwksJson = process.env.JWT_JWKS_JSON;
  if (jwksJson) {
    try {
      const parsed = JSON.parse(jwksJson);
      if (parsed.keys && parsed.keys.length > 0) {
        return parsed.keys[0];
      }
    } catch {
      throw new Error('Invalid JWT_JWKS_JSON');
    }
  }

  // Then try explicit JWK
  const pub = process.env.JWT_PUBLIC_JWK;
  if (pub) {
    try {
      return JSON.parse(pub);
    } catch {
      throw new Error('Invalid JWT_PUBLIC_JWK');
    }
  }

  // Finally, try to convert PEM to JWK
  const publicKeyPem = process.env.JWT_PUBLIC_KEY_PEM;
  if (publicKeyPem) {
    const jwk = pemToJwk(publicKeyPem);
    if (jwk) {
      return jwk;
    }
  }

  throw new Error('JWK not configured. Set JWT_JWKS_JSON, JWT_PUBLIC_JWK, or JWT_PUBLIC_KEY_PEM.');
}

// Single JWK endpoint (returns just the JWK object)
router.get('/.well-known/jwk.json', (_req, res) => {
  try {
    const jwk = getJwk();
    res.json(jwk);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as jwksRoutes };


