# File Upload Setup Guide

## Overview
This application now supports file uploads to Supabase storage, which are then made available to Stagehand for automated form filling.

## Prerequisites
1. A Supabase project with storage enabled
2. A storage bucket named "resumes" (or update the code to use your preferred bucket name)

## Environment Variables
Add these to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

## Supabase Setup Steps

### 1. Create Storage Bucket
1. Go to your Supabase dashboard
2. Navigate to Storage → Buckets
3. Create a new bucket named "resumes"
4. Set the bucket to public (or configure RLS policies as needed)

### 2. Configure Storage Policies
If you want to restrict access, you can add RLS policies. For public access, you can use:

```sql
-- Allow public read access to resumes
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'resumes');

-- Allow authenticated uploads (if needed)
CREATE POLICY "Authenticated Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes');
```

### 3. Get API Keys
1. Go to Settings → API in your Supabase dashboard
2. Copy the Project URL (for `NEXT_PUBLIC_SUPABASE_URL`)
3. Copy the service_role key (for `SUPABASE_SERVICE_ROLE_KEY`)

## ⚠️ Important: Supabase API Key Changes

Supabase is introducing new API key formats to improve security and developer experience. According to their [announcement](https://github.com/orgs/supabase/discussions/29260), here's what you need to know:

### Current Keys (Legacy - Still Working)
- `anon` key (JWT-based)
- `service_role` key (JWT-based)

### New Keys (Recommended)
- `sb_publishable_...` (replaces anon key)
- `sb_secret_...` (replaces service_role key)

### Migration Timeline
- **June 2025**: Early preview available (opt-in)
- **July 2025**: Full feature launch
- **November 2025**: Monthly reminders to migrate
- **Late 2026**: Legacy keys will be removed

### How to Use New Keys
You can opt-in to the new API keys in your Supabase dashboard. The new keys work as drop-in replacements:

```env
# New format (recommended)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_new_secret_key_here

# Legacy format (still works until late 2026)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_legacy_service_role_key_here
```

**Note**: The new `sb_secret_...` key provides the same elevated privileges as the current `service_role` key, so it's safe to use for backend operations like file uploads.

## How It Works

1. **Frontend**: User selects a PDF file using the paperclip button
2. **Upload**: File is uploaded to Supabase storage via `/api/upload`
3. **Stagehand Integration**: The public URL is sent to the backend API
4. **Automation**: Stagehand downloads the file and uploads it to web forms

## File Validation
- Only PDF files are accepted
- Maximum file size: 10MB
- Files are stored with unique timestamps to prevent conflicts

## Security Notes
- The service role key (legacy or new) has full access to your Supabase project
- Consider using a more restricted key for production
- Files are stored in a public bucket by default
- **Recommendation**: Migrate to the new `sb_secret_...` format when possible for better security features
