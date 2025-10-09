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

router.get('/.well-known/jwks.json', (_req, res) => {
  // First try explicit JWKS JSON
  const jwksJson = process.env.JWT_JWKS_JSON;
  if (jwksJson) {
    try {
      const parsed = JSON.parse(jwksJson);
      return res.json(parsed);
    } catch {
      return res.status(500).json({ error: 'Invalid JWT_JWKS_JSON' });
    }
  }

  // Then try explicit JWK
  const pub = process.env.JWT_PUBLIC_JWK;
  if (pub) {
    try {
      const key = JSON.parse(pub);
      return res.json({ keys: [key] });
    } catch {
      return res.status(500).json({ error: 'Invalid JWT_PUBLIC_JWK' });
    }
  }

  // Finally, try to convert PEM to JWK
  const publicKeyPem = process.env.JWT_PUBLIC_KEY_PEM;
  if (publicKeyPem) {
    try {
      const jwk = pemToJwk(publicKeyPem);
      if (jwk) {
        return res.json({ keys: [jwk] });
      }
    } catch (error) {
      console.error('Error generating JWK from PEM:', error);
    }
  }

  return res.status(500).json({ 
    error: 'JWKS not configured. Set JWT_JWKS_JSON, JWT_PUBLIC_JWK, or JWT_PUBLIC_KEY_PEM.' 
  });
});

export { router as jwksRoutes };


