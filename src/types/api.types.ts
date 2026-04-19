/**
 * @fileoverview Comprehensive API type definitions and contracts
 * Provides type safety for all API requests and responses across the application
 */

// =============================================================================
// GENERIC API RESPONSE TYPES
// =============================================================================

/**
 * Generic successful API response wrapper
 * @template T The data type contained in the response
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Generic error API response wrapper
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Paginated response wrapper
 * @template T The item type in the paginated list
 */
export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// =============================================================================
// POSTS ENDPOINT TYPES
// =============================================================================

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  tags: string[];
  categories: string[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  viewCount: number;
  commentCount: number;
  featured: boolean;
  thumbnail?: string;
  seoMetadata?: {
    description: string;
    keywords: string[];
    ogImage?: string;
  };
}

export interface PostCreateRequest {
  title: string;
  content: string;
  excerpt?: string;
  tags?: string[];
  categories?: string[];
  featured?: boolean;
  thumbnail?: string;
}

export interface PostUpdateRequest extends Partial<PostCreateRequest> {
  status?: 'draft' | 'published' | 'archived';
}

export interface PostDetailResponse extends Post {
  relatedPosts?: Post[];
  comments?: Comment[];
}

// =============================================================================
// AUTHENTICATION ENDPOINT TYPES
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin' | 'moderator';
  createdAt: string;
  lastLogin?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignInResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  agreeToTerms: boolean;
}

export interface SignUpResponse {
  user: Omit<AuthUser, 'lastLogin'>;
  accessToken: string;
  message: string;
}

export interface PasskeyStartRequest {
  email: string;
}

export interface PasskeyVerifyRequest {
  attestationObject: string;
  clientDataJSON: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

// =============================================================================
// FILE UPLOAD ENDPOINT TYPES
// =============================================================================

export interface FileUploadMetadata {
  filename: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  checksum?: string;
  tags?: string[];
}

export interface FileExtractRequest {
  filePath: string;
  extractType: 'zip' | 'tar' | 'tar.gz' | 'rar';
  targetDirectory?: string;
  password?: string;
}

export interface FileExtractResponse {
  success: boolean;
  extractedFiles: string[];
  extractedTo: string;
  totalFiles: number;
}

export interface FileDownloadResponse {
  filename: string;
  size: number;
  mimeType: string;
  downloadUrl: string;
  expiresAt?: string;
}

// =============================================================================
// VIDEO STREAMING ENDPOINT TYPES
// =============================================================================

export interface VideoMetadata {
  id: string;
  title: string;
  filename: string;
  duration: number; // seconds
  width: number;
  height: number;
  bitrate: number;
  format: string;
  uploadedAt: string;
  uploadedBy: string;
  isEncrypted: boolean;
  thumbnailUrl?: string;
}

export interface VideoStreamResponse {
  videoId: string;
  streamUrl: string;
  playlistUrl?: string;
  encryptionKey?: string;
  metadata: VideoMetadata;
}

export interface VideoDecryptRequest {
  videoId: string;
  encryptedData: string;
}

export interface VideoKeyResponse {
  videoId: string;
  key: string;
  expiresAt: string;
}

// =============================================================================
// PAGINATION QUERY TYPES
// =============================================================================

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string | number | boolean>;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

// =============================================================================
// NAVIGATION ENDPOINT TYPES
// =============================================================================

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  children?: NavigationItem[];
  order: number;
  visible: boolean;
  requiresAuth?: boolean;
  roles?: string[];
}

export interface NavigationResponse {
  items: NavigationItem[];
  generated: string;
}

// =============================================================================
// COMMENT TYPES
// =============================================================================

export interface Comment {
  id: string;
  postId: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'spam';
  createdAt: string;
  updatedAt?: string;
  replies?: Comment[];
  likes: number;
}

export interface CommentCreateRequest {
  postId: string;
  parentCommentId?: string;
  content: string;
  authorName?: string;
  authorEmail?: string;
}

// =============================================================================
// HEALTH CHECK TYPES
// =============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number; // milliseconds
  version: string;
  checks: {
    database: HealthCheckStatus;
    redis?: HealthCheckStatus;
    fileSystem?: HealthCheckStatus;
    externalApis?: Record<string, HealthCheckStatus>;
  };
  environment: string;
}

export interface HealthCheckStatus {
  status: 'ok' | 'warning' | 'error';
  message: string;
  responseTime?: number; // milliseconds
  lastChecked: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export enum ApiErrorCode {
  // Client Errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',

  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Custom Errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  POST_NOT_FOUND = 'POST_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  VIDEO_NOT_FOUND = 'VIDEO_NOT_FOUND',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
}

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public message: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// =============================================================================
// REQUEST/RESPONSE MIDDLEWARE TYPES
// =============================================================================

export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
}

export interface RequestValidationError {
  field: string;
  message: string;
  value?: any;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is error
 */
export function isErrorResponse(
  response: ApiResponse
): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Type guard for paginated responses
 */
export function isPaginatedResponse<T>(
  data: any
): data is PaginatedResponse<T> {
  return (
    data &&
    typeof data.items === 'object' &&
    typeof data.total === 'number' &&
    typeof data.page === 'number' &&
    typeof data.pageSize === 'number'
  );
}
