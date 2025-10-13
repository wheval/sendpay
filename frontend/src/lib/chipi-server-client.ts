import { ChipiServerSDK } from "@chipi-stack/backend";

export const chipiServerClient = new ChipiServerSDK({
  apiPublicKey: process.env.CHIPI_PUBLIC_KEY!,
  apiSecretKey: process.env.CHIPI_SECRET_KEY!,
});


