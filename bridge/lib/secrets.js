import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

const SSM_PATH = process.env.SSM_PATH ?? "/1dotdev/prod";

const PARAMETERS = [
  "META_WA_TOKEN",
  "META_WA_PHONE_NUMBER_ID",
  "META_WA_BUSINESS_ACCOUNT_ID",
  "META_WEBHOOK_VERIFY_TOKEN",
  "META_APP_SECRET",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ALLOWED_WHATSAPP_NUMBERS",
  "ADMIN_WHATSAPP_NUMBERS",
];

export async function loadSecretsFromSsm() {
  if (!process.env.AWS_REGION) {
    console.log("AWS_REGION not set — skipping SSM load, using local .env only");
    return { loaded: 0 };
  }

  const ssm = new SSMClient({ region: process.env.AWS_REGION });
  const names = PARAMETERS.map(n => `${SSM_PATH}/${n}`);

  const chunks = [];
  for (let i = 0; i < names.length; i += 10) chunks.push(names.slice(i, i + 10));

  let loaded = 0;
  for (const chunk of chunks) {
    const resp = await ssm.send(new GetParametersCommand({ Names: chunk, WithDecryption: true }));
    for (const p of resp.Parameters ?? []) {
      const key = p.Name.slice(SSM_PATH.length + 1);
      process.env[key] = p.Value;
      loaded++;
    }
    if (resp.InvalidParameters?.length) {
      console.warn("SSM invalid parameters (missing?):", resp.InvalidParameters);
    }
  }
  console.log(`loaded ${loaded} parameters from SSM ${SSM_PATH}`);
  return { loaded };
}
