import { createPublicKey, createSecretKey, type KeyObject } from 'crypto'
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { Cache, toArray } from 'txstate-utils'

export function cleanPem (secretOrPem: string | undefined) {
  return secretOrPem?.replace(/(-+BEGIN [\w\s]+ KEY-+)\s*(.*?)\s*(-+END [\w\s]+ KEY-+)/, '$1\n$2\n$3')
}

class Authenticator {
  protected jwtVerifyKey: KeyObject | undefined
  protected issuerKeys = new Map<string, JWTVerifyGetKey | KeyObject>()
  protected issuerValidate = new Map<string, URL>()

  protected tokenCache = new Cache(async (token: string) => {
    let verifyKey: KeyObject | JWTVerifyGetKey | undefined = this.jwtVerifyKey
    try {
      const claims = decodeJwt(token)
      if (claims.iss && this.issuerKeys.has(claims.iss)) {
        verifyKey = this.issuerKeys.get(claims.iss)
        if (this.issuerValidate.has(claims.iss)) {
          const validateUrl = new URL(this.issuerValidate.get(claims.iss)!)
          validateUrl.searchParams.set('unifiedJwt', token)
          const resp = await fetch(validateUrl)
          const validate = await resp.json() as { valid: boolean }
          if (!validate.valid) return undefined
        }
      }
      if (!verifyKey) {
        console.info('Received token with issuer:', claims.iss, 'but JWT secret could not be found. The server may be misconfigured or the user may have presented a JWT from an untrusted issuer.')
        return undefined
      }
      const { payload } = await jwtVerify(token, verifyKey as any)
      return payload
    } catch (e: any) {
      // squelch errors about bad tokens, we can already see the 401 in the log
      if (e.code !== 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') console.error(e)
      return undefined
    }
  }, { freshseconds: 100 })

  constructor () {
    let secret = cleanPem(process.env.JWT_SECRET_VERIFY)
    if (secret != null) {
      this.jwtVerifyKey = createPublicKey(secret)
    } else {
      secret = cleanPem(process.env.JWT_SECRET)
      if (secret != null) {
        try {
          this.jwtVerifyKey = createPublicKey(secret)
        } catch (e: any) {
          console.info('JWT_SECRET was not a private key, treating it as symmetric.')
          this.jwtVerifyKey = createSecretKey(Buffer.from(secret, 'ascii'))
        }
      }
    }
    if (process.env.JWT_TRUSTED_ISSUERS) {
      const issuers = toArray(JSON.parse(process.env.JWT_TRUSTED_ISSUERS))
      for (const issuer of issuers) {
        if (issuer.url) {
          this.issuerKeys.set(issuer.iss, createRemoteJWKSet(new URL(issuer.url)))
          if (issuer.iss === 'unified-auth') {
            const validateUrl = new URL(issuer.url)
            validateUrl.pathname = '/validateToken'
            this.issuerValidate.set(issuer.iss, validateUrl)
          }
        } else if (issuer.publicKey) this.issuerKeys.set(issuer.iss, createPublicKey(issuer.publicKey))
        else if (issuer.secret) this.issuerKeys.set(issuer.iss, createSecretKey(Buffer.from(issuer.secret, 'ascii')))
      }
    }
  }

  async get (token: string) {
    return await this.tokenCache.get(token)
  }
}

export const authenticator = new Authenticator()
