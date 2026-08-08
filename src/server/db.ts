import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import { Profile, FileMetadata, UserRole, UserStats, AdminStats, Post, ActivityLog, Story, AppNotification, ChatRoom, ChatMessage } from '../types.js';

let gcsStorageForDb: any = null;
let gcsBucketForDb: any = null;
const gcsBucketName = process.env.GCS_BUCKET_NAME;
if (gcsBucketName) {
  try {
    gcsStorageForDb = new Storage({
      projectId: process.env.GCP_PROJECT_ID || undefined,
    });
    gcsBucketForDb = gcsStorageForDb.bucket(gcsBucketName);
  } catch (err) {
    console.error('[FileHub DB GCS] Failed to initialize GCS client inside db.ts:', err);
  }
}

// Define the DB structure
interface DBCredential {
  userId: string;
  passwordHash: string; // Simple base64/hash for our full-stack container demonstration
}

interface DBStructure {
  profiles: Profile[];
  files: FileMetadata[];
  credentials: DBCredential[];
  posts?: Post[];
  stories?: Story[];
  system_notice?: string;
  activity_logs?: ActivityLog[];
  remote_config?: {
    secretClickTarget: number;
    dotClickTarget: number;
    editClickTarget: number;
    invisibleAreaLocation: string;
    dotLocation: string;
    appName: string;
    appLogo: string;
  };
  feature_flags?: {
    enableAiModeration: boolean;
    enableSpamDetection: boolean;
    enableAbuseDetection: boolean;
    enableVideoCalls: boolean;
    enablePaidSubscriptions: boolean;
  };
  notifications?: AppNotification[];
  chatRooms?: ChatRoom[];
  chatMessages?: ChatMessage[];
}

