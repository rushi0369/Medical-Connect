import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

// A setting left blank in .env counts as not set.
const optionalText = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
    // Atlas connection strings often omit the database name, which would silently
    // store everything in a database called "test".
    .regex(
      /^mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/,
      'must include the database name, like ...mongodb.net/medicare?retryWrites=true',
    ),
  // Uses another database on the same server. Testing uses this to keep real data safe.
  MONGODB_DB_NAME: optionalText,
  JWT_SECRET: z.string().min(32, 'must be a random value of at least 32 characters'),
  // Reduced to its origin because CORS compares origins, so a stray trailing
  // slash in .env would otherwise block every browser request.
  CLIENT_URL: z.url('must be a full URL such as http://localhost:5173').transform((url) => new URL(url).origin),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  // Used from Phase 5 (road distance calculation).
  GOOGLE_MAPS_SERVER_API_KEY: optionalText,
  // Sending email. Without SMTP_HOST, development prints emails in the backend window.
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  EMAIL_FROM: z.string().default('MediCare <no-reply@medicare.local>'),
  // UPI through Razorpay. Leave blank and only cash on delivery is offered.
  RAZORPAY_KEY_ID: optionalText,
  RAZORPAY_KEY_SECRET: optionalText,
  RAZORPAY_WEBHOOK_SECRET: optionalText,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\nThe backend cannot start because backend/.env has a problem:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nCopy .env.example to .env if you have not yet, then fix the values above.');
  console.error(
    'To generate a JWT_SECRET, run: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n',
  );
  process.exit(1);
}

export const env = parsed.data;
