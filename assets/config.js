// Public Supabase settings (anon/publishable key is safe in the browser; data is protected by Row Level Security).
window.SB_URL = 'https://oiousqgzqcjanikglkxl.supabase.co';
window.SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pb3VzcWd6cWNqYW5pa2dsa3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTI3NjEsImV4cCI6MjEwNzg4ODc2MX0.1xcTKCcgQPs5Xw-P_Rxq3rj9k3BdewGTElYZTMVsqIE';
window.sb = window.supabase.createClient(window.SB_URL, window.SB_ANON);