// Safely determine if the data directory is writable, falling back to /tmp/data in read-only environments
let DATA_DIR = path.join(process.cwd(), 'data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const testFile = path.join(DATA_DIR, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
} catch (err) {
  console.warn('[FileHub DB] Local data directory is not writable. Falling back to /tmp/data');
  DATA_DIR = path.join('/tmp', 'data');
}
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure database directory and file exist
function initializeDB(): DBStructure {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    // Try copying precompiled/pre-seeded db.json from project's repo directory if it exists
    const repoDbPath = path.join(process.cwd(), 'data', 'db.json');
    if (fs.existsSync(repoDbPath)) {
      try {
        fs.copyFileSync(repoDbPath, DB_FILE);
        const rawData = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(rawData);
      } catch (err) {
        console.error('[FileHub DB] Failed to copy repo db.json to writable DB_FILE:', err);
      }
    }

    const initialData: DBStructure = {
      profiles: [
        {
          id: 'admin-id',
          email: 'admin@filehub.com',
          first_name: 'System',
          last_name: 'Administrator',
          avatar: null,
          role: 'admin',
          blocked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      files: [],
      credentials: [
        {
          userId: 'admin-id',
          passwordHash: Buffer.from('admin123').toString('base64'), // Simple hash for illustration
        },
      ],
      posts: [],
      stories: [],
      activity_logs: [
        {
          id: 'log_init',
          user_id: 'admin-id',
          user_email: 'admin@filehub.com',
          action: 'upload',
          details: 'System database initialized successfully.',
          created_at: new Date().toISOString()
        }
      ],
      remote_config: {
        secretClickTarget: 7,
        dotClickTarget: 30,
        editClickTarget: 5,
        invisibleAreaLocation: 'left-of-logo',
        dotLocation: 'top-right',
        appName: 'SomLuul',
        appLogo: '/somluul_logo.png'
      },
      feature_flags: {
        enableAiModeration: true,
        enableSpamDetection: true,
        enableAbuseDetection: true,
        enableVideoCalls: true,
        enablePaidSubscriptions: true
      },
      notifications: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }

  try {
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(rawData);
    let needWrite = false;
    if (!parsed.posts) {
      parsed.posts = [];
      needWrite = true;
    }
    if (!parsed.stories) {
      parsed.stories = [];
      needWrite = true;
    }
    if (!parsed.activity_logs) {
      parsed.activity_logs = [];
      needWrite = true;
    }
    if (!parsed.remote_config) {
      parsed.remote_config = {
        secretClickTarget: 7,
        dotClickTarget: 30,
        editClickTarget: 5,
        invisibleAreaLocation: 'left-of-logo',
        dotLocation: 'top-right',
        appName: 'SomLuul',
        appLogo: '/somluul_logo.png'
      };
      needWrite = true;
    }
    if (!parsed.feature_flags) {
      parsed.feature_flags = {
        enableAiModeration: true,
        enableSpamDetection: true,
        enableAbuseDetection: true,
        enableVideoCalls: true,
        enablePaidSubscriptions: true
      };
      needWrite = true;
    }
    if (!parsed.notifications) {
      parsed.notifications = [];
      needWrite = true;
    }
    if (needWrite) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch (error) {
    console.error('Error reading DB, resetting...', error);
    const emptyData: DBStructure = { profiles: [], files: [], credentials: [], posts: [], activity_logs: [] };
    return emptyData;
  }
}

// Read database
export function readDB(): DBStructure {
  return initializeDB();
}

function getCleanSupabaseBaseUrl(url: string | undefined): string {
  if (!url) return '';
  try {
    if (url.includes('://')) {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch (e) {
    // ignore and fallback
  }
  let cleaned = url.replace(/\/rest\/v1\/?$/, '');
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

// Sync database to Supabase Storage
export async function syncDbToSupabase(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return;
  }
  try {
    const cleanUrl = getCleanSupabaseBaseUrl(supabaseUrl);
    if (!fs.existsSync(DB_FILE)) return;

    const fileContent = fs.readFileSync(DB_FILE);
    
    // Upload with x-upsert header to overwrite existing
    await axios.post(`${cleanUrl}/storage/v1/object/files-bucket/db.json`, fileContent, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      },
      timeout: 3000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    console.log('[Supabase DB Sync] Successfully backed up db.json to Supabase storage.');
  } catch (err: any) {
    if (err.response?.status === 404 || err?.message?.includes('does not exist')) {
      console.log('[Supabase DB Sync] Supabase storage bucket not found. Using local database.');
    } else {
      console.log('[Supabase DB Sync] Backup notice:', err.message || 'Unknown status');
    }
  }
}

// Sync database from Supabase Storage
export async function syncDbFromSupabase(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  try {
    const cleanUrl = getCleanSupabaseBaseUrl(supabaseUrl);
    
    // Check/create bucket first
    try {
      await axios.post(`${cleanUrl}/storage/v1/bucket`, {
        id: 'files-bucket',
        name: 'files-bucket',
        public: false
      }, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        },
        timeout: 2000
      });
    } catch (bucketErr: any) {
      // Bucket already exists or failed, ignore
    }

    // Try downloading db.json
    const response = await axios.get(`${cleanUrl}/storage/v1/object/authenticated/files-bucket/db.json`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      timeout: 3000,
      responseType: 'arraybuffer'
    });

    if (response.status === 200 && response.data) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, Buffer.from(response.data));
      console.log('[Supabase DB Sync] Successfully restored db.json from Supabase storage.');
    }
  } catch (err: any) {
    if (err.response?.status === 404 || err?.message?.includes('does not exist')) {
      console.log('[Supabase DB Sync] No remote backup found yet. Local database active.');
    } else {
      console.log('[Supabase DB Sync] Notice:', err.message || 'Unknown status');
    }
  }
}

// Write database
export function writeDB(data: DBStructure): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');

  // Push backup to GCS if configured
  if (gcsBucketForDb) {
    gcsBucketForDb.upload(DB_FILE, {
      destination: 'db.json',
      metadata: {
        contentType: 'application/json',
      }
    }).then(() => {
      console.log('[FileHub DB GCS] Successfully synchronized db.json backup to GCS.');
    }).catch((gcsErr: any) => {
      if (gcsErr?.code === 404 || gcsErr?.message?.includes('does not exist')) {
        console.log('[FileHub DB GCS] GCS bucket uninitialized. Local database active.');
      } else {
        console.log('[FileHub DB GCS] GCS sync notice:', gcsErr?.message || gcsErr);
      }
    });
  }

  // Push backup to Supabase if configured
  syncDbToSupabase();
}

// Generate unique ID helper
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Hash password helper using bcryptjs
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

// Verify password helper with backward compatibility for legacy base64 hashes
export function verifyPassword(password: string, hash: string): boolean {
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(password, hash);
    } catch (e) {
      return false;
    }
  }
  // Fallback to legacy base64 hash
  return Buffer.from(password).toString('base64') === hash;
}

