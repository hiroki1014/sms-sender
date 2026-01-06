import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('AUTH_PASSWORD', 'testpassword123')
vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest123')
vi.stubEnv('TWILIO_AUTH_TOKEN', 'test_auth_token')
vi.stubEnv('TWILIO_PHONE_NUMBER', '+15551234567')
vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_SECRET_KEY', 'test_secret_key')
