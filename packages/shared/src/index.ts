export * from './constants';
export * from './weapons';
export * from './arena';
export * from './types';
export * from './schema';
export * from './physics';

/** Generate a shareable 6-character room code (e.g. "ABCD12"). */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