// AUTHENTICATION UTILITIES
export function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: UserRole = 'normal',
  additionalFields?: Partial<Profile>
): { success: boolean; message: string; user?: Profile } {
  const db = readDB();
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user exists
  if (db.profiles.some(p => p.email === normalizedEmail)) {
    if (normalizedEmail === 'xamseyare5267@gmail.com') {
      const existingUser = db.profiles.find(p => p.email === normalizedEmail);
      if (existingUser) {
        db.profiles = db.profiles.filter(p => p.email !== normalizedEmail);
        db.credentials = db.credentials.filter(c => c.userId !== existingUser.id);
      }
    } else {
      return { success: false, message: 'Email already registered.' };
    }
  }

  const userId = generateId();
  // Force xamseyare5267@gmail.com to be admin (Owner)
  const isOwner = normalizedEmail === 'xamseyare5267@gmail.com';
  const finalRole = isOwner ? 'admin' : role;
  
  const newUser: Profile = {
    id: userId,
    email: normalizedEmail,
    first_name: isOwner ? 'Mohamed' : firstName,
    last_name: isOwner ? 'Mohamud Hassan' : lastName,
    avatar: null,
    role: finalRole,
    blocked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    phone: isOwner ? '615666561' : undefined,
    bio: isOwner ? 'SomLuul Active Member' : undefined,
    login_method: 'email',
    devices: [],
    ...additionalFields
  };

  db.profiles.push(newUser);
  db.credentials.push({
    userId,
    passwordHash: hashPassword(password),
  });

  writeDB(db);
  return { success: true, message: 'Registration successful!', user: newUser };
}

export function authenticateUser(email: string, password: string): { success: boolean; message: string; user?: Profile } {
  const db = readDB();
  const normalizedEmail = email.toLowerCase().trim();

  const user = db.profiles.find(p => p.email === normalizedEmail);
  if (!user) {
    return { success: false, message: 'Invalid email or password.' };
  }

  // Force xamseyare5267@gmail.com to be admin role and unblocked
  if (normalizedEmail === 'xamseyare5267@gmail.com') {
    let changed = false;
    if (user.role !== 'admin') {
      user.role = 'admin';
      changed = true;
    }
    if (user.blocked) {
      user.blocked = false;
      changed = true;
    }
    if (changed) {
      writeDB(db);
    }
  }

  if (user.blocked) {
    return { success: false, message: 'Your account has been blocked by an administrator.' };
  }

  const credential = db.credentials.find(c => c.userId === user.id);
  if (!credential || !verifyPassword(password, credential.passwordHash)) {
    return { success: false, message: 'Invalid email or password.' };
  }

  // Update last login
  user.last_login = new Date().toISOString();
  writeDB(db);

  return { success: true, message: 'Login successful!', user };
}

export function resetUserPassword(email: string, newPassword: string): { success: boolean; message: string } {
  const db = readDB();
  const normalizedEmail = email.toLowerCase().trim();

  const user = db.profiles.find(p => p.email === normalizedEmail);
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  const credential = db.credentials.find(c => c.userId === user.id);
  if (credential) {
    credential.passwordHash = hashPassword(newPassword);
    user.updated_at = new Date().toISOString();
    writeDB(db);
    return { success: true, message: 'Password reset successful!' };
  }

  return { success: false, message: 'Could not reset password.' };
}

// Find or Create user for Social logins (Google, Facebook, Apple)
export function findOrCreateSocialUser(
  method: 'google' | 'facebook' | 'apple',
  email: string,
  firstName: string,
  lastName: string,
  avatar: string | null
): Profile {
  const db = readDB();
  const normalizedEmail = email.toLowerCase().trim();

  let user = db.profiles.find(p => p.email === normalizedEmail);
  
  if (user) {
    // Update existing user's last login and login method if not set
    user.last_login = new Date().toISOString();
    if (!user.login_method) user.login_method = method;
    if (avatar && !user.avatar) user.avatar = avatar;
    writeDB(db);
    return user;
  }

  // Create new social user
  const userId = generateId();
  const isOwner = normalizedEmail === 'xamseyare5267@gmail.com';
  
  const newUser: Profile = {
    id: userId,
    email: normalizedEmail,
    first_name: isOwner ? 'Mohamed' : firstName,
    last_name: isOwner ? 'Mohamud Hassan' : lastName,
    avatar: avatar || null,
    role: isOwner ? 'admin' : 'normal',
    blocked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    login_method: method,
    email_verified: true, // Social logins are pre-verified
    last_login: new Date().toISOString(),
    devices: [],
    username: normalizedEmail.split('@')[0] + Math.floor(100 + Math.random() * 900),
    is_username_custom: false
  };

  db.profiles.push(newUser);
  // Add an empty or random credential hash just to satisfy constraint
  db.credentials.push({
    userId,
    passwordHash: hashPassword(Math.random().toString(36)),
  });

  writeDB(db);
  return newUser;
}

