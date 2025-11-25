import { createClient } from '@supabase/supabase-js';

// Credentials provided by the user
const SUPABASE_URL = 'https://jpwuwfikpbrhcggdkjri.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwd3V3ZmlrcGJyaGNnZ2RranJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NDU4MDYsImV4cCI6MjA3OTEyMTgwNn0.NGPlRShg6CmdacSSy_2P9wACSfRgStk8Xhex11k-jWc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
