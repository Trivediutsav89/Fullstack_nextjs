/**
 * @fileoverview Request validation schemas and utilities using Zod
 * Provides runtime validation for API requests and forms
 */

import { z } from 'zod';

// =============================================================================
// COMMON VALIDATION SCHEMAS
// =============================================================================

export const idSchema = z.string().uuid('Invalid ID format').or(z.string().regex(/^\d+$/, 'Invalid ID format'));

export const emailSchema = z.string().email('Invalid email address').toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const urlSchema = z.string().url('Invalid URL format');

export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only');

export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
  .min(10, 'Phone number too short');

// =============================================================================
// AUTHENTICATION VALIDATION SCHEMAS
// =============================================================================

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
    agreeToTerms: z.boolean().refine((val) => val === true, {
      message: 'You must agree to the terms and conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// =============================================================================
// POSTS VALIDATION SCHEMAS
// =============================================================================

export const postCreateSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  excerpt: z.string().max(500, 'Excerpt too long').optional(),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  categories: z.array(z.string()).max(5, 'Maximum 5 categories allowed').optional(),
  featured: z.boolean().optional().default(false),
  thumbnail: urlSchema.optional(),
  seoMetadata: z
    .object({
      description: z.string().max(160, 'Meta description too long'),
      keywords: z.array(z.string()).max(5, 'Maximum 5 keywords'),
      ogImage: urlSchema.optional(),
    })
    .optional(),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;

export const postUpdateSchema = postCreateSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export type PostUpdateInput = z.infer<typeof postUpdateSchema>;

export const postQuerySchema = z.object({
  page: z.coerce.number().int().positive('Page must be positive').optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size maximum is 100')
    .optional()
    .default(20),
  sort: z.enum(['createdAt', 'updatedAt', 'viewCount', 'title']).optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
  tags: z.string().optional(),
  categories: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export type PostQueryInput = z.infer<typeof postQuerySchema>;

// =============================================================================
// COMMENTS VALIDATION SCHEMAS
// =============================================================================

export const commentCreateSchema = z.object({
  postId: idSchema,
  parentCommentId: idSchema.optional(),
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment too long'),
  authorName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .optional(),
  authorEmail: emailSchema.optional(),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

// =============================================================================
// FILE UPLOAD VALIDATION SCHEMAS
// =============================================================================

export const MAX_FILE_SIZE = 52428800; // 50MB
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
];

export const fileUploadSchema = z.object({
  file: z
    .object({
      name: z.string(),
      size: z.number().max(MAX_FILE_SIZE, `File size must not exceed 50MB`),
      type: z.enum(ALLOWED_MIME_TYPES as any, {
        errorMap: () => ({ message: 'File type not allowed' }),
      }),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;

export const fileExtractSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  extractType: z.enum(['zip', 'tar', 'tar.gz', 'rar']),
  targetDirectory: z.string().optional(),
  password: z.string().optional(),
});

export type FileExtractInput = z.infer<typeof fileExtractSchema>;

// =============================================================================
// VIDEO VALIDATION SCHEMAS
// =============================================================================

export const videoStreamSchema = z.object({
  videoId: idSchema,
  quality: z.enum(['360p', '720p', '1080p']).optional().default('720p'),
  autoPlay: z.boolean().optional().default(false),
  controls: z.boolean().optional().default(true),
});

export type VideoStreamInput = z.infer<typeof videoStreamSchema>;

export const videoDecryptSchema = z.object({
  videoId: idSchema,
  encryptedData: z.string().min(1, 'Encrypted data is required'),
});

export type VideoDecryptInput = z.infer<typeof videoDecryptSchema>;

// =============================================================================
// PAGINATION VALIDATION SCHEMA
// =============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive('Page must be positive').optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'Page size must be at least 1')
    .max(100, 'Page size maximum is 100')
    .optional()
    .default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// =============================================================================
// PROFILE/USER VALIDATION SCHEMAS
// =============================================================================

export const userProfileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: emailSchema.optional(),
  avatar: urlSchema.optional(),
  bio: z.string().max(500, 'Bio too long').optional(),
  phone: phoneSchema.optional(),
});

export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate input against a schema
 * Returns parsed data or throws validation error
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate input, returning result or error details
 */
export function validateInputSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; errors?: Record<string, string> } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors: Record<string, string> = {};
    result.error.errors.forEach((error) => {
      const path = error.path.join('.');
      errors[path] = error.message;
    });
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}

/**
 * Create a custom validation error message
 */
export function createValidationError(field: string, message: string) {
  return {
    field,
    message,
  };
}

/**
 * Merge multiple validation schemas
 */
export function mergeSchemas<T extends z.ZodRawShape>(schemas: z.ZodObject<T>[]) {
  return z.object({} as T).merge(schemas[0]);
}

// =============================================================================
// ASYNC VALIDATORS
// =============================================================================

/**
 * Check if email already exists in database
 */
export async function validateEmailUnique(email: string): Promise<boolean> {
  try {
    // TODO: Implement database check
    // const user = await db.user.findFirst({ where: { email } });
    // return !user;
    return true;
  } catch (error) {
    throw new Error('Failed to validate email uniqueness');
  }
}

/**
 * Check if username is available
 */
export async function validateUsernameUnique(username: string): Promise<boolean> {
  try {
    // TODO: Implement database check
    // const user = await db.user.findFirst({ where: { username } });
    // return !user;
    return true;
  } catch (error) {
    throw new Error('Failed to validate username uniqueness');
  }
}

/**
 * Validate slug uniqueness (excluding current post if updating)
 */
export async function validateSlugUnique(
  slug: string,
  excludeId?: string
): Promise<boolean> {
  try {
    // TODO: Implement database check
    // const post = await db.post.findFirst({
    //   where: { slug, ...(excludeId && { id: { not: excludeId } }) }
    // });
    // return !post;
    return true;
  } catch (error) {
    throw new Error('Failed to validate slug uniqueness');
  }
}