// Track logged-in devices
export function trackUserDevice(
  userId: string,
  device: { id: string; name: string; ip: string; last_active: string; location: string }
): void {
  const db = readDB();
  const user = db.profiles.find(p => p.id === userId);
  if (user) {
    if (!user.devices) user.devices = [];
    
    // Remove if there's an existing session for this same device ID
    user.devices = user.devices.filter(d => d.id !== device.id);
    
    // Add new device session
    user.devices.push(device);
    writeDB(db);
  }
}

// Remove specific device session
export function removeUserDevice(userId: string, deviceId: string): void {
  const db = readDB();
  const user = db.profiles.find(p => p.id === userId);
  if (user && user.devices) {
    user.devices = user.devices.filter(d => d.id !== deviceId);
    writeDB(db);
  }
}

// Logout from all devices
export function removeAllUserDevices(userId: string): void {
  const db = readDB();
  const user = db.profiles.find(p => p.id === userId);
  if (user) {
    user.devices = [];
    writeDB(db);
  }
}

// PROFILE UTILITIES
export function updateProfile(
  userId: string,
  updates: Partial<Profile>
): { success: boolean; user?: Profile } {
  const db = readDB();
  const userIndex = db.profiles.findIndex(p => p.id === userId);

  if (userIndex === -1) {
    return { success: false };
  }

  db.profiles[userIndex] = {
    ...db.profiles[userIndex],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const updatedUser = db.profiles[userIndex];

  // Synchronize post author avatar and name across all user posts
  if (updates.avatar || updates.first_name || updates.last_name) {
    const handlePrefix = (updatedUser.email || '').split('@')[0].toLowerCase();
    const customHandle = (updatedUser.username || '').toLowerCase();

    if (db.posts) {
      db.posts.forEach(post => {
        const postHandle = (post.author?.handle || '').toLowerCase();
        if (
          postHandle === handlePrefix ||
          (customHandle && postHandle === customHandle) ||
          post.author?.name === `${updatedUser.first_name} ${updatedUser.last_name}`
        ) {
          if (updates.avatar) post.author.avatar = updates.avatar;
          if (updates.first_name || updates.last_name) {
            post.author.name = `${updatedUser.first_name} ${updatedUser.last_name}`;
          }
        }
      });
    }
  }

  writeDB(db);
  return { success: true, user: db.profiles[userIndex] };
}

export function toggleFollowUser(
  followerId: string,
  targetId: string
): { success: boolean; isFollowing: boolean; follower?: Profile; target?: Profile } {
  const db = readDB();
  const followerIndex = db.profiles.findIndex(p => p.id === followerId);
  const targetIndex = db.profiles.findIndex(p => p.id === targetId);

  if (followerIndex === -1 || targetIndex === -1) {
    return { success: false, isFollowing: false };
  }

  const follower = db.profiles[followerIndex];
  const target = db.profiles[targetIndex];

  if (!follower.following) follower.following = [];
  if (!target.followers) target.followers = [];

  const followingIndex = follower.following.indexOf(targetId);
  let isFollowing = false;

  if (followingIndex > -1) {
    // Unfollow
    follower.following.splice(followingIndex, 1);
    const followerIdxInTarget = target.followers.indexOf(followerId);
    if (followerIdxInTarget > -1) {
      target.followers.splice(followerIdxInTarget, 1);
    }
    isFollowing = false;
  } else {
    // Follow
    follower.following.push(targetId);
    target.followers.push(followerId);
    isFollowing = true;
  }

  // Update counts
  follower.followersCount = follower.followers ? follower.followers.length : 0;
  follower.followingCount = follower.following ? follower.following.length : 0;
  target.followersCount = target.followers ? target.followers.length : 0;
  target.followingCount = target.following ? target.following.length : 0;

  follower.updated_at = new Date().toISOString();
  target.updated_at = new Date().toISOString();

  writeDB(db);
  return { success: true, isFollowing, follower, target };
}

export function toggleBlockUser(userId: string): { success: boolean; blocked: boolean } {
  const db = readDB();
  const user = db.profiles.find(p => p.id === userId);

  if (!user) {
    return { success: false, blocked: false };
  }

  user.blocked = !user.blocked;
  user.updated_at = new Date().toISOString();
  writeDB(db);
  return { success: true, blocked: user.blocked };
}

export function deleteUserAccount(userId: string): boolean {
  const db = readDB();
  const initialCount = db.profiles.length;

  db.profiles = db.profiles.filter(p => p.id !== userId);
  db.credentials = db.credentials.filter(c => c.userId !== userId);

  // Also delete their files
  const userFiles = db.files.filter(f => f.user_id === userId);
  userFiles.forEach(f => {
    try {
      const fullPath = path.join(process.cwd(), f.storage_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (e) {
      console.error('Error deleting physical file', e);
    }
  });

  db.files = db.files.filter(f => f.user_id !== userId);
  writeDB(db);

  return db.profiles.length < initialCount;
}

// FILE UTILITIES
export function saveFileRecord(file: Omit<FileMetadata, 'id' | 'created_at'>): FileMetadata {
  const db = readDB();
  const newFile: FileMetadata = {
    ...file,
    id: generateId(),
    created_at: new Date().toISOString(),
  };

  db.files.push(newFile);
  writeDB(db);
  return newFile;
}

export function deleteFileRecord(fileId: string): { success: boolean; file?: FileMetadata } {
  const db = readDB();
  const fileIndex = db.files.findIndex(f => f.id === fileId);

  if (fileIndex === -1) {
    return { success: false };
  }

  const file = db.files[fileIndex];

  // Delete physical file
  try {
    const fullPath = path.join(process.cwd(), file.storage_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error('Physical file deletion error', error);
  }

  db.files.splice(fileIndex, 1);
  writeDB(db);
  return { success: true, file };
}

export function deleteUserFiles(userId: string): number {
  const db = readDB();
  const filesToDelete = db.files.filter(f => f.user_id === userId);

  filesToDelete.forEach(file => {
    try {
      const fullPath = path.join(process.cwd(), file.storage_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (e) {
      console.error('Error deleting physical file', e);
    }
  });

  const initialCount = db.files.length;
  db.files = db.files.filter(f => f.user_id !== userId);
  writeDB(db);

  return initialCount - db.files.length;
}

// STATS UTILITIES
export function getUserStats(userId: string): UserStats {
  const db = readDB();
  const userFiles = db.files.filter(f => f.user_id === userId);

  const totalFiles = userFiles.length;
  const totalSize = userFiles.reduce((acc, f) => acc + f.file_size, 0);

  const imagesCount = userFiles.filter(f => f.mime_type.startsWith('image/')).length;
  const videosCount = userFiles.filter(f => f.mime_type.startsWith('video/')).length;
  const documentsCount = totalFiles - imagesCount - videosCount;

  // Staggered recent uploads (last 5)
  const recentUploads = [...userFiles]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return {
    totalFiles,
    totalSize,
    imagesCount,
    documentsCount,
    videosCount,
    recentUploads,
  };
}

export function getAdminStats(): AdminStats {
  const db = readDB();
  const totalUsers = db.profiles.filter(p => p.role !== 'admin').length;
  const blockedUsers = db.profiles.filter(p => p.blocked && p.role !== 'admin').length;
  const totalFiles = db.files.length;
  const totalSize = db.files.reduce((acc, f) => acc + f.file_size, 0);

  const recentUsers = [...db.profiles]
    .filter(p => p.role !== 'admin')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const recentUploads = [...db.files]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return {
    totalUsers,
    blockedUsers,
    totalFiles,
    totalSize,
    recentUsers,
    recentUploads,
  };
}

// ACTIVITY LOGGING UTILITIES
export function logActivity(
  userId: string,
  userEmail: string,
  action: 'upload' | 'download' | 'preview' | 'delete' | 'profile_update' | 'follow' | 'block' | 'unblock',
  details: string
): ActivityLog {
  const db = readDB();
  if (!db.activity_logs) {
    db.activity_logs = [];
  }

  const newLog: ActivityLog = {
    id: generateId(),
    user_id: userId,
    user_email: userEmail,
    action,
    details,
    created_at: new Date().toISOString(),
  };

  db.activity_logs.push(newLog);
  writeDB(db);
  return newLog;
}

export function getActivityLogs(userId?: string): ActivityLog[] {
  const db = readDB();
  const logs = db.activity_logs || [];
  
  if (userId) {
    return logs.filter(log => log.user_id === userId);
  }
  return logs;
}

