import './env.js';

console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing');
console.log('PORT:', process.env.PORT);
console.log('HOST:', process.env.HOST);
