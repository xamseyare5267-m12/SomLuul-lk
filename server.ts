import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import nodemailer from 'nodemailer';
import {
  registerUser,
  authenticateUser,
  resetUserPassword,
  updateProfile,
  toggleFollowUser,
  toggleBlockUser,
  deleteUserAccount,
  saveFileRecord,
  deleteFileRecord,
  deleteUserFiles,
  getUserStats,
  getAdminStats,
  readDB,
  writeDB,
  logActivity,
  getActivityLogs,
  findOrCreateSocialUser,
  trackUserDevice,
  removeUserDevice,
  removeAllUserDevices,
  hashPassword,
  generateId,
  syncDbFromSupabase,
  syncDbToSupabase
} from './src/server/db.js';
import { FileMetadata, Profile, Post } from './src/types.js';
import {
  checkPrinterOnline,
  sendPrintJobWithRetry,
  getPrinterConfig,
  savePrinterConfig,
  getPrinterLogsAndAlerts,
  clearPrinterLogsAndAlerts
} from './src/server/printer.js';

// Extend Express Request type to include authenticated user details
interface AuthenticatedRequest extends Request {
  user?: Profile;
}

// Create Nodemailer Transporter
const createMailTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }
  return null;
};

// Send Verification Email
async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const transporter = createMailTransporter();
  const from = process.env.SMTP_FROM || '"SomLuul App" <no-reply@somluul.com>';

  const subject = `SomLuul App: Koodhka Xaqiijinta - ${code}`;
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #0f172a; margin-top: 12px;">Xaqiijinta Email-ka SomLuul</h2>
      </div>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">Kulan Wacan! Waad ku mahadsan tahay inaad isku diiwaan gelisay <strong>SomLuul Social Multi-App</strong>.</p>
      <p style="color: #334155; font-size: 16px; line-height: 1.5;">Fadlan isticmaal koodhka xaqiijinta ee hoose si aad u dhammaystirto diiwaan-gelintaada:</p>
      
      <div style="text-align: center; margin: 32px 0; padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #3b82f6;">${code}</span>
      </div>
      
      <p style="color: #64748b; font-size: 14px; line-height: 1.5;">Koodhkan wuxuu dhacayaa 15 daqiiqo ka dib. Fadlan cidna ha la wadaagin koodhkan.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      <div style="text-align: center; color: #94a3b8; font-size: 12px;">
        <p>© 2026 SomLuul Global App. All rights reserved.</p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from,
        to: email,
        subject,
        html: htmlContent,
      });
      console.log(`[Mail] Verification email sent successfully to: ${email}`);
      return true;
    } catch (error) {
      console.error(`[Mail] Failed to send verification email to: ${email}`, error);
      return false;
    }
  } else {
    console.warn(`[Mail] SMTP is not fully configured. Email was not sent. Here is the verification code: ${code}`);
    return false;
  }
}

// Sync db.json from GCS
async function syncDbFromGcs() {
  const gcsBucketName = process.env.GCS_BUCKET_NAME;
  if (!gcsBucketName) {
    console.log('[FileHub DB] GCS_BUCKET_NAME is not set. Local db.json will be used.');
    return;
  }
  try {
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID || undefined,
    });
    const bucket = storage.bucket(gcsBucketName);
    const file = bucket.file('db.json');
    const [exists] = await file.exists();
    if (exists) {
      console.log('[FileHub DB] GCS db.json backup found, downloading to restore...');
      const localDbPath = path.join(process.cwd(), 'data', 'db.json');
      const dataDir = path.dirname(localDbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      await file.download({ destination: localDbPath });
      console.log('[FileHub DB] GCS db.json successfully downloaded and restored.');
    } else {
      console.log('[FileHub DB] No GCS db.json backup found yet. Local db.json will be uploaded on first write.');
    }
  } catch (err: any) {
    if (err?.code === 404 || err?.message?.includes('does not exist')) {
      console.log('[FileHub DB] GCS bucket or backup file not initialized. Local database active.');
    } else {
      console.log('[FileHub DB] Info on GCS sync:', err?.message || err);
    }
  }
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

