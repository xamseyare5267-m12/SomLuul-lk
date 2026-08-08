-- =========================================================================
-- BASE POSTGRESQL DATABASE SCHEMA & SECURITY RULES
-- File Hub Platform
-- Copy and paste this file into your Supabase SQL Query Editor.
-- =========================================================================

-- 1. PROFILES TABLE definition
-- Stores additional metadata linked to user authentication records
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar TEXT,
  role TEXT CHECK (role IN ('normal', 'admin')) DEFAULT 'normal',
  blocked BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. FILES METADATA TABLE definition
-- Records uploaded files and links them to owner profiles
CREATE TABLE public.files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- ROW LEVEL SECURITY POLICIES
-- =========================================================================

-- --- PROFILES TABLE POLICIES ---

-- Rule: Users can read their own profiles
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- Rule: Users can update their own profiles
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Rule: Administrators can read any user profile
CREATE POLICY "Admins can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Rule: Administrators can update (block/unblock) any user profile
CREATE POLICY "Admins can update any profile" 
  ON public.profiles FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Rule: Administrators can delete user profiles
CREATE POLICY "Admins can delete any profile" 
  ON public.profiles FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- --- FILES TABLE POLICIES ---

-- Rule: Normal users can only see their own files
CREATE POLICY "Users can view own files" 
  ON public.files FOR SELECT 
  USING (auth.uid() = user_id);

-- Rule: Normal users can only insert (upload) files belonging to themselves
CREATE POLICY "Users can upload own files" 
  ON public.files FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Rule: Normal users can only delete their own files
CREATE POLICY "Users can delete own files" 
  ON public.files FOR DELETE 
  USING (auth.uid() = user_id);

-- Rule: Administrators can read any uploaded file record
CREATE POLICY "Admins can view all files" 
  ON public.files FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Rule: Administrators can force-delete any uploaded file record
CREATE POLICY "Admins can delete any file" 
  ON public.files FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- =========================================================================
-- DATABASE FUNCTIONS & TRIGGERS
-- Automatically create profile records when new users sign up via Supabase Auth
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, blocked)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    'normal',
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================================
-- SUPABASE STORAGE CONFIGURATION
-- Run this to configure the 'files-bucket' permissions under Storage Policies
-- =========================================================================

-- Create storage bucket if not already present
-- Note: It is safer to create 'files-bucket' through the Supabase Dashboard GUI,
-- but the following SQL establishes correct RLS rules if run in SQL Editor.

-- Users can upload files inside files-bucket under their own user_id folder:
-- path format: 'files-bucket/{user_id}/{filename}'
