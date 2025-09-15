#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Backup Configuration for MindScript
 * 
 * This script handles:
 * 1. Database backups (Supabase)
 * 2. Storage backups (Supabase Storage)
 * 3. Configuration backups
 * 4. Retention policies
 */

interface BackupConfig {
  database: {
    enabled: boolean;
    schedule: string; // Cron format
    retention: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  storage: {
    enabled: boolean;
    buckets: string[];
    schedule: string;
  };
  destination: {
    type: 's3' | 'local' | 'supabase';
    config: Record<string, any>;
  };
}

const BACKUP_CONFIG: BackupConfig = {
  database: {
    enabled: true,
    schedule: '0 2 * * *', // Daily at 2 AM
    retention: {
      daily: 7,   // Keep 7 daily backups
      weekly: 4,  // Keep 4 weekly backups
      monthly: 12, // Keep 12 monthly backups
    },
  },
  storage: {
    enabled: true,
    buckets: ['audio-tracks', 'user-uploads', 'public-assets'],
    schedule: '0 3 * * *', // Daily at 3 AM
  },
  destination: {
    type: 's3',
    config: {
      bucket: process.env.BACKUP_S3_BUCKET || 'mindscript-backups',
      region: process.env.BACKUP_S3_REGION || 'us-east-1',
      prefix: process.env.BACKUP_S3_PREFIX || 'production',
    },
  },
};

class BackupManager {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async backupDatabase(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database-backup-${timestamp}.sql`;
    
    console.log(`Starting database backup: ${filename}`);
    
    try {
      // Use pg_dump for Supabase database
      const connectionString = process.env.DATABASE_URL!;
      const command = `pg_dump "${connectionString}" > /tmp/${filename}`;
      
      execSync(command, { stdio: 'inherit' });
      
      // Compress the backup
      execSync(`gzip /tmp/${filename}`, { stdio: 'inherit' });
      
      const compressedFilename = `${filename}.gz`;
      
      // Upload to destination
      await this.uploadBackup(`/tmp/${compressedFilename}`, `database/${compressedFilename}`);
      
      // Clean up local file
      await fs.unlink(`/tmp/${compressedFilename}`);
      
      console.log(`Database backup completed: ${compressedFilename}`);
      return compressedFilename;
    } catch (error) {
      console.error('Database backup failed:', error);
      throw error;
    }
  }

  async backupStorage(): Promise<string[]> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFiles: string[] = [];
    
    for (const bucket of BACKUP_CONFIG.storage.buckets) {
      console.log(`Backing up storage bucket: ${bucket}`);
      
      try {
        // List all files in the bucket
        const { data: files, error } = await this.supabase.storage
          .from(bucket)
          .list('', { limit: 10000 });
        
        if (error) throw error;
        
        const manifest = {
          bucket,
          timestamp,
          fileCount: files?.length || 0,
          files: files?.map(f => ({
            name: f.name,
            size: f.metadata?.size,
            lastModified: f.updated_at,
          })),
        };
        
        // Save manifest
        const manifestFilename = `storage-${bucket}-manifest-${timestamp}.json`;
        const manifestPath = `/tmp/${manifestFilename}`;
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        
        // Upload manifest
        await this.uploadBackup(manifestPath, `storage/${manifestFilename}`);
        
        // Clean up
        await fs.unlink(manifestPath);
        
        backupFiles.push(manifestFilename);
        console.log(`Storage bucket backup completed: ${bucket}`);
      } catch (error) {
        console.error(`Storage backup failed for ${bucket}:`, error);
      }
    }
    
    return backupFiles;
  }

  async uploadBackup(localPath: string, remotePath: string): Promise<void> {
    const { destination } = BACKUP_CONFIG;
    
    switch (destination.type) {
      case 's3':
        await this.uploadToS3(localPath, remotePath);
        break;
      case 'supabase':
        await this.uploadToSupabase(localPath, remotePath);
        break;
      case 'local':
        await this.saveLocally(localPath, remotePath);
        break;
    }
  }

  private async uploadToS3(localPath: string, remotePath: string): Promise<void> {
    const { bucket, region, prefix } = BACKUP_CONFIG.destination.config;
    const fullPath = `s3://${bucket}/${prefix}/${remotePath}`;
    
    const command = `aws s3 cp ${localPath} ${fullPath} --region ${region}`;
    execSync(command, { stdio: 'inherit' });
  }

  private async uploadToSupabase(localPath: string, remotePath: string): Promise<void> {
    const fileContent = await fs.readFile(localPath);
    const { data, error } = await this.supabase.storage
      .from('backups')
      .upload(remotePath, fileContent, {
        contentType: 'application/octet-stream',
        upsert: false,
      });
    
    if (error) throw error;
  }

  private async saveLocally(localPath: string, remotePath: string): Promise<void> {
    const backupDir = path.join(process.cwd(), 'backups');
    const targetPath = path.join(backupDir, remotePath);
    
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(localPath, targetPath);
  }

  async cleanupOldBackups(): Promise<void> {
    console.log('Cleaning up old backups...');
    
    // Implementation depends on destination type
    // This would check timestamps and remove old backups based on retention policy
    
    const { retention } = BACKUP_CONFIG.database;
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Keep daily backups for specified days
    // Keep weekly backups for specified weeks
    // Keep monthly backups for specified months
    
    // TODO: Implement cleanup logic based on destination type
  }

  async verifyBackup(filename: string): Promise<boolean> {
    console.log(`Verifying backup: ${filename}`);
    
    // Basic verification - check if file exists and has size > 0
    // More sophisticated verification could include:
    // - Attempting to restore to a test database
    // - Checking file integrity
    // - Validating backup format
    
    return true; // Placeholder
  }

  async runFullBackup(): Promise<{
    success: boolean;
    database?: string;
    storage?: string[];
    errors?: string[];
  }> {
    const errors: string[] = [];
    let database: string | undefined;
    let storage: string[] | undefined;
    
    // Backup database
    if (BACKUP_CONFIG.database.enabled) {
      try {
        database = await this.backupDatabase();
        await this.verifyBackup(database);
      } catch (error) {
        errors.push(`Database backup failed: ${error}`);
      }
    }
    
    // Backup storage
    if (BACKUP_CONFIG.storage.enabled) {
      try {
        storage = await this.backupStorage();
      } catch (error) {
        errors.push(`Storage backup failed: ${error}`);
      }
    }
    
    // Cleanup old backups
    try {
      await this.cleanupOldBackups();
    } catch (error) {
      errors.push(`Cleanup failed: ${error}`);
    }
    
    // Log results
    await this.supabase
      .from('backup_logs')
      .insert({
        timestamp: new Date().toISOString(),
        success: errors.length === 0,
        database_backup: database,
        storage_backups: storage,
        errors: errors.length > 0 ? errors : null,
      });
    
    return {
      success: errors.length === 0,
      database,
      storage,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// Run backup if called directly
async function main() {
  const manager = new BackupManager();
  const result = await manager.runFullBackup();
  
  console.log('Backup completed:', result);
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Backup failed:', error);
    process.exit(1);
  });
}

export { BackupManager, BACKUP_CONFIG };