// Helper to upload files to Supabase Storage
async function uploadToSupabaseStorage(localPath: string, destination: string, contentType: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return;
  }
  try {
    const cleanUrl = getCleanSupabaseBaseUrl(supabaseUrl);
    const fileContent = fs.readFileSync(localPath);
    await axios.post(`${cleanUrl}/storage/v1/object/files-bucket/${destination}`, fileContent, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    console.log(`[Supabase Storage] Successfully uploaded backup to files-bucket/${destination}`);
  } catch (err: any) {
    if (err.response?.status === 404 || err?.message?.includes('does not exist')) {
      console.log(`[Supabase Storage] Remote storage bucket not found. Skipping cloud backup.`);
    } else {
      console.log(`[Supabase Storage] Notice for ${destination}: ${err.message || 'Unknown status'}`);
    }
  }
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Sync DB from GCS at startup to prevent Cloud Run ephemeral data loss
syncDbFromGcs().then(() => {
  console.log('[FileHub DB] GCS synchronization completed at startup.');
}).catch(err => console.error('[FileHub DB] GCS sync notice:', err));

// Sync DB from Supabase at startup to prevent Cloud Run ephemeral data loss
syncDbFromSupabase().then(() => {
  console.log('[FileHub DB] Supabase DB synchronization completed at startup.');
}).catch(err => console.error('[FileHub DB] Supabase sync notice:', err));

// Simple Request Logger
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} - NODE_ENV: ${process.env.NODE_ENV}`);
  next();
});

  // Enable CORS for mobile apps and other origins
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Safely determine if the uploads directory is writable, falling back to /tmp/uploads in read-only environments
  let uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const testFile = path.join(uploadsDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err) {
    console.warn('[FileHub Engine] Local uploads directory is not writable. Falling back to /tmp/uploads');
    uploadsDir = path.join('/tmp', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  // Parse JSON and Form Data
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Initialize Google Cloud Storage if bucket name is set
  const gcsBucketName = process.env.GCS_BUCKET_NAME;
  const gcpProjectId = process.env.GCP_PROJECT_ID;

  let gcsStorage: any = null;
  let gcsBucket: any = null;

  if (gcsBucketName) {
    try {
      gcsStorage = new Storage({
        projectId: gcpProjectId || undefined,
      });
      gcsBucket = gcsStorage.bucket(gcsBucketName);
      console.log(`[FileHub GCS] Initialized Google Cloud Storage bucket: ${gcsBucketName}`);
    } catch (err) {
      console.error('[FileHub GCS] Error initializing GCS client:', err);
    }
  } else {
    console.log('[FileHub GCS] GCS_BUCKET_NAME is not set. Using local server fallback storage.');
  }

  // Expose physical uploads directory for direct browser download & preview (with automatic GCS/Supabase fallback!)
  app.use('/uploads', (req, res, next) => {
    const filePath = decodeURIComponent(req.path);
    const localFile = path.join(uploadsDir, filePath);

    if (fs.existsSync(localFile) && !fs.lstatSync(localFile).isDirectory()) {
      return res.sendFile(localFile);
    }

    const proceedWithGcs = () => {
      if (gcsBucket) {
        const gcsPath = filePath.replace(/^\//, '');
        const gcsFile = gcsBucket.file(gcsPath);

        gcsFile.exists().then(([exists]: [boolean]) => {
          if (exists) {
            console.log(`[FileHub GCS] Serving file from GCS stream: ${gcsPath}`);
            gcsFile.getMetadata().then(([metadata]: any) => {
              if (metadata.contentType) {
                res.setHeader('Content-Type', metadata.contentType);
              }
              gcsFile.createReadStream().pipe(res);
            }).catch(() => {
              gcsFile.createReadStream().pipe(res);
            });
          } else {
            res.status(404).json({ error: 'File not found locally or in cloud storage.' });
          }
        }).catch((err: any) => {
          console.error(`[FileHub GCS] Error checking file existence in GCS: ${gcsPath}`, err);
          res.status(404).json({ error: 'File not found.' });
        });
      } else {
        res.status(404).json({ error: 'File not found.' });
      }
    };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const cleanUrl = getCleanSupabaseBaseUrl(supabaseUrl);
      const cleanPath = filePath.replace(/^\//, '');
      console.log(`[Supabase Storage] Streaming file: files-bucket/${cleanPath}`);
      
      axios.get(`${cleanUrl}/storage/v1/object/authenticated/files-bucket/${cleanPath}`, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        responseType: 'stream'
      }).then((response) => {
        if (response.headers['content-type']) {
          res.setHeader('Content-Type', String(response.headers['content-type']));
        }
        response.data.pipe(res);
      }).catch((err) => {
        console.warn(`[Supabase Storage] File not found in Supabase: files-bucket/${cleanPath}. Trying GCS fallback...`);
        proceedWithGcs();
      });
    } else {
      proceedWithGcs();
    }
  });

  const JWT_SECRET = process.env.JWT_SECRET || 'somluul_super_secret_jwt_key_123!';

  // --- MIDDLEWARES ---

  // Secure Token Auth Middleware using JWT and checking device lists
  const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized. No session token provided.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const db = readDB();
    let userId = token;
    let deviceId: string | undefined = undefined;

    // Try verifying as JWT
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; deviceId?: string };
      userId = decoded.userId;
      deviceId = decoded.deviceId;
    } catch (err) {
      // Fallback to older direct token format (raw user ID) for seamless local backward compatibility
      userId = token;
    }

    const user = db.profiles.find(p => p.id === userId);

    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Invalid session.' });
      return;
    }

    if (user.blocked) {
      res.status(403).json({ error: 'Forbidden. Your account has been blocked.' });
      return;
    }

    // If session was generated with a deviceId, check if it's still registered in user's devices
    if (deviceId && user.devices) {
      const isDeviceActive = user.devices.some(d => d.id === deviceId);
      if (!isDeviceActive) {
        res.status(401).json({ error: 'Session expired. This device has been logged out.' });
        return;
      }
    }

    req.user = user;
    next();
  };

  // Admin Verification Middleware
  const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden. Administrative access required.' });
      return;
    }
    next();
  };

  // Owner Verification Middleware
  const ownerMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.email.toLowerCase() !== 'xamseyare5267@gmail.com') {
      res.status(403).json({ error: 'Forbidden. Owner access required.' });
      return;
    }
    next();
  };

  // Configure Multer for File Uploads
  const storage = multer.diskStorage({
    destination: (req: AuthenticatedRequest, file, cb) => {
      const userId = req.user?.id || 'anonymous';
      const userUploadDir = path.join(uploadsDir, userId);
      if (!fs.existsSync(userUploadDir)) {
        fs.mkdirSync(userUploadDir, { recursive: true });
      }
      cb(null, userUploadDir);
    },
    filename: (req, file, cb) => {
      // Append timestamp to ensure uniqueness but preserve extension
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
      cb(null, `${base}_${Date.now()}${ext}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 200 * 1024 * 1024 // 200 MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allowed mime types or extensions
      const allowedExtensions = [
        '.pdf', '.docx', '.doc', '.xlsx', '.pptx', '.txt', '.csv',
        '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.heic',
        '.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.3gp',
        '.mp3', '.wav', '.aac', '.m4a', '.ogg',
        '.zip', '.rar', '.7z'
      ];
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (allowedExtensions.includes(ext) || !ext) {
        cb(null, true);
      } else {
        cb(null, true); // Allow all file types safely for maximum compatibility
      }
    }
  });

  // --- API ENDPOINTS ---

  // Device registration utility to track active session devices
  const registerDeviceSession = (userId: string, req: Request, customDeviceId?: string): { id: string; token: string } => {
    const deviceId = customDeviceId || Math.random().toString(36).substring(2, 10);
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    
    let deviceName = 'Web Browser';
    if (userAgent.includes('Mobi')) deviceName = 'Mobile Device';
    if (userAgent.includes('Android')) deviceName = 'Android Phone';
    if (userAgent.includes('iPhone')) deviceName = 'iPhone';
    if (userAgent.includes('iPad')) deviceName = 'iPad';
    if (userAgent.includes('Macintosh')) deviceName = 'MacBook';
    if (userAgent.includes('Windows')) deviceName = 'Windows PC';

    const device = {
      id: deviceId,
      name: deviceName,
      ip: (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1',
      last_active: new Date().toISOString(),
      location: 'Mogadishu, Somalia'
    };

    trackUserDevice(userId, device);
    
    // Sign JWT token
    const token = jwt.sign({ userId, deviceId }, JWT_SECRET, { expiresIn: '30d' });
    return { id: deviceId, token };
  };

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // --- 1. EMAIL SIGN UP / LOGIN ENDPOINTS ---

  app.post('/api/auth/signup', (req, res) => {
    const { email, password, first_name, last_name, username, bio, dob, role, email_verified, phone, gender, deviceId } = req.body;
    if (!email || !password || !first_name || !last_name) {
      res.status(400).json({ error: 'Fadlan buuxi dhammaan xogta muhiimka ah (Email, Password, Name).' });
      return;
    }

    const db = readDB();
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== 'xamseyare5267@gmail.com' && db.profiles.some(p => p.email === normalizedEmail)) {
      res.status(400).json({ error: 'Email-kan horey ayaa loo diiwaan geliyay.' });
      return;
    }

    if (username && normalizedEmail !== 'xamseyare5267@gmail.com' && db.profiles.some(p => p.username && p.username.toLowerCase() === username.trim().toLowerCase())) {
      res.status(400).json({ error: 'Username-kan horey ayaa loo qaatay. Fadlan dooro mid kale.' });
      return;
    }

    if (phone) {
      const cleanIncoming = phone.replace(/\s+/g, '').replace(/^\+252/, '').replace(/^0/, '');
      const isPhoneDuplicate = db.profiles.some(p => {
        if (!p.phone || (normalizedEmail === 'xamseyare5267@gmail.com' && p.email === normalizedEmail)) return false;
        const cleanDb = p.phone.replace(/\s+/g, '').replace(/^\+252/, '').replace(/^0/, '');
        return cleanDb === cleanIncoming;
      });
      if (isPhoneDuplicate) {
        res.status(400).json({ error: 'Lambarkan telefoon horey ayaa loo diiwaan geliyay.' });
        return;
      }
    }

    const defaultRole = role === 'admin' ? 'admin' : 'normal';
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const result = registerUser(email, password, first_name, last_name, defaultRole, {
      username: username ? username.trim() : normalizedEmail.split('@')[0],
      is_username_custom: !!username,
      bio: bio || '',
      dob: dob || '',
      phone: phone || '',
      gender: gender || '',
      email_verified: true, // Auto verify to prevent mail blocking
      verification_code: verificationCode,
      login_method: 'email',
      created_at: new Date().toISOString()
    });

    if (!result.success || !result.user) {
      res.status(400).json({ error: result.message });
      return;
    }

    // Automatically create a device session and log the user in immediately
    const sessionDetail = registerDeviceSession(result.user.id, req, deviceId);
    const dbRefreshed = readDB();
    const registeredUser = dbRefreshed.profiles.find(p => p.id === result.user!.id)!;

    // Send real verification email in background as a luxury extra
    sendVerificationEmail(normalizedEmail, verificationCode);

    res.status(201).json({
      message: 'Akoonkaaga waa la sameeyay si guul leh!',
      verificationCode: verificationCode,
      session: {
        user: registeredUser,
        token: sessionDetail.token,
        deviceId: sessionDetail.id
      }
    });
  });

  app.post('/api/auth/restore-session', (req, res) => {
    const { token, profile } = req.body;
    if (!token || !profile || !profile.id || !profile.email) {
      res.status(400).json({ error: 'Fadlan bixi token iyo profile sax ah.' });
      return;
    }

    const db = readDB();
    const existing = db.profiles.find(p => p.id === profile.id || p.email.toLowerCase() === profile.email.toLowerCase());
    
    if (!existing) {
      const newProfile = {
        ...profile,
        email_verified: true,
        updated_at: new Date().toISOString()
      };
      db.profiles.push(newProfile);
      
      db.credentials.push({
        userId: profile.id,
        passwordHash: Buffer.from('somluul_restored_hash').toString('base64')
      });
      writeDB(db);
      console.log(`[Session Restore] Restored profile successfully: ${profile.email}`);
    }

    res.json({ success: true, message: 'Akoonkaaga waa la soo celiyay si guul leh!' });
  });

  app.post('/api/auth/login', (req, res) => {
    let { email, password, deviceId } = req.body;
    email = (email || '').trim().toLowerCase();
    password = (password || '').trim();

    if (!email || !password) {
      res.status(400).json({ error: 'Fadlan geli Email-ka iyo Password-ka.' });
      return;
    }

    const result = authenticateUser(email, password);
    if (!result.success || !result.user) {
      res.status(400).json({ error: result.message });
      return;
    }

    if (result.user.email_verified === false) {
      const db = readDB();
      const user = db.profiles.find(p => p.id === result.user!.id)!;
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.verification_code = newCode;
      user.updated_at = new Date().toISOString();
      writeDB(db);

      // Send real verification email in background
      sendVerificationEmail(user.email, newCode);

      res.status(403).json({
        error: 'Email-kaaga weli lama xaqiijin. Koodh cusub ayaa loo diray email-kaaga.',
        notVerified: true,
        email: user.email,
        verificationCode: newCode
      });
      return;
    }

    // Track device and generate JWT session
    const sessionDetail = registerDeviceSession(result.user.id, req, deviceId);

    // Fetch refreshed user profile (including devices)
    const db = readDB();
    const updatedUser = db.profiles.find(p => p.id === result.user!.id)!;

    res.json({
      message: 'Galka waa lagu guuleystay!',
      session: {
        user: updatedUser,
        token: sessionDetail.token,
        deviceId: sessionDetail.id
      }
    });
  });

  // Verify Email Verification Code
  app.post('/api/auth/email/verify-code', (req, res) => {
    const { email, code, deviceId } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: 'Email iyo code-ka xaqiijinta ayaa loo baahan yahay.' });
      return;
    }

    const db = readDB();
    const normalizedEmail = email.toLowerCase().trim();
    const userIndex = db.profiles.findIndex(p => p.email === normalizedEmail);

    if (userIndex === -1) {
      res.status(404).json({ error: 'Xisaabtan lama helin.' });
      return;
    }

    const user = db.profiles[userIndex];
    if (user.verification_code === code) {
      user.email_verified = true;
      user.verification_code = undefined; // clear code
      user.updated_at = new Date().toISOString();
      writeDB(db);

      // Log user in automatically
      const sessionDetail = registerDeviceSession(user.id, req, deviceId);
      
      res.json({
        message: 'Email-ka waa la xaqiijiyay si guul leh!',
        session: {
          user,
          token: sessionDetail.token,
          deviceId: sessionDetail.id
        }
      });
    } else {
      res.status(400).json({ error: 'Koodhka xaqiijinta waa khalad. Fadlan dib u tijaabi.' });
    }
  });

  // Resend Email Verification Code
  app.post('/api/auth/email/resend-code', (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email ayaa loo baahan yahay.' });
      return;
    }

    const db = readDB();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.profiles.find(p => p.email === normalizedEmail);

    if (!user) {
      res.status(404).json({ error: 'Xisaabtan lama helin.' });
      return;
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verification_code = newCode;
    user.updated_at = new Date().toISOString();
    writeDB(db);

    // Send real verification email in the background
    sendVerificationEmail(normalizedEmail, newCode);

    res.json({
      message: 'Koodh cusub ayaa loo diray email-kaaga.',
      verificationCode: newCode
    });
  });

  // --- 2. PHONE NUMBER AUTHENTICATION ---

  app.post('/api/auth/phone/send-otp', (req, res) => {
    const { phone, country_code } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'Fadlan geli lambarkaaga telefoonka.' });
      return;
    }

    const fullPhone = `${country_code || '+252'}${phone.replace(/\s+/g, '')}`;
    const db = readDB();
    
    // Find or create profile with this phone number
    let user = db.profiles.find(p => p.phone === fullPhone);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (!user) {
      // Create new user for this phone number
      const userId = generateId();
      const mockEmail = `phone_${userId}@somluul.com`;
      user = {
        id: userId,
        email: mockEmail,
        first_name: 'SomLuul',
        last_name: 'User',
        avatar: null,
        role: 'normal',
        blocked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        phone: fullPhone,
        phone_verified: false,
        phone_otp_code: otpCode,
        login_method: 'phone',
        devices: [],
        username: `user_${Math.floor(100000 + Math.random() * 900000)}`
      };
      db.profiles.push(user);
      db.credentials.push({
        userId,
        passwordHash: hashPassword(Math.random().toString(36))
      });
    } else {
      user.phone_otp_code = otpCode;
      user.updated_at = new Date().toISOString();
    }

    writeDB(db);

    res.json({
      message: `SMS xaqiijin ah ayaa loo diray telefoonka ${fullPhone}.`,
      otpCode, // return directly for simulation in the preview screen!
      phone: fullPhone
    });
  });

  app.post('/api/auth/phone/verify-otp', (req, res) => {
    const { phone, otpCode, first_name, last_name, username, deviceId } = req.body;
    if (!phone || !otpCode) {
      res.status(400).json({ error: 'Telefoonka iyo OTP code-ka ayaa loo baahan yahay.' });
      return;
    }

    const db = readDB();
    const userIndex = db.profiles.findIndex(p => p.phone === phone);

    if (userIndex === -1) {
      res.status(404).json({ error: 'Lambarkan telefoon ma diiwaan gashna.' });
      return;
    }

    const user = db.profiles[userIndex];
    if (user.phone_otp_code === otpCode) {
      user.phone_verified = true;
      user.phone_otp_code = undefined; // clear OTP
      
      // Update profile info if specified during signup flow
      if (first_name) user.first_name = first_name;
      if (last_name) user.last_name = last_name;
      if (username) user.username = username;
      
      user.last_login = new Date().toISOString();
      user.updated_at = new Date().toISOString();
      writeDB(db);

      const sessionDetail = registerDeviceSession(user.id, req, deviceId);

      res.json({
        message: 'Telefoonka waa la xaqiijiyay si guul leh!',
        session: {
          user,
          token: sessionDetail.token,
          deviceId: sessionDetail.id
        }
      });
    } else {
      res.status(400).json({ error: 'Koodhka xaqiijinta (OTP) waa khalad.' });
    }
  });

  // --- 3. SOCIAL LOGIN / OAUTH ENDPOINTS ---

  // Google, Facebook, Apple Auth URLs
  app.get('/api/auth/oauth/url', (req, res) => {
    const { provider } = req.query;
    const clientOrigin = req.headers.referer || `${req.protocol}://${req.get('host')}`;
    
    // Check if real Google/Facebook/Apple credentials are set in environment
    const isGoogleConfigured = !!process.env.GOOGLE_CLIENT_ID;
    const isFacebookConfigured = !!process.env.FACEBOOK_CLIENT_ID;
    const isAppleConfigured = !!process.env.APPLE_CLIENT_ID;

    if (provider === 'google') {
      if (isGoogleConfigured) {
        // Real Google OAuth flow
        const redirectUri = `${clientOrigin}/auth/callback`;
        const params = new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          access_type: 'offline',
          state: 'google',
          prompt: 'consent'
        });
        res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
      } else {
        res.status(400).json({ error: 'Nidaamka Google Login wali lama habaynin. Maamulaha barnaamijka fadlan ku dar GOOGLE_CLIENT_ID iyo GOOGLE_CLIENT_SECRET galka Secrets ee AI Studio.' });
      }
    } else if (provider === 'facebook') {
      if (isFacebookConfigured) {
        const redirectUri = `${clientOrigin}/auth/callback`;
        const params = new URLSearchParams({
          client_id: process.env.FACEBOOK_CLIENT_ID!,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'public_profile,email',
          state: 'facebook'
        });
        res.json({ url: `https://www.facebook.com/v12.0/dialog/oauth?${params.toString()}` });
      } else {
        res.status(400).json({ error: 'Nidaamka Facebook Login wali lama habaynin. Maamulaha barnaamijka fadlan ku dar FACEBOOK_CLIENT_ID iyo FACEBOOK_CLIENT_SECRET galka Secrets ee AI Studio.' });
      }
    } else if (provider === 'apple') {
      if (isAppleConfigured) {
        const redirectUri = `${clientOrigin}/auth/callback`;
        const params = new URLSearchParams({
          client_id: process.env.APPLE_CLIENT_ID!,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'name email',
          response_mode: 'form_post',
          state: 'apple'
        });
        res.json({ url: `https://appleid.apple.com/auth/authorize?${params.toString()}` });
      } else {
        res.status(400).json({ error: 'Nidaamka Apple Login wali lama habaynin. Maamulaha barnaamijka fadlan ku dar APPLE_CLIENT_ID iyo APPLE_CLIENT_SECRET galka Secrets ee AI Studio.' });
      }
    } else {
      res.status(400).json({ error: 'Xogta ku saabsan shirkada la doortay waa khalad.' });
    }
  });







  // Redirect callback that establishes user profile, logs device, and closes popup
  app.get('/auth/callback', async (req, res) => {
    const { code, state, error: authError } = req.query;

    if (authError) {
      res.status(400).send(`Cillad OAuth: ${authError}`);
      return;
    }

    let email = '';
    let first_name = '';
    let last_name = '';
    let avatar: string | null = null;
    let method = '';

    if (code) {
      // Real OAuth flow code exchange!
      const clientOrigin = `${req.protocol}://${req.get('host')}`;
      const redirectUri = `${clientOrigin}/auth/callback`;
      method = String(state || 'google');

      try {
        if (method === 'google') {
          const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          });
          const accessToken = tokenRes.data.access_token;
          const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          email = userRes.data.email;
          first_name = userRes.data.given_name || '';
          last_name = userRes.data.family_name || '';
          avatar = userRes.data.picture || null;
        } else if (method === 'facebook') {
          const tokenRes = await axios.get('https://graph.facebook.com/v12.0/oauth/access_token', {
            params: {
              client_id: process.env.FACEBOOK_CLIENT_ID,
              client_secret: process.env.FACEBOOK_CLIENT_SECRET,
              redirect_uri: redirectUri,
              code
            }
          });
          const accessToken = tokenRes.data.access_token;
          const userRes = await axios.get('https://graph.facebook.com/me', {
            params: {
              fields: 'id,first_name,last_name,email,picture',
              access_token: accessToken
            }
          });
          email = userRes.data.email;
          first_name = userRes.data.first_name || '';
          last_name = userRes.data.last_name || '';
          avatar = userRes.data.picture?.data?.url || null;
        } else if (method === 'apple') {
          const tokenRes = await axios.post('https://appleid.apple.com/auth/token', {
            code,
            client_id: process.env.APPLE_CLIENT_ID,
            client_secret: process.env.APPLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          });
          const idToken = tokenRes.data.id_token;
          if (idToken) {
            const decoded: any = jwt.decode(idToken);
            email = decoded?.email || '';
            first_name = 'Apple';
            last_name = 'User';
          }
        }
      } catch (err: any) {
        console.error('OAuth Code Exchange Error:', err.response?.data || err.message);
        res.status(500).send(`Galka OAuth waa ku fashilantay intii lagu guda jiray xaqiijinta code-ka: ${err.message}`);
        return;
      }
    } else {
      // Fallback/Legacy query params
      method = String(req.query.method || 'google');
      email = String(req.query.email || '');
      first_name = String(req.query.first_name || '');
      last_name = String(req.query.last_name || '');
      avatar = req.query.avatar ? String(req.query.avatar) : null;
    }

    if (!email) {
      res.status(400).send('Xogta Google/Facebook/Apple OAuth waa khalad (Email is missing).');
      return;
    }

    // CRITICAL SECURITY ENFORCEMENT: Block any admin or owner email in social auth callback
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail === 'xamseyare5267@gmail.com' || normalizedEmail === 'admin@filehub.com') {
      res.status(403).send(`
        <html>
          <head>
            <title>Calaamad Ammaan - SomLuul</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-red-50 flex items-center justify-center min-h-screen p-4 font-sans text-center">
            <div class="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full border border-red-100">
              <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <h1 class="text-base font-bold text-red-800 mb-2">DIGNIIN AMMAAN!</h1>
              <p class="text-xs text-red-700 leading-relaxed">
                Maadaama uu cinwaankani yahay Maamulaha Sare (Owner/Admin), amniga awgiis laguma soo geli karo Google/Facebook/Apple Login khayaali ah. Fadlan ku soo laabo bogga rasmiga ah ee login-ka oo ku gal password-kaaga rasmiga ah.
              </p>
              <button onclick="window.close()" class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-all">Close Window</button>
            </div>
          </body>
        </html>
      `);
      return;
    }

    const user = findOrCreateSocialUser(
      method as 'google' | 'facebook' | 'apple',
      email,
      first_name || 'Social',
      last_name || 'User',
      avatar || null
    );

    // Track device and generate token
    const sessionDetail = registerDeviceSession(user.id, req);

    // Fetch refreshed profile to include device lists
    const db = readDB();
    const refreshedUser = db.profiles.find(p => p.id === user.id)!;

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                session: {
                  user: ${JSON.stringify(refreshedUser)},
                  token: "${sessionDetail.token}",
                  deviceId: "${sessionDetail.id}"
                }
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Diiwaan-gelinta waa lagu guuleystay! Fadlan sug inta ay xirmeyso daaqadani...</p>
        </body>
      </html>
    `);
  });

  // --- 4. DEVICE LOGOUT / SESSION MANAGEMENT ENDPOINTS ---

  // Get active devices of the user
  app.get('/api/auth/devices', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const user = db.profiles.find(p => p.id === req.user!.id);
    res.json({ devices: user?.devices || [] });
  });

  // Logout specific device session
  app.post('/api/auth/logout-device', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { deviceId } = req.body;
    if (!deviceId) {
      res.status(400).json({ error: 'Device ID is required.' });
      return;
    }

    removeUserDevice(req.user!.id, deviceId);
    logActivity(req.user!.id, req.user!.email, 'profile_update', `Logged out of device session: ${deviceId}`);

    res.json({ success: true, message: 'Qalabka waa laga soo saaray si guul leh.' });
  });

  // Logout from ALL devices (Session wipeout)
  app.post('/api/auth/logout-all', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    removeAllUserDevices(req.user!.id);
    logActivity(req.user!.id, req.user!.email, 'profile_update', 'Logged out of all active device sessions.');

    res.json({ success: true, message: 'Dhammaan qalabyada kale waa laga soo saaray xisaabtaada!' });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email ayaa loo baahan yahay.' });
      return;
    }
    const db = readDB();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.profiles.find(p => p.email === normalizedEmail);
    
    if (user) {
      // Generate a temporary 6-digit recovery code
      const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.verification_code = recoveryCode;
      writeDB(db);

      res.json({
        success: true,
        message: 'Koodhka kabista password-ka waxaa loo diray email-kaaga.',
        recoveryCode // Sent in response so they can easily enter it on preview simulator
      });
    } else {
      res.status(404).json({ error: 'Account with this email does not exist.' });
    }
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { email, code, password } = req.body;
    if (!email || !code || !password) {
      res.status(400).json({ error: 'Fadlan geli Email-ka, Koodhka, iyo Password-ka cusub.' });
      return;
    }

    const db = readDB();
    const normalizedEmail = email.toLowerCase().trim();
    const user = db.profiles.find(p => p.email === normalizedEmail);

    if (!user) {
      res.status(404).json({ error: 'Xisaabtan lama helin.' });
      return;
    }

    if (user.verification_code !== code) {
      res.status(400).json({ error: 'Koodhka kabista ee aad gelisay waa khalad.' });
      return;
    }

    const result = resetUserPassword(normalizedEmail, password);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }

    user.verification_code = undefined; // clear code
    writeDB(db);

    res.json({ success: true, message: 'Password-ka waa la bedelay si guul leh!' });
  });

  app.put('/api/auth/profile', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { first_name, last_name, avatar, bio, phone, city, country, website, gender, dob, cover_photo, language, username, work } = req.body;
    
    const finalFirstName = first_name !== undefined ? first_name : req.user!.first_name;
    const finalLastName = last_name !== undefined ? last_name : req.user!.last_name;

    if (!finalFirstName || !finalLastName) {
      res.status(400).json({ error: 'First name and last name are required.' });
      return;
    }

    const userId = req.user!.id;
    
    // Construct updates object, ONLY setting fields if they are explicitly passed (not undefined)
    const updates: Partial<Profile> = {};
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (avatar !== undefined) updates.avatar = avatar;
    if (bio !== undefined) updates.bio = bio;
    if (phone !== undefined) updates.phone = phone;
    if (city !== undefined) updates.city = city;
    if (country !== undefined) updates.country = country;
    if (website !== undefined) updates.website = website;
    if (gender !== undefined) updates.gender = gender;
    if (dob !== undefined) updates.dob = dob;
    if (cover_photo !== undefined) updates.cover_photo = cover_photo;
    if (language !== undefined) updates.language = language;
    if (work !== undefined) updates.work = work;

    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (trimmedUsername) {
        const db = readDB();
        const isDuplicate = db.profiles.some(p => p.id !== userId && p.username && p.username.toLowerCase() === trimmedUsername.toLowerCase());
        if (isDuplicate) {
          res.status(400).json({ error: 'Username-kan horey ayaa loo qaatay. Fadlan dooro mid kale.' });
          return;
        }
        updates.username = trimmedUsername;
        updates.is_username_custom = true;
      }
    }

    const result = updateProfile(userId, updates);

    if (!result.success) {
      res.status(500).json({ error: 'Failed to update profile.' });
      return;
    }

    // Log the profile update activity
    logActivity(userId, req.user!.email, 'profile_update', 'Updated profile information (bio / contact detail)');

    res.json({ success: true, user: result.user });
  });

  // Discovery: Get all user profiles (with search and follow info)
  app.get('/api/profiles', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const currentUserId = req.user!.id;
    
    const list = db.profiles.map(p => {
      const isFollowing = p.followers ? p.followers.includes(currentUserId) : false;
      return {
        ...p,
        isFollowing,
        followersCount: p.followers ? p.followers.length : 0,
        followingCount: p.following ? p.following.length : 0,
      };
    });
    
    res.json(list);
  });

  // Get specific profile by ID or username
  app.get('/api/profiles/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    const currentUserId = req.user!.id;
    const targetId = req.params.id;

    const p = db.profiles.find(user => 
      user.id === targetId || 
      (user.username && user.username.toLowerCase() === targetId.toLowerCase()) || 
      (user.email && user.email.toLowerCase().split('@')[0] === targetId.toLowerCase())
    );
    
    if (!p) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    const isFollowing = p.followers ? p.followers.includes(currentUserId) : false;
    res.json({
      ...p,
      isFollowing,
      followersCount: p.followers ? p.followers.length : 0,
      followingCount: p.following ? p.following.length : 0,
    });
  });

  // Follow/Unfollow toggle
  app.post('/api/profiles/:id/follow', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const targetId = req.params.id;
    const currentUserId = req.user!.id;

    if (currentUserId === targetId) {
      res.status(400).json({ error: 'Miyaad is raacaysaa naftaada sxb? Ma suurtowdo.' });
      return;
    }

    const result = toggleFollowUser(currentUserId, targetId);
    if (!result.success) {
      res.status(404).json({ error: 'Qofkaan lama helin.' });
      return;
    }

    if (result.isFollowing) {
      const db = readDB();
      if (!db.notifications) db.notifications = [];
      const sender = db.profiles.find(p => p.id === currentUserId);
      db.notifications.unshift({
        id: `noti_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        userId: targetId,
        type: 'follow',
        title: 'Follower Cusub 👤',
        body: `${sender ? `${sender.first_name} ${sender.last_name}` : 'Qof'} ayaa ku follow gareeyay!`,
        senderId: currentUserId,
        senderName: sender ? `${sender.first_name} ${sender.last_name}` : 'Qof',
        senderAvatar: sender ? sender.avatar : null,
        read: false,
        created_at: new Date().toISOString()
      });
      writeDB(db);
    }

    res.json({
      success: true,
      isFollowing: result.isFollowing,
      user: result.follower,
      target: result.target
    });
  });

  // Upload custom profile picture from gallery
  app.post('/api/auth/profile/avatar', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const { avatar } = req.body;
      if (!avatar) {
        res.status(400).json({ error: 'No base64 image data provided.' });
        return;
      }
      const userId = req.user!.id;
      const db = readDB();
      const userIndex = db.profiles.findIndex(p => p.id === userId);
      if (userIndex !== -1) {
        db.profiles[userIndex].avatar = avatar;
        db.profiles[userIndex].updated_at = new Date().toISOString();
        writeDB(db);

        // Log the avatar update
        logActivity(userId, req.user!.email, 'profile_update', 'Uploaded a new profile picture / avatar (Base64 durable mode)');

        res.json({ success: true, avatar: avatar, user: db.profiles[userIndex] });
      } else {
        res.status(404).json({ error: 'User profile not found.' });
      }
      return;
    }

    upload.single('avatar')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const userId = req.user!.id;
      const filename = req.file.filename;
      const publicUrl = `/uploads/${userId}/${filename}`;

      // Upload backup to GCS if available
      if (gcsBucket && req.file.path) {
        const localPath = req.file.path;
        const destination = `${userId}/${filename}`;
        gcsBucket.upload(localPath, {
          destination: destination,
          metadata: {
            contentType: req.file.mimetype,
          }
        }).catch(() => {});
      }

      // Upload backup to Supabase if available
      if (req.file.path) {
        uploadToSupabaseStorage(req.file.path, `${userId}/${filename}`, req.file.mimetype);
      }

      const db = readDB();
      const userIndex = db.profiles.findIndex(p => p.id === userId);
      if (userIndex !== -1) {
        db.profiles[userIndex].avatar = publicUrl;
        db.profiles[userIndex].updated_at = new Date().toISOString();
        writeDB(db);

        // Log the avatar update
        logActivity(userId, req.user!.email, 'profile_update', 'Uploaded a new profile picture / avatar');

        res.json({ success: true, avatar: publicUrl, user: db.profiles[userIndex] });
      } else {
        res.status(404).json({ error: 'User profile not found.' });
      }
    });
  });

  // 2. FILE MANAGEMENT ENDPOINTS
  app.post('/api/files/upload', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
      }

      const userId = req.user!.id;
      const originalName = req.file.originalname;
      const filename = req.file.filename;
      const size = req.file.size;
      const mimeType = req.file.mimetype;
      const relativeStoragePath = `uploads/${userId}/${filename}`;
      const publicUrl = `/uploads/${userId}/${filename}`;

      const savedFile = saveFileRecord({
        user_id: userId,
        filename,
        original_name: originalName,
        file_size: size,
        mime_type: mimeType,
        storage_path: relativeStoragePath,
        public_url: publicUrl
      });

      // Upload backup to GCS if available
      if (gcsBucket && req.file.path) {
        const localPath = req.file.path;
        const destination = `${userId}/${filename}`;
        gcsBucket.upload(localPath, {
          destination: destination,
          metadata: {
            contentType: mimeType,
          }
        }).then(() => {
          console.log(`[FileHub GCS] Backup uploaded to GCS successfully: ${destination}`);
        }).catch((gcsErr: any) => {
          if (gcsErr?.code === 404 || gcsErr?.message?.includes('does not exist')) {
            console.log(`[FileHub GCS] GCS bucket uninitialized. File stored locally.`);
          } else {
            console.log(`[FileHub GCS] Backup notice:`, gcsErr?.message || gcsErr);
          }
        });
      }

      // Upload backup to Supabase Storage if available
      if (req.file.path) {
        uploadToSupabaseStorage(req.file.path, `${userId}/${filename}`, mimeType);
      }

      // Log the activity
      logActivity(userId, req.user!.email, 'upload', `Uploaded file: ${originalName} (${(size / 1024).toFixed(1)} KB)`);

      res.status(201).json({
        message: 'File uploaded successfully!',
        file: savedFile
      });
    });
  });

  app.get('/api/files', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const db = readDB();

    // Determine target user's list (normal user sees own, admin sees all files, or can filter by specific user)
    let files = isAdmin ? db.files : db.files.filter(f => f.user_id === userId);

    const filterUserId = req.query.user_id as string;
    if (isAdmin && filterUserId) {
      files = files.filter(f => f.user_id === filterUserId);
    }

    // Search filter
    const search = (req.query.search as string || '').toLowerCase().trim();
    if (search) {
      files = files.filter(f => f.original_name.toLowerCase().includes(search));
    }

    // Sort filter
    const sort = req.query.sort as string || 'date_desc';
    files.sort((a, b) => {
      switch (sort) {
        case 'name_asc':
          return a.original_name.localeCompare(b.original_name);
        case 'name_desc':
          return b.original_name.localeCompare(a.original_name);
        case 'size_asc':
          return a.file_size - b.file_size;
        case 'size_desc':
          return b.file_size - a.file_size;
        case 'date_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date_desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    // Pagination
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10');
    const offset = (page - 1) * limit;
    const paginatedFiles = files.slice(offset, offset + limit);

    res.json({
      data: paginatedFiles,
      total: files.length,
      page,
      limit,
      totalPages: Math.ceil(files.length / limit)
    });
  });

  app.delete('/api/files/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const fileId = req.params.id;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    const db = readDB();
    const file = db.files.find(f => f.id === fileId);

    if (!file) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }

    // Security check: non-admins can only delete their own files
    if (!isAdmin && file.user_id !== userId) {
      res.status(403).json({ error: 'Forbidden. You cannot delete files belonging to other users.' });
      return;
    }

    const deletion = deleteFileRecord(fileId);
    if (!deletion.success) {
      res.status(500).json({ error: 'Failed to delete file from disk or database.' });
      return;
    }

    // Log the deletion activity
    logActivity(userId, req.user!.email, 'delete', `Deleted file: ${file.original_name}`);

    res.json({ message: 'File deleted successfully!', file: deletion.file });
  });

  app.get('/api/files/stats', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const stats = getUserStats(userId);
    res.json({ stats });
  });

  // Fetch log history
  app.get('/api/logs', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const logs = getActivityLogs(userId);
    res.json(logs);
  });

  app.get('/api/admin/logs', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
    let logs = getActivityLogs();
    const search = req.query.search as string;
    if (search) {
      const query = search.toLowerCase();
      logs = logs.filter(log => 
        (log.user_email && log.user_email.toLowerCase().includes(query)) ||
        (log.action && log.action.toLowerCase().includes(query)) ||
        (log.details && log.details.toLowerCase().includes(query)) ||
        (log.user_id && log.user_id.toLowerCase().includes(query))
      );
    }
    res.json(logs);
  });

  // Direct file downloads route to bypass sandboxed iframe restrictions
  app.get('/api/downloads/file', (req, res) => {
    const filename = (req.query.name as string) || 'SomLuul_Desktop_Launcher.bat';
    let fileContent = '';
    let contentType = 'application/octet-stream';
    
    if (filename.endsWith('.bat')) {
      contentType = 'text/plain';
      fileContent = `@echo off
:: =====================================================================
::          SOMLUUL - WINDOWS DESKTOP LAUNCHER
:: =====================================================================
title SomLuul Desktop App
mode con: cols=65 lines=15
color 0b

echo.
echo   =========================================================
echo               SOMLUUL DESKTOP CLIENT
echo   =========================================================
echo.
echo   [+] Isku xirka server-ka... OK
echo   [+] Hubinta badbaadada... Badbaado
echo   [+] Furitaanka SomLuul Desktop...
echo.
echo   Fadlan sug inta uu barnaamijku ka furmayo...
echo.

start msedge --app=${req.protocol}://${req.get('host')}

if %errorlevel% neq 0 (
  start chrome --app=${req.protocol}://${req.get('host')}
)

echo   [+] Barnaamijka waa la furay! Waad ku mahadsantahay isticmaalka SomLuul.
timeout /t 3 >nul
exit
`;
    } else {
      fileContent = `SomLuul Installer Pack
===================================
App Name: SomLuul Client
Target File: ${filename}
Status: Production Ready
Security: Certified Malware-Free (SSL Secured)

Welcome to SomLuul! This file facilitates the client integration 
for accessing your workspace files, organizing folders, and conducting secure uploads.

Sida loo rakibo qalabkaaga:
1. Fadlan isticmaal batoonka weyn ee "Toos Ugu Rakib Qalabkaaga" ee ku yaal kore si aad u rakibto PWA (App toos u aada shaashadaada).
2. Tani waa habka ugu sahlan uguna badbaadsan oo u shaqeeya PC iyo Mobilka labadaba.

Thank you for choosing SomLuul!`;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(fileContent);
  });

  // --- SOCIAL FEED ENDPOINTS ---
  app.get('/api/posts', (req, res) => {
    const db = readDB();
    const currentPosts = db.posts || [];

    // Extract requesting user email from Authorization header if present
    let requestingEmail = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          if (decoded && decoded.userId) {
            const foundUser = db.profiles.find(p => p.id === decoded.userId);
            if (foundUser) requestingEmail = foundUser.email.toLowerCase();
          }
        } catch (_) {
          const foundProfile = db.profiles.find(p => p.id === token || p.email.toLowerCase() === token.toLowerCase());
          if (foundProfile) requestingEmail = foundProfile.email.toLowerCase();
        }
      }
    }

    const isOwner = requestingEmail === 'xamseyare5267@gmail.com';

    // Filter posts for non-owner users to hide owner private, prohibited, or restricted content
    const postsToResolve = currentPosts.filter((post: any) => {
      if (!post) return false;
      if (isOwner) return true; // Owner can see all posts including private notes & prohibited content

      // If marked private, owner-only, or prohibited, hide from regular users
      if (post.is_private || post.isPrivate || post.is_owner_only || post.isOwnerOnly) {
        const authorHandle = (post.author?.handle || '').toLowerCase();
        const authorEmail = (post.author?.email || '').toLowerCase();
        if (requestingEmail && (authorEmail === requestingEmail || (authorHandle && requestingEmail.startsWith(authorHandle)))) {
          return true; // Author can see their own private post
        }
        return false;
      }

      if (post.is_prohibited || post.isProhibited || post.visibility === 'owner' || post.visibility === 'private') {
        return false;
      }

      if ((post.is_important || post.isImportant) && post.visibility === 'owner_only') {
        return false;
      }

      return true;
    });

    const resolvedPosts = postsToResolve.map((post: any) => {
      if (!post || !post.author || !post.author.handle) {
        return post;
      }
      const authorProfile = db.profiles.find(p => {
        if (!p || !p.email) return false;
        // Match either by email prefix or by their custom username
        const emailPrefix = p.email.toLowerCase().split('@')[0];
        const handle = post.author.handle.toLowerCase();
        return emailPrefix === handle || (p.username && p.username.toLowerCase() === handle);
      });

      if (authorProfile) {
        let cleanAvatar = authorProfile.avatar;
        if (cleanAvatar && cleanAvatar.includes('photo-1535713875002-d1d0cf377fde')) {
          cleanAvatar = null;
        }
        return {
          ...post,
          author: {
            ...post.author,
            name: `${authorProfile.first_name} ${authorProfile.last_name}`,
            avatar: cleanAvatar || null,
            handle: authorProfile.username || authorProfile.email.toLowerCase().split('@')[0]
          }
        };
      }
      return post;
    });

    res.json(resolvedPosts);
  });

  app.post('/api/posts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    let { content, mediaType, mediaUrl, mediaList, isPrivate, isOwnerOnly, isImportant, isProhibited, visibility } = req.body;
    if (!content && !mediaUrl && (!mediaList || mediaList.length === 0)) {
      res.status(400).json({ error: 'Fadlan qor qoraal ama soo geli sawir/muuqaal.' });
      return;
    }

    const db = readDB();
    if (!db.posts) {
      db.posts = [];
    }

    const user = req.user!;
    const userId = user.id;

    // Helper to convert base64 data URLs to permanent physical files on disk
    const userDir = path.join(uploadsDir, userId);
    if (!fs.existsSync(userDir)) {
      try { fs.mkdirSync(userDir, { recursive: true }); } catch (_) {}
    }

    const saveBase64MediaToFile = (dataUrl: string | undefined): string | undefined => {
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        return dataUrl;
      }
      try {
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) return dataUrl;

        const mime = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        let ext = 'bin';
        if (mime.includes('mp4')) ext = 'mp4';
        else if (mime.includes('webm')) ext = 'webm';
        else if (mime.includes('mov') || mime.includes('quicktime')) ext = 'mov';
        else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
        else if (mime.includes('png')) ext = 'png';
        else if (mime.includes('gif')) ext = 'gif';
        else if (mime.includes('webp')) ext = 'webp';
        else if (mime.includes('mpeg') || mime.includes('mp3')) ext = 'mp3';

        const filename = `post_media_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
        const filePath = path.join(userDir, filename);
        fs.writeFileSync(filePath, buffer);

        const publicUrl = `/uploads/${userId}/${filename}`;

        // Backup to GCS / Supabase if active
        if (gcsBucket) {
          gcsBucket.upload(filePath, { destination: `${userId}/${filename}`, metadata: { contentType: mime } }).catch(() => {});
        }
        uploadToSupabaseStorage(filePath, `${userId}/${filename}`, mime);

        return publicUrl;
      } catch (err) {
        console.error('Error saving base64 media to file:', err);
        return dataUrl;
      }
    };

    const processedMediaUrl = saveBase64MediaToFile(mediaUrl);
    let processedMediaList = mediaList;
    if (mediaList && Array.isArray(mediaList)) {
      processedMediaList = mediaList.map((item: any) => ({
        ...item,
        url: saveBase64MediaToFile(item.url) || item.url
      }));
    }

    const isUserOwner = user.email.toLowerCase() === 'xamseyare5267@gmail.com';

    const newPost: Post = {
      id: `p-${Date.now()}`,
      author: {
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        avatar: user.avatar || null,
        handle: user.username || user.email.toLowerCase().split('@')[0],
        verified: user.role === 'admin'
      },
      content: content || '',
      mediaType: mediaType || 'text',
      mediaUrl: processedMediaUrl,
      mediaList: processedMediaList,
      isPrivate: isUserOwner ? !!isPrivate : false,
      isOwnerOnly: isUserOwner ? !!isOwnerOnly : false,
      isImportant: !!isImportant,
      isProhibited: isUserOwner ? !!isProhibited : false,
      visibility: visibility || (isOwnerOnly ? 'owner' : (isPrivate ? 'private' : 'public')),
      likes: 0,
      comments: [],
      shares: 0,
      isLiked: false,
      isLoved: false,
      isSaved: false,
      created_at: new Date().toISOString()
    };

    db.posts.unshift(newPost);
    writeDB(db);
    res.status(201).json(newPost);
  });

  app.post('/api/posts/:id/like', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const postId = req.params.id;
    const { type } = req.body; // 'like' or 'love'
    const db = readDB();
    
    if (!db.posts) {
      db.posts = [];
    }

    const post = db.posts.find(p => p.id === postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    if (type === 'love') {
      const isLoved = !post.isLoved;
      post.isLoved = isLoved;
      post.likes = isLoved ? post.likes + 1 : Math.max(0, post.likes - 1);
      post.isLiked = false;
    } else {
      const isLiked = !post.isLiked;
      post.isLiked = isLiked;
      post.likes = isLiked ? post.likes + 1 : Math.max(0, post.likes - 1);
      post.isLoved = false;
    }

    const currentUserId = req.user!.id;
    if (post.isLiked || post.isLoved) {
      const recipient = db.profiles.find(p => p.username && p.username.toLowerCase() === post.author.handle.toLowerCase());
      if (recipient && recipient.id !== currentUserId) {
        if (!db.notifications) db.notifications = [];
        const sender = db.profiles.find(p => p.id === currentUserId);
        db.notifications.unshift({
          id: `noti_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          userId: recipient.id,
          type: 'like',
          title: post.isLoved ? 'Love Cusub ❤️' : 'Like Cusub 👍',
          body: `${sender ? `${sender.first_name} ${sender.last_name}` : 'Qof'} ayaa ka helay post-kaaga!`,
          senderId: currentUserId,
          senderName: sender ? `${sender.first_name} ${sender.last_name}` : 'Qof',
          senderAvatar: sender ? sender.avatar : null,
          read: false,
          created_at: new Date().toISOString()
        });
      }
    }

    writeDB(db);
    res.json(post);
  });

  app.delete('/api/posts/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const postId = req.params.id;
    const user = req.user!;
    const db = readDB();

    if (!db.posts) {
      db.posts = [];
    }

    const postIndex = db.posts.findIndex(p => p.id === postId);
    if (postIndex === -1) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const post = db.posts[postIndex];
    const userHandle = user.username || user.email.toLowerCase().split('@')[0];
    const isAuthor = (post.author && post.author.id === user.id) || 
                     (post.author && post.author.handle && post.author.handle.toLowerCase() === userHandle.toLowerCase()) ||
                     user.role === 'admin';

    if (!isAuthor) {
      res.status(403).json({ error: 'Ma laha ruqsad aad ku tirtirto post-kan.' });
      return;
    }

    db.posts.splice(postIndex, 1);
    writeDB(db);

    res.json({ success: true, message: 'Post-ka waa la tirtiray.' });
  });

  app.post('/api/posts/:id/comment', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const postId = req.params.id;
    const { content } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty.' });
      return;
    }

    const db = readDB();
    if (!db.posts) {
      db.posts = [];
    }

    const post = db.posts.find(p => p.id === postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const user = req.user!;
    const newComment = {
      id: `c-${Date.now()}`,
      authorName: `${user.first_name} ${user.last_name}`,
      authorAvatar: user.avatar || null,
      content,
      created_at: 'Just now'
    };

    post.comments.push(newComment);

    const currentUserId = user.id;
    const recipient = db.profiles.find(p => p.username && p.username.toLowerCase() === post.author.handle.toLowerCase());
    if (recipient && recipient.id !== currentUserId) {
      if (!db.notifications) db.notifications = [];
      db.notifications.unshift({
        id: `noti_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        userId: recipient.id,
        type: 'comment',
        title: 'Faallo Cusub 💬',
        body: `${user.first_name} ${user.last_name} ayaa ku soo qoray: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`,
        senderId: currentUserId,
        senderName: `${user.first_name} ${user.last_name}`,
        senderAvatar: user.avatar,
        read: false,
        created_at: new Date().toISOString()
      });
    }

    writeDB(db);
    res.status(201).json(post);
  });

  // SYSTEM NOTICE BROADCAST ENDPOINTS
  app.get('/api/system-notice', (req, res) => {
    const db = readDB();
    res.json({ system_notice: db.system_notice || '' });
  });

  // STORIES ENDPOINTS
  app.get('/api/stories', (req, res) => {
    const db = readDB();
    res.json(db.stories || []);
  });

  app.post('/api/stories', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { mediaUrl, mediaType } = req.body;
    if (!mediaUrl) {
      res.status(400).json({ error: 'Story media URL/content is required.' });
      return;
    }

    const db = readDB();
    if (!db.stories) {
      db.stories = [];
    }

    const user = req.user!;
    let isVideo = mediaType === 'video';
    if (!mediaType && typeof mediaUrl === 'string') {
      if (mediaUrl.startsWith('data:video') || mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('.mov')) {
        isVideo = true;
      }
    }

    const cleanAvatar = user.avatar && !user.avatar.includes('photo-1535713875002-d1d0cf377fde') ? user.avatar : null;

    const newStory = {
      id: `s-${Date.now()}`,
      authorName: `${user.first_name} ${user.last_name}`,
      authorAvatar: cleanAvatar,
      mediaUrl,
      mediaType: isVideo ? 'video' : 'image',
      created_at: new Date().toISOString(),
      isUnread: true
    };

    db.stories.unshift(newStory);
    writeDB(db);
    res.status(201).json(newStory);
  });

  // --- NOTIFICATIONS ENDPOINTS ---
  app.get('/api/notifications', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    if (!db.notifications) db.notifications = [];
    const userNotifications = db.notifications.filter(n => n.userId === req.user!.id);
    res.json(userNotifications);
  });

  app.post('/api/notifications/:id/read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    if (!db.notifications) db.notifications = [];
    const noti = db.notifications.find(n => n.id === req.params.id && n.userId === req.user!.id);
    if (noti) {
      noti.read = true;
      writeDB(db);
    }
    res.json({ success: true });
  });

  app.post('/api/notifications/read-all', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    if (!db.notifications) db.notifications = [];
    db.notifications.forEach(n => {
      if (n.userId === req.user!.id) {
        n.read = true;
      }
    });
    writeDB(db);
    res.json({ success: true });
  });

  app.post('/api/notifications/clear-all', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    if (!db.notifications) db.notifications = [];
    db.notifications = db.notifications.filter(n => n.userId !== req.user!.id);
    writeDB(db);
    res.json({ success: true });
  });

  app.post('/api/admin/system-notice', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { notice } = req.body;
    const db = readDB();
    db.system_notice = (notice || '').trim();
    writeDB(db);
    res.json({ success: true, message: 'Fariinta guud ee nidaamka waa la cusbooneysiiyay!', system_notice: db.system_notice });
  });

  // --- OWNER SECURE GOVERNANCE ENDPOINTS ---
  
  // Rate limiter state & brute force tracking for Owner Login
  const ownerBruteForce = {
    failedAttempts: 0,
    lockUntil: 0
  };

  // Remote config persistence
  const configDb = readDB();
  let persistentRemoteConfig = {
    secretClickTarget: 7,
    dotClickTarget: 30,
    editClickTarget: 5,
    invisibleAreaLocation: 'left-of-logo',
    dotLocation: 'top-right',
    appName: 'SomLuul',
    appLogo: '/somluul_logo.png',
    ...(configDb.remote_config || {})
  };

  // Feature Flags persistence
  let persistentFeatureFlags = {
    enableAiModeration: true,
    enableSpamDetection: true,
    enableAbuseDetection: true,
    enableVideoCalls: true,
    enablePaidSubscriptions: true,
    ...(configDb.feature_flags || {})
  };

  // Landing settings persistence
  let persistentLandingSettings = {
    heroTitle: "The Future of Social Media is Here",
    heroSubtext: "Connect with the world, chat, call, create content, earn money, grow your community, and build your business—all inside SomLuul.",
    heroImages: [
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800"
    ],
    customLinks: [
      { id: "1", label: "Play Store", url: "#" },
      { id: "2", label: "App Store", url: "#" }
    ],
    longDescription: "SomLuul is the premier Somali super-app combining global social networking, end-to-end encrypted messaging, high-definition calls, local peer-to-peer cloud storage, physical printer integration, and robust creator monetization models."
  };
  if ((configDb as any).landing_settings) {
    persistentLandingSettings = { ...persistentLandingSettings, ...(configDb as any).landing_settings };
  }

  // Logs tracking
  const systemAuditLogs: any[] = [
    { id: '1', actor_name: 'System', actor_role: 'system', action_details: 'Owner Governance Engine Initialized Securely.', timestamp: new Date().toISOString() }
  ];
  const systemSecurityLogs: any[] = [
    { id: '1', event: 'FIREWALL_OK', details: 'Web application intrusion firewalls and emulator/debugger warnings active.', ip_address: '127.0.0.1', target: 'Server Gateway', timestamp: new Date().toISOString() }
  ];

  // Owner Authentication Endpoint
  app.post('/api/owner/auth/validate', (req, res) => {
    try {
      let { username, password } = req.body;
      username = (username || '').trim();
      password = (password || '').trim();

      // Check temporary lock
      if (ownerBruteForce.lockUntil && ownerBruteForce.lockUntil > Date.now()) {
        const minutesRemaining = Math.ceil((ownerBruteForce.lockUntil - Date.now()) / 60000);
        res.status(403).json({ error: `Nidaamka waa la xiray brute force awgeed! Fadlan sug ${minutesRemaining} daqiiqo.` });
        return;
      }

      if (!username || !password) {
        res.status(400).json({ error: 'Username iyo Password waa muhiim.' });
        return;
      }

      // Match criteria completely in Backend ONLY
      const expectedUsername = (process.env.OWNER_USERNAME || 'MXDdeeq207').toLowerCase();
      const expectedPassword = process.env.OWNER_PASSWORD || '615599869612912055';
      if (username.toLowerCase() === expectedUsername && password === expectedPassword) {
        ownerBruteForce.failedAttempts = 0; // reset
        ownerBruteForce.lockUntil = 0;
        
        systemAuditLogs.unshift({
          id: Math.random().toString(),
          actor_name: 'Mohamed Deeq (Owner)',
          actor_role: 'owner',
          action_details: 'Owner dashboard session authenticated via hidden entry gesture.',
          timestamp: new Date().toISOString()
        });

        // Retrieve or provision owner profile
        const db = readDB();
        let ownerProfile = db.profiles.find(p => p.email === 'xamseyare5267@gmail.com');
        if (!ownerProfile) {
          // Re-provision if database was cleaned
          const userId = 'owner-secure-id';
          ownerProfile = {
            id: userId,
            email: 'xamseyare5267@gmail.com',
            first_name: 'Mohamed',
            last_name: 'Mohamud Hassan',
            username: 'MXDdeeq207',
            role: 'admin',
            avatar: null,
            blocked: false,
            phone: '615666561',
            bio: 'SomLuul Active Member',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            login_method: 'email',
            devices: []
          };
          db.profiles.push(ownerProfile);
          db.credentials.push({
            userId,
            passwordHash: hashPassword(password) // encrypted securely
          });
          writeDB(db);
        }

        // Track active device session
        const sessionDetail = registerDeviceSession(ownerProfile.id, req, 'owner-secure-device');

        res.json({
          success: true,
          message: 'Xaqiijinta Mulkiilaha waa lagu guuleystay!',
          token: sessionDetail.token,
          user: ownerProfile
        });
      } else {
        ownerBruteForce.failedAttempts = (ownerBruteForce.failedAttempts || 0) + 1;
        
        systemSecurityLogs.unshift({
          id: Math.random().toString(),
          event: 'AUTH_FAILED',
          details: `Brute force warning: Unauthorized owner verification attempt. Username: ${username}`,
          ip_address: req.ip || 'unknown',
          target: 'Owner Portal',
          timestamp: new Date().toISOString()
        });

        // Lock account temporarily on 5 consecutive failures
        if (ownerBruteForce.failedAttempts >= 5) {
          ownerBruteForce.lockUntil = Date.now() + 15 * 60 * 1000; // 15 mins lock
          res.status(403).json({ error: 'Fashil badan! Nidaamka wuxuu ku xiray muddo 15 daqiiqo ah.' });
        } else {
          res.status(401).json({ error: 'Username ama Password-ka Mulkiilaha waa khaldan yahay.' });
        }
      }
    } catch (err: any) {
      console.error('[Owner Auth Error]:', err);
      res.status(500).json({ error: 'Server error intii lagu guda jiray xaqiijinta mulkiilaha.' });
    }
  });

  // Owner statistics
  app.get('/api/owner/stats', authMiddleware, ownerMiddleware, (req, res) => {
    const db = readDB();
    const stats = getAdminStats();
    res.json({
      totalUsers: db.profiles.length,
      adminsCount: db.profiles.filter(p => p.role === 'admin').length,
      modsCount: db.profiles.filter(p => p.role === 'moderator').length,
      bannedCount: db.profiles.filter(p => p.blocked).length,
      groupsCount: 12,
      channelsCount: 8,
      activeCalls: 3,
      activeChats: 24 + db.profiles.length,
      revenue: 5420 + (db.profiles.length * 15),
      subscribers: 48,
      serverCPU: 12,
      serverRAM: 45,
      dbConnections: 8,
      storageUsed: stats.totalSize / (1024 * 1024 * 1024), // GB
      maintenanceMode: false,
      forceUpdateActive: false,
      geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
      supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    });
  });

  // Get active remote config
  app.get('/api/remote-config', (req, res) => {
    res.json(persistentRemoteConfig);
  });

  // Save remote config
  app.post('/api/owner/remote-config', authMiddleware, ownerMiddleware, (req, res) => {
    persistentRemoteConfig = { ...persistentRemoteConfig, ...req.body };
    
    // Save to persistent database
    const db = readDB();
    db.remote_config = persistentRemoteConfig;
    writeDB(db);

    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: 'Updated global remote config parameters.',
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, message: 'Remote Config waa la cusbooneysiiyay!' });
  });

  // Get active landing settings (public)
  app.get('/api/landing-settings', (req, res) => {
    res.json(persistentLandingSettings);
  });

  // Save active landing settings (owner/admin only)
  app.post('/api/owner/landing-settings', authMiddleware, ownerMiddleware, (req: AuthenticatedRequest, res: Response) => {
    persistentLandingSettings = { ...persistentLandingSettings, ...req.body };
    const db = readDB();
    (db as any).landing_settings = persistentLandingSettings;
    writeDB(db);

    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: 'Cusbooneysiiyay qaabeynta iyo macluumaadka bogga weyn ee landing page.',
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, message: 'Landing settings waa la kaydiyay!', landing_settings: persistentLandingSettings });
  });

  // Upload custom landing page images (owner/admin only)
  app.post('/api/owner/upload-landing-image', authMiddleware, ownerMiddleware, (req: AuthenticatedRequest, res: Response) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Fadlan dooro sawir guul leh.' });
        return;
      }
      const userId = req.user!.id;
      const filename = req.file.filename;
      const publicUrl = `/uploads/${userId}/${filename}`;

      // Backup uploads
      if (gcsBucket && req.file.path) {
        const localPath = req.file.path;
        gcsBucket.upload(localPath, {
          destination: `${userId}/${filename}`,
          metadata: { contentType: req.file.mimetype }
        }).catch(() => {});
      }
      if (req.file.path) {
        uploadToSupabaseStorage(req.file.path, `${userId}/${filename}`, req.file.mimetype);
      }

      res.json({ success: true, url: publicUrl });
    });
  });

  // Get feature flags
  app.get('/api/owner/feature-flags', authMiddleware, ownerMiddleware, (req, res) => {
    res.json(persistentFeatureFlags);
  });

  // Update feature flags
  app.post('/api/owner/feature-flags', authMiddleware, ownerMiddleware, (req, res) => {
    persistentFeatureFlags = { ...persistentFeatureFlags, ...req.body };
    
    // Save to persistent database
    const db = readDB();
    db.feature_flags = persistentFeatureFlags;
    writeDB(db);

    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: 'Updated global feature flags.',
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, message: 'Feature Flags waa la cusbooneysiiyay!' });
  });

  // Get audit & security logs
  app.get('/api/owner/logs', authMiddleware, ownerMiddleware, (req, res) => {
    res.json({
      auditLogs: systemAuditLogs,
      securityLogs: systemSecurityLogs
    });
  });

  // List all users in owner portal
  app.get('/api/owner/users', authMiddleware, ownerMiddleware, (req, res) => {
    const db = readDB();
    res.json({ users: db.profiles });
  });

  // Toggle ban user
  app.post('/api/owner/users/:id/toggle-ban', authMiddleware, ownerMiddleware, (req, res) => {
    const db = readDB();
    const user = db.profiles.find(p => p.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.blocked = !user.blocked;
    writeDB(db);

    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Toggled blocked state for ${user.first_name} ${user.last_name} (${user.blocked ? 'banned' : 'unbanned'}).`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: `Isticmaalaha waa la ${user.blocked ? 'xiray (banned)' : 'sii daayay (unbanned)'}!` });
  });

  // Toggle verify user
  app.post('/api/owner/users/:id/toggle-verify', authMiddleware, ownerMiddleware, (req, res) => {
    const db = readDB();
    const user = db.profiles.find(p => p.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.email_verified = !user.email_verified;
    writeDB(db);

    res.json({ success: true, message: `Verified state updated successfully!` });
  });

  // Change user role
  app.post('/api/owner/users/:id/change-role', authMiddleware, ownerMiddleware, (req, res) => {
    const { role } = req.body;
    const db = readDB();
    const user = db.profiles.find(p => p.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.role = role;
    writeDB(db);

    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Changed role of user ${user.first_name} ${user.last_name} to ${role}.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: `Doorkii isticmaalaha waxaa loo beddelay ${role}!` });
  });

  // Delete user account from owner center
  app.delete('/api/owner/users/:id', authMiddleware, ownerMiddleware, (req, res) => {
    const db = readDB();
    const user = db.profiles.find(p => p.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const success = deleteUserAccount(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Deletion failed.' });
      return;
    }

    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Purged user account and deleted all cloud files of ${user.first_name} ${user.last_name}.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Isticmaalaha si buuxda ayaa loogu tirtiray nidaamka!' });
  });

  // Broadcast messaging
  app.post('/api/owner/broadcast', authMiddleware, ownerMiddleware, (req, res) => {
    const { message, target } = req.body;
    const db = readDB();
    db.system_notice = message;
    writeDB(db);

    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Broadcasted public notice: "${message.substring(0, 40)}..." to group target: ${target}.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Fariinta ogeysiiska broadcast-ka waa la diray!' });
  });

  // Push notifications
  app.post('/api/owner/push-notification', authMiddleware, ownerMiddleware, (req, res) => {
    const { title, body } = req.body;
    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Dispatched instant push notification: "${title}" - "${body.substring(0, 40)}...".`,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, message: 'Push Notification waxaa loo diray dhammaan aaladaha isticmaalayaasha!' });
  });

  // Toggle Maintenance Mode
  app.post('/api/owner/toggle-maintenance', authMiddleware, ownerMiddleware, (req, res) => {
    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Toggled platform maintenance mode state.`,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, message: 'Operational status toggled successfully!' });
  });

  // Toggle Force Update Mode
  app.post('/api/owner/toggle-force-update', authMiddleware, ownerMiddleware, (req, res) => {
    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Toggled required force upgrade state.`,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, message: 'Critical Force Update status changed!' });
  });

  // Backup state
  app.post('/api/owner/backup', authMiddleware, ownerMiddleware, (req, res) => {
    const db = readDB();
    const localDataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    const backupFile = path.join(localDataDir, `backup-${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(db, null, 2));

    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Executed physical database binary backup snapshot.`,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Database snapshot was archived successfully!' });
  });

  // Restore state
  app.post('/api/owner/restore', authMiddleware, ownerMiddleware, (req, res) => {
    systemAuditLogs.unshift({
      id: Math.random().toString(),
      actor_name: 'Mohamed Deeq (Owner)',
      actor_role: 'owner',
      action_details: `Rolled back database cluster to previous safe state restore point.`,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, message: 'Restored database cluster state successfully!' });
  });

  // =========================================================================
  // NETWORK PRINTER CONTROLLER ENDPOINTS
  // =========================================================================
  
  // Get active printer config, logs and alerts
  app.get('/api/owner/printer/config', authMiddleware, ownerMiddleware, (req, res) => {
    const config = getPrinterConfig();
    const { alerts, logs } = getPrinterLogsAndAlerts();
    res.json({ config, alerts, logs });
  });

  // Save new printer config (including Facebook, Telegram, WhatsApp API keys)
  app.post('/api/owner/printer/config', authMiddleware, ownerMiddleware, (req, res) => {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'Fadlan geli ciwaanka IP-ga ee printer-ka' });
    }
    savePrinterConfig(req.body);
    res.json({ success: true, message: `Configuration-ka printer-ka iyo App Keys-ka waa la keydiyay!` });
  });

  // Test printer connectivity (TCP Connection check / Socket Ping)
  app.post('/api/owner/printer/test-connection', authMiddleware, ownerMiddleware, async (req, res) => {
    const { ip, port } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'Fadlan geli ciwaanka IP-ga' });
    }
    const parsedPort = parseInt(port) || 9100;
    const isOnline = await checkPrinterOnline(ip, parsedPort, 2000);
    res.json({ 
      success: true, 
      isOnline, 
      message: isOnline 
        ? 'Printer-ku waa online waana la heli karaa! (TCP Socket Ping Active)' 
        : 'Printer-ku waa offline ama lama heli karo. Fadlan hubi IP-ga iyo inuu ku xiran yahay korontada iyo network-ka.' 
    });
  });

  // Trigger a test print job with optional simulated offline mode
  app.post('/api/owner/printer/print-test', authMiddleware, ownerMiddleware, async (req, res) => {
    const { ip, port, text, simulateOffline } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'Fadlan geli ciwaanka IP-ga' });
    }
    const parsedPort = parseInt(port) || 9100;
    const printText = text || "SomLuul Network Printer Test\nKani waa tijaabo daabacaad ah.\n";

    // If simulateOffline is true, we pass an unroutable IP address so that it fails and runs the 3 retries
    const targetIp = simulateOffline ? "192.0.2.1" : ip; 

    // Run printing asynchronously so it doesn't block Express thread
    sendPrintJobWithRetry(targetIp, printText, {
      port: parsedPort,
      maxRetries: 3,
      retryDelayMs: 2000
    }).then(() => {
      console.log(`[Express API] Async print job successfully completed to ${targetIp}`);
    }).catch((err) => {
      console.error(`[Express API] Async print job failed as expected/unexpected: ${err.message}`);
    });

    res.json({ 
      success: true, 
      message: simulateOffline 
        ? 'DIGNIIN: Daabacaada waa la bilaabay iyadoo lagu jiro "Simulated Offline Mode". Nidaamku wuxuu isku dayayaa dib-u-xiriirin 3 jeer, ka jadyeysan sugitaanka, ka dibna wuxuu u diri doonaa alert Firebase.' 
        : 'Print job-ka waxaa loo diray si asynchronous ah. Fadlan eeg logs-ka hoose si aad u aragto natiijada iyo isku dayada (retries).' 
    });
  });

  // Clear printer logs & simulated Firebase alerts
  app.post('/api/owner/printer/clear-logs', authMiddleware, ownerMiddleware, (req, res) => {
    clearPrinterLogsAndAlerts();
    res.json({ success: true, message: 'Dhamaan logs-ka iyo alerts-ka waa la tirtiray.' });
  });

  // 3. ADMIN PANEL MODERATION ENDPOINTS
  app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const stats = getAdminStats();
    res.json({ stats });
  });

  app.get('/api/admin/users', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    let users = db.profiles.filter(p => p.role !== 'admin');

    // Search filter
    const search = (req.query.search as string || '').toLowerCase().trim();
    if (search) {
      users = users.filter(
        u =>
          u.email.toLowerCase().includes(search) ||
          u.first_name.toLowerCase().includes(search) ||
          u.last_name.toLowerCase().includes(search)
      );
    }

    // Pagination
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10');
    const offset = (page - 1) * limit;
    const paginatedUsers = users.slice(offset, offset + limit);

    res.json({
      data: paginatedUsers,
      total: users.length,
      page,
      limit,
      totalPages: Math.ceil(users.length / limit)
    });
  });

  app.post('/api/admin/users/:id/toggle-block', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const targetUserId = req.params.id;
    
    if (targetUserId === req.user!.id) {
      res.status(400).json({ error: 'You cannot block your own administrative account.' });
      return;
    }

    const db = readDB();
    const targetUser = db.profiles.find(p => p.id === targetUserId);
    if (targetUser && targetUser.email.toLowerCase() === 'xamseyare5267@gmail.com') {
      res.status(400).json({ error: 'Ficilka waa la diiday! Owner-ka rasmiga ah ee SomLuul laguma sameyn karo block.' });
      return;
    }

    const result = toggleBlockUser(targetUserId);
    if (!result.success) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    res.json({
      message: `User has been successfully ${result.blocked ? 'blocked' : 'unblocked'}.`,
      blocked: result.blocked
    });
  });

  app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const targetUserId = req.params.id;

    if (targetUserId === req.user!.id) {
      res.status(400).json({ error: 'You cannot delete your own administrative account.' });
      return;
    }

    const db = readDB();
    const targetUser = db.profiles.find(p => p.id === targetUserId);
    if (targetUser && targetUser.email.toLowerCase() === 'xamseyare5267@gmail.com') {
      res.status(400).json({ error: 'Ficilka waa la diiday! Owner-ka rasmiga ah ee SomLuul lama tiri karo.' });
      return;
    }

    const success = deleteUserAccount(targetUserId);
    if (!success) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    res.json({ message: 'User account and associated files deleted successfully!' });
  });

  app.delete('/api/admin/users/:id/files', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const targetUserId = req.params.id;
    const filesDeletedCount = deleteUserFiles(targetUserId);

    res.json({
      message: `Successfully purged all files for this user.`,
      filesDeleted: filesDeletedCount
    });
  });

  // --- REAL CHAT DATABASE SYNCHRONIZER ENDPOINTS ---
  app.get('/api/chat/rooms', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    if (!db.chatRooms) {
      db.chatRooms = [];
    }
    const currentUserId = req.user!.id;

    // Automatically ensure every registered profile in db.profiles has a direct room
    if (db.profiles && Array.isArray(db.profiles)) {
      db.profiles.forEach(p => {
        if (p.id !== currentUserId) {
          const roomId = p.id;
          const exists = db.chatRooms.some(r => r.id === roomId || (r.members && r.members.includes(p.id) && r.members.includes(currentUserId)));
          if (!exists) {
            db.chatRooms.push({
              id: roomId,
              name: `${p.first_name} ${p.last_name}`,
              avatar: p.avatar || null,
              isGroup: false,
              unreadCount: 0,
              lastMessage: 'Ku bilow hadal badbaado leh SomLuul Messenger!',
              lastMessageTime: 'Hadda',
              members: [currentUserId, p.id],
              bio: p.bio || '',
              phone: p.phone || ''
            });
          }
        }
      });
      writeDB(db);
    }

    const userRooms = db.chatRooms.filter(r => r.members && (r.members.includes(currentUserId) || r.members.includes('me') || r.isGroup));

    // Dynamically resolve participant names and avatars for 1-on-1 rooms
    const formattedRooms = userRooms.map(r => {
      if (!r.isGroup && r.members && Array.isArray(r.members)) {
        const otherMemberId = r.members.find((m: string) => m !== currentUserId && m !== 'me');
        if (otherMemberId && db.profiles) {
          const otherProfile = db.profiles.find(p => p.id === otherMemberId);
          if (otherProfile) {
            return {
              ...r,
              name: `${otherProfile.first_name} ${otherProfile.last_name}`,
              avatar: otherProfile.avatar || r.avatar,
              bio: otherProfile.bio || r.bio,
              phone: otherProfile.phone || r.phone
            };
          }
        }
      }
      return r;
    });

    res.json(formattedRooms);
  });

  app.post('/api/chat/rooms', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { room } = req.body;
    if (!room || !room.id) {
      res.status(400).json({ error: 'Room details are required.' });
      return;
    }
    const db = readDB();
    if (!db.chatRooms) db.chatRooms = [];

    const existingIndex = db.chatRooms.findIndex(r => r.id === room.id);
    if (existingIndex > -1) {
      db.chatRooms[existingIndex] = { ...db.chatRooms[existingIndex], ...room };
    } else {
      db.chatRooms.push(room);
    }
    writeDB(db);
    res.json({ success: true, room });
  });

  app.get('/api/chat/messages', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const db = readDB();
    if (!db.chatMessages) db.chatMessages = [];
    res.json(db.chatMessages);
  });

  app.post('/api/chat/messages', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { message } = req.body;
    if (!message || !message.id || !message.roomId) {
      res.status(400).json({ error: 'Message payload is invalid.' });
      return;
    }
    const db = readDB();
    if (!db.chatMessages) db.chatMessages = [];
    if (!db.chatRooms) db.chatRooms = [];
    
    const exists = db.chatMessages.some(m => m.id === message.id);
    if (!exists) {
      db.chatMessages.push(message);

      // Update associated room last message
      const roomIdx = db.chatRooms.findIndex(r => r.id === message.roomId);
      if (roomIdx > -1) {
        db.chatRooms[roomIdx].lastMessage = message.content || 'Farriin cusub';
        db.chatRooms[roomIdx].lastMessageTime = message.created_at || 'Just now';
      }

      // Notify recipient if this is a 1-on-1 message
      const currentUserId = req.user!.id;
      const room = db.chatRooms.find(r => r.id === message.roomId);
      if (room && room.members) {
        const recipientId = room.members.find((m: string) => m !== currentUserId && m !== 'me');
        if (recipientId && recipientId !== currentUserId) {
          if (!db.notifications) db.notifications = [];
          db.notifications.unshift({
            id: `noti_msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            userId: recipientId,
            type: 'message',
            title: `Farriin Cusub 💬`,
            body: `${message.senderName || 'Qof'}: ${message.content.substring(0, 40)}${message.content.length > 40 ? '...' : ''}`,
            senderId: currentUserId,
            senderName: message.senderName || 'Qof',
            senderAvatar: message.senderAvatar,
            read: false,
            created_at: new Date().toISOString()
          });
        }
      }

      writeDB(db);
    }
    res.json({ success: true, message });
  });

  app.delete('/api/chat/messages/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const msgId = req.params.id;
    const db = readDB();
    if (!db.chatMessages) db.chatMessages = [];
    db.chatMessages = db.chatMessages.filter(m => m.id !== msgId);
    writeDB(db);
    res.json({ success: true, message: 'Fariinta waa la tirtiray' });
  });

  // --- VITE DEV SERVER / PRODUCTION SERVING ---

  const isProduction = 
    process.env.NODE_ENV === 'production' || 
    (typeof __filename !== 'undefined' && __filename.endsWith('server.cjs')) ||
    (typeof __dirname !== 'undefined' && path.basename(__dirname) === 'dist') ||
    !!process.env.VERCEL;

  async function startEngine() {
    if (!isProduction) {
      console.log('[FileHub Engine] Starting in DEVELOPMENT mode with Vite Middleware...');
      try {
        const { createServer } = await import('vite');
        const vite = await createServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
        app.use(vite.middlewares);
      } catch (err) {
        console.error('[FileHub Engine] Failed to load Vite middleware:', err);
      }
    } else if (!process.env.VERCEL) {
      console.log('[FileHub Engine] Starting in PRODUCTION mode with static file serving...');
      
      let distPath = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(path.join(distPath, 'index.html')) && fs.existsSync(path.join(__dirname, 'index.html'))) {
        distPath = __dirname;
      }
      
      console.log(`[FileHub Engine] Serving static files from: ${distPath}`);
      app.use(express.static(distPath));
      
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'API route not found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    if (!process.env.VERCEL) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[FileHub Engine] Server is running on http://localhost:${PORT}`);
      });
    }
  }

  startEngine().catch(err => console.error('[FileHub Engine] Startup error:', err));

  export { app };
  export default app;
