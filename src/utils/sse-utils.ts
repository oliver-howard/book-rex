import { Response } from 'express';

/**
 * Progress callback function type for SSE updates
 */
export type ProgressCallback = (stage: string, percent: number, message: string) => void;

/**
 * SSE progress event structure
 */
export interface SSEProgressEvent {
  stage: string;
  percent: number;
  message: string;
}

/**
 * Send a progress update via Server-Sent Events
 */
export function sendSSEProgress(
  res: Response,
  stage: string,
  percent: number,
  message: string
): void {
  const data: SSEProgressEvent = { stage, percent, message };
  res.write(`event: progress\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Send completion data via Server-Sent Events
 */
export function sendSSEComplete(res: Response, data: any): void {
  res.write(`event: complete\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  res.end();
}

/**
 * Send error via Server-Sent Events
 */
export function sendSSEError(res: Response, error: string): void {
  res.write(`event: server_error\n`);
  res.write(`data: ${JSON.stringify({ error })}\n\n`);
  res.end();
}

/**
 * Initialize SSE response with appropriate headers
 */
export function initSSEResponse(res: Response): void {
  // console.log('Initializing SSE response'); 
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
  
  // Send initial comment to flush buffers (helpful for Cloudflare/Nginx)
  res.write(': ping\n\n');
}
