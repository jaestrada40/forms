import { config } from 'dotenv';
import { rootSecret } from './keys.js';

config({ path: ['.env.local', '.env'] });

// Fail at startup, not at the first login, when the root secret is missing or too short
rootSecret();
